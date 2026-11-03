import React from 'react';
import { X, CheckCircle2, ShieldAlert, Cpu, Database, Award, BookOpen, Layers } from 'lucide-react';

interface AcademicProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcademicProjectModal: React.FC<AcademicProjectModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-blue-200" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Academic Project Documentation (TYBSc CS Sem 5)</h2>
              <p className="text-xs text-blue-200">Software Engineering & Cloud Architecture Viva Reference</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-blue-200 hover:text-white hover:bg-blue-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 leading-relaxed">
          {/* Section 1: Project Abstract */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-blue-900" /> 1. Project Abstract & Objectives
            </h3>
            <p>
              <strong>CampusCare</strong> is an automated, transparent incident tracking and facility management platform built to resolve campus maintenance delays, eliminate lost complaints, and enforce service level agreements (SLAs) across university academic departments, laboratories, and residential hostels.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Course</span>
                <span className="font-semibold text-slate-900">TYBSc Computer Science</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Semester</span>
                <span className="font-semibold text-slate-900">Semester 5 Capstone</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Architecture</span>
                <span className="font-semibold text-slate-900">Full-Stack Cloud SPA</span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="text-slate-500 block">Evaluator</span>
                <span className="font-semibold text-blue-900 font-mono">Admin Bootstrap</span>
              </div>
            </div>
          </div>

          {/* Section 2: Technology Stack */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-blue-900" /> 2. Technical Stack Specification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 border border-slate-200 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-1">Frontend Layer</h4>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  <li>React 19 with TypeScript</li>
                  <li>Tailwind CSS v4 (Design System)</li>
                  <li>Recharts (Visual Analytics)</li>
                  <li>Lucide Modern Vector Icons</li>
                </ul>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-1">Persistence & Auth</h4>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  <li>Cloud Firestore (NoSQL Document Store)</li>
                  <li>Firebase Authentication (Google OAuth 2.0)</li>
                  <li>Real-time Reactive Listeners (<code className="text-blue-900">onSnapshot</code>)</li>
                  <li>Immutable Audit Logging</li>
                </ul>
              </div>
              <div className="p-3 border border-slate-200 rounded-lg">
                <h4 className="font-semibold text-slate-900 mb-1">Security & RBAC</h4>
                <ul className="space-y-1 text-slate-600 list-disc list-inside">
                  <li>Attribute-Based Access Control (ABAC)</li>
                  <li>Firestore Security Rules Engine</li>
                  <li>Role Escalation Shields</li>
                  <li>Multi-Tenant Isolation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 3: State Machine Diagram */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Layers className="w-4 h-4 text-blue-900" /> 3. Complaint Finite State Machine (FSM)
            </h3>
            <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-lg overflow-x-auto whitespace-pre">
{`[ Student Submits Ticket ] ──> (Submitted) 
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
    [ Admin Dispatches ]                             [ Student Cancels ]
              │                                               │
              ▼                                               ▼
         (Assigned)                                      (Cancelled)
              │                                        [Terminal State]
    [ Tech Starts Job ]
              │
              ▼
        (In Progress)
              │
   [ Fix + Remarks Filed ]
              │
              ▼
         (Resolved)
      [Terminal State]`}
            </div>
          </div>

          {/* Section 4: Security & ABAC Invariants */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-blue-900" /> 4. Security Invariants & Rule Guards
            </h3>
            <div className="space-y-2">
              <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded text-slate-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <strong>No Self-Assigned Privileges:</strong> The client cannot pass <code>role: &apos;admin&apos;</code> during public user registration. The rules engine validates role assignment against the authoritative <code>/admins</code> collection.
                </div>
              </div>
              <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded text-slate-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Student Mutation Lockdown:</strong> Students can edit or cancel a complaint only while its status is <code>Submitted</code>. Once assigned or in progress, the record is locked from student edits.
                </div>
              </div>
              <div className="p-2.5 bg-blue-50/50 border border-blue-200 rounded text-slate-700 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Audit Trail Immutability:</strong> The <code>activityLogs</code> collection permits writes on user events but strictly denies update and delete operations to preserve university compliance.
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Database Collections */}
          <div className="space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Database className="w-4 h-4 text-blue-900" /> 5. Firestore Collection Schemas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="border border-slate-200 p-2.5 rounded bg-white">
                <strong className="text-blue-900 block font-mono">/users/{'{uid}'}</strong>
                <span className="text-slate-500">uid, email, displayName, role (&apos;student&apos;|&apos;staff&apos;|&apos;admin&apos;), department, specialization, createdAt</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded bg-white">
                <strong className="text-blue-900 block font-mono">/complaints/{'{id}'}</strong>
                <span className="text-slate-500">complaintId, title, description, category, priority, location, studentId, assignedStaffId, status, slaTargetAt, statusHistory[]</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded bg-white">
                <strong className="text-blue-900 block font-mono">/activityLogs/{'{id}'}</strong>
                <span className="text-slate-500">logId, action, actorId, actorName, targetId, details, timestamp</span>
              </div>
              <div className="border border-slate-200 p-2.5 rounded bg-white">
                <strong className="text-blue-900 block font-mono">/admins/{'{uid}'}</strong>
                <span className="text-slate-500">email, role, grantedAt (Authoritative RBAC token lookup)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            University Project: TYBSc Computer Science
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-900 hover:bg-blue-800 rounded-md transition-colors"
          >
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
};
