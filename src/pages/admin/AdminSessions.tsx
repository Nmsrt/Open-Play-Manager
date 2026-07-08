import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, SessionStatus } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import SessionFormDialog from '@/components/SessionFormDialog';

const statusVariant: Record<SessionStatus, 'secondary' | 'success' | 'warning' | 'outline'> = {
  draft: 'secondary',
  open: 'success',
  closed: 'warning',
  completed: 'outline',
};

const nextActions: Record<SessionStatus, { label: string; to: SessionStatus }[]> = {
  draft: [{ label: 'Open registration', to: 'open' }],
  open: [{ label: 'Close registration', to: 'closed' }],
  closed: [
    { label: 'Reopen', to: 'open' },
    { label: 'Complete', to: 'completed' },
  ],
  completed: [],
};

export default function AdminSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('sessions').select('*').order('date', { ascending: false });
    setSessions((data as Session[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(session: Session, status: SessionStatus) {
    const { error } = await supabase.from('sessions').update({ status }).eq('id', session.id);
    if (error) alert(`Could not update status: ${error.message}`);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New session
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-10 text-center text-muted-foreground">
          No sessions yet. Create your first one.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Players</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link to={`/admin/session/${s.id}`} className="font-medium text-primary hover:underline">
                    {s.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{s.location}</p>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(s.date)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {s.format}
                  <p className="text-xs text-muted-foreground">
                    {s.players_per_team}/team · {s.team_count} teams
                  </p>
                </TableCell>
                <TableCell>
                  {s.registered_count}/{s.max_players}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  {s.teams_published && (
                    <Badge variant="outline" className="ml-1">
                      teams live
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="space-x-1 whitespace-nowrap text-right">
                  {nextActions[s.status].map((a) => (
                    <Button key={a.to} size="sm" variant="outline" onClick={() => setStatus(s, a.to)}>
                      {a.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${s.title}`}
                    onClick={() => {
                      setEditing(s);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SessionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} session={editing} onSaved={load} />
    </div>
  );
}
