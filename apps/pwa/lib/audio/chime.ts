// Brief two-tone chime played whenever the conversation enters a paused state.
// Uses a short-lived AudioContext so it does not interfere with the playback /
// capture contexts the conversation pipeline owns. iOS Safari requires the
// AudioContext be created inside a user-gesture handler — this helper is only
// called from event-driven handlers (button taps, lifecycle suspended, idle
// timer fires) that originate from a user gesture earlier in the session, so
// it works on iOS as long as the page has had at least one user interaction.
//
// All errors are swallowed: an inability to play a chime is never a reason to
// fail a pause. The pause itself is the load-bearing UX signal; the chime is
// a polish on top.

export function playPauseChime(): void {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    const playTone = (freq: number, startOffset: number, duration: number) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, ctx.currentTime + startOffset);
      env.gain.linearRampToValueAtTime(1, ctx.currentTime + startOffset + 0.02);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + startOffset + duration);
      osc.connect(env).connect(master);
      osc.start(ctx.currentTime + startOffset);
      osc.stop(ctx.currentTime + startOffset + duration + 0.01);
    };

    // Two falling sine tones — distinct enough to recognize as "session paused"
    // without overlapping the speech frequency band that the user might still
    // be in the middle of. 800 → 600 Hz over ~0.32 s total.
    playTone(800, 0, 0.16);
    playTone(600, 0.18, 0.18);

    // Tear the context down a bit after the second tone so the AudioContext
    // budget on iOS (max ~6 simultaneous contexts) does not accumulate.
    setTimeout(() => {
      ctx.close().catch(() => undefined);
    }, 800);
  } catch {
    // Best-effort. If the browser refuses (suspended context, no permission,
    // headless environment) the pause still works — only the audio cue is missed.
  }
}
