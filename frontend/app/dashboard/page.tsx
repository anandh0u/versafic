'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { User, BusinessProfile, Wallet } from '@/types/index';

const DASHBOARD_STYLES = `
  :root {
    --grad-primary: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    --indigo: #6366f1;
    --blue: #3b82f6;
    --green: #10b981;
    --red: #ef4444;
    --amber: #f59e0b;
    --text-muted: #6b7280;
    --text-primary: #111827;
    --border: #e5e7eb;
    --card-bg: #ffffff;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background: #f8fafc;
    color: var(--text-primary);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .app-layout {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    width: 260px;
    background: linear-gradient(180deg, #0f1629 0%, #0c1220 100%);
    border-right: 1px solid rgba(99, 102, 241, 0.15);
    display: flex;
    flex-direction: column;
    color: #fff;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .sidebar-header {
    padding: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .logo {
    font-size: 1.5rem;
    font-weight: 900;
    background: var(--grad-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .sidebar-nav {
    flex: 1;
    padding: 20px 12px;
  }

  .nav-item a {
    display: flex;
    align-items: center;
    padding: 13px 16px;
    color: rgba(255, 255, 255, 0.5);
    text-decoration: none;
    border-radius: 10px;
    font-size: 0.88rem;
    font-weight: 500;
    margin-bottom: 4px;
    transition: all 0.25s;
  }

  .nav-item.active a {
    background: rgba(99, 102, 241, 0.18);
    color: #c7d2fe;
  }

  .nav-item a:hover {
    background: rgba(99, 102, 241, 0.12);
    color: #a5b4fc;
  }

  .badge {
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    margin-left: auto;
  }

  .badge-green {
    background: rgba(16, 185, 129, 0.12);
    color: var(--green);
  }

  .badge-blue {
    background: rgba(59, 130, 246, 0.12);
    color: var(--blue);
  }

  .main-content {
    flex: 1;
    padding: 40px;
    overflow-y: auto;
    background: #f8fafc;
  }

  @media (max-width: 768px) {
    .sidebar {
      width: 200px;
      padding: 16px;
    }
    .main-content {
      padding: 20px;
    }
  }

  .header-section {
    margin-bottom: 32px;
  }

  .header-section h1 {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .header-section p {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .stat-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .stat-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 24px;
    transition: all 0.3s ease;
  }

  .stat-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  }

  .stat-icon {
    width: 42px;
    height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.06);
    font-size: 1.4rem;
    margin-bottom: 12px;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 6px;
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .card-section {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 26px;
    margin-bottom: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .btn {
    padding: 10px 18px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--grad-primary);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3);
  }

  .btn-ghost {
    background: rgba(99, 102, 241, 0.06);
    color: var(--indigo);
    border: 1px solid rgba(99, 102, 241, 0.1);
  }

  .loading-state {
    text-align: center;
    padding: 40px 20px;
  }

  .loading-spinner {
    display: inline-block;
    width: 30px;
    height: 30px;
    border: 4px solid rgba(99, 102, 241, 0.2);
    border-top-color: var(--indigo);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .logout-btn {
    margin-top: auto;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    color: var(--red);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .logout-btn:hover {
    background: rgba(239, 68, 68, 0.2);
  }
`;

