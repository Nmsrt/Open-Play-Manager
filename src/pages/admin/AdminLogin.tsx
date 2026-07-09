import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminTheme } from '@/lib/useAdminTheme';

// Single shared staff password: signs in behind the scenes with a fixed
// admin account email so Supabase Auth (and therefore RLS via auth.uid())
// still gates access, without staff needing to know or enter an email.
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string;

export default function AdminLogin() {
  const navigate = useNavigate();
  useAdminTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!ADMIN_EMAIL) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <Card className="w-full">
          <CardHeader>
            <span className="rule mb-1" />
            <CardTitle className="headline text-2xl">Staff login is not configured</CardTitle>
            <CardDescription>
              <code className="rounded bg-muted px-1">VITE_ADMIN_EMAIL</code> is missing from the
              environment. Set it to the shared staff account's email (see README step 3) and
              restart/rebuild the app.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });
    setSubmitting(false);
    if (authError) {
      // Supabase Auth rate-limits repeated failures server-side (configure
      // thresholds in the dashboard under Auth > Rate Limits).
      setError('Wrong password.');
      return;
    }
    navigate('/admin', { replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <span className="rule mb-1" />
          <CardTitle className="headline text-2xl">Staff login</CardTitle>
          <CardDescription>Admin access for OpenPlay session management.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                className="mt-1"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Back to public site
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
