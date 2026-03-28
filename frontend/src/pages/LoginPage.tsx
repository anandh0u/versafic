import { useState } from 'react';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/dashboard';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="site-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950/72 shadow-[0_50px_150px_-70px_rgba(0,0,0,0.95)]">
        <div className="absolute right-6 top-6 z-10">
          <ThemeToggle compact />
        </div>
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <div className="hidden border-r border-white/10 bg-[radial-gradient(circle_at_top,_rgba(46,196,182,0.18),transparent_35%),linear-gradient(180deg,#071117_0%,#0d1820_100%)] p-10 lg:block">
            <BrandMark />
            <h1 className="mt-10 text-4xl font-semibold tracking-tight text-white">
              Return to your workspace.
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-300">
              Open calls, chat, billing, and business settings from one clean dashboard.
            </p>
            <div className="mt-10 space-y-4">
              {[
                'Plan purchases with Razorpay',
                'Wallet history with timestamps and references',
                'Autopay threshold and low-balance protection',
              ].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="p-8 sm:p-10 lg:p-12">
            <div className="lg:hidden">
              <BrandMark />
            </div>

            <div className="mt-8 lg:mt-2">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Sign in</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Access your dashboard, wallet, and customer support tools.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="form-label">Email address</label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="input-field pl-12"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Password</label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="input-field pl-12"
                    placeholder="Enter your password"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="button-primary w-full justify-center">
                {isLoading ? 'Signing in...' : (
                  <>
                    Open dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-400">
              Need an account? <Link to="/register" className="font-medium text-emerald-200">Create one</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
