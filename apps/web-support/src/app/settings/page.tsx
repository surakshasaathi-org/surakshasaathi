import { SupportShell } from '@/components/support-shell';
import { Container } from '@suraksha/ui';

export default function SettingsPage() {
  return (
    <SupportShell email={null}>
      <Container className="py-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          Working hours, availability, signature, notification preferences.
        </p>
      </Container>
    </SupportShell>
  );
}
