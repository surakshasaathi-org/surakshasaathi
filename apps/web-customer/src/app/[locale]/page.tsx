import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileSearch,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import { Container } from '@suraksha/ui';
import { Faq } from '@/components/faq';

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 300;

/**
 * Marketing home. Cred-modern dark canvas, mint accent. Lead with
 * "Policy Analyser" as the wedge value prop — uploads → AI reads → clear,
 * family-aware report. Why / What / How / Family / Trust / Pricing / FAQ /
 * Coming soon. Mobile-first.
 */
export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  const analyseHref = `/${locale}/policy-health-score/analyse`;

  return (
    <>
      {/* ───────── Hero ───────── */}
      <section className="relative overflow-hidden bg-hero-aurora pb-24 pt-16 sm:pt-24 lg:pb-32 lg:pt-32">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-subtle px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" aria-hidden /> AI policy analyser · free first scan
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Know exactly what your health policy{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                actually covers.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-[44ch] text-lg leading-relaxed text-ink-muted sm:text-xl">
              Upload it. We read every clause in 90 seconds. You get red flags, member-by-member
              coverage, and the questions to ask your insurer — in plain English, Hindi, or Kannada.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={analyseHref}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90 sm:w-auto"
              >
                Analyse my policy <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={`/${locale}#how`}
                className="inline-flex w-full items-center justify-center rounded-full border border-border bg-surface/40 px-6 py-3.5 text-base font-medium text-ink-muted transition hover:border-primary/40 hover:text-ink sm:w-auto"
              >
                See how it works
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-subtle">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" /> DPDP-compliant · India-region servers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5 text-primary" /> 60–120 seconds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-primary" /> No broker license · advisory only
              </span>
            </div>
          </div>
        </Container>
      </section>

      {/* ───────── Why ───────── */}
      <Section id="why" eyebrow="Why this matters" title="The fine print is where claims die.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Stat n="70%" label="of claim disputes are caused by clauses customers didn't know about." />
          <Stat n="₹3L+" label="median out-of-pocket on a single hospitalisation when sub-limits trigger." />
          <Stat n="2 of 5" label="Indian families discover an exclusion only after the claim is filed." />
        </div>
      </Section>

      {/* ───────── What ───────── */}
      <Section id="what" eyebrow="What you get" title="Not a score. The actual answers.">
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            icon={<FileSearch className="size-5" />}
            title="Red flags, in plain language"
            body="We surface the clauses that hurt you — proportionate deduction, sub-limits, waiting periods — with the exact wording from your document."
          />
          <FeatureCard
            icon={<Users className="size-5" />}
            title="Coverage, by family member"
            body="Each member gets their own card: what's covered, what's not, what's conditional. Tailored to ages and pre-existing conditions."
          />
          <FeatureCard
            icon={<HelpCircle className="size-5" />}
            title="Questions to ask your insurer"
            body="When the document leaves something unsaid, we tell you the exact question to put to the insurer or TPA — no industry-typical guesswork."
          />
          <FeatureCard
            icon={<Zap className="size-5" />}
            title="Follow-up chat"
            body="Stuck on a clause? Ask. Our chat answers only from your policy + the analysis — no hallucinated advice."
          />
        </div>
      </Section>

      {/* ───────── How ───────── */}
      <Section id="how" eyebrow="How it works" title="Three steps. Sixty to one-twenty seconds.">
        <ol className="grid gap-5 md:grid-cols-3">
          <Step
            n={1}
            title="Upload"
            body="PDF, photo of the schedule, or the policy wording booklet. Up to 50 MB."
          />
          <Step
            n={2}
            title="We read"
            body="Our AI extracts every coverage section, exclusion, sub-limit, waiting period — verbatim."
          />
          <Step
            n={3}
            title="You decide"
            body="Free summary instantly. Add your family for tailored member cards. Ask the chat anything."
          />
        </ol>
      </Section>

      {/* ───────── For your family ───────── */}
      <Section
        eyebrow="For your family"
        title="A score on a brochure means nothing. Coverage for YOUR mother does."
      >
        <div className="rounded-3xl border border-border bg-surface/60 p-6 shadow-card sm:p-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-base leading-relaxed text-ink-muted sm:text-lg">
                Tell us your family — ages, pre-existing conditions, where you live. We re-analyse
                your policy in that context. The same ₹7-Lakh sum-insured can be wildly enough or
                wildly inadequate depending on who's covered.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink">
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 flex-none rounded-full bg-primary" />
                  <span>Per-member must-watch items, not generic warnings</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 flex-none rounded-full bg-primary" />
                  <span>Diabetes, hypertension, dyslipidemia → tailored coverage notes</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 flex-none rounded-full bg-primary" />
                  <span>City-tier-aware (metro vs tier-2 vs tier-3 outcomes are different)</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-background/60 p-5 font-mono text-xs text-ink-muted">
              <div className="text-primary">▸ Mother, 58, with Diabetes & Hypertension</div>
              <div className="mt-3 text-ink">✓ Hospitalisation up to ₹7 Lakh</div>
              <div className="mt-1 text-ink">✓ Single Private Room (proportionate deduction risk)</div>
              <div className="mt-1 text-ink">✓ Day care covered</div>
              <div className="mt-3 text-warn">⚠ Cardiovascular capped at ₹3 Lakh</div>
              <div className="mt-1 text-warn">⚠ PED waiting period — confirm with insurer</div>
            </div>
          </div>
        </div>
      </Section>

      {/* ───────── Trust ───────── */}
      <Section eyebrow="Built for trust" title="Advisory only. No broker license. No policy pushing.">
        <div className="grid gap-4 sm:grid-cols-3">
          <TrustTile
            icon={<ShieldCheck className="size-5" />}
            title="DPDP-compliant"
            body="India-region servers. We collect only what we need. Granular consent. 7-day retention by default."
          />
          <TrustTile
            icon={<CheckCircle2 className="size-5" />}
            title="No conflict of interest"
            body="We don't sell policies. We don't take commission from insurers. You pay us — that's our entire incentive."
          />
          <TrustTile
            icon={<FileSearch className="size-5" />}
            title="Verbatim grounding"
            body="Every claim cites the exact line from your document. We don't speculate about industry norms."
          />
        </div>
      </Section>

      {/* ───────── Pricing ───────── */}
      <Section id="pricing" eyebrow="Pricing" title="Free first. Simple after.">
        <div className="grid gap-4 sm:grid-cols-2">
          <PricingTile
            tag="Free"
            price="₹0"
            sub="for your first analysis"
            bullets={[
              'Full AI scan of one policy',
              'Summary + red flags',
              'No card required',
              'Sign up to save the report',
            ]}
            cta="Start free"
            href={analyseHref}
            primary
          />
          <PricingTile
            tag="Family"
            price="Coming soon"
            sub="multiple policies, full member detail"
            bullets={[
              'Unlimited analyses',
              'Member-by-member coverage cards',
              'Renewal reminders',
              'Priority chat support',
            ]}
            cta="Notify me"
            href={`/${locale}/sign-up`}
          />
        </div>
        <p className="mt-5 text-center text-xs text-ink-subtle">
          We never take commission from insurers. No mis-selling. No upsell traps.
        </p>
      </Section>

      {/* ───────── FAQ ───────── */}
      <Section id="faq" eyebrow="FAQ" title="Quick answers.">
        <Faq locale={locale} />
      </Section>

      {/* ───────── Coming soon ───────── */}
      <Section
        id="coming-soon"
        eyebrow="What's coming"
        title="Policy analyser is the start. More on the way."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMING_SOON.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-border bg-surface/40 p-4 transition hover:border-primary/40"
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {c.tag}
              </div>
              <div className="mt-1.5 font-display text-base font-semibold text-ink">{c.title}</div>
              <p className="mt-1 text-sm text-ink-muted">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ───────── Final CTA ───────── */}
      <section className="my-16 sm:my-24">
        <Container>
          <div className="mx-auto max-w-3xl rounded-3xl border border-primary/30 bg-mint-glow p-8 text-center sm:p-14">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              Stop guessing. Start knowing.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-base text-ink-muted sm:text-lg">
              Your first analysis is free. No card, no broker, no spam.
            </p>
            <Link
              href={analyseHref}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90"
            >
              Analyse my policy <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

/* ───────── Section primitives ───────── */

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="py-16 sm:py-24">
      <Container>
        <div className="mx-auto mb-10 max-w-3xl text-center sm:mb-14">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </span>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl lg:text-5xl">
            {title}
          </h2>
        </div>
        {children}
      </Container>
    </section>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-6 text-center">
      <div className="font-display text-5xl font-semibold text-primary sm:text-6xl">{n}</div>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{label}</p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-surface/40 p-6 transition hover:border-primary/40">
      <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="rounded-2xl border border-border bg-surface/40 p-6">
      <div className="font-mono text-xs text-primary">0{n}</div>
      <h3 className="mt-2 font-display text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </li>
  );
}

