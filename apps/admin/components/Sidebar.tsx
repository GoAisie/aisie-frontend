'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageSquare,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { apiFetch } from '@/lib/api-client';
import { OrgPicker } from '@/components/OrgPicker';
import { ModeToggle } from '@/components/ModeToggle';
import { cn } from '@/lib/utils';

// Linear/Stripe-style sidebar. Active nav item is a soft brand-tinted pill
// (brand-50 bg + brand-700 text) — quiet, lets the main content area carry
// the visual weight. Picked over a saturated PWA-style variant after A/B
// comparison: admin is a long-session BI tool, sidebar should recede.
const NAV_ITEMS: Array<{
  href: string;
  label: string;
  Icon: LucideIcon;
  superAdminOnly?: boolean;
}> = [
  { href: '/dashboard', label: 'Özet', Icon: LayoutDashboard },
  { href: '/reports', label: 'Raporlar', Icon: FileText },
  { href: '/templates', label: 'Şablonlar', Icon: LayoutGrid },
  { href: '/customers', label: 'Müşteriler', Icon: Users },
  { href: '/users', label: 'Kullanıcılar', Icon: UserCog },
  { href: '/conversations', label: 'Konuşma Geçmişleri', Icon: MessageSquare },
  { href: '/companies', label: 'Şirketler', Icon: Building2, superAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const role = useSessionStore((s) => s.role);
  const clearSession = useSessionStore((s) => s.clearSession);
  const clearActingCompany = useActingCompanyStore((s) => s.setActingCompany);

  const logout = async () => {
    // Real logout: fire /auth/logout with the refresh token in body so
    // main-service revokes its jti server-side (K-1 fix). Failures are
    // non-fatal — local clear is still the user-facing source of truth.
    // Read refresh token BEFORE clearSession.
    //
    // skipAuth=true bypasses the apiFetch 401-retry-via-refresh path. If
    // the access token expired at the moment of logout, the retry would
    // silently rotate the same refresh token we're about to revoke and
    // the logout call would never reach the server. Backend identifies
    // the user from the refresh_token body, not the Authorization header.
    const refreshToken = useSessionStore.getState().refreshToken;
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: refreshToken ? { refresh_token: refreshToken } : undefined,
        skipAuth: true,
      });
    } catch {
      // Network failure / 401 — proceed; 7-day refresh TTL still bounds
      // the damage even if revoke didn't persist.
    }
    // Drop the acting-company override too — a fresh login should always
    // start in the user's own company, not whatever was selected last.
    clearActingCompany(null, null);
    clearSession();
    router.replace('/login');
  };

  return (
    <aside
      aria-label="Ana navigasyon"
      className="sticky top-0 flex h-dvh w-60 flex-col border-r border-border bg-card"
    >
      <div className="flex items-center gap-1.5 border-b border-border/60 px-5 pt-5 pb-4">
        <span className="text-[18px] font-bold tracking-tight text-brand-600">aisie</span>
        <span className="text-[11px] font-medium tracking-[0.4px] text-muted-foreground">
          ADMIN
        </span>
      </div>

      {role === 'SUPER_ADMIN' && (
        <div className="px-3 pt-3">
          <OrgPicker />
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {NAV_ITEMS.filter((it) => !it.superAdminOnly || role === 'SUPER_ADMIN').map(
          ({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] no-underline transition-colors',
                  active
                    ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                    : 'font-medium text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-[18px] shrink-0',
                    active ? 'text-brand-600 dark:text-brand-300' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                {label}
              </Link>
            );
          },
        )}
      </nav>

      <div className="border-t border-border/60 p-4">
        {user && (
          <div className="mb-3 flex flex-col gap-0.5">
            <p className="m-0 text-[13px] font-semibold text-foreground">{user.fullName}</p>
            <p className="m-0 text-[11px] text-muted-foreground">{user.email}</p>
            <p className="m-0 text-[11px] font-medium text-brand-600">{user.companyName}</p>
            {/* Pilot support hook: copyable build SHA. Click-to-copy so an
                operator can pin a bug report to the exact deploy without us
                asking which version manually. */}
            <button
              type="button"
              onClick={() => {
                const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local';
                if (navigator.clipboard) navigator.clipboard.writeText(sha).catch(() => {});
              }}
              title="Sürümü kopyala"
              className="m-0 mt-1 self-start rounded bg-transparent px-1 py-0.5 text-left text-[10px] font-mono text-muted-foreground/60 hover:text-foreground"
            >
              v{process.env.NEXT_PUBLIC_BUILD_SHA ?? 'local'}
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={logout}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[13px] font-medium text-foreground/75 transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-3.5" aria-hidden />
            Çıkış Yap
          </button>
          <ModeToggle />
        </div>
      </div>
    </aside>
  );
}
