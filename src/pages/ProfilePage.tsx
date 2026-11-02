import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateSelfProfile } from '../services/usersService';
import {
  User,
  Building,
  Wrench,
  Shield,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Save,
  ShieldCheck,
  GraduationCap
} from 'lucide-react';

interface ProfilePageProps {
  onOpenAcademicModal?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = () => {
  const { user, profile, actualRole, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [department, setDepartment] = useState(profile?.department || 'General');
  const [designation, setDesignation] = useState(profile?.designation || '');
  const [collegeName, setCollegeName] = useState(profile?.collegeName || 'University Main Campus');
  const [specialization, setSpecialization] = useState(profile?.specialization || 'Electrical');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phoneNumber || '');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setDepartment(profile.department || 'General');
      setDesignation(profile.designation || (actualRole === 'admin' ? 'Campus Facilities Administrator' : ''));
      setCollegeName(profile.collegeName || 'University Main Campus');
      setSpecialization(profile.specialization || 'Electrical');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile, actualRole]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setMsg(null);
    try {
      const profileUpdates: Parameters<typeof updateSelfProfile>[1] = {
        displayName: displayName.trim(),
        department: department.trim(),
        phoneNumber: phoneNumber.trim()
      };
      if (actualRole === 'admin' || actualRole === 'staff') {
        profileUpdates.designation = designation.trim();
      }
      if (actualRole === 'student') {
        profileUpdates.collegeName = collegeName.trim();
      }
      if (actualRole === 'staff') {
        profileUpdates.specialization = specialization.trim();
      }
      await updateSelfProfile(user.uid, profileUpdates);
      await refreshProfile();
      setMsg({ type: 'success', text: 'Profile details saved successfully.' });
      setTimeout(() => setMsg(null), 4000);
    } catch (err: unknown) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-6 text-xs">
      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          {actualRole === 'admin' ? (
            <ShieldCheck className="w-6 h-6 text-purple-900" />
          ) : actualRole === 'staff' ? (
            <Wrench className="w-6 h-6 text-amber-800" />
          ) : (
            <GraduationCap className="w-6 h-6 text-blue-900" />
          )}
          {actualRole === 'admin'
            ? 'Administrator Profile'
            : actualRole === 'staff'
            ? 'Staff Technician Profile'
            : 'Student Profile'}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          View your authenticated campus identity, contact credentials, and verified institutional parameters.
        </p>
      </div>

      {msg && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Account Identity Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 text-center">
          <div className="relative inline-block">
            {profile?.photoURL ? (
              <img
                src={profile.photoURL}
                alt={profile.displayName}
                className="w-20 h-20 rounded-full border-2 border-blue-900 mx-auto object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-900 font-bold text-2xl flex items-center justify-center mx-auto border-2 border-blue-300">
                {profile?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900">{profile?.displayName || 'User'}</h2>
            <p className="text-xs text-slate-500 font-mono truncate">{user?.email}</p>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2.5 text-left">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Official Role:</span>
              <span className={`font-semibold uppercase text-xs px-2 py-0.5 rounded border ${
                actualRole === 'admin'
                  ? 'bg-purple-50 text-purple-950 border-purple-200'
                  : actualRole === 'staff'
                  ? 'bg-amber-50 text-amber-950 border-amber-200'
                  : 'bg-blue-50 text-blue-950 border-blue-200'
              }`}>
                {actualRole === 'admin' ? 'Administrator' : actualRole === 'staff' ? 'Maintenance Staff' : 'Student'}
              </span>
            </div>

            {/* ROLE SPECIFIC IDENTITY DETAILS */}
            {actualRole === 'admin' && (
              <>
                <div className="flex flex-col gap-0.5">
                  <span className="text-slate-500">Admin Authorization Status:</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Authorized Administrator (/admins active)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Designation:</span>
                  <span className="font-medium text-slate-800 text-xs">
                    {profile?.designation || designation || 'Facilities Director'}
                  </span>
                </div>
              </>
            )}

            {actualRole === 'student' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification Status:</span>
                  {profile?.verificationStatus === 'Approved' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified Student ID
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      {profile?.verificationStatus || 'Incomplete'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">College ID:</span>
                  <span className="font-mono font-semibold text-slate-800 text-xs">
                    {profile?.collegeId || 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Campus:</span>
                  <span className="text-slate-700 text-xs truncate max-w-[150px]">
                    {profile?.collegeName || collegeName}
                  </span>
                </div>
              </>
            )}

            {actualRole === 'staff' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Verification Status:</span>
                  {profile?.verificationStatus === 'Approved' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified Staff ID
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Clock className="w-3 h-3 text-amber-600" />
                      {profile?.verificationStatus || 'Incomplete'}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Employee ID:</span>
                  <span className="font-mono font-semibold text-slate-800 text-xs">
                    {profile?.collegeId || 'Unassigned'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Specialization:</span>
                  <span className="font-medium text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]">
                    {profile?.specialization || specialization}
                  </span>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="text-slate-500">Joined CampusCare:</span>
              <span className="font-mono text-slate-700 text-[11px] tabular-nums">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Role-Specific Profile Edit Form */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {actualRole === 'admin'
                ? 'Administrator Credentials & Contact Parameters'
                : actualRole === 'staff'
                ? 'Maintenance Technician Information'
                : 'Student Identity & Academic Contact Details'}
            </h3>
            <p className="text-xs text-slate-500">
              Update institutional parameters and dispatch notification contact points.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {actualRole === 'admin' ? 'Official Administrator Email' : actualRole === 'staff' ? 'Institutional Staff Email' : 'Student College Email'}
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono text-xs cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Managed via Google Workspace authentication</span>
            </div>

            {/* Department */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {actualRole === 'admin'
                  ? 'Administrative Department / Office'
                  : actualRole === 'staff'
                  ? 'Maintenance Operations Unit'
                  : 'Academic Department / Faculty'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  actualRole === 'admin'
                    ? 'e.g. Facilities Management & Campus Operations'
                    : actualRole === 'staff'
                    ? 'e.g. Electrical & Utilities Engineering'
                    : 'e.g. Computer Science & Engineering'
                }
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-xs"
              />
            </div>

            {/* Admin Designation */}
            {actualRole === 'admin' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Official Designation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus Facilities Superintendent / Operations Manager"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-900 text-xs"
                />
              </div>
            )}

            {/* Student College Name */}
            {actualRole === 'student' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  College / Campus Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. University Main Campus"
                  value={collegeName}
                  onChange={(e) => setCollegeName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-xs"
                />
              </div>
            )}

            {/* Staff Designation & Specialization */}
            {actualRole === 'staff' && (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Official Technician Designation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Electrical Technician"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Technician Specialization Trade
                  </label>
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-800 bg-white text-xs"
                  >
                    <option value="Electrical">Electrical & Power Systems</option>
                    <option value="Plumbing">Water & Plumbing Infrastructure</option>
                    <option value="Network & Internet">Campus Wi-Fi & LAN Network</option>
                    <option value="Laboratory">Laboratory & Hardware Instruments</option>
                    <option value="General Maintenance">General Carpentry & Classroom Facilities</option>
                  </select>
                </div>
              </>
            )}

            {/* Contact Phone Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Contact Phone Number / Extension
              </label>
              <input
                type="tel"
                placeholder="e.g. +91 98765 43210 or Ext. 402"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 text-xs font-mono"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Profile Credentials'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
