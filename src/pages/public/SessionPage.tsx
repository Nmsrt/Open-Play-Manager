import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Shirt, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session, PlayerStatus } from '@/lib/types';
import type { RegistrationInput } from '@/lib/validation';
import { formatDate, locationCover } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RegistrationForm from '@/components/RegistrationForm';
import PublishedRosters from '@/components/PublishedRosters';
import SessionDateTime from '@/components/SessionDateTime';

type Registered = { status: PlayerStatus; values: RegistrationInput };

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);

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
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  if (loading) {
    return <main className="p-10 text-center text-muted-foreground">Loading session…</main>;
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <h1 className="headline text-2xl">Session not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed or isn't public yet.</p>
        <Link to="/" className="mt-4 inline-block font-medium text-primary hover:underline">
          Back to sessions
        </Link>
      </main>
    );
  }

  const slotsLeft = Math.max(0, session.max_players - session.registered_count);
  const isFull = slotsLeft === 0;
  const isOpen = session.status === 'open';
  const cover = locationCover(session.location);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>

      {/* Match header — dark pitch panel, scoreboard energy. Venue photo as
          cover when we have one for this location (e.g. Parqal). */}
      <section className="relative mb-6 overflow-hidden rounded-lg bg-primary-deep text-white shadow-lg">
        {cover && (
          <>
            <img
              src={cover}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Dark scrim keeps text readable over the photo. */}
            <div className="absolute inset-0 bg-gradient-to-t from-green-950/95 via-green-950/75 to-green-900/45" />
          </>
        )}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border-2 border-white/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full border-2 border-white/10"
        />
        <div className="relative p-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="headline text-4xl leading-none">{session.title}</h1>
            <Badge
              variant={isOpen ? (isFull ? 'warning' : 'success') : 'secondary'}
              className="mt-1 shrink-0"
            >
              {isOpen ? (isFull ? 'Waitlist open' : 'Open') : session.status}
            </Badge>
          </div>
          <div className="mt-4 space-y-1.5 text-sm text-white/85">
            <p className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
              <SessionDateTime iso={session.date} dividerClassName="text-accent" />
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-accent" /> {session.location}
            </p>
            <p className="flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" /> {session.format} ·{' '}
              {session.players_per_team} per team
            </p>
          </div>
          {session.description && <p className="mt-3 text-sm text-white/75">{session.description}</p>}
          {session.teams_published && (
            <button
              onClick={() => setTeamsOpen(true)}
              className="headline mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-base tracking-wide text-green-950 shadow-md transition-transform hover:scale-[1.02] active:translate-y-px"
            >
              <Shirt className="h-4 w-4" /> View final teams
            </button>
          )}
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-white/70">
              <span>Slots</span>
              <span className="tabular-nums text-white">
                {session.registered_count}/{session.max_players}
                {isOpen && !isFull && ` · ${slotsLeft} left`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500"
                style={{
                  width: `${Math.min(100, (session.registered_count / session.max_players) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <Dialog open={teamsOpen} onOpenChange={setTeamsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="headline text-2xl">Final teams</DialogTitle>
          </DialogHeader>
          {session.teams_published && <PublishedRosters sessionId={session.id} hideTitle />}
        </DialogContent>
      </Dialog>

      {registered ? (
        // Ticket-style confirmation, like a matchday pass.
        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="bg-primary px-6 py-3">
            <p className="headline flex items-center gap-2 text-lg text-white">
              <CheckCircle2 className="h-5 w-5 text-accent" />
              {registered.status === 'waitlisted' ? 'Waitlist pass' : 'Matchday pass'}
            </p>
          </div>
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              {registered.status === 'waitlisted'
                ? "You're on the waitlist — you'll be promoted automatically if a spot opens up."
                : 'You are in. The organizer will verify your payment before the session.'}
            </p>
            <div className="mt-5 rounded-md border-2 border-dashed border-border p-4 text-sm">
              <p className="headline text-xl">{registered.values.full_name}</p>
              <p className="text-muted-foreground">{registered.values.email}</p>
              <hr className="my-3 border-dashed border-border" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Session</span>
                <span className="font-medium">{session.title}</span>
                <span className="text-muted-foreground">Kick-off</span>
                <span className="font-medium">{formatDate(session.date)}</span>
                <span className="text-muted-foreground">Venue</span>
                <span className="font-medium">{session.location}</span>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Keep a screenshot of this pass for your records.
            </p>
          </div>
        </section>
      ) : isOpen ? (
        <section>
          <div className="mb-4 inline-block rounded-md bg-surface/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <span className="rule mb-1" />
            <h2 className="headline text-2xl">Register</h2>
          </div>
          <RegistrationForm session={session} isFull={isFull} onSuccess={setRegistered} />
        </section>
      ) : (
        !session.teams_published && (
          <p className="text-center text-muted-foreground">
            Registration for this session is closed.
          </p>
        )
      )}
    </main>
  );
}
