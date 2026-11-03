import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  GraduationCap,
  Wrench,
  ArrowRight,
  CheckCircle2,
  Building2,
  Clock,
  Lock,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { UserRole } from '../types';

interface LandingPageProps {
  onOpenSubmitModal?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const { user, profile, actualRole, isSuperAdmin, signInWithPortal } = useAuth();
  const navigate = useNavigate();

  const [portalLoading, setPortalLoading] = useState<UserRole | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roleMismatchPrompt, setRoleMismatchPrompt] = useState<{
    targetRole: UserRole;
    actualRole: UserRole;
  } | null>(null);

  const handlePortalClick = async (targetRole: UserRole) => {
    setErrorMessage(null);
    setRoleMismatchPrompt(null);

    // 1. If not logged in, begin Google authentication for this specific portal
    if (!user) {
      setPortalLoading(targetRole);
      try {
        const loggedInUser = await signInWithPortal(targetRole);
        if (loggedInUser) {
          navigate('/' + targetRole);
        }
      } catch (err: unknown) {
        console.warn('Sign in aborted or failed:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Authentication could not be completed.');
      } finally {
        setPortalLoading(null);
      }
      return;
    }

    // 2. If already logged in, perform authoritative database role check
    const userRole = profile?.role || actualRole;

    if (userRole === targetRole || (targetRole === 'staff' && isSuperAdmin)) {
      // Direct access to own portal
      navigate('/' + targetRole);
    } else {
      // Trigger role mismatch dialog
      setRoleMismatchPrompt({
        targetRole,
        actualRole: userRole
      });
    }
  };

  const getRoleTitle = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return 'Campus Administrator';
      case 'staff':
        return 'Maintenance Technician';
      case 'student':
        return 'Student';
      default:
        return r;
    }
  };

  return (
    <div className="space-y-12 py-8">
      {/* Error or Alert Banner */}
      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Portal Access Notice</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Role Mismatch In-page Notification */}
      {roleMismatchPrompt && (
        <div className="p-5 bg-amber-50 border border-amber-300 text-amber-900 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-sm text-slate-900">
                Institutional Role Mismatch
              </p>
              <p className="mt-0.5 text-slate-700">
                Your authenticated account (<strong>{user?.email}</strong>) is officially registered as a{' '}
                <strong className="text-indigo-900 font-bold uppercase">{getRoleTitle(roleMismatchPrompt.actualRole)}</strong>.
                You cannot enter the {getRoleTitle(roleMismatchPrompt.targetRole)} portal with this account.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/' + roleMismatchPrompt.actualRole)}
            className="px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs transition cursor-pointer self-end sm:self-center"
          >
            Enter {getRoleTitle(roleMismatchPrompt.actualRole)} Dashboard &rarr;
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-950 via-slate-900 to-slate-900 text-white rounded-2xl p-8 sm:p-12 lg:p-14 border border-slate-800 shadow-xl">
        <div className="max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold tracking-wide">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>Campus Facilities & Grievance Management Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white text-balance">
            Institutional Complaint & Facility Operations System
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
            A unified digital operations platform connecting students, maintenance staff, and facility administrators. Select your institutional portal below to access authorized service queues and track facility repairs across all campus departments.
          </p>

          {/* Quick status if already authenticated */}
          {user && (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <span className="text-xs text-slate-300">
                Currently signed in as <strong className="text-white">{user.email}</strong> ({actualRole.toUpperCase()})
              </span>
              <button
                onClick={() => navigate('/' + actualRole)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to My {getRoleTitle(actualRole)} Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Institutional Trust Pillars */}
        <div className="mt-10 pt-7 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-400/20 text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Verified College IDs</p>
              <p className="text-[11px] text-slate-400">Identity-authenticated access for all campus stakeholders</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Enforced SLA Timelines</p>
              <p className="text-[11px] text-slate-400">Automated turnaround countdowns and resolution deadlines</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Authoritative RBAC</p>
              <p className="text-[11px] text-slate-400">Strict separation of student, technician, and administrator rights</p>
            </div>
          </div>
        </div>
      </section>

      {/* The 3 Prominent Portal Cards */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Select Your Institutional Portal
          </h2>
          <p className="text-xs text-slate-500">
            Choose your designated university role to authenticate and enter your operational console.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Student Portal */}
          <div className="bg-white border-2 border-slate-200 hover:border-blue-700 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center border border-blue-200/60 shadow-2xs">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-50 text-blue-900 border border-blue-200">
                  Student Portal
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">1. Student Portal</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Lodge infrastructure grievances, track real-time repair progress, and inspect technician resolution notes.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Portal Capabilities:
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Submit complaints with category & campus location</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Live SLA countdown timers & diagnostic status updates</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Verify completed repairs and technician work remarks</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => handlePortalClick('student')}
              disabled={portalLoading !== null}
              className="w-full py-3 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
            >
              {portalLoading === 'student' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting Student Portal...</span>
                </>
              ) : (
                <>
                  <span>
                    {user && actualRole === 'student' ? 'Open Student Dashboard' : 'Enter Student Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Card 2: Staff Portal */}
          <div className="bg-white border-2 border-slate-200 hover:border-amber-700 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                  <Wrench className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-amber-50 text-amber-900 border border-amber-200">
                  Staff Portal
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">2. Staff Portal</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Field dispatch queue for certified maintenance technicians to manage assigned work orders and resolve tickets.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Portal Capabilities:
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Specialized work queues (Electrical, Plumbing, Network, Labs)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Lifecycle transitions: Assigned → In Progress → Resolved</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Log diagnostic observations, repair parts, & resolution notes</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => handlePortalClick('staff')}
              disabled={portalLoading !== null}
              className="w-full py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
            >
              {portalLoading === 'staff' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting Staff Portal...</span>
                </>
              ) : (
                <>
                  <span>
                    {user && actualRole === 'staff' ? 'Open Staff Queue' : 'Enter Staff Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Card 3: Admin Portal */}
          <div className="bg-white border-2 border-slate-200 hover:border-purple-700 rounded-2xl p-6 sm:p-7 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-900 flex items-center justify-center border border-purple-200/60 shadow-2xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-purple-50 text-purple-900 border border-purple-200">
                  Admin Portal
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">3. Admin Portal</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Institutional facility command center for ID verifications, technician dispatching, and SLA compliance.
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                  Portal Capabilities:
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Inspect college ID documents & approve user verifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Dispatch unallocated tickets to verified maintenance technicians</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Campus-wide SLA metrics, analytics charts & CSV data exports</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => handlePortalClick('admin')}
              disabled={portalLoading !== null}
              className="w-full py-3 px-4 rounded-xl bg-purple-950 hover:bg-purple-900 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
            >
              {portalLoading === 'admin' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Connecting Admin Portal...</span>
                </>
              ) : (
                <>
                  <span>
                    {user && actualRole === 'admin' ? 'Open Admin Console' : 'Enter Admin Portal'}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
