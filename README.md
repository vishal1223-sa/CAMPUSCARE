# CampusCare – Smart Campus Complaint and Maintenance Management System

> **Academic Project Reference:**  
> **Course:** TYBSc Computer Science (Third Year Bachelor of Science in Computer Science)  
> **Semester:** Semester 5 Capstone Project  
> **Subject Area:** Software Engineering, Cloud Database Systems & Attribute-Based Access Control (ABAC)

---

## 1. System Overview

**CampusCare** is a full-stack, enterprise-grade campus operations and incident tracking web application designed to eliminate paper-based complaint registers, prevent grievance delays, and enforce strict resolution Service Level Agreements (SLAs) across collegiate departments, scientific laboratories, lecture halls, and residential student hostels.

The system unifies three distinct user tiers into a collaborative, real-time workflow:
1. **Students**: File geolocated campus facility complaints, monitor live repair stages, track countdown SLAs, and edit or cancel tickets before dispatch.
2. **Maintenance Staff (Technicians)**: Access an operational work queue sorted by urgency, begin on-site diagnostic inspections, log internal technician work notes, and record verified resolution proof remarks.
3. **Administrators (Dean / Estate & Facilities Head)**: High-altitude dashboard with Recharts visual analytics, unallocated ticket dispatch, staff assignment, role-based user management (RBAC), and downloadable CSV audit reports.

---

## 2. Technology Stack

- **Frontend Core:** React 19, TypeScript, Vite
- **Styling & UI Tokens:** Tailwind CSS v4, Lucide Modern Vector Icons
- **Analytics & Data Visualizations:** Recharts (Donut, Bar, and Area charts)
- **Database & Real-time Synchronization:** Cloud Firestore (Document Store with reactive `onSnapshot` subscriptions)
- **Authentication:** Firebase Authentication (Google OAuth 2.0 with Popup)
- **Security & Authorization:** Cloud Firestore Security Rules (ABAC with strict schema invariants)

---

## 3. Database Architecture (Cloud Firestore)

The application utilizes four core collections in Cloud Firestore:

### `users/{userId}`
Stores registered user identities and assigned authorization roles:
- `uid` (string): Firebase Authentication UID
- `email` (string): College email address
- `displayName` (string): Full name
- `photoURL` (string, optional): Profile avatar
- `role` ('student' | 'staff' | 'admin'): Current authorization tier
- `department` (string): Campus department (e.g. Computer Science)
- `specialization` (string, optional): Trade specialization for technicians (Electrical, Plumbing, Network, General)
- `phoneNumber` (string, optional): Contact extension
- `createdAt` / `updatedAt` (ISO date-time)

### `complaints/{complaintId}`
Primary transaction records representing facility grievances:
- `complaintId` (string): Human-readable ticket ID (`CMP-YYYY-XXXX`)
- `title` (string): Subject of the breakdown (5–120 characters)
- `description` (string): Detailed malfunction description (10–1000 characters)
- `category` ('Electrical' | 'Plumbing' | 'Cleanliness' | 'Classroom' | 'Laboratory' | 'Furniture' | 'Internet' | 'Other')
- `priority` ('Low' | 'Medium' | 'High' | 'Emergency')
- `location` (string): Building, Floor, and specific room/bench coordinates
- `studentId` (string): Author UID
- `studentName` (string): Author display name
- `studentEmail` (string): Author email
- `assignedStaffId` (string | null): Allocated technician UID
- `assignedStaffName` (string | null): Allocated technician name
- `status` ('Submitted' | 'Assigned' | 'In Progress' | 'Resolved' | 'Cancelled')
- `slaTargetAt` (ISO date-time): Calculated resolution deadline
- `resolutionRemarks` (string, optional): Verifiable notes from technician upon fix
- `resolvedAt` (ISO date-time, optional): Completion timestamp
- `createdAt` / `updatedAt` (ISO date-time)
- `statusHistory` (Array): Chronological audit trail of all state transitions

