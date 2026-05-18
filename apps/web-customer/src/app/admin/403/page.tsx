import { Container } from '@suraksha/ui';

export default function ForbiddenPage() {
  return (
    <section className="py-24">
      <Container className="max-w-prose text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Not allowed.
        </h1>
        <p className="mt-3 text-ink-muted">
          Your role doesn't include this area. If that seems wrong, ask your admin to adjust your permissions.
        </p>
      </Container>
    </section>
  );
}
