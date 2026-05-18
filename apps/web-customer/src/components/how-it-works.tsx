import { Container } from '@suraksha/ui';

interface Step {
  heading: string;
  body: string;
}

export function HowItWorks({ title, steps }: { title: string; steps: Step[] }) {
  return (
    <section className="bg-primary-subtle py-16">
      <Container>
        <h2 className="mb-10 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={i} className="rounded-lg border border-border bg-card p-6 shadow-card">
              <div className="mb-3 font-display text-3xl font-semibold text-primary">{i + 1}</div>
              <h3 className="text-base font-semibold text-ink">{s.heading}</h3>
              <p className="mt-2 text-sm text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
