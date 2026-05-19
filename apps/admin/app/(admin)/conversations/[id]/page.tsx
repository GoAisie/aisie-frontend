'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { BackLink } from '@/components/ui/back-link';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
  // Backend already filters out role="function" turns; this client still
  // defends (renderer skips function-role just in case schema drifts).
  turns: Turn[];
};

export default function AdminConversationDetailPage() {
  const params = useParams();
  const conversationId = String(params.id);

  const { data, isLoading, isError, refetch } = useQuery<ConversationDetail>({
    queryKey: ['admin-conversation-detail', conversationId],
    queryFn: () =>
      apiFetch<ConversationDetail>(
        `/api/v1/manage/conversations/${conversationId}`,
      ),
  });

  return (
    <section>
      <BackLink href="/conversations" label="Konuşma Geçmişleri" />
      <PageHeader title="Konuşma Detayı" />

      {isError && (
        <p className="m-0 mb-4 text-[14px] text-destructive">
          Konuşma yüklenemedi.
          <Button variant="ghost" size="xs" onClick={() => refetch()} className="ml-2">
            Tekrar Dene
          </Button>
        </p>
      )}

      {isLoading && (
        <p className="m-0 text-[14px] text-muted-foreground">Yükleniyor…</p>
      )}

      {data && (
        <>
          <div className="mb-6 grid gap-2 rounded-xl border border-border/60 bg-card p-4 shadow-sm md:grid-cols-2">
            <MetaRow label="Kullanıcı" value={data.user_name} />
            <MetaRow label="Başlangıç" value={formatDateTime(data.created_at)} />
            <MetaRow label="Son Güncelleme" value={formatDateTime(data.updated_at)} />
            <MetaRow label="Rapor Sayısı" value={String(data.report_ids.length)} />
            <MetaRow
              label="Durum"
              value={data.pipeline_complete ? 'Tamamlandı' : 'Devam ediyor'}
            />
          </div>

          <div className="flex flex-col gap-3">
            {data.turns.length === 0 && (
              <p className="m-0 text-[13px] text-muted-foreground">
                Bu konuşmada görüntülenecek mesaj yok.
              </p>
            )}
            {data.turns
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
      className={
        isUser
          ? 'flex flex-col items-end'
          : 'flex flex-col items-start'
      }
    >
      <div
        className={
          isUser
            ? 'mb-1 text-[12px] font-semibold text-assistant-600'
            : 'mb-1 text-[12px] font-semibold text-brand-600'
        }
      >
        {isUser ? 'Kullanıcı' : 'AI Asistan'}
        <span className="ml-2 font-normal text-muted-foreground/80">
          {formatDateTime(turn.timestamp)}
        </span>
      </div>
      <div
        className={
          isUser
            ? 'max-w-[78%] rounded-2xl border border-assistant-500/30 bg-assistant-500/10 px-4 py-2.5 text-[14px] text-foreground dark:bg-assistant-500/15'
            : 'max-w-[78%] rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-[14px] text-foreground dark:border-brand-800 dark:bg-brand-900/40'
        }
      >
        {turn.content ? (
          <p className="m-0 whitespace-pre-wrap leading-relaxed">{turn.content}</p>
        ) : (
          <p className="m-0 text-[13px] italic text-muted-foreground">
            (Mesaj içeriği yok — yalnızca tool çağrısı)
          </p>
        )}

        {turn.tool_calls && turn.tool_calls.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
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
    <div className="rounded-md border border-dashed border-brand-300 bg-card p-2 dark:border-brand-700">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
        <Wrench className="size-3" aria-hidden />
        {call.name}
      </div>
      <pre className="m-0 overflow-auto rounded bg-muted/50 p-1.5 font-mono text-[11px] text-foreground/70">
        {JSON.stringify(call.arguments, null, 2)}
      </pre>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="min-w-[130px] text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="font-normal">
        {value}
      </Badge>
    </div>
  );
}