### `activityLogs/{logId}`
Immutable audit trail for all campus operations:
- `logId` (string): Unique log event identifier
- `action` ('COMPLAINT_CREATED' | 'STATUS_UPDATED' | 'STAFF_ASSIGNED' | 'COMPLAINT_CANCELLED' | 'ROLE_CHANGED' | 'DATASET_SEEDED')
- `actorId` / `actorName` (string): User executing the operation
- `targetId` (string): Related complaint or user ID
- `details` (string): Descriptive action statement
- `timestamp` (ISO date-time)

### `admins/{userId}`
Authoritative lookup collection for security rules:
- `email` (string): Administrator email
- `role` ('admin')
- `grantedAt` (ISO date-time)

---

## 4. Service Level Agreement (SLA) Matrix

CampusCare enforces deterministic SLA resolution countdowns:

| Priority Level | Guaranteed SLA Target | Typical Campus Incidents |
| :--- | :--- | :--- |
| **Emergency** | **12 Hours** | Live electrical hazards, main water line ruptures, geyser earth leakages |
| **High** | **24 Hours** | Lab workstation power outages, Wi-Fi deadzones during exams, cafeteria sanitation |
| **Medium** | **72 Hours** | Classroom projectors, air conditioner cooling, hostel exhaust fans |
| **Low** | **120 Hours** | Loose furniture screws, minor cosmetic wall faceplates, oscilloscope calibration |

Tickets remaining unresolved after the SLA timestamp automatically receive an **"Overdue"** badge and are prioritized to the top of staff and admin queues.

---

## 5. Security Architecture & Anti-Escalation Safeguards

1. **No Self-Assigned Administrative Privileges:**  
   During public registration, the Firestore security rules strictly mandate `request.resource.data.role == 'student'`. Elevation to Staff or Administrator requires an authenticated admin write.
2. **Bootstrapped Administrator Initialization:**  
   The project evaluator account (`vishalkokkula07@gmail.com`) is automatically recognized by the security rules and promoted to Administrator on first login.
3. **Student Mutation Lockdown:**  
   Students can only modify or cancel their own complaints while the status remains `Submitted`. Once a technician is dispatched (`Assigned` or `In Progress`), ticket fields become immutable to the student to prevent tamper during repair.
4. **Audit Trail Immutability:**  
   The `/activityLogs` collection allows create operations on system events but rejects all update and delete requests.

---

## 6. Examiner Demonstration & Viva Evaluation Guide

For quick examination and testing:
1. **Sign In with Google:** Click "Sign in with Google" in the top navigation bar.
2. **Seed Academic Demo Data:** As an Administrator, click **"Seed Academic Demo Data"** on the Admin Overview or Profile page. This immediately populates:
   - 12 realistic university incidents across Classrooms, Computing Labs, Hostels, and Libraries
   - Realistic ticket statuses (`Submitted`, `Assigned`, `In Progress`, `Resolved`)
   - 4 pre-registered maintenance technicians (Rajesh Kumar - Electrical, Amit Sharma - Plumbing, Priya Nair - IT/LAN, Suresh Verma - Furniture)
3. **Examiner Role Testing Mode:**  
   To test all 3 views without logging into three different Google accounts, click the **"View: Student | Staff | Admin"** segmented control in the top navigation bar.
4. **Export CSV:**  
   Navigate to "Analytics & CSV" or "Overview" and click **"Export CSV"** to generate an evaluation-ready spreadsheet of all campus grievances.
5. **Academic SRS Modal:**  
   Click the **"Academic SRS & Architecture"** button in the header or footer to view the Software Engineering concept reference modal (SRS, FSM diagram, Security Invariants).

---

## 7. License

Licensed for Academic Evaluation under the Apache-2.0 License.
Built for TYBSc Computer Science Semester 5 University Examination.
