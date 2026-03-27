import { Radar, TimerReset, Zap } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { Panel } from '../components/shared/Panel';
import { SimulationActionCard } from '../components/billing/SimulationActionCard';
import { UsageHistoryTable } from '../components/shared/UsageHistoryTable';
import { formatCredits } from '../lib/formatters';

export default function DemoLabPage() {
  const { workspace, simulateUsage } = useBilling();

  if (!workspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="eyebrow">Interactive simulation</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Trigger usage, burn credits instantly, and let the client watch the wallet react in real time.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              Every simulation writes a usage event, updates the balance, and can trigger autopay if the account falls below the configured threshold.
            </p>
          </div>

          <div className="space-y-4 rounded-[1.9rem] border border-white/10 bg-slate-950/55 p-6">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-slate-500">
              <Radar className="h-4 w-4 text-sky-200" />
              Live demo status
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Remaining balance</div>
              <div className="mt-3 text-4xl font-semibold tracking-tight text-white">{formatCredits(workspace.balanceCredits)}</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Autopay threshold</div>
                <div className="mt-2 text-xl font-semibold text-white">{workspace.autopay.thresholdCredits} credits</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Plan protection</div>
                <div className="mt-2 text-xl font-semibold text-white">{workspace.autopay.enabled ? 'Active' : 'Manual'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Panel
        title="Simulation actions"
        subtitle="These actions mirror the product story: chat, call minutes, voice orchestration, recordings, and onboarding setup."
      >
        <div className="grid gap-5 xl:grid-cols-2">
          {workspace.simulationActions.map((action) => (
            <SimulationActionCard
              key={action.id}
              action={action}
              onRun={() => void simulateUsage(action.id)}
            />
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Panel
          title="Latest usage feed"
          subtitle="Use this timeline while you click through the demo so the client can see the wallet changes immediately."
        >
          <UsageHistoryTable
            items={workspace.transactions.slice(0, 10)}
            emptyTitle="No demo events yet"
            emptyCopy="Click any simulation card to populate this live event feed."
          />
        </Panel>

        <Panel
          title="Demo talking points"
          subtitle="A quick script support panel while you present."
        >
          <div className="space-y-4">
            {[
              {
                icon: Zap,
                title: 'Explain the credit economy',
                copy: 'INR 1 buys 10 credits. Every support action burns a clearly defined amount.',
              },
              {
                icon: TimerReset,
                title: 'Explain recharge logic',
                copy: 'When credits go below the threshold, autopay can instantly add the selected plan.',
              },
              {
                icon: Radar,
                title: 'Explain transparency',
                copy: 'Every burn and recharge is logged with timestamp, source, status, and reference ID.',
              },
            ].map((tip) => (
              <div key={tip.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <tip.icon className="h-5 w-5 text-emerald-200" />
                <div className="mt-4 text-lg font-semibold text-white">{tip.title}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{tip.copy}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
