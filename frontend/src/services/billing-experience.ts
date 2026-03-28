import {
  CREDIT_TO_RUPEE_RATIO,
  defaultAutopaySettings,
  defaultBusinessProfile,
  getPlanById,
  LOW_BALANCE_THRESHOLD,
  pricingPlans,
  simulationActions,
  usageRules,
} from '../config/billing';
import { billingApi, apiConfig, userApi } from './api';
import type {
  AutopaySettings,
  BillingAlert,
  BillingMode,
  BillingTransaction,
  BillingWorkspace,
  BusinessProfile,
  BusinessProfileApiPayload,
  BusinessStatusResponse,
  CreditPack,
  CreditBreakdownItem,
  DemoState,
  PendingCheckout,
  PricingPlan,
  PreferredPaymentMethod,
  SimulationAction,
  UsageSummary,
  User,
} from '../types';
import { compactNumberFormatter } from '../lib/formatters';

interface RemoteBillingSeed {
  mode: BillingMode;
  plans: PricingPlan[];
  baseBalanceCredits: number;
  baseTransactions: BillingTransaction[];
  businessProfile: BusinessProfile;
  autopaySettings: AutopaySettings;
  canUseRazorpay: boolean;
}

const getStorageKey = (userId: number) => `versafic_demo_billing_${userId}`;

const safeJsonParse = <T>(value: string | null): T | null => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const randomId = (prefix: string): string =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

const addHours = (value: string, hours: number): string =>
  new Date(new Date(value).getTime() + hours * 60 * 60 * 1000).toISOString();

export const buildPaymentMethodLabel = (
  method: PreferredPaymentMethod,
  upiId?: string
): string => {
  switch (method) {
    case 'upi':
      return upiId?.trim()
        ? `Preferred checkout: UPI (${upiId.trim()})`
        : 'Preferred checkout: UPI';
    case 'card':
      return 'Preferred checkout: Card';
    case 'netbanking':
      return 'Preferred checkout: Net banking';
    default:
      return 'Customer-approved Razorpay checkout';
  }
};

const createTransaction = (
  partial: Omit<BillingTransaction, 'id' | 'createdAt'>
): BillingTransaction => ({
  id: randomId(partial.kind),
  createdAt: new Date().toISOString(),
  ...partial,
});

const normalizePlan = (plan: {
  id: string;
  name: string;
  amount: number;
  amount_paise: number;
  credits: number;
  description: string;
}): PricingPlan => {
  const fallback = getPlanById(plan.id);

  return {
    id: plan.id,
    name: plan.name,
    amount: plan.amount,
    amountPaise: plan.amount_paise,
    credits: plan.credits,
    description: plan.description,
    idealFor: fallback.idealFor,
    monthlyCapacity: fallback.monthlyCapacity,
    autopayEligible: true,
    highlight: fallback.highlight,
  };
};

const normalizeTransaction = (transaction: {
  id: number;
  type: 'topup' | 'usage_deduction' | 'refund' | 'adjustment';
  credits: number;
  source: string;
  description: string;
  created_at: string;
  amount_paise?: number | null;
  reference_id?: string | null;
}): BillingTransaction => {
  const kindMap: Record<string, BillingTransaction['kind']> = {
    topup: 'topup',
    usage_deduction: 'usage',
    refund: 'refund',
    adjustment: 'adjustment',
  };

  const sourceLabelMap: Record<string, string> = {
    razorpay: 'Razorpay Top-up',
    autopay: 'Autopay Recharge',
    demo_autopay: 'Demo Autopay',
    ai_chat: 'AI Chat',
    voice_call: 'Voice Call',
    inbound_call: 'Inbound Call',
    outbound_call: 'Outbound Call',
    sarvam_stt: 'Sarvam STT',
    voice_process: 'Voice Processing',
    premium_call: 'Premium AI Call',
    recording_process: 'Recording Processing',
    onboarding_ai_setup: 'AI Setup',
    admin: 'Admin Action',
    system: 'System',
  };

  return {
    id: `server-${transaction.id}`,
    kind: transaction.source === 'autopay' ? 'autopay' : kindMap[transaction.type] || 'adjustment',
    creditsDelta: transaction.credits,
    amountPaise: transaction.amount_paise ?? undefined,
    source: transaction.source,
    sourceLabel: sourceLabelMap[transaction.source] || transaction.source.replace(/_/g, ' '),
    description: transaction.description || 'Wallet event',
    status: 'completed',
    createdAt: transaction.created_at,
    referenceId: transaction.reference_id ?? undefined,
    featureKey: transaction.source,
  };
};

