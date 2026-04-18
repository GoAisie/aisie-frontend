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
};

// Protocol is defined in @aisie/shared/types/ws and is identical between
// the mock and the real streaming session in report-service. Clients push
// PCM frames as binary, control messages as JSON; the server pushes JSON
// events and raw PCM chunks back.
export interface ConversationClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendPcm(frame: Int16Array): void;
  sendEndOfUtterance(): void;
  sendBargeIn(): void;
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
