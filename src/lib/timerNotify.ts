/**
 * Fire-and-forget notification reschedule. The notifications module is owned by another
 * agent; a missing module or a thrown error must never crash the timer.
 */
export function rescheduleNotifications(): void {
  try {
    // @ts-ignore module may not exist yet
    import('../services/notifications')
      .then((m: { rescheduleAll?: () => unknown }) => m.rescheduleAll?.())
      .catch(() => {});
  } catch {
    /* ignore */
  }
}
