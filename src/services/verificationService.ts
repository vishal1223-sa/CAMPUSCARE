import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  deleteField
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestorePayload } from '../firebase';
import {
  VerificationRequest,
  UserProfile,
  UserRole,
  VerificationHistoryItem,
  AutomatedCheckResult
} from '../types';
import { logActivity } from './complaintsService';
import { User } from 'firebase/auth';
import { normalizeIdentifier } from './ocrService';

export const INITIAL_SUPER_ADMIN_EMAIL = 'vishalkokkula07@gmail.com';

/**
 * Checks if the user is the authorized initial Super Administrator and ensures
 * their authoritative record exists in /admins/{uid} and /users/{uid}
 */
export const checkAndBootstrapInitialAdmin = async (firebaseUser: User): Promise<boolean> => {
  if (!firebaseUser.email || firebaseUser.email.toLowerCase() !== INITIAL_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return false;
  }

  const adminDocRef = doc(db, 'admins', firebaseUser.uid);
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const now = new Date().toISOString();

  try {
    const adminSnap = await getDoc(adminDocRef);
    if (!adminSnap.exists() || !adminSnap.data()?.isSuperAdmin) {
      await setDoc(
        adminDocRef,
        {
          email: firebaseUser.email,
          role: 'admin',
          isSuperAdmin: true,
          grantedAt: now,
          bootstrapType: 'initial_super_administrator_bootstrap'
        },
        { merge: true }
      );
    }

    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      if (data.role !== 'admin' || data.verificationStatus !== 'Approved' || !data.isSuperAdmin) {
        await updateDoc(userDocRef, {
          role: 'admin',
          isSuperAdmin: true,
          verificationStatus: 'Approved',
          verifiedAt: now,
          verifiedBy: 'system_bootstrap',
          updatedAt: now
        });
      }
    } else {
      const initialProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || 'Super Administrator',
        role: 'admin',
        isSuperAdmin: true,
        verificationStatus: 'Approved',
        institutionId: 'inst-main',
        institutionName: 'University Main Campus',
        designation: 'Chief Campus Administrator',
        verifiedAt: now,
        verifiedBy: 'system_bootstrap',
        createdAt: now,
        updatedAt: now,
        ...(firebaseUser.photoURL ? { photoURL: firebaseUser.photoURL } : {})
      };
      await setDoc(userDocRef, cleanFirestorePayload(initialProfile));
    }

    return true;
  } catch (err) {
    console.warn('Initial super admin bootstrap check notice:', err);
    return false;
  }
};

/**
 * Submits a new verification request with uploaded ID document storage paths
 * and automated OCR/Face check results
 */
