import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanFirestorePayload } from '../firebase';
import {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  ActivityLog,
  SLA_HOURS,
  UserProfile,
  StatusHistoryItem
} from '../types';

export interface NewComplaintInput {
  title: string;
  description: string;
  category: ComplaintCategory;
  priority: ComplaintPriority;
  location: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
}

// Generate unique human-readable complaint ticket ID
export const generateComplaintId = (): string => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${year}-${randomNum}`;
};

// Calculate SLA target timestamp based on priority level
export const calculateSlaTarget = (priority: ComplaintPriority, fromDate = new Date()): string => {
  const hours = SLA_HOURS[priority] || 72;
  const targetDate = new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
  return targetDate.toISOString();
};

// Check if a complaint has breached SLA
export const isComplaintOverdue = (complaint: Complaint): boolean => {
  if (complaint.status === 'Resolved' || complaint.status === 'Cancelled') {
    return false;
  }
  const slaDate = new Date(complaint.slaTargetAt).getTime();
  return Date.now() > slaDate;
};

// Calculate remaining hours (positive = remaining, negative = overdue hours)
export const getSlaTimeRemaining = (complaint: Complaint): { hours: number; isOverdue: boolean } => {
  const slaDate = new Date(complaint.slaTargetAt).getTime();
  const diffMs = slaDate - Date.now();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  return {
    hours: Math.abs(diffHours),
    isOverdue: diffMs < 0
  };
};

// Log system activity for audit trail
export const logActivity = async (
  action: ActivityLog['action'],
  actorId: string,
  actorName: string,
  targetId: string,
  details: string
) => {
  try {
    const logRef = doc(collection(db, 'activityLogs'));
    const logData: ActivityLog = {
      id: logRef.id,
      logId: `LOG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      action,
      actorId,
      actorName,
      targetId,
      details,
      timestamp: new Date().toISOString()
    };
    await setDoc(logRef, logData);
  } catch (err) {
    console.warn('Non-blocking activity log error:', err);
  }
};

// 1. Submit a new complaint
export const submitComplaint = async (input: NewComplaintInput): Promise<string> => {
  const complaintsCol = collection(db, 'complaints');
  const docRef = doc(complaintsCol);
  const now = new Date().toISOString();
  const humanId = generateComplaintId();
  const slaTarget = calculateSlaTarget(input.priority);

  const initialHistory: StatusHistoryItem = {
    status: 'Submitted',
    changedBy: input.studentId,
    changedByName: input.studentName,
    timestamp: now,
    note: 'Complaint registered by student'
  };

  const complaintData: Complaint = {
    id: docRef.id,
    complaintId: humanId,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    location: input.location.trim(),
    studentId: input.studentId,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    assignedStaffId: null,
    assignedStaffName: null,
    status: 'Submitted',
    slaTargetAt: slaTarget,
    createdAt: now,
    updatedAt: now,
    statusHistory: [initialHistory]
  };

  try {
    await setDoc(docRef, cleanFirestorePayload(complaintData));
    await logActivity(
      'COMPLAINT_CREATED',
      input.studentId,
      input.studentName,
      humanId,
      `Filed complaint: "${input.title}" at ${input.location}`
    );
    return humanId;
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.CREATE, 'complaints');
    throw err;
  }
};

