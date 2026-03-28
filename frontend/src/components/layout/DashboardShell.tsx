import {
  AudioLines,
  Bell,
  ChevronRight,
  CreditCard,
  Gauge,
  LogOut,
  MessageSquareMore,
  PhoneCall,
  RefreshCw,
  Settings2,
  Wallet,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BrandMark } from '../shared/BrandMark';
import { StatusBadge } from '../shared/StatusBadge';
import { ThemeToggle } from '../shared/ThemeToggle';
import { useAuth } from '../../hooks/useAuth';
import { useBilling } from '../../hooks/useBilling';
import { formatCredits } from '../../lib/formatters';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/dashboard/calls', label: 'Calls', icon: PhoneCall },
  { to: '/dashboard/chat', label: 'Chat', icon: MessageSquareMore },
  { to: '/dashboard/workflows', label: 'Workflows', icon: AudioLines },
  { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { to: '/dashboard/business', label: 'Business', icon: Settings2 },
];

export function DashboardShell() {
  const { logout, user } = useAuth();
  const { workspace, refresh, isRefreshing } = useBilling();
  const navigate = useNavigate();

  if (!workspace) {
    return (
      <div className="site-shell flex min-h-screen items-center justify-center">
        <div className="panel max-w-md text-center">
          <div className="text-lg font-semibold text-white">Loading your workspace...</div>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Pulling wallet, usage, and billing data.
          </p>
        </div>
      </div>
    );
  }

  const modeBadge = workspace.mode === 'live'
    ? { label: 'Live', tone: 'mint' as const }
    : workspace.mode === 'hybrid'
      ? { label: 'Hybrid', tone: 'amber' as const }
      : { label: 'Offline', tone: 'neutral' as const };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="site-shell">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[290px_minmax(0,1fr)] lg:px-6">
        <aside className="hidden flex-col rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_32px_100px_-56px_rgba(0,0,0,0.95)] backdrop-blur-xl lg:flex">
          <BrandMark />

          <div className="mt-8 rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Wallet Balance</div>
            <div className="mt-3 text-3xl font-semibold tracking-tight text-white">{formatCredits(workspace.balanceCredits)}</div>
            <p className="mt-3 text-sm leading-6 text-slate-400">{workspace.currentPlan.name} plan · {workspace.currentPlanStatus}</p>
          </div>

          <nav className="mt-8 space-y-2">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/dashboard'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </div>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-emerald-300/10 via-transparent to-sky-400/10 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-white">Autopay</div>
              <StatusBadge label={workspace.autopay.enabled ? 'Protected' : 'Off'} tone={workspace.autopay.enabled ? 'mint' : 'neutral'} />
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {workspace.autopay.enabled
                ? `Recharge is prepared when balance drops below ${workspace.autopay.thresholdCredits} credits.`
                : 'Manual top-up mode is active for this account.'}
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="sticky top-0 z-20 rounded-[2rem] border border-white/10 bg-slate-950/78 p-4 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.95)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <BrandMark compact />
                  <StatusBadge label={modeBadge.label} tone={modeBadge.tone} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    {formatCredits(workspace.balanceCredits)}
                  </span>
                  <span>Current plan: {workspace.currentPlan.name}</span>
                  <span>Autopay: {workspace.autopay.enabled ? 'On' : 'Off'}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle compact />
                <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
                  <Bell className="h-4 w-4 text-amber-200" />
                  <span>{user?.email}</span>
                </div>
                <button onClick={() => void refresh()} className="button-secondary" disabled={isRefreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button onClick={handleLogout} className="button-secondary">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {navigation.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/dashboard'}
                  className={({ isActive }) => `nav-chip ${isActive ? 'nav-chip-active' : ''}`}
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </header>

          <div className="space-y-4 py-6">
            {workspace.alerts.map((alert) => (
              <div
                key={`${alert.severity}-${alert.title}`}
                className={`rounded-[1.6rem] border px-5 py-4 ${
                  alert.severity === 'danger'
                    ? 'border-rose-300/20 bg-rose-400/10'
                    : alert.severity === 'warning'
                      ? 'border-amber-300/20 bg-amber-400/10'
                      : 'border-sky-300/20 bg-sky-400/10'
                }`}
              >
                <div className="text-sm font-semibold text-white">{alert.title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-200">{alert.body}</div>
              </div>
            ))}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