const resolveAutopayPlan = (autopay: Pick<AutopaySettings, 'selectedPlanId' | 'rechargeAmount'>): PricingPlan => {
  const byId = autopay.selectedPlanId ? pricingPlans.find((plan) => plan.id === autopay.selectedPlanId) : undefined;
  if (byId) {
    return byId;
  }

  const byAmount = pricingPlans.find((plan) => plan.amountPaise === autopay.rechargeAmount);
  return byAmount ?? getPlanById('growth');
};

const normalizeAutopaySettings = (payload: {
  enabled: boolean;
  threshold_credits: number;
  recharge_amount: number;
  mode: 'demo' | 'real';
  status: 'active' | 'paused' | 'needs_attention';
  failure_reason?: string | null;
}, pendingCheckout?: PendingCheckout | null): AutopaySettings => {
  const selectedPlan = pricingPlans.find((plan) => plan.amountPaise === payload.recharge_amount) ?? getPlanById('growth');

  return {
    enabled: payload.enabled,
    selectedPlanId: selectedPlan.id,
    triggerType: 'low_balance',
    thresholdCredits: payload.threshold_credits,
    rechargeAmount: payload.recharge_amount,
    mode: payload.mode,
    preferredPaymentMethod: 'upi',
    upiId: '',
    paymentMethodLabel: payload.mode === 'real' ? 'Customer-approved Razorpay checkout' : 'Instant recharge',
    status: payload.status,
    failedReason: payload.failure_reason || undefined,
    pendingCheckout: pendingCheckout ?? null,
  };
};

const normalizeAutopayLog = (log: {
  id: number;
  amount: number;
  credits: number;
  status: 'pending_checkout' | 'completed' | 'failed' | 'skipped' | 'blocked';
  triggered_reason: 'low_balance' | 'manual_retry' | 'insufficient_credits';
  mode: 'demo' | 'real';
  razorpay_order_id?: string | null;
  metadata?: Record<string, unknown>;
  timestamp: string;
}): BillingTransaction => ({
  id: `autopay-${log.id}`,
  kind: 'autopay',
  creditsDelta: log.status === 'completed' ? log.credits : 0,
  amountPaise: log.amount,
  source: 'autopay',
  sourceLabel: 'Autopay Recharge',
  description:
    log.status === 'completed'
      ? `Autopay recharged ${Math.floor(log.amount / 100)} INR after ${log.triggered_reason.replace(/_/g, ' ')} trigger.`
      : typeof log.metadata?.reason === 'string'
        ? String(log.metadata.reason)
        : `Autopay ${log.status.replace(/_/g, ' ')} after ${log.triggered_reason.replace(/_/g, ' ')} trigger.`,
  status:
    log.status === 'completed'
      ? 'completed'
      : log.status === 'pending_checkout'
        ? 'pending'
        : 'failed',
  createdAt: log.timestamp,
  referenceId: log.razorpay_order_id || `AUTO-${log.id}`,
  featureKey: log.mode,
  metadata: {
    triggeredBy: log.triggered_reason,
    mode: log.mode,
  },
});

const deriveBusinessProfile = (
  user: User,
  profilePayload?: BusinessProfileApiPayload | null,
  statusPayload?: BusinessStatusResponse['data']
): BusinessProfile => {
  const fallbackBusinessName =
    user.name || user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const source = profilePayload ?? statusPayload?.profile ?? null;

  return {
    businessName: source?.business_name || fallbackBusinessName,
    businessType: source?.business_type || defaultBusinessProfile.businessType,
    industry: source?.industry || defaultBusinessProfile.industry,
    website: source?.website || defaultBusinessProfile.website,
    country: source?.country || defaultBusinessProfile.country,
    phone: source?.phone || defaultBusinessProfile.phone,
    supportWorkflowStatus:
      statusPayload?.hasBusinessProfile ? 'Voice + chat flows configured' : defaultBusinessProfile.supportWorkflowStatus,
    aiSetupStatus:
      statusPayload?.isOnboarded ? 'Assistant prompts published' : defaultBusinessProfile.aiSetupStatus,
    onboardingStage: statusPayload?.isOnboarded ? 'Onboarding completed' : 'Workspace ready',
    lastSyncAt: source?.updated_at || source?.created_at || new Date().toISOString(),
  };
};

