grant select, insert, update, delete on
  public.billing_customers,
  public.billing_subscriptions,
  public.billing_events,
  public.feature_entitlements,
  public.usage_metering,
  public.admin_users,
  public.beta_testers,
  public.tester_invites,
  public.feature_flags,
  public.user_feature_overrides,
  public.admin_audit_logs,
  public.tester_feedback
to service_role;

grant select on
  public.billing_subscriptions,
  public.feature_entitlements,
  public.usage_metering,
  public.beta_testers,
  public.feature_flags,
  public.user_feature_overrides
to authenticated;

grant insert, select on public.tester_feedback to authenticated;
