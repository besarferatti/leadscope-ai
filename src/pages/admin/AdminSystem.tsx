import { useState } from 'react';
import { Save, AlertTriangle } from 'lucide-react';

interface SystemSettings {
  appName: string;
  supportEmail: string;
  trialDays: number;
  maintenanceMode: boolean;
  allowSignups: boolean;
}

export function AdminSystem() {
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'LeadScope AI',
    supportEmail: 'support@leadscope.pro',
    trialDays: 7,
    maintenanceMode: false,
    allowSignups: true,
  });
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">System Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Global application configuration.</p>
      </div>

      <div className="card p-4 border border-amber-500/20 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">
            These settings are currently local only. Connect to a <code className="bg-slate-800 px-1 rounded text-xs">system_settings</code> database table to persist across sessions.
          </p>
        </div>
      </div>

      <div className="card p-6 space-y-6 max-w-lg">
        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">App Name</label>
          <input
            className="input"
            value={settings.appName}
            onChange={e => setSettings(s => ({ ...s, appName: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">Support Email</label>
          <input
            className="input"
            type="email"
            value={settings.supportEmail}
            onChange={e => setSettings(s => ({ ...s, supportEmail: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-slate-300 text-sm font-medium mb-1.5">Default Trial Days</label>
          <input
            className="input"
            type="number"
            min={1}
            max={90}
            value={settings.trialDays}
            onChange={e => setSettings(s => ({ ...s, trialDays: Number(e.target.value) }))}
          />
          <p className="text-slate-500 text-xs mt-1">Days new users get on the free trial plan.</p>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-slate-300 text-sm font-medium">Maintenance Mode</p>
              <p className="text-slate-500 text-xs">Blocks all non-admin access with a maintenance message.</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.maintenanceMode ? 'bg-red-500' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.maintenanceMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-slate-300 text-sm font-medium">Allow New Signups</p>
              <p className="text-slate-500 text-xs">When disabled, the register page shows a waitlist message.</p>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, allowSignups: !s.allowSignups }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.allowSignups ? 'bg-emerald-500' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.allowSignups ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </label>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSave} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            Save Settings
          </button>
          {saved && <span className="text-emerald-400 text-sm">Saved!</span>}
        </div>
      </div>
    </div>
  );
}
