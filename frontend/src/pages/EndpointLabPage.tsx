import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Bot,
  Headphones,
  Server,
  Waves,
} from 'lucide-react';
import { authApi, businessDirectoryApi, callApi, customerServiceApi, systemApi, aiApi, userApi, voiceApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useBilling } from '../hooks/useBilling';
import { Panel } from '../components/shared/Panel';
import { MetricCard } from '../components/shared/MetricCard';
import { JsonPreview } from '../components/shared/JsonPreview';

type EndpointResult = {
  label: string;
  ok: boolean;
  at: string;
  payload?: unknown;
  error?: string;
};

const buildResult = (
  label: string,
  ok: boolean,
  payload?: unknown,
  error?: string
): EndpointResult => ({
  label,
  ok,
  at: new Date().toISOString(),
  payload,
  error,
});

export default function EndpointLabPage() {
  const { user } = useAuth();
  const { workspace } = useBilling();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [systemResult, setSystemResult] = useState<EndpointResult | null>(null);
  const [aiResult, setAiResult] = useState<EndpointResult | null>(null);
  const [voiceResult, setVoiceResult] = useState<EndpointResult | null>(null);
  const [customerResult, setCustomerResult] = useState<EndpointResult | null>(null);
  const [setupResult, setSetupResult] = useState<EndpointResult | null>(null);
  const [businessResult, setBusinessResult] = useState<EndpointResult | null>(null);
  const [callResult, setCallResult] = useState<EndpointResult | null>(null);

  const [aiMessage, setAiMessage] = useState('Write a polite support reply for a customer asking to reschedule tomorrow.');
  const [extractText, setExtractText] = useState('My name is Priya, phone +91 9876543210, email priya@example.com, and I need a booking for Friday.');
  const [intentMessage, setIntentMessage] = useState('I missed your call and need support with my booking.');

  const [voiceLanguage, setVoiceLanguage] = useState('en-IN');
  const [voiceAudioBase64, setVoiceAudioBase64] = useState('');
  const [ttsText, setTtsText] = useState('Hello, this is a test from the Versafic voice endpoint.');
  const [voicePhoneLookup, setVoicePhoneLookup] = useState(user?.phoneNumber ?? '');

  const [customerSessionId, setCustomerSessionId] = useState('');
  const [customerText, setCustomerText] = useState('Hello, I need help confirming my appointment for tomorrow.');
  const [customerAudioBase64, setCustomerAudioBase64] = useState('');
  const [customerLanguage, setCustomerLanguage] = useState('en-IN');
  const [customerPhone, setCustomerPhone] = useState(user?.phoneNumber ?? '');

  const [setupForm, setSetupForm] = useState({
    businessName: '',
    businessType: '',
    industry: '',
    website: '',
    country: '',
    phone: '',
  });

  const [legacyBusinessForm, setLegacyBusinessForm] = useState({
    business_name: '',
    business_type: '',
    owner_name: '',
    phone: '',
    email: user?.email ?? '',
    update_id: '',
  });

  const [recordingFilterPhone, setRecordingFilterPhone] = useState(user?.phoneNumber ?? '');
  const [recordingCallSid, setRecordingCallSid] = useState('');

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setSetupForm((current) => ({
      businessName: current.businessName || workspace.businessProfile.businessName,
      businessType: current.businessType || workspace.businessProfile.businessType,
      industry: current.industry || workspace.businessProfile.industry,
      website: current.website || workspace.businessProfile.website,
      country: current.country || workspace.businessProfile.country,
      phone: current.phone || workspace.businessProfile.phone,
    }));
  }, [workspace]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setVoicePhoneLookup((current) => current || user.phoneNumber || '');
    setCustomerPhone((current) => current || user.phoneNumber || '');
    setRecordingFilterPhone((current) => current || user.phoneNumber || '');
    setLegacyBusinessForm((current) => ({
      ...current,
      owner_name: current.owner_name || user.name || '',
      email: current.email || user.email || '',
      phone: current.phone || user.phoneNumber || '',
    }));
  }, [user]);

  const runAction = async (
    actionKey: string,
    label: string,
    setter: Dispatch<SetStateAction<EndpointResult | null>>,
    task: () => Promise<unknown>
  ) => {
    try {
      setBusyAction(actionKey);
      const payload = await task();
      setter(buildResult(label, true, payload));
    } catch (error) {
      setter(buildResult(
        label,
        false,
        undefined,
        error instanceof Error ? error.message : 'Request failed'
      ));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Server} label="System endpoints" value="5+" helper="Health, auth, setup, and observability checks" tone="sky" />
        <MetricCard icon={Bot} label="AI endpoints" value="6" helper="Chat, history, stats, extraction, intent, service reply" tone="mint" />
        <MetricCard icon={Waves} label="Voice endpoints" value="5" helper="Process, STT, TTS, phone history, and statistics" tone="amber" />
        <MetricCard icon={Headphones} label="Ops endpoints" value="10+" helper="Customer-service sessions, business directory, and call recordings" tone="violet" />
      </section>

      <Panel
        title="Presentation Workbench"
        subtitle="This page exposes the remaining backend endpoints through the frontend so you can demo them live. Twilio webhook endpoints are intentionally excluded here because they are backend-to-backend integration URLs, not browser actions."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            'Use the lane pages for the polished story and this workbench for raw endpoint proof.',
            'If AI or voice keys are not configured in the backend environment, the requests here will still prove wiring and return the backend error clearly.',
            'For Insomnia testing, the same request bodies and verification order are documented in the repository guide added with this pass.',
          ].map((copy) => (
            <div key={copy} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm leading-7 text-slate-300">
              {copy}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="System + Setup" subtitle="Check health, account, and authenticated business-setup endpoints without leaving the app.">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button onClick={() => void runAction('health', 'GET /health', setSystemResult, () => systemApi.health())} disabled={busyAction !== null} className="button-secondary justify-center">Check `/health`</button>
              <button onClick={() => void runAction('ops-health', 'GET /ops/health', setSystemResult, () => systemApi.observabilityHealth())} disabled={busyAction !== null} className="button-secondary justify-center">Check `/ops/health`</button>
              <button onClick={() => void runAction('ops-status', 'GET /ops/status', setSystemResult, () => systemApi.observabilityStatus())} disabled={busyAction !== null} className="button-secondary justify-center">Check `/ops/status`</button>
              <button onClick={() => void runAction('auth-me', 'GET /auth/me', setSystemResult, () => authApi.getCurrentUser())} disabled={busyAction !== null} className="button-secondary justify-center">Load `/auth/me`</button>
              <button onClick={() => void runAction('setup-status', 'GET /setup/status', setSetupResult, () => userApi.getStatus())} disabled={busyAction !== null} className="button-secondary justify-center">Load `/setup/status`</button>
              <button onClick={() => void runAction('setup-profile', 'GET /setup/business', setSetupResult, () => userApi.getProfile())} disabled={busyAction !== null} className="button-secondary justify-center">Load `/setup/business`</button>
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Update `/setup/business`</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  { key: 'businessName', label: 'Business name' },
                  { key: 'businessType', label: 'Business type' },
                  { key: 'industry', label: 'Industry' },
                  { key: 'website', label: 'Website' },
                  { key: 'country', label: 'Country' },
                  { key: 'phone', label: 'Phone' },
                ].map((field) => (
                  <label key={field.key} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{field.label}</div>
                    <input
                      value={setupForm[field.key as keyof typeof setupForm]}
                      onChange={(event) => setSetupForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))}
                      className="mt-3 w-full bg-transparent text-white outline-none"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() => void runAction(
                  'setup-save',
                  'POST /setup/business',
                  setSetupResult,
                  () => userApi.updateBusiness(setupForm)
                )}
                disabled={busyAction !== null}
                className="button-primary mt-4 justify-center"
              >
                Save setup profile
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <JsonPreview title="System response" data={systemResult} emptyCopy="Health, auth, and ops responses will appear here." />
            <JsonPreview title="Setup response" data={setupResult} emptyCopy="Setup profile and onboarding status responses will appear here." />
          </div>
        </div>
      </Panel>

      <Panel title="AI Endpoint Studio" subtitle="Presentation controls for the authenticated AI endpoints, including chat, stats, extraction, and intent analysis.">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <label className="block rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Chat / customer-service prompt</div>
              <textarea value={aiMessage} onChange={(event) => setAiMessage(event.target.value)} rows={5} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none" />
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <button onClick={() => void runAction('ai-chat', 'POST /ai/chat', setAiResult, () => aiApi.chat(aiMessage))} disabled={busyAction !== null} className="button-primary justify-center">Run `/ai/chat`</button>
                <button onClick={() => void runAction('ai-service-response', 'POST /ai/customer-service-response', setAiResult, () => aiApi.customerServiceResponse(aiMessage))} disabled={busyAction !== null} className="button-secondary justify-center">Run service reply</button>
                <button onClick={() => void runAction('ai-history', 'GET /ai/chat/history', setAiResult, () => aiApi.getHistory({ limit: 10 }))} disabled={busyAction !== null} className="button-secondary justify-center">Get history</button>
                <button onClick={() => void runAction('ai-stats', 'GET /ai/chat/stats', setAiResult, () => aiApi.getStats())} disabled={busyAction !== null} className="button-secondary justify-center">Get stats</button>
                <button onClick={() => void runAction('ai-clear', 'DELETE /ai/chat/history', setAiResult, () => aiApi.clearHistory())} disabled={busyAction !== null} className="button-secondary justify-center">Clear history</button>
              </div>
            </label>

            <label className="block rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Extract structured data</div>
              <textarea value={extractText} onChange={(event) => setExtractText(event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none" />
              <button onClick={() => void runAction('ai-extract', 'POST /ai/extract', setAiResult, () => aiApi.extractData(extractText))} disabled={busyAction !== null} className="button-secondary mt-4 justify-center">Run `/ai/extract`</button>
            </label>

            <label className="block rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Understand intent</div>
              <textarea value={intentMessage} onChange={(event) => setIntentMessage(event.target.value)} rows={3} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none" />
              <button onClick={() => void runAction('ai-intent', 'POST /ai/intent', setAiResult, () => aiApi.understandIntent(intentMessage))} disabled={busyAction !== null} className="button-secondary mt-4 justify-center">Run `/ai/intent`</button>
            </label>
          </div>

          <JsonPreview title="AI response" data={aiResult} emptyCopy="AI endpoint responses will appear here." />
        </div>
      </Panel>

      <Panel title="Voice Endpoint Studio" subtitle="Frontend controls for the voice pipeline endpoints. Paste sample audio base64 when you want to test the full voice path.">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-3 md:grid-cols-[180px_1fr]">
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Language</div>
                  <input value={voiceLanguage} onChange={(event) => setVoiceLanguage(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Audio base64</div>
                  <textarea value={voiceAudioBase64} onChange={(event) => setVoiceAudioBase64(event.target.value)} rows={4} className="mt-3 w-full bg-transparent text-white outline-none" placeholder="Paste audioBase64 here for /voice/process or /voice/stt" />
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <button onClick={() => void runAction('voice-process', 'POST /voice/process', setVoiceResult, () => voiceApi.process({ audioBase64: voiceAudioBase64, language: voiceLanguage }))} disabled={busyAction !== null} className="button-primary justify-center">Run `/voice/process`</button>
                <button onClick={() => void runAction('voice-stt', 'POST /voice/stt', setVoiceResult, () => voiceApi.speechToText({ audioBase64: voiceAudioBase64, language: voiceLanguage }))} disabled={busyAction !== null} className="button-secondary justify-center">Run `/voice/stt`</button>
                <button onClick={() => void runAction('voice-stats', 'GET /voice/statistics', setVoiceResult, () => voiceApi.getStatistics())} disabled={busyAction !== null} className="button-secondary justify-center">Get statistics</button>
              </div>
            </div>

            <label className="block rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Text-to-speech</div>
              <textarea value={ttsText} onChange={(event) => setTtsText(event.target.value)} rows={4} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none" />
              <button onClick={() => void runAction('voice-tts', 'POST /voice/tts', setVoiceResult, () => voiceApi.textToSpeech({ text: ttsText, language: voiceLanguage }))} disabled={busyAction !== null} className="button-secondary mt-4 justify-center">Run `/voice/tts`</button>
            </label>

            <label className="block rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Conversation lookup by phone</div>
              <input value={voicePhoneLookup} onChange={(event) => setVoicePhoneLookup(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white outline-none" />
              <button onClick={() => void runAction('voice-phone-history', 'GET /voice/conversations/phone/:phone', setVoiceResult, () => voiceApi.getConversationsByPhone(voicePhoneLookup))} disabled={busyAction !== null || !voicePhoneLookup.trim()} className="button-secondary mt-4 justify-center">Get phone conversations</button>
            </label>
          </div>

          <JsonPreview title="Voice response" data={voiceResult} emptyCopy="Voice endpoint responses will appear here." />
        </div>
      </Panel>

      <Panel title="Customer-Service Session Studio" subtitle="Test the session-based customer-service endpoints that sit beside the AI and voice stack.">
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Session ID</div>
                  <input value={customerSessionId} onChange={(event) => setCustomerSessionId(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" placeholder="Created by /customer-service/start" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Language code</div>
                  <input value={customerLanguage} onChange={(event) => setCustomerLanguage(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 md:col-span-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Text message</div>
                  <textarea value={customerText} onChange={(event) => setCustomerText(event.target.value)} rows={4} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 md:col-span-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Audio base64 (optional)</div>
                  <textarea value={customerAudioBase64} onChange={(event) => setCustomerAudioBase64(event.target.value)} rows={4} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <button
                  onClick={() => void runAction('cs-start', 'POST /customer-service/start', setCustomerResult, async () => {
                    const payload = await customerServiceApi.startSession() as { data?: { sessionId?: string } };
                    const nextSessionId = payload?.data?.sessionId;
                    if (nextSessionId) {
                      setCustomerSessionId(nextSessionId);
                    }
                    return payload;
                  })}
                  disabled={busyAction !== null}
                  className="button-primary justify-center"
                >
                  Start session
                </button>
                <button
                  onClick={() => void runAction('cs-chat', 'POST /customer-service/chat', setCustomerResult, () => customerServiceApi.chat({
                    sessionId: customerSessionId || undefined,
                    textMessage: customerText || undefined,
                    audioBase64: customerAudioBase64 || undefined,
                    languageCode: customerLanguage || undefined,
                  }))}
                  disabled={busyAction !== null}
                  className="button-secondary justify-center"
                >
                  Send message
                </button>
                <button
                  onClick={() => void runAction('cs-active', 'GET /customer-service/active-sessions', setCustomerResult, () => customerServiceApi.getActiveSessions())}
                  disabled={busyAction !== null}
                  className="button-secondary justify-center"
                >
                  Active sessions
                </button>
                <button onClick={() => void runAction('cs-history', 'GET /customer-service/history/:sessionId', setCustomerResult, () => customerServiceApi.getHistory(customerSessionId))} disabled={busyAction !== null || !customerSessionId.trim()} className="button-secondary justify-center">Get history</button>
                <button onClick={() => void runAction('cs-session', 'GET /customer-service/session/:sessionId', setCustomerResult, () => customerServiceApi.getSession(customerSessionId))} disabled={busyAction !== null || !customerSessionId.trim()} className="button-secondary justify-center">Get session data</button>
                <button onClick={() => void runAction('cs-end', 'POST /customer-service/end/:sessionId', setCustomerResult, () => customerServiceApi.endSession(customerSessionId))} disabled={busyAction !== null || !customerSessionId.trim()} className="button-secondary justify-center">End session</button>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Phone for interaction lookup</div>
                  <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
                <button onClick={() => void runAction('cs-phone', 'GET /customer-service/interactions/phone/:phone', setCustomerResult, () => customerServiceApi.getInteractionsByPhone(customerPhone))} disabled={busyAction !== null || !customerPhone.trim()} className="button-secondary justify-center self-end">Interactions</button>
                <button onClick={() => void runAction('cs-resolved', 'GET /customer-service/interactions/resolved', setCustomerResult, () => customerServiceApi.getResolvedInteractions(25))} disabled={busyAction !== null} className="button-secondary justify-center self-end">Resolved</button>
                <button onClick={() => void runAction('cs-sentiment', 'GET /customer-service/stats/sentiment', setCustomerResult, () => customerServiceApi.getSentimentStats())} disabled={busyAction !== null} className="button-secondary justify-center self-end">Sentiment</button>
              </div>
              <button onClick={() => void runAction('cs-resolution', 'GET /customer-service/stats/resolution', setCustomerResult, () => customerServiceApi.getResolutionStats())} disabled={busyAction !== null} className="button-secondary mt-4 justify-center">Resolution stats</button>
            </div>
          </div>

          <JsonPreview title="Customer-service response" data={customerResult} emptyCopy="Session and interaction responses will appear here." />
        </div>
      </Panel>

      <Panel title="Business Directory + Recording Inspector" subtitle="Expose the remaining presentation-friendly endpoints for public business onboarding, listing, updates, and recording lookup.">
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Public `/business` endpoints</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  { key: 'business_name', label: 'Business name' },
                  { key: 'business_type', label: 'Business type' },
                  { key: 'owner_name', label: 'Owner name' },
                  { key: 'phone', label: 'Phone' },
                  { key: 'email', label: 'Email' },
                  { key: 'update_id', label: 'Update ID' },
                ].map((field) => (
                  <label key={field.key} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{field.label}</div>
                    <input
                      value={legacyBusinessForm[field.key as keyof typeof legacyBusinessForm]}
                      onChange={(event) => setLegacyBusinessForm((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))}
                      className="mt-3 w-full bg-transparent text-white outline-none"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <button onClick={() => void runAction('biz-onboard', 'POST /business/onboard', setBusinessResult, () => businessDirectoryApi.onboard({
                  business_name: legacyBusinessForm.business_name,
                  business_type: legacyBusinessForm.business_type,
                  owner_name: legacyBusinessForm.owner_name,
                  phone: legacyBusinessForm.phone,
                  email: legacyBusinessForm.email,
                }))} disabled={busyAction !== null} className="button-primary justify-center">Onboard business</button>
                <button onClick={() => void runAction('biz-email', 'GET /business/:email', setBusinessResult, () => businessDirectoryApi.getByEmail(legacyBusinessForm.email))} disabled={busyAction !== null || !legacyBusinessForm.email.trim()} className="button-secondary justify-center">Lookup by email</button>
                <button onClick={() => void runAction('biz-list', 'GET /business', setBusinessResult, () => businessDirectoryApi.getAll({ limit: 20, offset: 0 }))} disabled={busyAction !== null} className="button-secondary justify-center">List businesses</button>
                <button onClick={() => void runAction('biz-update', 'PUT /business/:id', setBusinessResult, () => businessDirectoryApi.update(legacyBusinessForm.update_id, {
                  business_name: legacyBusinessForm.business_name || undefined,
                  business_type: legacyBusinessForm.business_type || undefined,
                  owner_name: legacyBusinessForm.owner_name || undefined,
                  phone: legacyBusinessForm.phone || undefined,
                  email: legacyBusinessForm.email || undefined,
                }))} disabled={busyAction !== null || !legacyBusinessForm.update_id.trim()} className="button-secondary justify-center">Update business</button>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">Call recording endpoints</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Phone filter</div>
                  <input value={recordingFilterPhone} onChange={(event) => setRecordingFilterPhone(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
                <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Call SID</div>
                  <input value={recordingCallSid} onChange={(event) => setRecordingCallSid(event.target.value)} className="mt-3 w-full bg-transparent text-white outline-none" />
                </label>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <button onClick={() => void runAction('recordings-all', 'GET /call/recordings', setCallResult, () => callApi.getRecordings({ limit: 25 }))} disabled={busyAction !== null} className="button-secondary justify-center">All recordings</button>
                <button onClick={() => void runAction('recordings-phone', 'GET /call/recordings?phoneNumber=', setCallResult, () => callApi.getRecordings({ phoneNumber: recordingFilterPhone }))} disabled={busyAction !== null || !recordingFilterPhone.trim()} className="button-secondary justify-center">Filter by phone</button>
                <button onClick={() => void runAction('recordings-sid', 'GET /call/recordings/:callSid', setCallResult, () => callApi.getRecordingByCallSid(recordingCallSid))} disabled={busyAction !== null || !recordingCallSid.trim()} className="button-secondary justify-center">Lookup by SID</button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <JsonPreview title="Business directory response" data={businessResult} emptyCopy="Public business route responses will appear here." />
            <JsonPreview title="Call recording response" data={callResult} emptyCopy="Recording lookup responses will appear here." />
          </div>
        </div>
      </Panel>
    </div>
  );
}
