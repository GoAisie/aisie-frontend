'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Two-state toggle: light ↔ dark only (no "system" — pilot decision because
// content pages aren't dark-mode-ready yet; following OS preference would
// surface broken-looking screens for users on dark-mode systems).
// Icon reflects the NEXT theme so the affordance reads as "switch to X".
export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes value is unavailable on server render — placeholder until
  // hydration to avoid mismatch.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="size-9 rounded-full border border-border bg-card shadow-sm"
        aria-hidden
      />
    );
  }

  const isDark = resolvedTheme === 'dark';
  const next = isDark ? 'light' : 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Açık temaya geç' : 'Koyu temaya geç';

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-9 items-center justify-center rounded-full',
        'border border-border bg-card text-foreground shadow-sm',
        'transition-all duration-150 hover:bg-muted active:scale-95',
      )}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
