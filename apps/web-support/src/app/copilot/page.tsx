import { SupportShell } from '@/components/support-shell';
import { Container } from '@suraksha/ui';

export default function CopilotSettings() {
  return (
    <SupportShell email={null}>
      <Container className="py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Co-pilot settings</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Configure the support-drafter agent: tone, max length, whether to cite policy clauses, and which
          knowledge sources it grounds in. Changes here create a new version of the <code>support-drafter</code>
          agent_definition — same pattern as the admin Agents page.
        </p>
      </Container>
    </SupportShell>
  );
}
