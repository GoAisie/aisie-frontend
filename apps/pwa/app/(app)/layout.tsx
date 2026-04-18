import { BottomTabs } from '@/components/BottomTabs';
import { IosInstallPrompt } from '@/components/IosInstallPrompt';

// Tab bar is fixed 64px + safe-area bottom inset. Reserve that space so
// content isn't occluded by the bar.
const TAB_BAR_HEIGHT = 64;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        paddingBottom: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
      }}
    >
      <main>{children}</main>
      <BottomTabs />
      <IosInstallPrompt />
    </div>
  );
}
