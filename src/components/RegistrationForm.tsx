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
import type { Session, Team, TeamPreferenceCount, PlayerStatus } from '@/lib/types';
import { POSITIONS, SKILL_LEVELS, PAYMENT_METHODS } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Props {
  session: Session;
  teams: Team[];
  prefCounts: TeamPreferenceCount[];
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

export default function RegistrationForm({ session, teams, prefCounts, isFull, onSuccess }: Props) {
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
    defaultValues: { preferred_position: 'ANY', method: 'gcash', preferred_team: '' },
  });

  const position = watch('preferred_position');
  const preferredTeam = watch('preferred_team');
  const method = watch('method');

  function countFor(teamId: string) {
    return prefCounts.find((c) => c.team_id === teamId)?.preference_count ?? 0;
  }

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
        p_phone: values.phone,
        p_preferred_position: values.preferred_position,
        p_skill_level: values.skill_level || null,
        p_notes: values.notes || null,
        p_preferred_team: values.preferred_team || null,
        p_amount: session.fee_amount > 0 ? session.fee_amount : null,
        p_method: values.method,
        p_reference_number: values.reference_number || null,
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

      <div className="space-y-4">
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
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" className="mt-1" autoComplete="tel" {...register('phone')} />
          <FieldError message={errors.phone?.message} />
        </div>

        <div>
          <Label>Preferred position (optional)</Label>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred position">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={position === p}
                onClick={() => setValue('preferred_position', p)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  position === p
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-surface hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="skill_level">Skill level (optional)</Label>
          <Select id="skill_level" className="mt-1" {...register('skill_level')}>
            <option value="">Prefer not to say</option>
            {SKILL_LEVELS.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
        </div>

        {teams.length > 0 && (
          <div>
            <Label>Team preference (optional — organizer may rebalance)</Label>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Team preference">
              <button
                type="button"
                role="radio"
                aria-checked={!preferredTeam}
                onClick={() => setValue('preferred_team', '')}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  !preferredTeam
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-surface hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                No preference
              </button>
              {teams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={preferredTeam === t.id}
                  onClick={() => setValue('preferred_team', t.id)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    preferredTeam === t.id
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-surface hover:border-primary/50 hover:bg-muted/50',
                  )}
                >
                  {t.name}
                  {t.color_tag ? ` (${t.color_tag})` : ''} · {countFor(t.id)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Textarea id="notes" className="mt-1" rows={2} {...register('notes')} />
          <FieldError message={errors.notes?.message} />
        </div>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-sm">
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
          <>
            <div>
              <Label htmlFor="reference_number">Reference number</Label>
              <Input
                id="reference_number"
                className="mt-1"
                placeholder="e.g. GCash ref no."
                {...register('reference_number')}
              />
              <FieldError message={errors.reference_number?.message} />
            </div>
            <div>
              <Label htmlFor="proof">Proof of payment (optional, image up to 5 MB)</Label>
              <Input
                id="proof"
                type="file"
                accept={PROOF_MIME_TYPES.join(',')}
                className="mt-1"
                onChange={handleProofChange}
              />
              <FieldError message={proofError} />
            </div>
          </>
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
