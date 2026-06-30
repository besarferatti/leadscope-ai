import { Check, X } from 'lucide-react';
import { PLANS, PLAN_DISPLAY_ORDER } from '../../lib/plans';

export function AdminPlans() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Plans</h1>
        <p className="text-slate-400 text-sm mt-1">Current plan configuration. Plan editing can be connected to database later.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLAN_DISPLAY_ORDER.map(planId => {
          const plan = PLANS[planId];
          return (
            <div key={planId} className={`card p-5 ${plan.popular ? 'border-blue-500/40' : ''}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">{plan.name}</h3>
                {plan.popular && <span className="badge bg-blue-500/20 text-blue-400 text-xs">Popular</span>}
              </div>

              <div className="mb-4">
                <p className="text-slate-300 text-sm">
                  {plan.monthlyPrice === null ? 'Custom pricing' : plan.monthlyPrice === 0 ? 'Free' : `€${plan.monthlyPrice}/mo · €${plan.yearlyPrice}/yr`}
                </p>
              </div>

              <div className="space-y-1.5 text-sm">
                {[
                  ['Leads/mo', plan.leadsLimit === -1 ? 'Unlimited' : plan.leadsLimit.toLocaleString()],
                  ['Audits/mo', plan.auditsLimit === -1 ? 'Unlimited' : plan.auditsLimit.toLocaleString()],
                  ['Messages/mo', plan.messagesLimit === -1 ? 'Unlimited' : plan.messagesLimit.toLocaleString()],
                  ['Users', plan.usersLimit === -1 ? 'Unlimited' : plan.usersLimit],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="text-slate-300 font-medium">{val}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-1.5 text-xs">
                {[
                  ['CSV Export', plan.csvExport],
                  ['Bulk Actions', plan.bulkActions],
                  ['Google Places', plan.googlePlacesSearch],
                  ['Saved Templates', plan.savedTemplates],
                  ['Multi Workspaces', plan.multipleWorkspaces],
                  ['Custom Scoring', plan.customLeadScoring],
                  ['Priority Support', plan.prioritySupport],
                  ['API Access', plan.apiAccess],
                  ['White Label', plan.whiteLabel],
                ].map(([label, enabled]) => (
                  <div key={label as string} className="flex items-center gap-1.5">
                    {enabled
                      ? <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      : <X className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />}
                    <span className={enabled ? 'text-slate-300' : 'text-slate-600'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <p className="text-slate-500 text-sm">
          Plan limits are currently hardcoded in <code className="text-slate-400 bg-slate-800 px-1 rounded">src/lib/plans.ts</code>.
          Dynamic plan editing via the database can be connected later by migrating plan configs to a <code className="text-slate-400 bg-slate-800 px-1 rounded">plans</code> table.
        </p>
      </div>
    </div>
  );
}
