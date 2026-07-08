import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, SessionStatus } from '@/lib/types';
import { cn, formatDateParts } from '@/lib/utils';
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
  const navigate = useNavigate();
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
        <div>
          <span className="rule mb-2" />
          <h1 className="headline text-3xl">Sessions</h1>
        </div>
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
            {sessions.map((s) => {
              const { weekday, date, time } = formatDateParts(s.date);
              return (
                <TableRow
                  key={s.id}
                  onClick={() => navigate(`/admin/session/${s.id}`)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <p className="font-medium text-primary">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.location}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <p>
                      {weekday}, {date}
                    </p>
                    <p className="text-xs text-muted-foreground">{time}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.format}
                    <p className="text-xs text-muted-foreground">{s.team_count} teams</p>
                  </TableCell>
                  <TableCell>
                    {s.registered_count}/{s.max_players}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                      <span
                        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                        title={s.teams_published ? 'Teams published' : 'Teams not published'}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'h-2 w-2 rounded-full',
                            s.teams_published ? 'bg-green-500' : 'bg-red-500',
                          )}
                        />
                        Teams {s.teams_published ? 'live' : 'not live'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="space-x-1 whitespace-nowrap text-right">
                    {nextActions[s.status].map((a) => (
                      <Button
                        key={a.to}
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatus(s, a.to);
                        }}
                      >
                        {a.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${s.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(s);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <SessionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} session={editing} onSaved={load} />
    </div>
  );
}
