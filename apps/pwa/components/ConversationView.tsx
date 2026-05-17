'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MicButton, type MicButtonMode } from '@/components/MicButton';
import { env } from '@/lib/env';
import { cn } from '@/lib/utils';
import {
  type HistoryEntry,
  useConversationStore,
} from '@/lib/conversation/conversation-store';

// Presentational shell. All session state, audio resource lifecycle, and WS
// callback wiring live in `useConversationStore`. This component subscribes
// to the slices it needs and dispatches store actions on user interaction.
// The store is a module-level singleton so WS + mic + playback survive
// Next.js App Router page transitions.
export function ConversationView() {
  const mode = useConversationStore((s) => s.mode);
  const rms = useConversationStore((s) => s.rms);
  const partial = useConversationStore((s) => s.partial);
  const final = useConversationStore((s) => s.final);
  const assistantText = useConversationStore((s) => s.assistantText);
  const error = useConversationStore((s) => s.error);
  const history = useConversationStore((s) => s.history);

  const [insecureHost, setInsecureHost] = useState<string | null>(null);

  // Browsers refuse getUserMedia on non-secure origins. During dev this
  // bites anyone hitting the LAN IP instead of localhost.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.isSecureContext) return;
    setInsecureHost(window.location.host);
  }, []);

  const onClick = useCallback(() => {
    const store = useConversationStore.getState();
    // Single mic button is overloaded with three semantics keyed off mode:
    //   idle/error → start a fresh session   (HAPTIC — session start)
    //   paused     → resume the existing session   (no haptic)
    //   active     → pause the current session   (no haptic)
    // Haptic only on session-START moments per user feedback — buzz on every
    // pause/resume click is rattling. Android Chrome/Firefox/Samsung Internet
    // honour navigator.vibrate; iOS Safari rejects the Vibration API.
    if (mode === 'idle' || mode === 'error') {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(15);
      }
      void store.resumeSession();
    } else if (mode === 'paused') {
      void store.resumeSession();
    } else {
      void store.pauseSession('manual');
    }
  }, [mode]);

  const onClose = useCallback(() => {
    // HAPTIC — explicit session end is the user committing to "I'm done";
    // matching feedback to start-session buzz.
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
    void useConversationStore.getState().endSession();
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      {insecureHost && (
        <Alert
          role="status"
          className="max-w-[420px] border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-foreground)]"
        >
          <AlertTitle className="text-[var(--color-warning-foreground)]">
            Güvensiz bağlantı.
          </AlertTitle>
          <AlertDescription className="text-[var(--color-warning-foreground)]">
            Tarayıcılar mikrofonu yalnızca{' '}
            <code className="mx-1 font-mono">https://</code> veya{' '}
            <code className="mx-1 font-mono">localhost</code> üzerinden açar.
            Şu anki adres: <code className="font-mono">{insecureHost}</code> —
            yerine <code className="font-mono">localhost:3000</code> üzerinden açın.
          </AlertDescription>
        </Alert>
      )}

      <MicButton mode={mode} rms={rms} onClick={onClick} />

      {mode === 'paused' && (
        <Button variant="destructive" onClick={onClose} className="-mt-1">
          Konuşmayı Kapat
        </Button>
      )}

      <p className="m-0 mt-2 min-h-[22px] text-[15px] text-muted-foreground">
        {statusMessage(mode)}
      </p>

      {error && (
        <div
          role="alert"
          className="m-0 max-w-[320px] text-center text-[13px] text-destructive"
        >
          <p className="m-0">{error}</p>
          {/* Mic permission errors are the only path where the user is
              expected to take action OUTSIDE the app. friendlyError
              normalises NotAllowedError + NotReadableError to messages
              starting with "Mikrofon", so a single prefix check covers
              both. We use a textual hint instead of a chrome://settings
              link because chrome:// URLs are blocked from web pages on
              every modern Chrome build. */}
          {error.startsWith('Mikrofon') && (
            <p className="mt-1.5 text-[13px] text-destructive/85">
              İzin vermek için adres çubuğundaki kilit simgesine dokunun veya{' '}
              <strong>Ayarlar → Uygulamalar → Chrome → İzinler → Mikrofon</strong>{' '}
              yolundan açın.
            </p>
          )}
        </div>
      )}

      {/* Transcript + history panels disabled per user feedback 2026-05-17.
          Restore by uncommenting the JSX below AND uncommenting the function
          declarations at the bottom of this file. NEXT_PUBLIC_SHOW_TRANSCRIPT=1
          still gates them — the env flag remains the runtime switch.

      <AnimatePresence>
        {env.showTranscript && (partial || final || assistantText) && (
          <motion.div
            key="transcript"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-[420px]"
          >
            <TranscriptPanel
              partial={partial}
              final={final}
              assistantText={assistantText}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {env.showTranscript && history.length > 0 && <HistoryPanel entries={history} />}
      */}
    </div>
  );
}

function statusMessage(mode: MicButtonMode): string {
  switch (mode) {
    case 'idle':
      return 'Başlatmak için dokunun';
    case 'connecting':
      return 'Bağlanıyor…';
    case 'listening':
      return 'Sizi dinliyorum';
    case 'user-speaking':
      return 'Konuşuyorsunuz';
    case 'processing':
      return 'Düşünüyorum…';
    case 'assistant-speaking':
      return 'Yanıtlıyor — sözünü kesmek için konuşun';
    case 'paused':
      return 'Duraklatıldı — devam etmek için dokunun';
    case 'error':
      return 'Bir sorun oluştu';
  }
}

/* Transcript + history function bodies — disabled per user feedback
   2026-05-17. Restore by uncommenting this block AND the JSX usage above.

function TranscriptPanel({
  partial,
  final,
  assistantText,
}: {
  partial: string;
  final: string;
  assistantText: string;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      {(partial || final) && (
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="m-0 text-[11px] uppercase tracking-[0.5px] text-brand-600">
            Siz
          </p>
          <p className="m-0 mt-1 text-[15px] leading-relaxed text-foreground">
            {partial ? (
              <span className="italic text-brand-400">{partial}</span>
            ) : (
              final
            )}
          </p>
        </div>
      )}

      {assistantText && (
        <div className="rounded-xl border border-border bg-card px-3.5 py-3">
          <p className="m-0 text-[11px] uppercase tracking-[0.5px] text-assistant-600">
            Asistan
          </p>
          <p className="m-0 mt-1 text-[15px] leading-relaxed text-foreground">
            {assistantText}
          </p>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ entries }: { entries: HistoryEntry[] }) {
  return (
    <details className="mt-2 w-full max-w-[420px]">
      <summary className="cursor-pointer text-[13px] text-muted-foreground">
        Bu oturum geçmişi ({entries.length})
      </summary>
      <ol className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
        {entries.map((e, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-surface-subtle px-3 py-2.5 text-[13px]"
          >
            <div>
              <strong className="text-brand-600">Siz:</strong>{' '}
              <span className="text-foreground">{e.user || '—'}</span>
            </div>
            <div className="mt-1">
              <strong className="text-assistant-600">Asistan:</strong>{' '}
              <span className="text-foreground">{e.assistant || '—'}</span>
            </div>
          </li>
        ))}
      </ol>
    </details>
  );
}

*/
