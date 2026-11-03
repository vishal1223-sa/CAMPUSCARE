import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  ShieldCheck,
  LogOut,
  CheckCircle2,
  Clock,
  RefreshCw,
  PlusCircle,
  Home
} from 'lucide-react';

interface NavbarProps {
  onOpenSubmitModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenSubmitModal }) => {
  const { user, profile, role, actualRole, isApproved, isLoggingOut, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-8 h-16">
          {/* Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 text-left group">
              <div className="w-9 h-9 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-lg shadow-xs group-hover:bg-blue-800 transition-colors">
                C
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block leading-tight">
                  CampusCare
                </span>
                <span className="text-[11px] text-slate-500 font-medium block leading-none">
                  Campus Facilities & Maintenance System
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links based on Route and Role */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {/* Always available: Portal Home */}
            <Link
              to="/"
              className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isActive('/') && location.pathname === '/' ? 'text-blue-900 font-semibold' : ''
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Public Landing</span>
            </Link>

            {user && (
              <>
                {role === 'student' && (
                  <>
                    <Link
                      to="/student"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/student' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/student/complaints"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/student/complaints' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      My Complaints
                    </Link>
                    {isApproved && (
                      <button
                        onClick={onOpenSubmitModal}
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-semibold cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>File Incident</span>
                      </button>
                    )}
                  </>
                )}

                {role === 'staff' && (
                  <>
                    <Link
                      to="/staff"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/staff' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      Assigned Queue
                    </Link>
                    <Link
                      to="/staff/history"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/staff/history' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      Work History
                    </Link>
                  </>
                )}

                {role === 'admin' && (
                  <>
                    <Link
                      to="/admin"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/admin' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      Overview & Dispatch
                    </Link>
                    <Link
                      to="/admin/verification"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                        location.pathname === '/admin/verification' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-900" />
                      <span>ID Verifications</span>
                    </Link>
                    <Link
                      to="/admin/users"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/admin/users' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      User Directory
                    </Link>
                    <Link
                      to="/admin/reports"
                      className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                        location.pathname === '/admin/reports' ? 'text-blue-900 font-semibold' : ''
                      }`}
                    >
                      Analytics & Reports
                    </Link>
                  </>
                )}

                <Link
                  to="/profile"
                  className={`hover:text-blue-900 transition-colors whitespace-nowrap shrink-0 ${
                    location.pathname === '/profile' ? 'text-blue-900 font-semibold' : ''
                  }`}
                >
                  Profile
                </Link>
              </>
            )}
          </nav>

          {/* Account & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                {/* User avatar & role indicator */}
                <div className="flex items-center gap-2">
                  {profile?.photoURL ? (
                    <img
                      src={profile.photoURL}
                      alt={profile.displayName || 'User'}
                      className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center">
                      {profile?.displayName?.charAt(0).toUpperCase() || user.displayName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}

                  <div className="hidden sm:block text-left leading-tight">
                    <p className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                      {profile?.displayName || user.displayName || 'Campus User'}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500 uppercase font-medium">
                        {actualRole}
                      </span>
                      {profile?.verificationStatus === 'Approved' ? (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-700 font-bold bg-amber-50 px-1 rounded">
                          <Clock className="w-2.5 h-2.5" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sign Out Button with instantaneous loading state */}
                <button
                  onClick={handleSignOut}
                  disabled={isLoggingOut}
                  title="Sign out of CampusCare"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1 text-xs font-medium"
                >
                  {isLoggingOut ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                      <span className="hidden sm:inline text-rose-600">Signing Out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
                      <span className="hidden sm:inline">Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  Select a portal to enter
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
