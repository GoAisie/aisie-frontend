'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Five bottom-tab routes. `voice` is the center FAB — visually elevated,
// landing page when the user opens the app. Route paths are English;
// UI labels are Turkish per `CLAUDE.md` / plan convention.
const TABS = [
  { href: '/reports', label: 'Raporlar', icon: IconReports, center: false },
  { href: '/customers', label: 'Müşteriler', icon: IconCustomers, center: false },
  { href: '/', label: 'Konuş', icon: IconMic, center: true },
  { href: '/calendar', label: 'Ajanda', icon: IconCalendar, center: false },
  { href: '/analytics', label: 'Analiz', icon: IconAnalytics, center: false },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Ana navigasyon"
      style={{
        position: 'fixed',
        insetInline: 0,
        bottom: 0,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'var(--tab-bar-bg, #ffffff)',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        height: 64,
        zIndex: 50,
      }}
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              color: isActive ? '#7c3aed' : '#6b6b74',
              fontSize: 11,
              textDecoration: 'none',
              position: 'relative',
            }}
          >
            {tab.center ? (
              <span
                style={{
                  position: 'absolute',
                  top: -20,
                  width: 56,
                  height: 56,
                  borderRadius: 9999,
                  background: '#7c3aed',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 6px 16px rgba(124,58,237,0.35)',
                }}
              >
                <tab.icon active size={24} color="#fff" />
              </span>
            ) : (
              <tab.icon active={isActive} size={22} />
            )}
            <span style={{ marginTop: tab.center ? 36 : 0 }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Inline SVG icons — no lucide-react dependency needed for the five tabs.
// Keeps bundle lean; can swap for a proper icon lib later if the design grows.

type IconProps = { active?: boolean; size?: number; color?: string };

function IconReports({ size = 22, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function IconCustomers({ size = 22, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMic({ size = 22, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function IconCalendar({ size = 22, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconAnalytics({ size = 22, color }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
