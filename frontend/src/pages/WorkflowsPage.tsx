import { AudioLines, Bot, Mic, Settings2 } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { MetricCard } from '../components/shared/MetricCard';
import { Panel } from '../components/shared/Panel';
import { SearchableActivityPanel } from '../components/activity/SearchableActivityPanel';
import { formatCredits } from '../lib/formatters';

const WORKFLOW_SOURCES = ['sarvam_stt', 'voice_process', 'recording_process', 'onboarding_ai_setup'];

export default function WorkflowsPage() {
  const { workspace } = useBilling();

  if (!workspace) {
    return null;
  }

  const workflowTransactions = workspace.transactions.filter((item) => WORKFLOW_SOURCES.includes(item.source));
  const workflowCreditsSpent = Math.abs(
    workflowTransactions
      .filter((item) => item.creditsDelta < 0)
      .reduce((sum, item) => sum + item.creditsDelta, 0)
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Mic}
          label="Sarvam requests"
          value={`${workspace.usageSummary.sarvamRequests}`}
          helper="Speech-to-text and voice capture jobs"
          tone="sky"
        />
        <MetricCard
          icon={AudioLines}
          label="Voice processing"
          value={`${workspace.usageSummary.voiceProcesses}`}
          helper="Intent routing and voice orchestration"
          tone="amber"
        />
        <MetricCard
          icon={Bot}
          label="Recording + AI ops"
          value={`${workspace.usageSummary.recordingsProcessed}`}
          helper="Post-call processing and QA-style analysis"
          tone="mint"
        />
        <MetricCard
          icon={Settings2}
          label="Workflow credits spent"
          value={formatCredits(workflowCreditsSpent)}
          helper="Everything not in call or chat lanes"
          tone="violet"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SearchableActivityPanel
          title="Workflow Activity History"
          subtitle="Operations events, voice processing, recordings, and onboarding automation live here instead of cluttering calls or chat."
          items={workflowTransactions}
          placeholder="Search workflow activity by source or reference"
          emptyTitle="No workflow activity yet"
          emptyCopy="Use the demo lab or voice features to populate workflow events."
        />

        <Panel
          title="Workflow Lane"
          subtitle="This area is the home for the rest of the platform activity outside direct call and chat sessions."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Included here</div>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                <div>Sarvam speech-to-text processing.</div>
                <div>Voice orchestration and recording analysis.</div>
                <div>Onboarding automations and setup tasks.</div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Result</div>
              <div className="mt-3 text-sm leading-6 text-slate-400">
                Teams can now jump straight to calls, chat, or background workflows instead of searching through one mixed activity list.
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
