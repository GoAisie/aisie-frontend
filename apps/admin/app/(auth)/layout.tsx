// Centered card on a soft purple backdrop — matches the PWA's auth look so
// the two apps feel related despite being different deployments.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 14,
          padding: 28,
          boxShadow: '0 20px 40px rgba(15,23,42,0.06)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
