import { ArrowDownLeft, ArrowUpRight, Clock3, PhoneCall, ShieldCheck } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { MetricCard } from '../components/shared/MetricCard';
import { Panel } from '../components/shared/Panel';
import { SearchableActivityPanel } from '../components/activity/SearchableActivityPanel';
import { OutboundCallDemo } from '../components/call/OutboundCallDemo';
import { formatCredits } from '../lib/formatters';

const CALL_SOURCES = ['voice_call', 'premium_call', 'inbound_call', 'outbound_call'];

export default function CallsPage() {
  const { workspace } = useBilling();

  if (!workspace) {
    return null;
  }

  const callTransactions = workspace.transactions.filter((item) => CALL_SOURCES.includes(item.source));
  const inboundTransactions = callTransactions.filter((item) => item.source === 'inbound_call');
  const outboundTransactions = callTransactions.filter((item) => item.source === 'outbound_call');
  const callCreditsSpent = Math.abs(
    callTransactions
      .filter((item) => item.creditsDelta < 0)
      .reduce((sum, item) => sum + item.creditsDelta, 0)
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={PhoneCall}
          label="Call activity"
          value={`${callTransactions.length}`}
          helper="Inbound, outbound, and minute-based call events"
          tone="sky"
        />
        <MetricCard
          icon={ArrowDownLeft}
          label="Inbound calls"
          value={`${inboundTransactions.length}`}
          helper="Customer-initiated sessions reaching the business"
          tone="mint"
        />
        <MetricCard
          icon={ArrowUpRight}
          label="Outbound calls"
          value={`${outboundTransactions.length}`}
          helper="AI-triggered follow-ups and callbacks"
          tone="amber"
        />
        <MetricCard
          icon={Clock3}
          label="Call credits spent"
          value={formatCredits(callCreditsSpent)}
          helper="Only call-related burn, separate from chat and workflows"
          tone="rose"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OutboundCallDemo />

        <Panel
          title="Call Guardrails"
          subtitle="This lane stays focused on phone interactions so the team can find call history and compliance details quickly."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Safety rules</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div>Only registered users with explicit consent can be called.</div>
                <div>STOP opt-out is honored and blocks future AI calls.</div>
                <div>Daily outbound limit stays at 2 calls with a 24-hour cooldown per recipient.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="flex items-center gap-3 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-200" />
                Reserved call credits are refunded on failed or missed attempts.
              </div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                This keeps the call lane easy to trust when you are reviewing support callbacks or outbound follow-ups.
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <SearchableActivityPanel
        title="Call Activity History"
        subtitle="Search only call-related activity instead of scanning through the full billing timeline."
        items={callTransactions}
        placeholder="Search call activity by purpose, source, or reference"
        emptyTitle="No call activity yet"
        emptyCopy="Trigger an outbound AI call or run call simulations to populate this area."
      />
    </div>
  );
}