const pickPlanByBalance = (plans: PricingPlan[], balanceCredits: number): PricingPlan => {
  const sorted = [...plans].sort((left, right) => left.credits - right.credits);
  const match = [...sorted].reverse().find((plan) => balanceCredits >= plan.credits);
  return match ?? sorted[1] ?? sorted[0];
};

const buildSeedTransaction = (): BillingTransaction => createTransaction({
  kind: 'topup',
  creditsDelta: getPlanById('growth').credits,
  amountPaise: getPlanById('growth').amountPaise,
  source: 'demo_seed',
  sourceLabel: 'Opening Balance',
  description: 'Opening balance added so the workspace starts ready for calls and billing.',
  status: 'completed',
  referenceId: randomId('SEED'),
  featureKey: 'growth',
});

const readPersistedDemoState = (userId: number): DemoState | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return safeJsonParse<DemoState>(window.localStorage.getItem(getStorageKey(userId)));
};

export const persistDemoState = (userId: number, state: DemoState): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
};

export const resolveDemoState = (
  userId: number,
  seed: RemoteBillingSeed,
  currentState?: DemoState | null
): DemoState => {
  const stored = currentState ?? readPersistedDemoState(userId);
  const fallbackPlan = pickPlanByBalance(seed.plans, seed.baseBalanceCredits).id;

  const baseState: DemoState = stored ?? {
    localTransactions: [],
    activePlanId: fallbackPlan,
    autopay: { ...seed.autopaySettings },
    seededCreditsGranted: false,
  };

  const nextState: DemoState = {
    ...baseState,
    autopay: {
      ...seed.autopaySettings,
      ...baseState.autopay,
    },
    localTransactions: baseState.localTransactions ?? [],
    activePlanId: baseState.activePlanId || fallbackPlan,
  };

  if (!nextState.seededCreditsGranted && seed.baseBalanceCredits === 0) {
    nextState.seededCreditsGranted = true;
    nextState.activePlanId = 'growth';
    nextState.localTransactions = [buildSeedTransaction(), ...nextState.localTransactions];
  }

  return nextState;
};

const summarizeUsage = (
  transactions: BillingTransaction[],
  autopay: DemoState['autopay'],
  balanceCredits: number
): UsageSummary => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const thisMonth = transactions.filter(
    (transaction) =>
      transaction.creditsDelta < 0 && new Date(transaction.createdAt).getTime() >= monthStart.getTime()
  );

  const creditsUsed = Math.abs(
    thisMonth.reduce((sum, transaction) => sum + transaction.creditsDelta, 0)
  );

  const totalCallsHandled = transactions.filter(
    (transaction) => transaction.source === 'voice_call' || transaction.source === 'premium_call'
  ).length;

  const standardCallMinutes = transactions
    .filter((transaction) => transaction.source === 'voice_call')
    .reduce((sum, transaction) => sum + Number(transaction.metadata?.minutes ?? 0), 0);

  const premiumCallMinutes = transactions
    .filter((transaction) => transaction.source === 'premium_call')
    .reduce((sum, transaction) => sum + Number(transaction.metadata?.minutes ?? 0), 0);

  const estimatedNextRecharge = autopay.enabled
    ? balanceCredits <= autopay.thresholdCredits
      ? 'Any time now'
      : `Below ${autopay.thresholdCredits} credits or on plan renewal`
    : 'Manual recharge only';

  return {
    monthCreditsUsed: creditsUsed,
    totalCallsHandled,
    aiChatsUsed: transactions.filter((transaction) => transaction.source === 'ai_chat').length,
    sarvamRequests: transactions.filter((transaction) => transaction.source === 'sarvam_stt').length,
    voiceProcesses: transactions.filter((transaction) => transaction.source === 'voice_process').length,
    recordingsProcessed: transactions.filter((transaction) => transaction.source === 'recording_process').length,
    onboardingAutomations: transactions.filter((transaction) => transaction.source === 'onboarding_ai_setup').length,
    premiumCallMinutes,
    standardCallMinutes,
    estimatedNextRecharge,
  };
};

