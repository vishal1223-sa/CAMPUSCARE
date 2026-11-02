import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Complaint } from '../types';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { SlaCountdown } from './SlaCountdown';
import { cancelComplaint } from '../services/complaintsService';
import {
  X,
  MapPin,
  Calendar,
  User,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Ban,
  History
} from 'lucide-react';

interface ComplaintDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onOpenAssignModal?: (complaint: Complaint) => void;
  onOpenUpdateStatusModal?: (complaint: Complaint) => void;
  onOpenEditModal?: (complaint: Complaint) => void;
  onRefresh?: () => void;
}

export const ComplaintDetailsModal: React.FC<ComplaintDetailsModalProps> = ({
  isOpen,
  onClose,
  complaint,
  onOpenAssignModal,
  onOpenUpdateStatusModal,
  onOpenEditModal,
  onRefresh
}) => {
  const { user, profile, role } = useAuth();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !complaint) return null;

  const isOwner = user?.uid === complaint.studentId;
  const isAssignedTech = user?.uid === complaint.assignedStaffId;
  const canEditOrCancel = isOwner && complaint.status === 'Submitted';
  const canUpdateStatus = (role === 'staff' && isAssignedTech) || role === 'admin';
  const canAssignStaff = role === 'admin';

  const handleCancelComplaint = async () => {
    if (!user) return;
    setCancelLoading(true);
    setActionError(null);
    try {
      await cancelComplaint(
        complaint.id,
        user.uid,
        profile?.displayName || user.displayName || 'Student',
        cancelReason.trim() || 'Cancelled by student'
      );
      setShowCancelPrompt(false);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel complaint');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-100/60 px-2.5 py-1 rounded border border-blue-200 tabular-nums">
              {complaint.complaintId}
            </span>
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {actionError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Title and Category */}
          <div>
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <span>{complaint.category} Maintenance</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {complaint.location}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900">{complaint.title}</h2>
          </div>

          {/* Detailed description */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
              Issue Description
            </h3>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-xs">
              {complaint.description}
            </p>
          </div>

          {/* Key Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg border border-slate-200 bg-white">
            <div className="space-y-1">
              <p className="text-slate-500 flex items-center gap-1.5 text-[11px]">
                <User className="w-3.5 h-3.5 text-slate-400" /> Filed By
              </p>
              <p className="font-semibold text-slate-900">{complaint.studentName}</p>
              <p className="text-slate-500 text-[11px] truncate">{complaint.studentEmail}</p>
            </div>

            <div className="space-y-1">
              <p className="text-slate-500 flex items-center gap-1.5 text-[11px]">
                <Wrench className="w-3.5 h-3.5 text-slate-400" /> Assigned Staff
              </p>
              <p className="font-semibold text-slate-900">
                {complaint.assignedStaffName || 'Unassigned (Awaiting Dispatch)'}
              </p>
              <p className="text-slate-500 text-[11px]">
                SLA Target: <SlaCountdown complaint={complaint} />
              </p>
            </div>
          </div>

          {/* Resolution Remarks Box if Resolved */}
          {complaint.status === 'Resolved' && (
            <div className="p-4 rounded-lg bg-emerald-50/80 border border-emerald-200 text-emerald-950 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Resolution Remarks
              </div>
              <p className="text-emerald-900 leading-relaxed text-xs">
                {complaint.resolutionRemarks || 'Maintenance verified and operational.'}
              </p>
              {complaint.resolvedAt && (
                <p className="text-[11px] text-emerald-700 pt-1">
                  Completed on: {new Date(complaint.resolvedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Chronological Status History Stepper */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <History className="w-4 h-4 text-blue-900" />
              Incident Audit Trail & History
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {complaint.statusHistory && complaint.statusHistory.length > 0 ? (
                complaint.statusHistory.map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-900 ring-4 ring-white" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{item.status}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 font-medium">{item.changedByName}</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                      </div>
                      {item.note && (
                        <p className="text-slate-600 text-xs mt-0.5 bg-slate-50 border border-slate-100 p-2 rounded">
                          {item.note}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 text-xs">No status transitions logged yet.</div>
              )}
            </div>
          </div>

          {/* Cancellation Prompt */}
          {showCancelPrompt && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-3">
              <p className="font-bold text-rose-900 text-xs">Cancel this Complaint</p>
              <p className="text-rose-800 text-xs">
                Are you sure? This will terminate maintenance dispatch for this ticket.
              </p>
              <input
                type="text"
                placeholder="Reason for cancellation (e.g. Issue resolved on its own)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-rose-300 rounded bg-white text-slate-900"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelComplaint}
                  disabled={cancelLoading}
                  className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs rounded transition-colors"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
                <button
                  onClick={() => setShowCancelPrompt(false)}
                  className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-medium text-xs rounded border border-slate-200 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1 font-mono tabular-nums">
            <Calendar className="w-3.5 h-3.5" />
            Created {new Date(complaint.createdAt).toLocaleDateString()}
          </div>

          <div className="flex items-center gap-2">
            {/* Student Actions */}
            {canEditOrCancel && !showCancelPrompt && (
              <>
                {onOpenEditModal && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenEditModal(complaint);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                    Edit Details
                  </button>
                )}
                <button
                  onClick={() => setShowCancelPrompt(true)}
                  className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors flex items-center gap-1"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Cancel Ticket
                </button>
              </>
            )}

            {/* Admin Assign Button */}
            {canAssignStaff && onOpenAssignModal && complaint.status !== 'Resolved' && complaint.status !== 'Cancelled' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAssignModal(complaint);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              >
                <Wrench className="w-3.5 h-3.5 text-blue-900" />
                {complaint.assignedStaffId ? 'Reassign Staff' : 'Assign Technician'}
              </button>
            )}

            {/* Staff / Admin Update Status Button */}
            {canUpdateStatus && onOpenUpdateStatusModal && complaint.status !== 'Resolved' && complaint.status !== 'Cancelled' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenUpdateStatusModal(complaint);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Update Job Status
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
