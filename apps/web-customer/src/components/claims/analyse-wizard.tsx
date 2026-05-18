'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { Container } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { startAnalysis } from '@/server/analyse/actions';
import type { DemographicsFormValue } from './demographics-form';

interface Props {
  locale: string;
  familyPrefill: DemographicsFormValue | null;
  uploadStrings: {
    dropLabel: string;
    tapToUpload: string;
    formats: string;
    analyseCta: string;
    changeFile: string;
    selectFirst: string;
  };
}

/**
 * Single-page analyse experience. Value prop + how-it-works + upload zone +
 * trust strip on one screen — no multi-step wizard. Mobile: stacks
 * vertically; desktop: hero left + upload right.
 *
 * Family / PED / city-tier questions belong on the report's Refine panel
 * AFTER the extractor has surfaced the members from the doc — see product
 * note 2026-05-04. Not collected here.
 */
export function AnalyseWizard({ locale, familyPrefill, uploadStrings }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showWhere, setShowWhere] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSelect(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File is over 20 MB. Please compress or upload a smaller version.');
      return;
    }
    setFile(f);
  }

  function submit() {
    if (!file) {
      setError(uploadStrings.selectFirst);
      return;
    }
    setError(null);
    startTransition(async () => {
      const familyContext =
        familyPrefill && familyPrefill.members.length > 0
          ? ({ ...familyPrefill, locale } as unknown as Record<string, unknown>)
          : null;
      const res = await startAnalysis({ locale, file, demographics: familyContext });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push(`/${locale}/policy-health-score/analysis/${res.analysisId}`);
    });
  }

  const isImage = file && file.type.startsWith('image/');

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-hero-aurora pb-20 pt-10 sm:pt-16">
      <Container>
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          {/* ───────── Left: value prop ───────── */}
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-subtle px-3 py-1 text-[11px] font-medium text-primary">
              <Sparkles className="size-3" /> Free first analysis · 60–120 seconds
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              The fine print is where claims die. We read it for you.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-muted sm:text-lg">
              Upload your health policy. Our AI surfaces every clause that affects you in plain
              English, in 60–120 seconds — red flags, member coverage, and the questions to ask
              your insurer.
            </p>

            {/* What you get — three short rows */}
            <ul className="mt-7 space-y-3">
              <Pillar
                icon={<AlertCircle className="size-4" />}
                title="Red flags, in plain English"
                body="Exact wording from your document. Sub-limits, waiting periods, proportionate-deduction clauses called out."
              />
              <Pillar
                icon={<Users className="size-4" />}
                title="Member-by-member coverage"
                body="Each member gets their own card. Pre-existing conditions handled. Tailored after upload."
              />
              <Pillar
                icon={<MessageCircle className="size-4" />}
                title="Questions to ask the insurer"
                body="When the document is silent, we tell you the exact question to put to them."
              />
            </ul>

            {/* How it works — one line, three beats */}
            <div className="mt-6 rounded-xl border border-border bg-background/40 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                How it works
              </div>
              <ol className="mt-2 grid gap-2 text-sm text-ink sm:grid-cols-3">
                <Beat n="1" title="Upload">
                  PDF or photo
                </Beat>
                <Beat n="2" title="We read">
                  Every clause, verbatim
                </Beat>
                <Beat n="3" title="Refine">
                  Add your family for tailored coverage
                </Beat>
              </ol>
            </div>

            {/* Trust strip */}
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-subtle">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> DPDP-compliant · India servers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" /> 7-day default retention
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" /> No broker license
              </span>
            </div>
          </div>

          {/* ───────── Right: upload zone ───────── */}
          <div className="lg:sticky lg:top-24">
            <div className="rounded-3xl border border-border bg-surface/50 p-5 shadow-card backdrop-blur sm:p-7">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Upload your policy
              </div>
              <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                Drop the schedule or wording PDF.
              </h2>

              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"
                className="sr-only"
                onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const dropped = e.dataTransfer?.files?.[0];
                  if (dropped) handleSelect(dropped);
                }}
                className={cn(
                  'mt-4 flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
                  dragOver
                    ? 'border-primary bg-primary-subtle/40'
                    : file
                      ? 'border-success/60 bg-success-subtle/30'
                      : 'border-border bg-background/40 hover:border-primary/50 hover:bg-primary-subtle/30',
                )}
              >
                {file ? (
                  <>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success">
                      {isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                        <CheckCircle2 className="size-4 text-success" />
                        {file.name}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">
                        {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'file'}
                      </div>
                    </div>
                    <span className="text-xs text-primary underline">{uploadStrings.changeFile}</span>
                  </>
                ) : (
                  <>
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                      <Upload className="size-6" aria-hidden />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink">{uploadStrings.dropLabel}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">{uploadStrings.tapToUpload}</div>
                    </div>
                    <div className="text-[11px] text-ink-subtle">{uploadStrings.formats}</div>
                  </>
                )}
              </button>

              {error && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-danger/40 bg-danger-subtle/40 px-3 py-2 text-xs text-danger">
                  <AlertCircle className="size-4 flex-none" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={submit}
                disabled={!file || pending}
                className={cn(
                  'mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition',
                  file && !pending
                    ? 'bg-primary text-primary-foreground shadow-glow hover:bg-primary/90'
                    : 'cursor-not-allowed bg-surface text-ink-subtle',
                )}
              >
                {pending ? 'Starting…' : uploadStrings.analyseCta} <ArrowRight className="size-4" />
              </button>

              <p className="mt-3 text-center text-[11px] text-ink-subtle">
                We'll ask about pre-existing conditions and family context AFTER you see the policy
                facts — so you only answer what matters.
              </p>

              {/* "Where do I find it?" — collapsible disclosure, not a separate step. */}
              <div className="mt-4 border-t border-border/60 pt-4">
                <button
                  type="button"
                  onClick={() => setShowWhere((v) => !v)}
                  aria-expanded={showWhere}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted underline-offset-4 transition hover:text-ink hover:underline"
                >
                  Where do I find my policy document?{' '}
                  <ChevronDown
                    className={cn('size-3.5 transition', showWhere && 'rotate-180')}
                    aria-hidden
                  />
                </button>
                {showWhere && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Source icon={<Mail className="size-3.5" />} title="Email">
                      Search insurer name + 'policy' or 'certificate'.
                    </Source>
                    <Source icon={<MessageCircle className="size-3.5" />} title="WhatsApp">
                      Most insurers WhatsApp the schedule on issue.
                    </Source>
                    <Source icon={<Smartphone className="size-3.5" />} title="Insurer's app">
                      Policies → Download. Or DigiLocker if linked.
                    </Source>
                    <Source icon={<Phone className="size-3.5" />} title="Customer care">
                      They'll email a fresh PDF in minutes.
                    </Source>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ───────── Bits ───────── */

function Pillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 flex-none items-center justify-center rounded-lg bg-primary-subtle text-primary">
        {icon}
      </span>
      <div>
        <div className="font-display text-sm font-semibold text-ink">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </li>
  );
}

function Beat({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="inline-flex size-6 flex-none items-center justify-center rounded-full bg-primary-subtle font-mono text-[10px] font-bold text-primary">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs text-ink-muted">{children}</div>
      </div>
    </li>
  );
}

function Source({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span className="inline-flex size-6 flex-none items-center justify-center rounded-md bg-primary-subtle text-primary">
          {icon}
        </span>
        {title}
      </div>
      <p className="mt-1 text-[11px] text-ink-muted">{children}</p>
    </div>
  );
}
