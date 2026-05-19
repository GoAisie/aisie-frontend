'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';
import { cn } from '@/lib/utils';

// Org picker for SUPER_ADMIN. Renders a button showing the current acting
// company (own company when no override is active); clicking opens a list
// of every company GET /companies returns. Picking a company sets
// X-Acting-Company-Id for every subsequent apiFetch.
//
// COMPANY_ADMIN never sees this widget — Sidebar omits it based on role, and
// GET /companies would 403 anyway (defense in depth).
//
// Platform-user case: SUPER_ADMINs bound to the internal AISIE Platform
// company have no meaningful "own company" — the picker defaults to an
// unselected state and the dashboard renders an empty CTA until a tenant is
// picked. Backend omits the platform row from /companies so the user never
// accidentally selects their auth host.

const PLATFORM_COMPANY_NAME = 'AISIE Platform';

type CompanyRow = {
  public_id: string;
  name: string;
  short_name: string;
  code: string;
  status: string;
};

export function OrgPicker() {
  const ownCompanyName = useSessionStore((s) => s.user?.companyName ?? null);
  const ownCompanyId = useSessionStore((s) => s.user?.companyPublicId ?? null);
  const actingCompanyId = useActingCompanyStore((s) => s.actingCompanyId);
  const actingCompanyName = useActingCompanyStore((s) => s.actingCompanyName);
  const setActingCompany = useActingCompanyStore((s) => s.setActingCompany);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node)) return;
      if (buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const { data: companies = [], isLoading, isError } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => apiFetch<CompanyRow[]>('/api/v1/companies'),
    staleTime: 5 * 60_000,
  });

  const isPlatformUser = ownCompanyName === PLATFORM_COMPANY_NAME;
  const selectedId = actingCompanyId ?? (isPlatformUser ? null : ownCompanyId);
  const selectedName =
    actingCompanyName ?? (isPlatformUser ? null : ownCompanyName ?? null);

  const pick = (row: CompanyRow | null) => {
    if (row === null || row.public_id === ownCompanyId) {
      setActingCompany(null, null);
    } else {
      setActingCompany(row.public_id, row.name);
    }
    setOpen(false);
    queryClient.invalidateQueries();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-1.5 rounded-md border px-2.5 py-2 text-left text-[12px] transition-colors',
          actingCompanyId
            ? 'border-processing-500/40 bg-processing-500/10 text-foreground hover:bg-processing-500/15'
            : 'border-border bg-brand-50 text-foreground hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50',
        )}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-[0.4px] text-muted-foreground">
            {actingCompanyId
              ? 'Şirket seçimi'
              : isPlatformUser
                ? 'Şirket seçilmedi'
                : 'Kendi şirketin'}
          </span>
          <span className="truncate font-semibold">
            {selectedName ?? 'Şirket seç'}
          </span>
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
        >
          {isLoading && (
            <p className="m-0 px-3 py-3 text-[12px] text-muted-foreground">Yükleniyor…</p>
          )}
          {isError && (
            <p className="m-0 px-3 py-3 text-[12px] text-destructive">
              Şirket listesi alınamadı.
            </p>
          )}
          {!isLoading && !isError && companies.length === 0 && (
            <p className="m-0 px-3 py-3 text-[12px] text-muted-foreground">Şirket yok.</p>
          )}
          {companies.map((row) => {
            const isSelected = row.public_id === selectedId;
            const isOwn = row.public_id === ownCompanyId;
            return (
              <button
                key={row.public_id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => pick(row)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0',
                  isSelected
                    ? 'bg-brand-50 dark:bg-brand-900/40'
                    : 'bg-popover hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'text-[13px] text-foreground',
                    isSelected ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {row.name}
                  {isOwn && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-[0.4px] text-brand-600">
                      kendi
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground">{row.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
