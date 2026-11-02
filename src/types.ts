/**
 * CampusCare – Smart Campus Complaint and Maintenance Management System
 * Types & Domain Model
 * Simplified Multi-Institution ID-Card Verification Architecture
 */

export type UserRole = 'student' | 'staff' | 'admin';

export type VerificationStatus =
  | 'Incomplete'
  | 'Pending Verification'
  | 'Pending Admin Approval'
  | 'Approved'
  | 'Rejected'
  | 'Resubmission Required';

export type AutomatedCheckStatus = 'Passed' | 'Manual Review Required' | 'Failed';

export interface Institution {
  id: string; // e.g. 'inst-main'
  name: string; // e.g. 'University Main Campus'
  code: string; // e.g. 'UMC'
  superAdminEmails: string[];
  courseAliases: Record<string, string[]>;
  createdAt: string;
}

export interface AdminInvitation {
  id: string; // unique invite code
  institutionId: string;
  invitedEmail: string;
  invitedBy: string; // Super Admin uid
  invitedByName: string;
  status: 'Pending' | 'Accepted' | 'Revoked' | 'Expired';
  createdAt: string;
  expiresAt: string;
}

export interface AutomatedCheckResult {
  status: AutomatedCheckStatus;
  ocrConfidence: number;
  nameMatch: boolean;
  rollNumberMatch?: boolean;
  courseMatch?: boolean;
  faceMatch?: boolean;
  faceConfidence?: number;
  detectedText?: string;
  detectedCourse?: string;
  disclaimer: string;
  checkedAt: string;
  flaggedReasons: string[];
}

// Deprecated alias for backwards compatibility in existing views
export type OcrInspectionResult = AutomatedCheckResult;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  isSuperAdmin: boolean;
  verificationStatus: VerificationStatus;
  institutionId?: string;
  institutionName?: string;
  // Student fields (Only 3 fields)
  rollNumber?: string;
  course?: string;
  // Staff fields
  designation?: string;
  specialization?: string; // e.g. 'Electrical', 'Plumbing', 'Network', 'HVAC', 'General'
  // Admin fields
  adminGrantedBy?: string;
  // Legacy compatibility fields
  department?: string;
  collegeId?: string;
  collegeName?: string;
  phoneNumber?: string;
  // Status tracking
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationHistoryItem {
  status: VerificationStatus | 'Pending';
  timestamp: string;
  reviewerName?: string;
  remarks?: string;
}

export interface VerificationRequest {
  id: string; // userId
  userId: string;
  userEmail: string;
  userName: string;
  requestedRole: UserRole;
  institutionId: string;
  institutionName: string;
  // Student fields (Only 3 required)
  rollNumber?: string;
  course?: string;
  // Staff / Admin fields
  designation?: string;
  specialization?: string;
  // Document storage URLs
  idCardFrontUrl: string;
  idCardBackUrl?: string;
  profilePhotoUrl?: string;
  // Automated Verification Results
  automatedCheck?: AutomatedCheckResult;
  ocrData?: AutomatedCheckResult; // compatibility
  // Status and Administrative Review
  status: VerificationStatus | 'Pending';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerName?: string;
  rejectionRemarks?: string;
  verificationHistory?: VerificationHistoryItem[];
  // Legacy compatibility
  department?: string;
  collegeId?: string;
  collegeName?: string;
  phoneNumber?: string;
}

export type ComplaintCategory =
  | 'Electrical'
  | 'Plumbing'
  | 'Cleanliness'
  | 'Classroom'
  | 'Laboratory'
  | 'Furniture'
  | 'Internet'
  | 'Other';

export type ComplaintPriority = 'Low' | 'Medium' | 'High' | 'Emergency';

export type ComplaintStatus =
  | 'Submitted'
  | 'Assigned'
  | 'In Progress'
  | 'Resolved'
  | 'Cancelled';

export interface StatusHistoryItem {
  status: ComplaintStatus;
  changedBy: string;
  changedByName: string;
  timestamp: string; // ISO string
  note?: string;
}

