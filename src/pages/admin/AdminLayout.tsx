import { Link, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { useAdminTheme } from '@/lib/useAdminTheme';
import ChangePasswordDialog from './ChangePasswordDialog';

export default function AdminLayout() {
  const navigate = useNavigate();
  useAdminTheme();

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-40 border-b-2 border-primary bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <nav className="flex items-center gap-4">
            <Link to="/admin" className="headline text-xl tracking-wide">
              ⚽ OpenPlay <span className="text-primary">Admin</span>
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Public site
            </Link>
          </nav>
          <div className="flex items-center gap-1">
            <ChangePasswordDialog />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
