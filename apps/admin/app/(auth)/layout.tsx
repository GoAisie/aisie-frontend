export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-brand-50 to-background p-6">
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-7 shadow-lg shadow-brand-900/5 dark:shadow-black/30">
        {children}
      </div>
    </div>
  );
}
