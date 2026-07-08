import { z } from 'zod';

export const registrationSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address').max(254),
  preferred_position: z.enum(['GK', 'DEF', 'MID', 'FWD', 'ANY']),
  skill_level: z.enum(['beginner', 'intermediate', 'advanced'], {
    errorMap: () => ({ message: 'Pick your skill level' }),
  }),
  teammate_requests: z.string().trim().max(300, 'Keep requests under 300 characters').optional(),
  notes: z.string().trim().max(500, 'Notes are too long').optional(),
  method: z.enum(['gcash', 'maya', 'bank', 'cash', 'other']),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const sessionSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().trim().max(2000).optional(),
  date: z.string().min(1, 'Date is required'),
  location: z.string().trim().min(2, 'Location is required').max(200),
  format: z.enum(['5-a-side', '7-a-side', '11-a-side', 'custom']),
  players_per_team: z.coerce.number().int().min(7, 'Minimum is 7').max(11, 'Maximum is 11'),
  team_count: z.coerce.number().int().min(2, 'At least 2 teams').max(12, 'At most 12 teams'),
  fee_amount: z.coerce.number().min(0, 'Fee cannot be negative'),
});

export type SessionInput = z.infer<typeof sessionSchema>;

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