// 2. Assign staff member to complaint
export const assignStaffToComplaint = async (
  complaintId: string,
  staffId: string,
  staffName: string,
  adminId: string,
  adminName: string
) => {
  const docRef = doc(db, 'complaints', complaintId);
  const now = new Date().toISOString();

  try {
    const historyItem: StatusHistoryItem = {
      status: 'Assigned',
      changedBy: adminId,
      changedByName: adminName,
      timestamp: now,
      note: `Assigned to technician ${staffName}`
    };

    // Read existing to append history
    await updateDoc(docRef, {
      assignedStaffId: staffId,
      assignedStaffName: staffName,
      status: 'Assigned',
      updatedAt: now,
      statusHistory: [...(await getExistingHistory(docRef)), historyItem]
    });

    await logActivity(
      'STAFF_ASSIGNED',
      adminId,
      adminName,
      complaintId,
      `Assigned complaint to technician ${staffName}`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    throw err;
  }
};

// 3. Update status (Staff or Admin)
export const updateComplaintStatus = async (
  complaintId: string,
  newStatus: ComplaintStatus,
  actorId: string,
  actorName: string,
  note?: string,
  resolutionRemarks?: string
) => {
  const docRef = doc(db, 'complaints', complaintId);
  const now = new Date().toISOString();

  const historyItem: StatusHistoryItem = {
    status: newStatus,
    changedBy: actorId,
    changedByName: actorName,
    timestamp: now,
    note: note || `Status updated to ${newStatus}`
  };

  const updates: Partial<Complaint> & Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === 'Resolved') {
    updates.resolvedAt = now;
    if (resolutionRemarks) {
      updates.resolutionRemarks = resolutionRemarks.trim();
    }
  }

  try {
    const existingHistory = await getExistingHistory(docRef);
    updates.statusHistory = [...existingHistory, historyItem];

    await updateDoc(docRef, updates);
    await logActivity(
      'STATUS_UPDATED',
      actorId,
      actorName,
      complaintId,
      `Changed status to ${newStatus}${note ? `: ${note}` : ''}`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    throw err;
  }
};

// 4. Cancel complaint (Student or Admin)
export const cancelComplaint = async (
  complaintId: string,
  actorId: string,
  actorName: string,
  reason: string
) => {
  const docRef = doc(db, 'complaints', complaintId);
  const now = new Date().toISOString();

  const historyItem: StatusHistoryItem = {
    status: 'Cancelled',
    changedBy: actorId,
    changedByName: actorName,
    timestamp: now,
    note: `Cancelled by user: ${reason}`
  };

  try {
    const existingHistory = await getExistingHistory(docRef);
    await updateDoc(docRef, {
      status: 'Cancelled',
      updatedAt: now,
      statusHistory: [...existingHistory, historyItem]
    });

    await logActivity(
      'COMPLAINT_CANCELLED',
      actorId,
      actorName,
      complaintId,
      `Cancelled: ${reason}`
    );
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    throw err;
  }
};

// 5. Edit complaint details (Student when status is 'Submitted')
export const editComplaintDetails = async (
  complaintId: string,
  updates: {
    title: string;
    description: string;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    location: string;
  },
  studentId: string,
  studentName: string
) => {
  const docRef = doc(db, 'complaints', complaintId);
  const now = new Date().toISOString();
  const newSla = calculateSlaTarget(updates.priority);

  try {
    const existingHistory = await getExistingHistory(docRef);
    const historyItem: StatusHistoryItem = {
      status: 'Submitted',
      changedBy: studentId,
      changedByName: studentName,
      timestamp: now,
      note: 'Complaint details edited by student'
    };

    await updateDoc(docRef, {
      title: updates.title.trim(),
      description: updates.description.trim(),
      category: updates.category,
      priority: updates.priority,
      location: updates.location.trim(),
      slaTargetAt: newSla,
      updatedAt: now,
      statusHistory: [...existingHistory, historyItem]
    });
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `complaints/${complaintId}`);
    throw err;
  }
};

// Helper to safely get existing history
async function getExistingHistory(docRef: ReturnType<typeof doc>): Promise<StatusHistoryItem[]> {
  try {
    const { getDoc } = await import('firebase/firestore');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return (snap.data().statusHistory as StatusHistoryItem[]) || [];
    }
  } catch {
    // fallback
  }
  return [];
}

// Real-time listener for all complaints (Admin)
export const subscribeToAllComplaints = (
  callback: (complaints: Complaint[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: Complaint[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as Complaint), id: d.id }));
      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'complaints');
      if (onError) onError(err);
    }
  );
};

// Real-time listener for student complaints
export const subscribeToStudentComplaints = (
  studentId: string,
  callback: (complaints: Complaint[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(
    collection(db, 'complaints'),
    where('studentId', '==', studentId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Complaint[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as Complaint), id: d.id }));
      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `complaints[studentId=${studentId}]`);
      if (onError) onError(err);
    }
  );
};

// Real-time listener for staff assigned complaints
export const subscribeToStaffComplaints = (
  staffId: string,
  callback: (complaints: Complaint[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(
    collection(db, 'complaints'),
    where('assignedStaffId', '==', staffId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: Complaint[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as Complaint), id: d.id }));
      callback(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `complaints[assignedStaffId=${staffId}]`);
      if (onError) onError(err);
    }
  );
};

// Real-time listener for activity logs
export const subscribeToActivityLogs = (
  callback: (logs: ActivityLog[]) => void,
  onError?: (err: unknown) => void
) => {
  const q = query(collection(db, 'activityLogs'), orderBy('timestamp', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const items: ActivityLog[] = [];
      snap.forEach((d) => items.push({ ...(d.data() as ActivityLog), id: d.id }));
      callback(items.slice(0, 50)); // top 50 recent
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'activityLogs');
      if (onError) onError(err);
    }
  );
};