const buildConsumptionBreakdown = (transactions: BillingTransaction[]): CreditBreakdownItem[] => {
  const usageTransactions = transactions.filter((transaction) => transaction.creditsDelta < 0);
  const totalUsed = Math.abs(usageTransactions.reduce((sum, transaction) => sum + transaction.creditsDelta, 0));

  const grouped = usageTransactions.reduce<Record<string, { credits: number; count: number }>>((acc, transaction) => {
    const current = acc[transaction.sourceLabel] ?? { credits: 0, count: 0 };
    current.credits += Math.abs(transaction.creditsDelta);
    current.count += 1;
    acc[transaction.sourceLabel] = current;
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([label, entry]) => ({
      label,
      credits: entry.credits,
      share: totalUsed === 0 ? 0 : (entry.credits / totalUsed) * 100,
      volume: `${entry.count} event${entry.count === 1 ? '' : 's'}`,
    }))
    .sort((left, right) => right.credits - left.credits)
    .slice(0, 5);
};

const buildAlerts = (
  mode: BillingMode,
  balanceCredits: number,
  autopay: DemoState['autopay']
): BillingAlert[] => {
  const alerts: BillingAlert[] = [];

  if (mode !== 'live') {
    alerts.push({
      severity: 'info',
      title: 'Hybrid billing mode is active',
      body: 'Live login and checkout are available while some workspace activity is still tracked locally for presentation speed.',
    });
  }

  if (balanceCredits <= 0) {
    alerts.push({
      severity: 'danger',
      title: 'Credits exhausted',
      body: 'Top up now or enable autopay to keep calls and AI support available.',
    });
  } else if (balanceCredits < LOW_BALANCE_THRESHOLD) {
    alerts.push({
      severity: 'warning',
      title: 'Low balance warning',
      body: `Balance is below ${LOW_BALANCE_THRESHOLD} credits. Recharge now or let autopay handle the next top-up.`,
    });
  }

  if (autopay.enabled && autopay.status === 'needs_attention') {
    alerts.push({
      severity: 'warning',
      title: 'Autopay needs attention',
      body: autopay.failedReason || 'Previous autopay attempt failed. Update the payment method before the next usage spike.',
    });
  }

  return alerts;
};

export const composeBillingWorkspace = (
  seed: RemoteBillingSeed,
  demoState: DemoState
): BillingWorkspace => {
  const allTransactions = [...seed.baseTransactions, ...demoState.localTransactions].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );

  const localDelta = demoState.localTransactions.reduce((sum, transaction) => sum + transaction.creditsDelta, 0);
  const balanceCredits = seed.baseBalanceCredits + localDelta;
  const currentPlan = getPlanById(demoState.activePlanId || pickPlanByBalance(seed.plans, balanceCredits).id);
  const walletHealth =
    balanceCredits <= 0 ? 'empty' : balanceCredits < LOW_BALANCE_THRESHOLD ? 'low' : 'healthy';

  const usageHistory = allTransactions.filter((transaction) => transaction.creditsDelta < 0);
  const rechargeHistory = allTransactions.filter((transaction) => transaction.creditsDelta > 0);
  const autopayHistory = allTransactions.filter(
    (transaction) => transaction.kind === 'autopay' || transaction.source === 'autopay'
  );
  const usageSummary = summarizeUsage(allTransactions, demoState.autopay, balanceCredits);

  return {
    mode: seed.mode,
    pricingPlans: seed.plans,
    usageRules,
    simulationActions,
    currentPlan,
    currentPlanStatus: demoState.autopay.enabled
      ? `Auto-recharge enabled below ${demoState.autopay.thresholdCredits} credits`
      : 'Manual recharge mode',
    balanceCredits,
    baseBalanceCredits: seed.baseBalanceCredits,
    lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
    walletHealth,
    autopay: demoState.autopay,
    transactions: allTransactions,
    usageHistory,
    rechargeHistory,
    autopayHistory,
    usageSummary,
    businessProfile: seed.businessProfile,
    alerts: buildAlerts(seed.mode, balanceCredits, demoState.autopay),
    consumptionBreakdown: buildConsumptionBreakdown(usageHistory),
    paymentReadiness: {
      canUseRazorpay: seed.canUseRazorpay,
      message: seed.canUseRazorpay
        ? 'Razorpay top-ups are ready. Live checkout can open from the billing page whenever you buy a plan or recharge.'
        : 'Live checkout is not connected yet. Use instant recharge until Razorpay is available.',
    },
  };
};

