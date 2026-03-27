import { useState } from 'react';
import { ArrowRight, Lock, Mail, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { useAuth } from '../hooks/useAuth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await register(email, password, name);
      navigate('/dashboard');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="site-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-5xl overflow-hidden rounded-[2.4rem] border border-white/10 bg-slate-950/72 shadow-[0_50px_150px_-70px_rgba(0,0,0,0.95)]">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-10 lg:p-12">
            <BrandMark />

            <div className="mt-8">
              <h2 className="text-3xl font-semibold tracking-tight text-white">Create a demo workspace</h2>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Start with seeded demo credits, then top up, simulate usage, and explain the full SaaS billing story.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="form-label">Full name</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="input-field pl-12"
                    placeholder="Your name"
                  />
                </div>
              </div>

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
                    placeholder="Create a password"
                  />
                </div>
              </div>

              <button type="submit" disabled={isLoading} className="button-primary w-full justify-center">
                {isLoading ? 'Creating workspace...' : (
                  <>
                    Enter dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-400">
              Already have access? <Link to="/login" className="font-medium text-emerald-200">Sign in</Link>
            </div>
          </div>

          <div className="hidden border-l border-white/10 bg-[radial-gradient(circle_at_bottom,_rgba(251,191,36,0.18),transparent_34%),linear-gradient(180deg,#0d1820_0%,#071117_100%)] p-10 lg:block">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Demo setup</div>
              <h3 className="mt-4 text-2xl font-semibold text-white">What the client will see immediately</h3>
              <div className="mt-6 space-y-4">
                {[
                  'Active plan, credit balance, and wallet health',
                  'Usage history with timestamps and feature sources',
                  'Autopay threshold configuration and renewal logic',
                  'Simulation controls for chat, calls, STT, recordings, and onboarding setup',
                ].map((item) => (
                  <div key={item} className="rounded-3xl border border-white/10 bg-slate-950/55 px-5 py-4 text-sm leading-6 text-slate-200">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
