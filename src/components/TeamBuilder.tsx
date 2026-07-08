import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Eye, EyeOff, Printer, Shuffle, Sparkles, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Player, Position, Session, Team, TeamAssignment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Placement = Record<string, string | null>; // playerId -> teamId | null (pool)
type Source = Record<string, 'admin' | 'self'>;

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];

interface Props {
  session: Session;
  teams: Team[];
  players: Player[]; // registered only
  assignments: TeamAssignment[];
  onSaved: () => void;
}

function PlayerCard({
  player,
  source,
  jersey,
  onJersey,
}: {
  player: Player;
  source?: 'admin' | 'self';
  jersey: number | null;
  onJersey: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(
        'flex cursor-grab items-center gap-2 rounded-md border border-border bg-background p-2 text-sm shadow-sm touch-none',
        isDragging && 'z-50 opacity-80 shadow-md',
      )}
      {...listeners}
      {...attributes}
    >
      <Badge variant={player.preferred_position === 'GK' ? 'default' : 'secondary'} className="shrink-0">
        {player.preferred_position}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-medium">{player.full_name}</span>
      {source === 'self' && (
        <Badge variant="outline" title="Player picked this team themselves">
          self
        </Badge>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onJersey();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="shrink-0 rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
        title="Set jersey number"
      >
        {jersey != null ? `#${jersey}` : '#'}
      </button>
    </div>
  );
}

function Column({
  id,
  title,
  subtitle,
  warning,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  warning?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[220px] flex-col rounded-lg border border-border bg-muted/40 p-3 transition-colors',
        isOver && 'border-primary bg-green-50',
      )}
    >
      <div className="mb-2">
        <p className="font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {warning && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {warning}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </div>
  );
}

