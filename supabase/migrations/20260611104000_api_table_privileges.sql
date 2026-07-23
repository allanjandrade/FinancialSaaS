-- Raw SQL tables need explicit API privileges in addition to RLS policies.
-- Keep anon blocked and grant authenticated only the operations covered by RLS.

revoke all privileges on table
  public.products,
  public.stores,
  public.price_records,
  public.user_tracked_products,
  public.price_alerts,
  public.financial_documents,
  public.financial_events,
  public.knowledge_documents,
  public.knowledge_chunks,
  public.connector_accounts,
  public.connector_sync_runs,
  public.connector_events
from anon;

grant select, insert on table
  public.products,
  public.stores,
  public.price_records
to authenticated;

grant select, insert, update, delete on table
  public.user_tracked_products,
  public.price_alerts,
  public.financial_documents,
  public.knowledge_documents,
  public.knowledge_chunks,
  public.connector_accounts
to authenticated;

grant select, insert, update on table
  public.financial_events,
  public.connector_sync_runs,
  public.connector_events
to authenticated;

grant select, insert, update, delete on table
  public.products,
  public.stores,
  public.price_records,
  public.user_tracked_products,
  public.price_alerts,
  public.financial_documents,
  public.financial_events,
  public.knowledge_documents,
  public.knowledge_chunks,
  public.connector_accounts,
  public.connector_sync_runs,
  public.connector_events
to service_role;
