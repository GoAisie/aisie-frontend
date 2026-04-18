import { redirect } from 'next/navigation';

// Auth state lives in memory only (see lib/auth/session-store.ts) so every
// fresh page load has no session. Sending unauthenticated visitors to /login
// is both correct and cheap — the login page redirects onward on success.
export default function RootRedirect(): never {
  redirect('/login');
}