export const loadRemoteBillingSeed = async (user: User): Promise<RemoteBillingSeed> => {
  if (apiConfig.billingMode === 'mock') {
    return {
      mode: 'mock',
      plans: pricingPlans,
      baseBalanceCredits: 0,
      baseTransactions: [],
      businessProfile: {
        ...defaultBusinessProfile,
        businessName: user.name || defaultBusinessProfile.businessName,
      },
      autopaySettings: defaultAutopaySettings,
      canUseRazorpay: false,
    };
  }

  const [plansResult, walletResult, profileResult, statusResult, autopayResult] = await Promise.allSettled([
    billingApi.getPlans(),
    billingApi.getWallet(),
    userApi.getProfile(),
    userApi.getStatus(),
    billingApi.getAutopayStatus(),
  ]);

  const plans =
    plansResult.status === 'fulfilled'
      ? plansResult.value.data.plans.map(normalizePlan)
      : pricingPlans;

  const baseBalanceCredits =
    walletResult.status === 'fulfilled' ? walletResult.value.data.balance_credits : 0;

  const baseTransactions =
    walletResult.status === 'fulfilled'
      ? walletResult.value.data.transactions.map(normalizeTransaction)
      : [];

  const remoteAutopayTransactions =
    autopayResult.status === 'fulfilled'
      ? autopayResult.value.data.logs
          .filter((log) =>
            log.status !== 'completed'
              || !baseTransactions.some(
                  (transaction) =>
                    transaction.source === 'autopay'
                    && transaction.amountPaise === log.amount
                    && Math.abs(new Date(transaction.createdAt).getTime() - new Date(log.timestamp).getTime()) < 60_000
                )
          )
          .map(normalizeAutopayLog)
      : [];

  const statusPayload = statusResult.status === 'fulfilled' ? statusResult.value.data : undefined;
  const profilePayload = profileResult.status === 'fulfilled' ? profileResult.value.data : null;

  const mode: BillingMode =
    plansResult.status === 'fulfilled' && walletResult.status === 'fulfilled' ? 'live' : 'hybrid';

    return {
      mode,
      plans,
      baseBalanceCredits,
      baseTransactions: [...baseTransactions, ...remoteAutopayTransactions],
      businessProfile: deriveBusinessProfile(user, profilePayload, statusPayload),
      autopaySettings:
        autopayResult.status === 'fulfilled'
        ? normalizeAutopaySettings(
            autopayResult.value.data.settings,
            autopayResult.value.data.pending_checkout ?? null
          )
        : defaultAutopaySettings,
      canUseRazorpay:
        plansResult.status === 'fulfilled' &&
      walletResult.status === 'fulfilled',
  };
};

export const buildDemoTopUpState = (state: DemoState, planId: string): DemoState => {
  const plan = getPlanById(planId);

  return {
    ...state,
    activePlanId: planId,
    localTransactions: [
      createTransaction({
        kind: 'topup',
        creditsDelta: plan.credits,
        amountPaise: plan.amountPaise,
        source: 'demo_topup',
        sourceLabel: 'Instant Recharge',
        description: `${plan.name} credits were added instantly.`,
        status: 'completed',
        referenceId: randomId('TOPUP'),
        featureKey: planId,
      }),
      ...state.localTransactions,
    ],
  };
};

export const buildCreditPackTopUpState = (
  state: DemoState,
  pack: Pick<CreditPack, 'id' | 'label' | 'credits' | 'amountPaise'>
): DemoState => ({
  ...state,
  localTransactions: [
    createTransaction({
      kind: 'topup',
      creditsDelta: pack.credits,
      amountPaise: pack.amountPaise,
      source: 'demo_topup',
      sourceLabel: 'Credit Recharge',
      description: `${pack.label} purchased and added to the wallet.`,
      status: 'completed',
      referenceId: randomId('PACK'),
      featureKey: pack.id,
    }),
    ...state.localTransactions,
  ],
});

export const buildUpdatedAutopayState = (
  state: DemoState,
  patch: Partial<DemoState['autopay']>
): DemoState => {
  const nextSelectedPlanId = patch.selectedPlanId ?? state.autopay.selectedPlanId;
  const matchedPlan = nextSelectedPlanId ? getPlanById(nextSelectedPlanId) : undefined;

  return {
    ...state,
    autopay: {
      ...state.autopay,
      ...patch,
      selectedPlanId: nextSelectedPlanId,
      rechargeAmount:
        patch.rechargeAmount
        ?? (patch.selectedPlanId ? matchedPlan?.amountPaise : undefined)
        ?? state.autopay.rechargeAmount,
      paymentMethodLabel:
        patch.paymentMethodLabel
        ?? (
          patch.preferredPaymentMethod || patch.upiId !== undefined
            ? buildPaymentMethodLabel(
                patch.preferredPaymentMethod ?? state.autopay.preferredPaymentMethod,
                patch.upiId ?? state.autopay.upiId
              )
            : state.autopay.paymentMethodLabel
        ),
      pendingCheckout: patch.enabled === false ? null : patch.pendingCheckout ?? state.autopay.pendingCheckout ?? null,
      nextAutopayAttemptAt:
        patch.enabled === false
          ? undefined
          : patch.nextAutopayAttemptAt || state.autopay.nextAutopayAttemptAt || addHours(new Date().toISOString(), 72),
    },
  };
};

