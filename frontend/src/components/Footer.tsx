import { Link } from 'react-router-dom';
import { Zap, Twitter, Linkedin, Github, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Versafic</span>
            </Link>
            <p className="text-slate-400 text-sm mb-4">
              AI-powered customer service automation for modern businesses.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="mailto:hello@versafic.com" className="text-slate-500 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <a href="/#features" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="/#pricing" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <a href="/#how-it-works" className="text-slate-400 hover:text-white text-sm transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <Link to="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="/#contact" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Contact
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Blog
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Refund Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Versafic. All rights reserved.
            </p>
            <p className="text-slate-500 text-sm mt-2 md:mt-0">
              Made with ❤️ in India
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
