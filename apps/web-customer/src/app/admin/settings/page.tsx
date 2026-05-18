import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';

export default async function SettingsPage() {
  const session = await requireAdminSession(['super_admin', 'admin']);
  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Payment config (Razorpay), WhatsApp config (WATI), Trigger.dev, agent pricing, FX rate. Only super-admin
        rotates secrets — those live in Vercel env, not in the DB.
      </p>
    </AdminShell>
  );
}
