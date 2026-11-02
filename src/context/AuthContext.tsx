import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, signInWithGoogle, signOutUser, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { checkAndBootstrapInitialAdmin, INITIAL_SUPER_ADMIN_EMAIL } from '../services/verificationService';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  actualRole: UserRole;
  selectedPortal: UserRole | null;
  portalRoleMismatch: { targetRole: UserRole; actualRole: UserRole } | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStaff: boolean;
  isStudent: boolean;
  isApproved: boolean;
  loading: boolean;
  isLoggingOut: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signInWithPortal: (targetRole: UserRole) => Promise<User | null>;
  setSelectedPortal: (role: UserRole | null) => void;
  clearRoleMismatch: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const PORTAL_SESSION_KEY = 'campuscare_selected_portal';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedPortal, setSelectedPortalState] = useState<UserRole | null>(() => {
    try {
      return (sessionStorage.getItem(PORTAL_SESSION_KEY) as UserRole) || null;
    } catch {
      return null;
    }
  });
  const [portalRoleMismatch, setPortalRoleMismatch] = useState<{
    targetRole: UserRole;
    actualRole: UserRole;
  } | null>(null);

  const setSelectedPortal = (r: UserRole | null) => {
    setSelectedPortalState(r);
    try {
      if (r) {
        sessionStorage.setItem(PORTAL_SESSION_KEY, r);
      } else {
        sessionStorage.removeItem(PORTAL_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  };

  const fetchOrCreateProfile = async (
    firebaseUser: User,
    targetedPortal?: UserRole | null
  ): Promise<UserProfile> => {
    // 1. One-time secure initial super admin bootstrap check
    const isInitialSuperAdmin =
      firebaseUser.email?.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL.toLowerCase();

    if (isInitialSuperAdmin) {
      await checkAndBootstrapInitialAdmin(firebaseUser);
    }

    const userRef = doc(db, 'users', firebaseUser.uid);

    try {
      const snap = await getDoc(userRef);

      // Check current targeted portal from argument, state, or session
      let activePortal = targetedPortal || selectedPortal;
      if (!activePortal) {
        try {
          activePortal = (sessionStorage.getItem(PORTAL_SESSION_KEY) as UserRole) || null;
        } catch {
          activePortal = null;
        }
      }

      if (snap.exists()) {
        const existingData = snap.data() as UserProfile;

        // Role mismatch detection: If user clicked a portal that does NOT match their authoritative role
        if (activePortal && activePortal !== existingData.role) {
          setPortalRoleMismatch({
            targetRole: activePortal,
            actualRole: existingData.role
          });
        }

        // Clean up session key after checking
        try {
          sessionStorage.removeItem(PORTAL_SESSION_KEY);
        } catch {
          // ignore
        }

        return existingData;
      } else {
        const now = new Date().toISOString();
        // Check if user is recorded in authoritative /admins/{uid}
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        const adminData = adminSnap.exists() ? adminSnap.data() : null;
        const isAuthorizedAdmin = isInitialSuperAdmin || !!adminData;
        const isSuperAdmin = isInitialSuperAdmin || !!adminData?.isSuperAdmin;

        let initialRole: UserRole = 'student';
        let initialStatus: 'Approved' | 'Incomplete' = 'Incomplete';

        if (isAuthorizedAdmin) {
          initialRole = 'admin';
          initialStatus = 'Approved';
        } else if (activePortal === 'staff') {
          initialRole = 'staff';
          initialStatus = 'Incomplete';
        } else if (activePortal === 'admin') {
          // Applicant registers for admin portal - requires Super Admin authorization
          initialRole = 'admin';
          initialStatus = 'Incomplete';
        } else {
          initialRole = 'student';
          initialStatus = 'Incomplete';
        }

        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Campus User',
          photoURL: firebaseUser.photoURL || undefined,
          role: initialRole,
          isSuperAdmin: isSuperAdmin || undefined,
          verificationStatus: initialStatus,
          institutionId: 'inst-main',
          institutionName: 'University Main Campus',
          createdAt: now,
          updatedAt: now
        };

        await setDoc(userRef, newProfile);

        try {
          sessionStorage.removeItem(PORTAL_SESSION_KEY);
        } catch {
          // ignore
        }

        return newProfile;
      }
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const p = await fetchOrCreateProfile(user);
      setProfile(p);
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setAuthError(null);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const p = await fetchOrCreateProfile(firebaseUser);
          setProfile(p);
        } catch (err: unknown) {
          console.error('Error establishing user profile:', err);
          setAuthError('Could not load user profile. Please verify network or database connection.');
        }
      } else {
        setUser(null);
        setProfile(null);
        setPortalRoleMismatch(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setAuthError(msg);
      throw err;
    }
  };

  const signInWithPortal = async (targetRole: UserRole): Promise<User | null> => {
    setAuthError(null);
    setSelectedPortal(targetRole);
    try {
      const fbUser = await signInWithGoogle();
      if (!fbUser) return null;
      setUser(fbUser);
      const p = await fetchOrCreateProfile(fbUser, targetRole);
      setProfile(p);
      return fbUser;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign in failed';
      setAuthError(msg);
      throw err;
    }
  };

  const clearRoleMismatch = () => {
    setPortalRoleMismatch(null);
    setSelectedPortal(null);
  };

  const signOut = async () => {
    setIsLoggingOut(true);
    setAuthError(null);
    setPortalRoleMismatch(null);
    setSelectedPortal(null);
    try {
      sessionStorage.removeItem(PORTAL_SESSION_KEY);
    } catch {
      // ignore
    }

    try {
      // Immediate state reset in React
      setUser(null);
      setProfile(null);
      await signOutUser();
    } catch (err: unknown) {
      console.error('Error during signOut:', err);
      const msg = err instanceof Error ? err.message : 'Sign out failed';
      setAuthError(msg);
      throw err;
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Authentic database role
  const actualRole: UserRole = profile?.role || 'student';
  const role: UserRole = actualRole;

  const isSuperAdmin =
    !!profile?.isSuperAdmin ||
    profile?.email?.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL.toLowerCase();
  const isAdmin = actualRole === 'admin' || isSuperAdmin;
  const isStaff = actualRole === 'staff';
  const isStudent = actualRole === 'student';
  const isApproved = profile?.verificationStatus === 'Approved';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        actualRole,
        selectedPortal,
        portalRoleMismatch,
        isAdmin,
        isSuperAdmin,
        isStaff,
        isStudent,
        isApproved,
        loading,
        isLoggingOut,
        authError,
        signIn,
        signInWithPortal,
        setSelectedPortal,
        clearRoleMismatch,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
