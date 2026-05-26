import { ConversationView } from '@/components/ConversationView';

export default function VoiceTabPage() {
  return (
    <section
      className="fixed inset-x-0 flex touch-none flex-col items-center justify-center overflow-hidden px-6"
      style={{
        top: 'env(safe-area-inset-top)',
        bottom: 'calc(64px + env(safe-area-inset-bottom))',
      }}
    >
      <h1 className="mb-6 pt-14 text-[22px] font-bold tracking-tight text-foreground">
        Sesli Asistan
      </h1>
      <ConversationView />
    </section>
  );
}