export default function TeamBuilder({ session, teams, players, assignments, onSaved }: Props) {
  const [placement, setPlacement] = useState<Placement>({});
  const [source, setSource] = useState<Source>({});
  const [jerseys, setJerseys] = useState<Record<string, number | null>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    const p: Placement = {};
    const s: Source = {};
    const j: Record<string, number | null> = {};
    for (const player of players) {
      p[player.id] = null;
      j[player.id] = null;
    }
    for (const a of assignments) {
      if (p[a.player_id] !== undefined) {
        p[a.player_id] = a.team_id;
        s[a.player_id] = a.assigned_by;
        j[a.player_id] = a.jersey_number;
      }
    }
    setPlacement(p);
    setSource(s);
    setJerseys(j);
    setDirty(false);
  }, [players, assignments]);

  const byTeam = useMemo(() => {
    const map = new Map<string | null, Player[]>();
    map.set(null, []);
    for (const t of teams) map.set(t.id, []);
    for (const player of players) {
      const teamId = placement[player.id] ?? null;
      (map.get(map.has(teamId) ? teamId : null) ?? []).push(player);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          POSITION_ORDER.indexOf(a.preferred_position) - POSITION_ORDER.indexOf(b.preferred_position) ||
          a.full_name.localeCompare(b.full_name),
      );
    }
    return map;
  }, [players, teams, placement]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const playerId = String(active.id);
    const target = over.id === 'pool' ? null : String(over.id);
    if ((placement[playerId] ?? null) === target) return;
    setPlacement((prev) => ({ ...prev, [playerId]: target }));
    setSource((prev) => ({ ...prev, [playerId]: 'admin' }));
    setDirty(true);
  }

  function applyPreferences() {
    const teamIds = new Set(teams.map((t) => t.id));
    const nextPlacement = { ...placement };
    const nextSource = { ...source };
    let changed = false;
    for (const player of players) {
      if (!nextPlacement[player.id] && player.preferred_team && teamIds.has(player.preferred_team)) {
        nextPlacement[player.id] = player.preferred_team;
        nextSource[player.id] = 'self';
        changed = true;
      }
    }
    if (!changed) return;
    setPlacement(nextPlacement);
    setSource(nextSource);
    setDirty(true);
  }

  function shuffleEvenly() {
    if (teams.length === 0) return;
    const next: Placement = { ...placement };
    const nextSource: Source = { ...source };
    const loads = new Map<string, Player[]>();
    for (const t of teams) {
      loads.set(t.id, players.filter((p) => next[p.id] === t.id));
    }
    const pool = players.filter((p) => !next[p.id]);
    // GKs first (one per keeperless team), then outfield by position, always
    // into the least-loaded team — not pure random.
    const ordered = [...pool].sort(
      (a, b) =>
        POSITION_ORDER.indexOf(a.preferred_position) - POSITION_ORDER.indexOf(b.preferred_position),
    );
    for (const player of ordered) {
      const candidates = [...loads.entries()].sort((a, b) => a[1].length - b[1].length);
      let targetId = candidates[0][0];
      if (player.preferred_position === 'GK') {
        const keeperless = candidates.find(([, list]) => !list.some((p) => p.preferred_position === 'GK'));
        if (keeperless) targetId = keeperless[0];
      }
      next[player.id] = targetId;
      nextSource[player.id] = 'admin';
      loads.get(targetId)!.push(player);
    }
    setPlacement(next);
    setSource(nextSource);
    setDirty(true);
  }

  function editJersey(player: Player) {
    const current = jerseys[player.id];
    const raw = window.prompt(`Jersey number for ${player.full_name} (blank to clear):`, current != null ? String(current) : '');
    if (raw === null) return;
    const trimmed = raw.trim();
    if (trimmed === '') {
      setJerseys((j) => ({ ...j, [player.id]: null }));
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n < 1 || n > 99) {
        alert('Jersey number must be 1–99.');
        return;
      }
      setJerseys((j) => ({ ...j, [player.id]: n }));
    }
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const assigned = players.filter((p) => placement[p.id]);
    const unassigned = players.filter((p) => !placement[p.id]);

    const upserts = assigned.map((p) => ({
      player_id: p.id,
      team_id: placement[p.id]!,
      assigned_by: source[p.id] ?? 'admin',
      jersey_number: jerseys[p.id] ?? null,
    }));

    let error = null;
    if (upserts.length > 0) {
      ({ error } = await supabase.from('team_assignments').upsert(upserts, { onConflict: 'player_id' }));
    }
    if (!error && unassigned.length > 0) {
      ({ error } = await supabase
        .from('team_assignments')
        .delete()
        .in('player_id', unassigned.map((p) => p.id)));
    }
    setSaving(false);
    if (error) {
      alert(`Could not save assignments: ${error.message}`);
      return;
    }
    setDirty(false);
    onSaved();
  }

  async function togglePublish() {
    const publishing = !session.teams_published;
    if (publishing && dirty) {
      alert('Save your changes before publishing.');
      return;
    }
    if (publishing && !confirm('Publish teams? Players will see final rosters on the public page.')) return;
    const { error } = await supabase
      .from('sessions')
      .update({ teams_published: publishing })
      .eq('id', session.id);
    if (error) alert(`Could not update publish state: ${error.message}`);
    onSaved();
  }

  const counts = teams.map((t) => (byTeam.get(t.id) ?? []).length);
  const imbalanced = counts.length > 1 && Math.max(...counts) - Math.min(...counts) > 1;

  if (teams.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">
        Add teams above to start building lineups.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={applyPreferences}>
          <Sparkles className="h-4 w-4" /> Apply player preferences
        </Button>
        <Button variant="outline" size="sm" onClick={shuffleEvenly}>
          <Shuffle className="h-4 w-4" /> Distribute pool evenly
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {imbalanced && (
            <span className="flex items-center gap-1 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Teams look imbalanced
            </span>
          )}
          <Link to={`/admin/session/${session.id}/print`}>
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4" /> Print
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={togglePublish}>
            {session.teams_published ? (
              <>
                <EyeOff className="h-4 w-4" /> Unpublish
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Publish teams
              </>
            )}
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(teams.length + 1, 4)}, minmax(220px, 1fr))` }}
        >
          <Column
            id="pool"
            title="Pool"
            subtitle={`${(byTeam.get(null) ?? []).length} unassigned`}
          >
            {(byTeam.get(null) ?? []).map((p) => (
              <PlayerCard key={p.id} player={p} jersey={jerseys[p.id] ?? null} onJersey={() => editJersey(p)} />
            ))}
          </Column>
          {teams.map((t) => {
            const members = byTeam.get(t.id) ?? [];
            const hasGk = members.some((p) => p.preferred_position === 'GK');
            const over = members.length > session.players_per_team;
            return (
              <Column
                key={t.id}
                id={t.id}
                title={t.name}
                subtitle={`${t.color_tag ? `${t.color_tag} · ` : ''}${members.length}/${session.players_per_team} players`}
                warning={
                  over
                    ? `Over capacity (${members.length}/${session.players_per_team})`
                    : members.length > 0 && !hasGk
                      ? 'No goalkeeper yet'
                      : undefined
                }
              >
                {members.map((p) => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    source={source[p.id]}
                    jersey={jerseys[p.id] ?? null}
                    onJersey={() => editJersey(p)}
                  />
                ))}
              </Column>
            );
          })}
        </div>
      </DndContext>

      <p className="mt-3 text-xs text-muted-foreground">
        Cards marked <Badge variant="outline">self</Badge> were placed from the player's own team
        preference. Drag a card to override — it then counts as admin-assigned.
      </p>
    </div>
  );
}
