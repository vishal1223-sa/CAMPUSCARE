import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { SubmitComplaintModal } from './components/SubmitComplaintModal';
import { ComplaintDetailsModal } from './components/ComplaintDetailsModal';
import { AssignStaffModal } from './components/AssignStaffModal';
import { UpdateStatusModal } from './components/UpdateStatusModal';
import { EditComplaintModal } from './components/EditComplaintModal';
import { PortalRoleMismatchModal } from './components/PortalRoleMismatchModal';
import { Complaint } from './types';
import { RefreshCw } from 'lucide-react';

// Code-split heavy dashboard pages to optimize bundle size and build memory
const StudentDashboard = React.lazy(() =>
  import('./pages/StudentDashboard').then((m) => ({ default: m.StudentDashboard }))
);
const StaffDashboard = React.lazy(() =>
  import('./pages/StaffDashboard').then((m) => ({ default: m.StaffDashboard }))
);
const AdminDashboard = React.lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
);
const AdminVerificationPanel = React.lazy(() =>
  import('./pages/AdminVerificationPanel').then((m) => ({ default: m.AdminVerificationPanel }))
);
const AdminUserManagement = React.lazy(() =>
  import('./pages/AdminUserManagement').then((m) => ({ default: m.AdminUserManagement }))
);
const AdminAnalyticsReports = React.lazy(() =>
  import('./pages/AdminAnalyticsReports').then((m) => ({ default: m.AdminAnalyticsReports }))
);
const ProfilePage = React.lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);

const PageLoadingFallback = () => (
  <div className="py-24 text-center space-y-2">
    <RefreshCw className="w-6 h-6 animate-spin text-blue-900 mx-auto" />
    <p className="text-xs text-slate-500 font-medium">Loading console view...</p>
  </div>
);

function MainLayout() {
  const { authError, actualRole } = useAuth();
  const navigate = useNavigate();

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedDetailsComplaint, setSelectedDetailsComplaint] = useState<Complaint | null>(null);
  const [selectedAssignComplaint, setSelectedAssignComplaint] = useState<Complaint | null>(null);
  const [selectedStatusComplaint, setSelectedStatusComplaint] = useState<Complaint | null>(null);
  const [selectedEditComplaint, setSelectedEditComplaint] = useState<Complaint | null>(null);

  const handleOpenDetails = (c: Complaint) => {
    setSelectedDetailsComplaint(c);
  };

  const handleOpenAssign = (c: Complaint) => {
    setSelectedAssignComplaint(c);
  };

  const handleOpenUpdateStatus = (c: Complaint) => {
    setSelectedStatusComplaint(c);
  };

  const handleOpenEdit = (c: Complaint) => {
    setSelectedEditComplaint(c);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar with React Router integration */}
      <Navbar onOpenSubmitModal={() => setIsSubmitModalOpen(true)} />

      {/* Global Auth Error Banner if applicable */}
      {authError && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-center text-xs text-rose-800">
          <strong>Authentication Notice:</strong> {authError}
        </div>
      )}

      {/* Main Viewport Content Route Configuration */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        <React.Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            {/* Public Landing Page: ALWAYS rendered at '/' */}
            <Route
              path="/"
              element={<LandingPage onOpenSubmitModal={() => setIsSubmitModalOpen(true)} />}
            />

            {/* Student Protected Routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute portalRole="student">
                  <StudentDashboard
                    onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
                    onOpenDetailsModal={handleOpenDetails}
                    onOpenEditModal={handleOpenEdit}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/complaints"
              element={
                <ProtectedRoute portalRole="student">
                  <StudentDashboard
                    onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
                    onOpenDetailsModal={handleOpenDetails}
                    onOpenEditModal={handleOpenEdit}
                  />
                </ProtectedRoute>
              }
            />

            {/* Staff Protected Routes */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute portalRole="staff">
                  <StaffDashboard
                    onOpenDetailsModal={handleOpenDetails}
                    onOpenUpdateStatusModal={handleOpenUpdateStatus}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/history"
              element={
                <ProtectedRoute portalRole="staff">
                  <StaffDashboard
                    onOpenDetailsModal={handleOpenDetails}
                    onOpenUpdateStatusModal={handleOpenUpdateStatus}
                  />
                </ProtectedRoute>
              }
            />

            {/* Admin Protected Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute portalRole="admin">
                  <AdminDashboard
                    onOpenDetailsModal={handleOpenDetails}
                    onOpenAssignModal={handleOpenAssign}
                    onOpenUpdateStatusModal={handleOpenUpdateStatus}
                    onNavigateToVerifications={() => navigate('/admin/verification')}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/verification"
              element={
                <ProtectedRoute portalRole="admin">
                  <AdminVerificationPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute portalRole="admin">
                  <AdminUserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute portalRole="admin">
                  <AdminAnalyticsReports />
                </ProtectedRoute>
              }
            />

            {/* User Profile */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute portalRole={actualRole}>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Catch-all Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </main>

      {/* Role Mismatch Modal for Portal Protection */}
      <PortalRoleMismatchModal onNavigateToDashboard={() => navigate('/' + actualRole)} />

      {/* Global Modals */}
      <SubmitComplaintModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSuccess={() => {
          navigate('/student');
        }}
      />

      <ComplaintDetailsModal
        complaint={selectedDetailsComplaint}
        isOpen={!!selectedDetailsComplaint}
        onClose={() => setSelectedDetailsComplaint(null)}
        onOpenUpdateStatusModal={handleOpenUpdateStatus}
        onOpenAssignModal={handleOpenAssign}
        onOpenEditModal={handleOpenEdit}
      />

      <AssignStaffModal
        complaint={selectedAssignComplaint}
        isOpen={!!selectedAssignComplaint}
        onClose={() => setSelectedAssignComplaint(null)}
      />

      <UpdateStatusModal
        complaint={selectedStatusComplaint}
        isOpen={!!selectedStatusComplaint}
        onClose={() => setSelectedStatusComplaint(null)}
      />

      <EditComplaintModal
        complaint={selectedEditComplaint}
        isOpen={!!selectedEditComplaint}
        onClose={() => setSelectedEditComplaint(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
