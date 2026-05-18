'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Image as ImageIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { startAnalysis } from '@/server/analyse/actions';
import { DemographicsForm, type DemographicsFormValue } from './demographics-form';

interface Props {
  locale: string;
  /**
   * Pre-filled demographics from the signed-in user's /my/family graph.
   * Null for anonymous users or accounts with no members. When present, the
   * wizard defaults the DemographicsForm to these values and offers a
   * one-click "Use my family" path to skip editing.
   */
  familyPrefill?: DemographicsFormValue | null;
  translations: {
    dropLabel: string;
    tapToUpload: string;
    formats: string;
    analyseCta: string;
    changeFile: string;
    selectFirst: string;
  };
}

/**
 * Two-step upload wizard:
 *
 *   Step 1 — pick a file
 *   Step 2 — (optional) tell us about your family. "Skip" falls back to
 *            extractor-synthesised members.
 *
 * Both steps submit together: the server action receives (file, demographics).
 * Demographics is persisted on policy_analysis.demographics_json and read by
 * the coverage agent.
 */
export function UploadZone({ locale, translations, familyPrefill }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSelect(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File is over 20 MB. Please compress or upload a smaller version.');
      return;
    }
    setFile(f);
  }

  function submit(demographics: DemographicsFormValue | null) {
    if (!file) {
      setError(translations.selectFirst);
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload =
        demographics && demographics.members.length > 0
          ? ({ ...demographics, locale } as unknown as Record<string, unknown>)
          : null;
      const result = await startAnalysis({
        locale,
        file,
        demographics: payload,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/${locale}/policy-health-score/analysis/${result.analysisId}`);
    });
  }

  function onFilePickerSubmit(e: FormEvent) {
    e.preventDefault();
    // Step 1 form doesn't submit — Step 2's submit handler is authoritative.
    // Only triggers if the user hits Enter in the hidden file input.
    if (!file) setError(translations.selectFirst);
  }

  const isImage = file && file.type.startsWith('image/');

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onFilePickerSubmit}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp"
          className="sr-only"
          onChange={(e) => handleSelect(e.target.files?.[0] ?? null)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer?.files?.[0];
            if (dropped) handleSelect(dropped);
          }}
          className={cn(
            'group relative flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition',
            dragOver
              ? 'border-primary bg-primary-subtle/60'
              : file
                ? 'border-success/50 bg-success-subtle/30'
                : 'border-border bg-card hover:border-primary/50 hover:bg-primary-subtle/30',
          )}
        >
          {file ? (
            <>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10 text-success">
                {isImage ? <ImageIcon className="size-6" /> : <FileText className="size-6" />}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 text-sm font-medium text-ink">
                  <CheckCircle2 className="size-4 text-success" />
                  {file.name}
                </div>
                <div className="mt-0.5 text-xs text-ink-muted">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type || 'file'}
                </div>
              </div>
              <span className="text-xs text-primary underline">{translations.changeFile}</span>
            </>
          ) : (
            <>
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:bg-primary/15">
                <Upload className="size-7" aria-hidden />
              </div>
              <div>
                <div className="text-base font-medium text-ink">{translations.dropLabel}</div>
                <div className="mt-1 text-sm text-ink-muted">{translations.tapToUpload}</div>
              </div>
              <div className="text-xs text-ink-subtle">{translations.formats}</div>
            </>
          )}
        </button>
      </form>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {file && (
        <>
          {familyPrefill && familyPrefill.members.length > 0 && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-ink">
                    Use your family? We've pre-filled {familyPrefill.members.length}{' '}
                    {familyPrefill.members.length === 1 ? 'member' : 'members'} from your account.
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    You can still edit names, ages, and conditions below before submitting.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => submit(familyPrefill)}
                  disabled={pending}
                  className="rounded-full border border-primary bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  Use my family &amp; analyse
                </button>
              </div>
            </div>
          )}
          <DemographicsForm
            locale={locale}
            initial={familyPrefill ?? null}
            submitting={pending}
            submitLabel={translations.analyseCta}
            skipLabel="Skip — analyse the policy alone"
            onSubmit={(value) => submit(value)}
            onSkip={() => submit(null)}
          />
        </>
      )}

      {!file && (
        <div className="rounded-lg border border-dashed border-border bg-background/40 p-4 text-center text-xs text-ink-subtle">
          Tip: after you pick a file, we'll ask you 30 seconds of questions about your family so the
          report speaks to YOUR situation.
        </div>
      )}
    </div>
  );
}
