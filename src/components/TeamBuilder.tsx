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
import { AlertTriangle, Eye, EyeOff, Printer, Save, Trash2, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Player, Position, Session, SkillLevel, Team, TeamAssignment } from '@/lib/types';
import { bibColor, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Placement = Record<string, string | null>; // playerId -> teamId | null (pool)
type Source = Record<string, 'admin' | 'self'>;

const POSITION_ORDER: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'ANY'];

const SKILL_VALUE: Record<SkillLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 };
function skillValue(level: SkillLevel | null): number {
  return level ? SKILL_VALUE[level] : 2; // unknown skill treated as neutral/average
}

// Scans free-text "squad requests" for other registered players' first names
// so the auto-distributor can try to seat requested teammates together.
// Deliberately simple (substring match, no external calls) — a lightweight
// heuristic, not a guarantee, same spirit as the rest of the balancer.
function buildTeammateLinks(players: Player[]): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!links.has(a)) links.set(a, new Set());
    links.get(a)!.add(b);
  };
  for (const a of players) {
    if (!a.teammate_requests) continue;
    const text = a.teammate_requests.toLowerCase();
    for (const b of players) {
      if (b.id === a.id) continue;
      const firstName = b.full_name.trim().split(/\s+/)[0]?.toLowerCase();
      if (firstName && firstName.length >= 3 && text.includes(firstName)) {
        link(a.id, b.id);
        link(b.id, a.id);
      }
    }
  }
  return links;
}

// Penalize stacking the same position onto one team — hard-ish for
// goalkeepers (rarely want two), softer for outfield positions.
function positionPenalty(player: Player, teamMembers: Player[]): number {
  if (player.preferred_position === 'ANY') return 0;
  const sameCount = teamMembers.filter((m) => m.preferred_position === player.preferred_position).length;
  if (sameCount === 0) return 0;
  return player.preferred_position === 'GK' ? 200 : sameCount * 25;
}

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
        'flex cursor-grab items-center gap-2 rounded-md border border-border bg-surface p-2 text-sm shadow-sm touch-none',
        isDragging && 'z-50 opacity-80 shadow-md',
      )}
      {...listeners}
      {...attributes}
    >
      <Badge variant={player.preferred_position === 'GK' ? 'default' : 'secondary'} className="shrink-0">
        {player.preferred_position}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-medium">{player.full_name}</span>
      {player.teammate_requests && (
        <span
          title={`Squad request: ${player.teammate_requests}`}
          className="shrink-0 cursor-help text-sm"
          aria-label={`Squad request: ${player.teammate_requests}`}
        >
          🤝
        </span>
      )}
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
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors',
          jersey != null
            ? 'headline bg-foreground text-white shadow-sm'
            : 'border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
        )}
        title="Set jersey number"
      >
        {jersey != null ? jersey : '#'}
      </button>
    </div>
  );
}

