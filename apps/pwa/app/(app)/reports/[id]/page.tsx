import Link from 'next/link';
import { notFound } from 'next/navigation';
import { REPORTS_FIXTURE } from '@/lib/fixtures/reports';
import { formatDateTime } from '@/lib/format';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = REPORTS_FIXTURE.find((r) => r.id === id);
  if (!report) notFound();

  return (
    <section style={{ padding: '24px 16px 8px' }}>
      <Link href="/reports" style={backLinkStyle}>
        ← Raporlar
      </Link>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '8px 0 4px' }}>
        {report.customerName}
      </h1>
      <p style={{ margin: 0, color: '#6b6b74', fontSize: 13 }}>
        {report.templateName} · {formatDateTime(report.createdAt)}
      </p>

      <div
        style={{
          marginTop: 20,
          padding: 16,
          background: '#f5f3ff',
          border: '1px solid #e9d5ff',
          borderRadius: 12,
          color: '#5b21b6',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        Detay görünümü Faz 3'te gerçek rapor alanları ve manuel düzenleme ile
        dolacak. Şu an fixture veriyi görüntülüyorsunuz.
      </div>
    </section>
  );
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 0',
  fontSize: 13,
  color: '#7c3aed',
  textDecoration: 'none',
  fontWeight: 500,
};
