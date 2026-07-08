import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { bibColor } from '@/lib/utils';
import type { Team } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BIB_SUGGESTIONS = ['Red Bibs', 'Blue Bibs', 'Yellow Bibs', 'Green Bibs', 'Orange Bibs', 'White Bibs'];

interface Props {
  sessionId: string;
  teams: Team[];
  teamCount: number;
  onChanged: () => void;
}

export default function TeamsManager({ sessionId, teams, teamCount, onChanged }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [busy, setBusy] = useState(false);

  async function addTeam(presetName?: string, presetColor?: string) {
    const teamName = (presetName ?? name).trim();
    if (!teamName) return;
    setBusy(true);
    const { error } = await supabase.from('teams').insert({
      session_id: sessionId,
      name: teamName,
      color_tag: (presetColor ?? color).trim(),
      sort_order: teams.length,
    });
    setBusy(false);
    if (error) {
      alert(`Could not add team: ${error.message}`);
      return;
    }
    setName('');
    setColor('');
    onChanged();
  }

  async function removeTeam(team: Team) {
    if (!confirm(`Delete "${team.name}"? Its player assignments will be removed.`)) return;
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) alert(`Could not delete team: ${error.message}`);
    onChanged();
  }

  const missing = Math.max(0, teamCount - teams.length);

  return (
    <div className="mb-6 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto text-sm font-semibold">
          Teams ({teams.length}/{teamCount})
        </h3>
        {teams.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-sm shadow-sm"
          >
            {(bibColor(t.color_tag) ?? bibColor(t.name)) && (
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                style={{ background: bibColor(t.color_tag) ?? bibColor(t.name) ?? undefined }}
              />
            )}
            {t.name}
            {t.color_tag && <span className="text-muted-foreground">· {t.color_tag}</span>}
            <button
              onClick={() => removeTeam(t)}
              aria-label={`Delete team ${t.name}`}
              className="ml-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {missing > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Session expects {teamCount} teams — add {missing} more. Quick add:{' '}
          {BIB_SUGGESTIONS.filter((b) => !teams.some((t) => t.name === b))
            .slice(0, missing)
            .map((b) => (
              <button
                key={b}
                onClick={() => addTeam(b, b)}
                className="mr-1 rounded-full border border-border px-2 py-0.5 text-xs hover:bg-muted"
              >
                + {b}
              </button>
            ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          placeholder="Team name (e.g. Red Bibs)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 w-48"
        />
        <Input
          placeholder="Bib/pinnie color (optional)"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-48"
        />
        <Button size="sm" variant="outline" onClick={() => addTeam()} disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> Add team
        </Button>
      </div>
    </div>
  );
}
