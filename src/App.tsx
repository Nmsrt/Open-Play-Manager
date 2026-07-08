import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '@/pages/public/HomePage';
import SessionPage from '@/pages/public/SessionPage';
import AdminLogin from '@/pages/admin/AdminLogin';
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminSessions from '@/pages/admin/AdminSessions';
import AdminSessionDetail from '@/pages/admin/AdminSessionDetail';
import PrintRoster from '@/pages/admin/PrintRoster';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/session/:id" element={<SessionPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminSessions />} />
          <Route path="session/:id" element={<AdminSessionDetail />} />
        </Route>
        <Route path="/admin/session/:id/print" element={<PrintRoster />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
