import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Landmark,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import type { PreferredPaymentMethod } from '../types';
import { quickCreditPacks } from '../config/billing';
import { useBilling } from '../hooks/useBilling';
import { Panel } from '../components/shared/Panel';
import { MetricCard } from '../components/shared/MetricCard';
import { UsageHistoryTable } from '../components/shared/UsageHistoryTable';
import { PlanCard } from '../components/billing/PlanCard';
import { AutopayPanel } from '../components/billing/AutopayPanel';
import { formatCredits, formatCurrency } from '../lib/formatters';
import { buildPaymentMethodLabel } from '../services/billing-experience';

type NoticeTone = 'success' | 'error';

export default function BillingPage() {
  const {
    workspace,
    error,
    purchasePlan,
    purchaseCredits,
    demoTopUp,
    updateAutopay,
    triggerAutopay,
  } = useBilling();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'buy' | 'demo' | null>(null);
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [isSavingAutopay, setIsSavingAutopay] = useState(false);
  const [isTriggeringAutopay, setIsTriggeringAutopay] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [didSeedPurchaseSetup, setDidSeedPurchaseSetup] = useState(false);
  const [purchaseSetup, setPurchaseSetup] = useState({
    enabled: true,
    thresholdCredits: 100,
    preferredPaymentMethod: 'upi' as PreferredPaymentMethod,
    upiId: '',
  });

  useEffect(() => {
    if (!workspace || didSeedPurchaseSetup) {
      return;
    }

    setPurchaseSetup({
      enabled: true,
      thresholdCredits: workspace.autopay.thresholdCredits || 100,
      preferredPaymentMethod: workspace.autopay.preferredPaymentMethod,
      upiId: workspace.autopay.upiId ?? '',
    });
    setDidSeedPurchaseSetup(true);
  }, [didSeedPurchaseSetup, workspace]);

  if (!workspace) {
    return null;
  }

  const purchasePaymentLabel = useMemo(() => (
    buildPaymentMethodLabel(
      purchaseSetup.preferredPaymentMethod,
      /^[^\s@]+@[^\s@]+$/.test(purchaseSetup.upiId.trim()) ? purchaseSetup.upiId.trim() : ''
    )
  ), [purchaseSetup.preferredPaymentMethod, purchaseSetup.upiId]);

  const handleBuy = async (planId: string) => {
    const selectedPlan = workspace.pricingPlans.find((plan) => plan.id === planId);
    if (!selectedPlan) {
      return;
    }

    try {
      setNotice(null);
      setBusyPlanId(planId);
      setBusyAction('buy');

      await purchasePlan(planId, {
        autopaySetup: purchaseSetup.enabled
          ? {
              enabled: true,
              selectedPlanId: selectedPlan.id,
              thresholdCredits: purchaseSetup.thresholdCredits,
              rechargeAmount: selectedPlan.amountPaise,
              mode: workspace.paymentReadiness.canUseRazorpay ? 'real' : 'demo',
              preferredPaymentMethod: purchaseSetup.preferredPaymentMethod,
              upiId: /^[^\s@]+@[^\s@]+$/.test(purchaseSetup.upiId.trim()) ? purchaseSetup.upiId.trim() : '',
              paymentMethodLabel: workspace.paymentReadiness.canUseRazorpay
                ? purchasePaymentLabel
                : 'Instant recharge',
              status: 'active',
              failedReason: undefined,
              pendingCheckout: null,
            }
          : null,
      });

      if (purchaseSetup.enabled) {
        setNotice({
          tone: 'success',
          message: `Bought ${selectedPlan.name} and saved low-balance recharge for ${purchaseSetup.thresholdCredits} credits.`,
        });
      }
    } catch (purchaseError) {
      setNotice({
        tone: 'error',
        message: purchaseError instanceof Error ? purchaseError.message : 'Could not complete the plan purchase.',
      });
    } finally {
      setBusyPlanId(null);
      setBusyAction(null);
    }
  };

  const handleDemoTopUp = async (planId: string) => {
    try {
      setNotice(null);
      setBusyPlanId(planId);
      setBusyAction('demo');
      await demoTopUp(planId);
    } finally {
      setBusyPlanId(null);
      setBusyAction(null);
    }
  };

  const handleBuyPack = async (packId: string) => {
    const pack = quickCreditPacks.find((item) => item.id === packId);
    if (!pack) {
      return;
    }

    try {
      setNotice(null);
      setBusyPackId(packId);
      await purchaseCredits(pack.amountPaise, pack.credits);
      setNotice({
        tone: 'success',
        message: `${pack.label} recharge started successfully.`,
      });
    } catch (packError) {
      setNotice({
        tone: 'error',
        message: packError instanceof Error ? packError.message : 'Could not start the small credit purchase.',
      });
    } finally {
      setBusyPackId(null);
    }
  };

  const handleTriggerAutopay = async () => {
    try {
      setNotice(null);
      setIsTriggeringAutopay(true);
      await triggerAutopay();
    } finally {
      setIsTriggeringAutopay(false);
    }
  };

  const handleSaveAutopay = async (patch: Parameters<typeof updateAutopay>[0]) => {
    try {
      setNotice(null);
      setIsSavingAutopay(true);
      await updateAutopay(patch);
    } catch (autopayError) {
      setNotice({
        tone: 'error',
        message: autopayError instanceof Error ? autopayError.message : 'Could not save low-balance recharge settings.',
      });
    } finally {
      setIsSavingAutopay(false);
    }
  };

  const handleToggleAutopay = async (enabled: boolean) => {
    await handleSaveAutopay({
      enabled,
      status: enabled ? 'active' : 'paused',
      pendingCheckout: enabled ? workspace.autopay.pendingCheckout ?? null : null,
      failedReason: undefined,
    });
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Current balance"
          value={formatCredits(workspace.balanceCredits)}
          helper="The number the team should see first"
          tone="mint"
        />
        <MetricCard
          icon={CreditCard}
          label="Active plan"
          value={workspace.currentPlan.name}
          helper={`${formatCurrency(workspace.currentPlan.amount)} for ${workspace.currentPlan.credits} credits`}
          tone="amber"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Autopay"
          value={workspace.autopay.enabled ? 'Enabled' : 'Disabled'}
          helper={workspace.autopay.enabled ? `Threshold ${workspace.autopay.thresholdCredits} credits` : 'Enable for low balance recovery'}
          tone="sky"
        />
        <MetricCard
          icon={Banknote}
          label="Recharge posture"
          value={workspace.paymentReadiness.canUseRazorpay ? 'Live checkout' : 'Instant top-up'}
          helper={workspace.paymentReadiness.message}
          tone="violet"
        />
      </section>

      {(notice || error) && (
        <div className={`rounded-[1.7rem] border px-5 py-4 ${(notice?.tone ?? 'error') === 'success' ? 'border-emerald-300/20 bg-emerald-400/10' : 'border-rose-300/20 bg-rose-400/10'}`}>
          <div className="font-semibold text-white">{notice?.message ?? error}</div>
        </div>
      )}

      {workspace.walletHealth !== 'healthy' && (
        <div className={`rounded-[1.7rem] border px-5 py-4 ${workspace.walletHealth === 'empty' ? 'border-rose-300/20 bg-rose-400/10' : 'border-amber-300/20 bg-amber-400/10'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-100" />
            <div>
              <div className="font-semibold text-white">
                {workspace.walletHealth === 'empty' ? 'Wallet is empty' : 'Balance is running low'}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                This is the right moment to buy a small credit pack, purchase a plan, or turn on low-balance recharge.
              </p>
            </div>
          </div>
        </div>
      )}

      <Panel
        title="Buy Plan + Save Recharge Rule"
        subtitle="Choose a low-credit point, choose the preferred approval method, and the plan you buy becomes the future recharge pack."
      >
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Start low-balance recharge when buying a plan</div>
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    If this is on, the plan you purchase becomes the pack used for future recharges.
                  </div>
                </div>
                <button
                  onClick={() => setPurchaseSetup((current) => ({ ...current, enabled: !current.enabled }))}
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold transition ${purchaseSetup.enabled ? 'bg-emerald-300/15 text-emerald-100' : 'bg-white/10 text-slate-200'}`}
                >
                  {purchaseSetup.enabled ? 'Recharge rule on' : 'Recharge rule off'}
                </button>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Recharge when the wallet reaches</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {[50, 100, 200].map((value) => (
                  <button
                    key={value}
                    onClick={() => setPurchaseSetup((current) => ({ ...current, thresholdCredits: value }))}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${purchaseSetup.thresholdCredits === value ? 'border-emerald-300/30 bg-emerald-300/[0.10] text-emerald-50' : 'border-white/10 bg-slate-950/55 text-slate-300'}`}
                  >
                    {value} credits
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Preferred approval method</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { id: 'upi', label: 'UPI', icon: Smartphone },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'netbanking', label: 'Net banking', icon: Landmark },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setPurchaseSetup((current) => ({
                      ...current,
                      preferredPaymentMethod: id as PreferredPaymentMethod,
                      upiId: id === 'upi' ? current.upiId : '',
                    }))}
                    className={`inline-flex items-center rounded-2xl border px-4 py-3 text-sm font-semibold transition ${purchaseSetup.preferredPaymentMethod === id ? 'border-sky-300/30 bg-sky-300/[0.10] text-sky-100' : 'border-white/10 bg-slate-950/55 text-slate-300'}`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {purchaseSetup.preferredPaymentMethod === 'upi' && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Preferred UPI ID</div>
                  <input
                    type="text"
                    value={purchaseSetup.upiId}
                    onChange={(event) => setPurchaseSetup((current) => ({
                      ...current,
                      upiId: event.target.value,
                    }))}
                    placeholder="name@bank"
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-base font-medium text-white outline-none placeholder:text-slate-500"
                  />
                  <div className="mt-2 text-sm leading-6 text-slate-400">
                    Optional. If left blank, Razorpay will still open and let the customer choose UPI or another method there.
                  </div>
                </div>
              )}

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">What will be saved</div>
                <div className="mt-2 text-sm leading-6 text-slate-300">
                  Recharge at <span className="font-semibold text-white">{purchaseSetup.thresholdCredits} credits</span> using{' '}
                  <span className="font-semibold text-white">{workspace.paymentReadiness.canUseRazorpay ? purchasePaymentLabel : 'instant recharge'}</span>.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          {workspace.pricingPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={workspace.currentPlan.id === plan.id}
              onBuy={() => void handleBuy(plan.id)}
              onDemoTopUp={() => void handleDemoTopUp(plan.id)}
              busyAction={busyPlanId === plan.id ? busyAction : null}
              buyLabel={purchaseSetup.enabled ? `Buy ${plan.name} + save recharge` : `Buy ${plan.name}`}
            />
          ))}
        </div>
      </Panel>

      <Panel
        title="Quick Credit Recharge"
        subtitle="Small packs for 10, 20, or 30 credits when you only need a quick top-up."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {quickCreditPacks.map((pack) => (
            <div key={pack.id} className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-lg font-semibold text-white">{pack.label}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{pack.description}</div>
              <div className="mt-5 text-2xl font-semibold text-white">{formatCurrency(pack.amount)}</div>
              <button
                onClick={() => void handleBuyPack(pack.id)}
                disabled={busyPackId !== null}
                className="button-secondary mt-5 w-full justify-center"
              >
                {busyPackId === pack.id ? 'Opening Razorpay...' : `Buy ${pack.label}`}
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <AutopayPanel
        autopay={workspace.autopay}
        plans={workspace.pricingPlans}
        history={workspace.autopayHistory}
        onSave={(patch) => void handleSaveAutopay(patch)}
        onToggle={(enabled) => void handleToggleAutopay(enabled)}
        onTriggerNow={() => void handleTriggerAutopay()}
        isSaving={isSavingAutopay}
        isTriggering={isTriggeringAutopay}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recharge history" subtitle="Show every credit addition that kept the account active.">
          <UsageHistoryTable
            items={workspace.rechargeHistory}
            emptyTitle="No recharges yet"
            emptyCopy="Complete a plan purchase or instant top-up to populate recharge history."
          />
        </Panel>

        <Panel title="Usage history" subtitle="Explain exactly what burned credits and how quickly value is produced.">
          <UsageHistoryTable
            items={workspace.usageHistory}
            emptyTitle="No usage burned yet"
            emptyCopy="Calls, chat, and workflow activity will appear here as soon as credits are used."
          />
        </Panel>
      </div>
    </div>
  );
}