// Export complaints to downloadable CSV
export const exportComplaintsToCSV = (complaints: Complaint[]) => {
  const headers = [
    'Complaint ID',
    'Title',
    'Category',
    'Priority',
    'Location',
    'Status',
    'Student Name',
    'Student Email',
    'Assigned Staff',
    'Created At',
    'SLA Target',
    'Resolved At',
    'Resolution Remarks'
  ];

  const escapeCSV = (str: string | undefined | null) => {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  const rows = complaints.map((c) => [
    escapeCSV(c.complaintId),
    escapeCSV(c.title),
    escapeCSV(c.category),
    escapeCSV(c.priority),
    escapeCSV(c.location),
    escapeCSV(c.status),
    escapeCSV(c.studentName),
    escapeCSV(c.studentEmail),
    escapeCSV(c.assignedStaffName || 'Unassigned'),
    escapeCSV(new Date(c.createdAt).toLocaleString()),
    escapeCSV(new Date(c.slaTargetAt).toLocaleString()),
    escapeCSV(c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : 'N/A'),
    escapeCSV(c.resolutionRemarks || 'None')
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `CampusCare_Complaints_Report_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Seed academic sample dataset for presentation / evaluation
export const seedAcademicDataset = async (actorUser: UserProfile): Promise<number> => {
  const sampleStaff: Array<{ uid: string; name: string; email: string; specialization: string; role: 'staff' }> = [
    {
      uid: 'staff_rajesh_elec',
      name: 'Rajesh Kumar',
      email: 'rajesh.kumar@campuscare.edu',
      specialization: 'Electrical',
      role: 'staff'
    },
    {
      uid: 'staff_amit_plumb',
      name: 'Amit Sharma',
      email: 'amit.sharma@campuscare.edu',
      specialization: 'Plumbing',
      role: 'staff'
    },
    {
      uid: 'staff_priya_net',
      name: 'Priya Nair',
      email: 'priya.nair@campuscare.edu',
      specialization: 'Network & Internet',
      role: 'staff'
    },
    {
      uid: 'staff_suresh_gen',
      name: 'Suresh Verma',
      email: 'suresh.verma@campuscare.edu',
      specialization: 'General Facility & Furniture',
      role: 'staff'
    }
  ];

  // 1. Provision staff members in users collection
  for (const s of sampleStaff) {
    const sRef = doc(db, 'users', s.uid);
    await setDoc(sRef, {
      uid: s.uid,
      displayName: s.name,
      email: s.email,
      role: 'staff',
      department: 'Campus Estate & Maintenance Services',
      specialization: s.specialization,
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }

  // 2. Realistic campus complaints
  const now = Date.now();
  const dayMs = 86400000;
  const hourMs = 3600000;

  const sampleComplaints: Array<{
    title: string;
    description: string;
    category: ComplaintCategory;
    priority: ComplaintPriority;
    location: string;
    studentName: string;
    studentEmail: string;
    assignedStaff: (typeof sampleStaff)[number] | null;
    status: ComplaintStatus;
    hoursAgo: number;
    remarks?: string;
  }> = [
    {
      title: 'Overhead Projector Bulb Blown & HDMI Port Loose',
      description: 'The ceiling projector in Seminar Hall 1 displays flickering red artifacts and shuts off after 5 minutes of class presentation. HDMI cable connector is bent.',
      category: 'Classroom',
      priority: 'Emergency',
      location: 'Academic Block B - Seminar Hall',
      studentName: 'Aarav Patel (TYBSc CS)',
      studentEmail: 'aarav.patel@student.edu',
      assignedStaff: sampleStaff[3], // Suresh Verma
      status: 'In Progress',
      hoursAgo: 10
    },
    {
      title: 'Complete Wi-Fi Deadzone in Reading Hall 2',
      description: 'Access Point AP-LIB-04 has an amber blinking LED. Students in the eastern section of the library are unable to authenticate to the campus portal.',
      category: 'Internet',
      priority: 'High',
      location: 'Central University Library',
      studentName: 'Sneha Deshmukh (MSc IT)',
      studentEmail: 'sneha.d@student.edu',
      assignedStaff: sampleStaff[2], // Priya Nair
      status: 'Assigned',
      hoursAgo: 18
    },
    {
      title: 'Major Water Pipeline Leakage Behind Water Cooler',
      description: 'Continuous water flow near washroom entrance creating slippery puddle. Potential hazard for students stepping out of Lecture Hall 101.',
      category: 'Plumbing',
      priority: 'Emergency',
      location: 'Academic Block A - Floor 1',
      studentName: 'Rohan Mehta (BSc CS)',
      studentEmail: 'rohan.m@student.edu',
      assignedStaff: sampleStaff[1], // Amit Sharma
      status: 'Resolved',
      hoursAgo: 36,
      remarks: 'Replaced ruptured 0.5-inch PVC elbow coupling and sealed joint with Teflon tape. Drain cleared and floor sanitized.'
    },
    {
      title: 'Power Outage on Lab Workstations 12 to 18',
      description: 'MCB on Distribution Board 3 tripped during Python practical session. Laboratory systems rebooting abruptly under load.',
      category: 'Laboratory',
      priority: 'High',
      location: 'Computer Science Lab 1',
      studentName: 'Kavita Joshi (TYBSc CS)',
      studentEmail: 'kavita.j@student.edu',
      assignedStaff: sampleStaff[0], // Rajesh Kumar
      status: 'Resolved',
      hoursAgo: 48,
      remarks: 'Diagnosed neutral fault in MCB slot 4. Replaced 16A C-curve breaker and verified grounding impedance under full 18-PC load.'
    },
    {
      title: 'Broken Armrest and Loose Screws on 6 Lecture Chairs',
      description: 'Row 4 seats in Room 204 are detached from the floor rail. Sharp metal edge exposed on chair #14.',
      category: 'Furniture',
      priority: 'Medium',
      location: 'Academic Block A - Floor 2',
      studentName: 'Vikram Singh (SYBSc CS)',
      studentEmail: 'vikram.s@student.edu',
      assignedStaff: sampleStaff[3], // Suresh Verma
      status: 'In Progress',
      hoursAgo: 28
    },
    {
      title: 'Washroom Exhaust Fan Making Loud Grinding Noise',
      description: 'Bearing failure on high-speed exhaust fan in 2nd floor hostel wing. Heavy vibration causing disturbance to residents.',
      category: 'Electrical',
      priority: 'Medium',
      location: 'Boys Hostel Block A',
      studentName: 'Aditya Kulkarni',
      studentEmail: 'aditya.k@student.edu',
      assignedStaff: sampleStaff[0], // Rajesh Kumar
      status: 'Assigned',
      hoursAgo: 22
    },
    {
      title: 'Choked Washbasin Drain and Foul Odor',
      description: 'Common washbasin area near dining counter draining extremely slowly and causing stagnant water accumulation.',
      category: 'Cleanliness',
      priority: 'High',
      location: 'Campus Cafeteria & Food Court',
      studentName: 'Neha Rao',
      studentEmail: 'neha.r@student.edu',
      assignedStaff: sampleStaff[1], // Amit Sharma
      status: 'Submitted',
      hoursAgo: 5
    },
    {
      title: 'Oscilloscope Screen Burn & BNC Probe Disconnected',
      description: 'Workbench Station 3 oscilloscope display flickers intermittently. Second BNC coaxial channel fails signal calibration.',
      category: 'Laboratory',
      priority: 'Low',
      location: 'Electronics & IoT Lab',
      studentName: 'Manish Verma (TYBSc CS)',
      studentEmail: 'manish.v@student.edu',
      assignedStaff: null,
      status: 'Submitted',
      hoursAgo: 4
    },
    {
      title: 'Air Conditioner Thermostat Not Cooling',
      description: 'Split AC indoor unit blower runs but outdoor compressor fails to trigger. Room temperature remains above 31C during peak lectures.',
      category: 'Electrical',
      priority: 'Medium',
      location: 'Academic Block D - Faculty Chambers',
      studentName: 'Prof. S. R. Kulkarni',
      studentEmail: 'srkulkarni@faculty.edu',
      assignedStaff: sampleStaff[0], // Rajesh Kumar
      status: 'Resolved',
      hoursAgo: 72,
      remarks: 'Cleaned dust clogged condenser coils, flushed condensate line, and recharged R-32 refrigerant to 125 PSI operating pressure.'
    },
    {
      title: 'Broken Glass Louver Pane on Fire Exit Window',
      description: 'Cracked glass pane rattling severely during strong winds on the 3rd floor staircase.',
      category: 'Other',
      priority: 'High',
      location: 'Academic Block A - Floor 2',
      studentName: 'Tanvi Shah',
      studentEmail: 'tanvi.s@student.edu',
      assignedStaff: sampleStaff[3], // Suresh Verma
      status: 'Resolved',
      hoursAgo: 96,
      remarks: 'Installed replacement 4mm frosted wired safety glass with weather-resistant silicone bead.'
    },
    {
      title: 'Water Geyser Tripping Earth Leakage Breaker (ELCB)',
      description: 'Switching on the 25L storage water heater in Bathroom 3 immediately trips main corridor power.',
      category: 'Electrical',
      priority: 'Emergency',
      location: 'Girls Hostel Block B',
      studentName: 'Rhea Sen',
      studentEmail: 'rhea.s@student.edu',
      assignedStaff: sampleStaff[0], // Rajesh Kumar
      status: 'In Progress',
      hoursAgo: 14
    },
    {
      title: 'LAN Jack Wall Faceplate Snapped Off',
      description: 'Cat-6 keystone socket dangling by wire beneath Lecturer Podium. Risk of conductor breakage.',
      category: 'Internet',
      priority: 'Low',
      location: 'Academic Block B - Seminar Hall',
      studentName: 'Arjun Das',
      studentEmail: 'arjun.d@student.edu',
      assignedStaff: null,
      status: 'Submitted',
      hoursAgo: 2
    }
  ];

  let seededCount = 0;
  for (let i = 0; i < sampleComplaints.length; i++) {
    const sc = sampleComplaints[i];
    const compRef = doc(collection(db, 'complaints'));
    const createdAt = new Date(now - sc.hoursAgo * hourMs).toISOString();
    const slaTarget = calculateSlaTarget(sc.priority, new Date(now - sc.hoursAgo * hourMs));
    const humanId = `CMP-${new Date().getFullYear()}-${1000 + i + 1}`;

    const history: StatusHistoryItem[] = [
      {
        status: 'Submitted',
        changedBy: 'seed_student',
        changedByName: sc.studentName,
        timestamp: createdAt,
        note: 'Complaint registered by student'
      }
    ];

    if (sc.assignedStaff) {
      history.push({
        status: 'Assigned',
        changedBy: actorUser.uid,
        changedByName: actorUser.displayName || 'Admin Console',
        timestamp: new Date(new Date(createdAt).getTime() + 2 * hourMs).toISOString(),
        note: `Assigned to technician ${sc.assignedStaff.name}`
      });
    }

    if (sc.status === 'In Progress' || sc.status === 'Resolved') {
      history.push({
        status: 'In Progress',
        changedBy: sc.assignedStaff?.uid || 'tech_id',
        changedByName: sc.assignedStaff?.name || 'Technician',
        timestamp: new Date(new Date(createdAt).getTime() + 4 * hourMs).toISOString(),
        note: 'Diagnostic inspection started on site'
      });
    }

    let resolvedAt: string | undefined = undefined;
    if (sc.status === 'Resolved') {
      resolvedAt = new Date(new Date(createdAt).getTime() + 12 * hourMs).toISOString();
      history.push({
        status: 'Resolved',
        changedBy: sc.assignedStaff?.uid || 'tech_id',
        changedByName: sc.assignedStaff?.name || 'Technician',
        timestamp: resolvedAt,
        note: sc.remarks || 'Issue resolved successfully'
      });
    }

    const complaintRecord: Complaint = {
      id: compRef.id,
      complaintId: humanId,
      title: sc.title,
      description: sc.description,
      category: sc.category,
      priority: sc.priority,
      location: sc.location,
      studentId: actorUser.uid, // Tie to current user so it displays under "My Complaints" too!
      studentName: sc.studentName,
      studentEmail: sc.studentEmail,
      assignedStaffId: sc.assignedStaff ? sc.assignedStaff.uid : null,
      assignedStaffName: sc.assignedStaff ? sc.assignedStaff.name : null,
      status: sc.status,
      slaTargetAt: slaTarget,
      resolutionRemarks: sc.remarks,
      resolvedAt,
      createdAt,
      updatedAt: resolvedAt || createdAt,
      statusHistory: history
    };

    await setDoc(compRef, complaintRecord);
    seededCount++;
  }

  await logActivity(
    'DATASET_SEEDED',
    actorUser.uid,
    actorUser.displayName || 'Admin',
    'system_seed',
    `Seeded ${seededCount} realistic academic demonstration complaints and 4 maintenance technicians`
  );

  return seededCount;
};
