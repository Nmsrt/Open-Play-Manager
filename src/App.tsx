import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '@/pages/public/HomePage';
import SessionPage from '@/pages/public/SessionPage';

// Admin surface is lazy-loaded so public visitors (mostly on phones at the
// pitch) don't download dnd-kit and the admin UI.
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminSessions = lazy(() => import('@/pages/admin/AdminSessions'));
const AdminSessionDetail = lazy(() => import('@/pages/admin/AdminSessionDetail'));
const PrintRoster = lazy(() => import('@/pages/admin/PrintRoster'));
const ProtectedRoute = lazy(() => import('@/components/ProtectedRoute'));

export default function App() {
  return (
    <Suspense fallback={<main className="p-10 text-center text-muted-foreground">Loading…</main>}>
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
    </Suspense>
  );
}
