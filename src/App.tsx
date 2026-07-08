import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from '@/pages/public/HomePage';
import SessionPage from '@/pages/public/SessionPage';
import { isSupabaseConfigured } from '@/lib/supabase';

function SetupScreen() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-2xl font-bold">Supabase is not configured</h1>
      <p className="mt-3 text-muted-foreground">
        The app needs your Supabase project URL and anon key before it can load sessions.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
        <li>
          Copy <code className="rounded bg-muted px-1">.env.example</code> to{' '}
          <code className="rounded bg-muted px-1">.env</code> in the project root.
        </li>
        <li>
          Fill in <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code> from your Supabase
          dashboard (Settings → API).
        </li>
        <li>Restart the dev server.</li>
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">
        Full setup (migration, admin account, disabling sign-ups) is in the README.
      </p>
    </main>
  );
}

// Admin surface is lazy-loaded so public visitors (mostly on phones at the
// pitch) don't download dnd-kit and the admin UI.
const AdminLogin = lazy(() => import('@/pages/admin/AdminLogin'));
const AdminLayout = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminSessions = lazy(() => import('@/pages/admin/AdminSessions'));
const AdminSessionDetail = lazy(() => import('@/pages/admin/AdminSessionDetail'));
const PrintRoster = lazy(() => import('@/pages/admin/PrintRoster'));
const ProtectedRoute = lazy(() => import('@/components/ProtectedRoute'));

export default function App() {
  if (!isSupabaseConfigured) return <SetupScreen />;
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
