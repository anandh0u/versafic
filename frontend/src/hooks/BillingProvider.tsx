import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BillingContext } from './billing-context';
import { useAuth } from './useAuth';
import {
  buildDemoTopUpState,
  buildManualAutopayState,
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
  BillingContextType,
  BillingWorkspace,
  DemoState,
  PendingCheckout,
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

  const runCheckout = async (checkout: PendingCheckout, nextPlanId?: string) => {
    if (!user) {
      throw new Error('Please log in to continue');
    }

    await new Promise<void>((resolve, reject) => {
      checkoutRequestRef.current = {
        nextPlanId,
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

    try {
      if (demoState && request?.nextPlanId) {
        const nextState = {
          ...demoState,
          activePlanId: request.nextPlanId,
        };
        persistDemoState(user.id, nextState);
        setDemoState(nextState);
      }

      await syncWorkspace(true);
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

  const purchasePlan: BillingContextType['purchasePlan'] = async (planId) => {
    if (!user) {
      throw new Error('Please log in to purchase a plan');
    }

    const orderResponse = await billingApi.createOrder(planId);
    await runCheckout(orderResponse.data, planId);
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
