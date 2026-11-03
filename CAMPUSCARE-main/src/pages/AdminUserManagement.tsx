import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfile, UserRole, Institution, AdminInvitation } from '../types';
import { subscribeToAllUsers, updateUserRole } from '../services/usersService';
import {
  initializeInstitutions,
  updateInstitutionCourseAliases,
  createAdminInvitation,
  subscribeToAdminInvitations
} from '../services/institutionService';
import {
  Users,
  Shield,
  GraduationCap,
  Wrench,
  Search,
  CheckCircle2,
  AlertCircle,
  Building,
  KeyRound,
  Plus,
  BookOpen,
  Crown
} from 'lucide-react';

export const AdminUserManagement: React.FC = () => {
  const { user: currentAuthUser, profile: currentProfile, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'aliases' | 'invitations'>('users');

  // Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Institution & Course Aliases state
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>('inst-main');
  const [newAliasKey, setNewAliasKey] = useState<string>('');
  const [newAliasValues, setNewAliasValues] = useState<string>('');
  const [aliasSaving, setAliasSaving] = useState<boolean>(false);

  // Invitations state
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [isCreatingInvite, setIsCreatingInvite] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllUsers(
      (list) => {
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching users:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    initializeInstitutions().then((list) => {
      setInstitutions(list);
    });
  }, []);

  useEffect(() => {
    if (selectedInstId) {
      const unsub = subscribeToAdminInvitations(selectedInstId, (invs) => {
        setInvitations(invs);
      });
      return () => unsub();
    }
  }, [selectedInstId]);

  const handleRoleChange = async (targetUser: UserProfile, newRole: UserRole) => {
    if (!currentProfile) return;

    if (newRole === 'admin' && !isSuperAdmin) {
      setStatusMessage({
        type: 'error',
        text: 'Access Denied: Only a Super Administrator can promote users to Administrator.'
      });
      return;
    }

    if (targetUser.uid === currentAuthUser?.uid && newRole !== 'admin') {
      if (!confirm('Warning: You are demoting your own administrator account. Are you sure?')) {
        return;
      }
    }

    setUpdatingUid(targetUser.uid);
    setStatusMessage(null);

    try {
      await updateUserRole(targetUser.uid, newRole, currentProfile);
      setStatusMessage({
        type: 'success',
        text: `Updated ${targetUser.displayName || targetUser.email} to role: ${newRole.toUpperCase()}`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update user role'
      });
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleSaveCourseAlias = async () => {
    if (!newAliasKey.trim() || !newAliasValues.trim() || !currentProfile) return;
    setAliasSaving(true);
    setStatusMessage(null);

    const currentInst = institutions.find((i) => i.id === selectedInstId);
    if (!currentInst) return;

    const values = newAliasValues
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const updatedAliases = {
      ...currentInst.courseAliases,
      [newAliasKey.trim()]: values
    };

    try {
      await updateInstitutionCourseAliases(
        selectedInstId,
        updatedAliases,
        currentProfile.uid,
        currentProfile.displayName || 'Super Admin'
      );

      setInstitutions((prev) =>
        prev.map((inst) =>
          inst.id === selectedInstId ? { ...inst, courseAliases: updatedAliases } : inst
        )
      );

      setStatusMessage({
        type: 'success',
        text: `Course alias group "${newAliasKey}" configured successfully.`
      });
      setNewAliasKey('');
      setNewAliasValues('');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to update course alias dictionary.'
      });
    } finally {
      setAliasSaving(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !currentProfile) return;
    setIsCreatingInvite(true);
    setStatusMessage(null);

    try {
      const invite = await createAdminInvitation(
        selectedInstId,
        inviteEmail.trim(),
        currentProfile.uid,
        currentProfile.displayName || 'Super Admin'
      );

      setStatusMessage({
        type: 'success',
        text: `Admin Invitation created: Code "${invite.id}" generated for ${invite.invitedEmail}`
      });
      setInviteEmail('');
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Failed to create admin invitation.'
      });
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.rollNumber && u.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.course && u.course.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const selectedInst = institutions.find((i) => i.id === selectedInstId) || institutions[0];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Institutional User & System Governance</h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3.5 h-3.5 text-amber-700" /> Super Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Manage authenticated users, configure OCR course aliases, and manage Super Administrator invitations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'users' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Campus Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('aliases')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
              activeTab === 'aliases' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Course Aliases
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === 'invitations'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Admin Invitations
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center gap-2 font-medium ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {statusMessage.text}
        </div>
      )}

      {/* TAB 1: CAMPUS ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search & Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, roll number..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500">Filter Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none"
              >
                <option value="All">All Roles</option>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* User List */}
          {loading ? (
            <div className="p-8 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
              Loading user accounts...
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isTargetSuperAdmin =
                  u.isSuperAdmin || u.email.toLowerCase() === 'vishalkokkula07@gmail.com';

                return (
                  <div key={u.uid} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img
                          src={u.photoURL}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600">
                          {u.displayName?.charAt(0) || u.email.charAt(0)}
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-sm">{u.displayName}</span>
                          {isTargetSuperAdmin && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                          <span>{u.email}</span>
                          {u.rollNumber && <span className="font-mono">Roll: {u.rollNumber}</span>}
                          {u.course && <span>{u.course}</span>}
                          <span>Status: {u.verificationStatus}</span>
                        </div>
                      </div>
                    </div>

                    {/* Role changer dropdown */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-xs text-slate-500">Role:</span>
                      <select
                        value={u.role}
                        disabled={updatingUid === u.uid || isTargetSuperAdmin}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 disabled:opacity-50"
                      >
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COURSE ALIAS CONFIGURATION */}
      {activeTab === 'aliases' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Configurable Course Alias Matching</h2>
            <p className="text-xs text-slate-600 mb-4">
              Students enter varying course designations on their cards. Add aliases to automatically match variations during OCR.
            </p>

            {/* Select Institution */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Active Institution
              </label>
              <select
                value={selectedInstId}
                onChange={(e) => setSelectedInstId(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium"
              >
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Add new alias group */}
            {isSuperAdmin && (
              <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-4 mb-6">
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider block mb-2">
                  Add / Update Course Alias Group
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Official Course Name
                    </label>
                    <input
                      type="text"
                      value={newAliasKey}
                      onChange={(e) => setNewAliasKey(e.target.value)}
                      placeholder="e.g. B.Sc Data Science"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Accepted Aliases (Comma Separated)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newAliasValues}
                        onChange={(e) => setNewAliasValues(e.target.value)}
                        placeholder="e.g. bsc ds, b.sc ds, data science, bsc data"
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        onClick={handleSaveCourseAlias}
                        disabled={aliasSaving || !newAliasKey.trim() || !newAliasValues.trim()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        {aliasSaving ? 'Saving...' : 'Save Group'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Existing Aliases Display */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Current Active Course Aliases ({Object.keys(selectedInst?.courseAliases || {}).length} groups)
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(selectedInst?.courseAliases || {}).map(([canon, aliases]) => (
                  <div key={canon} className="border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                    <span className="font-semibold text-slate-900 text-xs block mb-1">{canon}</span>
                    <div className="flex flex-wrap gap-1">
                      {aliases.map((al, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-600 font-mono"
                        >
                          {al}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADMIN INVITATIONS (SUPER ADMIN ONLY) */}
      {activeTab === 'invitations' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 mb-1">Issue Single-Use Administrator Invitations</h2>
            <p className="text-xs text-slate-600 mb-6">
              Create cryptographically secure, single-use invitation codes for authorized campus facilities managers.
            </p>

            <form onSubmit={handleCreateInvite} className="flex gap-3 max-w-lg mb-8">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter administrator email address"
                className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
              <button
                type="submit"
                disabled={isCreatingInvite || !inviteEmail.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isCreatingInvite ? 'Issuing...' : 'Generate Code'}
              </button>
            </form>

            {/* List of issued invitations */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Active & Past Invitations
              </span>

              {invitations.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">No invitations issued yet.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {invitations.map((inv) => (
                    <div key={inv.id} className="p-3.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-indigo-700 text-sm block">{inv.id}</span>
                        <span className="text-slate-600">
                          Recipient: {inv.invitedEmail} • Issued by {inv.invitedByName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                            inv.status === 'Pending'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {inv.status}
                        </span>
                        <span className="text-slate-400 block text-[10px] mt-0.5">
                          Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
