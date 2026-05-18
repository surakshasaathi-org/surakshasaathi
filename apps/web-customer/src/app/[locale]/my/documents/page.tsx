import Link from 'next/link';
import { FileText, FolderOpen, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { listMyDocuments, type VaultRow } from '@/server/documents/actions';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params }: Props) {
  const { locale } = await params;
  const docs = await listMyDocuments();

  return (
    <div>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FolderOpen className="size-3.5" />
          Documents
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Everything you've uploaded
        </h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Every policy PDF, rejection letter, bill, and ID that's passed through Suraksha Saathi —
          scoped to the analysis or claim it belongs to. We don't let you upload freeform files
          here; uploads always start from a context so nothing gets orphaned.
        </p>
      </header>

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FolderOpen className="mx-auto size-10 text-ink-subtle" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            Your vault is empty
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Upload a policy to{' '}
            <Link href={`/${locale}/policy-health-score/analyse`} className="text-primary underline">
              Analyse My Policy
            </Link>{' '}
            and the PDF will appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <DocRow key={d.source + ':' + d.id} doc={d} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DocRow({ doc, locale }: { doc: VaultRow; locale: string }) {
  const Icon = doc.mime.startsWith('image/') ? ImageIcon : FileText;
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{doc.filename}</span>
          <Badge tone={doc.source === 'policy' ? 'primary' : 'warn'}>
            {doc.source === 'policy' ? 'Policy' : 'Claim'}
          </Badge>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
          <span>{doc.contextLabel}</span>
          <span>{formatSize(doc.sizeBytes)}</span>
          <span>{new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
      {doc.contextHref && (
        <Link
          href={`/${locale}${doc.contextHref}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Open context →
        </Link>
      )}
    </li>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
