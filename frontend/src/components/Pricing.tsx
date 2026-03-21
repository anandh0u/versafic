import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    credits: 990,
    description: 'Perfect for small businesses just getting started',
    features: [
      '990 AI credits',
      'Up to 100 AI calls/month',
      'Basic chat support',
      'Email support',
      'Analytics dashboard'
    ],
    popular: false
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 199,
    credits: 1990,
    description: 'For growing businesses with more customer volume',
    features: [
      '1,990 AI credits',
      'Up to 250 AI calls/month',
      'Advanced chat with context',
      'Priority support',
      'Advanced analytics',
      'Multi-language support'
    ],
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 499,
    credits: 4990,
    description: 'For enterprises with high-volume needs',
    features: [
      '4,990 AI credits',
      'Unlimited AI calls',
      'Custom AI training',
      'Dedicated support',
      'Custom integrations',
      'White-label options',
      'SLA guarantee'
    ],
    popular: false
  }
];

export default function Pricing() {
  return (
    <section id="pricing" className="section-shell">
      <div className="page-container">
        <div className="section-header">
          <div className="section-kicker">Pricing and credits</div>
          <h2 className="section-title">Straightforward plans that stay easy to explain to clients.</h2>
          <p className="section-copy">
            Pick the credit pack that fits your current volume. Every plan includes the core platform, with no messy
            setup fees or hidden add-ons.
          </p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex h-full flex-col rounded-3xl border p-6 transition duration-300 sm:p-8 ${
                plan.popular
                  ? 'border-indigo-400/40 bg-gradient-to-b from-indigo-500/14 via-slate-900/90 to-slate-900/85 shadow-[0_30px_90px_-45px_rgba(79,70,229,0.8)]'
                  : 'surface-card hover:border-white/20'
              }`}
            >
              {plan.popular && (
                <div className="absolute left-6 top-6">
                  <span className="rounded-full bg-indigo-500 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`${plan.popular ? 'pt-12' : ''}`}>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">{plan.name}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-2xl font-semibold text-slate-400">₹</span>
                  <span className="text-5xl font-semibold tracking-tight text-white">{plan.price}</span>
                </div>
                <p className="mt-3 text-base text-slate-300">{plan.description}</p>
                <p className="mt-5 inline-flex rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-sm font-medium text-indigo-200">
                  {plan.credits.toLocaleString()} credits
                </p>
              </div>

              <ul className="mt-8 flex-1 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-emerald-400/10 p-1 text-emerald-300">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-sm leading-6 text-slate-300 sm:text-base">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                to="/register"
                className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold transition duration-200 ${
                  plan.popular
                    ? 'bg-indigo-500 text-white hover:bg-indigo-400'
                    : 'border border-white/10 bg-white/5 text-white hover:border-white/20 hover:bg-white/10'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center text-sm text-slate-400">
          All plans include the core platform, onboarding help, and credits that never expire.
        </div>
      </div>
    </section>
  );
}