function TrustTile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-6">
      <div className="inline-flex size-10 items-center justify-center rounded-lg bg-primary-subtle text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

function PricingTile({
  tag,
  price,
  sub,
  bullets,
  cta,
  href,
  primary,
}: {
  tag: string;
  price: string;
  sub: string;
  bullets: string[];
  cta: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-7 ${
        primary ? 'border-primary/40 bg-mint-glow' : 'border-border bg-surface/40'
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-primary">{tag}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold text-ink">{price}</span>
        <span className="text-sm text-ink-muted">{sub}</span>
      </div>
      <ul className="mt-5 space-y-2 text-sm text-ink">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 flex-none text-primary" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
          primary
            ? 'bg-primary text-primary-foreground shadow-glow hover:bg-primary/90'
            : 'border border-border bg-surface/60 text-ink hover:border-primary/40'
        }`}
      >
        {cta} <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}

const COMING_SOON: Array<{ tag: string; title: string; body: string }> = [
  {
    tag: 'Soon',
    title: 'Claims Advocacy',
    body: "Got a rejection? We'll write the appeal letter and walk you through Ombudsman if needed.",
  },
  {
    tag: 'Soon',
    title: 'Govt Scheme Navigator',
    body: 'Eligibility check for Ayushman Bharat, PM-JAY, PMSBY, PMJJBY — always free, always anonymous.',
  },
  {
    tag: 'Later',
    title: 'Family Protection OS',
    body: 'A single dashboard for every policy in the household, with renewal nudges and gap analysis.',
  },
  {
    tag: 'Later',
    title: 'Senior Citizen Portal',
    body: 'Specialised flow for 60+ — large fonts, voice input, simpler language.',
  },
  {
    tag: 'Later',
    title: 'MSME Group Cover Audit',
    body: 'Help small businesses pick the right group health cover for their team.',
  },
  {
    tag: 'Later',
    title: 'Mis-selling Recovery',
    body: 'If a life-insurance product was mis-sold, we help you reclaim what you can.',
  },
];
