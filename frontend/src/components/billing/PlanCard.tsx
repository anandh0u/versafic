import { Check, CreditCard, Sparkles } from 'lucide-react';
import type { PricingPlan } from '../../types';
import { formatCredits, formatCurrency } from '../../lib/formatters';
import { StatusBadge } from '../shared/StatusBadge';

export function PlanCard({
  plan,
  isCurrent,
  onBuy,
  onDemoTopUp,
  busyAction,
  buyLabel,
}: {
  plan: PricingPlan;
  isCurrent: boolean;
  onBuy: () => void;
  onDemoTopUp: () => void;
  busyAction?: 'buy' | 'demo' | null;
  buyLabel?: string;
}) {
  return (
    <div className={`rounded-[1.75rem] border p-6 transition duration-200 ${isCurrent ? 'border-emerald-300/30 bg-emerald-300/[0.08]' : 'border-white/10 bg-white/[0.04]'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="text-xl font-semibold text-white">{plan.name}</h4>
            {plan.highlight && <StatusBadge label={plan.highlight} tone="amber" />}
            {isCurrent && <StatusBadge label="Active plan" tone="mint" />}
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{plan.description}</p>
        </div>
        <div className="rounded-2xl bg-white/6 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Plan price</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(plan.amount)}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Credits included</div>
          <div className="mt-2 text-xl font-semibold text-white">{formatCredits(plan.credits)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Best for</div>
          <div className="mt-2 text-sm leading-6 text-slate-200">{plan.idealFor}</div>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Sparkles className="mt-0.5 h-4 w-4 text-amber-200" />
        <div className="text-sm leading-6 text-slate-300">{plan.monthlyCapacity}</div>
      </div>

      <div className="mt-6 space-y-3">
        <button onClick={onBuy} disabled={busyAction !== null} className="button-primary w-full justify-center">
          <CreditCard className="mr-2 h-4 w-4" />
          {busyAction === 'buy' ? 'Opening Razorpay...' : buyLabel ?? `Buy ${plan.name}`}
        </button>
        <button onClick={onDemoTopUp} disabled={busyAction !== null} className="button-secondary w-full justify-center">
          <Check className="mr-2 h-4 w-4" />
          {busyAction === 'demo' ? 'Applying demo recharge...' : 'Instant demo top-up'}
        </button>
      </div>
    </div>
  );
}
