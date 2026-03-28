import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CreditCard,
  Loader,
  Save,
  ShieldAlert,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import type { AutopaySettings, BillingTransaction, PricingPlan, PreferredPaymentMethod } from '../../types';
import { formatCredits, formatCurrency, formatDateTime } from '../../lib/formatters';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';
import { buildPaymentMethodLabel } from '../../services/billing-experience';

const THRESHOLD_PRESETS = [50, 100, 200];

export function AutopayPanel({
  autopay,
  plans,
  history,
  onSave,
  onToggle,
  onTriggerNow,
  isSaving,
  isTriggering,
}: {
  autopay: AutopaySettings;
  plans: PricingPlan[];
  history: BillingTransaction[];
  onSave: (patch: Partial<AutopaySettings>) => void;
  onToggle: (enabled: boolean) => void;
  onTriggerNow: () => void;
  isSaving?: boolean;
  isTriggering?: boolean;
}) {
  const [draft, setDraft] = useState({
    thresholdCredits: autopay.thresholdCredits,
    selectedPlanId: autopay.selectedPlanId,
    rechargeAmount: autopay.rechargeAmount,
    mode: autopay.mode,
    preferredPaymentMethod: autopay.preferredPaymentMethod,
    upiId: autopay.upiId ?? '',
  });

  useEffect(() => {
    setDraft({
      thresholdCredits: autopay.thresholdCredits,
      selectedPlanId: autopay.selectedPlanId,
      rechargeAmount: autopay.rechargeAmount,
      mode: autopay.mode,
      preferredPaymentMethod: autopay.preferredPaymentMethod,
      upiId: autopay.upiId ?? '',
    });
  }, [
    autopay.thresholdCredits,
    autopay.selectedPlanId,
    autopay.rechargeAmount,
    autopay.mode,
    autopay.preferredPaymentMethod,
    autopay.upiId,
  ]);

  const latestCompleted = history.find((entry) => entry.status === 'completed');
  const selectedPlan = plans.find((plan) => plan.id === draft.selectedPlanId) ?? plans[0];
  const normalizedUpiId = /^[^\s@]+@[^\s@]+$/.test(draft.upiId.trim()) ? draft.upiId.trim() : '';
  const isDirty =
    draft.thresholdCredits !== autopay.thresholdCredits
    || draft.selectedPlanId !== autopay.selectedPlanId
    || draft.rechargeAmount !== autopay.rechargeAmount
    || draft.mode !== autopay.mode
    || draft.preferredPaymentMethod !== autopay.preferredPaymentMethod
    || draft.upiId !== (autopay.upiId ?? '');

  const paymentLabel = useMemo(() => (
    draft.mode === 'demo'
      ? 'Instant recharge'
      : buildPaymentMethodLabel(draft.preferredPaymentMethod, normalizedUpiId)
  ), [draft.mode, draft.preferredPaymentMethod, normalizedUpiId]);

  const handleSave = () => {
    onSave({
      enabled: autopay.enabled,
      thresholdCredits: draft.thresholdCredits,
      selectedPlanId: draft.selectedPlanId,
      rechargeAmount: draft.rechargeAmount,
      mode: draft.mode,
      preferredPaymentMethod: draft.preferredPaymentMethod,
      upiId: normalizedUpiId,
      paymentMethodLabel: paymentLabel,
      status: autopay.enabled ? 'active' : 'paused',
      pendingCheckout: draft.mode === 'demo' ? null : autopay.pendingCheckout ?? null,
      failedReason: undefined,
    });
  };

  const applyMethod = (method: PreferredPaymentMethod) => {
    setDraft((current) => ({
      ...current,
      preferredPaymentMethod: method,
      upiId: method === 'upi' ? current.upiId : '',
    }));
  };

  return (
    <Panel
      title="Low-Balance Recharge"
      subtitle="Keep this simple: choose the balance level, choose the recharge pack, and choose how the customer prefers to approve checkout."
      action={<StatusBadge label={autopay.enabled ? 'Enabled' : 'Disabled'} tone={autopay.enabled ? 'mint' : 'neutral'} />}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[1.8rem] border border-white/10 bg-slate-950/55 p-5">
          <div>
            <div className="text-sm font-semibold text-white">Low-balance protection</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">
              When the wallet drops to the chosen threshold, we prepare a compliant recharge. In real mode the customer still confirms it in Razorpay.
            </div>
          </div>
          <button
            onClick={() => onToggle(!autopay.enabled)}
            disabled={isSaving}
            className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold transition ${autopay.enabled ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-slate-200'} disabled:cursor-not-allowed disabled:opacity-70`}
          >
            {isSaving ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : autopay.enabled ? 'Turn Off' : 'Turn On'}
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">1. Choose the low-credit point</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {THRESHOLD_PRESETS.map((value) => (
                  <button
                    key={value}
                    onClick={() => setDraft((current) => ({ ...current, thresholdCredits: value }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${draft.thresholdCredits === value ? 'border-emerald-300/30 bg-emerald-300/[0.10] text-emerald-50' : 'border-white/10 bg-slate-950/55 text-slate-300'}`}
                  >
                    Recharge at {value}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Custom threshold</div>
                <input
                  type="number"
                  min={0}
                  value={draft.thresholdCredits}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    thresholdCredits: Number(event.target.value),
                  }))}
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-lg font-semibold text-white outline-none"
                />
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">2. Choose what to recharge</div>
              <div className="mt-4 space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setDraft((current) => ({
                      ...current,
                      selectedPlanId: plan.id,
                      rechargeAmount: plan.amountPaise,
                    }))}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${draft.selectedPlanId === plan.id ? 'border-emerald-300/30 bg-emerald-300/[0.08]' : 'border-white/10 bg-slate-950/55'}`}
                  >
                    <div>
                      <div className="font-semibold text-white">{plan.name}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {formatCurrency(plan.amount)} · {formatCredits(plan.credits)}
                      </div>
                    </div>
                    {draft.selectedPlanId === plan.id && <BadgeCheck className="h-5 w-5 text-emerald-200" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">3. Choose approval method</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { id: 'upi', label: 'UPI', icon: Smartphone },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'netbanking', label: 'Net banking', icon: WalletCards },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => applyMethod(id as PreferredPaymentMethod)}
                    disabled={draft.mode === 'demo'}
                    className={`inline-flex items-center rounded-2xl border px-4 py-3 text-sm font-semibold transition ${draft.preferredPaymentMethod === id ? 'border-sky-300/30 bg-sky-300/[0.10] text-sky-100' : 'border-white/10 bg-slate-950/55 text-slate-300'} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <button
                  onClick={() => setDraft((current) => ({ ...current, mode: 'real' }))}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${draft.mode === 'real' ? 'border-sky-300/30 bg-sky-300/[0.10]' : 'border-white/10 bg-slate-950/55'}`}
                >
                  <div className="text-sm font-semibold text-white">Real mode</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">Creates a Razorpay checkout that the customer must confirm.</div>
                </button>
                <button
                  onClick={() => setDraft((current) => ({ ...current, mode: 'demo' }))}
                  className={`rounded-2xl border px-4 py-4 text-left transition ${draft.mode === 'demo' ? 'border-emerald-300/30 bg-emerald-300/[0.10]' : 'border-white/10 bg-slate-950/55'}`}
                >
                  <div className="text-sm font-semibold text-white">Instant mode</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">Adds credits instantly without opening a live payment step.</div>
                </button>
              </div>

              {draft.mode === 'real' && draft.preferredPaymentMethod === 'upi' && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Preferred UPI ID</div>
                  <input
                    type="text"
                    value={draft.upiId}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      upiId: event.target.value,
                    }))}
                    placeholder="name@bank"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base font-medium text-white outline-none placeholder:text-slate-500"
                  />
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    We save this only as the preferred checkout method. Each recharge still opens Razorpay for customer approval.
                  </div>
                  {draft.upiId.trim() && !normalizedUpiId && (
                    <div className="mt-3 text-sm text-amber-200">That UPI ID does not look complete, so we will save the method as generic UPI and still open Razorpay for confirmation.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Current setup summary</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Threshold</div>
                  <div className="mt-2 text-lg font-semibold text-white">{draft.thresholdCredits} credits</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recharge pack</div>
                  <div className="mt-2 text-lg font-semibold text-white">{selectedPlan?.name ?? 'Not set'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Recharge value</div>
                  <div className="mt-2 text-lg font-semibold text-white">{formatCurrency(Math.round(draft.rechargeAmount / 100))}</div>
                  <div className="mt-1 text-sm text-slate-400">{formatCredits(Math.floor(draft.rechargeAmount / 10))}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Preferred method</div>
                  <div className="mt-2 text-sm font-semibold text-white">{paymentLabel}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest completed recharge</div>
                <div className="mt-2 text-base font-semibold text-white">
                  {latestCompleted ? formatDateTime(latestCompleted.createdAt) : 'No recharge yet'}
                </div>
              </div>

              {autopay.pendingCheckout && (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-50">
                  A recharge approval is waiting in Razorpay for {formatCurrency(Math.round(autopay.pendingCheckout.amount / 100))}.
                </div>
              )}

              {autopay.failedReason && (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm leading-6 text-rose-100">
                  {autopay.failedReason}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || isSaving}
                  className="inline-flex items-center rounded-2xl border border-sky-300/25 bg-sky-300/[0.10] px-4 py-3 text-sm font-semibold text-sky-100 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                >
                  {isSaving ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Saving settings
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save setup
                    </>
                  )}
                </button>

                <button
                  onClick={onTriggerNow}
                  disabled={!autopay.enabled || isTriggering}
                  className="inline-flex items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.10] px-4 py-3 text-sm font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                >
                  {isTriggering ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Processing
                    </>
                  ) : autopay.pendingCheckout ? 'Complete recharge approval' : 'Trigger recharge now'}
                </button>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3 text-sm font-semibold text-white">
                <ShieldAlert className="h-4 w-4 text-amber-200" />
                No silent debit from UPI, bank, or card.
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                The saved payment method is only a preference. Every real recharge still asks the customer to confirm checkout in Razorpay.
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Recent recharge activity</div>
              <div className="mt-4 space-y-3">
                {history.slice(0, 4).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-sm font-medium text-white">{entry.description}</div>
                    <div className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">{formatDateTime(entry.createdAt)}</div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-sm leading-6 text-slate-400">No recharge attempts yet. Save the setup, then trigger one to show the flow.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
