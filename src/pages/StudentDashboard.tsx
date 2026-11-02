import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  isComplaintPending,
  isComplaintResolved
} from '../types';
import { subscribeToStudentComplaints } from '../services/complaintsService';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { SlaCountdown } from '../components/SlaCountdown';
import {
  PlusCircle,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface StudentDashboardProps {
  onOpenSubmitModal: () => void;
  onOpenDetailsModal: (complaint: Complaint) => void;
  onOpenEditModal: (complaint: Complaint) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  onOpenSubmitModal,
  onOpenDetailsModal,
  onOpenEditModal
}) => {
  const { user, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsub = subscribeToStudentComplaints(
      user.uid,
      (data) => {
        setComplaints(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching student complaints:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Compute metric counts
  const totalCount = complaints.length;
  const pendingCount = complaints.filter(isComplaintPending).length;
  const inProgressCount = complaints.filter((c) => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(isComplaintResolved).length;

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaintId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  return (
    <div className="space-y-6 py-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Student Incident Portal
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Welcome back, <span className="font-semibold text-slate-700">{profile?.displayName || user?.email}</span>. Manage your filed campus grievances and monitor live repair stages.
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center justify-center gap-2 shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          File New Complaint
        </button>
      </div>

      {/* Metric Cards (60-30-10 & Tabular Numerals) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Complaints</span>
            <FileText className="w-4 h-4 text-blue-900" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Logged by you</p>
        </div>

        {/* Card 2: Pending */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Pending Dispatch</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-blue-800 tabular-nums">
            {pendingCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Submitted or Assigned</p>
        </div>

        {/* Card 3: In Progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Under Repair</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {inProgressCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Technician on site</p>
        </div>

        {/* Card 4: Resolved */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {resolvedCount}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Work completed</p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, keyword, location (e.g. CMP-2026, projector, Lab 1)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 whitespace-nowrap">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
            >
              <option value="All">All Categories</option>
              <option value="Classroom">Classroom</option>
              <option value="Laboratory">Laboratory</option>
              <option value="Electrical">Electrical</option>
              <option value="Plumbing">Plumbing</option>
              <option value="Internet">Internet</option>
              <option value="Furniture">Furniture</option>
              <option value="Cleanliness">Cleanliness</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Status segmented controls per frontend-design */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs border-t border-slate-100">
          <span className="text-slate-400 text-xs pr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['All', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Complaints List / Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            My Registered Complaints ({filteredComplaints.length})
          </h2>
          <span className="text-[11px] text-slate-500">Live sync enabled</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Syncing records from Cloud Firestore...</p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">No Complaints Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'All' || categoryFilter !== 'All'
                  ? 'No records match your selected filter criteria. Try resetting the filters.'
                  : 'You have not registered any campus maintenance complaints yet. Click below to file an incident.'}
              </p>
            </div>
            <button
              onClick={onOpenSubmitModal}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-medium text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
            >
              <PlusCircle className="w-4 h-4" />
              File First Complaint
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredComplaints.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenDetailsModal(item)}
                className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                {/* Left: Info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 tabular-nums">
                      {item.complaintId}
                    </span>
                    <StatusBadge status={item.status} size="sm" />
                    <PriorityBadge priority={item.priority} />
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">{item.category}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-900 transition-colors truncate">
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate max-w-[200px]">{item.location}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono tabular-nums text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span>
                      SLA: <SlaCountdown complaint={item} />
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div
                  className="flex items-center gap-2 shrink-0 self-end sm:self-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {item.status === 'Submitted' && (
                    <button
                      onClick={() => onOpenEditModal(item)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => onOpenDetailsModal(item)}
                    className="px-3 py-1 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    Details
                    <ChevronRight className="w-3 h-3" />
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
