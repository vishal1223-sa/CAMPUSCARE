import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  CAMPUS_LOCATIONS,
  COMPLAINT_CATEGORIES,
  SLA_HOURS
} from '../types';
import { editComplaintDetails } from '../services/complaintsService';
import { X, AlertCircle, Save } from 'lucide-react';

interface EditComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  complaint: Complaint | null;
  onSuccess?: () => void;
}

export const EditComplaintModal: React.FC<EditComplaintModalProps> = ({
  isOpen,
  onClose,
  complaint,
  onSuccess
}) => {
  const { user, profile } = useAuth();

  const [title, setTitle] = useState(complaint?.title || '');
  const [description, setDescription] = useState(complaint?.description || '');
  const [category, setCategory] = useState<ComplaintCategory>(complaint?.category || 'Classroom');
  const [priority, setPriority] = useState<ComplaintPriority>(complaint?.priority || 'Medium');
  const [location, setLocation] = useState(complaint?.location || CAMPUS_LOCATIONS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (complaint) {
      setTitle(complaint.title);
      setDescription(complaint.description);
      setCategory(complaint.category);
      setPriority(complaint.priority);
      setLocation(complaint.location);
    }
  }, [complaint]);

  if (!isOpen || !complaint) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (title.trim().length < 5) {
      setError('Title must be at least 5 characters long.');
      return;
    }

    if (description.trim().length < 10) {
      setError('Description must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await editComplaintDetails(
        complaint.id,
        {
          title: title.trim(),
          description: description.trim(),
          category,
          priority,
          location: location.trim()
        },
        user.uid,
        profile?.displayName || user.displayName || 'Student'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update complaint.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Edit Complaint Details</h3>
            <p className="text-xs text-slate-500">Ticket: {complaint.complaintId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white text-xs"
              >
                {COMPLAINT_CATEGORIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white text-xs"
              >
                <option value="Low">Low ({SLA_HOURS.Low}h SLA)</option>
                <option value="Medium">Medium ({SLA_HOURS.Medium}h SLA)</option>
                <option value="High">High ({SLA_HOURS.High}h SLA)</option>
                <option value="Emergency">Emergency ({SLA_HOURS.Emergency}h SLA)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Location</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-xs"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              required
              rows={3}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 font-medium text-slate-600 hover:text-slate-800 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
