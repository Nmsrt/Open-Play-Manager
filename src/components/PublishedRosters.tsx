import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PublicRosterRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function PublishedRosters({ sessionId }: { sessionId: string }) {
  const [rows, setRows] = useState<PublicRosterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from('public_rosters')
        .select('*')
        .eq('session_id', sessionId);
      if (!cancelled) {
        setRows((data as PublicRosterRow[]) ?? []);
        setLoading(false);
      }
    }
    load();
    const channel = supabase
      .channel(`rosters-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_assignments' },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  if (loading) return <p className="text-center text-muted-foreground">Loading teams…</p>;
  if (rows.length === 0) return null;

  const teams = new Map<string, PublicRosterRow[]>();
  for (const row of rows) {
    const list = teams.get(row.team_id) ?? [];
    list.push(row);
    teams.set(row.team_id, list);
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Final teams</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {[...teams.values()].map((members) => (
          <Card key={members[0].team_id}>
            <CardHeader className="pb-2">
              <CardTitle>{members[0].team_name}</CardTitle>
              {members[0].color_tag && <CardDescription>{members[0].color_tag}</CardDescription>}
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {members
                  .slice()
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map((m, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{m.full_name}</span>
                      {m.jersey_number != null && (
                        <span className="text-muted-foreground">#{m.jersey_number}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
