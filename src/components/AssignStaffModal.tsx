import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Complaint, UserProfile } from '../types';
import { assignStaffToComplaint } from '../services/complaintsService';
import { subscribeToAllUsers } from '../services/usersService';
import { X, UserCheck, AlertCircle } from 'lucide-react';

interface AssignStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onSuccess?: () => void;
}

export const AssignStaffModal: React.FC<AssignStaffModalProps> = ({
  isOpen,
  onClose,
  complaint,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribeToAllUsers((all) => {
      // Strictly technicians who are verified Staff members (Admins and unverified users strictly excluded)
      const staffList = all.filter(
        (u) => u.role === 'staff' && u.verificationStatus === 'Approved'
      );
      setUsers(staffList);
      if (staffList.length > 0 && !selectedStaffId) {
        setSelectedStaffId(staffList[0].uid);
      }
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen || !complaint) return null;

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setError('Please select a technician.');
      return;
    }
    const staffObj = users.find((u) => u.uid === selectedStaffId);
    if (!staffObj) {
      setError('Selected technician not found.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await assignStaffToComplaint(
        complaint.id,
        staffObj.uid,
        staffObj.displayName || staffObj.email,
        user?.uid || 'admin',
        profile?.displayName || 'Campus Administrator'
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to assign staff.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Dispatch Maintenance Technician</h3>
            <p className="text-xs text-slate-500">Ticket: {complaint.complaintId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
            <p className="font-semibold text-slate-900">{complaint.title}</p>
            <p className="text-slate-500">
              Category: <span className="text-slate-700 font-medium">{complaint.category}</span> · Location:{' '}
              <span className="text-slate-700 font-medium">{complaint.location}</span>
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Select Qualified Technician <span className="text-rose-500">*</span>
            </label>

            {users.length === 0 ? (
              <div className="text-xs text-slate-500 p-4 border border-dashed border-slate-200 rounded-lg text-center">
                No verified maintenance staff profiles found. Staff members can complete College ID verification or be approved in the ID Verifications console.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {users.map((staff) => (
                  <label
                    key={staff.uid}
                    className={`flex items-center justify-between p-2.5 border rounded-lg cursor-pointer transition-colors text-xs ${
                      selectedStaffId === staff.uid
                        ? 'border-blue-900 bg-blue-50/60 ring-1 ring-blue-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="staff"
                        value={staff.uid}
                        checked={selectedStaffId === staff.uid}
                        onChange={() => setSelectedStaffId(staff.uid)}
                        className="text-blue-900 focus:ring-blue-900"
                      />
                      <div>
                        <p className="font-semibold text-slate-800">{staff.displayName || staff.email}</p>
                        <p className="text-[11px] text-slate-500">
                          {staff.specialization || staff.department || 'General Maintenance'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {staff.role}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

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
              disabled={loading || users.length === 0}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" />
              {loading ? 'Assigning...' : 'Confirm Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
