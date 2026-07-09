import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, FlaskConical } from 'lucide-react';
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

// Dev-only fixture: famous players, grouped by club so paired names get a
// squad-request (teammate_requests) icon in PlayersTab. Not shown in prod.
const DEMO_PLAYERS: {
  name: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD' | 'ANY';
  club: string;
  requests?: string;
}[] = [
  { name: 'Lionel Messi', position: 'FWD', club: 'Inter Miami', requests: 'Luis Suárez' },
  { name: 'Luis Suárez', position: 'FWD', club: 'Inter Miami', requests: 'Lionel Messi' },
  { name: 'Kevin De Bruyne', position: 'MID', club: 'Man City', requests: 'Erling Haaland' },
  { name: 'Erling Haaland', position: 'FWD', club: 'Man City', requests: 'Kevin De Bruyne' },
  { name: 'Kylian Mbappé', position: 'FWD', club: 'Real Madrid', requests: 'Vinícius Júnior, Luka Modrić' },
  { name: 'Vinícius Júnior', position: 'FWD', club: 'Real Madrid', requests: 'Kylian Mbappé, Luka Modrić' },
  { name: 'Mohamed Salah', position: 'FWD', club: 'Liverpool', requests: 'Virgil van Dijk' },
  { name: 'Virgil van Dijk', position: 'DEF', club: 'Liverpool', requests: 'Mohamed Salah' },
  { name: 'Cristiano Ronaldo', position: 'FWD', club: 'Al Nassr' },
  { name: 'Neymar Jr', position: 'FWD', club: 'Al Hilal' },
  { name: 'Robert Lewandowski', position: 'FWD', club: 'Barcelona' },
  { name: 'Thibaut Courtois', position: 'GK', club: 'Real Madrid' },
  { name: 'Manuel Neuer', position: 'GK', club: 'Bayern Munich' },
  { name: 'Sergio Ramos', position: 'DEF', club: 'Sevilla' },
  { name: 'Luka Modrić', position: 'MID', club: 'Real Madrid', requests: 'Kylian Mbappé, Vinícius Júnior' },
  { name: "N'Golo Kanté", position: 'MID', club: 'Al-Ittihad' },
  { name: 'Harry Kane', position: 'FWD', club: 'Bayern Munich', requests: 'Jamal Musiala' },
  { name: 'Jamal Musiala', position: 'MID', club: 'Bayern Munich', requests: 'Harry Kane' },
  { name: 'Bukayo Saka', position: 'FWD', club: 'Arsenal' },
  { name: 'Martin Ødegaard', position: 'MID', club: 'Arsenal' },
  { name: 'Alisson Becker', position: 'GK', club: 'Liverpool' },
  { name: 'Rodri', position: 'MID', club: 'Man City' },
  { name: 'Achraf Hakimi', position: 'DEF', club: 'PSG' },
  { name: 'Ousmane Dembélé', position: 'FWD', club: 'PSG' },
];

function nextEightPm(): Date {
  const d = new Date();
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

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

  async function generateDemoSession() {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        title: 'Parqal',
        description: '8:00 PM – 10:00 PM',
        date: nextEightPm().toISOString(),
        location: 'Parqal',
        format: 'custom',
        players_per_team: 8,
        team_count: 3,
        status: 'open',
      })
      .select()
      .single();
    if (sessionError || !session) {
      alert(`Could not create demo session: ${sessionError?.message}`);
      return;
    }

    const { error: playersError } = await supabase.from('players').insert(
      DEMO_PLAYERS.map((p) => ({
        session_id: session.id,
        full_name: p.name,
        email: `${p.name.toLowerCase().replace(/[^a-z]+/g, '.')}@demo.parqal`,
        preferred_position: p.position,
        skill_level: 'advanced',
        notes: p.club,
        teammate_requests: p.requests ?? null,
      })),
    );
    if (playersError) {
      alert(`Session created, but could not add demo players: ${playersError.message}`);
    }
    load();
    navigate(`/admin/session/${session.id}`);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="rule mb-2" />
          <h1 className="headline text-3xl">Sessions</h1>
        </div>
        <div className="flex gap-2">
          {import.meta.env.DEV && (
            <Button variant="outline" onClick={generateDemoSession} title="Dev only: seeds a full demo session">
              <FlaskConical className="h-4 w-4" /> Generate test session
            </Button>
          )}
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New session
          </Button>
        </div>
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
              <TableHead>Teams</TableHead>
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
                    <Badge variant={statusVariant[s.status]}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
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
                      {s.teams_published ? 'Live' : 'Not live'}
                    </span>
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
