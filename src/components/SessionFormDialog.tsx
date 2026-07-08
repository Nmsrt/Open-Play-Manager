import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import { sessionSchema, type SessionInput } from '@/lib/validation';
import { FORMAT_DEFAULTS, type Session, type SessionFormat } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: Session | null;
  onSaved: () => void;
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SessionFormDialog({ open, onOpenChange, session, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SessionInput>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      format: '7-a-side',
      players_per_team: 7,
      team_count: 2,
      fee_amount: 0,
    },
  });

  const format = watch('format');

  useEffect(() => {
    if (!open) return;
    if (session) {
      reset({
        title: session.title,
        description: session.description ?? '',
        date: toLocalInput(session.date),
        location: session.location,
        format: session.format,
        players_per_team: session.players_per_team,
        team_count: session.team_count,
        fee_amount: session.fee_amount,
      });
    } else {
      reset({
        title: '',
        description: '',
        date: '',
        location: '',
        format: '7-a-side',
        players_per_team: 7,
        team_count: 2,
        fee_amount: 0,
      });
    }
  }, [open, session, reset]);

  function onFormatChange(next: SessionFormat) {
    setValue('format', next);
    const preset = FORMAT_DEFAULTS[next];
    if (preset) setValue('players_per_team', preset);
  }

  async function onSubmit(values: SessionInput) {
    const payload = {
      title: values.title,
      description: values.description || null,
      date: new Date(values.date).toISOString(),
      location: values.location,
      format: values.format,
      players_per_team: values.players_per_team,
      team_count: values.team_count,
      fee_amount: values.fee_amount,
    };
    const query = session
      ? supabase.from('sessions').update(payload).eq('id', session.id)
      : supabase.from('sessions').insert(payload);
    const { error } = await query;
    if (error) {
      alert(`Could not save session: ${error.message}`);
      return;
    }
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{session ? 'Edit session' : 'New session'}</DialogTitle>
          <DialogDescription>
            Format and players-per-team drive capacity everywhere in the app.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="s-title">Title</Label>
            <Input id="s-title" className="mt-1" {...register('title')} />
            {errors.title && <p className="mt-1 text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="s-date">Date &amp; time</Label>
              <Input id="s-date" type="datetime-local" className="mt-1" {...register('date')} />
              {errors.date && <p className="mt-1 text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div>
              <Label htmlFor="s-location">Location</Label>
              <Input id="s-location" className="mt-1" {...register('location')} />
              {errors.location && (
                <p className="mt-1 text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="s-format">Format</Label>
              <Select
                id="s-format"
                className="mt-1"
                value={format}
                onChange={(e) => onFormatChange(e.target.value as SessionFormat)}
              >
                <option value="5-a-side">5-a-side</option>
                <option value="7-a-side">7-a-side</option>
                <option value="11-a-side">11-a-side</option>
                <option value="custom">Custom</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-ppt">Players / team</Label>
              <Input
                id="s-ppt"
                type="number"
                min={1}
                max={30}
                className="mt-1"
                disabled={format !== 'custom'}
                {...register('players_per_team')}
              />
              {errors.players_per_team && (
                <p className="mt-1 text-sm text-destructive">{errors.players_per_team.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="s-teams"># Teams</Label>
              <Input
                id="s-teams"
                type="number"
                min={2}
                max={12}
                className="mt-1"
                {...register('team_count')}
              />
              {errors.team_count && (
                <p className="mt-1 text-sm text-destructive">{errors.team_count.message}</p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="s-fee">Fee per player (0 = free)</Label>
            <Input
              id="s-fee"
              type="number"
              min={0}
              step="0.01"
              className="mt-1"
              {...register('fee_amount')}
            />
            {errors.fee_amount && (
              <p className="mt-1 text-sm text-destructive">{errors.fee_amount.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="s-desc">Description (optional)</Label>
            <Textarea id="s-desc" className="mt-1" rows={3} {...register('description')} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save session'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
