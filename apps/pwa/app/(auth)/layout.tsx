// Auth layout renders without the bottom-tab bar. Centred card on a soft
// purple-to-white backdrop — matches the brand look established in image.png.
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
      <div style={{ width: '100%', maxWidth: 380 }}>{children}</div>
    </div>
  );
}
