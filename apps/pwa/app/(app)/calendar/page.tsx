import { CALENDAR_FIXTURE } from '@/lib/fixtures/calendar';
import type { CalendarEventKind } from '@/lib/fixtures/types';
import { formatUpcoming } from '@/lib/format';

export default function CalendarPage() {
  const events = CALENDAR_FIXTURE;

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Ajanda</h1>
        <p style={{ margin: '4px 0 0', color: '#6b6b74', fontSize: 13 }}>
          Yaklaşan {events.length} kayıt · örnek veri (Faz 2.5'te CalendarEvent API)
        </p>
      </header>

      <ul style={listStyle}>
        {events.map((e) => (
          <li key={e.id} style={cardStyle}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 12,
                marginBottom: 4,
              }}
            >
              <strong style={{ fontSize: 15, color: '#0b0b0f', flex: 1 }}>{e.title}</strong>
              <KindBadge kind={e.kind} />
            </div>
            <p style={{ margin: 0, color: '#7c3aed', fontSize: 13, fontWeight: 500 }}>
              {formatUpcoming(e.startAt)}
            </p>
            {e.note && (
              <p style={{ margin: '6px 0 0', color: '#6b6b74', fontSize: 13, lineHeight: 1.45 }}>
                {e.note}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function KindBadge({ kind }: { kind: CalendarEventKind }) {
  const palette: Record<
    CalendarEventKind,
    { label: string; bg: string; color: string }
  > = {
    'follow-up': { label: 'Takip', bg: '#fef3c7', color: '#92400e' },
    meeting: { label: 'Toplantı', bg: '#dbeafe', color: '#1e40af' },
    custom: { label: 'Özel', bg: '#ede9fe', color: '#5b21b6' },
  };
  const p = palette[kind];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        color: p.color,
        background: p.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {p.label}
    </span>
  );
}

const listStyle: React.CSSProperties = {
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const cardStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: '12px 14px',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 12,
};
