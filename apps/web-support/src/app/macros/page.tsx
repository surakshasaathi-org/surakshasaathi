import { SupportShell } from '@/components/support-shell';
import { Container } from '@suraksha/ui';

export default function MacrosPage() {
  return (
    <SupportShell email={null}>
      <Container className="py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Macros & reply templates</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Reusable reply snippets in English, Hindi, and Kannada. Glossary-aware — inserting a macro
          auto-substitutes insurance terms per the glossary for the customer's locale.
        </p>
      </Container>
    </SupportShell>
  );
}
