import { useState } from 'react';
import { AlertTriangle, Banknote, CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { Panel } from '../components/shared/Panel';
import { MetricCard } from '../components/shared/MetricCard';
import { UsageHistoryTable } from '../components/shared/UsageHistoryTable';
import { PlanCard } from '../components/billing/PlanCard';
import { AutopayPanel } from '../components/billing/AutopayPanel';
import { OutboundCallDemo } from '../components/call/OutboundCallDemo';
import { formatCredits, formatCurrency } from '../lib/formatters';

export default function BillingPage() {
  const { workspace, purchasePlan, demoTopUp, updateAutopay, triggerAutopay } = useBilling();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'buy' | 'demo' | null>(null);
  const [isTriggeringAutopay, setIsTriggeringAutopay] = useState(false);

  if (!workspace) {
    return null;
  }

  const handleBuy = async (planId: string) => {
    try {
      setBusyPlanId(planId);
      setBusyAction('buy');
      await purchasePlan(planId);
    } finally {
      setBusyPlanId(null);
      setBusyAction(null);
    }
  };

  const handleDemoTopUp = async (planId: string) => {
    try {
      setBusyPlanId(planId);
      setBusyAction('demo');
      await demoTopUp(planId);
    } finally {
      setBusyPlanId(null);
      setBusyAction(null);
    }
  };

  const handleTriggerAutopay = async () => {
    try {
      setIsTriggeringAutopay(true);
      await triggerAutopay();
    } finally {
      setIsTriggeringAutopay(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Current balance"
          value={formatCredits(workspace.balanceCredits)}
          helper="The live number your client cares about first"
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
          value={workspace.paymentReadiness.canUseRazorpay ? 'Live top-up' : 'Demo top-up'}
          helper={workspace.paymentReadiness.message}
          tone="violet"
        />
      </section>

      {workspace.walletHealth !== 'healthy' && (
        <div className={`rounded-[1.7rem] border px-5 py-4 ${workspace.walletHealth === 'empty' ? 'border-rose-300/20 bg-rose-400/10' : 'border-amber-300/20 bg-amber-400/10'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-100" />
            <div>
              <div className="font-semibold text-white">
                {workspace.walletHealth === 'empty' ? 'Wallet is empty' : 'Balance is running low'}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-200">
                This is a perfect client-demo moment to show instant top-up or enable autopay protection.
              </p>
            </div>
          </div>
        </div>
      )}

      <Panel
        title="Recharge plans"
        subtitle="Use live Razorpay top-up for the real payment story, or instant demo top-up if you want a faster narrative during presentations."
      >
        <div className="grid gap-5 xl:grid-cols-3">
          {workspace.pricingPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={workspace.currentPlan.id === plan.id}
              onBuy={() => void handleBuy(plan.id)}
              onDemoTopUp={() => void handleDemoTopUp(plan.id)}
              busyAction={busyPlanId === plan.id ? busyAction : null}
            />
          ))}
        </div>
      </Panel>

      <AutopayPanel
        autopay={workspace.autopay}
        plans={workspace.pricingPlans}
        history={workspace.autopayHistory}
        onChange={(patch) => void updateAutopay(patch)}
        onTriggerNow={() => void handleTriggerAutopay()}
        isTriggering={isTriggeringAutopay}
      />

      <OutboundCallDemo />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recharge history" subtitle="Show every credit addition that kept the account active.">
          <UsageHistoryTable
            items={workspace.rechargeHistory}
            emptyTitle="No recharges yet"
            emptyCopy="Run a demo top-up or purchase a real plan to populate recharge history."
          />
        </Panel>

        <Panel title="Usage history" subtitle="Explain exactly what burned credits and how quickly value is produced.">
          <UsageHistoryTable
            items={workspace.usageHistory}
            emptyTitle="No usage burned yet"
            emptyCopy="The demo lab will generate consumption events here so the billing model becomes obvious."
          />
        </Panel>
      </div>
    </div>
  );
}
