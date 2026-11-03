import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  CAMPUS_LOCATIONS,
  COMPLAINT_CATEGORIES,
  ComplaintCategory,
  ComplaintPriority,
  SLA_HOURS
} from '../types';
import { submitComplaint } from '../services/complaintsService';
import { X, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface SubmitComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (ticketId: string) => void;
}

export const SubmitComplaintModal: React.FC<SubmitComplaintModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, profile } = useAuth();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('Classroom');
  const [priority, setPriority] = useState<ComplaintPriority>('Medium');
  const [locationPreset, setLocationPreset] = useState<string>(CAMPUS_LOCATIONS[0]);
  const [specificRoom, setSpecificRoom] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to submit a complaint.');
      return;
    }

    if (title.trim().length < 5) {
      setError('Title must be at least 5 characters long.');
      return;
    }

    if (description.trim().length < 10) {
      setError('Please provide a detailed description (at least 10 characters).');
      return;
    }

    const finalLocation = specificRoom.trim()
      ? `${locationPreset} (${specificRoom.trim()})`
      : locationPreset;

    setError(null);
    setLoading(true);

    try {
      const ticketId = await submitComplaint({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        location: finalLocation,
        studentId: user.uid,
        studentName: profile?.displayName || user.displayName || 'Campus Student',
        studentEmail: user.email || ''
      });

      setSuccessTicketId(ticketId);
      if (onSuccess) onSuccess(ticketId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit complaint. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setTitle('');
    setDescription('');
    setSpecificRoom('');
    setError(null);
    setSuccessTicketId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-xl max-w-xl w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">File Campus Incident / Grievance</h2>
            <p className="text-xs text-slate-500">Submit a maintenance ticket for college campus facilities</p>
          </div>
          <button
            onClick={handleResetAndClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {successTicketId ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Complaint Registered Successfully!</h3>
              <p className="text-sm text-slate-600 mt-1">
                Your ticket has been logged with campus maintenance authorities.
              </p>
              <div className="mt-3 inline-block bg-slate-100 border border-slate-200 px-4 py-2 rounded-lg font-mono text-sm font-semibold text-blue-900 tabular-nums">
                Ticket ID: {successTicketId}
              </div>
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You will receive live tracking updates on your student dashboard. Maintenance staff will be dispatched according to the SLA priority target.
            </p>
            <div className="pt-2">
              <button
                onClick={handleResetAndClose}
                className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-medium text-xs rounded-lg transition-colors"
              >
                Done & View My Complaints
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Complaint Subject / Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={120}
                placeholder="e.g. Broken projector in Seminar Hall 1 or Water tap leak"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>

            {/* Category and Priority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white"
                >
                  {COMPLAINT_CATEGORIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.defaultSpecialization})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Urgency / Priority <span className="text-rose-500">*</span>
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as ComplaintPriority)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white"
                >
                  <option value="Low">Low (120h SLA - Routine)</option>
                  <option value="Medium">Medium (72h SLA - Standard)</option>
                  <option value="High">High (24h SLA - Urgent)</option>
                  <option value="Emergency">Emergency (12h SLA - Hazard/Critical)</option>
                </select>
              </div>
            </div>

            {/* SLA Preview Banner */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center justify-between text-xs text-blue-900">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-blue-700" />
                Guaranteed Resolution SLA:
              </span>
              <span className="font-semibold font-mono tabular-nums">
                Within {SLA_HOURS[priority]} Hours
              </span>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Campus Location <span className="text-rose-500">*</span>
              </label>
              <select
                value={locationPreset}
                onChange={(e) => setLocationPreset(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent bg-white"
              >
                {CAMPUS_LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Specific room, bench, lab station, or floor details (Optional)"
                value={specificRoom}
                onChange={(e) => setSpecificRoom(e.target.value)}
                maxLength={60}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent text-slate-700"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Detailed Description <span className="text-rose-500">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  {description.length}/1000
                </span>
              </div>
              <textarea
                required
                rows={4}
                maxLength={1000}
                placeholder="Please describe the malfunction, specific symptoms, when it began, and any safety or academic disruption..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetAndClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? 'Submitting to Firestore...' : 'Register Complaint'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
