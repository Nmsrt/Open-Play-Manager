import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Player, Session, Team, TeamAssignment } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type AssignmentWithRelations = TeamAssignment & { players: Player; teams: Team };

export default function PrintRoster() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [rows, setRows] = useState<AssignmentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from('sessions').select('*').eq('id', id).maybeSingle(),
      supabase.from('teams').select('*').eq('session_id', id).order('sort_order'),
      supabase
        .from('team_assignments')
        .select('*, players(*), teams!inner(*)')
        .eq('teams.session_id', id),
    ]).then(([sessionRes, teamsRes, assignRes]) => {
      setSession(sessionRes.data as Session | null);
      setTeams((teamsRes.data as Team[]) ?? []);
      setRows((assignRes.data as AssignmentWithRelations[]) ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <main className="p-10 text-center text-muted-foreground">Loading…</main>;
  if (!session) return <main className="p-10 text-center text-muted-foreground">Session not found.</main>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link
          to={`/admin/session/${session.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to session
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(session.date)} · {session.location} · {session.format} (
          {session.players_per_team} per team)
        </p>
      </header>

      <div className="grid grid-cols-2 gap-6 print:grid-cols-2">
        {teams.map((t) => {
          const members = rows
            .filter((r) => r.team_id === t.id)
            .sort((a, b) => a.players.full_name.localeCompare(b.players.full_name));
          return (
            <section key={t.id} className="break-inside-avoid">
              <h2 className="mb-1 text-lg font-semibold">
                {t.name}
                {t.color_tag && <span className="ml-2 text-sm font-normal text-muted-foreground">({t.color_tag})</span>}
              </h2>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {members.length === 0 && (
                    <tr>
                      <td className="py-1 text-muted-foreground">No players assigned</td>
                    </tr>
                  )}
                  {members.map((m, i) => (
                    <tr key={m.id} className="border-b border-border">
                      <td className="w-6 py-1 text-muted-foreground">{i + 1}.</td>
                      <td className="py-1 font-medium">
                        {m.players.full_name}
                        {m.jersey_number != null && (
                          <span className="ml-1 text-muted-foreground">#{m.jersey_number}</span>
                        )}
                      </td>
                      <td className="w-12 py-1 text-right text-muted-foreground">
                        {m.players.preferred_position}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Generated {new Date().toLocaleString()} · OpenPlay
      </p>
    </main>
  );
}
