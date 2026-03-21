import { Link } from 'react-router-dom';
import { ArrowRight, Phone, MessageSquare, Zap, Shield } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
        <div className="text-center">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-8">
            <Zap className="w-4 h-4 text-indigo-400 mr-2" />
            <span className="text-indigo-300 text-sm font-medium">AI-Powered Customer Service</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            AI Customer Support
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              That Never Sleeps
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-slate-400 max-w-3xl mx-auto mb-10 leading-relaxed">
            Automate customer calls, voice support, and chat responses with AI. 
            Perfect for restaurants, hotels, clinics, and service businesses. 
            Available 24/7, in multiple languages.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register"
              className="group flex items-center px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#contact"
              className="flex items-center px-8 py-4 border-2 border-slate-600 hover:border-slate-500 text-white rounded-xl font-semibold transition-all duration-200"
            >
              Book a Demo
            </a>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-center p-4 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
              <Phone className="w-5 h-5 text-indigo-400 mr-3" />
              <span className="text-slate-300 text-sm font-medium">AI Call Handling</span>
            </div>
            <div className="flex items-center justify-center p-4 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
              <MessageSquare className="w-5 h-5 text-purple-400 mr-3" />
              <span className="text-slate-300 text-sm font-medium">Smart Chat Responses</span>
            </div>
            <div className="flex items-center justify-center p-4 bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
              <Shield className="w-5 h-5 text-green-400 mr-3" />
              <span className="text-slate-300 text-sm font-medium">Enterprise Security</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-4xl mx-auto">
          {[
            { value: '99.9%', label: 'Uptime' },
            { value: '500+', label: 'Businesses' },
            { value: '1M+', label: 'Calls Handled' },
            { value: '24/7', label: 'Availability' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
