-- Release 11.4 hotfix: allow any product URL to become a locked identity.
-- Amazon and Mercado Livre keep strong marketplace IDs; other stores use a
-- deterministic canonical URL hash as source_product_id.

alter table public.product_identities
  drop constraint if exists product_identities_source_check;
