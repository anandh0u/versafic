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
    <section id="pricing" className="py-32 bg-slate-900">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Simple Pricing
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            Pay only for what you use. No monthly fees. Top up anytime.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-10 rounded-2xl border transition-all duration-300 ${
                plan.popular
                  ? 'bg-gradient-to-b from-indigo-900/50 to-slate-800 border-indigo-500 shadow-xl shadow-indigo-500/10 scale-105'
                  : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="px-5 py-1.5 bg-indigo-600 text-white font-medium rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-10">
                <h3 className="text-2xl font-bold text-white mb-3">{plan.name}</h3>
                <p className="text-slate-400 mb-6">{plan.description}</p>
                <div className="flex items-baseline justify-center">
                  <span className="text-slate-400 text-xl">₹</span>
                  <span className="text-5xl font-bold text-white mx-1">{plan.price}</span>
                </div>
                <p className="text-indigo-400 mt-3">{plan.credits.toLocaleString()} credits</p>
              </div>

              {/* Features */}
              <ul className="space-y-4 mb-10">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <Check className="w-5 h-5 text-green-400 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <Link
                to="/register"
                className={`block w-full py-4 rounded-xl font-semibold text-center text-lg transition-all duration-200 ${
                  plan.popular
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        {/* Additional info */}
        <div className="mt-16 text-center">
          <p className="text-slate-500">
            All plans include core features. Credits never expire.
          </p>
        </div>
      </div>
    </section>
  );
}
