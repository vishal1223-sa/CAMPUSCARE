import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';

interface PortalRoleMismatchModalProps {
  onNavigateToDashboard: () => void;
}

export const PortalRoleMismatchModal: React.FC<PortalRoleMismatchModalProps> = ({
  onNavigateToDashboard
}) => {
  const { user, profile, portalRoleMismatch, clearRoleMismatch, signOut } = useAuth();

  if (!portalRoleMismatch) return null;

  const { targetRole, actualRole } = portalRoleMismatch;

  const roleDisplayName = (r: string) => {
    switch (r) {
      case 'admin':
        return 'Administrator';
      case 'staff':
        return 'Maintenance Technician';
      case 'student':
        return 'Student';
      default:
        return r.toUpperCase();
    }
  };

  const handleContinueToActual = () => {
    clearRoleMismatch();
    onNavigateToDashboard();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Banner */}
        <div className="bg-amber-500/10 border-b border-amber-200 px-6 py-5 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Institutional Role Notice</h3>
            <p className="text-xs text-slate-600">
              Account registered under an authoritative capacity
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs text-slate-600">
          <p className="leading-relaxed">
            You initiated sign-in through the{' '}
            <strong className="text-slate-900 font-semibold">{roleDisplayName(targetRole)} Portal</strong>.
            However, your Google account (
            <span className="font-mono text-slate-800 font-semibold">{user?.email}</span>) is officially
            registered in the CampusCare database as an authorized{' '}
            <strong className="text-blue-900 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
              {roleDisplayName(actualRole)}
            </strong>.
          </p>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Role Integrity Preserved</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-normal">
              To enforce strict campus facilities security, selecting a portal cannot alter, downgrade, or elevate your authenticated institutional privileges.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full sm:w-auto px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out & Switch Account
            </button>

            <button
              type="button"
              onClick={handleContinueToActual}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              Proceed to {roleDisplayName(actualRole)} Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
