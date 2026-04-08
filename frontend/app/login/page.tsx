'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

const LOGIN_STYLES = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    background: #0a0a0a;
    color: #ededed;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .login-container {
    width: 100%;
    max-width: 420px;
    padding: 40px;
    background: #111111;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }

  .login-header {
    margin-bottom: 32px;
    text-align: center;
  }

  .login-logo {
    font-size: 1.5rem;
    font-weight: 800;
    background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 12px;
  }

  .login-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #ededed;
    margin-bottom: 8px;
  }

  .login-desc {
    font-size: 0.9rem;
    color: #888;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-label {
    display: block;
    font-size: 0.85rem;
    font-weight: 500;
    color: #888;
    margin-bottom: 8px;
  }

  .form-input {
    width: 100%;
    padding: 12px 14px;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #ededed;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s;
  }

  .form-input:focus {
    border-color: #7c3aed;
    background: #1f1f1f;
  }

  .error-message {
    color: #ef4444;
    font-size: 0.85rem;
    margin-top: 6px;
  }

  .btn-login {
    width: 100%;
    padding: 12px;
    background: #fff;
    color: #0a0a0a;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 12px;
  }

  .btn-login:hover {
    background: #e5e5e5;
    transform: translateY(-1px);
  }

  .btn-login:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
  }

  .divider-text {
    font-size: 0.85rem;
    color: #888;
  }

  .btn-oauth {
    width: 100%;
    padding: 12px;
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: #ededed;
    font-weight: 500;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-oauth:hover {
    background: #222;
    border-color: rgba(255, 255, 255, 0.16);
  }

  .footer-link {
    text-align: center;
    margin-top: 20px;
    font-size: 0.9rem;
    color: #888;
  }

  .footer-link a {
    color: #a78bfa;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .footer-link a:hover {
    color: #c4b5fd;
  }

  .loading {
    opacity: 0.6;
    pointer-events: none;
  }
`;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('accessToken');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.login(email, password);
      if (response.accessToken) {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to Google OAuth start endpoint
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    window.location.href = `${apiUrl}/auth/google/start`;
  };

  return (
    <>
      <style>{LOGIN_STYLES}</style>
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">Versafic</div>
          <h1 className="login-title">Sign In</h1>
          <p className="login-desc">Welcome back to your AI call automation platform</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className={`btn-login ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="divider">
          <div className="divider-line"></div>
          <span className="divider-text">OR</span>
          <div className="divider-line"></div>
        </div>

        <button className="btn-oauth" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.745 12.27c0-.79-.12-1.55-.32-2.3H12v4.35h6.88c-.3 1.53-.96 2.82-2.04 3.68v2.57h3.3c1.93-1.77 3.04-4.38 3.04-7.45z" fill="#4285F4"/>
            <path d="M12 24c2.7 0 4.96-.88 6.61-2.4l-3.3-2.56c-.88.59-2 .93-3.31.93-2.54 0-4.7-1.7-5.48-4H3.18v2.64C4.82 21.49 8.13 24 12 24z" fill="#34A853"/>
            <path d="M6.52 14.97c-.38-1.25-.6-2.57-.6-3.97 0-1.4.22-2.72.6-3.97V3.39H3.18C1.6 5.96 1 9.11 1 12c0 2.88.59 6.03 2.18 8.61l3.34-2.64z" fill="#FBBC04"/>
            <path d="M12 4.75c1.41 0 2.67.48 3.66 1.41l2.75-2.75C17 1.81 14.7 1 12 1 8.13 1 4.82 3.51 3.18 7.39l3.34 2.64c.78-2.3 2.94-4.28 5.48-4.28z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="footer-link">
          Don't have an account? <a href="/onboarding">Sign up</a>
        </div>
      </div>
    </>
  );
}