export const submitVerificationRequest = async (
  input: {
    userId: string;
    userEmail: string;
    userName: string;
    requestedRole: UserRole;
    institutionId: string;
    institutionName: string;
    // Student fields
    rollNumber?: string;
    course?: string;
    // Staff / Admin fields
    designation?: string;
    specialization?: string;
    // Documents
    idCardFrontUrl: string;
    idCardBackUrl?: string;
    profilePhotoUrl?: string;
    automatedCheck?: AutomatedCheckResult;
  }
): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', input.userId);
  const userRef = doc(db, 'users', input.userId);
  const now = new Date().toISOString();

  const newRequest: VerificationRequest = {
    id: input.userId,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    requestedRole: input.requestedRole,
    institutionId: input.institutionId,
    institutionName: input.institutionName,
    rollNumber: input.rollNumber?.trim(),
    course: input.course?.trim(),
    designation: input.designation?.trim(),
    specialization: input.specialization?.trim(),
    idCardFrontUrl: input.idCardFrontUrl,
    idCardBackUrl: input.idCardBackUrl,
    profilePhotoUrl: input.profilePhotoUrl,
    automatedCheck: input.automatedCheck,
    ocrData: input.automatedCheck,
    status: 'Pending Admin Approval',
    submittedAt: now,
    verificationHistory: [
      {
        status: 'Pending',
        timestamp: now,
        remarks: input.automatedCheck
          ? `Automated check: ${input.automatedCheck.status} (Confidence: ${input.automatedCheck.ocrConfidence}%)`
          : 'Verification request submitted with institutional ID card'
      }
    ]
  };

  try {
    // If student, check and acquire roll number claim per institution
    if (input.requestedRole === 'student' && input.rollNumber) {
      const normRoll = normalizeIdentifier(input.rollNumber);
      const claimId = `${input.institutionId}_${normRoll}`;
      const claimRef = doc(db, 'claimedInstitutionalIds', claimId);

      await runTransaction(db, async (transaction) => {
        const claimSnap = await transaction.get(claimRef);
        if (claimSnap.exists()) {
          const claimData = claimSnap.data();
          if (claimData.userId !== input.userId) {
            throw new Error(
              `Institutional Conflict: Roll Number "${input.rollNumber}" is already in use by another student account.`
            );
          }
        }

        transaction.set(claimRef, {
          id: claimId,
          institutionId: input.institutionId,
          rollNumber: input.rollNumber,
          userId: input.userId,
          claimedAt: now
        }, { merge: true });

        transaction.set(reqRef, cleanFirestorePayload(newRequest));

        const studentUpdates: Record<string, any> = {
          verificationStatus: 'Pending Admin Approval',
          institutionId: input.institutionId,
          institutionName: input.institutionName,
          rollNumber: (input.rollNumber || '').trim(),
          updatedAt: now
        };
        if (input.course?.trim()) {
          studentUpdates.course = input.course.trim();
        }

        transaction.update(userRef, studentUpdates);
      });
    } else {
      // Staff / Admin request
      await setDoc(reqRef, cleanFirestorePayload(newRequest));
      const staffUpdates: Record<string, any> = {
        verificationStatus: 'Pending Admin Approval',
        institutionId: input.institutionId,
        institutionName: input.institutionName,
        updatedAt: now
      };
      if (input.designation?.trim()) {
        staffUpdates.designation = input.designation.trim();
      }
      if (input.specialization?.trim()) {
        staffUpdates.specialization = input.specialization.trim();
      }
      await updateDoc(userRef, staffUpdates);
    }

    await logActivity(
      'ROLE_CHANGED',
      input.userId,
      input.userName,
      input.userId,
      `Submitted identity verification for role: ${input.requestedRole.toUpperCase()} (${input.institutionName})`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.WRITE, `verificationRequests/${input.userId}`);
    throw err;
  }
};

/**
 * Resubmits a rejected or resubmission-required verification request
 */
export const resubmitVerificationRequest = async (
  userId: string,
  updates: Partial<VerificationRequest>
): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', userId);
  const userRef = doc(db, 'users', userId);
  const now = new Date().toISOString();

  try {
    const existingSnap = await getDoc(reqRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as VerificationRequest) : null;

    const previousHistory = existing?.verificationHistory || [];
    const newHistoryItem: VerificationHistoryItem = {
      status: 'Pending',
      timestamp: now,
      remarks: 'Applicant resubmitted updated identity credentials and documents'
    };

    const updatedData: Record<string, any> = cleanFirestorePayload({
      ...updates,
      status: 'Pending Admin Approval',
      submittedAt: now,
      verificationHistory: [...previousHistory, newHistoryItem]
    });
    // Explicitly delete previous review fields on resubmission
    updatedData.rejectionRemarks = deleteField();
    updatedData.reviewedAt = deleteField();
    updatedData.reviewedBy = deleteField();
    updatedData.reviewerName = deleteField();

    await updateDoc(reqRef, updatedData);

    const userUpdates: Record<string, any> = cleanFirestorePayload({
      verificationStatus: 'Pending Admin Approval',
      updatedAt: now,
      ...(updates.rollNumber ? { rollNumber: updates.rollNumber } : {}),
      ...(updates.course ? { course: updates.course } : {}),
      ...(updates.institutionId ? { institutionId: updates.institutionId } : {}),
      ...(updates.institutionName ? { institutionName: updates.institutionName } : {})
    });
    userUpdates.rejectionReason = deleteField();

    await updateDoc(userRef, userUpdates);

    await logActivity(
      'ROLE_CHANGED',
      userId,
      existing?.userName || 'Applicant',
      userId,
      'Resubmitted identity verification after previous review'
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `verificationRequests/${userId}`);
    throw err;
  }
};

/**
 * Administrator approves a verification request
 * (Super Admin check enforced if requestedRole is 'admin')
 */
