import { useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/shared/BrandMark';
import { ThemeToggle } from '../components/shared/ThemeToggle';
import { sharedDemoCredentials } from '../config/demo';
import { useAuth } from '../hooks/useAuth';

export default function ClientDemoAccessPage() {
  const { isAuthenticated, user, login, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }

    startedRef.current = true;

    const run = async () => {
      setError('');
      setIsLoading(true);

      try {
        if (isAuthenticated && user?.email !== sharedDemoCredentials.email) {
          logout();
        }

        await login(sharedDemoCredentials.email, sharedDemoCredentials.password);
        navigate('/dashboard/calls', { replace: true });
      } catch (loginError) {
        setError(
          loginError instanceof Error
            ? loginError.message
            : 'Shared workspace login failed. Please retry in a moment.'
        );
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, [attempt, isAuthenticated, login, logout, navigate, user?.email]);

  const handleRetry = () => {
    startedRef.current = false;
    setIsLoading(true);
    setError('');
    setAttempt((current) => current + 1);
  };

  return (
    <div className="site-shell flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl rounded-[2.4rem] border border-white/10 bg-slate-950/76 p-8 shadow-[0_50px_150px_-70px_rgba(0,0,0,0.95)] sm:p-10">
        <div className="mb-6 flex justify-end">
          <ThemeToggle compact />
        </div>
        <BrandMark />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="eyebrow">Client demo access</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
            <Sparkles className="h-3.5 w-3.5 text-amber-200" />
            Shared live environment
          </span>
        </div>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Open the live workspace.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
          This page signs into the shared workspace and takes the client straight to the AI Customer Assistant dashboard.
        </p>

        <div className="mt-8 rounded-[1.8rem] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-sky-300/12 p-3 text-sky-100">
              {isLoading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-lg font-semibold text-white">
                {isLoading ? 'Signing into the shared workspace...' : error ? 'Access needs attention' : 'Redirecting to the dashboard...'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {isLoading
                  ? 'Preparing the funded workspace and opening the Twilio calls page.'
                  : error || 'You will be redirected automatically.'}
              </p>
            </div>
          </div>
        </div>

        {error && (
          <button type="button" onClick={handleRetry} className="button-primary mt-8">
            Retry login
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
