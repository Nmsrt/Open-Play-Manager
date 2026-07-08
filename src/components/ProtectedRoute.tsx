import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

// UX convenience only: redirects signed-out visitors to the login page.
// The real security boundary is RLS in Supabase — even with this component
// bypassed entirely, the database rejects non-admin reads/writes.
type AuthState = 'loading' | 'admin' | 'anon' | 'not-admin';

export default function ProtectedRoute() {
  const [state, setState] = useState<AuthState>('loading');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) return setState('anon');
      const { data: adminRow } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', data.session.user.id)
        .maybeSingle();
      if (!cancelled) setState(adminRow ? 'admin' : 'not-admin');
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setState('anon');
      else check();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === 'loading') {
    return <main className="p-10 text-center text-muted-foreground">Checking session…</main>;
  }
  if (state === 'anon') return <Navigate to="/admin/login" replace />;
  if (state === 'not-admin') {
    return (
      <main className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold">Not an admin account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This account is signed in but is not listed in <code>admin_users</code>. See the README
          for how to grant admin access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => supabase.auth.signOut()}>
          Sign out
        </Button>
      </main>
    );
  }
  return <Outlet />;
}
