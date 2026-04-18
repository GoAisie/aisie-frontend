import { ConversationView } from '@/components/ConversationView';

export default function VoiceTabPage() {
  return (
    <section style={{ padding: '32px 24px 48px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#0b0b0f' }}>
        Sesli Asistan
      </h1>
      <p style={{ marginTop: 8, marginBottom: 36, color: '#6b6b74', fontSize: 14 }}>
        Rapor doldurmak için mikrofona dokunun. Sözünü kesmek için konuşmaya başlayın.
      </p>
      <ConversationView />
    </section>
  );
}
