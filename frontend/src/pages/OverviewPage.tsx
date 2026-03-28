import {
  Activity,
  AudioLines,
  CalendarClock,
  ChevronRight,
  CreditCard,
  MessageSquareMore,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wallet2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useBilling } from '../hooks/useBilling';
import { MetricCard } from '../components/shared/MetricCard';
import { Panel } from '../components/shared/Panel';
import { UsageHistoryTable } from '../components/shared/UsageHistoryTable';
import { formatCompact, formatCredits, formatDateTime } from '../lib/formatters';

export default function OverviewPage() {
  const { workspace } = useBilling();

  if (!workspace) {
    return null;
  }

  const metrics = [
    {
      icon: Wallet2,
      label: 'Current credit balance',
      value: formatCredits(workspace.balanceCredits),
      helper: `${workspace.baseBalanceCredits} base credits from wallet + live demo activity overlay`,
      tone: 'mint' as const,
    },
    {
      icon: CreditCard,
      label: 'Current plan',
      value: workspace.currentPlan.name,
      helper: workspace.currentPlan.monthlyCapacity,
      tone: 'amber' as const,
    },
    {
      icon: ShieldCheck,
      label: 'Autopay status',
      value: workspace.autopay.enabled ? 'ON' : 'OFF',
      helper: workspace.autopay.enabled
        ? `Recharge below ${workspace.autopay.thresholdCredits} credits`
        : 'Manual recharge mode',
      tone: 'sky' as const,
    },
    {
      icon: Activity,
      label: 'This month usage',
      value: formatCompact(workspace.usageSummary.monthCreditsUsed),
      helper: 'Credits burned this month across support actions',
      tone: 'rose' as const,
    },
    {
      icon: PhoneCall,
      label: 'Total calls handled',
      value: `${workspace.usageSummary.totalCallsHandled}`,
      helper: `${workspace.usageSummary.standardCallMinutes + workspace.usageSummary.premiumCallMinutes} minutes processed`,
      tone: 'violet' as const,
    },
    {
      icon: MessageSquareMore,
      label: 'AI chats used',
      value: `${workspace.usageSummary.aiChatsUsed}`,
      helper: 'Client-friendly proof that every support touchpoint burns credits',
      tone: 'mint' as const,
    },
    {
      icon: Sparkles,
      label: 'Sarvam usage',
      value: `${workspace.usageSummary.sarvamRequests}`,
      helper: `${workspace.usageSummary.voiceProcesses} voice orchestration runs`,
      tone: 'sky' as const,
    },
    {
      icon: CalendarClock,
      label: 'Estimated next recharge',
      value: workspace.usageSummary.estimatedNextRecharge,
      helper: `Next autopay check: ${formatDateTime(workspace.autopay.nextAutopayAttemptAt)}`,
      tone: 'amber' as const,
    },
  ];

  const laneCards = [
    {
      title: 'Calls',
      description: 'Inbound and outbound call sessions, guardrails, and search.',
      to: '/dashboard/calls',
      icon: PhoneCall,
      stat: `${workspace.transactions.filter((item) => ['voice_call', 'premium_call', 'inbound_call', 'outbound_call'].includes(item.source)).length} events`,
    },
    {
      title: 'Chat',
      description: 'AI chat usage separated from phone activity for quicker lookup.',
      to: '/dashboard/chat',
      icon: MessageSquareMore,
      stat: `${workspace.usageSummary.aiChatsUsed} chats`,
    },
    {
      title: 'Workflows',
      description: 'Voice processing, recordings, and background automation activity.',
      to: '/dashboard/workflows',
      icon: AudioLines,
      stat: `${workspace.usageSummary.sarvamRequests + workspace.usageSummary.voiceProcesses + workspace.usageSummary.recordingsProcessed} ops`,
    },
    {
      title: 'Billing',
      description: 'Recharge plans, autopay controls, and wallet history.',
      to: '/dashboard/billing',
      icon: CreditCard,
      stat: workspace.autopay.enabled ? 'Autopay on' : 'Autopay off',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="eyebrow">Client demo narrative</div>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Show credit balance, burn transparency, and auto-recharge in one serious SaaS control room.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              This overview helps a client instantly understand how plans are purchased, how calls and chat burn credits,
              and how autopay keeps the service online without manual intervention.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Plan status</div>
                <div className="mt-3 text-xl font-semibold text-white">{workspace.currentPlan.name}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{workspace.currentPlanStatus}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Remaining balance</div>
                <div className="mt-3 text-xl font-semibold text-white">{formatCredits(workspace.balanceCredits)}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">Low balance threshold at {workspace.lowBalanceThreshold} credits</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Live payment status</div>
                <div className="mt-3 text-xl font-semibold text-white">{workspace.paymentReadiness.canUseRazorpay ? 'Ready' : 'Demo'}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{workspace.paymentReadiness.message}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/55 p-6">
            <div className="text-xs uppercase tracking-[0.26em] text-slate-500">Credit burn model</div>
            <div className="mt-4 space-y-4">
              {workspace.usageRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <div>
                    <div className="font-medium text-white">{rule.label}</div>
                    <div className="mt-1 text-sm text-slate-400">{rule.description}</div>
                  </div>
                  <div className="rounded-2xl bg-white/8 px-4 py-3 text-right">
                    <div className="text-xl font-semibold text-white">{rule.credits}</div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{rule.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <Panel
        title="Quick Access Lanes"
        subtitle="Each workflow now has its own place so the team can jump straight to the right session area and search faster."
      >
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {laneCards.map(({ title, description, to, icon: Icon, stat }) => (
            <Link
              key={title}
              to={to}
              className="group rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-sky-300/25 hover:bg-sky-300/[0.06]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-sky-100">
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-slate-500 transition group-hover:translate-x-1 group-hover:text-sky-100" />
              </div>
              <div className="mt-5 text-lg font-semibold text-white">{title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
              <div className="mt-4 text-sm font-medium text-sky-100">{stat}</div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Usage concentration"
          subtitle="This helps explain where credits go each month and which features drive value."
        >
          <div className="space-y-4">
            {workspace.consumptionBreakdown.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                  <span>{item.label}</span>
                  <span>{item.credits} credits · {item.volume}</span>
                </div>
                <div className="h-3 rounded-full bg-white/[0.05]">
                  <div className="h-3 rounded-full bg-gradient-to-r from-emerald-300 via-sky-300 to-amber-200" style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
            {workspace.consumptionBreakdown.length === 0 && (
              <p className="text-sm leading-6 text-slate-400">Run a few demo simulations to show how the usage mix changes in real time.</p>
            )}
          </div>
        </Panel>

        <Panel
          title="Plan + autopay snapshot"
          subtitle="A quick story you can narrate while demoing the wallet."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Selected renewal plan</div>
              <div className="mt-3 text-2xl font-semibold text-white">{workspace.currentPlan.name}</div>
              <div className="mt-2 text-sm leading-6 text-slate-400">{workspace.currentPlan.monthlyCapacity}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Autopay method</div>
                <div className="mt-2 text-base font-semibold text-white">{workspace.autopay.paymentMethodLabel}</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Next check</div>
                <div className="mt-2 text-base font-semibold text-white">{formatDateTime(workspace.autopay.nextAutopayAttemptAt)}</div>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        title="Latest wallet history"
        subtitle="Every top-up and every credit burn is traceable, which is exactly what clients need to trust the billing model."
      >
        <UsageHistoryTable
          items={workspace.transactions.slice(0, 8)}
          emptyTitle="No wallet activity yet"
          emptyCopy="Trigger a live Twilio call or complete a Razorpay purchase to populate the billing timeline."
        />
      </Panel>
    </div>
  );
}
