import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/lib/supabase';
import {
  registrationSchema,
  type RegistrationInput,
  MAX_PROOF_BYTES,
  PROOF_MIME_TYPES,
} from '@/lib/validation';
import type { Session, PlayerStatus, Position, SkillLevel } from '@/lib/types';
import { PAYMENT_METHODS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  session: Session;
  isFull: boolean;
  onSuccess: (result: { status: PlayerStatus; values: RegistrationInput }) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-sm text-destructive">
      {message}
    </p>
  );
}

const POSITION_BLURBS: Record<Position, string> = {
  GK: 'Keeper — the last wall 🧤',
  DEF: 'Defender — nothing gets past you 🛡️',
  MID: 'Midfielder — the engine room 🔋',
  FWD: 'Striker — goals, goals, goals ⚽',
  ANY: "Anywhere — coach's call 🎲",
};

const PITCH_SPOTS: Array<{ pos: Position; label: string; top: string }> = [
  { pos: 'FWD', label: 'Striker', top: '16%' },
  { pos: 'MID', label: 'Midfield', top: '44%' },
  { pos: 'DEF', label: 'Defence', top: '68%' },
  { pos: 'GK', label: 'Keeper', top: '88%' },
];

// Literal Tailwind classes (not interpolated) so each position gets its own
// hover tint on the mini pitch — Striker warms red, Midfield cools blue, etc.
const POSITION_HOVER_CLASSES: Record<Position, string> = {
  FWD: 'hover:border-red-200 hover:bg-red-400/50',
  MID: 'hover:border-sky-200 hover:bg-sky-400/50',
  DEF: 'hover:border-amber-200 hover:bg-amber-400/50',
  GK: 'hover:border-violet-200 hover:bg-violet-400/50',
  ANY: 'hover:border-white hover:bg-white/30',
};

