import { Link } from 'react-router-dom';
import { Zap, Twitter, Linkedin, Github, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-5xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-white">Versafic</span>
            </Link>
            <p className="text-slate-400 mb-6 leading-relaxed">
              AI-powered customer service automation for modern businesses.
            </p>
            <div className="flex space-x-5">
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Twitter className="w-6 h-6" />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Linkedin className="w-6 h-6" />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Github className="w-6 h-6" />
              </a>
              <a href="mailto:hello@versafic.com" className="text-slate-500 hover:text-white transition-colors">
                <Mail className="w-6 h-6" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Product</h4>
            <ul className="space-y-4">
              <li>
                <a href="/#features" className="text-slate-400 hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-slate-400 hover:text-white transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="text-slate-400 hover:text-white transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Company</h4>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-slate-400 hover:text-white transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  Careers
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold text-lg mb-5">Legal</h4>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white transition-colors">
                  Refund Policy
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500">
              © {new Date().getFullYear()} Versafic. All rights reserved.
            </p>
            <p className="text-slate-500 mt-3 md:mt-0">
              Made with ❤️ in India
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
