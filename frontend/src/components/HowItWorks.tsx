import { UserPlus, Building2, CreditCard, Settings, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const steps = [
  {
    icon: UserPlus,
    step: '01',
    title: 'Sign Up',
    description: 'Create your account in seconds with email or Google sign-in. No credit card required to start.'
  },
  {
    icon: Building2,
    step: '02',
    title: 'Add Business Details',
    description: 'Tell us about your business - type, services, FAQs, and how you want the AI to respond.'
  },
  {
    icon: CreditCard,
    step: '03',
    title: 'Top Up Credits',
    description: 'Purchase credits based on your needs. Start with our Starter pack or choose a plan that fits.'
  },
  {
    icon: Settings,
    step: '04',
    title: 'Configure Workflow',
    description: 'Connect your phone number, set up chat widget, and customize AI responses and behaviors.'
  },
  {
    icon: Sparkles,
    step: '05',
    title: 'AI Handles Queries',
    description: 'Your AI assistant is live! It handles calls, chats, and queries while you focus on your business.'
  }
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section-shell bg-white/[0.02]">
      <div className="page-container">
        <div className="section-header">
          <div className="section-kicker">How it works</div>
          <h2 className="section-title">From signup to live support in one streamlined setup.</h2>
          <p className="section-copy">
            Build your AI assistant in a few guided steps, then keep refining it as customer volume and workflows
            evolve.
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute left-[8%] right-[8%] top-14 hidden h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent xl:block" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
            {steps.map((item) => (
              <div key={item.step} className="surface-card relative flex h-full flex-col items-center p-6 text-center sm:p-7">
                <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
                  <item.icon className="h-7 w-7 text-white" />
                </div>

                <div className="mt-6 inline-flex rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                  Step {item.step}
                </div>

                <h3 className="mt-4 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300 sm:text-base">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 text-center">
          <Link to="/register" className="button-primary px-8 text-base shadow-lg shadow-indigo-500/20">
            Start Your Free Trial
          </Link>
          <p className="mt-4 text-sm text-slate-400">No credit card required. Start with 100 free credits.</p>
        </div>
      </div>
    </section>
  );
}
