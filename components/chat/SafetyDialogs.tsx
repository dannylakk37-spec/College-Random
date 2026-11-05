'use client';

import { useEffect, useState } from 'react';
import { REPORT_REASONS, type ReportReason } from '@/lib/constants';

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md animate-fade-up rounded-3xl bg-white p-6 text-ink-900 shadow-2xl sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ReportDialog({
  open,
  onClose,
  matchId,
  partnerName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string | null;
  partnerName: string;
  onDone: (blocked: boolean) => void;
}) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setDetails('');
      setAlsoBlock(true);
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!matchId) return setError('No recent chat to report.');
    if (!reason) return setError('Pick a reason.');
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, reason, details, block: alsoBlock }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not send report.');
      onDone(alsoBlock);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send report.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-xl font-bold">Report {partnerName}</h2>
      <p className="mt-1 text-sm text-ink-900/60">
        This ends the chat. Moderators review every report. We don’t have a recording, so details help.
      </p>
      <div className="mt-5 grid gap-2">
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition ${
              reason === r.value ? 'border-brand-500 bg-brand-50' : 'border-ink-900/10 hover:border-ink-900/25'
            }`}
          >
            <input type="radio" name="reason" className="accent-brand-500" checked={reason === r.value} onChange={() => setReason(r.value)} />
            {r.label}
          </label>
        ))}
      </div>
      <textarea
        className="input mt-3 min-h-[80px] resize-none text-sm"
        maxLength={1000}
        placeholder="What happened? (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
      />
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-900/70">
        <input type="checkbox" className="accent-brand-500" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} />
        Also block {partnerName} so we’re never matched again
      </label>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={submit} disabled={sending} className="btn-danger">
          {sending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </Modal>
  );
}

export function BlockDialog({
  open,
  onClose,
  matchId,
  partnerName,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  matchId: string | null;
  partnerName: string;
  onDone: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!matchId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not block.');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not block.');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="font-display text-xl font-bold">Block {partnerName}?</h2>
      <p className="mt-2 text-sm text-ink-900/60">
        The chat ends immediately and you’ll never be matched with them again. They aren’t told they were blocked.
        If they broke the rules, please Report too.
      </p>
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button onClick={confirm} disabled={sending} className="btn-danger">
          {sending ? 'Blocking…' : 'Block'}
        </button>
      </div>
    </Modal>
  );
}
