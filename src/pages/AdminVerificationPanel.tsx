import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { VerificationRequest, UserRole } from '../types';
import {
  subscribeToAllVerifications,
  approveVerificationRequest,
  rejectVerificationRequest
} from '../services/verificationService';
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  AlertTriangle,
  GraduationCap,
  Wrench,
  Shield,
  FileText,
  User,
  X,
  ExternalLink,
  History,
  Building,
  ScanLine,
  Crown
} from 'lucide-react';

export const AdminVerificationPanel: React.FC = () => {
  const { user, profile, isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  // Inspection Modal
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);

  // Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [isResubmissionMode, setIsResubmissionMode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllVerifications(
      (all) => {
        setRequests(all);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to verifications:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const pendingCount = requests.filter(
    (r) => r.status === 'Pending' || r.status === 'Pending Admin Approval' || r.status === 'Pending Verification'
  ).length;
  const approvedCount = requests.filter((r) => r.status === 'Approved').length;
  const rejectedCount = requests.filter(
    (r) => r.status === 'Rejected' || r.status === 'Resubmission Required'
  ).length;

  const filteredRequests = requests.filter((r) => {
    const isPending =
      r.status === 'Pending' || r.status === 'Pending Admin Approval' || r.status === 'Pending Verification';
    const isRejected = r.status === 'Rejected' || r.status === 'Resubmission Required';

    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Pending' && isPending) ||
      (statusFilter === 'Approved' && r.status === 'Approved') ||
      (statusFilter === 'Rejected' && isRejected);

    const matchesRole = roleFilter === 'All' || r.requestedRole === roleFilter;

    const matchesSearch =
      searchTerm.trim() === '' ||
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.rollNumber && r.rollNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.institutionName && r.institutionName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.course && r.course.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesRole && matchesSearch;
  });

  const handleApprove = async (req: VerificationRequest) => {
    if (!user || !profile) return;

    if (req.requestedRole === 'admin' && !isSuperAdmin) {
      alert('Only a Super Administrator can authorize new Admin accounts.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await approveVerificationRequest(
        req.id,
        user.uid,
        profile.displayName || user.displayName || 'Administrator',
        isSuperAdmin
      );
      setSuccessToast(`Successfully approved ${req.userName} as verified ${req.requestedRole.toUpperCase()}!`);
      setSelectedRequest(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !user || !profile) return;
    if (!rejectionRemarks.trim() || rejectionRemarks.trim().length < 5) {
      setActionError('Please provide clear remarks (at least 5 characters) explaining the decision.');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await rejectVerificationRequest(
        selectedRequest.id,
        user.uid,
        profile.displayName || user.displayName || 'Administrator',
        rejectionRemarks.trim(),
        isResubmissionMode
      );

      setSuccessToast(
        isResubmissionMode
          ? `Requested document resubmission from ${selectedRequest.userName}.`
          : `Rejected verification request for ${selectedRequest.userName}.`
      );
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      setRejectionRemarks('');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Identity Verification Console</h1>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <Crown className="w-3.5 h-3.5 text-amber-700" /> Super Admin
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Review and approve institutional ID credentials, automated OCR transcriptions, and biometric face checks.
          </p>
        </div>

        {/* Status Metrics */}
        <div className="flex items-center gap-2">
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Pending</span>
            <span className="text-base font-bold text-amber-600">{pendingCount}</span>
          </div>
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Approved</span>
            <span className="text-base font-bold text-emerald-600">{approvedCount}</span>
          </div>
          <div className="px-3.5 py-2 bg-white border border-slate-200 rounded-lg shadow-xs text-center">
            <span className="text-xs text-slate-500 block">Rejected</span>
            <span className="text-base font-bold text-red-600">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {successToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {successToast}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, roll, institution..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Status filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none"
            >
              <option value="Pending">Pending Review ({pendingCount})</option>
              <option value="Approved">Approved ({approvedCount})</option>
              <option value="Rejected">Rejected ({rejectedCount})</option>
              <option value="All">All Requests ({requests.length})</option>
            </select>
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none"
            >
              <option value="All">All Roles</option>
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
      </div>

      {/* List Table / Cards */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <Clock className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm font-medium">Loading verification records...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500">
          <ShieldCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-base font-semibold text-slate-800">No verification requests found</p>
          <p className="text-xs text-slate-500 mt-1">There are no records matching your current filter criteria.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs divide-y divide-slate-100">
          {filteredRequests.map((req) => {
            const isPending =
              req.status === 'Pending' ||
              req.status === 'Pending Admin Approval' ||
              req.status === 'Pending Verification';
            const autoPassed = req.automatedCheck?.status === 'Passed';
            const isAdminReq = req.requestedRole === 'admin';

            return (
              <div
                key={req.id}
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
              >
                {/* Left: User Details */}
                <div className="flex items-start gap-4">
                  {/* Photo or role badge */}
                  {req.profilePhotoUrl ? (
                    <img
                      src={req.profilePhotoUrl}
                      alt={req.userName}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-base">
                      {req.userName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-base">{req.userName}</span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${
                          req.requestedRole === 'student'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : req.requestedRole === 'staff'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-purple-50 text-purple-700 border border-purple-200'
                        }`}
                      >
                        {req.requestedRole}
                      </span>

                      {/* Automated Check Tag */}
                      {req.automatedCheck && (
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                            autoPassed
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {autoPassed ? '✓ Auto-Pass' : '⚠ Review'}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                      <span>{req.userEmail}</span>
                      <span>•</span>
                      <span>{req.institutionName || 'University Main Campus'}</span>
                      {req.rollNumber && (
                        <>
                          <span>•</span>
                          <span className="font-mono text-slate-700 font-medium">Roll: {req.rollNumber}</span>
                        </>
                      )}
                      {req.course && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 font-medium">{req.course}</span>
                        </>
                      )}
                      {req.designation && (
                        <>
                          <span>•</span>
                          <span className="text-slate-700 font-medium">{req.designation}</span>
                        </>
                      )}
                    </div>

                    <div className="text-xs text-slate-400 mt-1">
                      Submitted: {new Date(req.submittedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end lg:self-center">
                  <button
                    onClick={() => setSelectedRequest(req)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Documents
                  </button>

                  {isPending && (
                    <>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={actionLoading || (isAdminReq && !isSuperAdmin)}
                        title={isAdminReq && !isSuperAdmin ? 'Only Super Admin can approve Admin accounts' : ''}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
                          isAdminReq && !isSuperAdmin
                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isAdminReq && !isSuperAdmin ? 'Super Admin Only' : 'Approve'}
                      </button>

                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setIsRejectModalOpen(true);
                          setIsResubmissionMode(false);
                        }}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Modal */}
      {selectedRequest && !isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{selectedRequest.userName}</h2>
                  <span className="text-xs uppercase font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedRequest.requestedRole}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{selectedRequest.userEmail} • {selectedRequest.institutionName}</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Automated Verification Results Box */}
            {selectedRequest.automatedCheck && (
              <div className="mb-6 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Automated Verification Report
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      selectedRequest.automatedCheck.status === 'Passed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedRequest.automatedCheck.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Name Match</span>
                    <span className={selectedRequest.automatedCheck.nameMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {selectedRequest.automatedCheck.nameMatch ? '✓ Verified' : '⚠ Flagged'}
                    </span>
                  </div>
                  {selectedRequest.requestedRole === 'student' ? (
                    <>
                      <div>
                        <span className="text-slate-500 block">Roll Match</span>
                        <span className={selectedRequest.automatedCheck.rollNumberMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {selectedRequest.automatedCheck.rollNumberMatch ? '✓ Verified' : '⚠ Flagged'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Course Match</span>
                        <span className={selectedRequest.automatedCheck.courseMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {selectedRequest.automatedCheck.courseMatch ? '✓ Verified' : '⚠ Flagged'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">OCR Confidence</span>
                        <span className="font-bold text-slate-800">
                          {selectedRequest.automatedCheck.ocrConfidence}%
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-500 block">Face Biometric</span>
                        <span className={selectedRequest.automatedCheck.faceMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {selectedRequest.automatedCheck.faceMatch ? '✓ Match Passed' : '⚠ Manual Review'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Face Similarity</span>
                        <span className="font-bold text-slate-800">
                          {selectedRequest.automatedCheck.faceConfidence || 0}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {selectedRequest.automatedCheck.flaggedReasons.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-200 text-xs text-amber-800">
                    <span className="font-semibold">Review Alerts:</span>
                    <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                      {selectedRequest.automatedCheck.flaggedReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Document Images */}
            <div className="space-y-4 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Submitted Identity Documents
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ID Card Front */}
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <span className="text-xs font-semibold text-slate-600 block mb-2">Institutional ID Card</span>
                  <img
                    src={selectedRequest.idCardFrontUrl}
                    alt="ID Card"
                    className="w-full max-h-56 object-contain rounded-lg border border-slate-200 bg-white cursor-pointer"
                    onClick={() => setEnlargedImageUrl(selectedRequest.idCardFrontUrl)}
                  />
                </div>

                {/* Profile Photo (if available) */}
                {selectedRequest.profilePhotoUrl && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <span className="text-xs font-semibold text-slate-600 block mb-2">Profile / Selfie Photograph</span>
                    <img
                      src={selectedRequest.profilePhotoUrl}
                      alt="Profile"
                      className="w-full max-h-56 object-contain rounded-lg border border-slate-200 bg-white cursor-pointer"
                      onClick={() => setEnlargedImageUrl(selectedRequest.profilePhotoUrl || null)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <button
                onClick={() => {
                  setIsRejectModalOpen(true);
                  setIsResubmissionMode(true);
                }}
                className="px-4 py-2 border border-amber-300 text-amber-800 hover:bg-amber-50 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Request Resubmission
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsRejectModalOpen(true);
                    setIsResubmissionMode(false);
                  }}
                  className="px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Reject Application
                </button>
                <button
                  onClick={() => handleApprove(selectedRequest)}
                  disabled={selectedRequest.requestedRole === 'admin' && !isSuperAdmin}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Approve Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Resubmission Modal with Mandatory Remarks */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {isResubmissionMode ? 'Request Document Resubmission' : 'Reject Verification Request'}
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              {isResubmissionMode
                ? 'Specify what corrected details or clearer photos the applicant should re-upload.'
                : 'Please provide mandatory administrative remarks explaining why this application is rejected.'}
            </p>

            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-lg">
                {actionError}
              </div>
            )}

            <textarea
              rows={4}
              value={rejectionRemarks}
              onChange={(e) => setRejectionRemarks(e.target.value)}
              placeholder="e.g. ID card image was blurry or glare obscured the roll number. Please capture a well-lit photo."
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectionRemarks('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={actionLoading || !rejectionRemarks.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                {actionLoading ? 'Processing...' : isResubmissionMode ? 'Send Resubmission Request' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged image preview modal */}
      {enlargedImageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setEnlargedImageUrl(null)}
        >
          <img
            src={enlargedImageUrl}
            alt="Enlarged Document"
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
};
