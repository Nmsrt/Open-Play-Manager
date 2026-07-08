-- Phone number is no longer collected on the public form.
-- The format check constraint still applies when a value IS provided
-- (a NULL check result passes in Postgres).
alter table public.players alter column phone drop not null;
