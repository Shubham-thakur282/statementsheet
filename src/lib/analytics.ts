/** Privacy-friendly, cookie-less event counting via GoatCounter when configured. Never sends file contents. */
type GC = { count: (o: { path: string; title?: string; event: boolean }) => void };

export function track(event: string): void {
  try {
    const gc = (window as unknown as { goatcounter?: GC }).goatcounter;
    gc?.count({ path: event, title: event, event: true });
  } catch {
    /* analytics must never break the app */
  }
}
