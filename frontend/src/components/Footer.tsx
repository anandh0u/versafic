import { Link } from 'react-router-dom';
import { Zap, Twitter, Linkedin, Github, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/80">
      <div className="page-container py-16">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="max-w-md">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <span className="block text-2xl font-semibold tracking-tight text-white">Versafic</span>
                <span className="text-sm text-slate-400">AI customer service assistant</span>
              </div>
            </Link>
            <p className="mt-6 text-base leading-7 text-slate-300">
              Deployment-ready AI support for businesses that need a cleaner customer experience without adding more
              operational overhead.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white">
                <Github className="h-5 w-5" />
              </a>
              <a href="mailto:hello@versafic.com" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition hover:border-white/20 hover:text-white">
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Product</h4>
            <ul className="mt-5 space-y-4">
              <li>
                <a href="/#features" className="text-slate-300 transition hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-slate-300 transition hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="text-slate-300 transition hover:text-white">
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-300 transition hover:text-white">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Company</h4>
            <ul className="mt-5 space-y-4">
              <li>
                <a href="#" className="text-slate-300 transition hover:text-white">
                  About Us
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-slate-300 transition hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-300 transition hover:text-white">
                  Careers
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Legal</h4>
            <ul className="mt-5 space-y-4">
              <li>
                <a href="#" className="text-slate-300 transition hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-300 transition hover:text-white">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-300 transition hover:text-white">
                  Refund Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
          <p>
              © {new Date().getFullYear()} Versafic. All rights reserved.
          </p>
          <p>Built for modern businesses that want premium customer support automation.</p>
        </div>
      </div>
    </footer>
  );
}
