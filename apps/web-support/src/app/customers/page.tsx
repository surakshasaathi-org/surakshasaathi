import { SupportShell } from '@/components/support-shell';
import { Container } from '@suraksha/ui';

export default function CustomersPage() {
  return (
    <SupportShell email={null}>
      <Container className="py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Search by phone, email, case id, or policy number. Customer 360 view appears on click —
          policies, cases, prior conversations, entitlements, consent history.
        </p>
        <div className="mt-8 rounded-lg border border-border bg-card p-10 text-center text-ink-muted">
          Search index lands in Week-2 with the customer data model wired in.
        </div>
      </Container>
    </SupportShell>
  );
}
