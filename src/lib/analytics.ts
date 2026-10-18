/**
 * Analytics stub (no vendor at MVP). Event names from spec section 14.
 * Never pass health values: coarse, non-identifying props only.
 */
export type AnalyticsEvent =
  | 'onboarding_step_viewed'
  | 'onboarding_completed'
  | 'paywall_viewed'
  | 'paywall_plan_selected'
  | 'trial_started'
  | 'purchase_completed'
  | 'purchase_failed'
  | 'restore_completed'
  | 'fast_started'
  | 'fast_ended'
  | 'fast_edited'
  | 'reminder_permission'
  | 'notification_opened'
  | 'share_card_shared'
  | 'export_csv'
  | 'pro_gate_hit';

export type AnalyticsProps = Record<string, string | number | boolean | null | undefined>;

export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, props ?? {});
  }
}
