import type { WsServerMessage } from '@aisie/shared';
import { env } from '@/lib/env';
import { MockConversationClient } from './mock-conversation-client';
import { RealConversationClient } from './real-conversation-client';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'closed' | 'error';

export type ConversationClientOptions = {
  onMessage: (msg: WsServerMessage) => void;
  onAudio: (pcm: Int16Array, sampleRate: number) => void;
  onState: (state: ConnectionState) => void;
  onError: (err: Error) => void;
  // Fires when the pong watchdog detects no response from the backend within the
  // grace window after a ping. The caller treats this as a transport-level network
  // loss event distinct from a clean WS close.
  onNetworkLoss?: () => void;
  // Fires when the backend sends `{"type":"session_evicted"}` because another
  // device opened the same conversation_id. The caller should NOT auto-resume.
  onEvicted?: (reason: string) => void;
  // Fires when the backend sends `{"type":"resume_failed"}` after the client
  // tried to reconnect with a stale or invalid conversation_id. The caller should
  // clear the persisted conversation_id and start a fresh session.
  onResumeFailed?: (reason: string) => void;
  // Fires once when the backend sends `{"type":"ready"}` — i.e. session.initialize
  // (which now includes Soniox prewarm) has completed. The caller should hold
  // mic.start() and the listening-mode flip until this callback fires so the user
  // does not start speaking before the backend can transcribe.
  onReady?: () => void;
};

// Protocol is defined in @aisie/shared/types/ws and is identical between
// the mock and the real streaming session in report-service. Clients push
// PCM frames as binary, control messages as JSON; the server pushes JSON
// events and raw PCM chunks back.
export interface ConversationClient {
  // `conversationId` is the resume hint. When provided, the backend looks up the
  // existing Conversation document and rehydrates LangChain history from it; on
  // failure (not found, ownership mismatch, closed, legacy) the backend emits a
  // `resume_failed` event and the session falls through to a fresh start.
  connect(conversationId?: string): Promise<void>;
  disconnect(): Promise<void>;
  sendPcm(frame: Int16Array): void;
  sendSpeechStart(): void;
  sendEndOfUtterance(): void;
  sendBargeIn(): void;
  sendReplayLast(): void;
  // Tells the backend "I'm done with this conversation, run post-correction +
  // email now". Without this signal the WS-close path skips finalization and
  // leaves the cleanup cron to handle it after 1h. Called from the explicit
  // close button in the paused UI; pause itself does NOT send this.
  sendCloseSession(): void;
}

// Default: talk to the real backend. `NEXT_PUBLIC_USE_MOCK_BACKEND=1` in
// .env.local flips in the canned-conversation mock for UI-only demos.
export function createConversationClient(
  opts: ConversationClientOptions,
): ConversationClient {
  if (env.useMockBackend) {
    return new MockConversationClient(opts);
  }
  return new RealConversationClient(opts);
}
