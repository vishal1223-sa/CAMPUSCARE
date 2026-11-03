import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Complaint, isComplaintActive, isComplaintResolved } from '../types';
import {
  subscribeToAllComplaints,
  updateComplaintStatus,
  isComplaintOverdue
} from '../services/complaintsService';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { SlaCountdown } from '../components/SlaCountdown';
import {
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  MapPin,
  Calendar,
  ChevronRight,
  Filter,
  Search,
  User,
  Users
} from 'lucide-react';

interface StaffDashboardProps {
  onOpenDetailsModal: (complaint: Complaint) => void;
  onOpenUpdateStatusModal: (complaint: Complaint) => void;
}

export const StaffDashboard: React.FC<StaffDashboardProps> = ({
  onOpenDetailsModal,
  onOpenUpdateStatusModal
}) => {
  const { user, profile, actualRole } = useAuth();
  const [allAssignedComplaints, setAllAssignedComplaints] = useState<Complaint[]>([]);
  const [selectedTechId, setSelectedTechId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const unsub = subscribeToAllComplaints(
      (all) => {
        // Enforce strict invariant: Unassigned complaints (assignedStaffId == null or '')
        // MUST NEVER appear in a technician's assigned queue or be counted as assigned.
        const legitimatelyAssigned = all.filter(
          (c) => c.assignedStaffId && c.assignedStaffId.trim() !== ''
        );

        if (actualRole === 'admin') {
          // Administrator previewing staff console: can inspect all legitimately assigned work orders
          setAllAssignedComplaints(legitimatelyAssigned);
        } else {
          // Authenticated staff technician: only view tickets assigned specifically to their UID
          setAllAssignedComplaints(legitimatelyAssigned.filter((c) => c.assignedStaffId === user.uid));
        }

        setLoading(false);
      },
      (err) => {
        console.error('Error in staff complaints subscriber:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, actualRole]);

  // If in admin preview and a specific technician is selected, filter further
  const complaints = allAssignedComplaints.filter((c) => {
    if (actualRole === 'admin' && selectedTechId !== 'all') {
      return c.assignedStaffId === selectedTechId;
    }
    return true;
  });

  // Extract unique assigned technicians for preview selector
  const availableTechnicians = Array.from(
    new Map(
      allAssignedComplaints.map((c) => [c.assignedStaffId, c.assignedStaffName || 'Technician'])
    ).entries()
  );

  // Consistent metric calculations across all cards
  const totalAssigned = complaints.length;
  const activeCount = complaints.filter(isComplaintActive).length;
  const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(isComplaintResolved).length;
  const overdueCount = complaints.filter(isComplaintOverdue).length;

  const handleQuickStartJob = async (e: React.MouseEvent, complaint: Complaint) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await updateComplaintStatus(
        complaint.id,
        'In Progress',
        user.uid,
        profile?.displayName || 'Technician',
        'Technician arrived on site and commenced diagnostic inspection'
      );
    } catch (err) {
      console.error('Quick start failed:', err);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaintId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.assignedStaffName && c.assignedStaffName.toLowerCase().includes(searchTerm.toLowerCase()));

    let matchesStatus = true;
    if (statusFilter === 'Active') {
      matchesStatus = isComplaintActive(c);
    } else if (statusFilter === 'In Progress') {
      matchesStatus = c.status === 'In Progress';
    } else if (statusFilter === 'Resolved') {
      matchesStatus = isComplaintResolved(c);
    } else if (statusFilter === 'Overdue') {
      matchesStatus = isComplaintOverdue(c);
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-blue-900" />
            Maintenance Technician Dispatch Console
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Specialized work orders, field diagnostics, and resolution SLA tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {actualRole === 'admin' && availableTechnicians.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 text-xs">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-500 text-[11px]">Filter Staff:</span>
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="bg-transparent font-medium text-slate-800 text-xs focus:outline-none cursor-pointer"
              >
                <option value="all">All Assigned Staff ({availableTechnicians.length})</option>
                {availableTechnicians.map(([id, name]) => (
                  <option key={id || ''} value={id || ''}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200">
            {profile?.displayName || user?.email}
          </span>
          {profile?.specialization && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200">
              {profile.specialization}
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row - Strictly consistent with Firestore records */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Assigned Jobs</span>
            <Wrench className="w-4 h-4 text-blue-900" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalAssigned}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Allocated to technician</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Active (Need Work)</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-blue-800 tabular-nums">
            {activeCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned or in repair</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Completed / Fixed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {resolvedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Resolved with remarks</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Overdue Warnings</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
            {overdueCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Exceeded priority SLA</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket ID, location, student name, symptom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {['Active', 'In Progress', 'Overdue', 'Resolved', 'All'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === tab
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task Queue List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Work Orders ({filteredComplaints.length})
          </h2>
          <span className="text-[11px] text-slate-500">
            {statusFilter === 'Active' ? 'Active Jobs (Assigned & In Progress)' : `Filter: ${statusFilter}`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading technician dispatch orders...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-xs text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">
              {totalAssigned === 0
                ? 'No Assigned Work Orders'
                : 'No Work Orders in Selected Filter'}
            </p>
            <p className="max-w-md mx-auto">
              {totalAssigned === 0
                ? 'Unassigned complaints submitted by students remain in the unassigned pool until an administrator allocates them to a technician in the Admin Console.'
                : 'No work orders currently match the selected status filter. Select "All" or "Active" to view available tickets.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredComplaints.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenDetailsModal(item)}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="space-y-1.5 flex-1 min-w-0 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 tabular-nums">
                      {item.complaintId}
                    </span>
                    <StatusBadge status={item.status} size="sm" />
                    <PriorityBadge priority={item.priority} />
                    <span className="text-slate-400">·</span>
                    <span className="font-medium text-slate-700">{item.category}</span>
                    <span className="text-slate-400">·</span>
                    <SlaCountdown complaint={item} />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-900 transition-colors truncate">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-slate-700">
                      <MapPin className="w-3.5 h-3.5 text-blue-900" />
                      {item.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {item.studentName}
                    </span>
                    {item.assignedStaffName && (
                      <span className="flex items-center gap-1 text-slate-600 font-medium">
                        <Wrench className="w-3.5 h-3.5 text-slate-400" />
                        {item.assignedStaffName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Technician Actions */}
                <div
                  className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.status === 'Assigned' && (
                    <button
                      onClick={(e) => handleQuickStartJob(e, item)}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 text-amber-700" />
                      Start Work
                    </button>
                  )}

                  {item.status !== 'Resolved' && item.status !== 'Cancelled' && (
                    <button
                      onClick={() => onOpenUpdateStatusModal(item)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded transition-colors shadow-xs flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Update Status
                    </button>
                  )}

                  <button
                    onClick={() => onOpenDetailsModal(item)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
