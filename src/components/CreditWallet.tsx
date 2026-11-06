import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createTopUpSession, TOP_UP_PACKS } from '../lib/stripe';

type Balance = { monthly: number; top_up: number; next_expiry: string | null; legacy_access: boolean };
type CreditPrice = { action: string; label: string; credits: number };
type Entry = { label: string; credits: number; occurred_at: string };
type Pack = (typeof TOP_UP_PACKS)[number];

export function CreditWallet({ compact = false }: { compact?: boolean }) {
  const [balance, setBalance] = useState<Balance>();
  const [prices, setPrices] = useState<CreditPrice[]>([]);
  const [history, setHistory] = useState<Entry[]>([]);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [opening, setOpening] = useState<number>();

  const load = useCallback(async (reconcile = false) => {
    setChecking(true);
    setError('');
    const sync = reconcile ? await supabase.functions.invoke('sync-subscription') : null;
    const [wallet, priceList, entries] = await Promise.all([
      supabase.rpc('get_credit_balance').single<Balance>(),
      compact ? null : supabase.from('credit_prices').select('action, label, credits').order('label'),
      compact ? null : supabase.rpc('get_credit_history'),
    ]);
    if (wallet.data) setBalance(wallet.data);
    if (priceList?.data) setPrices(priceList.data);
    if (entries?.data) setHistory(entries.data);
    if (wallet.error || priceList?.error || entries?.error) setError('Could not load wallet details.');
    else if (sync?.error) setError('Could not refresh the subscription from Stripe.');
    setChecking(false);
  }, [compact]);

  useEffect(() => { void load(); }, [load]);

  async function topUp(pack: Pack) {
    setOpening(pack.cents);
    setError('');
    const result = await createTopUpSession(pack.cents);
    if (result.url) window.location.assign(result.url);
    else setError(result.error ?? 'Could not open checkout.');
    setOpening(undefined);
  }

  return (
    <div className="space-y-4">
      {balance ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-xs text-slate-400">Monthly credits</p>
            <p className="text-lg font-semibold text-white">{balance.monthly.toLocaleString()}</p>
            {balance.next_expiry && <p className="text-xs text-slate-400">Next expiry {new Date(balance.next_expiry).toLocaleDateString()}</p>}
          </div>
          <div className="rounded-lg bg-slate-800/60 p-3">
            <p className="text-xs text-slate-400">Non-expiring credits</p>
            <p className="text-lg font-semibold text-white">{balance.top_up.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Never expire</p>
          </div>
        </div>
      ) : checking && <p className="text-sm text-slate-400">Loading credits…</p>}
      {balance?.legacy_access && <p className="text-sm text-slate-400">Your legacy subscription includes access while its billing period is active.</p>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {!compact && (
        <>
          <div className="flex flex-wrap gap-2">
            {TOP_UP_PACKS.map(pack => (
              <button key={pack.cents} onClick={() => void topUp(pack)} disabled={opening !== undefined} className="btn-secondary text-sm">
                {opening === pack.cents ? 'Opening checkout…' : '$' + pack.cents / 100 + ' · ' + pack.credits.toLocaleString() + ' credits'}
              </button>
            ))}
            <button disabled={checking} onClick={() => void load(true)} className="btn-secondary text-sm">Refresh wallet</button>
          </div>
          <p className="text-sm text-slate-400">Top-ups are charged in USD. Monthly credits are used first. Credits are charged when a paid action starts, including attempts with no results.</p>
          <div className="grid gap-5 md:grid-cols-2">
            <section>
              <h3 className="mb-2 font-medium text-white">Credits per action</h3>
              <dl className="space-y-1 text-sm text-slate-300">
                <div className="flex justify-between gap-3"><dt>Core CRM and saved leads</dt><dd>Free</dd></div>
                {prices.map(price => (
                  <div className="flex justify-between gap-3" key={price.action}><dt>{price.label}</dt><dd>{price.credits.toLocaleString()}</dd></div>
                ))}
              </dl>
            </section>
            <section>
              <h3 className="mb-2 font-medium text-white">Recent credit activity</h3>
              {history.length ? (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">
                  {history.map((entry, index) => (
                    <li className="flex justify-between gap-3" key={entry.occurred_at + index}>
                      <span>{entry.label} <time className="text-xs text-slate-500">{new Date(entry.occurred_at).toLocaleDateString()}</time></span>
                      <span>{entry.credits > 0 ? '+' : ''}{entry.credits.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-slate-400">No credit activity yet.</p>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
