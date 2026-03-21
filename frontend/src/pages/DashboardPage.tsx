import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Zap, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Clock,
  Phone,
  MessageSquare,
  BarChart3,
  LogOut,
  RefreshCw,
  Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { billingApi } from '../services/api';
import type { PricingPlan, RazorpayResponse, Transaction } from '../types';

// Pricing plans
const plans: PricingPlan[] = [
  { id: 'starter', name: 'Starter', amount: 99, amount_paise: 9900, credits: 990, description: '990 credits' },
  { id: 'growth', name: 'Growth', amount: 199, amount_paise: 19900, credits: 1990, description: '1990 credits' },
  { id: 'pro', name: 'Pro', amount: 499, amount_paise: 49900, credits: 4990, description: '4990 credits' },
];

const statStyles = [
  {
    label: 'Calls Today',
    value: '0',
    icon: Phone,
    iconWrap: 'bg-indigo-500/10 text-indigo-300',
  },
  {
    label: 'Chats Today',
    value: '0',
    icon: MessageSquare,
    iconWrap: 'bg-cyan-500/10 text-cyan-300',
  },
  {
    label: 'Credits Used',
    value: '0',
    icon: CreditCard,
    iconWrap: 'bg-amber-500/10 text-amber-300',
  },
  {
    label: 'Avg Response',
    value: '0s',
    icon: BarChart3,
    iconWrap: 'bg-emerald-500/10 text-emerald-300',
  },
];

export default function DashboardPage() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const getErrorMessage = (error: unknown, fallback: string) => {
    return error instanceof Error ? error.message : fallback;
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch wallet data
  const fetchWallet = async () => {
    try {
      const response = await billingApi.getWallet();
      setBalance(response.data.balance_credits);
      setTransactions(response.data.transactions || []);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchWallet();
    }
  }, [isAuthenticated]);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Handle plan purchase
  const handleBuyCredits = async (planId: string) => {
    setSelectedPlan(planId);
    setIsPurchasing(true);
    setPurchaseSuccess(false);

    try {
      // Create order
      const orderResponse = await billingApi.createOrder(planId);
      const orderData = orderResponse.data;

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.name,
        description: orderData.description,
        order_id: orderData.order_id,
        handler: async (response: RazorpayResponse) => {
          try {
            // Verify payment
            await billingApi.verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
            
            setPurchaseSuccess(true);
            await fetchWallet();
            
            setTimeout(() => {
              setPurchaseSuccess(false);
            }, 3000);
          } catch (error) {
            console.error('Payment verification failed:', error);
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#6366f1',
        },
        modal: {
          ondismiss: () => {
            setIsPurchasing(false);
            setSelectedPlan(null);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (error) {
      console.error('Failed to create order:', error);
      alert(getErrorMessage(error, 'Failed to initiate payment. Please try again.'));
    } finally {
      setIsPurchasing(false);
      setSelectedPlan(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="site-shell flex min-h-screen items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="site-shell">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="page-container">
          <div className="flex min-h-20 flex-col justify-center gap-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-0">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/20">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="block text-xl font-semibold tracking-tight text-white">Versafic</span>
                <span className="text-xs text-slate-400">Billing and operations dashboard</span>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                {user?.email}
              </div>
              <button onClick={handleLogout} className="button-secondary">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="page-container section-shell-tight">
        {purchaseSuccess && (
          <div className="mb-6 flex items-center rounded-2xl border border-green-500/20 bg-green-500/10 p-4">
            <Check className="mr-3 h-5 w-5 text-green-400" />
            <p className="text-green-400">Credits added successfully!</p>
          </div>
        )}

        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 p-6 shadow-[0_30px_90px_-45px_rgba(14,165,233,0.8)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center text-indigo-100">
                <Wallet className="mr-2 h-5 w-5" />
                <span className="text-sm font-medium">Credit Balance</span>
              </div>
              <div className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{balance.toLocaleString()}</div>
              <p className="mt-2 text-sm text-indigo-100/90">credits available for calls, chat, and automated workflows</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={fetchWallet} className="button-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {statStyles.map((stat) => (
                <div key={stat.label} className="surface-card p-5">
                  <div className={`inline-flex rounded-2xl p-3 ${stat.iconWrap}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-4 text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="surface-card p-6 sm:p-8">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">Recent Transactions</h3>
                  <p className="mt-1 text-sm text-slate-400">Track top-ups and credit usage from a single timeline.</p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock className="mx-auto mb-3 h-12 w-12 text-slate-600" />
                  <p className="text-slate-400">No transactions yet</p>
                  <p className="mt-1 text-sm text-slate-500">Purchase credits to get started</p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {transactions.slice(0, 10).map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${
                          tx.credits > 0 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {tx.credits > 0 
                            ? <ArrowDownRight className="h-5 w-5" />
                            : <ArrowUpRight className="h-5 w-5" />
                          }
                        </div>
                        <div>
                          <div className="text-white font-medium">{tx.description}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {new Date(tx.created_at).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className={`text-lg font-semibold ${
                        tx.credits > 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.credits > 0 ? '+' : ''}{tx.credits}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-6 sm:p-8">
              <div className="border-b border-white/10 pb-5">
                <h3 className="text-xl font-semibold text-white">Buy Credits</h3>
                <p className="mt-1 text-sm text-slate-400">Scale usage when you need more calls, chats, or automation capacity.</p>
              </div>

              <div className="mt-6 space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleBuyCredits(plan.id)}
                    disabled={isPurchasing}
                    className={`w-full rounded-2xl border p-4 text-left transition duration-200 ${
                      selectedPlan === plan.id
                        ? 'border-indigo-400 bg-indigo-500/15'
                        : 'border-white/10 bg-slate-950/60 hover:border-indigo-400/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-white font-semibold">{plan.name}</div>
                        <div className="mt-1 text-sm text-slate-400">{plan.credits.toLocaleString()} credits</div>
                      </div>
                      <div className="text-lg font-semibold text-white">₹{plan.amount}</div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-4 text-center text-xs text-slate-500">
                Secure payment via Razorpay. Credits never expire.
              </p>
            </div>

            <div className="surface-card p-6">
              <h4 className="text-lg font-semibold text-white">Need Help?</h4>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Contact our support team for any questions about billing or credits.
              </p>
              <a
                href="mailto:support@versafic.com"
                className="mt-4 inline-flex text-sm font-medium text-indigo-300 transition hover:text-indigo-200"
              >
                support@versafic.com →
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
