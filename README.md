# aisie-frontend

AISIE PWA + admin panel monorepo.

## Layout

- `apps/pwa` — Next.js 16 PWA, deployed to `app.goaisie.com` (Vercel).
- `apps/admin` — Next.js 16 admin panel, deployed to `admin.goaisie.com` (Vercel).
- `packages/shared` — shared Zod types, API client, design tokens, UI primitives.

## Language & naming

All code (folder names, file names, identifiers, comments, docstrings, commit messages) is **English-only**. User-facing UI strings are Turkish (pilot customer base).

## Dev

```bash
pnpm install
pnpm dev:pwa     # http://localhost:3000
pnpm dev:admin   # http://localhost:3001
```

Requires Node.js >= 20.11 and pnpm >= 9.
