import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BillingContext } from './billing-context';
import { useAuth } from './useAuth';
import {
  buildCreditPackTopUpState,
  buildDemoTopUpState,
  buildManualAutopayState,
  buildPaymentMethodLabel,
  buildSimulationState,
  buildUpdatedAutopayState,
  composeBillingWorkspace,
  loadRemoteBillingSeed,
  persistDemoState,
  resolveDemoState,
} from '../services/billing-experience';
import { apiConfig, billingApi } from '../services/api';
import { RazorpayCheckout } from '../components/billing/RazorpayCheckout';
import type {
  AutopaySettings,
  BillingContextType,
  BillingWorkspace,
  DemoState,
  PendingCheckout,
  PurchasePlanOptions,
} from '../types';

export function BillingProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [remoteSeed, setRemoteSeed] = useState<Awaited<ReturnType<typeof loadRemoteBillingSeed>> | null>(null);
  const [demoState, setDemoState] = useState<DemoState | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<PendingCheckout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutRequestRef = useRef<{
    nextPlanId?: string;
    autopaySetup?: Partial<AutopaySettings> | null;
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);

  const workspace: BillingWorkspace | null =
    remoteSeed && demoState ? composeBillingWorkspace(remoteSeed, demoState) : null;

  const syncWorkspace = async (refreshing = false, stateOverride?: DemoState | null) => {
    if (!user) {
      return;
    }

    setError(null);
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const nextSeed = await loadRemoteBillingSeed(user);
      const nextDemoState = resolveDemoState(user.id, nextSeed, stateOverride ?? demoState);
      persistDemoState(user.id, nextDemoState);
      setRemoteSeed(nextSeed);
      setDemoState(nextDemoState);
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Failed to load billing workspace');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setRemoteSeed(null);
      setDemoState(null);
      setError(null);
      return;
    }

    void syncWorkspace();
  }, [isAuthenticated, user?.id]);

  const updateDemoState = async (
    builder: (current: DemoState, currentWorkspace: BillingWorkspace) => DemoState
  ) => {
    if (!user || !remoteSeed || !demoState || !workspace) {
      throw new Error('Billing workspace is not ready yet');
    }

    const nextState = builder(demoState, workspace);
    persistDemoState(user.id, nextState);
    setDemoState(nextState);
  };

  const runCheckout = async (
    checkout: PendingCheckout,
    options?: {
      nextPlanId?: string;
      autopaySetup?: Partial<AutopaySettings> | null;
    }
  ) => {
    if (!user) {
      throw new Error('Please log in to continue');
    }

    await new Promise<void>((resolve, reject) => {
      checkoutRequestRef.current = {
        nextPlanId: options?.nextPlanId,
        autopaySetup: options?.autopaySetup,
        resolve,
        reject,
      };
      setActiveCheckout(checkout);
    });
  };

  const clearCheckoutRequest = () => {
    checkoutRequestRef.current = null;
    setActiveCheckout(null);
  };

  const handleCheckoutSuccess = async () => {
    if (!user) {
      const request = checkoutRequestRef.current;
      clearCheckoutRequest();
      request?.reject(new Error('Please log in to continue'));
      return;
    }

    const request = checkoutRequestRef.current;
    let nextState = demoState;
    let autopaySetupError: Error | null = null;
    let fallbackState = demoState;

    try {
      if (demoState && request?.nextPlanId) {
        nextState = {
          ...demoState,
          activePlanId: request.nextPlanId,
        };
        fallbackState = nextState;
        persistDemoState(user.id, nextState);
        setDemoState(nextState);
      }

      if (request?.autopaySetup && nextState) {
        const optimisticAutopayState = buildUpdatedAutopayState(nextState, {
          ...request.autopaySetup,
          paymentMethodLabel:
            request.autopaySetup.paymentMethodLabel
            ?? buildPaymentMethodLabel(
              request.autopaySetup.preferredPaymentMethod ?? nextState.autopay.preferredPaymentMethod,
              request.autopaySetup.upiId ?? nextState.autopay.upiId
            ),
        });

        nextState = optimisticAutopayState;
        persistDemoState(user.id, optimisticAutopayState);
        setDemoState(optimisticAutopayState);

        if (apiConfig.billingMode !== 'mock') {
          try {
            const nextAutopay = {
              ...(workspace?.autopay ?? optimisticAutopayState.autopay),
              ...request.autopaySetup,
            };

            await billingApi.enableAutopay({
              selected_plan: nextAutopay.selectedPlanId,
              threshold_credits: nextAutopay.thresholdCredits,
              recharge_amount: nextAutopay.rechargeAmount,
              mode: nextAutopay.mode,
            });
          } catch (setupError) {
            autopaySetupError = setupError instanceof Error
              ? setupError
              : new Error('Low-balance recharge setup could not be saved');
            nextState = fallbackState;
            if (fallbackState) {
              persistDemoState(user.id, fallbackState);
              setDemoState(fallbackState);
            }
          }
        }
      }

      await syncWorkspace(true, nextState);

      if (autopaySetupError) {
        const message = `Plan purchased, but low-balance recharge setup failed: ${autopaySetupError.message}`;
        setError(message);
        request?.reject(new Error(message));
        return;
      }

      request?.resolve();
    } catch (checkoutError) {
      request?.reject(
        checkoutError instanceof Error
          ? checkoutError
          : new Error('Payment verification failed')
      );
    } finally {
      clearCheckoutRequest();
    }
  };

  const handleCheckoutError = (message: string) => {
    const request = checkoutRequestRef.current;
    clearCheckoutRequest();
    request?.reject(new Error(message));
  };

  const handleCheckoutCancel = () => {
    const request = checkoutRequestRef.current;
    clearCheckoutRequest();
    request?.reject(new Error('Payment cancelled'));
  };

  const purchasePlan: BillingContextType['purchasePlan'] = async (planId, options?: PurchasePlanOptions) => {
    if (!user) {
      throw new Error('Please log in to purchase a plan');
    }

    const orderResponse = await billingApi.createOrder(planId);
    await runCheckout(orderResponse.data, {
      nextPlanId: planId,
      autopaySetup: options?.autopaySetup ?? null,
    });
  };

  const purchaseCredits: BillingContextType['purchaseCredits'] = async (amountPaise, credits) => {
    if (!user) {
      throw new Error('Please log in to purchase credits');
    }

    if (apiConfig.billingMode === 'mock') {
      await updateDemoState((current) => buildCreditPackTopUpState(current, {
        id: `pack-${credits}`,
        label: `${credits} credits`,
        credits,
        amountPaise,
      }));
      return;
    }

    const orderResponse = await billingApi.createCustomOrder(amountPaise, credits);
    await runCheckout(orderResponse.data);
  };

  const demoTopUp: BillingContextType['demoTopUp'] = async (planId) => {
    await updateDemoState((current) => buildDemoTopUpState(current, planId));
  };

  const simulateUsage: BillingContextType['simulateUsage'] = async (actionId) => {
    await updateDemoState((current, currentWorkspace) => buildSimulationState(current, currentWorkspace, actionId));
  };

  const updateAutopay: BillingContextType['updateAutopay'] = async (patch) => {
    if (!workspace || !demoState || !user) {
      throw new Error('Billing workspace is not ready yet');
    }

    const previousDemoState = demoState;
    const optimisticDemoState = buildUpdatedAutopayState(demoState, patch);
    const nextAutopay = {
      ...workspace.autopay,
      ...patch,
    };

    persistDemoState(user.id, optimisticDemoState);
    setDemoState(optimisticDemoState);

    try {
      if (apiConfig.billingMode !== 'mock') {
        if (nextAutopay.enabled === false) {
          await billingApi.disableAutopay();
        } else {
          await billingApi.enableAutopay({
            selected_plan: nextAutopay.selectedPlanId,
            threshold_credits: nextAutopay.thresholdCredits,
            recharge_amount: nextAutopay.rechargeAmount,
            mode: nextAutopay.mode,
          });
        }

        await syncWorkspace(true, optimisticDemoState);
        return;
      }
    } catch (autopayError) {
      if (apiConfig.billingMode === 'live') {
        persistDemoState(user.id, previousDemoState);
        setDemoState(previousDemoState);
        throw autopayError;
      }
    }
  };

  const triggerAutopay: BillingContextType['triggerAutopay'] = async () => {
    if (!workspace || !demoState || !user) {
      throw new Error('Billing workspace is not ready yet');
    }

    try {
      if (apiConfig.billingMode !== 'mock') {
        if (workspace.autopay.pendingCheckout) {
          await runCheckout(workspace.autopay.pendingCheckout);
          return;
        }

        const response = await billingApi.triggerAutopay({
          triggered_by: 'manual_retry',
          force: true,
        });

        if (response.data.requires_user_action && response.data.checkout) {
          await runCheckout(response.data.checkout);
          return;
        }

        await syncWorkspace(true);
        return;
      }
    } catch (autopayError) {
      if (apiConfig.billingMode === 'live') {
        throw autopayError;
      }
    }

    await updateDemoState((current) => buildManualAutopayState(current));
  };

  const value: BillingContextType = {
    workspace,
    isLoading,
    isRefreshing,
    error,
    refresh: () => syncWorkspace(true),
    purchasePlan,
    purchaseCredits,
    demoTopUp,
    simulateUsage,
    updateAutopay,
    triggerAutopay,
  };

  return (
    <BillingContext.Provider value={value}>
      {children}
      <RazorpayCheckout
        checkout={activeCheckout}
        prefill={{
          email: user?.email,
          name: user?.name,
          contact: user?.phoneNumber,
        }}
        onSuccess={(_response) => void handleCheckoutSuccess()}
        onError={handleCheckoutError}
        onCancel={handleCheckoutCancel}
      />
    </BillingContext.Provider>
  );
}
