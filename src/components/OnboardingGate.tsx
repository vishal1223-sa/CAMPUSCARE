import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  UserRole,
  VerificationRequest,
  AutomatedCheckResult,
  Institution
} from '../types';
import {
  submitVerificationRequest,
  resubmitVerificationRequest,
  subscribeToUserVerification
} from '../services/verificationService';
import {
  compressImageBeforeUpload,
  uploadVerificationDocumentsConcurrent,
  UploadProgressState
} from '../services/storageService';
import { performStudentIdOcr, performStaffIdOcr } from '../services/ocrService';
import { compareIdAndProfilePhoto, FaceComparisonResult } from '../services/faceVerificationService';
import {
  initializeInstitutions,
  validateAdminInvitation
} from '../services/institutionService';
import { POPULAR_COURSES } from '../services/courseService';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  GraduationCap,
  Wrench,
  Shield,
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  LogOut,
  Building,
  ScanLine,
  Info,
  Check,
  XCircle,
  HelpCircle,
  KeyRound
} from 'lucide-react';

interface OnboardingGateProps {
  children: React.ReactNode;
  targetRole?: UserRole;
}

export const OnboardingGate: React.FC<OnboardingGateProps> = ({ children, targetRole }) => {
  const { user, profile, selectedPortal, refreshProfile, signOut, isApproved } = useAuth();

  const [verificationReq, setVerificationReq] = useState<VerificationRequest | null>(null);
  const [loadingReq, setLoadingReq] = useState<boolean>(true);

  // Multi-institution list
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string>('inst-main');

  // The institutional role is locked from the portal selected before authentication
  const effectiveRole: UserRole = targetRole || profile?.role || selectedPortal || 'student';

  // Wizard step (1: Details, 2: Documents & Automated Scan, 3: Review & Submit)
  const [step, setStep] = useState<number>(1);
  const [isResubmitting, setIsResubmitting] = useState<boolean>(false);

  // Student 3 fields
  const [fullName, setFullName] = useState<string>('');
  const [rollNumber, setRollNumber] = useState<string>('');
  const [course, setCourse] = useState<string>(POPULAR_COURSES[0]);
  const [customCourse, setCustomCourse] = useState<string>('');

  // Staff / Admin fields
  const [designation, setDesignation] = useState<string>('');
  const [specialization, setSpecialization] = useState<string>('General Maintenance');
  const [adminInviteCode, setAdminInviteCode] = useState<string>('');
  const [inviteValidating, setInviteValidating] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Document Blobs
  const [idFrontBlob, setIdFrontBlob] = useState<Blob | null>(null);
  const [idFrontPreview, setIdFrontPreview] = useState<string | null>(null);

  const [idBackBlob, setIdBackBlob] = useState<Blob | null>(null);
  const [idBackPreview, setIdBackPreview] = useState<string | null>(null);

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Automated Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [automatedCheck, setAutomatedCheck] = useState<AutomatedCheckResult | null>(null);
  const [faceCheckResult, setFaceCheckResult] = useState<FaceComparisonResult | null>(null);

  // Camera modal state
  const [cameraModalType, setCameraModalType] = useState<'idFront' | 'idBack' | 'photo' | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submissionStage, setSubmissionStage] = useState<string>('');
  const isSubmittingRef = useRef<boolean>(false);
  const [cachedStorageUrls, setCachedStorageUrls] = useState<{
    frontUrl: string;
    frontPath: string;
    backUrl?: string;
    backPath?: string;
    photoUrl?: string;
    photoPath?: string;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null);

  // Load institutions
  useEffect(() => {
    initializeInstitutions().then((list) => {
      setInstitutions(list);
      if (profile?.institutionId) {
        setSelectedInstId(profile.institutionId);
      }
    });
  }, [profile?.institutionId]);

  // Pre-fill user name
  useEffect(() => {
    if (user && !fullName) {
      setFullName(user.displayName || '');
    }
  }, [user]);

  // Real-time verification request listener
  useEffect(() => {
    if (!user) {
      setLoadingReq(false);
      return;
    }

    const unsub = subscribeToUserVerification(
      user.uid,
      (req) => {
        setVerificationReq(req);
        setLoadingReq(false);
        if (req && req.status === 'Approved' && !isApproved) {
          refreshProfile();
        }
      },
      (err) => {
        console.warn('Error reading verification status:', err);
        setLoadingReq(false);
      }
    );

    return () => unsub();
  }, [user, isApproved, refreshProfile]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (idFrontPreview && idFrontPreview.startsWith('blob:')) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview && idBackPreview.startsWith('blob:')) URL.revokeObjectURL(idBackPreview);
      if (photoPreview && photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [idFrontPreview, idBackPreview, photoPreview]);

  // Automated document analysis handler
  const runAutomatedAnalysis = async (cardBlob: Blob, userPhotoBlob: Blob | null) => {
    setIsAnalyzing(true);
    const activeInstitution = institutions.find((i) => i.id === selectedInstId);
    const effectiveCourse = course === 'Other / Custom Course' ? customCourse : course;

    try {
      if (effectiveRole === 'student') {
        const ocrResult = await performStudentIdOcr(
          cardBlob,
          {
            fullName,
            rollNumber,
            course: effectiveCourse
          },
          activeInstitution?.courseAliases
        );
        setAutomatedCheck(ocrResult);
      } else {
        // Staff or Admin: OCR name check + Face comparison
        const staffOcr = await performStaffIdOcr(cardBlob, fullName);

        let faceResult: FaceComparisonResult | null = null;
        if (userPhotoBlob) {
          faceResult = await compareIdAndProfilePhoto(cardBlob, userPhotoBlob);
          setFaceCheckResult(faceResult);
        }

        const nameMatch = staffOcr.nameMatch;
        const faceMatch = faceResult ? faceResult.passed : false;
        const ocrConfidence = staffOcr.ocrConfidence;

        const flaggedReasons: string[] = [];
        if (!nameMatch) flaggedReasons.push(staffOcr.reason || 'Name on ID card does not match entered name.');
        if (faceResult && !faceResult.passed) flaggedReasons.push(faceResult.remarks);
        if (!userPhotoBlob) flaggedReasons.push('Profile photo missing for biometric verification.');

        const passed = nameMatch && faceMatch;

        setAutomatedCheck({
          status: passed ? 'Passed' : 'Manual Review Required',
          ocrConfidence,
          nameMatch,
          faceMatch,
          faceConfidence: faceResult?.confidence || 0,
          disclaimer:
            'Biometric and OCR verification cross-references document credentials. Administrator manual review provides final authorization.',
          checkedAt: new Date().toISOString(),
          flaggedReasons
        });
      }
    } catch (err) {
      console.warn('Automated analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleIdFrontSelected = async (file: File | Blob) => {
    setCachedStorageUrls(null);
    setSubmitError(null);
    const compressed = await compressImageBeforeUpload(file, 1600, 1600, 0.85);
    setIdFrontBlob(compressed.blob);
    const previewUrl = URL.createObjectURL(compressed.blob);
    setIdFrontPreview(previewUrl);

    // Auto-trigger analysis
    await runAutomatedAnalysis(compressed.blob, photoBlob);
  };

  const handlePhotoSelected = async (file: File | Blob) => {
    setCachedStorageUrls(null);
    setSubmitError(null);
    const compressed = await compressImageBeforeUpload(file, 800, 800, 0.85);
    setPhotoBlob(compressed.blob);
    const previewUrl = URL.createObjectURL(compressed.blob);
    setPhotoPreview(previewUrl);

    if (idFrontBlob) {
      await runAutomatedAnalysis(idFrontBlob, compressed.blob);
    }
  };

  const handleCheckInvitation = async () => {
    if (!adminInviteCode.trim() || !user?.email) return;
    setInviteValidating(true);
    setInviteError(null);
    setInviteSuccess(null);

    const result = await validateAdminInvitation(adminInviteCode, user.email);
    setInviteValidating(false);

    if (result.valid) {
      setInviteSuccess(`Invitation verified! Issued by ${result.invitation?.invitedByName}.`);
    } else {
      setInviteError(result.reason || 'Invalid invitation code.');
    }
  };

  const handleSubmitVerification = async () => {
    if (!user) return;
    if (isSubmittingRef.current || submitting) return; // Prevent concurrent double-clicks

    if (!idFrontBlob) {
      setSubmitError('Please upload your official institutional ID Card.');
      return;
    }

    if ((effectiveRole === 'staff' || effectiveRole === 'admin') && !photoBlob) {
      setSubmitError('Please provide a profile photograph (camera capture or upload) for biometric comparison.');
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    setSubmissionStage('Preparing identity documents...');

    try {
      // 1. Upload documents if not already cached from a previous attempt
      let storageUrls = cachedStorageUrls;

      if (!storageUrls) {
        setSubmissionStage('Uploading documents to secure cloud storage...');
        storageUrls = await uploadVerificationDocumentsConcurrent({
          userId: user.uid,
          institutionId: selectedInstId,
          frontBlob: idFrontBlob,
          backBlob: idBackBlob,
          photoBlob: photoBlob,
          onProgress: (progress: UploadProgressState) => {
            setUploadProgress(progress);
            if (progress.statusText) {
              setSubmissionStage(progress.statusText);
            }
          }
        });
        setCachedStorageUrls(storageUrls);
      }

      setSubmissionStage('Registering verification request in campus directory...');

      const activeInst = institutions.find((i) => i.id === selectedInstId) || institutions[0];
      const effectiveCourse = course === 'Other / Custom Course' ? customCourse : course;

      // 2. Submit verification request to Firestore
      if (isResubmitting) {
        const resubmitPayload: Parameters<typeof resubmitVerificationRequest>[1] = {
          institutionId: selectedInstId,
          institutionName: activeInst.name,
          idCardFrontUrl: storageUrls.frontUrl,
          ...(storageUrls.backUrl ? { idCardBackUrl: storageUrls.backUrl } : {}),
          ...(storageUrls.photoUrl ? { profilePhotoUrl: storageUrls.photoUrl } : {}),
          ...(automatedCheck ? { automatedCheck } : {}),
          ...(effectiveRole === 'student' && rollNumber.trim() ? { rollNumber: rollNumber.trim() } : {}),
          ...(effectiveRole === 'student' && effectiveCourse?.trim() ? { course: effectiveCourse.trim() } : {}),
          ...(effectiveRole !== 'student' && designation.trim() ? { designation: designation.trim() } : {}),
          ...(effectiveRole === 'staff' && specialization ? { specialization } : {})
        };
        await resubmitVerificationRequest(user.uid, resubmitPayload);
        setIsResubmitting(false);
      } else {
        const submitPayload: Parameters<typeof submitVerificationRequest>[0] = {
          userId: user.uid,
          userEmail: user.email || '',
          userName: fullName.trim(),
          requestedRole: effectiveRole,
          institutionId: selectedInstId,
          institutionName: activeInst.name,
          idCardFrontUrl: storageUrls.frontUrl,
          ...(storageUrls.backUrl ? { idCardBackUrl: storageUrls.backUrl } : {}),
          ...(storageUrls.photoUrl ? { profilePhotoUrl: storageUrls.photoUrl } : {}),
          ...(automatedCheck ? { automatedCheck } : {}),
          ...(effectiveRole === 'student' && rollNumber.trim() ? { rollNumber: rollNumber.trim() } : {}),
          ...(effectiveRole === 'student' && effectiveCourse?.trim() ? { course: effectiveCourse.trim() } : {}),
          ...(effectiveRole !== 'student' && designation.trim() ? { designation: designation.trim() } : {}),
          ...(effectiveRole === 'staff' && specialization ? { specialization } : {})
        };
        await submitVerificationRequest(submitPayload);
      }

      setSubmissionStage('Identity verification submitted successfully!');
      await refreshProfile();
    } catch (err: unknown) {
      console.error('Submission failed:', err);
      const msg = err instanceof Error ? err.message : 'Failed to submit verification request. Please check your network and try again.';
      setSubmitError(msg);
      setSubmissionStage('');
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // If approved, render authenticated app
  if (isApproved) {
    return <>{children}</>;
  }

  // Loading state
  if (loadingReq) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm font-medium">Verifying campus security credentials...</p>
        </div>
      </div>
    );
  }

  // Pending Admin Approval View
  if (
    !isResubmitting &&
    verificationReq &&
    (verificationReq.status === 'Pending' ||
      verificationReq.status === 'Pending Admin Approval' ||
      verificationReq.status === 'Pending Verification' ||
      profile?.verificationStatus === 'Pending Admin Approval' ||
      profile?.verificationStatus === 'Pending Verification')
  ) {
    const isPassed = verificationReq.automatedCheck?.status === 'Passed';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white border border-slate-200 shadow-sm rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Identity Verification Submitted</h1>
            <p className="text-sm text-slate-600 mt-1">
              Your institutional credentials are in the administrative review queue.
            </p>
          </div>

          {/* Automated Check Outcome Banner */}
          <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/70 mb-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Automated Pre-Check Status
                </span>
                <div className="flex items-center gap-2 mt-1">
                  {isPassed ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Automated Check Passed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
                      <Info className="w-4 h-4 text-amber-600" /> Manual Review Required
                    </span>
                  )}
                  {verificationReq.automatedCheck && (
                    <span className="text-xs text-slate-500">
                      OCR Confidence: {verificationReq.automatedCheck.ocrConfidence}%
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Requested Role
                </span>
                <p className="text-sm font-semibold text-slate-900 uppercase mt-0.5">
                  {verificationReq.requestedRole}
                </p>
              </div>
            </div>

            {/* Field match breakdown */}
            {verificationReq.automatedCheck && (
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-200">
                <div className="text-xs">
                  <span className="text-slate-500 block">Name Match</span>
                  <span className={`font-semibold ${verificationReq.automatedCheck.nameMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {verificationReq.automatedCheck.nameMatch ? 'Verified' : 'Flagged'}
                  </span>
                </div>
                {verificationReq.requestedRole === 'student' ? (
                  <>
                    <div className="text-xs">
                      <span className="text-slate-500 block">Roll Number</span>
                      <span className={`font-semibold ${verificationReq.automatedCheck.rollNumberMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {verificationReq.automatedCheck.rollNumberMatch ? 'Verified' : 'Flagged'}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500 block">Course Match</span>
                      <span className={`font-semibold ${verificationReq.automatedCheck.courseMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {verificationReq.automatedCheck.courseMatch ? 'Verified' : 'Flagged'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs">
                      <span className="text-slate-500 block">Face Biometric</span>
                      <span className={`font-semibold ${verificationReq.automatedCheck.faceMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {verificationReq.automatedCheck.faceMatch ? 'Match Passed' : 'Manual Review'}
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500 block">Face Confidence</span>
                      <span className="font-semibold text-slate-800">
                        {verificationReq.automatedCheck.faceConfidence || 0}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Submission Details */}
          <div className="space-y-3 mb-8 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Applicant Name</span>
              <span className="font-medium text-slate-900">{verificationReq.userName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Institution</span>
              <span className="font-medium text-slate-900">{verificationReq.institutionName}</span>
            </div>
            {verificationReq.rollNumber && (
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Roll Number</span>
                <span className="font-mono font-medium text-slate-900">{verificationReq.rollNumber}</span>
              </div>
            )}
            {verificationReq.course && (
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Course / Program</span>
                <span className="font-medium text-slate-900">{verificationReq.course}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Submitted At</span>
              <span className="font-medium text-slate-900">
                {new Date(verificationReq.submittedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={() => refreshProfile()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Check Approval Status
            </button>
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rejected / Resubmission Required View
  if (
    !isResubmitting &&
    verificationReq &&
    (verificationReq.status === 'Rejected' ||
      verificationReq.status === 'Resubmission Required' ||
      profile?.verificationStatus === 'Rejected' ||
      profile?.verificationStatus === 'Resubmission Required')
  ) {
    const isResubReq =
      verificationReq.status === 'Resubmission Required' ||
      profile?.verificationStatus === 'Resubmission Required';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white border border-slate-200 shadow-sm rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {isResubReq ? 'Document Resubmission Requested' : 'Verification Request Rejected'}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {isResubReq
                ? 'The campus administrator requested corrected details or clearer documents.'
                : 'Your identity documents could not be approved by the campus administrator.'}
            </p>
          </div>

          {/* Mandatory Remarks Box */}
          <div className="border border-red-200 bg-red-50/60 rounded-lg p-5 mb-6">
            <span className="text-xs font-semibold text-red-800 uppercase tracking-wider block mb-1">
              Administrator Remarks & Correction Instructions
            </span>
            <p className="text-sm font-medium text-red-950">
              "{verificationReq.rejectionRemarks || profile?.rejectionReason || 'No specific remarks recorded.'}"
            </p>
            {verificationReq.reviewedBy && (
              <span className="text-xs text-red-700 block mt-2">
                Reviewed by {verificationReq.reviewerName || 'Campus Administrator'} on{' '}
                {verificationReq.reviewedAt ? new Date(verificationReq.reviewedAt).toLocaleDateString() : 'recent review'}
              </span>
            )}
          </div>

          {/* Action button: Allow resubmission */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <button
              onClick={() => {
                setFullName(verificationReq.userName || user?.displayName || '');
                if (verificationReq.rollNumber) setRollNumber(verificationReq.rollNumber);
                if (verificationReq.course) setCourse(verificationReq.course);
                setIsResubmitting(true);
                setStep(1);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Correct Details & Resubmit Documents
            </button>
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Onboarding Form Flow
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 py-12">
      <div className="max-w-2xl w-full bg-white border border-slate-200 shadow-sm rounded-xl p-8">
        {/* Header with Institution & Portal Context */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                {effectiveRole === 'student' && <GraduationCap className="w-5 h-5 text-indigo-600" />}
                {effectiveRole === 'staff' && <Wrench className="w-5 h-5 text-indigo-600" />}
                {effectiveRole === 'admin' && <Shield className="w-5 h-5 text-indigo-600" />}
              </div>
              <div>
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider block">
                  CampusCare Onboarding
                </span>
                <span className="text-sm font-bold text-slate-900 uppercase">
                  {effectiveRole} Identity Verification
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-500 block">Signed in as</span>
              <span className="text-xs font-medium text-slate-800">{user?.email}</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {effectiveRole === 'student' && 'Student Identity Verification'}
            {effectiveRole === 'staff' && 'Staff & Technician Verification'}
            {effectiveRole === 'admin' && 'Administrative Authorization'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {effectiveRole === 'student' &&
              'Provide your 3 institutional credentials and official ID card for automated verification.'}
            {effectiveRole === 'staff' &&
              'Provide your name, institutional card, and profile photo for biometric verification.'}
            {effectiveRole === 'admin' &&
              'Admin accounts require identity verification and Super Administrator authorization.'}
          </p>

          {/* Stepper Header */}
          <div className="flex items-center gap-2 mt-6">
            <div
              className={`flex-1 h-1.5 rounded-full transition-all ${step >= 1 ? 'bg-indigo-600' : 'bg-slate-200'}`}
            />
            <div
              className={`flex-1 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}
            />
            <div
              className={`flex-1 h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}
            />
          </div>
        </div>

        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Verification Submission Issue</p>
              <p>{submitError}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Institutional Credentials */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Institution Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Educational Institution <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3.5 pointer-events-none" />
                <select
                  value={selectedInstId}
                  onChange={(e) => setSelectedInstId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {institutions.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.code})
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Select your college or university campus. Verification is evaluated independently per institution.
              </p>
            </div>

            {/* Field 1: Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name (as printed on ID Card) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* STUDENT FORM: ONLY 3 FIELDS (Full Name, Roll Number, Course) */}
            {effectiveRole === 'student' && (
              <>
                {/* Field 2: Roll Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Institutional Roll Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. TYCS-2024-042"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Your official primary student identifier as stated on your ID card.
                  </p>
                </div>

                {/* Field 3: Course */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Course / Degree Program <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {POPULAR_COURSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  {course === 'Other / Custom Course' && (
                    <input
                      type="text"
                      value={customCourse}
                      onChange={(e) => setCustomCourse(e.target.value)}
                      placeholder="Type your course name (e.g. B.Voc Software Development)"
                      className="mt-2 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Our flexible alias matching automatically links variants like "B.Sc CS" or "BSC Computer Science".
                  </p>
                </div>
              </>
            )}

            {/* STAFF / ADMIN FIELDS */}
            {effectiveRole !== 'student' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Job Designation / Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Electrical Technician / Lab Supervisor"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                {effectiveRole === 'staff' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      Primary Maintenance Specialization
                    </label>
                    <select
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Electrical">Electrical (Power, Lights, Wiring)</option>
                      <option value="Plumbing">Plumbing (Pipes, Taps, Drainage)</option>
                      <option value="Network">Network & IT (Wi-Fi, LAN, Routers)</option>
                      <option value="Carpentry">Carpentry & Furniture</option>
                      <option value="Housekeeping">Housekeeping & Sanitation</option>
                      <option value="General Maintenance">General Facilities Maintenance</option>
                    </select>
                  </div>
                )}

                {effectiveRole === 'admin' && (
                  <div className="border border-indigo-100 bg-indigo-50/60 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-indigo-900 uppercase tracking-wider mb-1">
                      Admin Invitation Code (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={adminInviteCode}
                        onChange={(e) => setAdminInviteCode(e.target.value.toUpperCase())}
                        placeholder="e.g. INV-ABC123-9999"
                        className="flex-1 px-3.5 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleCheckInvitation}
                        disabled={inviteValidating || !adminInviteCode.trim()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        {inviteValidating ? 'Checking...' : 'Validate Code'}
                      </button>
                    </div>
                    {inviteError && <p className="text-xs text-red-600 mt-1.5">{inviteError}</p>}
                    {inviteSuccess && <p className="text-xs text-emerald-700 font-medium mt-1.5">{inviteSuccess}</p>}
                    <p className="text-xs text-indigo-700 mt-2">
                      If you do not have an invite code, your application will be routed to the Super Administrator for review.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!fullName.trim()) {
                    setSubmitError('Please enter your full name as shown on your institutional ID card.');
                    return;
                  }
                  if (effectiveRole === 'student' && !rollNumber.trim()) {
                    setSubmitError('Please enter your institutional roll number.');
                    return;
                  }
                  if (effectiveRole !== 'student' && !designation.trim()) {
                    setSubmitError('Please enter your job designation.');
                    return;
                  }
                  setSubmitError(null);
                  setStep(2);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
              >
                Continue to Documents <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Document Proof & Automated OCR Analysis */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                Upload Institutional ID Card Proof
              </h2>
              <p className="text-xs text-slate-600">
                Upload a clear photo of your official ID Card. Our automated system will scan and cross-reference your credentials instantly.
              </p>
            </div>

            {/* ID Card Front Upload */}
            <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition">
              {idFrontPreview ? (
                <div className="space-y-3">
                  <img
                    src={idFrontPreview}
                    alt="ID Card Front Preview"
                    className="max-h-48 mx-auto rounded-lg border border-slate-200 shadow-xs object-cover"
                  />
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCameraModalType('idFront')}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Retake with Camera
                    </button>
                    <span className="text-slate-300">|</span>
                    <label className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                      Choose Another File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleIdFrontSelected(e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="py-6 space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-600">
                    <ScanLine className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Upload ID Card Front</p>
                    <p className="text-xs text-slate-500">Ensure name, roll number, and institution are legible</p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCameraModalType('idFront')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Capture via Camera
                    </button>
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer">
                      Browse File
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleIdFrontSelected(e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Photo (Mandatory for Staff & Admin) */}
            {effectiveRole !== 'student' && (
              <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition">
                {photoPreview ? (
                  <div className="space-y-3">
                    <img
                      src={photoPreview}
                      alt="Profile Photo Preview"
                      className="w-28 h-28 mx-auto rounded-full border-2 border-indigo-500 object-cover shadow-xs"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCameraModalType('photo')}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> Retake Photo
                      </button>
                      <span className="text-slate-300">|</span>
                      <label className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handlePhotoSelected(e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto text-purple-600">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Capture Profile Photograph</p>
                      <p className="text-xs text-slate-500">Required for automated biometric cross-referencing against ID photo</p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setCameraModalType('photo')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        <Camera className="w-4 h-4" /> Take Selfie Photo
                      </button>
                      <label className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer">
                        Upload Headshot
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handlePhotoSelected(e.target.files[0])}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Automated Scan Results Badge */}
            {isAnalyzing && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center gap-3 text-indigo-900">
                <RefreshCw className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
                <div className="text-xs">
                  <p className="font-semibold">Analyzing document text & biometrics...</p>
                  <p className="text-indigo-700">Cross-referencing Name, Roll Number, and Course aliases</p>
                </div>
              </div>
            )}

            {automatedCheck && !isAnalyzing && (
              <div
                className={`p-4 rounded-lg border text-xs space-y-2.5 ${
                  automatedCheck.status === 'Passed'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {automatedCheck.status === 'Passed' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Info className="w-4 h-4 text-amber-600" />
                    )}
                    Automated Pre-Check: {automatedCheck.status}
                  </span>
                  <span>Confidence: {automatedCheck.ocrConfidence}%</span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
                  <div>
                    <span className="text-slate-500 block">Name Match</span>
                    <span className={automatedCheck.nameMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                      {automatedCheck.nameMatch ? '✓ Verified' : '⚠ Flagged'}
                    </span>
                  </div>

                  {effectiveRole === 'student' ? (
                    <>
                      <div>
                        <span className="text-slate-500 block">Roll Number</span>
                        <span className={automatedCheck.rollNumberMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {automatedCheck.rollNumberMatch ? '✓ Verified' : '⚠ Flagged'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Course Match</span>
                        <span className={automatedCheck.courseMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {automatedCheck.courseMatch ? '✓ Verified' : '⚠ Flagged'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="text-slate-500 block">Face Biometric</span>
                        <span className={automatedCheck.faceMatch ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {automatedCheck.faceMatch ? '✓ Match' : '⚠ Review'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Biometric Score</span>
                        <span className="font-bold text-slate-800">
                          {automatedCheck.faceConfidence || 0}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {automatedCheck.flaggedReasons.length > 0 && (
                  <p className="text-xs text-amber-800 pt-1">
                    Notice: {automatedCheck.flaggedReasons[0]} Don't worry—your document will be reviewed manually by an administrator.
                  </p>
                )}
              </div>
            )}

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Details
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!idFrontBlob) {
                    setSubmitError('Please upload your ID card image first.');
                    return;
                  }
                  if (effectiveRole !== 'student' && !photoBlob) {
                    setSubmitError('Please capture or upload your profile photograph.');
                    return;
                  }
                  setSubmitError(null);
                  setStep(3);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
              >
                Review & Submit <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Final Review & Submission */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                Confirm & Submit Application
              </h2>
              <p className="text-xs text-slate-600">
                Please verify your details before submitting to the campus administration queue.
              </p>
            </div>

            {/* Summary card */}
            <div className="border border-slate-200 rounded-lg p-5 bg-slate-50/60 space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Institution</span>
                <span className="font-semibold text-slate-900">
                  {institutions.find((i) => i.id === selectedInstId)?.name}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500">Applicant Name</span>
                <span className="font-semibold text-slate-900">{fullName}</span>
              </div>
              {effectiveRole === 'student' && (
                <>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Roll Number</span>
                    <span className="font-mono font-semibold text-slate-900">{rollNumber}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Course</span>
                    <span className="font-semibold text-slate-900">
                      {course === 'Other / Custom Course' ? customCourse : course}
                    </span>
                  </div>
                </>
              )}
              {effectiveRole !== 'student' && (
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500">Designation</span>
                  <span className="font-semibold text-slate-900">{designation}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Automated Pre-Check</span>
                <span className="font-semibold text-slate-900">
                  {automatedCheck?.status || 'Manual Review Required'}
                </span>
              </div>
            </div>

            {/* Upload progress & stage indicator */}
            {submitting && (
              <div className="space-y-2.5 p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-lg">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-indigo-900 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    {submissionStage || uploadProgress?.statusText || 'Securing identity documents...'}
                  </span>
                  <span className="font-bold text-indigo-800 font-mono">
                    {uploadProgress?.overallPercent !== undefined ? `${uploadProgress.overallPercent}%` : '...'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(8, uploadProgress?.overallPercent || 15)}%` }}
                  />
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">Submission Interrupted</p>
                  <p className="mt-0.5">{submitError}</p>
                </div>
              </div>
            )}

            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Documents
              </button>
              <button
                type="button"
                onClick={handleSubmitVerification}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-sm transition cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Request...
                  </>
                ) : submitError ? (
                  <>
                    <RefreshCw className="w-4 h-4" /> Retry Submission
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> Submit for Approval
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Camera Capture Modal */}
      {cameraModalType && (
        <CameraCaptureModal
          isOpen={true}
          title={
            cameraModalType === 'photo'
              ? 'Capture Profile Photograph'
              : 'Capture Institutional ID Card'
          }
          onCapture={(blob) => {
            if (cameraModalType === 'idFront') {
              handleIdFrontSelected(blob);
            } else if (cameraModalType === 'photo') {
              handlePhotoSelected(blob);
            }
            setCameraModalType(null);
          }}
          onClose={() => setCameraModalType(null)}
        />
      )}
    </div>
  );
};
