'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { summarize, type AdminUser, type Generation } from '@/lib/admin-analytics';
import styles from './admin-dashboard.module.css';

type Data = { users: AdminUser[]; generations: Generation[]; summary: ReturnType<typeof summarize>;
  deposits: number; walletLiability: number; trackingConfigured: boolean; since: string; until: string };
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(cents / 100);

export function AdminDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');
  const [tab, setTab] = useState('overview');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('activity');
  const [selected, setSelected] = useState('');
  const [provider, setProvider] = useState('all');
  const [page, setPage] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    setLoading(true); setError(''); setData(null);
    try {
      const session = await supabase?.auth.getSession();
      const token = session?.data.session?.access_token;
      if (!token) throw new Error('Sign in with the owner account in Studio, then return here.');
      const response = await fetch(`/api/admin/analytics?days=${days}`, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Analytics unavailable.');
      if (!signal.aborted) setData(body);
    } catch (error) {
      if (!signal.aborted) setError(error instanceof Error ? error.message : 'Analytics unavailable.');
    } finally { if (!signal.aborted) setLoading(false); }
  }, [days]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { const controller = new AbortController(); queueMicrotask(() => { if (!controller.signal.aborted) void load(controller.signal); }); return () => controller.abort(); }, [load, refresh]);
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setData(null); setError('Sign in with the owner account.'); setRefresh(value => value + 1); }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);
  const users = useMemo(() => (data?.users ?? []).map(user => ({ ...user,
    ...summarize(data?.generations.filter(row => row.owner_id === user.id) ?? []),
    lastActive: data?.generations.find(row => row.owner_id === user.id)?.created_at,
  })).filter(user => `${user.email} ${user.full_name}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'revenue' ? b.revenue - a.revenue : sort === 'cost' ? b.cost - a.cost : sort === 'failures' ? b.failed - a.failed : b.count - a.count), [data, search, sort]);
  const rows = (data?.generations ?? []).filter(row => (!selected || row.owner_id === selected) && (provider === 'all' || row.provider === provider));
  const daily = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of data?.generations ?? []) counts.set(row.created_at.slice(0, 10), (counts.get(row.created_at.slice(0, 10)) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);
  return <main className={styles.admin}>
    <header className={styles.header}><a href="/studio"><ArrowLeft size={17} /> Studio</a><span><ShieldCheck size={18} /> Owner administration</span></header>
    <div className={styles.heading}><h1>ClipWeave Analytics</h1><div className={styles.controls}>
      <label>Period<select value={days} onChange={event => { setDays(event.target.value); setPage(0); }}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select></label>
      <button title="Refresh analytics" aria-label="Refresh analytics" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={18} /></button>
    </div></div>
    <nav className={styles.tabs} aria-label="Analytics views">{['overview', 'users', 'generations'].map(value => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => { setTab(value); setPage(0); }}>{value}</button>)}</nav>
    {loading && <p role="status">Loading analytics...</p>}
    {error && <p className={styles.warning} role="alert">{error}</p>}
    {data && <>
      <p className={styles.warning}>Estimates exclude OpenAI tools, idle GPU time, storage, payment fees, refunds and operating expenses. Historical OpenAI requests are not backfilled. Net profit is unavailable until these costs are reconciled.</p>
      {!data.trackingConfigured && <p className={styles.warning}>Usage tracking is not configured: SUPABASE_SERVICE_ROLE_KEY is required on the server. New OpenAI calls and failed-render costs are not being recorded.</p>}
      {tab === 'overview' && <>
        <section className={styles.metrics} aria-label="Financial overview">
          {[['Earned render revenue', money(data.summary.revenue)], ['Known provider cost (est.)', money(data.summary.cost)], ['Partial contribution (est.)', money(data.summary.margin)], ['Net profit', 'Unavailable'], ['Wallet deposits', money(data.deposits)], ['Outstanding wallet credit', money(data.walletLiability)], ['Generations', String(data.summary.count)], ['Missing generation costs', String(data.summary.unknown)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </section>
        <section><h2>Generation activity</h2><div className={styles.reliability}><span>Active users <strong>{users.filter(user => user.count > 0).length}</strong></span><span>Completed <strong>{data.summary.completed}</strong></span><span>Failed / cancelled <strong>{data.summary.failed}</strong></span><span>In progress <strong>{data.summary.active}</strong></span><span>Success rate <strong>{data.summary.successRate === null ? 'No completed attempts' : `${data.summary.successRate.toFixed(1)}%`}</strong></span></div>
          <div className={styles.chart} aria-label="Daily generation counts in UTC">{daily.map(([date, count]) => <div key={date} title={`${date}: ${count} generations`}><span style={{ height: `${Math.max(3, count / Math.max(...daily.map(([, n]) => n)) * 100)}%` }} /><small>{date.slice(5)}</small><b>{count}</b></div>)}</div>
          {!daily.length && <p>No generations in this period.</p>}
        </section>
        <section><h2>Provider breakdown</h2><div className={styles.reliability}>{(['runpod', 'openai'] as const).map(name => { const totals = summarize(data.generations.filter(row => row.provider === name)); return <div key={name}><h3>{name === 'openai' ? 'OpenAI / ChatGPT' : 'RunPod'}</h3><p>{totals.count} attempts · {money(totals.cost)} known estimate · {totals.unknown} unknown costs</p></div>; })}</div></section>
      </>}
      {tab === 'users' && <section><div className={styles.controls}><label><Search size={16} /> Search users<input value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} /></label><label>Sort by<select value={sort} onChange={event => { setSort(event.target.value); setPage(0); }}><option value="activity">Most active</option><option value="revenue">Highest revenue</option><option value="cost">Highest known cost</option><option value="failures">Most failures</option></select></label></div>
        <div className={styles.tableWrap}><table><thead><tr>{['User', 'Generations', 'Revenue', 'Cost (est.)', 'Unknown costs', 'Failures', 'Last activity'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{users.slice(page * 25, page * 25 + 25).map(user => <tr key={user.id}><td><button className={styles.userLink} onClick={() => { setSelected(user.id); setTab('generations'); setPage(0); }}>{user.full_name || user.email}<small>{user.email}</small></button></td><td>{user.count}</td><td>{money(user.revenue)}</td><td>{money(user.cost)}</td><td>{user.unknown}</td><td>{user.failed}</td><td>{user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'No activity'}</td></tr>)}</tbody></table></div>
        {!users.length && <p>No matching users.</p>}
      </section>}
      {tab === 'generations' && <section><div className={styles.controls}><label>User<select value={selected} onChange={event => { setSelected(event.target.value); setPage(0); }}><option value="">All users</option>{data.users.map(user => <option key={user.id} value={user.id}>{user.email}</option>)}</select></label><label>Provider<select value={provider} onChange={event => { setProvider(event.target.value); setPage(0); }}><option value="all">All providers</option><option value="runpod">RunPod</option><option value="openai">OpenAI / ChatGPT</option></select></label></div>
        <div className={styles.tableWrap}><table><thead><tr>{['Created', 'User / project', 'Provider / action', 'Status', 'Usage', 'Revenue', 'Cost (est.)'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(page * 25, page * 25 + 25).map(row => <tr key={`${row.provider}-${row.id}`}><td>{new Date(row.created_at).toLocaleString()}<small>{row.id}</small></td><td>{data.users.find(user => user.id === row.owner_id)?.email ?? row.owner_id ?? 'Local development'}<small>{row.project_id ?? 'No project'}</small></td><td>{row.provider}<small>{row.model ?? row.action ?? 'render'}</small></td><td><span className={styles.status} data-status={row.status}>{row.status}</span></td><td>{row.provider === 'runpod' ? row.runtime_ms == null ? 'Unknown runtime' : `${(row.runtime_ms / 1000).toFixed(1)} sec` : `${row.input_tokens ?? '?'} in / ${row.output_tokens ?? '?'} out`}</td><td>{money(row.revenue)}</td><td>{row.cost === null ? 'Unknown' : money(Number(row.cost))}</td></tr>)}</tbody></table></div>
        {!rows.length && <p>No generations match these filters.</p>}
      </section>}
      {tab !== 'overview' && <div className={styles.pagination}><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil((tab === 'users' ? users.length : rows.length) / 25))}</span><button disabled={(page + 1) * 25 >= (tab === 'users' ? users.length : rows.length)} onClick={() => setPage(value => value + 1)}>Next</button></div>}
      <footer className={styles.footer}>USD · Activity cohort by generation start · UTC {data.since.slice(0, 10)} to {data.until.slice(0, 10)} · Wallet credit is current, not period-bound</footer>
    </>}
  </main>;
}
