import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Complaint, ComplaintStatus } from '../types';
import { updateComplaintStatus } from '../services/complaintsService';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onSuccess?: () => void;
}

export const UpdateStatusModal: React.FC<UpdateStatusModalProps> = ({
  isOpen,
  onClose,
  complaint,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('In Progress');
  const [workNote, setWorkNote] = useState('');
  const [resolutionRemarks, setResolutionRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !complaint) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newStatus === 'Resolved' && resolutionRemarks.trim().length < 5) {
      setError('Please provide resolution remarks explaining how the issue was fixed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateComplaintStatus(
        complaint.id,
        newStatus,
        user.uid,
        profile?.displayName || user.displayName || 'Technician',
        workNote.trim() || undefined,
        newStatus === 'Resolved' ? resolutionRemarks.trim() : undefined
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Update Job Status</h3>
            <p className="text-xs text-slate-500">Ticket: {complaint.complaintId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-slate-900">{complaint.title}</p>
            <p className="text-slate-500">
              Current Status:{' '}
              <span className="font-medium text-blue-900">{complaint.status}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select New Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white"
            >
              <option value="In Progress">In Progress (Diagnostics / Repair Underway)</option>
              <option value="Resolved">Resolved (Work Completed & Tested)</option>
              <option value="Assigned">Assigned (Waiting for parts/spares)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Technician Diagnostic / Work Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Replaced faulty capacitor, tested power draw"
              value={workNote}
              onChange={(e) => setWorkNote(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
            />
          </div>

          {newStatus === 'Resolved' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Resolution Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Explain the permanent fix applied and verification performed for the student..."
                value={resolutionRemarks}
                onChange={(e) => setResolutionRemarks(e.target.value)}
                maxLength={500}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {loading ? 'Saving...' : 'Update Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
