'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

type Turn = {
  role: 'user' | 'assistant' | 'function';
  content: string;
  tool_calls: ToolCall[] | null;
  name: string | null;
  tool_call_id: string | null;
  timestamp: string;
};

type ConversationDetail = {
  conversation_id: string;
  user_id: string;
  user_name: string;
  company_id: string;
  company_name: string;
  created_at: string;
  updated_at: string;
  report_ids: string[];
  pipeline_complete: boolean;
  // Backend already filters out role="function" turns; this client should
  // still defend (renderer skips function-role just in case).
  turns: Turn[];
};

export default function AdminConversationDetailPage() {
  const params = useParams();
  const conversationId = String(params.id);

  const { data, isLoading, isError, refetch } = useQuery<ConversationDetail>({
    queryKey: ['admin-conversation-detail', conversationId],
    queryFn: () => apiFetch<ConversationDetail>(`/api/v1/manage/conversations/${conversationId}`),
  });

  return (
    <section>
      <header style={{ marginBottom: 20 }}>
        <Link href="/conversations" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none' }}>
          ← Konuşma Geçmişleri
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '8px 0 0' }}>Konuşma Detayı</h1>
      </header>

      {isError && (
        <p style={{ color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
          Konuşma yüklenemedi.
          <button type="button" onClick={() => refetch()} style={{ marginLeft: 8, ...ghostBtnStyle }}>
            Tekrar Dene
          </button>
        </p>
      )}

      {isLoading && <p style={{ color: '#6b6b74' }}>Yükleniyor…</p>}

      {data && (
        <>
          <div style={metaCardStyle}>
            <MetaRow label="Kullanıcı" value={data.user_name} />
            <MetaRow label="Başlangıç" value={formatDateTime(data.created_at)} />
            <MetaRow label="Son Güncelleme" value={formatDateTime(data.updated_at)} />
            <MetaRow label="Rapor Sayısı" value={String(data.report_ids.length)} />
            <MetaRow
              label="Durum"
              value={data.pipeline_complete ? 'Tamamlandı' : 'Devam ediyor'}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.turns.length === 0 && (
              <p style={{ color: '#6b6b74', fontSize: 13 }}>Bu konuşmada görüntülenecek mesaj yok.</p>
            )}
            {data.turns
              // Defense-in-depth: backend already filters role=function, but
              // re-filter here in case schema drifts.
              .filter((t) => t.role !== 'function')
              .map((turn, idx) => (
                <TurnBubble key={`${turn.timestamp}-${idx}`} turn={turn} />
              ))}
          </div>
        </>
      )}
    </section>
  );
}

function TurnBubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div style={{ ...bubbleLabelStyle, color: isUser ? '#0369a1' : '#7c3aed' }}>
        {isUser ? 'Kullanıcı' : 'AI Asistan'}
        <span style={{ marginLeft: 8, color: '#9ca3af', fontWeight: 400 }}>
          {formatDateTime(turn.timestamp)}
        </span>
      </div>
      <div
        style={{
          ...bubbleStyle,
          background: isUser ? '#eff6ff' : '#f5f3ff',
          borderColor: isUser ? '#bfdbfe' : '#ddd6fe',
        }}
      >
        {turn.content ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{turn.content}</p>
        ) : (
          <p style={{ margin: 0, fontStyle: 'italic', color: '#9ca3af', fontSize: 13 }}>
            (Mesaj içeriği yok — yalnızca tool çağrısı)
          </p>
        )}

        {turn.tool_calls && turn.tool_calls.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {turn.tool_calls.map((tc) => (
              <ToolCallBlock key={tc.id} call={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCallBlock({ call }: { call: ToolCall }) {
  return (
    <div style={toolCallStyle}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b21a8', marginBottom: 4 }}>
        🔧 {call.name}
      </div>
      <pre
        style={{
          margin: 0,
          fontSize: 11,
          color: '#4b5563',
          fontFamily: 'ui-monospace, monospace',
          background: '#fafaf9',
          padding: 6,
          borderRadius: 4,
          overflow: 'auto',
        }}
      >
        {JSON.stringify(call.arguments, null, 2)}
      </pre>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
      <span style={{ color: '#6b6b74', minWidth: 130 }}>{label}</span>
      <span style={{ color: '#0b0b0f', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const metaCardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const bubbleLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
};
const bubbleStyle: React.CSSProperties = {
  maxWidth: '78%',
  padding: '10px 14px',
  border: '1px solid',
  borderRadius: 12,
  fontSize: 14,
  color: '#1f2937',
};
const toolCallStyle: React.CSSProperties = {
  border: '1px dashed #c4b5fd',
  borderRadius: 8,
  padding: 8,
  background: '#fff',
};
const ghostBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#6b6b74',
  border: 'none',
  padding: '4px 8px',
  fontSize: 12,
  cursor: 'pointer',
};
