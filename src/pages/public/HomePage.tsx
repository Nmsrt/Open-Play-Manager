import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">OpenPlay</p>
        <h1 className="mt-1 text-3xl font-bold">Football Open Play</h1>
        <p className="mt-2 text-muted-foreground">Pick a session, register, pay, play.</p>
      </header>

      {loading && <p className="text-center text-muted-foreground">Loading sessions…</p>}

      {!loading && open.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No open sessions right now. Check back soon.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {open.map((s) => {
          const slotsLeft = Math.max(0, s.max_players - s.registered_count);
          return (
            <Link key={s.id} to={`/session/${s.id}`} className="block focus-visible:outline-none">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{s.title}</CardTitle>
                    <Badge variant={slotsLeft > 0 ? 'success' : 'warning'}>
                      {slotsLeft > 0 ? `${slotsLeft} slots left` : 'Waitlist'}
                    </Badge>
                  </div>
                  <CardDescription>{s.format} · {s.players_per_team} per team</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> {formatDate(s.date)}
                  </p>
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> {s.location}
                  </p>
                  <p className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> {s.registered_count} / {s.max_players} registered
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Recent sessions</h2>
          <div className="space-y-2">
            {past.map((s) => (
              <Link
                key={s.id}
                to={`/session/${s.id}`}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm hover:bg-muted"
              >
                <span>{s.title}</span>
                <span className="text-muted-foreground">{formatDate(s.date)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        <Link to="/admin" className="hover:underline">
          Organizer login
        </Link>
      </footer>
    </main>
  );
}
