import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Map a free-text bib/pinnie tag ("Red Bibs", "blue") to a swatch color so
// teams get a visual identity everywhere without a dedicated color column.
const TAG_COLORS: Array<[RegExp, string]> = [
  [/red|maroon/i, '#dc2626'],
  [/blue|navy/i, '#2563eb'],
  [/yellow|gold/i, '#eab308'],
  [/green/i, '#16a34a'],
  [/orange/i, '#ea580c'],
  [/purple|violet/i, '#7c3aed'],
  [/pink/i, '#db2777'],
  [/black|dark/i, '#111827'],
  [/white/i, '#d6d3d1'],
  [/gr[ae]y/i, '#6b7280'],
];

export function bibColor(tag: string | null | undefined): string | null {
  if (!tag) return null;
  for (const [re, color] of TAG_COLORS) if (re.test(tag)) return color;
  return null;
}

// Venue cover photos, matched against the free-text session location.
// Drop the image in public/covers/ and add a pattern here.
const LOCATION_COVERS: Array<[RegExp, string]> = [[/parqal/i, '/covers/parqal.jpg']];

export function locationCover(location: string | null | undefined): string | null {
  if (!location) return null;
  for (const [re, src] of LOCATION_COVERS) if (re.test(location)) return src;
  return null;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
