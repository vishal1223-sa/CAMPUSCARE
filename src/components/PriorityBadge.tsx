import React from 'react';
import { ComplaintPriority, SLA_HOURS } from '../types';
import { AlertCircle, Clock, Zap } from 'lucide-react';

interface PriorityBadgeProps {
  priority: ComplaintPriority;
  showSla?: boolean;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, showSla = false }) => {
  const getStyles = () => {
    switch (priority) {
      case 'Emergency':
        return {
          textColor: 'text-rose-700 bg-rose-50 border-rose-200',
          icon: <Zap className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        };
      case 'High':
        return {
          textColor: 'text-amber-800 bg-amber-50 border-amber-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        };
      case 'Medium':
        return {
          textColor: 'text-blue-700 bg-blue-50 border-blue-200',
          icon: <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        };
      case 'Low':
        return {
          textColor: 'text-slate-700 bg-slate-100 border-slate-200',
          icon: <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        };
      default:
        return {
          textColor: 'text-slate-700 bg-slate-100 border-slate-200',
          icon: null
        };
    }
  };

  const { textColor, icon } = getStyles();
  const slaHours = SLA_HOURS[priority];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${textColor} whitespace-nowrap`}>
      {icon}
      <span>{priority}</span>
      {showSla && <span className="text-[11px] opacity-75 font-mono tabular-nums">({slaHours}h SLA)</span>}
    </span>
  );
};
