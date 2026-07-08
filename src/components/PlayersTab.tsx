import { useMemo, useState } from 'react';
import { Download, UserCheck, UserX, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Payment, Player, PaymentStatus, Team } from '@/lib/types';
import { downloadCsv } from '@/lib/csv';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PaymentDialog from '@/components/PaymentDialog';

export type PlayerWithPayments = Player & { payments: Payment[] };

const paymentVariant: Record<PaymentStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  verified: 'success',
  rejected: 'destructive',
};

interface Props {
  sessionTitle: string;
  players: PlayerWithPayments[];
  teams: Team[];
  onChanged: () => void;
}

export default function PlayersTab({ sessionTitle, players, teams, onChanged }: Props) {
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<'all' | PaymentStatus>('all');
  const [reviewing, setReviewing] = useState<PlayerWithPayments | null>(null);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? '—';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (q && !`${p.full_name} ${p.email} ${p.phone ?? ''}`.toLowerCase().includes(q)) return false;
      if (payFilter !== 'all' && p.payments[0]?.status !== payFilter) return false;
      return true;
    });
  }, [players, search, payFilter]);

  async function toggleCheckIn(p: Player) {
    const { error } = await supabase
      .from('players')
      .update({ checked_in_at: p.checked_in_at ? null : new Date().toISOString() })
      .eq('id', p.id);
    if (error) alert(`Could not update check-in: ${error.message}`);
    onChanged();
  }

  async function removePlayer(p: Player) {
    if (!confirm(`Remove ${p.full_name} from this session? This also removes their payment record.`))
      return;
    const { error } = await supabase.from('players').delete().eq('id', p.id);
    if (error) alert(`Could not remove player: ${error.message}`);
    onChanged();
  }

  function exportCsv() {
    downloadCsv(
      `${sessionTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-players.csv`,
      ['Name', 'Email', 'Phone', 'Position', 'Skill', 'Preferred team', 'Status', 'Checked in', 'Payment status', 'Amount', 'Method', 'Reference'],
      players.map((p) => [
        p.full_name,
        p.email,
        p.phone ?? '',
        p.preferred_position,
        p.skill_level ?? '',
        teamName(p.preferred_team),
        p.status,
        p.checked_in_at ? 'yes' : 'no',
        p.payments[0]?.status ?? '',
        p.payments[0]?.amount ?? '',
        p.payments[0]?.method ?? '',
        p.payments[0]?.reference_number ?? '',
      ]),
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value as typeof payFilter)}
          className="sm:w-44"
          aria-label="Filter by payment status"
        >
          <option value="all">All payments</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </Select>
        <div className="sm:ml-auto">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={players.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-muted-foreground">
          {players.length === 0 ? 'No registrations yet.' : 'No players match the filter.'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>Pos</TableHead>
              <TableHead>Prefers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => {
              const payment = p.payments[0];
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.email}
                      {p.phone ? ` · ${p.phone}` : ''}
                    </p>
                    {p.notes && <p className="text-xs italic text-muted-foreground">“{p.notes}”</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.preferred_position}</Badge>
                    {p.skill_level && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.skill_level}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{teamName(p.preferred_team)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === 'registered' ? 'success' : p.status === 'waitlisted' ? 'warning' : 'secondary'}>
                      {p.status}
                    </Badge>
                    {p.checked_in_at && (
                      <Badge variant="outline" className="ml-1">
                        checked in
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {payment ? (
                      <button
                        onClick={() => setReviewing(p)}
                        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                        aria-label={`Review payment of ${p.full_name}`}
                      >
                        <Badge variant={paymentVariant[payment.status]} className="cursor-pointer">
                          {payment.status} · ₱{payment.amount}
                        </Badge>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground">none</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleCheckIn(p)}
                      aria-label={p.checked_in_at ? `Undo check-in for ${p.full_name}` : `Check in ${p.full_name}`}
                      title={p.checked_in_at ? 'Undo check-in' : 'Check in'}
                    >
                      {p.checked_in_at ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePlayer(p)}
                      aria-label={`Remove ${p.full_name}`}
                      title="Remove player"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <PaymentDialog
        payment={reviewing?.payments[0] ?? null}
        player={reviewing}
        onOpenChange={(open) => !open && setReviewing(null)}
        onChanged={onChanged}
      />
    </div>
  );
}
