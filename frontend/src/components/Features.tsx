import { 
  Phone, 
  MessageSquare, 
  Mic, 
  BarChart3, 
  CreditCard, 
  Globe,
  Clock,
  Users
} from 'lucide-react';

const features = [
  {
    icon: Phone,
    title: 'AI Call Assistant',
    description: 'Handle incoming customer calls automatically with natural voice AI. Book appointments, answer FAQs, and route complex queries.',
    color: 'indigo'
  },
  {
    icon: MessageSquare,
    title: 'Smart Chat Support',
    description: 'Deploy AI chatbots that understand context, handle multiple languages, and provide instant responses 24/7.',
    color: 'purple'
  },
  {
    icon: Mic,
    title: 'Voice Processing',
    description: 'Convert speech to text, analyze sentiment, and transcribe calls automatically for quality assurance.',
    color: 'pink'
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description: 'Communicate with customers in Hindi, English, and regional languages with natural pronunciation.',
    color: 'blue'
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description: 'Track call volumes, response times, customer satisfaction, and AI performance in real-time.',
    color: 'green'
  },
  {
    icon: CreditCard,
    title: 'Pay-As-You-Go',
    description: 'Simple credit-based billing. Top up your wallet and pay only for what you use. No monthly commitments.',
    color: 'amber'
  },
  {
    icon: Clock,
    title: '24/7 Availability',
    description: 'Your AI assistant never sleeps. Handle customer queries any time of day or night, including holidays.',
    color: 'cyan'
  },
  {
    icon: Users,
    title: 'Easy Onboarding',
    description: 'Set up your AI assistant in minutes. Add business details, customize responses, and go live instantly.',
    color: 'rose'
  }
];

const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/20' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
};

export default function Features() {
  return (
    <section id="features" className="section-shell">
      <div className="page-container">
        <div className="section-header">
          <div className="section-kicker">Platform capabilities</div>
          <h2 className="section-title">Purpose-built tools for modern customer support teams.</h2>
          <p className="section-copy">
            Every part of Versafic is designed to keep conversations consistent, actionable, and easy to manage as your
            business grows.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => {
            const colors = colorClasses[feature.color];
            return (
              <div
                key={feature.title}
                className="surface-card group flex h-full flex-col p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 sm:p-7"
              >
                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border ${colors.bg} ${colors.border}`}>
                  <feature.icon className={`h-6 w-6 ${colors.text}`} />
                </div>
                <h3 className="text-xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7 text-slate-300 sm:text-base">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
