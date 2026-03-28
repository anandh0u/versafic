import { useEffect, useState } from 'react';
import { LoaderCircle, PhoneIncoming, PhoneOutgoing, RefreshCcw } from 'lucide-react';
import { callApi } from '../../services/api';
import type { CallSessionItem } from '../../types';
import { formatDateTime } from '../../lib/formatters';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';

const PURPOSE_LABELS: Record<string, string> = {
  enquiry_follow_up: 'Enquiry Follow-up',
  missed_call_callback: 'Missed Call Callback',
  support_call: 'Support Call',
  booking_confirmation: 'Booking Confirmation',
};

const getStatusTone = (status: string): 'mint' | 'amber' | 'rose' | 'sky' | 'neutral' => {
  if (status === 'completed') return 'mint';
  if (status === 'initiated' || status === 'ringing' || status === 'in-progress' || status === 'processing') return 'sky';
  if (status === 'no-answer') return 'amber';
  if (status === 'failed') return 'rose';
  return 'neutral';
};

export function CallSessionsPanel({
  refreshSignal,
  limit = 8,
}: {
  refreshSignal?: number;
  limit?: number;
}) {
  const [sessions, setSessions] = useState<CallSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await callApi.getSessions(limit);
      setSessions(response.data.sessions);
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Failed to load call sessions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [refreshSignal]);

  return (
    <Panel
      title="Recent Call Sessions"
      subtitle="Live call sessions created by Twilio webhooks and outbound triggers."
      action={(
        <button
          type="button"
          onClick={() => void loadSessions()}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-300">
            <LoaderCircle className="h-4 w-4 animate-spin text-sky-200" />
            Loading recent call sessions...
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-300/20 bg-rose-400/10 p-5 text-sm leading-6 text-rose-100">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-sm leading-6 text-slate-400">
            No call sessions yet. Trigger an outbound call or ring the AI number from a verified customer phone to populate this area.
          </div>
        ) : (
          sessions.map((session) => {
            const script = typeof session.metadata?.script === 'string' ? session.metadata.script : null;
            const speechResult = typeof session.metadata?.speech_result === 'string' ? session.metadata.speech_result : null;
            const purposeLabel = session.purpose ? (PURPOSE_LABELS[session.purpose] || session.purpose.replace(/_/g, ' ')) : null;

            return (
              <div key={session.id} className="rounded-[1.6rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        label={session.type === 'incoming' ? 'Incoming' : 'Outgoing'}
                        tone={session.type === 'incoming' ? 'mint' : 'sky'}
                      />
                      <StatusBadge label={session.status} tone={getStatusTone(session.status)} />
                      {purposeLabel ? <StatusBadge label={purposeLabel} tone="amber" /> : null}
                      {session.callback_requested ? <StatusBadge label="Callback queued" tone="amber" /> : null}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                      {session.type === 'incoming' ? (
                        <PhoneIncoming className="h-4 w-4 text-emerald-200" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-sky-200" />
                      )}
                      {session.from_number} to {session.to_number}
                    </div>

                    {script ? (
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{script}</p>
                    ) : null}

                    {speechResult ? (
                      <div className="mt-3 text-xs leading-6 text-slate-400">
                        Customer speech: <span className="text-slate-200">{speechResult}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2 text-sm md:text-right">
                    <div className="text-slate-400">{formatDateTime(session.created_at)}</div>
                    <div className="text-slate-400">Call SID</div>
                    <div className="font-mono text-xs text-slate-200">{session.call_sid}</div>
                    {typeof session.duration_seconds === 'number' && session.duration_seconds > 0 ? (
                      <div className="text-xs text-slate-400">{session.duration_seconds}s recorded</div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
