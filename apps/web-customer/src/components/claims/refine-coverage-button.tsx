'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, AlertCircle } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { DemographicsForm, type DemographicsFormValue } from './demographics-form';
import { refineCoverageForAnalysis } from '@/server/analyse/refine';

interface Props {
  analysisId: string;
  locale: string;
  initialDemographics: DemographicsFormValue | null;
}

/**
 * "Refine for your family" — opens the demographics form in a dialog and
 * re-runs only the coverage agent. ~₹3 per refresh vs ~₹20 for a full
 * re-upload.
 */
export function RefineCoverageButton({ analysisId, locale, initialDemographics }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(value: DemographicsFormValue) {
    setError(null);
    startTransition(async () => {
      const result = await refineCoverageForAnalysis(analysisId, {
        ...value,
        locale: locale as 'en' | 'hi' | 'kn',
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/10"
      >
        <Sparkles className="size-3.5" />
        Refine for your family
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="mt-10 w-full max-w-2xl rounded-2xl bg-background shadow-floating">
            <header className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-display text-base font-semibold text-ink">
                Refine coverage for your family
              </h2>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-ink-muted hover:bg-background hover:text-ink disabled:opacity-50"
                disabled={pending}
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-5">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 flex-none" />
                  <span>{error}</span>
                </div>
              )}

              <DemographicsForm
                locale={locale}
                initial={initialDemographics}
                submitting={pending}
                submitLabel="Update coverage cards"
                onSubmit={submit}
                heading="Who's actually on this policy?"
                subheading="We'll re-run the coverage agent with fresh inputs. ~₹3 per refresh, counts toward your daily free budget."
              />

              <div className="mt-4 flex items-center justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => !pending && setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
