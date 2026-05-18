'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setEnrollmentStatus, type SchemeRow } from '@/server/schemes/actions';

interface Props {
  schemeId: string;
  currentStatus: SchemeRow['enrollmentStatus'];
}

const ENROLLMENT_OPTIONS: Array<{ value: SchemeRow['enrollmentStatus']; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'renewed', label: 'Renewed' },
  { value: 'lapsed', label: 'Lapsed' },
];

export function SchemeRowActions({ schemeId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(next: SchemeRow['enrollmentStatus']) {
    startTransition(async () => {
      await setEnrollmentStatus(schemeId, next);
      router.refresh();
    });
  }

  return (
    <select
      value={currentStatus}
      disabled={pending}
      onChange={(e) => onChange(e.target.value as SchemeRow['enrollmentStatus'])}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
    >
      {ENROLLMENT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
