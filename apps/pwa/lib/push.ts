import { apiFetch } from './api-client';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  // `new Uint8Array(n).buffer` is always a concrete ArrayBuffer, never SharedArrayBuffer.
  return output.buffer as ArrayBuffer;
}

export async function subscribeToPush(vapidPublicKey: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return;
  const sw = await navigator.serviceWorker.ready;
  try {
    const sub = await sw.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await apiFetch('/api/v1/push-subscriptions', {
      method: 'POST',
      body: { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth },
    });
  } catch {
    // Best-effort — browser may deny or service worker not active
  }
}
