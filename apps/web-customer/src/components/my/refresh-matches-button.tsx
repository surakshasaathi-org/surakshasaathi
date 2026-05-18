'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { refreshSchemeMatches } from '@/server/schemes/actions';

export function RefreshMatchesButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await refreshSchemeMatches();
      router.refresh();
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <RefreshCw className={`mr-1.5 size-4 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Matching…' : 'Refresh matches'}
    </Button>
  );
}
