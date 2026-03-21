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
import type { Transaction, CreateOrderResponse, PricingPlan } from '../types';

// Pricing plans
const plans: PricingPlan[] = [
  { id: 'starter', name: 'Starter', amount: 99, amount_paise: 9900, credits: 990, description: '990 credits' },
  { id: 'growth', name: 'Growth', amount: 199, amount_paise: 19900, credits: 1990, description: '1990 credits' },
  { id: 'pro', name: 'Pro', amount: 499, amount_paise: 49900, credits: 4990, description: '4990 credits' },
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

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Fetch wallet data
  const fetchWallet = async () => {
    try {
      const response = await billingApi.getWallet() as any;
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
      const orderResponse = await billingApi.createOrder(planId) as any;
      const orderData = orderResponse.data as CreateOrderResponse['data'];

      // Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.name,
        description: orderData.description,
        order_id: orderData.order_id,
        handler: async (response: any) => {
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
    } catch (error: any) {
      console.error('Failed to create order:', error);
      alert(error.message || 'Failed to initiate payment. Please try again.');
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Versafic</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <span className="text-slate-400 text-sm">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center text-slate-400 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success message */}
        {purchaseSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center">
            <Check className="w-5 h-5 text-green-400 mr-3" />
            <p className="text-green-400">Credits added successfully!</p>
          </div>
        )}

        {/* Wallet Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center text-indigo-200 mb-2">
                <Wallet className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Credit Balance</span>
              </div>
              <div className="text-5xl font-bold text-white mb-1">
                {balance.toLocaleString()}
              </div>
              <p className="text-indigo-200 text-sm">credits available</p>
            </div>
            <button
              onClick={fetchWallet}
              className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Stats & Transactions */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: Phone, label: 'Calls Today', value: '0', color: 'indigo' },
                { icon: MessageSquare, label: 'Chats Today', value: '0', color: 'purple' },
                { icon: CreditCard, label: 'Credits Used', value: '0', color: 'pink' },
                { icon: BarChart3, label: 'Avg Response', value: '0s', color: 'green' },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <stat.icon className={`w-5 h-5 text-${stat.color}-400 mb-2`} />
                  <div className="text-2xl font-bold text-white">{stat.value}</div>
                  <div className="text-slate-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Recent Transactions */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions</h3>
              
              {transactions.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No transactions yet</p>
                  <p className="text-slate-500 text-sm">Purchase credits to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 10).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-4 ${
                          tx.credits > 0 
                            ? 'bg-green-500/10 text-green-400' 
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {tx.credits > 0 
                            ? <ArrowDownRight className="w-5 h-5" />
                            : <ArrowUpRight className="w-5 h-5" />
                          }
                        </div>
                        <div>
                          <div className="text-white font-medium">{tx.description}</div>
                          <div className="text-slate-500 text-sm">
                            {new Date(tx.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>
                      <div className={`font-semibold ${
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

          {/* Right column - Buy Credits */}
          <div className="space-y-6">
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Buy Credits</h3>
              
              <div className="space-y-3">
                {plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => handleBuyCredits(plan.id)}
                    disabled={isPurchasing}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      selectedPlan === plan.id
                        ? 'bg-indigo-600 border-indigo-500'
                        : 'bg-slate-900/50 border-slate-700 hover:border-indigo-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-white font-semibold">{plan.name}</div>
                        <div className="text-indigo-400 text-sm">{plan.credits.toLocaleString()} credits</div>
                      </div>
                      <div className="text-white font-bold">₹{plan.amount}</div>
                    </div>
                  </button>
                ))}
              </div>

              <p className="mt-4 text-slate-500 text-xs text-center">
                Secure payment via Razorpay. Credits never expire.
              </p>
            </div>

            {/* Help Card */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6">
              <h4 className="text-white font-semibold mb-2">Need Help?</h4>
              <p className="text-slate-400 text-sm mb-4">
                Contact our support team for any questions about billing or credits.
              </p>
              <a
                href="mailto:support@versafic.com"
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
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
