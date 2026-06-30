import React, { useState } from 'react';
import {
  Eye, EyeOff, Crosshair, Mail, Lock, User, ArrowLeft, CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { ErrorAlert } from '../components/ui/ErrorAlert';

type Mode = 'login' | 'register' | 'forgot-password';

interface Props {
  mode: 'login' | 'register';
  onModeChange: (m: 'login' | 'register') => void;
  onBack: () => void;
  onSuccess: () => void;
}

export function AuthPage({ mode: initialMode, onModeChange, onBack, onSuccess }: Props) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  function switchMode(m: 'login' | 'register') {
    setMode(m);
    setError('');
    onModeChange(m);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) setError(err);
      else onSuccess();
    } else {
      if (!fullName.trim()) {
        setError('Full name is required.');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email, password, fullName.trim());
      if (err) setError(err);
      else onSuccess();
    }
    setLoading(false);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (err) setError(err.message);
    else setForgotSent(true);
    setLoading(false);
  }

  if (mode === 'forgot-password') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8 justify-center">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Crosshair className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg">LeadScope<span className="text-blue-400"> AI</span></span>
          </div>
          <div className="card p-8">
            {forgotSent ? (
              <div className="text-center space-y-4">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h2 className="text-white font-bold text-xl">Check your inbox</h2>
                <p className="text-slate-400 text-sm">
                  We sent a reset link to <span className="text-slate-200">{email}</span>.
                </p>
                <button onClick={() => { setMode('login'); setForgotSent(false); }} className="btn-secondary w-full mt-2">
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => setMode('login')} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-5 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </button>
                <h2 className="text-white font-bold text-xl mb-2">Reset Password</h2>
                <p className="text-slate-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>
                {error && <ErrorAlert message={error} onClose={() => setError('')} />}
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <input type="email" className="input pl-9" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Crosshair className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-bold">LeadScope<span className="text-blue-400"> AI</span></span>
          </div>
        </div>

        <div className="card p-8">
          <div className="flex gap-1 p-1 bg-slate-800 rounded-xl mb-6">
            <button onClick={() => switchMode('login')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Sign In
            </button>
            <button onClick={() => switchMode('register')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
              Register
            </button>
          </div>

          <h2 className="text-white font-bold text-xl mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {mode === 'login' ? 'Sign in to your LeadScope AI account.' : 'Start your 7-day free trial today.'}
          </p>

          {error && <ErrorAlert message={error} onClose={() => setError('')} />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input type="text" className="input pl-9" placeholder="Your full name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
              </div>
            )}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input type="email" className="input pl-9" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pl-9 pr-10"
                  placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="text-right -mt-2">
                <button type="button" onClick={() => setMode('forgot-password')} className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
