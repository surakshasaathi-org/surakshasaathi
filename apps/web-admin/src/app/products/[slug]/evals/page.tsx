import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * Per-product Eval Lab mirror — /products/[slug]/evals.
 *
 * Thin shell that resolves slug → agent_slug[] from the
 * product_module config table, then would render the same hub components
 * as /evals scoped to those agents. Day-1 implementation just shows the
 * agent list + cross-links to the platform-level /evals views; once the
 * shared components are extracted, swap in the filtered hub. This keeps
 * the IA promise from PRD §5b (per-product mirror) while not duplicating
 * the platform view's component tree on day 1.
 */
export default async function PerProductEvalsPage({ params }: Props) {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const { slug } = await params;

  const db = serviceDb();
  const [product] = await db
    .select()
    .from(schema.productModule)
    .where(eq(schema.productModule.id, slug))
    .limit(1);
  if (!product) notFound();

  const agentSlugs = product.agentDefinitionIds ?? [];

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-8">
        <Link
          href={`/products/${slug}`}
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to product
        </Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FlaskConical className="size-3.5" />
          Evals · {(product.nameI18n as Record<string, string>)?.en ?? slug}
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Eval surfaces for this product
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Filtered to agents wired to {slug}. Rubrics, golden cases, and traces all live
          in the platform-wide views below — pre-filtered to this product's agent set.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Agents in this product
        </h2>
        {agentSlugs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-ink-muted">
            No agents wired to {slug} yet. Edit{' '}
            <code className="rounded bg-background px-1.5 py-0.5">product_module.agent_definition_ids</code>{' '}
            to attach agents.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {agentSlugs.map((slug) => (
              <div
                key={slug}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="font-mono text-sm font-semibold text-ink">{slug}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Link
                    href={`/agents/${slug}`}
                    className="rounded-full border border-border px-2.5 py-1 text-ink-muted hover:border-primary/40 hover:text-ink"
                  >
                    Definition
                  </Link>
                  <Link
                    href={`/agents/${slug}/golden-cases`}
                    className="rounded-full border border-border px-2.5 py-1 text-ink-muted hover:border-primary/40 hover:text-ink"
                  >
                    Golden cases
                  </Link>
                  <Link
                    href={`/agents/${slug}/rubric`}
                    className="rounded-full border border-border px-2.5 py-1 text-ink-muted hover:border-primary/40 hover:text-ink"
                  >
                    Rubric
                  </Link>
                  <Link
                    href={`/agents/${slug}/regressions`}
                    className="rounded-full border border-border px-2.5 py-1 text-ink-muted hover:border-primary/40 hover:text-ink"
                  >
                    Regressions
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Platform views
        </h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/evals"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink hover:border-primary/40"
          >
            All evals →
          </Link>
          <Link
            href="/evals/sampling"
            className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink hover:border-primary/40"
          >
            Sampling policy →
          </Link>
        </div>
      </section>
    </AdminShell>
  );
}
