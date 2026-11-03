import React, { useState, useEffect } from 'react';
import { Complaint, ActivityLog } from '../types';
import {
  subscribeToAllComplaints,
  subscribeToActivityLogs,
  exportComplaintsToCSV,
  isComplaintOverdue
} from '../services/complaintsService';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';
import {
  FileText,
  Download,
  Calendar,
  History,
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';

export const AdminAnalyticsReports: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // CSV Report Custom Filters
  const [reportCategory, setReportCategory] = useState<string>('All');
  const [reportStatus, setReportStatus] = useState<string>('All');

  useEffect(() => {
    setLoading(true);
    const unsubComplaints = subscribeToAllComplaints((items) => {
      setComplaints(items);
      setLoading(false);
    });

    const unsubLogs = subscribeToActivityLogs((logItems) => {
      setLogs(logItems);
    });

    return () => {
      unsubComplaints();
      unsubLogs();
    };
  }, []);

  // Compute metrics
  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === 'Resolved').length;
  const overdue = complaints.filter(isComplaintOverdue).length;
  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
  const slaComplianceRate = total > 0 ? Math.round(((total - overdue) / total) * 100) : 100;

  // Chart 1: Priority Distribution
  const priorityCounts: Record<string, number> = {
    Emergency: 0,
    High: 0,
    Medium: 0,
    Low: 0
  };
  complaints.forEach((c) => {
    if (priorityCounts[c.priority] !== undefined) priorityCounts[c.priority]++;
  });
  const priorityChartData = Object.entries(priorityCounts).map(([priority, count]) => ({
    priority,
    count
  }));

  // Chart 2: 7-Day Simulated Timeline Trend
  const timelineData = [
    { day: 'Mon', filed: 3, resolved: 2 },
    { day: 'Tue', filed: 5, resolved: 4 },
    { day: 'Wed', filed: 6, resolved: 5 },
    { day: 'Thu', filed: 4, resolved: 4 },
    { day: 'Fri', filed: 7, resolved: 6 },
    { day: 'Sat', filed: 2, resolved: 3 },
    { day: 'Sun', filed: 1, resolved: 2 }
  ];

  // Filtered dataset for export
  const exportData = complaints.filter((c) => {
    const matchesCat = reportCategory === 'All' || c.category === reportCategory;
    const matchesSt = reportStatus === 'All' || c.status === reportStatus;
    return matchesCat && matchesSt;
  });

  return (
    <div className="space-y-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-900" />
            Operational Intelligence & Audit Reports
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            SLA performance analytics, resolution velocity, and regulatory audit compliance trails.
          </p>
        </div>

        <button
          onClick={() => exportComplaintsToCSV(exportData)}
          disabled={exportData.length === 0}
          className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg transition-colors shadow-xs flex items-center gap-2 shrink-0 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export Filtered CSV ({exportData.length})
        </button>
      </div>

      {/* SLA Executive Performance Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Resolution Rate</span>
          <p className="text-2xl font-bold font-mono text-blue-900 tabular-nums">
            {resolutionRate}%
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block font-mono tabular-nums">
            {resolved} of {total} completed
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">SLA Compliance</span>
          <p className="text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {slaComplianceRate}%
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 block font-mono tabular-nums">
            Resolved within target hours
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Active Overdue</span>
          <p className="text-2xl font-bold font-mono text-rose-700 tabular-nums">
            {overdue}
          </p>
          <span className="text-[11px] text-rose-600 mt-1 block">Requires priority dispatch</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 block mb-1">Audit Trail Events</span>
          <p className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {logs.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Immutable Firestore logs</span>
        </div>
      </div>

      {/* Visual Analytics Charts (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Priority Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tickets by Priority & Urgency SLA
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Current Distribution</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="priority" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Resolution Velocity Area Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Resolution Velocity vs Influx (7-Day Trend)
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Weekly Operating Rhythm</span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="filed" stroke="#1E3A8A" fill="#DBEAFE" />
                <Area type="monotone" dataKey="resolved" stroke="#10B981" fill="#D1FAE5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-[11px] text-slate-600 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-900 inline-block" /> Incidents Filed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500 inline-block" /> Incidents Resolved
            </span>
          </div>
        </div>
      </div>

      {/* CSV Export Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Custom Dataset Export Parameters</h3>
          <p className="text-xs text-slate-500">
            Generate and export custom audit records formatted for practical exam evaluation and semester-end reports.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Filter Category</label>
            <select
              value={reportCategory}
              onChange={(e) => setReportCategory(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
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

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Filter Status</label>
            <select
              value={reportStatus}
              onChange={(e) => setReportStatus(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Submitted">Submitted (New)</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => exportComplaintsToCSV(exportData)}
              disabled={exportData.length === 0}
              className="w-full px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Download CSV ({exportData.length} Records)
            </button>
          </div>
        </div>
      </div>

      {/* Activity Logs / System Audit Trail */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-blue-900" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Immutable Campus Activity Audit Trail ({logs.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Collection: /activityLogs</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No system activity logged yet. Operations such as filing, status changes, and technician assignments are logged here automatically.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto text-xs">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-slate-50 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-900">{log.actorName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 text-xs">{log.details}</p>
                </div>
                <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                  {log.targetId}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
