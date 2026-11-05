'use client';

import { useCallback, useEffect, useState } from 'react';
import { REPORT_REASONS } from '@/lib/constants';

type Stats = Record<string, number>;
type Report = {
  id: string;
  created_at: string;
  reason: string;
  details: string | null;
  status: 'open' | 'actioned' | 'dismissed';
  admin_notes: string | null;
  match_id: string | null;
  reporter_id: string;
  reporter_username: string;
  reported_id: string;
  reported_username: string;
  reported_email: string;
  reported_status: string;
  reported_total_reports: number;
};
type AdminUser = {
  id: string;
  username: string;
  email: string;
  university: string | null;
  role: string;
  status: string;
  suspended_until: string | null;
  status_reason: string | null;
  email_confirmed: boolean;
  created_at: string;
  report_count: number;
  open_report_count: number;
};
type Uni = {
  id: string;
  name: string;
  short_name: string | null;
  state: string | null;
  active: boolean;
  approved_domains: { domain: string; allow_subdomains: boolean; active: boolean; notes: string | null }[];
};

const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function StatusBadge({ status, until }: { status: string; until?: string | null }) {
  const expired = status === 'suspended' && until && new Date(until) < new Date();
  const cls =
    status === 'banned'
      ? 'bg-red-100 text-red-700'
      : status === 'suspended' && !expired
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-800';
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{expired ? 'active' : status}</span>;
}

