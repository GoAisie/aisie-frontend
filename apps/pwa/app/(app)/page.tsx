import { ConversationView } from '@/components/ConversationView';

export default function VoiceTabPage() {
  return (
    <section className="flex min-h-[calc(100dvh-64px)] flex-col items-center justify-center px-6 pb-12">
      <h1 className="mb-8 text-[22px] font-bold tracking-tight text-foreground">
        Sesli Asistan
      </h1>
      <ConversationView />
    </section>
  );
}
