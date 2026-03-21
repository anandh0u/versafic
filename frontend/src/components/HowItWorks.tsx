import { UserPlus, Building2, CreditCard, Settings, Sparkles } from 'lucide-react';

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
    <section id="how-it-works" className="py-32 bg-slate-800">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Get Started in 5 Steps
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto text-lg">
            From sign up to live AI support in under 10 minutes.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line (desktop only) */}
          <div className="hidden lg:block absolute top-28 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
            {steps.map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center">
                {/* Step number badge */}
                <div className="relative z-10 w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/25">
                  <item.icon className="w-10 h-10 text-white" />
                </div>
                
                {/* Step indicator */}
                <div className="text-indigo-400 font-bold mb-3">STEP {item.step}</div>
                
                {/* Title */}
                <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                
                {/* Description */}
                <p className="text-slate-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-20 text-center">
          <a
            href="/register"
            className="inline-flex items-center px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg shadow-indigo-500/25"
          >
            Start Your Free Trial
          </a>
          <p className="mt-5 text-slate-500">No credit card required • 100 free credits</p>
        </div>
      </div>
    </section>
  );
}
