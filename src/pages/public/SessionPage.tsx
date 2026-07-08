import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, Team, TeamPreferenceCount, PlayerStatus } from '@/lib/types';
import type { RegistrationInput } from '@/lib/validation';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RegistrationForm from '@/components/RegistrationForm';
import PublishedRosters from '@/components/PublishedRosters';

type Registered = { status: PlayerStatus; values: RegistrationInput };

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [prefCounts, setPrefCounts] = useState<TeamPreferenceCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState<Registered | null>(null);

  const loadExtras = useCallback(async (sessionId: string) => {
    const [teamsRes, prefRes] = await Promise.all([
      supabase.from('teams').select('*').eq('session_id', sessionId).order('sort_order'),
      supabase.from('team_preference_counts').select('*').eq('session_id', sessionId),
    ]);
    setTeams((teamsRes.data as Team[]) ?? []);
    setPrefCounts((prefRes.data as TeamPreferenceCount[]) ?? []);
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSession(data as Session | null);
        setLoading(false);
        if (data) loadExtras(id);
      });

    // Live slot counter: registered_count is trigger-maintained on sessions,
    // so anon subscribers get updates without any access to player rows.
    const channel = supabase
      .channel(`session-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${id}` },
        (payload) => {
          setSession(payload.new as Session);
          loadExtras(id);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id, loadExtras]);

  if (loading) {
    return <main className="p-10 text-center text-muted-foreground">Loading session…</main>;
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <h1 className="text-xl font-semibold">Session not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed or isn't public yet.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">
          Back to sessions
        </Link>
      </main>
    );
  }

  const slotsLeft = Math.max(0, session.max_players - session.registered_count);
  const isFull = slotsLeft === 0;
  const isOpen = session.status === 'open';

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-2xl">{session.title}</CardTitle>
            <Badge variant={isOpen ? (isFull ? 'warning' : 'success') : 'secondary'}>
              {isOpen ? (isFull ? 'Waitlist open' : `${slotsLeft} slots left`) : session.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2 text-muted-foreground">
            <CalendarDays className="h-4 w-4" /> {formatDate(session.date)}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {session.location}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" /> {session.format} · {session.players_per_team} per team ·{' '}
            {session.registered_count}/{session.max_players} registered
          </p>
          {session.description && <p className="pt-2">{session.description}</p>}
        </CardContent>
      </Card>

      {session.teams_published && <div className="mb-8"><PublishedRosters sessionId={session.id} /></div>}

      {registered ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-3 text-xl font-semibold">
              {registered.status === 'waitlisted' ? "You're on the waitlist" : "You're registered!"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {registered.status === 'waitlisted'
                ? 'You will be promoted automatically if a spot opens up.'
                : 'The organizer will verify your payment before the session.'}
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-md border border-border p-4 text-left text-sm">
              <p className="font-semibold">{registered.values.full_name}</p>
              <p className="text-muted-foreground">{registered.values.email}</p>
              <p className="text-muted-foreground">{registered.values.phone}</p>
              <hr className="my-2 border-border" />
              <p>
                {session.title} · {formatDate(session.date)}
              </p>
              <p className="text-muted-foreground">{session.location}</p>
              {registered.values.reference_number && (
                <p className="mt-2 text-muted-foreground">
                  Payment ref: {registered.values.reference_number}
                </p>
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Keep a screenshot of this for your records.
            </p>
          </CardContent>
        </Card>
      ) : isOpen ? (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Register</h2>
          <RegistrationForm
            session={session}
            teams={teams}
            prefCounts={prefCounts}
            isFull={isFull}
            onSuccess={setRegistered}
          />
        </section>
      ) : (
        !session.teams_published && (
          <p className="text-center text-muted-foreground">Registration for this session is closed.</p>
        )
      )}
    </main>
  );
}