export const approveVerificationRequest = async (
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  isReviewerSuperAdmin: boolean
): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', requestId);
  const userRef = doc(db, 'users', requestId);
  const adminDocRef = doc(db, 'admins', requestId);
  const now = new Date().toISOString();

  try {
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('Verification request document not found');
    }
    const reqData = reqSnap.data() as VerificationRequest;

    // Super Admin privilege requirement: Only Super Admin can approve Admin accounts
    if (reqData.requestedRole === 'admin' && !isReviewerSuperAdmin) {
      throw new Error('Access Denied: Only a Super Administrator can approve administrative accounts.');
    }

    const history = reqData.verificationHistory || [];
    history.push({
      status: 'Approved',
      timestamp: now,
      reviewerName,
      remarks: 'Identity credentials and institutional ID verified and approved'
    });

    // 1. Update verification request record
    await updateDoc(reqRef, {
      status: 'Approved',
      reviewedAt: now,
      reviewedBy: reviewerId,
      reviewerName,
      verificationHistory: history
    });

    // 2. Update user profile to Approved and assign requested role
    await updateDoc(userRef, {
      role: reqData.requestedRole,
      verificationStatus: 'Approved',
      verifiedAt: now,
      verifiedBy: reviewerId,
      updatedAt: now
    });

    // 3. If approving an Administrator, add authoritative record to /admins
    if (reqData.requestedRole === 'admin') {
      await setDoc(
        adminDocRef,
        {
          email: reqData.userEmail,
          role: 'admin',
          isSuperAdmin: false,
          grantedAt: now,
          grantedBy: reviewerId
        },
        { merge: true }
      );
    }

    await logActivity(
      'ROLE_CHANGED',
      reviewerId,
      reviewerName,
      requestId,
      `Approved ${reqData.userName} (${reqData.userEmail}) as verified ${reqData.requestedRole.toUpperCase()}`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `verificationRequests/${requestId}`);
    throw err;
  }
};

/**
 * Administrator rejects a verification request with mandatory remarks
 */
export const rejectVerificationRequest = async (
  requestId: string,
  reviewerId: string,
  reviewerName: string,
  rejectionRemarks: string,
  requestResubmission: boolean = false
): Promise<void> => {
  const reqRef = doc(db, 'verificationRequests', requestId);
  const userRef = doc(db, 'users', requestId);
  const now = new Date().toISOString();

  if (!rejectionRemarks || rejectionRemarks.trim().length < 5) {
    throw new Error('Please provide specific remarks explaining why the verification was rejected.');
  }

  const finalStatus = requestResubmission ? 'Resubmission Required' : 'Rejected';

  try {
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) {
      throw new Error('Verification request document not found');
    }
    const reqData = reqSnap.data() as VerificationRequest;

    const history = reqData.verificationHistory || [];
    history.push({
      status: finalStatus,
      timestamp: now,
      reviewerName,
      remarks: rejectionRemarks.trim()
    });

    await updateDoc(reqRef, {
      status: finalStatus,
      reviewedAt: now,
      reviewedBy: reviewerId,
      reviewerName,
      rejectionRemarks: rejectionRemarks.trim(),
      verificationHistory: history
    });

    await updateDoc(userRef, {
      verificationStatus: finalStatus,
      rejectionReason: rejectionRemarks.trim(),
      updatedAt: now
    });

    await logActivity(
      'ROLE_CHANGED',
      reviewerId,
      reviewerName,
      requestId,
      `${finalStatus} for ${reqData.userName}: "${rejectionRemarks.trim()}"`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `verificationRequests/${requestId}`);
    throw err;
  }
};

/**
 * Real-time listener for all verification requests (Admin Console)
 */
export const subscribeToAllVerifications = (
  callback: (requests: VerificationRequest[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(collection(db, 'verificationRequests'), orderBy('submittedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: VerificationRequest[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as VerificationRequest), id: d.id }));
      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'verificationRequests');
      if (onError) onError(err);
    }
  );
};

/**
 * Real-time listener for a user's own verification request
 */
export const subscribeToUserVerification = (
  userId: string,
  callback: (req: VerificationRequest | null) => void,
  onError?: (err: unknown) => void
) => {
  const docRef = doc(db, 'verificationRequests', userId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        callback({ ...(snap.data() as VerificationRequest), id: snap.id });
      } else {
        callback(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, `verificationRequests/${userId}`);
      if (onError) onError(err);
    }
  );
};
