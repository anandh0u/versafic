import {
  ArrowRight,
  BadgeIndianRupee,
  CreditCard,
  MessageSquareMore,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Wallet2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { StatusBadge } from '../components/shared/StatusBadge';
import { pricingPlans, usageRules } from '../config/billing';
import { formatCurrency } from '../lib/formatters';

const features = [
  {
    title: 'Credit-led billing engine',
    copy: 'Turn every call, chat, transcript, and workflow into transparent credit consumption your client can understand instantly.',
  },
  {
    title: 'Voice + AI operations',
    copy: 'Support customer calls, voice workflows, chat automation, onboarding, and post-call processing from one product story.',
  },
  {
    title: 'Autopay and renewal UX',
    copy: 'Show clients how the service stays live with automatic recharge when balance drops or plan renewal triggers.',
  },
  {
    title: 'Demo-first experience',
    copy: 'Simulate usage live during a meeting, watch balance update, and explain where every credit went.',
  },
];

const steps = [
  'Business buys a plan or instant top-up',
  'Credits land in the wallet immediately',
  'AI chat, calls, STT, and processing burn credits transparently',
  'Autopay protects the account before service disruption',
];

export default function HomePage() {
  return (
    <div className="site-shell">
      <header className="page-container py-6">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/70 px-6 py-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <BrandMark />
          <nav className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <a href="#features" className="nav-link">Features</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <a href="#billing-model" className="nav-link">Billing model</a>
            <a href="#contact" className="nav-link">Demo CTA</a>
          </nav>
          <div className="flex flex-wrap gap-3">
            <Link to="/login" className="button-secondary">Login</Link>
            <Link to="/register" className="button-primary">Get demo access</Link>
          </div>
        </div>
      </header>

      <main className="page-container pb-20">
        <section className="grid gap-8 pt-8 xl:grid-cols-[1.05fr_0.95fr] xl:pt-12">
          <div className="pt-6">
            <StatusBadge label="AI customer support + transparent credits" tone="mint" />
            <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              A serious SaaS front end for selling AI customer service with clear credit economics.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Versafic helps restaurants, hotels, clinics, and service businesses run AI-powered calls and chat,
              while finance and operations teams see exactly how credits are bought, burned, and auto-recharged.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/register" className="button-primary">
                Launch client demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link to="/login" className="button-secondary">Open dashboard</Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: 'INR 1', value: '10 credits', icon: BadgeIndianRupee },
                { label: 'Recharge model', value: 'Razorpay + autopay', icon: CreditCard },
                { label: 'Demo engine', value: 'Live usage simulation', icon: Sparkles },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
                  <item.icon className="h-5 w-5 text-emerald-200" />
                  <div className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                  <div className="mt-2 text-xl font-semibold text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_top,_rgba(46,196,182,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(251,191,36,0.18),transparent_32%)]" />
            <div className="relative rounded-[2.4rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_40px_120px_-64px_rgba(0,0,0,0.96)]">
              <div className="flex items-center justify-between">
                <div className="text-sm uppercase tracking-[0.24em] text-slate-500">Demo command center</div>
                <StatusBadge label="Hybrid live demo" tone="amber" />
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <Wallet2 className="h-4 w-4 text-emerald-200" />
                    Current balance
                  </div>
                  <div className="mt-4 text-4xl font-semibold tracking-tight text-white">1,990</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Growth plan active, autopay protected below 100 credits.</p>
                </div>
                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-sky-200" />
                    Autopay
                  </div>
                  <div className="mt-4 text-4xl font-semibold tracking-tight text-white">ON</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Recharge Growth plan automatically if the wallet runs low.</p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white">Live burn visibility</div>
                    <div className="mt-1 text-sm text-slate-400">Every action maps to a predictable credit cost.</div>
                  </div>
                  <StatusBadge label="Transparent" tone="mint" />
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    { label: 'AI chat request', icon: MessageSquareMore, credits: 5 },
                    { label: 'Call minute', icon: PhoneCall, credits: 20 },
                    { label: 'Recording processing', icon: Sparkles, credits: 5 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-amber-200" />
                        <span className="text-sm text-slate-200">{item.label}</span>
                      </div>
                      <span className="rounded-full bg-white/8 px-3 py-1 text-sm font-semibold text-white">{item.credits} credits</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section-shell">
          <div className="section-header">
            <div className="section-kicker">Why this feels like a real SaaS product</div>
            <h2 className="section-title">Built to sell trust, not just functionality.</h2>
            <p className="section-copy">
              The frontend is structured like a product a client could actually adopt: live-looking dashboards, plan controls,
              wallet history, and predictable billing signals.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Capability</div>
                <h3 className="mt-4 text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{feature.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="billing-model" className="section-shell-tight">
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="panel">
              <div className="section-kicker">How the billing story lands</div>
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Clients should understand the model in under 60 seconds.</h2>
              <div className="mt-6 space-y-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/12 text-sm font-semibold text-emerald-100">{index + 1}</div>
                    <div className="text-sm leading-7 text-slate-300">{step}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="section-kicker">Credit burn rules</div>
                  <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">A practical model that feels commercially believable.</h2>
                </div>
                <StatusBadge label="INR 1 = 10 credits" tone="sky" />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {usageRules.map((rule) => (
                  <div key={rule.id} className="rounded-3xl border border-white/10 bg-slate-950/55 p-5">
                    <div className="text-sm font-medium text-white">{rule.label}</div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{rule.credits}</div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{rule.unit}</div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{rule.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="section-shell">
          <div className="section-header">
            <div className="section-kicker">Plans built for the demo narrative</div>
            <h2 className="section-title">Starter to Pro, with a clear recharge story.</h2>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            {pricingPlans.map((plan) => (
              <div key={plan.id} className={`rounded-[2rem] border p-6 ${plan.highlight ? 'border-amber-300/25 bg-amber-300/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}>
                {plan.highlight && <StatusBadge label={plan.highlight} tone="amber" />}
                <h3 className="mt-4 text-2xl font-semibold text-white">{plan.name}</h3>
                <div className="mt-4 text-4xl font-semibold tracking-tight text-white">{formatCurrency(plan.amount)}</div>
                <div className="mt-2 text-sm text-slate-400">{plan.credits} credits</div>
                <p className="mt-4 text-sm leading-7 text-slate-300">{plan.description}</p>
                <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-slate-300">
                  {plan.monthlyCapacity}
                </div>
                <div className="mt-4 text-sm text-slate-400">Ideal for: {plan.idealFor}</div>
                <Link to="/register" className="button-primary mt-6 w-full justify-center">Start with {plan.name}</Link>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="section-shell-tight">
          <div className="rounded-[2.3rem] border border-white/10 bg-[linear-gradient(135deg,rgba(46,196,182,0.16),rgba(14,23,32,0.9),rgba(251,191,36,0.1))] p-8 shadow-[0_40px_120px_-64px_rgba(0,0,0,0.95)] sm:p-10">
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="section-kicker">Client-ready demo experience</div>
                <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Walk the client from plan purchase to credit burn to autopay recovery.</h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-slate-200">
                  Open the dashboard, top up with Razorpay, simulate real product usage, show the wallet history,
                  and explain exactly how the platform scales operationally.
                </p>
              </div>
              <div className="flex flex-col justify-center gap-4">
                <Link to="/register" className="button-primary justify-center">
                  Enter the demo workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <a href="mailto:support@versafic.com" className="button-secondary justify-center">Book a live walkthrough</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="page-container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BrandMark compact />
          <p className="text-sm text-slate-500">Versafic demo frontend for AI-powered customer service billing, autopay, and credit visibility.</p>
        </div>
      </footer>
    </div>
  );
}
