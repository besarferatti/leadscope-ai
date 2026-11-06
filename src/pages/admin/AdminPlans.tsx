import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Price = { action: string; label: string; credits: number };

export function AdminPlans() {
  const [prices, setPrices] = useState<Price[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string>();
  const [message, setMessage] = useState('');

  useEffect(() => {
    void supabase.from('credit_prices').select('action, label, credits').order('label').then(({ data, error }) => {
      if (error) setMessage('Unable to load credit prices.');
      else setPrices(data);
    });
  }, []);

  async function save(price: Price) {
    const raw = editing[price.action] ?? '';
    const credits = Number(raw);
    if (raw === '' || !Number.isInteger(credits) || credits < 0 || credits > 1000000) {
      setMessage('Enter a whole number between 0 and 1,000,000.');
      return;
    }
    setSaving(price.action);
    const { error } = await supabase.rpc('set_credit_price', { p_action: price.action, p_credits: credits });
    if (error) setMessage('Unable to save the credit price.');
    else {
      setPrices(current => current.map(item => item.action === price.action ? { ...item, credits } : item));
      setMessage(price.label + ' price saved.');
    }
    setSaving(undefined);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Plans and credit prices</h1>
        <p className="mt-1 text-sm text-slate-400">PRO costs €69 per month and includes 7,400 credits. Price changes apply to future actions.</p>
      </div>
      {message && <p role="status" className="text-sm text-slate-300">{message}</p>}
      <div className="card divide-y divide-slate-800 px-5">
        {prices.map(price => (
          <form key={price.action} className="flex flex-wrap items-center justify-between gap-3 py-3"
            onSubmit={event => { event.preventDefault(); void save(price); }}>
            <label htmlFor={price.action} className="text-sm text-slate-300">{price.label}</label>
            <div className="flex items-center gap-2">
              <input id={price.action} type="number" min={0} max={1000000} step={1}
                className="input-field w-32" value={editing[price.action] ?? price.credits}
                onChange={event => setEditing(current => ({ ...current, [price.action]: event.target.value }))} />
              <button type="submit" className="btn-secondary text-sm" disabled={saving !== undefined || editing[price.action] === undefined}>Save</button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
