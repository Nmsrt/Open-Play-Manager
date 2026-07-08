import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('sessions')
      .select('*')
      .in('status', ['open', 'closed', 'completed'])
      .order('date', { ascending: true })
      .then(({ data }) => {
        setSessions((data as Session[]) ?? []);
        setLoading(false);
      });
  }, []);

  const open = sessions.filter((s) => s.status === 'open');
  const past = sessions.filter((s) => s.status !== 'open' && s.teams_published);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16">
      {/* Hero — matchday-programme masthead with a faint centre circle,
          set on a translucent card so it stays legible over the photo. */}
      <header className="relative mt-6 mb-8 overflow-hidden rounded-xl border border-border bg-surface/90 py-14 text-center shadow-sm backdrop-blur-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/10"
        />
        <p className="headline text-sm tracking-[0.3em] text-primary">⚽ OpenPlay</p>
        <h1 className="headline mt-2 text-5xl leading-none sm:text-6xl">
          Football
          <br />
          <span className="text-primary">Open Play</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-muted-foreground">
          Pick a session. Claim your slot. Pay, show up, play.
        </p>
      </header>

      {loading && <p className="py-6 text-center text-muted-foreground">Loading sessions…</p>}

      {!loading && open.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface/60 py-12 text-center text-muted-foreground">
          No open sessions right now. Check back soon.
        </div>
      )}

      <div className="space-y-5">
        {open.map((s) => {
          const slotsLeft = Math.max(0, s.max_players - s.registered_count);
          return (
            <Link key={s.id} to={`/session/${s.id}`} className="group block focus-visible:outline-none">
              <article className="relative overflow-hidden rounded-lg border border-border bg-surface shadow-[0_1px_2px_rgb(29_42_33/0.06),0_4px_12px_rgb(29_42_33/0.04)] transition-all group-hover:-translate-y-0.5 group-hover:shadow-[0_2px_4px_rgb(29_42_33/0.08),0_10px_24px_rgb(29_42_33/0.08)] group-focus-visible:ring-2 group-focus-visible:ring-primary">
                <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary to-accent" />
                <div className="p-5 pl-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="headline text-2xl leading-tight group-hover:text-primary">
                        {s.title}
                      </h2>
                      <p className="mt-0.5 text-sm font-medium text-muted-foreground">
                        {s.format} · {s.players_per_team} per team
                      </p>
                    </div>
                    <Badge variant={slotsLeft > 0 ? 'success' : 'warning'} className="shrink-0">
                      {slotsLeft > 0 ? `${slotsLeft} slots left` : 'Waitlist'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary" /> {formatDate(s.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" /> {s.location}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <Progress
                      value={s.registered_count}
                      max={s.max_players}
                      label={`${s.registered_count} of ${s.max_players} slots taken`}
                      className="flex-1"
                    />
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {s.registered_count}/{s.max_players}
                    </span>
                    <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </article>
            </Link>
          );
        })}
      </div>

      {past.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 inline-block rounded-md bg-surface/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <span className="rule mb-1" />
            <h2 className="headline text-xl">Recent sessions</h2>
          </div>
          <div className="space-y-2">
            {past.map((s) => (
              <Link
                key={s.id}
                to={`/session/${s.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-sm transition-colors hover:border-primary/40"
              >
                <span className="font-medium">{s.title}</span>
                <span className="text-muted-foreground">{formatDate(s.date)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-14 text-center text-xs text-muted-foreground">
        <Link to="/admin" className="hover:text-primary hover:underline">
          Organizer login
        </Link>
      </footer>
    </main>
  );
}
