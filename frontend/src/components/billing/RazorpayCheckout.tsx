import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';
import type { PendingCheckout } from '../../types';
import { billingApi } from '../../services/api';
import { ensureRazorpayLoaded } from '../../services/billing-experience';
import { formatCurrency, formatCredits } from '../../lib/formatters';

export function RazorpayCheckout({
  checkout,
  prefill,
  onSuccess,
  onError,
  onCancel,
}: {
  checkout: PendingCheckout | null;
  prefill?: {
    email?: string;
    name?: string;
    contact?: string;
  };
  onSuccess: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onError: (error: string) => void;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState<boolean>(typeof window !== 'undefined' && Boolean(window.Razorpay));
  const [status, setStatus] = useState<'ready' | 'processing' | 'success' | 'error'>('ready');

  useEffect(() => {
    let cancelled = false;

    void ensureRazorpayLoaded()
      .then(() => {
        if (!cancelled) {
          setIsReady(true);
        }
      })
      .catch((loadError) => {
        const message = loadError instanceof Error ? loadError.message : 'Failed to load Razorpay script';
        if (!cancelled) {
          setError('Failed to load Razorpay. Please refresh and try again.');
          setStatus('error');
          onError(message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onError]);

  useEffect(() => {
    if (checkout) {
      setError(null);
      setStatus('ready');
      setIsLoading(false);
      if (typeof window !== 'undefined' && window.Razorpay) {
        setIsReady(true);
      }
    }
  }, [checkout]);

  const handleRazorpayPayment = async () => {
    if (!checkout) return;
    if (!window.Razorpay) {
      setError('Razorpay is not loaded. Please refresh the page.');
      return;
    }

    setIsLoading(true);
    setStatus('processing');
    setError(null);

    try {
      const options = {
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        order_id: checkout.order_id,
        name: checkout.name,
        description: checkout.description,
        theme: {
          color: '#10b981', // emerald-500
        },
        handler: async (response: any) => {
          try {
            // Verify payment on backend
            const verification = await billingApi.verifyPayment(
              checkout.order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            if (verification.status === 'success') {
              setStatus('success');
              onSuccess({
                razorpay_order_id: checkout.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
            }
          } catch (verificationError) {
            const message = verificationError instanceof Error ? verificationError.message : 'Payment verification failed';
            setError(message);
            setStatus('error');
            onError(message);
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            setStatus('ready');
            onCancel();
          },
        },
        prefill,
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment initiation failed';
      setError(message);
      setStatus('error');
      onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!checkout) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/95 p-6">
        {/* Header */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-white">Complete Payment</h3>
          <p className="mt-1 text-sm text-slate-400">Your autopay recharge is ready. Complete the payment to add credits.</p>
        </div>

        {/* Order Details */}
        <div className="mb-6 space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Amount</span>
            <span className="font-semibold text-white">{formatCurrency(Math.round(checkout.amount / 100))}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-sm text-slate-400">Credits</span>
            <span className="font-semibold text-emerald-100">{formatCredits(checkout.credits)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-sm text-slate-400">Order ID</span>
            <span className="font-mono text-xs text-slate-500">{checkout.order_id.slice(0, 8)}...</span>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'success' && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
            <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-200" />
            <div>
              <div className="font-semibold text-emerald-50">Payment confirmed</div>
              <div className="mt-1 text-sm leading-6 text-emerald-100/80">Credits have been added to your wallet. You can now continue with your operations.</div>
            </div>
          </div>
        )}

        {status === 'error' && error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-200" />
            <div>
              <div className="font-semibold text-rose-50">Payment error</div>
              <div className="mt-1 text-sm leading-6 text-rose-100/80">{error}</div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {status !== 'success' && (
            <>
              <button
                onClick={onCancel}
                disabled={isLoading || status === 'processing'}
                className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRazorpayPayment}
                disabled={isLoading || status === 'processing' || !isReady}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === 'processing' ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  'Pay with Razorpay'
                )}
              </button>
            </>
          )}
          {status === 'success' && (
            <button
              onClick={onCancel}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
            >
              Close
            </button>
          )}
        </div>

        {/* Footer Note */}
        <div className="mt-4 text-center text-xs text-slate-500">
          Powered by Razorpay. Your payment information is securely encrypted.
        </div>
      </div>
    </div>
  );
}
