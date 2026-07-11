-- Free sessions (fee_amount = 0) were rejected: payments.amount required > 0,
-- but register_player() inserts coalesce(p_amount, session.fee_amount), which
-- is 0 for a free session. Every registration on a free session failed with a
-- check-constraint violation (surfaced to the client as HTTP 400).
alter table public.payments drop constraint payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount >= 0);
