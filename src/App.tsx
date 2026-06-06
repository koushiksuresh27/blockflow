import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AuthCallback from './pages/AuthCallback';
import PendingPage from './pages/PendingPage';
import SelectRole from './pages/SelectRole';
import SubmitComplaint from './pages/SubmitComplaint';
import AdminDashboard from './pages/AdminDashboard';
import ComplaintsPage from './pages/admin/ComplaintsPage';
import TechniciansPage from './pages/admin/TechniciansPage';
import AnalyticsPage from './pages/admin/AnalyticsPage';
import SettingsPage from './pages/admin/SettingsPage';
import ResidentsPage from './pages/admin/ResidentsPage';
import HousekeepingPage from './pages/admin/HousekeepingPage';
import EquipmentPage from './pages/admin/EquipmentPage';
import MaintenancePage from './pages/admin/MaintenancePage';
import ResidentProtectedRoute from './components/ResidentProtectedRoute';
import ResidentLayout from './components/ResidentLayout';
import ResidentHome from './pages/resident/ResidentHome';
import ResidentSubmitComplaint from './pages/resident/SubmitComplaint';
import ComplaintDetail from './pages/resident/ComplaintDetail';
import CommunityBoard from './pages/resident/CommunityBoard';
import Notifications from './pages/resident/Notifications';
import TechnicianProtectedRoute from './pages/technician/TechnicianProtectedRoute';
import TechnicianLayout from './pages/technician/TechnicianLayout';
import HomeTab from './pages/technician/HomeTab';
import JobsTab from './pages/technician/JobsTab';
import ProfileTab from './pages/technician/ProfileTab';


export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/select-role" element={<SelectRole />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/complaints/new" element={<SubmitComplaint />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/residents" element={<ResidentsPage />} />
        <Route path="/admin/complaints" element={<ComplaintsPage />} />
        <Route path="/admin/technicians" element={<TechniciansPage />} />
        <Route path="/admin/housekeeping" element={<HousekeepingPage />} />
        <Route path="/admin/equipment" element={<EquipmentPage />} />
        <Route path="/admin/maintenance" element={<MaintenancePage />} />
        <Route path="/admin/analytics" element={<AnalyticsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />
        {/* Technician Dashboard */}
        <Route path="/technician" element={<TechnicianProtectedRoute />}>
          <Route element={<TechnicianLayout />}>
            <Route index element={<HomeTab />} />
            <Route path="jobs" element={<JobsTab />} />
            <Route path="profile" element={<ProfileTab />} />
          </Route>
        </Route>

        {/* Resident Dashboard */}
        <Route path="/resident" element={<ResidentProtectedRoute />}>
          <Route element={<ResidentLayout />}>
            <Route index element={<ResidentHome />} />
            <Route path="complaints/new" element={<ResidentSubmitComplaint />} />
            <Route path="complaints/:id" element={<ComplaintDetail />} />
            <Route path="community" element={<CommunityBoard />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

