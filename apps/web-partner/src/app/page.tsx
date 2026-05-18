import { Container } from '@suraksha/ui';

export default function Placeholder() {
  return (
    <section className="py-24">
      <Container className="max-w-prose">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Partner portal — Phase 2.
        </h1>
        <p className="mt-3 text-ink-muted">
          This slot is reserved for NGO / HR / CSC / broker white-label dashboards. The module-registry,
          access-control, and tenancy model already support it — we flip on the portal when our first B2B
          contract signs.
        </p>
      </Container>
    </section>
  );
}
