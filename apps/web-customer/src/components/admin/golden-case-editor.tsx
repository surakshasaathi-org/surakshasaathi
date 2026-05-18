'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Paperclip, Save, Trash2, X } from 'lucide-react';
import {
  createGoldenCase,
  deleteGoldenCase,
  setCaseAttachment,
  updateGoldenCase,
  uploadCaseAttachment,
} from '@/server/admin/evals/golden-actions';

/** Agents that take a PDF/image as the under-test input. */
const PDF_INPUT_AGENTS = new Set(['policy-intake-classifier', 'policy-extractor']);

type Mode =
  | { kind: 'edit'; caseId: string }
  | { kind: 'create' };

interface Initial {
  name: string;
  description: string;
  tagsCsv: string;
  enabled: boolean;
  expectedExtractionJson: string;
  expectedCoverageJson: string;
  expectedChatQaJson: string;
  demographicsJson: string;
  policyDocumentId: string | null;
  attachmentMeta: {
    mime: string;
    sizeBytes: number;
    contentSha256: string;
  } | null;
}

interface Props {
  agentSlug: string;
  mode: Mode;
  initial: Initial;
}

export function GoldenCaseEditor({ agentSlug, mode, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Initial>(initial);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const showPdfUpload = PDF_INPUT_AGENTS.has(agentSlug);

  function set<K extends keyof Initial>(k: K, v: Initial[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function onUploadPdf(file: File) {
    setUploadPending(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await uploadCaseAttachment(fd);
      if (!res.ok || !res.documentId) {
        setFeedback({ kind: 'err', msg: res.error ?? 'Upload failed.' });
        return;
      }
      const newDocId = res.documentId;
      setForm((prev) => ({
        ...prev,
        policyDocumentId: newDocId,
        attachmentMeta: {
          mime: file.type,
          sizeBytes: file.size,
          contentSha256: '(saved)',
        },
      }));

      // Edit mode: persist the link immediately so the next eval Run picks
      // up the new attachment without waiting for the operator to click Save.
      if (mode.kind === 'edit') {
        const linkRes = await setCaseAttachment({
          caseId: mode.caseId,
          agentSlug,
          policyDocumentId: newDocId,
        });
        if (!linkRes.ok) {
          setFeedback({
            kind: 'err',
            msg: `Uploaded but couldn't persist link: ${linkRes.error ?? 'unknown error'}. Click Save to retry.`,
          });
          return;
        }
        setFeedback({
          kind: 'ok',
          msg: 'Uploaded + linked. Re-run the eval to use this PDF.',
        });
        router.refresh();
      } else {
        setFeedback({
          kind: 'ok',
          msg: 'Uploaded. Click Create case below to persist the link.',
        });
      }
    } catch (err) {
      // Server-action throws (auth deny, network) land here — surface the
      // real reason so the operator knows the upload didn't take.
      setFeedback({
        kind: 'err',
        msg: `Upload failed: ${(err as Error).message}`,
      });
    } finally {
      setUploadPending(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function clearAttachment() {
    setForm((prev) => ({ ...prev, policyDocumentId: null, attachmentMeta: null }));
    if (mode.kind === 'edit') {
      try {
        await setCaseAttachment({
          caseId: mode.caseId,
          agentSlug,
          policyDocumentId: null,
        });
        router.refresh();
      } catch (err) {
        setFeedback({
          kind: 'err',
          msg: `Cleared in form but couldn't persist: ${(err as Error).message}. Click Save to retry.`,
        });
      }
    }
  }

  function onSave() {
    setFeedback(null);
    start(async () => {
      const res =
        mode.kind === 'edit'
          ? await updateGoldenCase({ caseId: mode.caseId, agentSlug, payload: form })
          : await createGoldenCase({ agentSlug, payload: form });
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error ?? 'Save failed.' });
        return;
      }
      if (mode.kind === 'create' && 'caseId' in res && res.caseId) {
        router.push(`/admin/agents/${agentSlug}/golden-cases/${res.caseId}`);
        return;
      }
      setFeedback({ kind: 'ok', msg: 'Saved.' });
      router.refresh();
    });
  }

  function onDelete() {
    if (mode.kind !== 'edit') return;
    if (!confirm('Delete this golden case? This cannot be undone.')) return;
    start(async () => {
      await deleteGoldenCase({ caseId: mode.caseId, agentSlug });
      router.push(`/admin/agents/${agentSlug}/golden-cases`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink"
          />
        </Field>
        <Field label="Tags (comma-separated; agent slug auto-included)">
          <input
            value={form.tagsCsv}
            onChange={(e) => set('tagsCsv', e.target.value)}
            disabled={pending}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-ink"
            placeholder={`${agentSlug}, synthetic, ...`}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          disabled={pending}
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink"
        />
      </Field>

      <label className="inline-flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
          disabled={pending}
        />
        <span className="text-ink-muted">enabled (included in nightly eval runs)</span>
      </label>

      {showPdfUpload && (
        <Field label="PDF / image attachment (real fixture)">
          <div className="space-y-3 rounded-md border border-dashed border-border bg-card p-3">
            {form.attachmentMeta && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-background p-2">
                <div className="flex items-center gap-2 text-xs text-ink">
                  <Paperclip className="size-4 text-ink-muted" />
                  <div>
                    <div className="font-medium">
                      {form.attachmentMeta.mime} ·{' '}
                      {(form.attachmentMeta.sizeBytes / 1024).toFixed(1)} KB
                    </div>
                    <div className="font-mono text-[10px] text-ink-subtle">
                      doc_id: {form.policyDocumentId}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void clearAttachment()}
                  disabled={pending || uploadPending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-ink-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                >
                  <X className="size-3" />
                  Clear
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs text-ink-muted">
                {form.attachmentMeta
                  ? 'Replace the attached fixture, or clear it to fall back to the synthetic PDF generated from synthetic_first_pages_text.'
                  : 'Upload a real policy PDF/image fixture. The eval runner attaches it inline — same code path as production. Without an upload, the runner falls back to a synthetic PDF generated from synthetic_first_pages_text.'}
              </p>
              <label
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-ink ${
                  uploadPending || pending
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:border-primary/40 hover:text-primary'
                }`}
              >
                <Paperclip className="size-3.5" />
                {uploadPending
                  ? 'Uploading…'
                  : form.attachmentMeta
                    ? 'Replace PDF'
                    : 'Upload PDF'}
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadPending || pending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onUploadPdf(f);
                  }}
                />
              </label>
            </div>
          </div>
        </Field>
      )}

      <JsonField
        label="expectedExtraction"
        hint='Object with synthetic_first_pages_text, intake_label, score_expectations, etc. Use "null" if not applicable.'
        value={form.expectedExtractionJson}
        onChange={(v) => set('expectedExtractionJson', v)}
        disabled={pending}
      />
      <JsonField
        label="expectedCoverage"
        hint='Expected shape for the policy-coverage agent output. "null" if not applicable.'
        value={form.expectedCoverageJson}
        onChange={(v) => set('expectedCoverageJson', v)}
        disabled={pending}
      />
      <JsonField
        label="expectedChatQa"
        hint='Array of { question, expected_answer } pairs for customer-explainer. "null" if not applicable.'
        value={form.expectedChatQaJson}
        onChange={(v) => set('expectedChatQaJson', v)}
        disabled={pending}
      />
      <JsonField
        label="demographicsJson"
        hint='Family profile for member-card generation. "null" if not applicable.'
        value={form.demographicsJson}
        onChange={(v) => set('demographicsJson', v)}
        disabled={pending}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-3.5" />
            {pending ? 'Saving…' : mode.kind === 'create' ? 'Create case' : 'Save changes'}
          </button>
          {feedback && (
            <span
              className={`text-xs ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}
            >
              {feedback.msg}
            </span>
          )}
        </div>
        {mode.kind === 'edit' && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs font-medium text-danger hover:border-danger/60 disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </span>
      {children}
    </label>
  );
}

function JsonField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </span>
        <span className="text-[10px] text-ink-subtle">JSON</span>
      </div>
      <p className="text-[11px] text-ink-muted">{hint}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        className="min-h-[120px] w-full rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] text-ink focus:border-primary/40 focus:outline-none"
      />
    </div>
  );
}
