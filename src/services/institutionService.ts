import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestorePayload } from '../firebase';
import { Institution, AdminInvitation } from '../types';
import { DEFAULT_COURSE_ALIASES } from './courseService';
import { logActivity } from './complaintsService';

export const SUPER_ADMIN_EMAIL = 'vishalkokkula07@gmail.com';

export const DEFAULT_INSTITUTIONS: Institution[] = [
  {
    id: 'inst-main',
    name: 'University Main Campus',
    code: 'UMC',
    superAdminEmails: [SUPER_ADMIN_EMAIL],
    courseAliases: DEFAULT_COURSE_ALIASES,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'inst-tech',
    name: 'Institute of Technology & Science',
    code: 'ITS',
    superAdminEmails: [SUPER_ADMIN_EMAIL],
    courseAliases: DEFAULT_COURSE_ALIASES,
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'inst-city',
    name: 'City Metropolitan College',
    code: 'CMC',
    superAdminEmails: [SUPER_ADMIN_EMAIL],
    courseAliases: DEFAULT_COURSE_ALIASES,
    createdAt: '2026-01-01T00:00:00.000Z'
  }
];

/**
 * Ensures initial default institutions exist in Firestore
 */
export const initializeInstitutions = async (): Promise<Institution[]> => {
  try {
    const instCol = collection(db, 'institutions');
    const snap = await getDocs(instCol);

    if (snap.empty) {
      for (const inst of DEFAULT_INSTITUTIONS) {
        await setDoc(doc(db, 'institutions', inst.id), inst);
      }
      return DEFAULT_INSTITUTIONS;
    }

    const institutions: Institution[] = [];
    snap.forEach((d) => institutions.push(d.data() as Institution));
    return institutions;
  } catch (err) {
    console.warn('Could not load institutions from Firestore, falling back to defaults:', err);
    return DEFAULT_INSTITUTIONS;
  }
};

/**
 * Gets a specific institution by ID
 */
export const getInstitution = async (institutionId: string): Promise<Institution | null> => {
  try {
    const d = await getDoc(doc(db, 'institutions', institutionId));
    if (d.exists()) {
      return d.data() as Institution;
    }
    const def = DEFAULT_INSTITUTIONS.find((i) => i.id === institutionId);
    return def || null;
  } catch (err) {
    console.warn(`Error getting institution ${institutionId}:`, err);
    return DEFAULT_INSTITUTIONS.find((i) => i.id === institutionId) || null;
  }
};

/**
 * Updates course aliases for an institution (Super Admin only)
 */
export const updateInstitutionCourseAliases = async (
  institutionId: string,
  aliases: Record<string, string[]>,
  superAdminUid: string,
  superAdminName: string
): Promise<void> => {
  try {
    const instRef = doc(db, 'institutions', institutionId);
    await updateDoc(instRef, {
      courseAliases: aliases
    });

    await logActivity(
      'INSTITUTION_UPDATED',
      superAdminUid,
      superAdminName,
      institutionId,
      `Updated course alias dictionary for institution ${institutionId}`
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `institutions/${institutionId}`);
    throw err;
  }
};

/**
 * Creates a single-use Admin Invitation (Super Admin only)
 */
export const createAdminInvitation = async (
  institutionId: string,
  invitedEmail: string,
  superAdminUid: string,
  superAdminName: string
): Promise<AdminInvitation> => {
  const inviteCode = 'INV-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const invitation: AdminInvitation = {
    id: inviteCode,
    institutionId,
    invitedEmail: invitedEmail.trim().toLowerCase(),
    invitedBy: superAdminUid,
    invitedByName: superAdminName,
    status: 'Pending',
    createdAt: now.toISOString(),
    expiresAt
  };

  try {
    await setDoc(doc(db, 'adminInvitations', inviteCode), cleanFirestorePayload(invitation));

    await logActivity(
      'ADMIN_INVITED',
      superAdminUid,
      superAdminName,
      invitedEmail,
      `Created administrative invitation (${inviteCode}) for ${invitedEmail}`
    );

    return invitation;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `adminInvitations/${inviteCode}`);
    throw err;
  }
};

/**
 * Validates an admin invitation code
 */
export const validateAdminInvitation = async (
  inviteCode: string,
  userEmail: string
): Promise<{ valid: boolean; reason?: string; invitation?: AdminInvitation }> => {
  try {
    const inviteRef = doc(db, 'adminInvitations', inviteCode.trim().toUpperCase());
    const snap = await getDoc(inviteRef);

    if (!snap.exists()) {
      return { valid: false, reason: 'Invalid or nonexistent invitation code.' };
    }

    const invitation = snap.data() as AdminInvitation;
    if (invitation.status !== 'Pending') {
      return { valid: false, reason: `Invitation has already been ${invitation.status.toLowerCase()}.` };
    }

    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      return { valid: false, reason: 'This invitation code has expired.' };
    }

    if (invitation.invitedEmail.toLowerCase() !== userEmail.trim().toLowerCase()) {
      return {
        valid: false,
        reason: `This invitation code was issued specifically to ${invitation.invitedEmail}. Your logged-in email is ${userEmail}.`
      };
    }

    return { valid: true, invitation };
  } catch (err) {
    return { valid: false, reason: 'Could not verify invitation at this time.' };
  }
};

/**
 * Subscribes to admin invitations for an institution
 */
export const subscribeToAdminInvitations = (
  institutionId: string,
  callback: (invitations: AdminInvitation[]) => void
) => {
  const q = query(collection(db, 'adminInvitations'), where('institutionId', '==', institutionId));
  return onSnapshot(q, (snap) => {
    const list: AdminInvitation[] = [];
    snap.forEach((d) => list.push(d.data() as AdminInvitation));
    callback(list);
  });
};