/** Tap-your-spot mini pitch: pick a position by standing on it. */
function PitchPositionPicker({
  value,
  onChange,
}: {
  value: Position;
  onChange: (p: Position) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Preferred position">
      <div
        className="relative mx-auto aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-xl border-4 border-white shadow-md"
        style={{
          background:
            'repeating-linear-gradient(0deg, #15803d 0 12.5%, #16893f 12.5% 25%)',
        }}
      >
        {/* Pitch markings */}
        <div aria-hidden className="absolute inset-2 rounded-md border-2 border-white/50" />
        <div aria-hidden className="absolute left-2 right-2 top-1/2 h-0.5 bg-white/50" />
        <div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/50"
        />
        <div
          aria-hidden
          className="absolute bottom-2 left-1/2 h-16 w-36 -translate-x-1/2 border-2 border-b-0 border-white/50"
        />
        <div
          aria-hidden
          className="absolute bottom-2 left-1/2 h-7 w-20 -translate-x-1/2 border-2 border-b-0 border-white/50"
        />

        {PITCH_SPOTS.map(({ pos, label, top }) => {
          const selected = value === pos;
          return (
            <button
              key={pos}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(pos)}
              className="absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 focus-visible:outline-none"
              style={{ top }}
            >
              <span
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  selected
                    ? 'scale-110 border-white bg-accent text-green-950 shadow-lg ring-4 ring-white/40'
                    : cn(
                        'border-white/70 bg-white/15 text-white backdrop-blur-[1px] hover:scale-110 hover:text-white hover:shadow-md',
                        POSITION_HOVER_CLASSES[pos],
                      ),
                )}
              >
                {pos}
              </span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  selected ? 'bg-white text-green-900' : 'text-white/90',
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        role="radio"
        aria-checked={value === 'ANY'}
        onClick={() => onChange('ANY')}
        className={cn(
          'mx-auto mt-3 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all',
          value === 'ANY'
            ? 'scale-105 border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-border bg-surface hover:border-primary/50',
        )}
      >
        🎲 Put me anywhere
      </button>

      <p aria-live="polite" className="mt-2 text-center text-sm font-medium text-primary">
        {POSITION_BLURBS[value]}
      </p>
    </div>
  );
}

const SKILL_OPTIONS: Array<{ value: SkillLevel; stars: string; label: string; blurb: string }> = [
  { value: 'beginner', stars: '★', label: 'Rookie', blurb: 'Here for the fun' },
  { value: 'intermediate', stars: '★★', label: 'Regular', blurb: 'Knows the game' },
  { value: 'advanced', stars: '★★★', label: 'Baller', blurb: 'Carries the team' },
];

export default function RegistrationForm({ session, isFull, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: { preferred_position: 'ANY', method: 'gcash' },
  });

  const position = watch('preferred_position');
  const skill = watch('skill_level');
  const method = watch('method');

  function handleProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProofError('');
    const file = e.target.files?.[0] ?? null;
    if (!file) return setProofFile(null);
    if (!PROOF_MIME_TYPES.includes(file.type)) {
      setProofError('Use a JPG, PNG, or WebP image.');
      return setProofFile(null);
    }
    if (file.size > MAX_PROOF_BYTES) {
      setProofError('Image must be 5 MB or smaller.');
      return setProofFile(null);
    }
    setProofFile(file);
  }

  async function onSubmit(values: RegistrationInput) {
    setServerError('');
    setSubmitting(true);
    try {
      let proofPath: string | null = null;
      if (proofFile) {
        const ext = proofFile.type === 'image/png' ? 'png' : proofFile.type === 'image/webp' ? 'webp' : 'jpg';
        proofPath = `${session.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(proofPath, proofFile, { contentType: proofFile.type });
        if (uploadError) throw new Error('Could not upload the payment proof. Try again.');
      }

      const { data, error } = await supabase.rpc('register_player', {
        p_session_id: session.id,
        p_full_name: values.full_name,
        p_email: values.email,
        p_preferred_position: values.preferred_position,
        p_skill_level: values.skill_level,
        p_notes: values.notes || null,
        p_teammate_requests: values.teammate_requests || null,
        p_amount: session.fee_amount > 0 ? session.fee_amount : null,
        p_method: values.method,
        p_proof_image_path: proofPath,
      });

      if (error) {
        if (error.message.includes('ALREADY_REGISTERED')) {
          throw new Error('This email is already registered for this session.');
        }
        if (error.message.includes('REGISTRATION_CLOSED')) {
          throw new Error('Registration for this session has closed.');
        }
        throw new Error('Registration failed. Please try again.');
      }

      const status = ((data as { status?: PlayerStatus })?.status ?? 'registered') as PlayerStatus;
      onSuccess({ status, values });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {isFull && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          This session is full. You can still register — you'll join the <strong>waitlist</strong>{' '}
          and be promoted automatically if a spot opens.
        </div>
      )}

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface/90 p-4 shadow-sm backdrop-blur-sm">
        <legend className="headline px-2 text-lg">Your details</legend>
        <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" className="mt-1" autoComplete="name" {...register('full_name')} />
          <FieldError message={errors.full_name?.message} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" className="mt-1" autoComplete="email" {...register('email')} />
          <FieldError message={errors.email?.message} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface/90 p-4 shadow-sm backdrop-blur-sm">
        <legend className="headline px-2 text-lg">On the pitch</legend>
        <div>
          <Label>Where do you play?</Label>
          <div className="mt-2">
            <PitchPositionPicker
              value={position}
              onChange={(p) => setValue('preferred_position', p)}
            />
          </div>
        </div>

        <div>
          <Label>Skill level</Label>
          <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Skill level">
            {SKILL_OPTIONS.map((opt) => {
              const selected = skill === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue('skill_level', opt.value, { shouldValidate: true })}
                  className={cn(
                    'flex flex-col items-center rounded-lg border px-2 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    selected
                      ? 'scale-[1.03] border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-surface hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  <span className={cn('text-base leading-none', selected ? 'text-accent' : 'text-amber-500')}>
                    {opt.stars}
                  </span>
                  <span className="mt-1 text-sm font-bold">{opt.label}</span>
                  <span className={cn('text-[11px]', selected ? 'text-white/80' : 'text-muted-foreground')}>
                    {opt.blurb}
                  </span>
                </button>
              );
            })}
          </div>
          <FieldError message={errors.skill_level?.message} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface/90 p-4 shadow-sm backdrop-blur-sm">
        <legend className="headline px-2 text-lg">Squad &amp; notes</legend>
        <div>
          <Label htmlFor="teammate_requests">Squad requests 🤝 (optional)</Label>
          <Textarea
            id="teammate_requests"
            className="mt-1"
            rows={2}
            placeholder="e.g. Put me with Messi and Ronaldo"
            {...register('teammate_requests')}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Want to play alongside (or against!) someone? Tell the organizer — final teams are
            their call.
          </p>
          <FieldError message={errors.teammate_requests?.message} />
        </div>

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" className="mt-1" rows={2} {...register('notes')} />
          <FieldError message={errors.notes?.message} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface/90 p-4 shadow-sm backdrop-blur-sm">
        <legend className="headline px-2 text-lg">
          Payment{session.fee_amount > 0 ? ` — ₱${session.fee_amount}` : ''}
        </legend>
        <div>
          <Label htmlFor="method">Method</Label>
          <Select id="method" className="mt-1" {...register('method')}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === 'gcash' ? 'GCash' : m === 'maya' ? 'Maya' : m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </Select>
        </div>
        {method !== 'cash' && (
          <div>
            <Label htmlFor="proof">Proof of payment (screenshot, up to 5 MB)</Label>
            <Input
              id="proof"
              type="file"
              accept={PROOF_MIME_TYPES.join(',')}
              className="mt-1"
              onChange={handleProofChange}
            />
            <FieldError message={proofError} />
          </div>
        )}
      </fieldset>

      {serverError && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? 'Submitting…' : isFull ? 'Join waitlist' : 'Register'}
      </Button>
    </form>
  );
}
