import React from 'react';
import { X, TrendingUp, ArrowRight } from 'lucide-react';

interface Props {
  message?: string;
  onViewPlans: () => void;
  onClose: () => void;
}

export function UpgradeModal({ message, onViewPlans, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="card p-6 w-full max-w-md relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="text-white font-semibold text-lg">Upgrade to continue</h3>
        </div>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          {message ?? "You've reached your current plan limit. Upgrade your plan to continue generating leads, audits, and personalized outreach messages."}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onViewPlans}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            View Plans
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
