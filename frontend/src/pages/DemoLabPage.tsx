import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  LoaderCircle,
  PhoneIncoming,
  PhoneOutgoing,
  Sparkles,
} from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { demoCallApi } from '../services/api';
import { Panel } from '../components/shared/Panel';
import { MetricCard } from '../components/shared/MetricCard';
import { StatusBadge } from '../components/shared/StatusBadge';
import { formatCredits, formatDateTime } from '../lib/formatters';
import type { DemoCallSession } from '../types';

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  tone: 'sky' | 'mint' | 'rose';
  timestamp: string;
};

const fallbackNumbers = {
  aiNumber: '8281929821',
  customerNumber: '9778773149',
  creditCost: 20,
};

export default function DemoLabPage() {
  const { workspace, refresh } = useBilling();
  const [sessions, setSessions] = useState<DemoCallSession[]>([]);
  const [aiNumber, setAiNumber] = useState(fallbackNumbers.aiNumber);
  const [customerNumber, setCustomerNumber] = useState(fallbackNumbers.customerNumber);
  const [creditCost, setCreditCost] = useState(fallbackNumbers.creditCost);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);
  const [activeAction, setActiveAction] = useState<'outbound' | 'incoming' | null>(null);
  const [statusTitle, setStatusTitle] = useState('System ready');
  const [statusDetail, setStatusDetail] = useState('Choose a simulation to demonstrate AI-assisted customer calling.');
  const [statusTone, setStatusTone] = useState<'sky' | 'mint' | 'rose'>('sky');
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const pushActivity = (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const nextItem: ActivityItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };

    setActivity((current) => [nextItem, ...current].slice(0, 6));
  };

  const loadSessions = async () => {
    setIsLoadingLogs(true);
    try {
      const response = await demoCallApi.listSessions();
      setSessions(response.data.sessions);
      setAiNumber(response.data.aiNumber);
      setCustomerNumber(response.data.customerNumber);
      setCreditCost(response.data.creditCost);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load demo call sessions';
      setStatusTitle('Unable to load call logs');
      setStatusDetail(message);
      setStatusTone('rose');
      pushActivity({
        title: 'Log sync failed',
        detail: message,
        tone: 'rose',
      });
      console.error('[demo-call] list sessions failed', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  if (!workspace) {
    return null;
  }

  const liveCredits = workspace.baseBalanceCredits;

  const runSimulation = async (type: 'outbound' | 'incoming') => {
    setActiveAction(type);
    const inFlightLabel =
      type === 'outbound' ? 'AI is calling the customer...' : 'Customer is calling the AI assistant...';
    const inFlightDetail =
      type === 'outbound'
        ? `Dialing ${customerNumber} from AI number ${aiNumber} and preparing the greeting.`
        : `Receiving the customer call on ${aiNumber} and preparing the AI response.`;

    setStatusTitle(inFlightLabel);
    setStatusDetail(inFlightDetail);
    setStatusTone('sky');
    pushActivity({
      title: type === 'outbound' ? 'Outbound simulation started' : 'Inbound simulation started',
      detail: inFlightDetail,
      tone: 'sky',
    });
    console.info('[demo-call] simulation started', { type, aiNumber, customerNumber });

    try {
      const response =
        type === 'outbound'
          ? await demoCallApi.simulateOutbound()
          : await demoCallApi.simulateIncoming();

      await Promise.all([refresh(), loadSessions()]);

      setStatusTitle('Call completed');
      setStatusDetail(`${response.data.session.message} ${response.data.creditsDeducted} credits were deducted.`);
      setStatusTone('mint');
      pushActivity({
        title: type === 'outbound' ? 'Outbound call completed' : 'Inbound call completed',
        detail: `${response.data.session.message} ${response.data.creditsDeducted} credits deducted.`,
        tone: 'mint',
      });
      console.info('[demo-call] simulation completed', response.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The simulated call could not be completed.';
      await Promise.all([refresh(), loadSessions()]);
      setStatusTitle('Call blocked');
      setStatusDetail(message);
      setStatusTone('rose');
      pushActivity({
        title: type === 'outbound' ? 'Outbound call blocked' : 'Inbound call blocked',
        detail: message,
        tone: 'rose',
      });
      console.error('[demo-call] simulation failed', { type, error });
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="hero-panel">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="eyebrow">AI Customer Assistant</div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Smart AI Call &amp; Chat System
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
              A clean SaaS-style demo showing how an AI assistant can simulate outbound and inbound customer calls,
              generate intelligent call messaging, deduct credits, and log every interaction in one place.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <StatusBadge label={`AI Number · ${aiNumber}`} tone="sky" />
              <StatusBadge label={`Customer Number · ${customerNumber}`} tone="mint" />
              <StatusBadge label={`${creditCost} credits / call`} tone="amber" />
            </div>
          </div>

          <div className="rounded-[1.9rem] border border-white/10 bg-slate-950/55 p-6">
            <div className="flex items-center gap-3 text-sm uppercase tracking-[0.24em] text-slate-500">
              <Sparkles className="h-4 w-4 text-emerald-200" />
              Demo flow
            </div>
            <div className="mt-5 space-y-4">
              {[
                'Trigger a simulated call from one of the two demo numbers.',
                'Let the backend generate the AI speaking message.',
                'Deduct 20 credits, save the call session, and refresh the dashboard.',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mt-1 rounded-full bg-emerald-300/12 p-2 text-emerald-100">
                    <ArrowRightLeft className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-6 text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <MetricCard
          icon={Bot}
          label="Current credits"
          value={formatCredits(liveCredits)}
          helper={`Live wallet balance. Every demo call burns ${creditCost} credits and updates the backend instantly.`}
          tone="mint"
        />

        <Panel
          title="Call Actions"
          subtitle="Use these buttons during the demo to simulate the two core call directions."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              className="group rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-emerald-300/25 hover:bg-emerald-300/[0.06]"
              onClick={() => void runSimulation('outbound')}
              disabled={activeAction !== null}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-emerald-300/12 p-3 text-emerald-100">
                  {activeAction === 'outbound' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <PhoneOutgoing className="h-5 w-5" />}
                </div>
                <StatusBadge label={`${creditCost} credits`} tone="amber" />
              </div>
              <div className="mt-5 text-lg font-semibold text-white">Simulate AI Calling Customer</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                AI number {aiNumber} calls customer number {customerNumber}, generates the opening message, and stores the session.
              </p>
            </button>

            <button
              type="button"
              className="group rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5 text-left transition hover:border-sky-300/25 hover:bg-sky-300/[0.06]"
              onClick={() => void runSimulation('incoming')}
              disabled={activeAction !== null}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-2xl bg-sky-300/12 p-3 text-sky-100">
                  {activeAction === 'incoming' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <PhoneIncoming className="h-5 w-5" />}
                </div>
                <StatusBadge label={`${creditCost} credits`} tone="amber" />
              </div>
              <div className="mt-5 text-lg font-semibold text-white">Simulate Customer Calling AI</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Customer number {customerNumber} calls the AI number {aiNumber}, and the assistant answers with a generated message.
              </p>
            </button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel
          title="Call Logs"
          subtitle="Recent simulated calls stored by the backend for the current account."
        >
          <div className="space-y-4">
            {isLoadingLogs ? (
              <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
                <LoaderCircle className="h-4 w-4 animate-spin text-sky-200" />
                Loading recent simulated calls...
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm leading-6 text-slate-400">
                No simulated calls yet. Trigger one of the call actions to populate this demo log.
              </div>
            ) : (
              sessions.map((session) => (
                <div key={session.id} className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={session.type === 'outbound' ? 'Outbound' : 'Incoming'}
                          tone={session.type === 'outbound' ? 'sky' : 'mint'}
                        />
                        <StatusBadge
                          label={session.status === 'completed' ? 'Completed' : 'Blocked'}
                          tone={session.status === 'completed' ? 'mint' : 'rose'}
                        />
                      </div>
                      <div className="mt-4 text-sm text-slate-400">From number</div>
                      <div className="text-base font-semibold text-white">{session.from_number}</div>
                      <div className="mt-3 text-sm text-slate-400">To number</div>
                      <div className="text-base font-semibold text-white">{session.to_number}</div>
                    </div>

                    <div className="max-w-xl md:text-right">
                      <div className="text-sm text-slate-400">AI message</div>
                      <p className="mt-2 text-sm leading-7 text-slate-200">{session.message}</p>
                      <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">
                        {formatDateTime(session.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel
            title="Status / Info"
            subtitle="Use this live panel while presenting the flow to non-technical clients."
          >
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 rounded-full p-2 ${
                    statusTone === 'mint'
                      ? 'bg-emerald-300/12 text-emerald-100'
                      : statusTone === 'rose'
                        ? 'bg-rose-300/12 text-rose-100'
                        : 'bg-sky-300/12 text-sky-100'
                  }`}
                >
                  {statusTone === 'mint'
                    ? <CheckCircle2 className="h-4 w-4" />
                    : statusTone === 'rose'
                      ? <AlertTriangle className="h-4 w-4" />
                      : <LoaderCircle className={`h-4 w-4 ${activeAction ? 'animate-spin' : ''}`} />}
                </div>
                <div>
                  <div className="text-lg font-semibold text-white">{statusTitle}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{statusDetail}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">AI Number</div>
                <div className="mt-3 text-xl font-semibold text-white">{aiNumber}</div>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Customer Number</div>
                <div className="mt-3 text-xl font-semibold text-white">{customerNumber}</div>
              </div>
            </div>
          </Panel>

          <Panel
            title="UI Activity Feed"
            subtitle="Every action is also written to the browser console for demo transparency."
          >
            <div className="space-y-4">
              {activity.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-sm leading-6 text-slate-400">
                  No UI events yet. Start a call simulation to populate this feed and the console log.
                </div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <StatusBadge label={item.title} tone={item.tone} />
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{formatDateTime(item.timestamp)}</div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
