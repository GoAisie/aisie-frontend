/**
 * Hands-free conversation lifecycle glue.
 *
 * The mic + AudioContext + WebSocket stack is sensitive to browser/OS
 * events that aren't part of React's lifecycle:
 *
 *   - Headset plug/unplug            → MediaStream tracks die silently
 *   - Incoming call on iOS           → AudioContext goes 'suspended'
 *   - Page navigation (pagehide)     → we need a clean WS close
 *
 * Note: `visibilitychange → hidden` (tab backgrounded, screen lock) is NOT
 * mapped to any action by design. With the WS pause/resume feature, leaving
 * the conversation in 'listening' while the page is hidden is safe — the
 * 60s idle timer in ConversationView fires auto-pause when the user does
 * not return, and the browser's own background-throttling stops mic frame
 * delivery in the meantime. Catching `hidden` here would create a redundant
 * pause path with subtly different timing than the idle timer.
 */

export type LifecycleHandlers = {
  /** Called when the active mic device becomes invalid (e.g. headset unplugged) */
  onDeviceChange?: () => void;
  /** Called when the page is about to unload — last chance to close the WS cleanly */
  onUnload?: () => void;
  /** Called when an AudioContext we're watching drops to 'suspended' (iOS phone call) */
  onAudioContextSuspended?: () => void;
};

/**
 * Attach all lifecycle handlers. Returns a teardown function — call it in
 * useEffect cleanup so React unmount doesn't leave dangling listeners.
 */
export function attachLifecycle(
  handlers: LifecycleHandlers,
  watchedContexts: AudioContext[] = [],
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const onPageHide = () => {
    handlers.onUnload?.();
  };

  const onDeviceChange = () => {
    handlers.onDeviceChange?.();
  };

  const onContextStateChange = (ctx: AudioContext) => () => {
    if (ctx.state === 'suspended') {
      handlers.onAudioContextSuspended?.();
    }
  };

  window.addEventListener('pagehide', onPageHide);

  // Headset / device routing changes. `mediaDevices` may be undefined on
  // insecure origins — guard so this doesn't throw.
  if (navigator.mediaDevices && 'addEventListener' in navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);
  }

  const ctxListeners: Array<[AudioContext, () => void]> = watchedContexts.map(
    (ctx) => {
      const handler = onContextStateChange(ctx);
      ctx.addEventListener('statechange', handler);
      return [ctx, handler];
    },
  );

  return () => {
    window.removeEventListener('pagehide', onPageHide);
    if (navigator.mediaDevices && 'removeEventListener' in navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    }
    for (const [ctx, handler] of ctxListeners) {
      ctx.removeEventListener('statechange', handler);
    }
  };
}