export default function DashboardPage() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState('overview');
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [userData, walletData] = await Promise.all([
        apiClient.getCurrentUser(),
        apiClient.getWallet(),
      ]);
      setUser(userData);
      setWallet(walletData);
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
      // If unauthorized, redirect to login
      if (err instanceof Error && err.message.includes('401')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiClient.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <>
      <style>{DASHBOARD_STYLES}</style>
      <div className="app-layout">
        {/* Sidebar */}
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="logo">Versafic</div>
          </div>

          <div className="sidebar-nav">
            <ul style={{ listStyle: 'none' }}>
              <li className={`nav-item ${currentPage === 'overview' ? 'active' : ''}`}>
                <a href="#" onClick={() => setCurrentPage('overview')}>
                  📊 Overview
                </a>
              </li>
              <li className={`nav-item ${currentPage === 'calls' ? 'active' : ''}`}>
                <a href="#" onClick={() => setCurrentPage('calls')}>
                  ☎️ Calls
                  {/* <span className="badge badge-blue">12</span> */}
                </a>
              </li>
              <li className={`nav-item ${currentPage === 'chats' ? 'active' : ''}`}>
                <a href="#" onClick={() => setCurrentPage('chats')}>
                  💬 Chats
                </a>
              </li>
              <li className={`nav-item ${currentPage === 'billing' ? 'active' : ''}`}>
                <a href="#" onClick={() => setCurrentPage('billing')}>
                  💳 Billing
                </a>
              </li>
              <li className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}>
                <a href="#" onClick={() => setCurrentPage('settings')}>
                  ⚙️ Settings
                </a>
              </li>
            </ul>
          </div>

          <button className="logout-btn" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {error && (
            <div style={{ background: '#fee2e2', color: '#dc2626', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              {error}
            </div>
          )}

          {/* Overview Page */}
          {currentPage === 'overview' && (
            <div>
              <div className="header-section">
                <h1>Welcome back, {user?.name || user?.email}</h1>
                <p>Here's an overview of your account</p>
              </div>

              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-value">₹{wallet?.balance || 0}</div>
                  <div className="stat-label">Credits Balance</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">☎️</div>
                  <div className="stat-value">0</div>
                  <div className="stat-label">Total Calls</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">💬</div>
                  <div className="stat-value">0</div>
                  <div className="stat-label">Total Messages</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📈</div>
                  <div className="stat-value">0%</div>
                  <div className="stat-label">Success Rate</div>
                </div>
              </div>

              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Quick Actions</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" onClick={() => setCurrentPage('billing')}>
                    🛒 Buy Credits
                  </button>
                  <button className="btn btn-ghost" onClick={() => setCurrentPage('calls')}>
                    ☎️ View Calls
                  </button>
                  <button className="btn btn-ghost" onClick={() => setCurrentPage('settings')}>
                    ⚙️ Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Calls Page */}
          {currentPage === 'calls' && (
            <div>
              <div className="header-section">
                <h1>Call Management</h1>
                <p>Monitor and manage your AI calls</p>
              </div>
              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Recent Calls</h2>
                </div>
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  📞 No calls yet. Start making AI calls to see them here.
                </div>
              </div>
            </div>
          )}

          {/* Chats Page */}
          {currentPage === 'chats' && (
            <div>
              <div className="header-section">
                <h1>Chat Management</h1>
                <p>Monitor and manage your AI chats</p>
              </div>
              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Recent Chats</h2>
                </div>
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  💬 No chats yet. Start chatting with your AI to see them here.
                </div>
              </div>
            </div>
          )}

          {/* Billing Page */}
          {currentPage === 'billing' && (
            <div>
              <div className="header-section">
                <h1>Billing & Credits</h1>
                <p>Manage your credits and billing</p>
              </div>

              <div className="stat-cards">
                <div className="stat-card">
                  <div className="stat-icon">💰</div>
                  <div className="stat-value">₹{wallet?.balance || 0}</div>
                  <div className="stat-label">Current Balance</div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon">📊</div>
                  <div className="stat-value">{wallet?.credits || 0}</div>
                  <div className="stat-label">Total Credits</div>
                </div>
              </div>

              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Buy Credits</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                  {[
                    { amount: 100, price: '₹100' },
                    { amount: 500, price: '₹450' },
                    { amount: 1000, price: '₹800' },
                    { amount: 5000, price: '₹3500' },
                  ].map((plan) => (
                    <button
                      key={plan.amount}
                      className="btn btn-primary"
                      style={{ justifyContent: 'center', flexDirection: 'column', height: '80px' }}
                      onClick={() => alert(`Purchase ${plan.amount} credits for ${plan.price}`)}
                    >
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{plan.amount}</div>
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{plan.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Page */}
          {currentPage === 'settings' && (
            <div>
              <div className="header-section">
                <h1>Settings</h1>
                <p>Manage your account and preferences</p>
              </div>

              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Account Information</h2>
                </div>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Email
                    </label>
                    <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                      {user?.email}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Name
                    </label>
                    <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '8px' }}>
                      {user?.name || 'Not set'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-section">
                <div className="card-header">
                  <h2 className="card-title">Danger Zone</h2>
                </div>
                <button
                  className="btn"
                  style={{ background: '#fee2e2', color: '#dc2626', fontWeight: '600' }}
                  onClick={() => {
                    if (confirm('Are you sure you want to log out?')) {
                      handleLogout();
                    }
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
