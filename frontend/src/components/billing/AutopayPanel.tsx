import { BadgeCheck, CreditCard, IndianRupee, Repeat2, ShieldAlert } from 'lucide-react';
import type { AutopaySettings, BillingTransaction, PricingPlan } from '../../types';
import { formatCredits, formatCurrency, formatDateTime } from '../../lib/formatters';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';

export function AutopayPanel({
  autopay,
  plans,
  history,
  onChange,
  onTriggerNow,
  isTriggering,
}: {
  autopay: AutopaySettings;
  plans: PricingPlan[];
  history: BillingTransaction[];
  onChange: (patch: Partial<AutopaySettings>) => void;
  onTriggerNow: () => void;
  isTriggering?: boolean;
}) {
  const rechargeAmountInr = Math.round(autopay.rechargeAmount / 100);
  const latestCompleted = history.find((entry) => entry.status === 'completed');
  const actionLabel = autopay.pendingCheckout
    ? 'Complete Razorpay Checkout'
    : isTriggering
      ? 'Processing...'
      : 'Trigger Autopay';

  return (
    <Panel
      title="Smart Autopay"
      subtitle="Threshold-based recharge only. Demo mode tops up instantly for walkthroughs, while real mode creates a Razorpay checkout that the customer still has to confirm."
      action={<StatusBadge label={autopay.enabled ? 'Enabled' : 'Disabled'} tone={autopay.enabled ? 'mint' : 'neutral'} />}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-300">Autopay state</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Recharge only when balance drops below the threshold. No silent debit, ever.
                </p>
              </div>
              <button
                onClick={() =>
                  onChange({
                    enabled: !autopay.enabled,
                    status: autopay.enabled ? 'paused' : 'active',
                    pendingCheckout: autopay.enabled ? null : autopay.pendingCheckout ?? null,
                  })
                }
                className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold transition ${autopay.enabled ? 'bg-emerald-400/15 text-emerald-100' : 'bg-white/10 text-slate-200'}`}
              >
                {autopay.enabled ? 'Turn Off' : 'Turn On'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Threshold credits</div>
              <input
                type="number"
                min={0}
                value={autopay.thresholdCredits}
                onChange={(event) => onChange({ thresholdCredits: Number(event.target.value), enabled: true, status: 'active' })}
                className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-lg font-semibold text-white outline-none"
              />
              <div className="mt-2 text-sm text-slate-400">When balance drops below this number, the recharge flow starts.</div>
            </label>

            <label className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recharge amount (INR)</div>
              <div className="mt-4 flex items-center rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                <IndianRupee className="h-5 w-5 text-amber-200" />
                <input
                  type="number"
                  min={1}
                  value={rechargeAmountInr}
                  onChange={(event) =>
                    onChange({
                      rechargeAmount: Number(event.target.value || 0) * 100,
                      enabled: true,
                      status: 'active',
                    })
                  }
                  className="w-full bg-transparent pl-2 text-lg font-semibold text-white outline-none"
                />
              </div>
              <div className="mt-2 text-sm text-slate-400">Credits added: {formatCredits(Math.floor(autopay.rechargeAmount / 10))}</div>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => onChange({ mode: 'demo', enabled: true, status: 'active', failedReason: undefined, pendingCheckout: null })}
              className={`rounded-3xl border p-5 text-left ${autopay.mode === 'demo' ? 'border-emerald-300/30 bg-emerald-300/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <Repeat2 className="h-5 w-5 text-emerald-200" />
              <div className="mt-4 text-lg font-semibold text-white">Demo mode</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Simulate a successful recharge instantly and log it as demo autopay.
              </p>
            </button>
            <button
              onClick={() => onChange({ mode: 'real', enabled: true, status: 'active' })}
              className={`rounded-3xl border p-5 text-left ${autopay.mode === 'real' ? 'border-sky-300/30 bg-sky-300/[0.08]' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <CreditCard className="h-5 w-5 text-sky-200" />
              <div className="mt-4 text-lg font-semibold text-white">Real mode</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Create a Razorpay order and wait for an explicit checkout confirmation before credits are added.
              </p>
            </button>
          </div>

          <div className="space-y-3">
            <div className="text-sm font-semibold text-white">Quick recharge presets</div>
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() =>
                  onChange({
                    selectedPlanId: plan.id,
                    rechargeAmount: plan.amountPaise,
                    enabled: true,
                    status: 'active',
                  })
                }
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left ${autopay.selectedPlanId === plan.id ? 'border-emerald-300/30 bg-emerald-300/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}
              >
                <div>
                  <div className="font-semibold text-white">{plan.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatCurrency(plan.amount)} · {plan.credits} credits</div>
                </div>
                {autopay.selectedPlanId === plan.id && <BadgeCheck className="h-5 w-5 text-emerald-200" />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Current autopay status</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <StatusBadge
                label={autopay.status.replace('_', ' ')}
                tone={autopay.status === 'active' ? 'mint' : autopay.status === 'paused' ? 'neutral' : 'rose'}
              />
              <StatusBadge label={autopay.mode === 'demo' ? 'Demo recharge' : 'Checkout required'} tone="sky" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recharge amount</div>
            <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(rechargeAmountInr)}</div>
            <div className="mt-2 text-sm text-slate-400">{formatCredits(Math.floor(autopay.rechargeAmount / 10))} when triggered</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest completed recharge</div>
            <div className="mt-2 text-lg font-semibold text-white">{latestCompleted ? formatDateTime(latestCompleted.createdAt) : 'No recharge yet'}</div>
          </div>

          <button
            onClick={onTriggerNow}
            disabled={!autopay.enabled || isTriggering}
            className="w-full rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.10] px-4 py-3 text-sm font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
          >
            {actionLabel}
          </button>

          {autopay.pendingCheckout && (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
              Pending checkout ready for {formatCurrency(Math.round(autopay.pendingCheckout.amount / 100))}. Credits will be added only after the user completes Razorpay.
            </div>
          )}

          {autopay.failedReason && (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
              {autopay.failedReason}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <ShieldAlert className="h-4 w-4 text-amber-200" />
              No silent deduction from UPI or bank accounts.
            </div>
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Autopay history</div>
            <div className="mt-4 space-y-3">
              {history.slice(0, 4).map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-sm font-medium text-white">{entry.description}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{formatDateTime(entry.createdAt)}</div>
                </div>
              ))}
              {history.length === 0 && <p className="text-sm leading-6 text-slate-400">No autopay attempts yet. Trigger one to show the compliant recharge trail.</p>}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
