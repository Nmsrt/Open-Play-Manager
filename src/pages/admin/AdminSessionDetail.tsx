import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Shirt, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, Team, TeamAssignment } from '@/lib/types';
import { cn, locationCover } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PlayersTab, { type PlayerWithPayments } from '@/components/PlayersTab';
import TeamsManager from '@/components/TeamsManager';
import TeamBuilder from '@/components/TeamBuilder';
import SessionDateTime from '@/components/SessionDateTime';

export default function AdminSessionDetail() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [players, setPlayers] = useState<PlayerWithPayments[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const [sessionRes, playersRes, teamsRes, assignRes] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('players')
        .select('*, payments(*)')
        .eq('session_id', id)
        .neq('status', 'cancelled')
        .order('created_at'),
      supabase.from('teams').select('*').eq('session_id', id).order('sort_order'),
      supabase.from('team_assignments').select('*, teams!inner(session_id)').eq('teams.session_id', id),
    ]);
    setSession(sessionRes.data as Session | null);
    setPlayers((playersRes.data as PlayerWithPayments[]) ?? []);
    setTeams((teamsRes.data as Team[]) ?? []);
    setAssignments((assignRes.data as TeamAssignment[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-muted-foreground">Loading…</p>;
  if (!session) {
    return (
      <div>
        <p className="text-muted-foreground">Session not found.</p>
        <Link to="/admin" className="text-primary hover:underline">
          Back to sessions
        </Link>
      </div>
    );
  }

  const registered = players.filter((p) => p.status === 'registered');
  const waitlisted = players.filter((p) => p.status === 'waitlisted');
  const cover = locationCover(session.location);

  return (
    <div>
      <Link
        to="/admin"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>

      {/* Venue photo as a cover when we have one for this location; a dark
          scrim keeps the details legible over it either way. */}
      <section className="relative mb-6 overflow-hidden rounded-lg bg-muted shadow-sm">
        {cover && (
          <>
            <img src={cover} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/60 to-black/30" />
          </>
        )}
        <div className="relative p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="headline text-3xl leading-tight">{session.title}</h1>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge variant={session.status === 'open' ? 'success' : 'secondary'}>{session.status}</Badge>
              <span
                className="inline-flex items-center gap-1.5 text-xs text-white/80"
                title={session.teams_published ? 'Teams published' : 'Teams not published'}
              >
                <span
                  aria-hidden
                  className={cn(
                    'h-2 w-2 rounded-full',
                    session.teams_published ? 'bg-green-500' : 'bg-red-500',
                  )}
                />
                Teams {session.teams_published ? 'live' : 'not live'}
              </span>
            </div>
          </div>

          <div className={cn('mt-3 space-y-1.5 text-sm', cover ? 'text-white/90' : 'text-muted-foreground')}>
            <p className="flex items-center gap-2">
              <CalendarDays className={cn('h-4 w-4 shrink-0', cover ? 'text-accent' : 'text-primary')} />
              <SessionDateTime iso={session.date} dividerClassName={cover ? 'text-accent' : undefined} />
            </p>
            <p className="flex items-center gap-2">
              <MapPin className={cn('h-4 w-4 shrink-0', cover ? 'text-accent' : 'text-primary')} />
              {session.location}
            </p>
            <p className="flex items-center gap-2">
              <Shirt className={cn('h-4 w-4 shrink-0', cover ? 'text-accent' : 'text-primary')} />
              {session.format} · {session.team_count} teams
            </p>
            <p className="flex items-center gap-2">
              <Users className={cn('h-4 w-4 shrink-0', cover ? 'text-accent' : 'text-primary')} />
              {session.registered_count}/{session.max_players} registered
              {waitlisted.length > 0 && ` · ${waitlisted.length} waitlisted`}
            </p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="players">
        <TabsList>
          <TabsTrigger value="players">Players ({players.length})</TabsTrigger>
          <TabsTrigger value="builder">Team builder</TabsTrigger>
        </TabsList>
        <TabsContent value="players">
          <PlayersTab sessionTitle={session.title} players={players} onChanged={load} />
        </TabsContent>
        <TabsContent value="builder" className="space-y-4">
          <TeamsManager
            sessionId={session.id}
            teams={teams}
            teamCount={session.team_count}
            onChanged={load}
          />
          <TeamBuilder
            session={session}
            teams={teams}
            players={registered}
            assignments={assignments}
            onSaved={load}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