export interface Complaint {
  id: string; // Firestore doc id
  complaintId: string; // Human readable (e.g. CMP-2026-0042)
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  location: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  institutionId?: string;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  status: ComplaintStatus;
  slaTargetAt: string; // ISO string calculated from priority
  resolutionRemarks?: string;
  resolvedAt?: string; // ISO string
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  statusHistory: StatusHistoryItem[];
}

export interface ActivityLog {
  id: string;
  logId: string;
  action:
    | 'COMPLAINT_CREATED'
    | 'STATUS_UPDATED'
    | 'STAFF_ASSIGNED'
    | 'COMPLAINT_CANCELLED'
    | 'ROLE_CHANGED'
    | 'DATASET_SEEDED'
    | 'INSTITUTION_UPDATED'
    | 'ADMIN_INVITED';
  actorId: string;
  actorName: string;
  targetId: string;
  details: string;
  timestamp: string; // ISO string
}

// SLA Configuration in hours
export const SLA_HOURS: Record<ComplaintPriority, number> = {
  Emergency: 12, // 12 hours
  High: 24, // 24 hours (1 day)
  Medium: 72, // 72 hours (3 days)
  Low: 120 // 120 hours (5 days)
};

export const CAMPUS_LOCATIONS = [
  'Academic Block A - Floor 1',
  'Academic Block A - Floor 2',
  'Academic Block A - Lecture Hall 101',
  'Academic Block B - Floor 1',
  'Academic Block B - Seminar Hall',
  'Academic Block C - Floor 2',
  'Academic Block D - Faculty Chambers',
  'Computer Science Lab 1',
  'Computer Science Lab 2',
  'Electronics & IoT Lab',
  'Physics & Optics Lab',
  'Central University Library',
  'Boys Hostel Block A',
  'Boys Hostel Block B',
  'Girls Hostel Block A',
  'Girls Hostel Block B',
  'Campus Cafeteria & Food Court',
  'Main Administrative Block',
  'Campus Sports Complex & Gymnasium',
  'Other Campus Area'
] as const;

export const COMPLAINT_CATEGORIES: {
  name: ComplaintCategory;
  description: string;
  defaultSpecialization: string;
}[] = [
  { name: 'Electrical', description: 'Lights, fans, switches, wiring, power outlets, AC units', defaultSpecialization: 'Electrical' },
  { name: 'Plumbing', description: 'Leaking taps, washroom fixtures, water coolers, drainage', defaultSpecialization: 'Plumbing' },
  { name: 'Internet', description: 'Campus Wi-Fi connectivity, LAN ports, router issues', defaultSpecialization: 'Network' },
  { name: 'Classroom', description: 'Projectors, smartboards, podiums, mic, acoustics', defaultSpecialization: 'General' },
  { name: 'Laboratory', description: 'Lab PCs, instruments, safety equipment, power strips', defaultSpecialization: 'General' },
  { name: 'Furniture', description: 'Desks, chairs, broken tables, cupboard locks', defaultSpecialization: 'Carpentry' },
  { name: 'Cleanliness', description: 'Sanitation, garbage bins, dust, floor cleaning', defaultSpecialization: 'Housekeeping' },
  { name: 'Other', description: 'Miscellaneous campus facility maintenance', defaultSpecialization: 'General' }
];

// Unified Status Predicate Functions for Consistent Metrics Across All Dashboards
export const isComplaintUnassigned = (c: Complaint): boolean => {
  return (!c.assignedStaffId || c.assignedStaffId.trim() === '') && c.status !== 'Resolved' && c.status !== 'Cancelled';
};

export const isComplaintActive = (c: Complaint): boolean => {
  return c.status === 'Assigned' || c.status === 'In Progress';
};

export const isComplaintPending = (c: Complaint): boolean => {
  return c.status === 'Submitted' || c.status === 'Assigned';
};

export const isComplaintResolved = (c: Complaint): boolean => {
  return c.status === 'Resolved';
};

export const isComplaintCancelled = (c: Complaint): boolean => {
  return c.status === 'Cancelled';
};
