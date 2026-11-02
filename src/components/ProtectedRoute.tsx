import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { OnboardingGate } from './OnboardingGate';
import { RefreshCw, ShieldAlert, ArrowRight, LogOut } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  portalRole: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, portalRole }) => {
  const { user, profile, actualRole, isSuperAdmin, isApproved, loading, isLoggingOut, signOut } = useAuth();

  // If logging out or loading, show minimal spinner
  if (loading || isLoggingOut) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-900 mx-auto" />
        <p className="text-xs text-slate-500 font-medium">
          {isLoggingOut ? 'Signing out of CampusCare...' : 'Verifying campus credentials...'}
        </p>
      </div>
    );
  }

  // 1. If not authenticated, redirect to public landing page
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // 2. Authoritative role check
  const effectiveRole = profile?.role || actualRole;
  const isRoleAuthorized =
    effectiveRole === portalRole ||
    (isSuperAdmin && (portalRole === 'admin' || portalRole === 'staff'));

  // 3. If role mismatch, show security alert with direct action to their legitimate portal
  if (!isRoleAuthorized) {
    const roleDisplayName = (r: UserRole) => {
      switch (r) {
        case 'admin':
          return 'Campus Administrator';
        case 'staff':
          return 'Maintenance Technician';
        case 'student':
          return 'Student';
      }
    };

    return (
      <div className="py-12 max-w-xl mx-auto px-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-6 sm:p-8 space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">Portal Access Restricted</h2>
            <p className="text-xs text-slate-600 mt-1">
              You are attempting to access the{' '}
              <strong className="text-slate-900 font-semibold uppercase">{roleDisplayName(portalRole)}</strong> route.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 text-left space-y-1.5">
            <p>
              Your Google account (<strong>{user.email}</strong>) is officially registered as a{' '}
              <strong className="text-blue-900 font-bold uppercase">{roleDisplayName(effectiveRole)}</strong>.
            </p>
            <p className="text-slate-500 text-[11px]">
              CampusCare enforces authoritative separation of duties. To access this portal, sign in with an authorized account or navigate to your designated console.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => signOut()}
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out & Switch Account
            </button>
            <a
              href={'/' + effectiveRole}
              className="w-full sm:w-auto px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
            >
              Go to My {roleDisplayName(effectiveRole)} Console
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 4. Role matches: Check if identity verification is approved
  // If not approved, gate with portal-specific OnboardingGate
  return <OnboardingGate targetRole={portalRole}>{children}</OnboardingGate>;
};
