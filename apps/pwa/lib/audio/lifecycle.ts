/**
 * Hands-free conversation lifecycle glue.
 *
 * The mic + AudioContext + WebSocket stack is sensitive to browser/OS
 * events that aren't part of React's lifecycle:
 *
 *   - Headset plug/unplug            → MediaStream tracks die silently
 *   - Tab hidden (visibilitychange)  → iOS suspends the AudioContext
 *   - Incoming call on iOS           → AudioContext goes 'suspended'
 *   - Page navigation (pagehide)     → we need a clean WS close
 *
 * This module centralises the listeners and exposes a single `attach()`
 * that returns a teardown callback — the owning component just calls it in
 * its `useEffect` cleanup. No state machine of our own; we delegate the
 * actual "end session" work back to the caller's `onEndSession` handler.
 */

export type LifecycleHandlers = {
  /** Called when the active mic device becomes invalid (e.g. headset unplugged) */
  onDeviceChange?: () => void;
  /** Called when the tab is hidden/backgrounded — caller should stop mic to release hardware */
  onHidden?: () => void;
  /** Called when the tab is re-shown — caller may prompt the user to re-tap */
  onVisible?: () => void;
  /** Called when the page is about to unload — last chance to close the WS cleanly */
  onUnload?: () => void;
  /** Called when an AudioContext we're watching drops to 'suspended' */
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

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      handlers.onHidden?.();
    } else if (document.visibilityState === 'visible') {
      handlers.onVisible?.();
    }
  };

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

  document.addEventListener('visibilitychange', onVisibility);
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
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    if (navigator.mediaDevices && 'removeEventListener' in navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    }
    for (const [ctx, handler] of ctxListeners) {
      ctx.removeEventListener('statechange', handler);
    }
  };
}
