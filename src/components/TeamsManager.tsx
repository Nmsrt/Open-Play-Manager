import { useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
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

/** Team setup: create teams up to the session's team_count. Deleting a team
 * happens from its column header in the builder below, not here — keeping
 * one place for destructive actions instead of duplicating the control. */
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

  const missing = Math.max(0, teamCount - teams.length);

  return (
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="headline text-lg">Team setup</h3>
        <span className="text-sm text-muted-foreground">
          {teams.length}/{teamCount} created
        </span>
      </div>

      {missing > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-amber-700">
          <span>Add {missing} more — quick add:</span>
          {BIB_SUGGESTIONS.filter((b) => !teams.some((t) => t.name === b))
            .slice(0, missing)
            .map((b) => (
              <button
                key={b}
                onClick={() => addTeam(b, b)}
                className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-100"
              >
                + {b}
              </button>
            ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          All teams created. Manage rosters in the builder below.
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
