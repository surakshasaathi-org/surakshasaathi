/**
 * Granular consent purposes + types. Split from consent.ts so Next.js 15's
 * 'use server' rule (only async exports allowed) stays satisfied — non-
 * async values live here, async Server Actions live in consent.ts.
 */

export const POLICY_VERSION = '2026-04-01';

export interface ConsentPurposeDef {
  id: string;
  label: string;
  description: string;
  /** When true, the app refuses to operate for this user until they grant. */
  required: boolean;
  defaultGranted: boolean;
}

export const CONSENT_PURPOSES: ConsentPurposeDef[] = [
  {
    id: 'policy_document_ocr',
    label: 'Analyse uploaded policy documents',
    description:
      "Let us read your policy PDFs with our AI so we can explain coverage and flag red flags. Without this, we can't generate analyses.",
    required: true,
    defaultGranted: true,
  },
  {
    id: 'health_pii_processing',
    label: 'Process health + family details',
    description:
      "Use the ages, pre-existing conditions, and medications you share to tailor coverage cards for YOUR family. Stored on Indian servers; you can withdraw consent any time.",
    required: false,
    defaultGranted: true,
  },
  {
    id: 'analytics',
    label: 'Product analytics',
    description:
      "Help us improve the product by sending anonymised usage events (pages viewed, features clicked). We never link this to your policy data.",
    required: false,
    defaultGranted: false,
  },
  {
    id: 'marketing_email',
    label: 'Marketing emails',
    description:
      "Occasional emails about new features, scheme deadlines, and renewal reminders. You'll still get transactional emails (account, claims) regardless.",
    required: false,
    defaultGranted: false,
  },
  {
    id: 'affiliate_referral',
    label: 'Third-party referrals',
    description:
      "When we recommend an insurer (via their own website, never broker-placed), we may earn a referral fee. Declining hides affiliate CTAs from your reports.",
    required: false,
    defaultGranted: false,
  },
];

export interface ConsentState {
  purposeId: string;
  granted: boolean;
  grantedAt: string | null;
  policyVersion: string | null;
}
