import { MessageSquareMore, Sparkles, Wallet2, Zap } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { MetricCard } from '../components/shared/MetricCard';
import { Panel } from '../components/shared/Panel';
import { SearchableActivityPanel } from '../components/activity/SearchableActivityPanel';
import { formatCredits } from '../lib/formatters';

export default function ChatsPage() {
  const { workspace } = useBilling();

  if (!workspace) {
    return null;
  }

  const chatTransactions = workspace.transactions.filter((item) => item.source === 'ai_chat');
  const chatCreditsSpent = Math.abs(
    chatTransactions
      .filter((item) => item.creditsDelta < 0)
      .reduce((sum, item) => sum + item.creditsDelta, 0)
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={MessageSquareMore}
          label="AI chat sessions"
          value={`${chatTransactions.length}`}
          helper="Separated from calls so chat usage is easier to scan"
          tone="mint"
        />
        <MetricCard
          icon={Zap}
          label="Credits per chat"
          value="2 credits"
          helper="Current backend-enforced cost per AI request"
          tone="sky"
        />
        <MetricCard
          icon={Sparkles}
          label="Chat credits spent"
          value={formatCredits(chatCreditsSpent)}
          helper="Only AI chat burn, no voice or workflow traffic"
          tone="amber"
        />
        <MetricCard
          icon={Wallet2}
          label="Wallet remaining"
          value={formatCredits(workspace.balanceCredits)}
          helper="Use this lane to compare chat cost against balance"
          tone="violet"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <SearchableActivityPanel
          title="Chat Activity History"
          subtitle="A dedicated place for AI chat usage so support conversations are easier to search."
          items={chatTransactions}
          placeholder="Search chat activity by description or reference"
          emptyTitle="No chat activity yet"
          emptyCopy="AI chat activity will appear here as soon as requests are processed."
        />

        <Panel
          title="Chat Lane"
          subtitle="This area isolates text-based support so your team does not need to hunt through calls and billing events."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">What belongs here</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div>AI support prompts and customer-service chat requests.</div>
                <div>Credit burn tied only to chat interactions.</div>
                <div>A cleaner audit trail when you want to explain chat ROI separately from calls.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Why this helps</div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                Search stays fast because this screen is filtered to chat-only usage. If you later add a full chat inbox,
                this route is already the right home for it.
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
