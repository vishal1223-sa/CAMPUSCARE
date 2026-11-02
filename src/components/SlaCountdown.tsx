import React from 'react';
import { Complaint } from '../types';
import { getSlaTimeRemaining, isComplaintOverdue } from '../services/complaintsService';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SlaCountdownProps {
  complaint: Complaint;
  compact?: boolean;
}

export const SlaCountdown: React.FC<SlaCountdownProps> = ({ complaint, compact = false }) => {
  if (complaint.status === 'Resolved') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        Resolved
      </span>
    );
  }

  if (complaint.status === 'Cancelled') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        Cancelled
      </span>
    );
  }

  const { hours, isOverdue } = getSlaTimeRemaining(complaint);

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span className="font-mono tabular-nums">{hours === 0 ? '<1h' : `${hours}h`} overdue</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${hours <= 12 ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-slate-600 bg-slate-50 border border-slate-200'} px-2 py-0.5 rounded whitespace-nowrap`}>
      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className="font-mono tabular-nums">{hours}h left</span>
    </span>
  );
};