function Column({
  id,
  title,
  subtitle,
  warning,
  accent,
  variant,
  count,
  targetSize,
  onDelete,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  warning?: string;
  accent?: string | null;
  variant: 'pool' | 'team';
  count: number;
  targetSize?: number;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const openSlots = variant === 'team' && targetSize ? Math.max(0, targetSize - count) : 0;

  return (
    <div
      ref={setNodeRef}
      style={accent ? { borderTopColor: accent } : undefined}
      className={cn(
        'relative flex min-h-[240px] flex-col overflow-hidden rounded-lg p-3 transition-all',
        variant === 'team' &&
          'border border-border border-t-4 shadow-sm [background:repeating-linear-gradient(0deg,#f1f7f2_0_28px,#e9f2ea_28px_56px)]',
        variant === 'team' && !accent && 'border-t-border',
        variant === 'pool' && 'border-2 border-dashed border-border bg-muted/50',
        isOver && 'scale-[1.01] border-primary shadow-md',
        isOver && variant === 'team' && 'border-t-primary',
      )}
    >
      {/* Faint centre circle on the mini-pitch */}
      {variant === 'team' && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/10"
        />
      )}

      <div className="relative mb-2">
        <p className="headline flex items-center gap-2 text-lg">
          {accent && (
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full border border-black/10"
              style={{ background: accent }}
            />
          )}
          <span className="min-w-0 truncate">{title}</span>
          <span
            className={cn(
              'ml-auto shrink-0 rounded px-1.5 py-0.5 font-sans text-xs font-bold tabular-nums',
              variant === 'team' ? 'bg-foreground text-white' : 'bg-border text-muted-foreground',
            )}
          >
            {count}
            {targetSize ? `/${targetSize}` : ''}
          </span>
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Delete team ${title}`}
              title="Delete team"
              className="shrink-0 rounded p-0.5 text-muted-foreground/70 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {warning && (
          <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {warning}
          </p>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-2">
        {children}
        {Array.from({ length: openSlots }).map((_, i) => (
          <div
            key={`slot-${i}`}
            aria-hidden
            className="rounded-md border-2 border-dashed border-primary/20 p-2 text-center text-xs font-medium text-primary/40"
          >
            open slot
          </div>
        ))}
        {variant === 'pool' && count === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No unassigned players
          </p>
        )}
      </div>
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

  // Auto-distributes the unassigned pool with a weighted scoring pass rather
  // than pure round-robin: squad requests get seated together first, then
  // it balances position stacking, skill level, and team size, in that
  // priority order.
  function shuffleEvenly() {
    if (teams.length === 0) return;
    const next: Placement = { ...placement };
    const nextSource: Source = { ...source };
    const loads = new Map<string, Player[]>();
    for (const t of teams) {
      loads.set(t.id, players.filter((p) => next[p.id] === t.id));
    }
    const pool = players.filter((p) => !next[p.id]);
    if (pool.length === 0) return;

    const links = buildTeammateLinks(players);
    const globalAvgSkill =
      players.reduce((sum, p) => sum + skillValue(p.skill_level), 0) / Math.max(1, players.length);

    // Seat players with the most squad-request connections first so their
    // requested teammates still have room; GK/position/skill break ties.
    const ordered = [...pool].sort((a, b) => {
      const linkDiff = (links.get(b.id)?.size ?? 0) - (links.get(a.id)?.size ?? 0);
      if (linkDiff !== 0) return linkDiff;
      const posDiff = POSITION_ORDER.indexOf(a.preferred_position) - POSITION_ORDER.indexOf(b.preferred_position);
      if (posDiff !== 0) return posDiff;
      return skillValue(b.skill_level) - skillValue(a.skill_level);
    });

    for (const player of ordered) {
      let bestTeamId = teams[0].id;
      let bestScore = -Infinity;
      for (const t of teams) {
        const members = loads.get(t.id)!;
        const requested = links.get(player.id);
        const linkBonus = requested
          ? members.reduce((sum, m) => sum + (requested.has(m.id) ? 1 : 0), 0) * 1000
          : 0;
        const skillSum = members.reduce((sum, m) => sum + skillValue(m.skill_level), 0);
        const projectedAvg = (skillSum + skillValue(player.skill_level)) / (members.length + 1);
        const skillPenalty = Math.abs(projectedAvg - globalAvgSkill) * 40;
        const score = linkBonus - positionPenalty(player, members) - skillPenalty - members.length * 50;
        if (score > bestScore) {
          bestScore = score;
          bestTeamId = t.id;
        }
      }
      next[player.id] = bestTeamId;
      nextSource[player.id] = 'admin';
      loads.get(bestTeamId)!.push(player);
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

  async function deleteTeam(team: Team) {
    if (!confirm(`Delete "${team.name}"? Its player assignments will be removed.`)) return;
    const { error } = await supabase.from('teams').delete().eq('id', team.id);
    if (error) {
      alert(`Could not delete team: ${error.message}`);
      return;
    }
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
    <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="headline text-lg">Build lineups</h3>
          <p className="text-xs text-muted-foreground">
            Drag players from Unassigned onto a team, or auto-fill the pool below.
          </p>
        </div>
        <div className="text-right">
          <Button variant="outline" size="sm" onClick={shuffleEvenly}>
            <Wand2 className="h-4 w-4" /> Auto-fill pool
          </Button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Balances skill &amp; position, keeps squad requests together
          </p>
        </div>
      </div>

      {imbalanced && (
        <p className="mb-3 flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Teams look imbalanced — some have more
          players than others.
        </p>
      )}

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.min(teams.length + 1, 4)}, minmax(220px, 1fr))` }}
        >
          <Column
            id="pool"
            title="Unassigned"
            variant="pool"
            count={(byTeam.get(null) ?? []).length}
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
                variant="team"
                count={members.length}
                targetSize={session.players_per_team}
                accent={bibColor(t.color_tag) ?? bibColor(t.name)}
                subtitle={t.color_tag || undefined}
                onDelete={() => deleteTeam(t)}
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
        🤝 marks players with a squad request — hover the icon to read it (full text also in the
        Players tab).
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
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
  );
}