export const buildManualAutopayState = (state: DemoState): DemoState => {
  if (!state.autopay.enabled) {
    throw new Error('Enable autopay first to run a recharge demo.');
  }

  const plan = resolveAutopayPlan(state.autopay);
  const recharge = createAutopayRecharge(state.autopay, 'Manual autopay demo triggered');

  return {
    ...state,
    activePlanId: plan.id,
    autopay: {
      ...state.autopay,
      lastAutopayAt: recharge.createdAt,
      nextAutopayAttemptAt: addHours(recharge.createdAt, 72),
      status: 'active',
      failedReason: undefined,
    },
    localTransactions: [recharge, ...state.localTransactions],
  };
};

const createAutopayRecharge = (
  autopay: Pick<AutopaySettings, 'selectedPlanId' | 'rechargeAmount' | 'thresholdCredits'>,
  reason: string
): BillingTransaction => {
  const plan = resolveAutopayPlan(autopay);
  const credits = Math.floor(autopay.rechargeAmount / CREDIT_TO_RUPEE_RATIO);

  return createTransaction({
    kind: 'autopay',
    creditsDelta: credits,
    amountPaise: autopay.rechargeAmount,
    source: 'autopay',
    sourceLabel: 'Autopay Recharge',
    description: `${reason}. ${plan.name} added automatically below ${autopay.thresholdCredits} credits.`,
    status: 'completed',
    referenceId: randomId('AUTO'),
    featureKey: plan.id,
  });
};

const createUsageTransaction = (action: SimulationAction): BillingTransaction =>
  createTransaction({
    kind: 'usage',
    creditsDelta: -action.credits,
    source: action.source,
    sourceLabel: action.sourceLabel,
    description: `${action.label} burned ${action.credits} credits.`,
    status: 'completed',
    referenceId: randomId(action.referencePrefix),
    featureKey: action.source,
    metadata: {
      quantity: action.quantityLabel,
      outcome: action.outcome,
      minutes: action.minutes ?? 0,
      creditRate: `${action.credits} credits`,
    },
  });

export const buildSimulationState = (
  state: DemoState,
  workspace: BillingWorkspace,
  actionId: string
): DemoState => {
  const action = simulationActions.find((item) => item.id === actionId);

  if (!action) {
    throw new Error('Simulation action not found');
  }

  let nextState: DemoState = {
    ...state,
    localTransactions: [...state.localTransactions],
    autopay: { ...state.autopay },
  };

  let availableBalance = workspace.balanceCredits;

  if (availableBalance < action.credits) {
    if (!nextState.autopay.enabled) {
      throw new Error('Not enough credits. Recharge or enable autopay before running this action.');
    }

      const plan = resolveAutopayPlan(nextState.autopay);
      const recharge = createAutopayRecharge(nextState.autopay, 'Autopay recovered an exhausted wallet');
      nextState.localTransactions.unshift(recharge);
      nextState.activePlanId = plan.id;
      nextState.autopay.lastAutopayAt = recharge.createdAt;
      nextState.autopay.nextAutopayAttemptAt = addHours(recharge.createdAt, 72);
      availableBalance += recharge.creditsDelta;
  }

  const usage = createUsageTransaction(action);
  nextState.localTransactions.unshift(usage);
  const postUsageBalance = availableBalance - action.credits;

  if (
    nextState.autopay.enabled &&
    nextState.autopay.triggerType === 'low_balance' &&
    postUsageBalance < nextState.autopay.thresholdCredits
  ) {
      const plan = resolveAutopayPlan(nextState.autopay);
      const recharge = createAutopayRecharge(nextState.autopay, 'Autopay low-balance trigger fired');
      nextState.localTransactions.unshift(recharge);
      nextState.activePlanId = plan.id;
    nextState.autopay.lastAutopayAt = recharge.createdAt;
    nextState.autopay.nextAutopayAttemptAt = addHours(recharge.createdAt, 72);
  }

  return nextState;
};

export const estimateCreditValue = (credits: number): string =>
  `~ INR ${compactNumberFormatter.format(credits / CREDIT_TO_RUPEE_RATIO)}`;

let razorpayScriptPromise: Promise<void> | null = null;

export const ensureRazorpayLoaded = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay can only load in the browser'));
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};
