import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, MessageSquare, Phone, Shield, Sparkles, Zap } from 'lucide-react';

export default function Hero() {
  const highlights = [
    'Automate voice calls and live chat from one AI workflow.',
    'Train the assistant on your business FAQs, pricing, and policies.',
    'Monitor conversations with analytics, transcripts, and smart routing rules.',
  ];

  const metrics = [
    { label: 'Response time', value: '< 3 sec' },
    { label: 'Automation coverage', value: '82%' },
    { label: 'Customer satisfaction', value: '4.9/5' },
  ];

  return (
    <section className="section-shell overflow-hidden pb-20 pt-32 sm:pt-36 lg:pb-24">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -top-20 right-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="page-container relative">
        <div className="grid min-h-[calc(100vh-7rem)] items-center gap-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-2xl">
            <div className="section-kicker">
              <Zap className="h-4 w-4" />
              AI customer support for service-led businesses
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              A polished AI support desk for calls, chat, and every customer touchpoint.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Versafic helps businesses answer faster, automate repetitive support, and give every customer a reliable
              experience without adding headcount.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="button-primary group px-7 text-base shadow-lg shadow-indigo-500/20">
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a href="#contact" className="button-secondary px-7 text-base">
                Book a Demo
              </a>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="surface-card-muted flex items-center gap-3 px-4 py-4">
                <Phone className="h-5 w-5 text-cyan-300" />
                <span className="text-sm font-medium text-slate-100">AI call handling</span>
              </div>
              <div className="surface-card-muted flex items-center gap-3 px-4 py-4">
                <MessageSquare className="h-5 w-5 text-indigo-300" />
                <span className="text-sm font-medium text-slate-100">Smart chat support</span>
              </div>
              <div className="surface-card-muted flex items-center gap-3 px-4 py-4">
                <Shield className="h-5 w-5 text-emerald-300" />
                <span className="text-sm font-medium text-slate-100">Secure automation</span>
              </div>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="stat-card">
                  <p className="text-2xl font-semibold text-white">{metric.value}</p>
                  <p className="mt-1 text-sm text-slate-400">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="surface-card relative overflow-hidden p-6 sm:p-8">
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-400">Live operations view</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">AI concierge performance</h2>
                </div>
                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Online 24/7
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="stat-card">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-indigo-500/10 p-3 text-indigo-300">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Calls resolved today</p>
                      <p className="text-2xl font-semibold text-white">148</p>
                    </div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-400">Bookings created</p>
                      <p className="text-2xl font-semibold text-white">32</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-white/5 p-3 text-cyan-300">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">AI workflow activity</p>
                      <p className="text-sm text-slate-400">Recent customer interactions</p>
                    </div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Live</div>
                </div>

                <div className="mt-5 space-y-4">
                  {highlights.map((highlight, index) => (
                    <div
                      key={highlight}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-slate-100">
                        0{index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-300">{highlight}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="text-sm text-slate-400">Multilingual coverage</p>
                  <p className="mt-1 text-xl font-semibold text-white">English, Hindi, and regional languages</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                  <p className="text-sm text-slate-400">Handover rules</p>
                  <p className="mt-1 text-xl font-semibold text-white">Escalate complex cases instantly</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
