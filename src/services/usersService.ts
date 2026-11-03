import {
  collection,
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestorePayload } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { logActivity } from './complaintsService';
import { INITIAL_SUPER_ADMIN_EMAIL } from './verificationService';

// Real-time listener for users
export const subscribeToAllUsers = (
  callback: (users: UserProfile[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: UserProfile[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as UserProfile), uid: d.id }));
      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
      if (onError) onError(err);
    }
  );
};

// Admin operation to change user role (Enforces Super Admin privilege for admin appointments)
export const updateUserRole = async (
  targetUserId: string,
  newRole: UserRole,
  adminUser: UserProfile
) => {
  const userRef = doc(db, 'users', targetUserId);
  const adminRef = doc(db, 'admins', targetUserId);
  const now = new Date().toISOString();

  // Protect Super Admin from being altered
  if (targetUserId === adminUser.uid && adminUser.email.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL.toLowerCase() && newRole !== 'admin') {
    throw new Error('Action Prohibited: The root Super Administrator account cannot be demoted.');
  }

  // Only Super Admin can promote someone to Admin
  if (newRole === 'admin' && !adminUser.isSuperAdmin && adminUser.email.toLowerCase() !== INITIAL_SUPER_ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Access Denied: Only a Super Administrator can grant Administrative privileges.');
  }

  try {
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: now
    });

    if (newRole === 'admin') {
      await setDoc(adminRef, {
        role: 'admin',
        isSuperAdmin: false,
        grantedAt: now,
        grantedBy: adminUser.uid
      }, { merge: true });
    } else {
      try {
        await deleteDoc(adminRef);
      } catch {
        // Safe to ignore if didn't exist
      }
    }

    await logActivity(
      'ROLE_CHANGED',
      adminUser.uid,
      adminUser.displayName || 'Admin',
      targetUserId,
      `Updated user ${targetUserId} role to ${newRole.toUpperCase()}`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUserId}`);
    throw err;
  }
};

// Update personal profile fields
export const updateSelfProfile = async (
  userId: string,
  updates: {
    displayName?: string;
    institutionId?: string;
    institutionName?: string;
    course?: string;
    department?: string;
    collegeName?: string;
    designation?: string;
    specialization?: string;
    phoneNumber?: string;
  }
) => {
  const userRef = doc(db, 'users', userId);
  try {
    const payload = cleanFirestorePayload({
      ...updates,
      updatedAt: new Date().toISOString()
    });
    await updateDoc(userRef, payload);
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    throw err;
  }
};