export function AdminDashboard({ myId }: { myId: string }) {
  const [tab, setTab] = useState<'overview' | 'reports' | 'users' | 'domains'>('overview');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2 border-b border-ink-900/10 pb-3">
        {(['overview', 'reports', 'users', 'domains'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
              tab === t ? 'bg-ink-900 text-white' : 'text-ink-900/60 hover:bg-ink-900/5'
            }`}
          >
            {t === 'domains' ? 'Schools & domains' : t}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" onClick={() => setError(null)}>
          {error}
        </p>
      )}
      <div className="mt-6">
        {tab === 'overview' && <Overview onError={setError} />}
        {tab === 'reports' && <Reports onError={setError} onOpenUser={setSelectedUser} />}
        {tab === 'users' && <Users onError={setError} onOpenUser={setSelectedUser} />}
        {tab === 'domains' && <Domains onError={setError} />}
      </div>
      {selectedUser && (
        <UserDrawer userId={selectedUser} myId={myId} onClose={() => setSelectedUser(null)} onError={setError} />
      )}
    </div>
  );
}

function Overview({ onError }: { onError: (e: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const load = useCallback(() => {
    call<Stats>('/api/admin/stats').then(setStats).catch((e) => onError(e.message));
  }, [onError]);
  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const items: [string, string][] = [
    ['users', 'Accounts'],
    ['verified_users', 'Verified'],
    ['waiting_now', 'In queue now'],
    ['active_matches', 'Live chats now'],
    ['matches_24h', 'Chats (24h)'],
    ['open_reports', 'Open reports'],
    ['suspended_users', 'Suspended'],
    ['banned_users', 'Banned'],
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map(([k, label]) => (
        <div key={k} className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-900/45">{label}</p>
          <p className="mt-2 font-display text-3xl font-extrabold">{stats ? (stats[k] ?? 0) : '…'}</p>
        </div>
      ))}
      <p className="col-span-full text-xs text-ink-900/45">Refreshes every 15 seconds.</p>
    </div>
  );
}

function Reports({ onError, onOpenUser }: { onError: (e: string) => void; onOpenUser: (id: string) => void }) {
  const [status, setStatus] = useState<'open' | 'actioned' | 'dismissed' | 'all'>('open');
  const [reports, setReports] = useState<Report[] | null>(null);

  const load = useCallback(() => {
    setReports(null);
    call<{ reports: Report[] }>(`/api/admin/reports?status=${status}`)
      .then((d) => setReports(d.reports))
      .catch((e) => onError(e.message));
  }, [status, onError]);
  useEffect(load, [load]);

  async function resolve(id: string, newStatus: 'actioned' | 'dismissed' | 'open') {
    try {
      await call('/api/admin/reports', 'PATCH', { id, status: newStatus });
      load();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        {(['open', 'actioned', 'dismissed', 'all'] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${status === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-900/15 text-ink-900/60'}`}>
            {s}
          </button>
        ))}
      </div>
      {!reports ? (
        <p className="mt-6 text-sm text-ink-900/50">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-ink-900/15 p-8 text-center text-sm text-ink-900/50">No reports here. 🎉</p>
      ) : (
        <div className="mt-5 space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm">
                    <button className="font-semibold text-brand-600 hover:underline" onClick={() => onOpenUser(r.reported_id)}>
                      {r.reported_username}
                    </button>{' '}
                    <span className="text-ink-900/45">({r.reported_email})</span>{' '}
                    <StatusBadge status={r.reported_status} />
                  </p>
                  <p className="mt-1 text-xs text-ink-900/50">
                    Reported by{' '}
                    <button className="hover:underline" onClick={() => onOpenUser(r.reporter_id)}>{r.reporter_username}</button> ·{' '}
                    {fmt(r.created_at)} · {r.reported_total_reports} total report(s) against this user
                  </p>
                </div>
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{reasonLabel(r.reason)}</span>
              </div>
              {r.details && <p className="mt-3 rounded-xl bg-ink-900/[.03] p-3 text-sm text-ink-900/75">“{r.details}”</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === 'open' ? (
                  <>
                    <button onClick={() => onOpenUser(r.reported_id)} className="btn-outline py-1.5 text-xs">Review user / suspend / ban</button>
                    <button onClick={() => resolve(r.id, 'actioned')} className="btn-primary py-1.5 text-xs">Mark actioned</button>
                    <button onClick={() => resolve(r.id, 'dismissed')} className="btn-ghost py-1.5 text-xs">Dismiss</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs capitalize text-ink-900/50">Status: {r.status}</span>
                    <button onClick={() => resolve(r.id, 'open')} className="btn-ghost py-1 text-xs">Reopen</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Users({ onError, onOpenUser }: { onError: (e: string) => void; onOpenUser: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);

  const load = useCallback(
    (query: string) => {
      call<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`)
        .then((d) => setUsers(d.users))
        .catch((e) => onError(e.message));
    },
    [onError],
  );
  useEffect(() => load(''), [load]);

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(q); }} className="flex gap-2">
        <input className="input max-w-sm" placeholder="Search username or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>
      <div className="mt-5 overflow-x-auto rounded-2xl border border-ink-900/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900/[.03] text-xs uppercase tracking-wider text-ink-900/50">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reports</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((u) => (
              <tr key={u.id} className="cursor-pointer border-t border-ink-900/[.06] hover:bg-brand-50/50" onClick={() => onOpenUser(u.id)}>
                <td className="px-4 py-3">
                  <p className="font-semibold">{u.username} {u.role === 'admin' && <span className="ml-1 rounded bg-brand-100 px-1.5 text-[10px] font-bold text-brand-700">ADMIN</span>}</p>
                  <p className="text-xs text-ink-900/50">{u.email}{!u.email_confirmed && ' · unverified'}</p>
                </td>
                <td className="px-4 py-3 text-ink-900/70">{u.university ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={u.status} until={u.suspended_until} /></td>
                <td className="px-4 py-3">{u.report_count}{u.open_report_count > 0 && <span className="ml-1 text-xs text-red-600">({u.open_report_count} open)</span>}</td>
                <td className="px-4 py-3 text-xs text-ink-900/55">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users && users.length === 0 && <p className="p-6 text-center text-sm text-ink-900/50">No users found.</p>}
        {!users && <p className="p-6 text-center text-sm text-ink-900/50">Loading…</p>}
      </div>
    </div>
  );
}

function UserDrawer({ userId, myId, onClose, onError }: { userId: string; myId: string; onClose: () => void; onError: (e: string) => void }) {
  const [data, setData] = useState<{ user: AdminUser | null; reports: Report[]; actions: { id: string; action: string; reason: string | null; created_at: string; admin_id: string | null }[] } | null>(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    call<typeof data>(`/api/admin/users?id=${userId}`).then(setData).catch((e) => onError(e.message));
  }, [userId, onError]);
  useEffect(load, [load]);

  async function act(action: 'suspend' | 'ban' | 'reinstate') {
    setBusy(true);
    try {
      await call('/api/admin/users', 'PATCH', { userId, action, reason, days });
      setReason('');
      load();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const u = data?.user;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="font-display text-xl font-bold">{u?.username ?? 'Loading…'}</h2>
          <button onClick={onClose} className="btn-ghost px-3 py-1">✕</button>
        </div>
        {u && (
          <>
            <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
              <dt className="text-ink-900/50">Email</dt><dd>{u.email} {u.email_confirmed ? '✓' : '(unverified)'}</dd>
              <dt className="text-ink-900/50">School</dt><dd>{u.university ?? '—'}</dd>
              <dt className="text-ink-900/50">Status</dt><dd><StatusBadge status={u.status} until={u.suspended_until} /> {u.suspended_until && <span className="text-xs text-ink-900/50">until {fmt(u.suspended_until)}</span>}</dd>
              {u.status_reason && (<><dt className="text-ink-900/50">Reason</dt><dd>{u.status_reason}</dd></>)}
              <dt className="text-ink-900/50">Joined</dt><dd>{fmt(u.created_at)}</dd>
              <dt className="text-ink-900/50">User ID</dt><dd className="break-all font-mono text-xs">{u.id}</dd>
            </dl>

            {u.id !== myId && (
              <div className="mt-6 rounded-2xl border border-ink-900/10 p-4">
                <p className="text-sm font-semibold">Moderation</p>
                <input className="input mt-3 text-sm" placeholder="Reason (shown to the user)" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select className="input w-auto py-2 text-sm" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    {[1, 3, 7, 30, 90].map((d) => <option key={d} value={d}>{d} day{d > 1 ? 's' : ''}</option>)}
                  </select>
                  <button disabled={busy} onClick={() => act('suspend')} className="btn bg-amber-500 py-2 text-xs text-white hover:bg-amber-600">Suspend</button>
                  <button disabled={busy} onClick={() => act('ban')} className="btn-danger py-2 text-xs">Ban permanently</button>
                  {u.status !== 'active' && (
                    <button disabled={busy} onClick={() => act('reinstate')} className="btn-outline py-2 text-xs">Reinstate</button>
                  )}
                </div>
              </div>
            )}

            <h3 className="mt-8 text-sm font-semibold">Report history</h3>
            {data!.reports.length === 0 ? (
              <p className="mt-2 text-sm text-ink-900/50">No reports involving this user.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data!.reports.map((r) => (
                  <li key={r.id} className="rounded-xl bg-ink-900/[.03] p-3 text-sm">
                    <p>
                      <strong>{r.reported_id === userId ? 'Reported by' : 'Filed against'}</strong>{' '}
                      {r.reported_id === userId ? r.reporter_username : r.reported_username} · {reasonLabel(r.reason)}{' '}
                      <span className="text-xs capitalize text-ink-900/45">({r.status})</span>
                    </p>
                    <p className="text-xs text-ink-900/45">{fmt(r.created_at)}</p>
                    {r.details && <p className="mt-1 text-ink-900/70">“{r.details}”</p>}
                  </li>
                ))}
              </ul>
            )}

            <h3 className="mt-8 text-sm font-semibold">Moderation log</h3>
            {data!.actions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-900/50">No actions yet.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {data!.actions.map((a) => (
                  <li key={a.id}>
                    <span className="font-semibold capitalize">{a.action.replace('_', ' ')}</span>
                    {a.reason && <> — {a.reason}</>}{' '}
                    <span className="text-xs text-ink-900/45">{fmt(a.created_at)}{a.admin_id ? '' : ' · automatic'}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function Domains({ onError }: { onError: (e: string) => void }) {
  const [unis, setUnis] = useState<Uni[] | null>(null);
  const [domain, setDomain] = useState('');
  const [uniId, setUniId] = useState('');
  const [newName, setNewName] = useState('');
  const [newShort, setNewShort] = useState('');
  const [newState, setNewState] = useState('');
  const [subs, setSubs] = useState(true);

  const load = useCallback(() => {
    call<{ universities: Uni[] }>('/api/admin/domains').then((d) => setUnis(d.universities)).catch((e) => onError(e.message));
  }, [onError]);
  useEffect(load, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await call('/api/admin/domains', 'POST', {
        domain,
        universityId: uniId || undefined,
        universityName: uniId ? undefined : newName,
        shortName: newShort,
        state: newState,
        allowSubdomains: subs,
      });
      setDomain(''); setNewName(''); setNewShort(''); setNewState('');
      load();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function patch(body: Record<string, unknown>) {
    try { await call('/api/admin/domains', 'PATCH', body); load(); } catch (e) { onError((e as Error).message); }
  }
  async function remove(d: string) {
    if (!window.confirm(`Remove ${d}? New sign-ups from this domain will be rejected. Existing accounts are not affected.`)) return;
    try { await call(`/api/admin/domains?domain=${encodeURIComponent(d)}`, 'DELETE'); load(); } catch (e) { onError((e as Error).message); }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <form onSubmit={add} className="card h-fit space-y-3 p-5">
        <p className="font-semibold">Approve an email domain</p>
        <p className="text-xs text-ink-900/55">
          Only addresses on this list can register. A school email doesn’t prove current enrollment — staff and alumni
          may keep addresses — so prefer student-specific domains (e.g. <code>students.example.edu</code>) when a school has one.
        </p>
        <div>
          <label className="label text-xs">Domain</label>
          <input className="input text-sm" placeholder="university.edu" value={domain} onChange={(e) => setDomain(e.target.value)} />
        </div>
        <div>
          <label className="label text-xs">University</label>
          <select className="input text-sm" value={uniId} onChange={(e) => setUniId(e.target.value)}>
            <option value="">+ New university…</option>
            {(unis ?? []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {!uniId && (
          <div className="space-y-2 rounded-xl bg-ink-900/[.03] p-3">
            <input className="input text-sm" placeholder="Full name, e.g. University of Oregon" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex gap-2">
              <input className="input text-sm" placeholder="Short name (UO)" value={newShort} onChange={(e) => setNewShort(e.target.value)} />
              <input className="input w-24 text-sm" placeholder="State" maxLength={2} value={newState} onChange={(e) => setNewState(e.target.value)} />
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={subs} onChange={(e) => setSubs(e.target.checked)} className="accent-brand-500" />
          Also accept subdomains (e.g. cs.university.edu)
        </label>
        <button className="btn-primary w-full">Add domain</button>
      </form>

      <div className="space-y-3">
        {!unis && <p className="text-sm text-ink-900/50">Loading…</p>}
        {(unis ?? []).map((u) => (
          <div key={u.id} className={`card p-4 ${u.active ? '' : 'opacity-60'}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">{u.name} <span className="text-xs font-normal text-ink-900/45">{u.short_name} {u.state}</span></p>
              <button onClick={() => patch({ universityId: u.id, active: !u.active })} className="btn-ghost py-1 text-xs">
                {u.active ? 'Disable school' : 'Enable school'}
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {u.approved_domains.length === 0 && <span className="text-xs text-red-600">No domains — nobody can sign up</span>}
              {u.approved_domains.map((d) => (
                <span key={d.domain} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${d.active ? 'border-ink-900/15' : 'border-dashed border-ink-900/20 text-ink-900/40 line-through'}`}>
                  @{d.allow_subdomains ? '*.' : ''}{d.domain}
                  <button title="Toggle subdomains" onClick={() => patch({ domain: d.domain, allowSubdomains: !d.allow_subdomains })} className="text-ink-900/40 hover:text-ink-900">⇄</button>
                  <button title={d.active ? 'Pause' : 'Resume'} onClick={() => patch({ domain: d.domain, active: !d.active })} className="text-ink-900/40 hover:text-ink-900">{d.active ? '⏸' : '▶'}</button>
                  <button title="Remove" onClick={() => remove(d.domain)} className="text-red-400 hover:text-red-600">✕</button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
