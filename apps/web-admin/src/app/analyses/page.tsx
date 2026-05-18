import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { Badge } from '@suraksha/ui';
import type { AnalysisStatus } from '@/lib/analyses-fixture';
import { listAnalyses, hasLiveDb } from '@/lib/analyses-live';

const STATUS_TONE: Record<AnalysisStatus, 'success' | 'primary' | 'warn' | 'danger' | 'neutral'> = {
  ready: 'success',
  failed: 'danger',
  queued: 'neutral',
  digitizing: 'primary',
  ocr_running: 'primary',
  intake_running: 'primary',
  extracting: 'primary',
  analysing: 'primary',
  translating: 'primary',
  reviewing: 'primary',
};

const STATUS_LABEL: Record<AnalysisStatus, string> = {
  ready: 'Ready',
  failed: 'Failed',
  queued: 'Queued',
  digitizing: 'Digitizing',
  ocr_running: 'OCR',
  intake_running: 'Intake',
  extracting: 'Extracting',
  analysing: 'Analysing',
  translating: 'Translating',
  reviewing: 'Reviewing',
};

export default async function AnalysesPage() {
  const session = await requireAdminSession(['super_admin', 'admin', 'case_manager', 'content_editor', 'viewer']);
  const rows = await listAnalyses();
  const live = hasLiveDb();

  const stats = {
    total: rows.length,
    ready: rows.filter((r) => r.status === 'ready').length,
    failed: rows.filter((r) => r.status === 'failed').length,
    avgScore: Math.round(
      rows.filter((r) => r.readinessScore != null).reduce((a, r) => a + (r.readinessScore ?? 0), 0) /
        Math.max(1, rows.filter((r) => r.readinessScore != null).length),
    ),
    totalCostRupees: (rows.reduce((a, r) => a + r.costPaise, 0) / 100).toFixed(2),
  };

  return (
    <AdminShell role={session.role} email={session.email}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Policy analyses</h1>
          <p className="mt-2 max-w-prose text-sm text-ink-muted">
            Every Analyse-My-Policy run across the platform.
            {live ? ' Live data from Postgres.' : ' Showing seeded sample data — connect the DB to see live runs.'}
          </p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Ready" value={String(stats.ready)} tone="success" />
        <Stat label="Failed" value={String(stats.failed)} tone="danger" />
        <Stat label="Avg readiness" value={`${stats.avgScore}/100`} />
        <Stat label="Spend (total)" value={`₹${stats.totalCostRupees}`} />
      </div>

      {/* Table */}
      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-primary-subtle/50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Insurer / Plan</th>
              <th className="px-4 py-3">Locale</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Red flags</th>
              <th className="px-4 py-3 text-right">Cost (₹)</th>
              <th className="px-4 py-3 text-right">Duration</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-primary-subtle/30">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/analyses/${r.id}`} className="text-primary hover:underline">
                    {r.id}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </td>
                <td className="px-4 py-3">
                  {r.insurerName ? (
                    <>
                      <div>{r.insurerName}</div>
                      <div className="text-xs text-ink-subtle">{r.planName}</div>
                    </>
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs uppercase">{r.locale}</td>
                <td className="px-4 py-3 text-right">{r.readinessScore ?? '—'}</td>
                <td className="px-4 py-3 text-right">{r.redFlagsCount ?? '—'}</td>
                <td className="px-4 py-3 text-right">{(r.costPaise / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  {r.durationSec != null ? `${r.durationSec}s` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-subtle">
                  {new Date(r.createdAt).toLocaleString('en-IN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'success' | 'danger' | 'primary';
}) {
  const color =
    tone === 'success'
      ? 'text-success'
      : tone === 'danger'
        ? 'text-danger'
        : tone === 'primary'
          ? 'text-primary'
          : 'text-ink';
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-subtle">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
