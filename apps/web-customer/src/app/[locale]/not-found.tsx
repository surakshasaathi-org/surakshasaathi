import Link from 'next/link';
import { Container, buttonVariants } from '@suraksha/ui';

export default function NotFound() {
  return (
    <section className="py-24">
      <Container className="max-w-prose text-center">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
          That page wasn't found.
        </h1>
        <p className="mt-4 text-ink-muted">
          Some links in our footer point at pages we're still building. Back to the home page for now.
        </p>
        <Link href="/" className={buttonVariants({ size: 'md', className: 'mt-8' })}>
          Back to home
        </Link>
      </Container>
    </section>
  );
}
