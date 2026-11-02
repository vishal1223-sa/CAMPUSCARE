import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Complaint,
  ComplaintCategory,
  ComplaintStatus,
  ComplaintPriority,
  isComplaintUnassigned,
  isComplaintActive,
  isComplaintResolved
} from '../types';
import {
  subscribeToAllComplaints,
  isComplaintOverdue,
  exportComplaintsToCSV
} from '../services/complaintsService';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { SlaCountdown } from '../components/SlaCountdown';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Download,
  Database,
  PlusCircle,
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Filter,
  Check,
  Building2,
  ArrowUpDown
} from 'lucide-react';

interface AdminDashboardProps {
  onOpenSubmitModal?: () => void;
  onOpenDetailsModal: (complaint: Complaint) => void;
  onOpenAssignModal: (complaint: Complaint) => void;
  onOpenUpdateStatusModal: (complaint: Complaint) => void;
  onNavigateToVerifications?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onOpenSubmitModal,
  onOpenDetailsModal,
  onOpenAssignModal,
  onOpenUpdateStatusModal,
  onNavigateToVerifications
}) => {
  const { user, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'createdAt' | 'slaTargetAt' | 'priority'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllComplaints(
      (all) => {
        setComplaints(all);
        setLoading(false);
      },
      (err) => {
        console.error('Admin complaints listener failed:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);
  const totalTickets = complaints.length;
  const unassignedCount = complaints.filter(isComplaintUnassigned).length;
  const activeCount = complaints.filter(isComplaintActive).length;
  const resolvedCount = complaints.filter(isComplaintResolved).length;
  const overdueCount = complaints.filter(isComplaintOverdue).length;

  // Chart 1: Data by Category
  const categoryDataMap: Record<string, number> = {};
  complaints.forEach((c) => {
    categoryDataMap[c.category] = (categoryDataMap[c.category] || 0) + 1;
  });
  const categoryChartData = Object.entries(categoryDataMap).map(([name, count]) => ({
    name,
    count
  }));

  const CATEGORY_COLORS = ['#1E3A8A', '#2563EB', '#38BDF8', '#0D9488', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'];

  // Chart 2: Data by Status
  const statusDataMap: Record<string, number> = {
    Submitted: 0,
    Assigned: 0,
    'In Progress': 0,
    Resolved: 0,
    Cancelled: 0
  };
  complaints.forEach((c) => {
    if (statusDataMap[c.status] !== undefined) {
      statusDataMap[c.status]++;
    }
  });
  const statusChartData = Object.entries(statusDataMap).map(([status, count]) => ({
    status,
    count
  }));

  // Filtered complaints
  const filtered = complaints.filter((c) => {
    const matchesSearch =
      searchTerm.trim() === '' ||
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.complaintId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.assignedStaffName && c.assignedStaffName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesPriority = priorityFilter === 'All' || c.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  // Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'createdAt') {
      const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortOrder === 'asc' ? diff : -diff;
    } else if (sortField === 'slaTargetAt') {
      const diff = new Date(a.slaTargetAt).getTime() - new Date(b.slaTargetAt).getTime();
      return sortOrder === 'asc' ? diff : -diff;
    }
    return 0;
  });

  return (
    <div className="space-y-6 py-6">
      {/* Top Bar / Actions Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-900" />
            Campus Facilities Operations Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Centralized incident dispatch, technician resource management, and SLA compliance audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onNavigateToVerifications && (
            <button
              onClick={onNavigateToVerifications}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300 flex items-center gap-1.5 shadow-2xs"
              title="Review pending student and staff identity document verification requests"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-900" />
              Review ID Verifications
            </button>
          )}

          <button
            onClick={() => exportComplaintsToCSV(sorted)}
            disabled={sorted.length === 0}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors border border-slate-300 flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            title="Download formatted CSV report for facilities audit and reporting"
          >
            <Download className="w-3.5 h-3.5 text-blue-900" />
            Export CSV ({sorted.length})
          </button>
        </div>
      </div>



      {/* KPI Cards Row (60-30-10 & Tabular Figures) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Total Incidents</span>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalTickets}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Campus-wide</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Unassigned</span>
          <p className="text-2xl font-bold font-mono text-blue-800 tabular-nums">
            {unassignedCount}
          </p>
          <span className="text-[11px] text-blue-600 mt-1 block">Awaiting tech dispatch</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">In Progress</span>
          <p className="text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {activeCount}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Active on site</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Resolved</span>
          <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {resolvedCount}
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 block">Fixed & verified</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-slate-500 block mb-1">SLA Breached</span>
          <p className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
            {overdueCount}
          </p>
          <span className="text-[11px] text-rose-600 mt-1 block">Exceeded resolution target</span>
        </div>
      </div>

      {/* Analytics Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Incident Breakdown by Category */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Grievance Volume by Campus Category
            </h3>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
              {complaints.length} Records
            </span>
          </div>

          {complaints.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No complaint records to graph. Click &quot;Seed Academic Demo Data&quot; above.
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-3 flex-wrap text-[11px] text-slate-600 pt-1">
                {categoryChartData.map((item, idx) => (
                  <span key={item.name} className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                    />
                    {item.name}: <strong className="font-mono">{item.count}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chart 2: Pipeline Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Operational Maintenance Pipeline
            </h3>
            <span className="text-[11px] text-slate-400 font-mono tabular-nums">Real-time Stage Counts</span>
          </div>

          {complaints.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-slate-400">
              No complaint records to graph.
            </div>
          ) : (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ticket ID, title, student, staff, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
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

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
            >
              <option value="All">All Priorities</option>
              <option value="Emergency">Emergency (12h SLA)</option>
              <option value="High">High (24h SLA)</option>
              <option value="Medium">Medium (72h SLA)</option>
              <option value="Low">Low (120h SLA)</option>
            </select>
          </div>
        </div>

        {/* Status Pills and Sort */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-slate-400 text-xs pr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {['All', 'Submitted', 'Assigned', 'In Progress', 'Resolved', 'Cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" /> Sort:
            </span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2 py-1 text-xs border border-slate-200 rounded bg-white text-slate-700"
            >
              <option value="createdAt">Date Filed</option>
              <option value="slaTargetAt">SLA Target</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
              title="Toggle sort direction"
            >
              {sortOrder === 'asc' ? '↑ Oldest' : '↓ Newest'}
            </button>
          </div>
        </div>
      </div>

      {/* Master Complaints Grid / Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Campus Master Complaints Record ({sorted.length})
          </h2>
          <span className="text-[11px] text-slate-500">Live University Records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading records from Firestore...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center space-y-3 text-xs text-slate-500">
            <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-semibold text-slate-800 text-sm">No Complaints Match Query</p>
            <p>Try resetting filters or click &quot;Seed Academic Demo Data&quot; to populate realistic records.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Subject & Category</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Priority / SLA</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sorted.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onOpenDetailsModal(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-900 tabular-nums whitespace-nowrap">
                      {item.complaintId}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="font-semibold text-slate-900 truncate group-hover:text-blue-900 transition-colors">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500">{item.category}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-700 max-w-[180px] truncate">
                      {item.location}
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      <p className="font-medium text-slate-800 truncate max-w-[120px]">{item.studentName}</p>
                      <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{item.studentEmail}</p>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap space-y-1">
                      <PriorityBadge priority={item.priority} />
                      <div>
                        <SlaCountdown complaint={item} />
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {item.assignedStaffName ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-800">{item.assignedStaffName}</span>
                          <button
                            onClick={() => onOpenAssignModal(item)}
                            className="text-[10px] text-blue-700 hover:underline"
                            title="Reassign to another staff"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onOpenAssignModal(item)}
                          className="px-2 py-1 text-[11px] font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" />
                          Assign Staff
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={item.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetailsModal(item)}
                          className="px-2 py-1 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium"
                        >
                          View
                        </button>
                        {item.status !== 'Resolved' && item.status !== 'Cancelled' && (
                          <button
                            onClick={() => onOpenUpdateStatusModal(item)}
                            className="px-2 py-1 text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-xs font-medium"
                          >
                            Status
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
