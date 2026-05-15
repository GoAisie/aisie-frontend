'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useSessionStore } from '@/lib/auth/session-store';
import { useActingCompanyStore } from '@/lib/auth/acting-company-store';

// Org picker for SUPER_ADMIN. Renders a button showing the current acting
// company (own company name when no override is active); clicking opens a
// dropdown of every company the GET /companies endpoint returns. Picking a
// company sets X-Acting-Company-Id for every subsequent apiFetch call.
//
// COMPANY_ADMIN never sees this widget — Sidebar omits it based on role,
// AND the underlying GET /companies endpoint would 403 anyway (defense in
// depth).
//
// Platform-user case: SUPER_ADMINs bound to the internal AISIE Platform
// company (companyName === PLATFORM_COMPANY_NAME) have no meaningful "own
// company" — that row is just an auth host. Picker defaults to an unselected
// state ("Şirket seç") and the dashboard renders an empty CTA until the user
// picks an acting company. Backend mirrors this by omitting the platform row
// from /companies, so the user never accidentally selects their own auth
// host and lands on a blank dashboard.

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

  // Close on click-outside / Escape — keep the picker out of the way once
  // a selection is made.
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

  // Effective selection: explicit override OR fall back to own company.
  // For platform users, own company is not a valid fallback — leave the
  // selection empty until the user explicitly picks a tenant.
  const isPlatformUser = ownCompanyName === PLATFORM_COMPANY_NAME;
  const selectedId = actingCompanyId ?? (isPlatformUser ? null : ownCompanyId);
  const selectedName =
    actingCompanyName ?? (isPlatformUser ? null : ownCompanyName ?? null);

  const pick = (row: CompanyRow | null) => {
    if (row === null || row.public_id === ownCompanyId) {
      // Picking own company clears the override entirely — no acting header
      // is sent, downstream sees the SUPER_ADMIN's own JWT-claimed company.
      setActingCompany(null, null);
    } else {
      setActingCompany(row.public_id, row.name);
    }
    setOpen(false);
    // Every query result is scoped to the previous acting company; nuke them
    // so the new selection causes a refetch instead of stale data flicker.
    queryClient.invalidateQueries();
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          background: actingCompanyId ? '#fef3c7' : '#f5f3ff',
          border: `1px solid ${actingCompanyId ? '#f59e0b' : '#e5e7eb'}`,
          borderRadius: 8,
          fontSize: 12,
          color: '#0b0b0f',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontSize: 10, color: '#6b6b74', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            {actingCompanyId
              ? 'Şirket seçimi'
              : isPlatformUser
                ? 'Şirket seçilmedi'
                : 'Kendi şirketin'}
          </span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {selectedName ?? 'Şirket seç'}
          </span>
        </span>
        <span style={{ fontSize: 11, color: '#6b6b74' }}>▾</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,0.18)',
            zIndex: 50,
            maxHeight: 320,
            overflowY: 'auto',
          }}
        >
          {isLoading && (
            <p style={{ margin: 0, padding: 12, fontSize: 12, color: '#6b6b74' }}>Yükleniyor…</p>
          )}
          {isError && (
            <p style={{ margin: 0, padding: 12, fontSize: 12, color: '#dc2626' }}>Şirket listesi alınamadı.</p>
          )}
          {!isLoading && !isError && companies.length === 0 && (
            <p style={{ margin: 0, padding: 12, fontSize: 12, color: '#6b6b74' }}>Şirket yok.</p>
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
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  padding: '10px 12px',
                  background: isSelected ? '#f5f3ff' : '#fff',
                  border: 'none',
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: '#0b0b0f' }}>
                  {row.name}
                  {isOwn && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#7c3aed', textTransform: 'uppercase' }}>
                      kendi
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 11, color: '#6b6b74' }}>{row.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
