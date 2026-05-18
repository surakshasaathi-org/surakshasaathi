'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { buttonVariants } from '@suraksha/ui';
import { deleteAnalysisAction } from '@/server/analyse/actions';

export function DeleteAnalysisButton({
  analysisId,
  locale,
  label,
}: {
  analysisId: string;
  locale: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm(label + '?')) return;
        startTransition(async () => {
          const res = await deleteAnalysisAction(analysisId);
          if (res.ok) router.push(`/${locale}/claims-advocacy`);
        });
      }}
      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
    >
      <Trash2 className="mr-1.5 size-4" aria-hidden />
      {pending ? '…' : label}
    </button>
  );
}
