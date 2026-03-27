import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Phone, ShieldAlert } from 'lucide-react';
import type { CallPurpose, OutboundCallResponse } from '../../types';
import { callApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useBilling } from '../../hooks/useBilling';
import { formatCredits } from '../../lib/formatters';
import { Panel } from '../shared/Panel';
import { StatusBadge } from '../shared/StatusBadge';

const CALL_PURPOSES: Array<{ value: CallPurpose; label: string; description: string }> = [
  {
    value: 'enquiry_follow_up',
    label: 'Enquiry Follow-up',
    description: 'Follow up on a previous inquiry or interest from the customer.',
  },
  {
    value: 'missed_call_callback',
    label: 'Missed Call Callback',
    description: 'Return a call to a customer who missed a previous call.',
  },
  {
    value: 'support_call',
    label: 'Support Call',
    description: 'Provide customer support or technical assistance.',
  },
  {
    value: 'booking_confirmation',
    label: 'Booking Confirmation',
    description: 'Confirm or reschedule an appointment or booking.',
  },
];

export function OutboundCallDemo() {
  const { user, updateProfile } = useAuth();
  const { workspace } = useBilling();
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [selectedPurpose, setSelectedPurpose] = useState<CallPurpose>('enquiry_follow_up');
  const [callConsent, setCallConsent] = useState(Boolean(user?.callConsent));
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [response, setResponse] = useState<OutboundCallResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhoneNumber(user?.phoneNumber || '');
    setCallConsent(Boolean(user?.callConsent));
  }, [user?.phoneNumber, user?.callConsent]);

  const isValidPhone = phoneNumber.trim().length >= 10;
  const canTrigger = isValidPhone && callConsent && !isLoading && !isSaving;

  const persistCallPreferences = async () => {
    if (!isValidPhone) {
      throw new Error('Enter a valid registered phone number before saving call preferences.');
    }

    await updateProfile({
      phone_number: phoneNumber.trim(),
      call_consent: callConsent,
      call_opt_out: false,
    });
  };

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);
      setError(null);
      await persistCallPreferences();
      setStatus('idle');
      setResponse(null);
    } catch (saveError) {
      setStatus('error');
      setError(saveError instanceof Error ? saveError.message : 'Failed to save call preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerCall = async () => {
    if (!canTrigger) return;

    setIsLoading(true);
    setStatus('processing');
    setError(null);
    setResponse(null);

    try {
      await persistCallPreferences();

      const result = await callApi.triggerOutboundCall({
        phone_number: phoneNumber.trim(),
        purpose: selectedPurpose,
      });

      if (result.status === 'success') {
        setStatus('success');
        setResponse(result.data);
        setPhoneNumber('');
        setCallConsent(false);
      } else {
        throw new Error(result.message || 'Failed to trigger call');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger outbound call. Please check your balance and try again.';
      setStatus('error');
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setResponse(null);
    setError(null);
    setPhoneNumber('');
    setCallConsent(false);
  };

  return (
    <Panel
      title="Outbound Call Demo"
      subtitle="Trigger an AI-powered outbound call with automatic script generation. Verify you own the number before calling."
      action={<StatusBadge label="Demo Mode" tone="sky" />}
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          {/* Phone Input */}
          <label className="block rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-semibold text-white">Phone Number</div>
            <p className="mt-1 text-xs text-slate-400">Include country code (e.g., +91 for India)</p>
            <input
              type="tel"
              placeholder="+91 9876543210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={status === 'processing'}
              className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950/55 px-4 py-3 text-white placeholder-slate-500 outline-none transition hover:border-white/20 focus:border-white/30 disabled:opacity-50"
            />
            {phoneNumber && !isValidPhone && (
              <div className="mt-2 text-xs text-rose-300">Phone number must be at least 10 digits</div>
            )}
          </label>

          {/* Call Purpose Selection */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-sm font-semibold text-white">Call Purpose</div>
            <p className="mt-1 text-xs text-slate-400">The AI will generate a script matching this intent</p>
            <div className="mt-4 space-y-2">
              {CALL_PURPOSES.map((purpose) => (
                <label
                  key={purpose.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                    selectedPurpose === purpose.value
                      ? 'border-sky-300/30 bg-sky-300/[0.08]'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <input
                    type="radio"
                    name="call_purpose"
                    value={purpose.value}
                    checked={selectedPurpose === purpose.value}
                    onChange={(e) => setSelectedPurpose(e.target.value as CallPurpose)}
                    disabled={status === 'processing'}
                    className="mt-1"
                  />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-white">{purpose.label}</div>
                    <div className="mt-1 text-xs text-slate-400">{purpose.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Consent Checkbox */}
          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <input
              type="checkbox"
              checked={callConsent}
              onChange={(e) => setCallConsent(e.target.checked)}
              disabled={status === 'processing'}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">I own and consent to this number being called</div>
              <p className="mt-2 flex items-start gap-2 text-xs leading-6 text-slate-400">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-200" />
                This initiates an outbound call. Ensure you have proper customer consent. Numbers are verified server-side for compliance.
              </p>
            </div>
          </label>

          {/* Status Messages */}
          {status === 'success' && response && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-200" />
              <div>
                <div className="font-semibold text-emerald-50">Call initiated successfully</div>
                <div className="mt-2 space-y-1 text-sm text-emerald-100/80">
                  <div>
                    <span className="font-medium">Call SID:</span> {response.callSid}
                  </div>
                  <div>
                    <span className="font-medium">To:</span> {response.to}
                  </div>
                  <div className="mt-2 rounded bg-white/10 p-2 font-mono text-xs">"{response.script}"</div>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && error && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-200" />
              <div>
                <div className="font-semibold text-rose-50">Call failed</div>
                <div className="mt-1 text-sm text-rose-100/80">{error}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {status === 'idle' || status === 'error' ? (
              <>
                <button
                  onClick={() => void handleSavePreferences()}
                  disabled={!isValidPhone || isSaving || isLoading}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5"
                >
                  {isSaving ? 'Saving...' : 'Save Preferences'}
                </button>
                <button
                  onClick={handleTriggerCall}
                  disabled={!canTrigger}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Phone className="h-4 w-4" />
                  Trigger Call
                </button>
              </>
            ) : status === 'processing' ? (
              <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700 px-4 py-3 text-sm font-semibold text-white">
                <Loader className="h-4 w-4 animate-spin" />
                Initiating Call
              </div>
            ) : (
              <button
                onClick={handleReset}
                className="flex-1 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Done
              </button>
            )}
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-white/[0.03] p-6">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">How it works</div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
              <div>
                <div className="font-semibold text-white">1. Register the number</div>
                <p className="mt-1 text-slate-400">Save the same consented phone number on your user profile first.</p>
              </div>
              <div>
                <div className="font-semibold text-white">2. Select Purpose</div>
                <p className="mt-1 text-slate-400">Choose the intent (follow-up, callback, support, confirmation)</p>
              </div>
              <div>
                <div className="font-semibold text-white">3. Confirm Consent</div>
                <p className="mt-1 text-slate-400">Verify you own the number and have customer permission</p>
              </div>
              <div>
                <div className="font-semibold text-white">4. Trigger</div>
                <p className="mt-1 text-slate-400">AI generates a script, Twilio places the call, and the STOP phrase is honored.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Credits used</div>
            <div className="mt-2 text-2xl font-semibold text-sky-100">20 credits</div>
            <p className="mt-1 text-xs text-slate-400">
              Reserved for the one-minute call window. Failed or missed calls are refunded automatically.
            </p>
            {workspace && (
              <p className="mt-3 text-xs text-slate-400">Current wallet: {formatCredits(workspace.balanceCredits)}</p>
            )}
          </div>

          <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 p-4">
            <div className="flex gap-2 text-xs leading-5 text-amber-50">
              <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <div className="font-semibold">Compliance Enforced</div>
                <div className="mt-1 text-amber-100/80">
                  Only registered, consented users can be called. Max 2 calls per day, 24-hour cooldown, and STOP opt-out are enforced.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
