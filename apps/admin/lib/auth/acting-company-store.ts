'use client';

import { create } from 'zustand';

// Tracks which company the SUPER_ADMIN is currently "acting as" through the
// org picker. The selection is sent on every authenticated request as
// X-Acting-Company-Id, which the gateway validates (SUPER_ADMIN only) and
// forwards downstream as X-Company-ID. For COMPANY_ADMIN this state stays
// null — the gateway would 403 the header anyway, so we don't even set it.
//
// Persisted to localStorage so a page reload doesn't bounce a SUPER_ADMIN
// back to their own company mid-investigation. Cleared on logout.

const STORAGE_KEY = 'aisie_admin_acting_company_v1';

type ActingCompanyState = {
  // null = no override; use the JWT-claimed company (own company)
  actingCompanyId: string | null;
  actingCompanyName: string | null;
  setActingCompany: (id: string | null, name: string | null) => void;
  initialize: () => void;
};

export const useActingCompanyStore = create<ActingCompanyState>((set) => ({
  actingCompanyId: null,
  actingCompanyName: null,

  setActingCompany: (id, name) => {
    set({ actingCompanyId: id, actingCompanyName: name });
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Private browsing or quota — selection still works in-memory; just
      // doesn't survive a reload.
    }
  },

  initialize: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id?: string; name?: string };
      if (parsed.id) {
        set({ actingCompanyId: parsed.id, actingCompanyName: parsed.name ?? null });
      }
    } catch {
      // Corrupted entry — ignore, fall back to no override.
    }
  },
}));

export function getActingCompanyId(): string | null {
  return useActingCompanyStore.getState().actingCompanyId;
}
