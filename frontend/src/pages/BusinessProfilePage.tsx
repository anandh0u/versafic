import { Building2, Globe, Phone, Settings2, Shield, Sparkles } from 'lucide-react';
import { useBilling } from '../hooks/useBilling';
import { Panel } from '../components/shared/Panel';
import { StatusBadge } from '../components/shared/StatusBadge';
import { formatDateTime } from '../lib/formatters';

export default function BusinessProfilePage() {
  const { workspace } = useBilling();

  if (!workspace) {
    return null;
  }

  const profile = workspace.businessProfile;

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Business profile"
          subtitle="This section connects the workspace to a real business operating environment."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Building2, label: 'Business name', value: profile.businessName },
              { icon: Settings2, label: 'Business type', value: profile.businessType },
              { icon: Sparkles, label: 'Industry', value: profile.industry },
              { icon: Phone, label: 'Phone', value: profile.phone },
              { icon: Globe, label: 'Website', value: profile.website },
              { icon: Shield, label: 'Country', value: profile.country },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                <item.icon className="h-5 w-5 text-emerald-200" />
                <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-lg font-semibold text-white">{item.value}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Workflow readiness"
          subtitle="Operational status indicators designed for client confidence."
        >
          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-300">Support workflow</div>
                  <div className="mt-2 text-xl font-semibold text-white">{profile.supportWorkflowStatus}</div>
                </div>
                <StatusBadge label="Active" tone="mint" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-slate-300">AI setup status</div>
                  <div className="mt-2 text-xl font-semibold text-white">{profile.aiSetupStatus}</div>
                </div>
                <StatusBadge label="Synced" tone="sky" />
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-medium text-slate-300">Onboarding stage</div>
              <div className="mt-2 text-xl font-semibold text-white">{profile.onboardingStage}</div>
              <div className="mt-3 text-sm text-slate-400">Last synced {formatDateTime(profile.lastSyncAt)}</div>
            </div>
          </div>
        </Panel>
      </section>

      <Panel
        title="Why this matters"
        subtitle="These points help position the platform as a serious, measurable SaaS system for operations teams."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            'Each call, chat, and transcript is measurable, which makes the credit model easy to explain to finance and operations.',
            'Business setup status shows the platform is ready for real onboarding, not just a disconnected prototype.',
            'Autopay and transparent usage history make the service look production-minded, not like a one-off prototype.',
          ].map((copy) => (
            <div key={copy} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5 text-sm leading-7 text-slate-300">
              {copy}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
