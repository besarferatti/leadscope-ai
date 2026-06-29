import React, { useState } from 'react';
import { Eye, EyeOff, Lock, CheckCircle, Crosshair } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { ErrorAlert } from '../components/ui/ErrorAlert';

interface Props {
  // When must_change_password is true, hide back/cancel
  required?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ChangePasswordPage({ required, onSuccess, onCancel }: Props) {
  const { user, profile, refreshProfile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (current === next) {
      setError('New password must be different from your current password.');
      return;
    }

    setLoading(true);

    // Verify current password by re-signing in
    const email = user?.email ?? profile?.email ?? '';
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyError) {
      setError('Current password is incorrect.');
      setLoading(false);
      return;
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Clear must_change_password flag
    await supabase.from('user_profiles').update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id);

    await refreshProfile();
    setSuccess(true);
    setLoading(false);
    setCurrent('');
    setNext('');
    setConfirm('');

    if (onSuccess) setTimeout(onSuccess, 1500);
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Crosshair className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-lg">LeadScope<span className="text-blue-400"> AI</span></span>
        </div>

        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Change Password</h1>
              {required && (
                <p className="text-amber-400 text-xs mt-0.5">You must change your password before continuing.</p>
              )}
            </div>
          </div>

          {error && <ErrorAlert message={error} onClose={() => setError('')} />}

          {success ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-400" />
              <p className="text-white font-semibold">Password changed successfully!</p>
              <p className="text-slate-400 text-sm">You're now signed in with your new password.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Enter current password"
                    value={current}
                    onChange={e => setCurrent(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNext ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Min. 8 characters"
                    value={next}
                    onChange={e => setNext(e.target.value)}
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowNext(!showNext)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  className={`input ${confirm && confirm !== next ? 'border-red-500/50' : ''}`}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
                {confirm && confirm !== next && (
                  <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {!required && onCancel && (
                  <button type="button" onClick={onCancel} className="btn-secondary flex-1">
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !current || !next || !confirm}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
