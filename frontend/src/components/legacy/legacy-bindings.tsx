"use client";

import { useEffect } from "react";
import {
  BillingPlan,
  BusinessRecord,
  CallSession,
  ChatHistoryItem,
  ChatStats,
  CustomerResolutionStats,
  CustomerSentimentStats,
  CustomerServiceInteraction,
  VoiceConversation,
  getOAuthStartUrl,
  createBusinessRecord,
  createOrder,
  getAutopayStatus,
  getBusinessList,
  getCallConfig,
  getCallSessions,
  getChatHistory,
  getChatStats,
  getCustomerResolutionStats,
  getCustomerSentimentStats,
  getCustomerServiceActiveSessions,
  getCurrentUser,
  getPlans,
  getPublicCallConfig,
  getRecentVoiceConversations,
  getResolvedInteractions,
  getSetupBusiness,
  getSetupStatus,
  getStoredSession,
  getStoredUser,
  getVoiceStats,
  getWallet,
  LegacyApiError,
  login,
  register,
  saveSetupBusiness,
  sendCustomerServiceChat,
  setPreferredPlanId,
  startCustomerServiceSession,
  updateBusiness,
  updateCurrentUser,
  validateRegistrableEmail,
  verifyPayment,
  WalletInfo,
} from "@/lib/legacy-api";

type LegacyBindingsProps = {
  pageKey: string;
};

type BusinessKind =
  | "hotel"
  | "restaurant"
  | "clinic"
  | "barber"
  | "creator"
  | "consultant"
  | "agency";

type DirectoryBusiness = BusinessRecord & {
  kind: BusinessKind;
  emoji: string;
  badgeClass: string;
  badgeText: string;
  accentTint: string;
  listingContext: string;
  primaryMeta: string;
  statusValue: string;
  statusLabel: string;
  statusSubtext: string;
  aiLabels: string[];
  description: string;
  handle: string;
};

type DashboardState = {
  user: Awaited<ReturnType<typeof getCurrentUser>> | null;
  wallet: WalletInfo | null;
  plans: BillingPlan[];
  autopay: Awaited<ReturnType<typeof getAutopayStatus>> | null;
  setup: Awaited<ReturnType<typeof getSetupBusiness>> | null;
  setupStatus: Awaited<ReturnType<typeof getSetupStatus>> | null;
  callConfig: Awaited<ReturnType<typeof getCallConfig>> | null;
  callSessions: CallSession[];
  chatHistory: ChatHistoryItem[];
  chatStats: ChatStats | null;
  voiceStats: Awaited<ReturnType<typeof getVoiceStats>> | null;
  voiceConversations: VoiceConversation[];
  resolvedInteractions: CustomerServiceInteraction[];
  customerSentiment: CustomerSentimentStats | null;
  customerResolution: CustomerResolutionStats | null;
  activeCustomerSessions: string[];
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  showToast?: (message: string, type?: string) => void;
  showPage?: (pageId: string, navItem?: HTMLElement | null) => void;
  openLogin?: () => void;
  closeLogin?: () => void;
  nextStep?: () => void;
  prevStep?: () => void;
  updateUI?: () => void;
  sendChat?: () => void;
  filterCallsTable?: () => void;
  filterChatsTable?: () => void;
  filterCustomersTable?: () => void;
  renderResults?: () => void;
  setFilter?: (button: HTMLElement, kind: string) => void;
  setDateFilter?: (button: HTMLElement) => void;
  setBookingFilter?: (button: HTMLElement) => void;
  renderWeeklyCalendar?: () => void;
  doSearch?: () => void;
  startCall?: () => void;
  simulateCall?: () => void;
  closeModal?: () => void;
  openCallModal?: () => void;
  closeCallModal?: () => void;
  __versaficOriginalNextStep?: () => void;
  __versaficOnboardingAccountCreated?: boolean;
  __versaficCustomerServiceSessionId?: string | null;
  __versaficSearchBusinesses?: DirectoryBusiness[];
  __versaficSearchFiltered?: DirectoryBusiness[];
  __versaficActiveSearchKind?: string;
  __versaficCurrentBusiness?: DirectoryBusiness | null;
  __versaficDashboardState?: DashboardState;
  __versaficCallRows?: Array<Record<string, string>>;
  __versaficChatRows?: Array<Record<string, string>>;
  __versaficCustomerRows?: Array<Record<string, string>>;
  __versaficSelectedDateFilters?: Record<string, string>;
  __versaficSelectedWorkflowFilter?: string;
  __versaficDashboardPopstateBound?: boolean;
  __versaficLoadedDashboardPages?: Record<string, boolean>;
};

const selectedPlanOutline = "2px solid #6366f1";
const DATA_CHANGED_EVENT = "versafic:data-changed";
const RAZORPAY_SCRIPT_SELECTOR = 'script[data-razorpay="true"]';
const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const RAZORPAY_LOAD_TIMEOUT_MS = 12000;
let razorpayLoader: Promise<void> | null = null;
let dashboardRefreshTimer: number | null = null;
let dashboardRefreshInFlight = false;
let onboardingValidationAttemptedSteps = new Set<string>();
const dashboardLazyLoaders = new Map<string, Promise<void>>();
const dashboardSidebarPages = ["overview", "calls", "chats", "bookings", "customers", "analytics", "credits", "agent"] as const;

const getWindowRef = (): RazorpayWindow => window as RazorpayWindow;

const isDashboardRoute = () => typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");

const showToast = (message: string, type: "success" | "info" | "warn" = "info") => {
  const win = getWindowRef();
  if (typeof win.showToast === "function") {
    win.showToast(message, type);
    return;
  }

  const existing = document.getElementById("legacy-toast");
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement("div");
  toast.id = "legacy-toast";
  toast.textContent = message;
  toast.style.position = "fixed";
  toast.style.right = "24px";
  toast.style.bottom = "24px";
  toast.style.zIndex = "9999";
  toast.style.maxWidth = "320px";
  toast.style.padding = "14px 18px";
  toast.style.borderRadius = "14px";
  toast.style.background = type === "success" ? "#111827" : type === "warn" ? "#7c2d12" : "#1e3a8a";
  toast.style.color = "#ffffff";
  toast.style.boxShadow = "0 16px 40px rgba(15, 23, 42, 0.25)";
  toast.style.font = "600 14px Inter, sans-serif";
  document.body.appendChild(toast);

  window.setTimeout(() => toast.remove(), 3200);
};

const replaceInteractiveElement = <T extends Element>(element: T | null): T | null => {
  if (!element?.parentNode) {
    return element;
  }

  const clone = element.cloneNode(true) as T;
  if ("removeAttribute" in clone) {
    clone.removeAttribute("onclick");
    clone.removeAttribute("oninput");
    clone.removeAttribute("onchange");
    clone.removeAttribute("onkeydown");
  }

  element.parentNode.replaceChild(clone, element);
  return clone;
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(Math.max(0, value));

const createEmptyWallet = (): WalletInfo => ({
  balance_credits: 0,
  transactions: [],
});

const formatCurrency = (amountPaise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountPaise / 100);

const formatDate = (value?: string | null) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) {
    return "--";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) {
    return `${remainder}s`;
  }

  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
};

const formatTime = (value?: string | null) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatDate(value);
};

const getDashboardUrlForPage = (pageId: string) => {
  switch (pageId) {
    case "overview":
      return "/dashboard";
    case "calls":
      return "/dashboard/calls";
    case "credits":
      return "/dashboard/billing";
    default:
      return `/dashboard?tab=${encodeURIComponent(pageId)}`;
  }
};

const getDashboardPageFromLocation = () => {
  if (!isDashboardRoute()) {
    return "overview";
  }

  const pathname = window.location.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/calls")) {
    return "calls";
  }
  if (pathname.endsWith("/billing")) {
    return "credits";
  }

  const tab = new URLSearchParams(window.location.search).get("tab") || "";
  return dashboardSidebarPages.includes(tab as (typeof dashboardSidebarPages)[number]) ? tab : "overview";
};

const closeMobileDashboardMenu = () => {
  if (window.innerWidth > 768) {
    return;
  }

  const sidebar = document.querySelector<HTMLElement>(".sidebar");
  const overlay = document.querySelector<HTMLElement>(".sidebar-overlay");
  sidebar?.classList.remove("open");
  overlay?.classList.remove("active");
  if (overlay) {
    overlay.style.display = "none";
  }
};

const activateDashboardPage = (pageId: string, navItem?: HTMLElement | null) => {
  document.querySelectorAll<HTMLElement>(".page").forEach((page) => page.classList.remove("active"));
  const targetPage = document.getElementById(`page-${pageId}`);
  targetPage?.classList.add("active");

  document.querySelectorAll<HTMLElement>(".nav-item").forEach((item) => item.classList.remove("active"));
  navItem?.classList.add("active");

  if (pageId === "bookings") {
    getWindowRef().renderWeeklyCalendar?.();
  }

  closeMobileDashboardMenu();
};

const updateSidebarBadge = (pageId: "calls" | "chats", count: number) => {
  const badge = document.querySelector<HTMLElement>(`.sidebar-live-badge[data-badge-for="${pageId}"]`);
  if (!badge) {
    return;
  }

  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.style.display = "";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
};

const getUserDisplayName = (state: DashboardState) => {
  const explicitName = normalizeText(state.user?.name || "");
  if (explicitName) {
    return explicitName;
  }

  const email = normalizeText(state.user?.email || "");
  if (email.includes("@")) {
    const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "";
    if (localPart) {
      return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase());
    }
  }

  return "User";
};

const getUserInitials = (name: string) => {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "U";
  }

  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
};

const updateSidebarIdentity = (state: DashboardState) => {
  const nameNode = document.querySelector<HTMLElement>(".sidebar-user-name");
  const subtitleNode = document.querySelector<HTMLElement>(".sidebar-user-subtitle");
  const initialsNode = document.querySelector<HTMLElement>(".sidebar-user-initials");

  const displayName = getUserDisplayName(state);
  const subtitle =
    normalizeText(state.setup?.businessName || "") ||
    normalizeText(state.user?.email || "") ||
    "Business account";

  if (nameNode) {
    nameNode.textContent = displayName;
  }
  if (subtitleNode) {
    subtitleNode.textContent = subtitle;
  }
  if (initialsNode) {
    initialsNode.textContent = getUserInitials(displayName);
  }
};

const bootstrapSidebarIdentityFromSession = () => {
  const storedUser = getStoredUser();
  if (!storedUser) {
    return;
  }

  updateSidebarIdentity(
    buildDashboardState(storedUser, getWindowRef().__versaficDashboardState, {
      user: storedUser,
    })
  );
};

const bindDashboardNavigation = () => {
  const win = getWindowRef();
  const navItems = Array.from(document.querySelectorAll<HTMLElement>(".sidebar-nav .nav-item"));

  win.showPage = (pageId: string, navItem?: HTMLElement | null) => {
    const resolvedNavItem =
      navItem ||
      navItems.find((item) => item.dataset.pageId === pageId) ||
      null;

    const nextUrl = getDashboardUrlForPage(pageId);
    const targetPage = document.getElementById(`page-${pageId}`);
    if (!targetPage) {
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.location.href = nextUrl;
      }
      return;
    }

    activateDashboardPage(pageId, resolvedNavItem);
    if (pageId === "credits") {
      primeRazorpayCheckout();
    }
    void loadDashboardPageData(pageId);

    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.pushState({ pageId }, "", nextUrl);
    }
  };

  navItems.forEach((originalItem, index) => {
    const pageId = dashboardSidebarPages[index] || "overview";
    const item = replaceInteractiveElement(originalItem);
    if (!item) {
      return;
    }

    item.dataset.pageId = pageId;
    const href = getDashboardUrlForPage(pageId);
    const link = item.querySelector<HTMLAnchorElement>("a");
    if (link) {
      link.setAttribute("href", href);
    }

    const handleClick = (event: Event) => {
      event.preventDefault();
      win.showPage?.(pageId, item);
    };

    item.addEventListener("click", handleClick);
  });

  if (!win.__versaficDashboardPopstateBound) {
    window.addEventListener("popstate", () => {
      if (!isDashboardRoute()) {
        return;
      }

      const pageId = getDashboardPageFromLocation();
      const navItem =
        Array.from(document.querySelectorAll<HTMLElement>(".sidebar-nav .nav-item")).find(
          (item) => item.dataset.pageId === pageId
        ) || null;
      activateDashboardPage(pageId, navItem);
    });

    win.__versaficDashboardPopstateBound = true;
  }

  const initialPageId = getDashboardPageFromLocation();
  const initialNavItem =
    Array.from(document.querySelectorAll<HTMLElement>(".sidebar-nav .nav-item")).find(
      (item) => item.dataset.pageId === initialPageId
    ) || null;

  activateDashboardPage(initialPageId, initialNavItem);
};

const escapeHtml = (value?: string | number | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeText = (value?: string | null) => value?.trim() || "";

const blockedEmailDomains = new Set([
  "10minutemail.com",
  "dispostable.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
]);
const reservedEmailDomains = new Set([
  "example.com",
  "example.net",
  "example.org",
  "localhost",
  "localhost.localdomain",
]);
const reservedEmailSuffixes = [".example", ".invalid", ".localhost", ".local", ".test", ".internal"];
const emailValidationCache = new Map<string, string | null>();
let emailValidationRequestId = 0;
let emailValidationDebounceTimer: number | null = null;

const emailLooksDisposable = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase().trim() || "";
  return Array.from(blockedEmailDomains).some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
};

const emailLooksReserved = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase().trim() || "";
  return reservedEmailDomains.has(domain) || reservedEmailSuffixes.some((suffix) => domain.endsWith(suffix));
};

const getEmailValidationMessage = (email: string) => {
  const normalized = normalizeText(email).toLowerCase();
  if (!normalized) {
    return "Email is required.";
  }

  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailPattern.test(normalized)) {
    return "Enter a valid email address.";
  }

  if (emailLooksDisposable(normalized)) {
    return "Use a genuine business or personal email address.";
  }

  if (emailLooksReserved(normalized)) {
    return "Use an email from a real, active domain.";
  }

  return null;
};

const getResolvedEmailValidationMessage = (email: string) => {
  const normalized = normalizeText(email).toLowerCase();
  const localMessage = getEmailValidationMessage(normalized);
  if (localMessage) {
    return localMessage;
  }

  if (emailValidationCache.has(normalized)) {
    return emailValidationCache.get(normalized) || null;
  }

  return null;
};

const validateEmailAgainstBackend = async (
  emailInput: HTMLInputElement | null,
  options?: {
    showErrors?: boolean;
  }
) => {
  const normalized = normalizeText(emailInput?.value).toLowerCase();
  const localMessage = getEmailValidationMessage(normalized);

  if (!emailInput) {
    return {
      valid: false,
      message: "Email is required.",
    };
  }

  if (localMessage) {
    if (options?.showErrors ?? true) {
      setFieldValidationState(emailInput, localMessage, { messageKey: "email" });
    }
    return {
      valid: false,
      message: localMessage,
    };
  }

  if (emailValidationCache.has(normalized)) {
    const cachedMessage = emailValidationCache.get(normalized) || null;
    if (options?.showErrors ?? true) {
      setFieldValidationState(emailInput, cachedMessage, { messageKey: "email" });
    }
    return {
      valid: !cachedMessage,
      message: cachedMessage,
    };
  }

  const requestId = ++emailValidationRequestId;

  try {
    const result = await validateRegistrableEmail(normalized);
    const message = result.valid ? null : result.error || "Use an email from a real, active domain.";
    emailValidationCache.set(normalized, message);

    if ((options?.showErrors ?? true) && normalizeText(emailInput.value).toLowerCase() === normalized && requestId === emailValidationRequestId) {
      setFieldValidationState(emailInput, message, { messageKey: "email" });
    }

    return {
      valid: !message,
      message,
    };
  } catch (error) {
    const message =
      error instanceof LegacyApiError ? error.message : "We couldn't verify this email right now.";

    if ((options?.showErrors ?? true) && normalizeText(emailInput.value).toLowerCase() === normalized && requestId === emailValidationRequestId) {
      setFieldValidationState(emailInput, message, { messageKey: "email" });
    }

    return {
      valid: false,
      message,
    };
  }
};

const normalizePhoneForValidation = (countryCode: string | null, prefix: string, localNumber: string) => {
  const rawPrefix = normalizeText(prefix);
  const rawNumber = normalizeText(localNumber);
  const digitsOnly = rawNumber.replace(/\D/g, "");
  const prefixDigits = rawPrefix.replace(/[^\d+]/g, "");

  if ((countryCode || "").toUpperCase() === "IN") {
    return digitsOnly;
  }

  return `${prefixDigits}${digitsOnly}`;
};

const getPhoneValidationMessage = (phone: string, countryCode?: string | null) => {
  const trimmed = normalizeText(phone);
  if (!trimmed) {
    return "Phone number is required.";
  }

  const digits = trimmed.replace(/\D/g, "");
  const normalizedCountry = (countryCode || "").toUpperCase();

  if (normalizedCountry === "IN" || trimmed.startsWith("+91") || digits.startsWith("91")) {
    if (!/^[6-9]\d{9}$/.test(digits.slice(-10))) {
      return "Indian mobile numbers must have exactly 10 digits.";
    }

    return null;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(trimmed.replace(/\s+/g, ""))) {
    return "Enter a valid international phone number with country code.";
  }

  return null;
};

const INVALID_FIELD_BORDER = "#ef4444";
const DEFAULT_FIELD_BORDER = "var(--border-color)";
const ONBOARDING_PASSWORD_MIN_LENGTH = 8;

type OnboardingValidationResult = {
  valid: boolean;
  focusTarget?: HTMLElement | null;
};

const ensureOnboardingValidationStyle = () => {
  if (document.getElementById("versafic-onboarding-validation-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "versafic-onboarding-validation-style";
  style.textContent = `
    .input-field.versafic-invalid {
      border-color: #ef4444 !important;
    }
    .phone-group.versafic-invalid .input-field,
    #handleWrap.versafic-invalid {
      border-color: #ef4444 !important;
    }
    .validation-msg.versafic-active {
      display: block !important;
    }
  `;
  document.head.appendChild(style);
};

const getOrCreateValidationMessage = (host: HTMLElement, key: string) => {
  const existing = host.querySelector<HTMLElement>(`.validation-msg[data-validation-key="${key}"]`);
  if (existing) {
    return existing;
  }

  const message = document.createElement("div");
  message.className = "validation-msg";
  message.dataset.validationKey = key;
  host.appendChild(message);
  return message;
};

const setFieldValidationState = (
  target: HTMLElement | null,
  message: string | null,
  options?: {
    messageHost?: HTMLElement | null;
    messageKey?: string;
    relatedTargets?: Array<HTMLElement | null>;
  }
) => {
  if (!target) {
    return;
  }

  const relatedTargets = [target, ...(options?.relatedTargets || []).filter(Boolean)] as HTMLElement[];
  const messageHost = (options?.messageHost || target.closest(".form-group") || target.parentElement) as HTMLElement | null;
  const messageKey = options?.messageKey || target.id || "default";
  const validationMessage = messageHost ? getOrCreateValidationMessage(messageHost, messageKey) : null;

  if (message) {
    relatedTargets.forEach((node) => {
      node.classList.add("versafic-invalid");
      if (node instanceof HTMLElement) {
        node.style.borderColor = INVALID_FIELD_BORDER;
      }
    });

    if (validationMessage) {
      validationMessage.textContent = message;
      validationMessage.classList.add("versafic-active");
    }
    return;
  }

  relatedTargets.forEach((node) => {
    node.classList.remove("versafic-invalid");
    if (node instanceof HTMLElement) {
      node.style.borderColor = DEFAULT_FIELD_BORDER;
    }
  });

  if (validationMessage) {
    validationMessage.textContent = "";
    validationMessage.classList.remove("versafic-active");
  }
};

const validatePasswordStrength = (password: string) => {
  if (!password) {
    return "Password is required";
  }
  if (password.length < ONBOARDING_PASSWORD_MIN_LENGTH) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include a number";
  }
  if (!/[!@#$%^&*(),.?\":{}|<>_\-\\[\]/`~+=;]/.test(password)) {
    return "Password must include a special character";
  }

  return null;
};

const validateFullNameValue = (value: string) => {
  if (!value) {
    return "Username is required";
  }
  if (value.length < 3) {
    return "Username must be at least 3 characters";
  }
  return null;
};

const validateBusinessNameValue = (value: string, label: string) => {
  if (!value) {
    return `${label} is required`;
  }
  if (value.length < 3) {
    return `${label} must be at least 3 characters`;
  }
  return null;
};

const validateIndianPhoneInput = (rawPhone: string) => {
  if (!rawPhone) {
    return "Phone number is required";
  }

  if (!/^[6-9][0-9]{9}$/.test(rawPhone)) {
    return "Enter a valid 10-digit Indian phone number";
  }

  return null;
};

const prepareOnboardingFieldReferences = () => {
  const stepTwo = document.getElementById("step-2");
  const phoneInputs = Array.from(stepTwo?.querySelectorAll<HTMLInputElement>(".phone-group .input-field") || []);
  const phoneInput = phoneInputs[1] || null;
  if (phoneInput && !phoneInput.id) {
    phoneInput.id = "phoneNumberInput";
  }

  const timezoneSelect = document.getElementById("timezoneSelect") as HTMLSelectElement | null;
  if (timezoneSelect && !timezoneSelect.id) {
    timezoneSelect.id = "timezoneSelect";
  }

  return {
    phoneInput,
    phoneGroup: stepTwo?.querySelector<HTMLElement>(".phone-group") || null,
  };
};

const getActiveOnboardingAccountType = () =>
  document.querySelector<HTMLElement>(".acc-type.active .card-text")?.textContent?.trim() || "Business";

const getActiveOnboardingSubcategory = () =>
  document.querySelector<HTMLElement>("#bus-sub-categories .tag-pill.active, #per-sub-categories .tag-pill.active")
    ?.textContent?.trim() || "";

const isOtherOnboardingCategory = () => getActiveOnboardingSubcategory().toLowerCase() === "other";

const getEffectiveOnboardingCategory = () => {
  const selected = getActiveOnboardingSubcategory();
  const customDescription = normalizeText(
    (document.getElementById("customDescriptionInput") as HTMLInputElement | null)?.value
  );

  if (selected.toLowerCase() === "other" && customDescription) {
    return customDescription;
  }

  return selected || getActiveOnboardingAccountType();
};

const syncOnboardingConditionalFields = () => {
  const accountType = getActiveOnboardingAccountType();
  const isBusiness = accountType.toLowerCase() === "business";
  const dynamicNameFields = document.getElementById("dynamic-name-fields") as HTMLElement | null;
  const customDescriptionGroup = document.getElementById("customDescriptionGroup") as HTMLElement | null;
  const profileNameLabel = document.getElementById("profileNameLabel") as HTMLElement | null;
  const profileNameInput = document.getElementById("profileNameInput") as HTMLInputElement | null;

  if (dynamicNameFields) {
    dynamicNameFields.style.display = isBusiness ? "" : "none";
  }

  if (customDescriptionGroup) {
    customDescriptionGroup.style.display = isOtherOnboardingCategory() ? "" : "none";
  }

  if (profileNameLabel) {
    profileNameLabel.textContent = isBusiness ? "Business Name" : "Personal Name";
  }

  if (profileNameInput) {
    profileNameInput.placeholder = isBusiness ? "e.g. Grand Horizon Hotel" : "e.g. Alex Johnson";
  }
};

const isOnboardingHandleAvailable = () => {
  const handleStatus = document.getElementById("handleStatus");
  return handleStatus?.textContent?.toLowerCase().includes("available") ?? false;
};

const getActiveOnboardingStepId = () => document.querySelector(".step-content.active")?.id || "step-1";

const syncOnboardingNextButton = (isValid: boolean) => {
  const nextButton = document.getElementById("btnNext") as HTMLButtonElement | null;
  if (!nextButton) {
    return;
  }

  nextButton.dataset.stepValid = isValid ? "true" : "false";

  if (nextButton.dataset.busy === "true") {
    nextButton.disabled = true;
    nextButton.style.opacity = "0.5";
    nextButton.style.cursor = "not-allowed";
    return;
  }

  nextButton.disabled = false;
  nextButton.style.opacity = "1";
  nextButton.style.cursor = "pointer";
};

const validateOnboardingStep = (
  stepId: string,
  options?: {
    showErrors?: boolean;
  }
): OnboardingValidationResult => {
  const showErrors = options?.showErrors ?? true;

  const fullNameInput = document.getElementById("fullName") as HTMLInputElement | null;
  const emailInput = document.getElementById("accountEmail") as HTMLInputElement | null;
  const passwordInput = document.getElementById("accountPassword") as HTMLInputElement | null;
  const countrySelect = document.getElementById("countrySelect") as HTMLSelectElement | null;
  const timezoneSelect = document.getElementById("timezoneSelect") as HTMLSelectElement | null;
  const phonePrefixInput = document.getElementById("phonePrefix") as HTMLInputElement | null;
  const phoneInput = document.getElementById("phoneNumberInput") as HTMLInputElement | null;
  const phoneGroup = document.querySelector<HTMLElement>("#step-2 .phone-group");
  const dynamicNameInput = document.getElementById("dynamic-name-input") as HTMLInputElement | null;
  const dobInput = document.getElementById("dobInput") as HTMLInputElement | null;
  const customDescriptionInput = document.getElementById("customDescriptionInput") as HTMLInputElement | null;
  const customDescriptionGroup = document.getElementById("customDescriptionGroup") as HTMLElement | null;
  const profileNameInput = document.getElementById("profileNameInput") as HTMLInputElement | null;
  const handleInput = document.getElementById("handleInput") as HTMLInputElement | null;
  const handleWrap = document.getElementById("handleWrap") as HTMLElement | null;
  const activePlan = document.querySelector<HTMLElement>("#step-7 .plan-type.active");
  const accountType = getActiveOnboardingAccountType();
  const isBusinessAccount = accountType.toLowerCase() === "business";

  const errors: Array<{ target: HTMLElement | null; message: string; apply: () => void }> = [];

  if (stepId === "step-1") {
    const fullNameMessage = validateFullNameValue(normalizeText(fullNameInput?.value));
    if (fullNameMessage) {
      errors.push({
        target: fullNameInput,
        message: fullNameMessage,
        apply: () => setFieldValidationState(fullNameInput, fullNameMessage, { messageKey: "full-name" }),
      });
    } else if (showErrors) {
      setFieldValidationState(fullNameInput, null, { messageKey: "full-name" });
    }

    const emailMessage = getResolvedEmailValidationMessage(normalizeText(emailInput?.value));
    if (emailMessage) {
      errors.push({
        target: emailInput,
        message: emailMessage,
        apply: () => setFieldValidationState(emailInput, emailMessage, { messageKey: "email" }),
      });
    } else if (showErrors) {
      setFieldValidationState(emailInput, null, { messageKey: "email" });
    }

    const passwordMessage = validatePasswordStrength(normalizeText(passwordInput?.value));
    if (passwordMessage) {
      errors.push({
        target: passwordInput,
        message: passwordMessage,
        apply: () => setFieldValidationState(passwordInput, passwordMessage, { messageKey: "password" }),
      });
    } else if (showErrors) {
      setFieldValidationState(passwordInput, null, { messageKey: "password" });
    }
  }

  if (stepId === "step-2") {
    const normalizedPhone = normalizeText(phoneInput?.value).replace(/\D/g, "");
    const phoneMessage =
      (countrySelect?.value || "IN") === "IN"
        ? validateIndianPhoneInput(normalizedPhone)
        : getPhoneValidationMessage(
            normalizePhoneForValidation(countrySelect?.value || null, phonePrefixInput?.value || "", phoneInput?.value || ""),
            countrySelect?.value || null
          );

    if (phoneMessage) {
      errors.push({
        target: phoneInput,
        message: phoneMessage,
        apply: () =>
          setFieldValidationState(phoneGroup, phoneMessage, {
            messageHost: phoneGroup?.closest(".form-group") as HTMLElement | null,
            messageKey: "phone",
            relatedTargets: [phonePrefixInput, phoneInput],
          }),
      });
    } else if (showErrors) {
      setFieldValidationState(phoneGroup, null, {
        messageHost: phoneGroup?.closest(".form-group") as HTMLElement | null,
        messageKey: "phone",
        relatedTargets: [phonePrefixInput, phoneInput],
      });
    }

    const timezoneMessage = normalizeText(timezoneSelect?.value) ? null : "Time zone is required";
    if (timezoneMessage) {
      errors.push({
        target: timezoneSelect,
        message: timezoneMessage,
        apply: () => setFieldValidationState(timezoneSelect, timezoneMessage, { messageKey: "timezone" }),
      });
    } else if (showErrors) {
      setFieldValidationState(timezoneSelect, null, { messageKey: "timezone" });
    }
  }

  if (stepId === "step-3") {
    if (isBusinessAccount) {
      const ownerMessage = validateFullNameValue(normalizeText(dynamicNameInput?.value));
      if (ownerMessage) {
        errors.push({
          target: dynamicNameInput,
          message: ownerMessage.replace("Username", "Name"),
          apply: () =>
            setFieldValidationState(dynamicNameInput, ownerMessage.replace("Username", "Name"), { messageKey: "dynamic-name" }),
        });
      } else if (showErrors) {
        setFieldValidationState(dynamicNameInput, null, { messageKey: "dynamic-name" });
      }
    } else if (showErrors) {
      setFieldValidationState(dynamicNameInput, null, { messageKey: "dynamic-name" });
    }

    if (isOtherOnboardingCategory()) {
      const descriptionMessage = validateBusinessNameValue(
        normalizeText(customDescriptionInput?.value),
        "Custom description"
      );
      if (descriptionMessage) {
        errors.push({
          target: customDescriptionInput,
          message: descriptionMessage,
          apply: () =>
            setFieldValidationState(customDescriptionInput, descriptionMessage, {
              messageHost: customDescriptionGroup,
              messageKey: "custom-description",
            }),
        });
      } else if (showErrors) {
        setFieldValidationState(customDescriptionInput, null, {
          messageHost: customDescriptionGroup,
          messageKey: "custom-description",
        });
      }
    } else if (showErrors) {
      setFieldValidationState(customDescriptionInput, null, {
        messageHost: customDescriptionGroup,
        messageKey: "custom-description",
      });
    }

    let dobMessage: string | null = null;
    const dobValue = normalizeText(dobInput?.value);
    if (!dobValue) {
      dobMessage = "Date of birth is required";
    } else {
      const dob = new Date(dobValue);
      const now = new Date();
      if (Number.isNaN(dob.getTime()) || dob > now) {
        dobMessage = "Enter a valid date of birth";
      }
    }

    if (dobMessage) {
      errors.push({
        target: dobInput,
        message: dobMessage,
        apply: () => setFieldValidationState(dobInput, dobMessage, { messageKey: "dob" }),
      });
    } else if (showErrors) {
      setFieldValidationState(dobInput, null, { messageKey: "dob" });
    }
  }

  if (stepId === "step-4") {
    const profileNameMessage = validateBusinessNameValue(normalizeText(profileNameInput?.value), "Business / Personal name");
    if (profileNameMessage) {
      errors.push({
        target: profileNameInput,
        message: profileNameMessage,
        apply: () => setFieldValidationState(profileNameInput, profileNameMessage, { messageKey: "profile-name" }),
      });
    } else if (showErrors) {
      setFieldValidationState(profileNameInput, null, { messageKey: "profile-name" });
    }

    let handleMessage: string | null = null;
    const handleValue = normalizeText(handleInput?.value);
    if (!handleValue) {
      handleMessage = "Versafic handle is required";
    } else if (!/^[a-z0-9_-]{3,}$/.test(handleValue)) {
      handleMessage = "Handle must be at least 3 characters and use only lowercase letters, numbers, hyphens, or underscores";
    } else if (!(window as unknown as RazorpayWindow).__versaficOnboardingAccountCreated && !isOnboardingHandleAvailable()) {
      handleMessage = "Choose an available handle to continue";
    }

    if (handleMessage) {
      errors.push({
        target: handleWrap,
        message: handleMessage,
        apply: () =>
          setFieldValidationState(handleWrap, handleMessage, {
            messageHost: handleWrap?.closest(".form-group") as HTMLElement | null,
            messageKey: "handle",
          }),
      });
    } else if (showErrors) {
      setFieldValidationState(handleWrap, null, {
        messageHost: handleWrap?.closest(".form-group") as HTMLElement | null,
        messageKey: "handle",
      });
    }
  }

  if (stepId === "step-7") {
    if (!activePlan) {
      const step = document.getElementById("step-7");
      const host = step?.querySelector("div[style*='display:flex; flex-direction:column; gap:16px;']") as HTMLElement | null;
      const message = "Select a credit plan to continue";
      errors.push({
        target: host,
        message,
        apply: () =>
          setFieldValidationState(host, message, {
            messageHost: host?.parentElement,
            messageKey: "plan",
          }),
      });
    } else if (showErrors) {
      const step = document.getElementById("step-7");
      const host = step?.querySelector("div[style*='display:flex; flex-direction:column; gap:16px;']") as HTMLElement | null;
      setFieldValidationState(host, null, {
        messageHost: host?.parentElement,
        messageKey: "plan",
      });
    }
  }

  if (showErrors) {
    if (errors.length) {
      errors.forEach((entry) => entry.apply());
    }
  }

  return {
    valid: errors.length === 0,
    focusTarget: errors[0]?.target || null,
  };
};

const inferIntentLabel = (value?: string | null) => {
  const text = normalizeText(value).toLowerCase();
  if (!text) {
    return "Support";
  }
  if (text.includes("book") || text.includes("reserve")) {
    return "Bookings";
  }
  if (text.includes("appoint") || text.includes("schedule")) {
    return "Appointments";
  }
  if (text.includes("support") || text.includes("issue") || text.includes("help")) {
    return "Customer Support";
  }
  if (text.includes("recommend")) {
    return "Recommendation";
  }
  if (text.includes("lead")) {
    return "Lead Generation";
  }
  if (text.includes("info") || text.includes("price") || text.includes("hours")) {
    return "Information Retrieval";
  }
  return "Inquiry Resolution";
};

const getRegionLabel = (phone?: string | null) => {
  const normalized = normalizeText(phone);
  if (normalized.startsWith("+91")) return "India";
  if (normalized.startsWith("+1")) return "North America";
  if (normalized.startsWith("+44")) return "United Kingdom";
  if (normalized.startsWith("+61")) return "Australia";
  if (normalized.startsWith("+971")) return "Middle East";
  if (normalized.startsWith("+65")) return "Singapore";
  return "Other";
};

const matchesDateFilter = (value: string | undefined | null, filterKey: string) => {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const normalized = filterKey.trim().toUpperCase();
  const presets: Record<string, number | null> = {
    "1 DAY": 1,
    "7D": 7,
    "30 DAY": 30,
    "90 DAY": 90,
    "180 DAY": 180,
    "1 YEAR": 365,
    "2 YEAR": 730,
    MAX: null,
  };

  const days = presets[normalized];
  if (days == null) {
    return true;
  }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
};

const slugKind = (value: string): BusinessKind => {
  const normalized = value.toLowerCase();

  if (normalized.includes("hotel") || normalized.includes("resort")) {
    return "hotel";
  }
  if (normalized.includes("restaurant") || normalized.includes("cafe")) {
    return "restaurant";
  }
  if (normalized.includes("clinic") || normalized.includes("health")) {
    return "clinic";
  }
  if (normalized.includes("barber") || normalized.includes("salon")) {
    return "barber";
  }
  if (normalized.includes("creator") || normalized.includes("influencer")) {
    return "creator";
  }
  if (normalized.includes("agency")) {
    return "agency";
  }

  return "consultant";
};

const buildBusinessHandle = (business: BusinessRecord) =>
  `@${business.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^@+/, "") || "versafic"}`;

const buildDirectoryStatus = (business: BusinessRecord, kind: BusinessKind) => {
  const createdAt = business.created_at ? new Date(business.created_at).getTime() : 0;
  const ageDays = createdAt ? Math.max(0, Math.floor((Date.now() - createdAt) / 86400000)) : null;

  if (ageDays !== null && ageDays <= 30) {
    return {
      value: "NEW",
      label: "New Listing",
      subtext: "Recently added to the live Versafic directory",
    };
  }

  if (kind === "creator") {
    return {
      value: "LIVE",
      label: "Creator Listing",
      subtext: "Available for inbound AI enquiries through the directory",
    };
  }

  return {
    value: "LIVE",
    label: "Directory Listing",
    subtext: "Published on the live Versafic business directory",
  };
};

const buildDirectoryDescription = (business: BusinessRecord, kind: BusinessKind) => {
  const serviceLabel = inferIntentLabel(business.business_type).toLowerCase();
  const owner = normalizeText(business.owner_name);

  if (kind === "creator") {
    return `${business.business_name} is available on Versafic for collaboration requests, AI call support, and creator enquiries handled by ${owner || "the account owner"}.`;
  }

  return `${business.business_name} is listed on Versafic for ${serviceLabel}, AI-assisted phone support, and customer follow-ups managed by ${owner || "the business owner"}.`;
};

const buildDirectoryBusiness = (business: BusinessRecord): DirectoryBusiness => {
  const kind = slugKind(`${business.business_type} ${business.business_name}`);
  const presets: Record<
    BusinessKind,
    {
      emoji: string;
      badgeClass: string;
      badgeText: string;
      accentTint: string;
      aiLabels: string[];
    }
  > = {
    hotel: {
      emoji: "🏨",
      badgeClass: "badge-blue",
      badgeText: "✓ Listed",
      accentTint: "rgba(59,130,246,0.18)",
      aiLabels: ["📅 Bookings", "🛎️ Support", "📞 Calls"],
    },
    restaurant: {
      emoji: "🍽️",
      badgeClass: "badge-green",
      badgeText: "✓ Listed",
      accentTint: "rgba(16,185,129,0.18)",
      aiLabels: ["📅 Reservations", "🍷 Menus", "📞 Calls"],
    },
    clinic: {
      emoji: "🏥",
      badgeClass: "badge-green",
      badgeText: "✓ Listed",
      accentTint: "rgba(16,185,129,0.18)",
      aiLabels: ["📅 Appointments", "💊 Support", "📞 Calls"],
    },
    barber: {
      emoji: "✂️",
      badgeClass: "badge-blue",
      badgeText: "✓ Listed",
      accentTint: "rgba(59,130,246,0.18)",
      aiLabels: ["📅 Appointments", "✂️ Services", "📞 Calls"],
    },
    creator: {
      emoji: "📸",
      badgeClass: "badge-purple",
      badgeText: "✓ Creator",
      accentTint: "rgba(139,92,246,0.18)",
      aiLabels: ["🤝 Collaborations", "💬 Inquiries", "📞 Calls"],
    },
    consultant: {
      emoji: "💼",
      badgeClass: "badge-cyan",
      badgeText: "✓ Listed",
      accentTint: "rgba(6,182,212,0.18)",
      aiLabels: ["📅 Consultations", "💼 Intake", "📞 Calls"],
    },
    agency: {
      emoji: "🚀",
      badgeClass: "badge-cyan",
      badgeText: "✓ Listed",
      accentTint: "rgba(6,182,212,0.18)",
      aiLabels: ["📋 Discovery", "🤝 Leads", "📞 Calls"],
    },
  };

  const preset = presets[kind];
  const status = buildDirectoryStatus(business, kind);
  const listedOn = formatDate(business.created_at || business.updated_at || null);
  const ownerName = normalizeText(business.owner_name) || "Owner not shared";

  return {
    ...business,
    kind,
    emoji: preset.emoji,
    badgeClass: preset.badgeClass,
    badgeText: preset.badgeText,
    accentTint: preset.accentTint,
    listingContext: listedOn === "--" ? "Live on Versafic" : `Listed ${listedOn}`,
    primaryMeta: `👤 ${ownerName}`,
    statusValue: status.value,
    statusLabel: status.label,
    statusSubtext: status.subtext,
    aiLabels: preset.aiLabels,
    description: buildDirectoryDescription(business, kind),
    handle: buildBusinessHandle(business),
  };
};

const buildHomePriceFeatures = (plan: BillingPlan, index: number) => {
  const base = [
    `${formatNumber(plan.credits)} wallet credits`,
    "Razorpay checkout enabled",
    "Live call and chat usage tracking",
    "Directory listing and dashboard access",
  ];

  if (index === 0) {
    return [...base, "Quick start for smaller teams"];
  }

  if (index === 1) {
    return [...base, "Best fit for active customer-support teams"];
  }

  return [...base, "Higher-volume top-up for expanding operations"];
};

const updateHomePricing = (plans: BillingPlan[]) => {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(".pricing-grid .price-card"));
  if (!cards.length || !plans.length) {
    return;
  }

  plans.slice(0, cards.length).forEach((plan, index) => {
    const card = cards[index];
    const tier = card.querySelector(".price-tier");
    const amount = card.querySelector(".price-amount");
    const period = card.querySelector(".price-period");
    const features = card.querySelector(".price-feats");
    const cta = card.querySelector<HTMLAnchorElement>("a.btn");

    if (tier) {
      tier.textContent = plan.name;
    }
    if (amount) {
      amount.textContent = formatCurrency(plan.amount_paise);
    }
    if (period) {
      period.textContent = `${formatNumber(plan.credits)} credits · live wallet top-up`;
    }
    if (features) {
      features.innerHTML = buildHomePriceFeatures(plan, index)
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join("");
    }
    if (cta) {
      cta.href = "/onboarding";
    }
  });

  cards.slice(plans.length).forEach((card) => {
    card.style.display = "none";
  });
};

const updateHomeDirectoryPreview = (businesses: DirectoryBusiness[]) => {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(".result-row"));
  rows.slice(0, 2).forEach((row, index) => {
    const business = businesses[index];
    if (!business) {
      row.style.display = "none";
      return;
    }

    row.style.display = "";
    row.onclick = () => {
      window.location.href = `/profile/${business.id}`;
    };
    row.innerHTML = `
      <div class="result-avi" style="background:${business.accentTint}">${business.emoji}</div>
      <div>
        <div class="r-name">${escapeHtml(business.business_name)} <span class="r-badge ${escapeHtml(
          business.badgeClass === "badge-purple" ? "badge-c" : "badge-v"
        )}">${escapeHtml(business.badgeText)}</span></div>
        <div class="r-cat">${escapeHtml(business.business_type)} · ${escapeHtml(business.listingContext)}</div>
      </div>
      <div class="ml-auto"><button class="btn btn-ghost btn-sm" style="font-size:0.78rem">View profile →</button></div>
    `;
  });
};

const updateHomeStats = (businesses: DirectoryBusiness[], plans: BillingPlan[], publicCallConfig: Awaited<ReturnType<typeof getPublicCallConfig>> | null) => {
  const statValues = Array.from(document.querySelectorAll<HTMLElement>(".stats-row .stat-num"));
  const statLabels = Array.from(document.querySelectorAll<HTMLElement>(".stats-row .stat-lbl"));
  if (statValues.length < 4 || statLabels.length < 4) {
    return;
  }

  const phoneListed = businesses.filter((business) => normalizeText(business.phone)).length;
  const creatorCount = businesses.filter((business) => business.kind === "creator").length;

  statValues[0].textContent = formatNumber(businesses.length);
  statLabels[0].textContent = "Businesses live";
  statValues[1].textContent = formatNumber(plans.length);
  statLabels[1].textContent = "Credit packs";
  statValues[2].textContent = publicCallConfig?.ai_number ? "Live" : "Offline";
  statLabels[2].textContent = "AI line status";
  statValues[3].textContent = formatNumber(Math.max(phoneListed, creatorCount));
  statLabels[3].textContent = "Public listings";
};

const resetRazorpayLoader = () => {
  razorpayLoader = null;
  document.querySelectorAll<HTMLScriptElement>(RAZORPAY_SCRIPT_SELECTOR).forEach((script) => script.remove());
  delete getWindowRef().Razorpay;
};

const loadRazorpayScript = () =>
  new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(RAZORPAY_SCRIPT_SELECTOR);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.onload = null;
      script.onerror = null;
    };
    const fail = (message: string) => {
      cleanup();
      script.remove();
      reject(new Error(message));
    };
    const timeoutId = window.setTimeout(() => fail("Razorpay is taking too long to load."), RAZORPAY_LOAD_TIMEOUT_MS);

    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => {
      cleanup();
      if (getWindowRef().Razorpay) {
        resolve();
        return;
      }
      fail("Razorpay loaded without initializing checkout.");
    };
    script.onerror = () => fail("Razorpay failed to load.");
    document.head.appendChild(script);
  });

const ensureRazorpay = async () => {
  const win = getWindowRef();
  if (win.Razorpay) {
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      if (!razorpayLoader) {
        razorpayLoader = loadRazorpayScript().catch((error) => {
          razorpayLoader = null;
          throw error;
        });
      }

      await razorpayLoader;
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Razorpay checkout is unavailable.");
      resetRazorpayLoader();
    }
  }

  throw lastError || new Error("Razorpay checkout is unavailable.");
};

const openCheckout = async (planPayload: {
  planId?: string;
  amountPaise?: number;
  credits?: number;
  onSuccess?: () => Promise<void> | void;
}) => {
  showToast("Preparing Razorpay checkout...", "info");
  await ensureRazorpay();

  const order = await createOrder({
    plan_id: planPayload.planId,
    amount_paise: planPayload.amountPaise,
    credits: planPayload.credits,
  });

  const win = getWindowRef();
  const RazorpayCheckout = win.Razorpay;
  if (!RazorpayCheckout) {
    throw new Error("Razorpay checkout is unavailable");
  }

  await new Promise<void>((resolve, reject) => {
    const checkout = new RazorpayCheckout({
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.order_id,
      handler: async (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await verifyPayment(response);
          await planPayload.onSuccess?.();
          showToast("Payment confirmed and credits added.", "success");
          resolve();
        } catch (error) {
          reject(error);
        }
      },
      modal: {
        ondismiss: () => reject(new Error("Checkout was closed before payment completed.")),
      },
      theme: {
        color: "#6366f1",
      },
    });

    checkout.open();
  });
};

const queueDashboardRefresh = (delayMs: number = 900) => {
  if (!isDashboardRoute()) {
    return;
  }

  if (dashboardRefreshTimer) {
    window.clearTimeout(dashboardRefreshTimer);
  }

  dashboardRefreshTimer = window.setTimeout(() => {
    dashboardRefreshTimer = null;
    void refreshDashboardData();
  }, delayMs);
};

const primeRazorpayCheckout = () => {
  if (!isDashboardRoute() || getDashboardPageFromLocation() !== "credits") {
    return;
  }

  void ensureRazorpay().catch(() => {
    razorpayLoader = null;
  });
};

const computeUsageBreakdown = (wallet: WalletInfo) => {
  const totals = {
    calls: 0,
    chats: 0,
    sms: 0,
    transcripts: 0,
    used: 0,
  };

  wallet.transactions.forEach((transaction) => {
    if (transaction.type !== "usage_deduction") {
      return;
    }

    totals.used += transaction.credits;

    if (["inbound_call", "outbound_call", "voice_call", "premium_call"].includes(transaction.source)) {
      totals.calls += transaction.credits;
      return;
    }

    if (transaction.source === "ai_chat") {
      totals.chats += transaction.credits;
      return;
    }

    if (transaction.source === "sarvam_stt" || transaction.source === "recording_process") {
      totals.transcripts += transaction.credits;
      return;
    }

    totals.sms += transaction.credits;
  });

  return totals;
};

const collectPageInputs = (scope: ParentNode, selector: string) =>
  Array.from(scope.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector));

const bindHomePage = async () => {
  const session = getStoredSession();
  const isLoginRoute = location.pathname === "/login";
  if (session?.accessToken && isLoginRoute) {
    window.location.href = "/dashboard";
    return;
  }

  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  if (oauthError) {
    showToast(oauthError, "warn");
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth_error");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const modal = document.getElementById("loginModal");
  const emailInput = document.getElementById("loginEmail") as HTMLInputElement | null;
  const passwordInput = document.getElementById("loginPass") as HTMLInputElement | null;
  const loginButton = replaceInteractiveElement(
    modal?.querySelector<HTMLButtonElement>('.btn.btn-primary[style*="width:100%"]') ?? null
  );

  if (loginButton && emailInput && passwordInput) {
    loginButton.addEventListener("click", async () => {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      if (!email || !password) {
        showToast("Enter both email and password to continue.", "warn");
        return;
      }

      const originalText = loginButton.textContent;
      loginButton.textContent = "Signing in...";
      loginButton.setAttribute("disabled", "true");

      try {
        await login(email, password);
        showToast("Signed in successfully.", "success");
        window.location.href = "/dashboard";
      } catch (error) {
        const message =
          error instanceof LegacyApiError ? error.message : "Unable to sign in right now. Please try again.";
        showToast(message, "warn");
      } finally {
        loginButton.textContent = originalText || "Log in ->";
        loginButton.removeAttribute("disabled");
      }
    });

    [emailInput, passwordInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          loginButton.click();
        }
      });
    });
  }

  const socialButtons = Array.from(modal?.querySelectorAll<HTMLElement>(".social-btn") || []);
  socialButtons.forEach((button) => {
    button.style.display = "";

    const provider = button.textContent?.toLowerCase().includes("github") ? "github" : "google";
    const interactiveButton = replaceInteractiveElement(button);
    interactiveButton?.addEventListener("click", () => {
      window.location.href = getOAuthStartUrl(provider);
    });
  });
  const dividerRow = modal?.querySelector<HTMLElement>(".divider-row");
  if (dividerRow) {
    dividerRow.style.display = "";
  }

  const loadPublicHomepageData = async () => {
    const [planResponse, publicCallConfig] = await Promise.all([
      getPlans(),
      getPublicCallConfig().catch(() => null),
    ]);

    updateHomePricing(planResponse.plans);
    updateHomeStats([], planResponse.plans, publicCallConfig);

    window.setTimeout(() => {
      void getBusinessList(12)
        .then((items) => {
          const businesses = items.map(buildDirectoryBusiness);
          updateHomeDirectoryPreview(businesses);
          updateHomeStats(businesses, planResponse.plans, publicCallConfig);
        })
        .catch((error) => {
          console.error("Failed to load live homepage directory preview", error);
        });
    }, 80);
  };

  const runPublicLoad = () => {
    void loadPublicHomepageData().catch((error) => {
      console.error("Failed to load live homepage data", error);
    });
  };

  if (isLoginRoute) {
    window.setTimeout(runPublicLoad, 900);
    return;
  }

  runPublicLoad();
};

const injectOnboardingPasswordField = () => {
  const stepOne = document.getElementById("step-1");
  if (!stepOne || document.getElementById("accountPassword")) {
    return;
  }

  const groups = stepOne.querySelectorAll(".form-group");
  const emailGroup = groups[1];
  if (!emailGroup) {
    return;
  }

  const emailInput = emailGroup.querySelector<HTMLInputElement>('input[type="email"]');
  if (emailInput && !emailInput.id) {
    emailInput.id = "accountEmail";
  }

  const wrapper = document.createElement("div");
  wrapper.className = "form-group";
  wrapper.innerHTML = `
    <label class="input-label">Password</label>
    <input type="password" id="accountPassword" class="input-field" placeholder="Create a strong password">
  `;
  emailGroup.insertAdjacentElement("afterend", wrapper);
};

const getSelectedPlanIdFromOnboarding = () => {
  const activePlan = document.querySelector<HTMLElement>("#step-7 .plan-type.active");
  const explicitPlanId = activePlan?.dataset.planId;
  if (explicitPlanId) {
    return explicitPlanId;
  }

  const label = activePlan?.querySelector(".card-text")?.textContent?.trim().toLowerCase();
  if (label?.includes("starter")) {
    return "starter";
  }
  if (label?.includes("max")) {
    return "pro";
  }

  return "growth";
};

const patchOnboardingPlans = async () => {
  const planCards = Array.from(document.querySelectorAll<HTMLElement>("#step-7 .plan-type"));
  if (!planCards.length) {
    return;
  }

  try {
    const { plans } = await getPlans();
    plans.slice(0, planCards.length).forEach((plan, index) => {
      const card = planCards[index];
      card.dataset.planId = plan.id;

      const title = card.querySelector(".card-text");
      if (title) {
        title.textContent = plan.name;
      }

      const detail = card.querySelectorAll("div")[1];
      if (detail) {
        detail.textContent = `${formatNumber(plan.credits)} AI Credits`;
      }

      const priceNode = card.querySelectorAll("div")[2];
      if (priceNode) {
        priceNode.innerHTML = `${formatCurrency(plan.amount_paise)}<span style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">/mo</span>`;
      }
    });
  } catch (error) {
    console.error("Failed to load onboarding plans", error);
  }
};

const bindOnboardingPage = async () => {
  onboardingValidationAttemptedSteps = new Set<string>();
  ensureOnboardingValidationStyle();
  injectOnboardingPasswordField();
  prepareOnboardingFieldReferences();
  syncOnboardingConditionalFields();
  await patchOnboardingPlans();

  const win = getWindowRef();
  const originalNextStep = win.__versaficOriginalNextStep || win.nextStep;
  const originalPrevStep = win.prevStep;
  const originalUpdateUi = win.updateUI;
  if (originalNextStep) {
    win.__versaficOriginalNextStep = originalNextStep;
  }

  const syncValidationState = (showErrors: boolean) => {
    syncOnboardingConditionalFields();
    const activeStep = getActiveOnboardingStepId();
    const validation = validateOnboardingStep(activeStep, {
      showErrors: showErrors || onboardingValidationAttemptedSteps.has(activeStep),
    });
    syncOnboardingNextButton(validation.valid);
    return validation;
  };

  const attachRealtimeValidation = (
    selector: string,
    events: string[] = ["input", "change"]
  ) => {
    Array.from(document.querySelectorAll<HTMLElement>(selector)).forEach((element) => {
      events.forEach((eventName) => {
        element.addEventListener(eventName, () => {
          syncValidationState(false);
        });
      });
    });
  };

  attachRealtimeValidation("#fullName, #accountEmail, #accountPassword");
  attachRealtimeValidation("#countrySelect, #phoneNumberInput, #timezoneSelect");
  attachRealtimeValidation("#dynamic-name-input, #dobInput, #customDescriptionInput");
  attachRealtimeValidation("#profileNameInput, #handleInput");

  const onboardingEmailInput = document.getElementById("accountEmail") as HTMLInputElement | null;
  if (onboardingEmailInput) {
    onboardingEmailInput.addEventListener("input", () => {
      const normalized = normalizeText(onboardingEmailInput.value).toLowerCase();
      const localMessage = getEmailValidationMessage(normalized);

      if (emailValidationDebounceTimer) {
        window.clearTimeout(emailValidationDebounceTimer);
      }

      if (localMessage) {
        if (normalized) {
          setFieldValidationState(onboardingEmailInput, localMessage, { messageKey: "email" });
        } else {
          setFieldValidationState(onboardingEmailInput, null, { messageKey: "email" });
        }
        return;
      }

      setFieldValidationState(onboardingEmailInput, null, { messageKey: "email" });

      emailValidationDebounceTimer = window.setTimeout(() => {
        void validateEmailAgainstBackend(onboardingEmailInput, { showErrors: true }).then(() => {
          syncValidationState(false);
        });
      }, 450);
    });

    onboardingEmailInput.addEventListener("blur", () => {
      if (emailValidationDebounceTimer) {
        window.clearTimeout(emailValidationDebounceTimer);
      }

      if (!normalizeText(onboardingEmailInput.value)) {
        setFieldValidationState(onboardingEmailInput, null, { messageKey: "email" });
        syncValidationState(false);
        return;
      }

      void validateEmailAgainstBackend(onboardingEmailInput, { showErrors: true }).then(() => {
        syncValidationState(false);
      });
    });
  }

  Array.from(document.querySelectorAll("#step-7 .plan-type")).forEach((card) => {
    card.addEventListener("click", () => {
      window.setTimeout(() => syncValidationState(true), 0);
    });
  });

  Array.from(document.querySelectorAll(".channel-type, .voice-type, .acc-type, .tag-pill")).forEach((element) => {
    element.addEventListener("click", () => {
      window.setTimeout(() => syncValidationState(false), 0);
    });
  });

  if (originalUpdateUi) {
    win.updateUI = () => {
      originalUpdateUi();
      window.setTimeout(() => {
        syncValidationState(false);
      }, 0);
    };
  }

  if (originalPrevStep) {
    win.prevStep = () => {
      originalPrevStep();
      window.setTimeout(() => {
        syncValidationState(false);
      }, 0);
    };
  }

  win.nextStep = async () => {
    const activeStep = document.querySelector(".step-content.active")?.id;
    const nextButton = document.getElementById("btnNext") as HTMLButtonElement | null;

    if (activeStep) {
      onboardingValidationAttemptedSteps.add(activeStep);
    }

    const validation = syncValidationState(true);
    if (!validation.valid) {
      validation.focusTarget?.focus?.();
      return;
    }

    if (activeStep === "step-1") {
      const emailInput = document.getElementById("accountEmail") as HTMLInputElement | null;
      if (nextButton) {
        nextButton.dataset.busy = "true";
        nextButton.setAttribute("disabled", "true");
      }

      const emailValidation = await validateEmailAgainstBackend(emailInput, { showErrors: true });
      syncOnboardingNextButton(emailValidation.valid);

      if (!emailValidation.valid) {
        emailInput?.focus();
        if (nextButton) {
          nextButton.dataset.busy = "false";
          nextButton.removeAttribute("disabled");
        }
        return;
      }

      if (nextButton) {
        nextButton.dataset.busy = "false";
        nextButton.removeAttribute("disabled");
      }
    }

    if (activeStep === "step-4" && !win.__versaficOnboardingAccountCreated) {
      const name = (document.getElementById("fullName") as HTMLInputElement | null)?.value.trim() || "";
      const email = (document.getElementById("accountEmail") as HTMLInputElement | null)?.value.trim() || "";
      const password = (document.getElementById("accountPassword") as HTMLInputElement | null)?.value.trim() || "";

      if (!nextButton) {
        return;
      }

      const originalText = nextButton.textContent;
      nextButton.textContent = "Creating Account...";
      nextButton.setAttribute("disabled", "true");

      try {
        await register({ name, email, password });
        win.__versaficOnboardingAccountCreated = true;
        showToast("Account created. Let’s finish setup.", "success");
        win.__versaficOriginalNextStep?.();
      } catch (error) {
        const message =
          error instanceof LegacyApiError ? error.message : "We couldn’t create the account right now.";
        showToast(message, "warn");
      } finally {
        nextButton.textContent = originalText || "Continue ->";
        nextButton.removeAttribute("disabled");
        syncValidationState(false);
      }

      return;
    }

    if (activeStep === "step-7") {
      if (!win.__versaficOnboardingAccountCreated) {
        showToast("Create the account first so we can finish onboarding.", "warn");
        return;
      }

      if (!nextButton) {
        return;
      }

      const fullName = (document.getElementById("fullName") as HTMLInputElement | null)?.value.trim() || "";
      const profileName =
        (document.getElementById("profileNameInput") as HTMLInputElement | null)?.value.trim() || fullName;
      const countrySelect = document.getElementById("countrySelect") as HTMLSelectElement | null;
      const phoneInputs = document.querySelectorAll<HTMLInputElement>("#step-2 input");
      const phonePrefix = (document.getElementById("phonePrefix") as HTMLInputElement | null)?.value.trim() || "";
      const rawPhoneNumber = phoneInputs[1]?.value.trim() || "";
      const phone = normalizePhoneForValidation(countrySelect?.value || null, phonePrefix, rawPhoneNumber);
      const accountType =
        document.querySelector<HTMLElement>(".acc-type.active .card-text")?.textContent?.trim() || "Business";
      const activeSubcategory =
        getEffectiveOnboardingCategory();
      const email = (document.getElementById("accountEmail") as HTMLInputElement | null)?.value.trim() || "";

      nextButton.textContent = "Finishing Setup...";
      nextButton.setAttribute("disabled", "true");

      try {
        await updateCurrentUser({
          name: fullName || profileName,
          phone_number: phone || undefined,
          call_consent: true,
          call_opt_out: false,
        });

        await saveSetupBusiness({
          businessName: profileName,
          businessType: accountType,
          industry: activeSubcategory,
          country: countrySelect?.value || "",
          phone,
        });

        try {
          await createBusinessRecord({
            business_name: profileName,
            business_type: activeSubcategory,
            owner_name: fullName || profileName,
            phone,
            email,
          });
        } catch (error) {
          console.warn("Business onboarding endpoint did not complete cleanly", error);
        }

        setPreferredPlanId(getSelectedPlanIdFromOnboarding());
        showToast("Setup complete. You can activate credits next.", "success");
        window.location.href = "/dashboard/billing";
      } catch (error) {
        const message =
          error instanceof LegacyApiError ? error.message : "We couldn’t finish onboarding right now.";
        showToast(message, "warn");
      } finally {
        nextButton.textContent = "Go to Dashboard";
        nextButton.removeAttribute("disabled");
        syncValidationState(false);
      }

      return;
    }

    win.__versaficOriginalNextStep?.();
    window.setTimeout(() => {
      syncValidationState(false);
    }, 0);
  };

  syncValidationState(false);
};

const renderSearchResults = (items: DirectoryBusiness[]) => {
  const list = document.getElementById("resultList");
  const resultsCount = document.getElementById("resultsCount");
  const searchMeta = document.getElementById("searchMeta");

  if (!list || !resultsCount || !searchMeta) {
    return;
  }

  if (!items.length) {
    list.innerHTML = `
      <div class="biz-card" style="justify-content:center;text-align:center">
        <div class="biz-info">
          <div class="biz-name-row" style="justify-content:center">
            <span class="biz-name">No verified businesses found</span>
          </div>
          <div class="biz-desc">Try another keyword or clear the current filter.</div>
        </div>
      </div>
    `;
    resultsCount.innerHTML = "<span>0</span> verified results";
    searchMeta.textContent = "Showing 0 results";
    return;
  }

  list.innerHTML = items
    .map(
      (business) => `
        <div class="biz-card" onclick="window.location.href='/profile/${business.id}'">
          <div class="biz-avatar" style="background:${business.accentTint}">${business.emoji}</div>
          <div class="biz-info">
            <div class="biz-name-row">
              <span class="biz-name">${business.business_name}</span>
              <span class="badge ${business.badgeClass}">${business.badgeText}</span>
            </div>
            <div class="biz-category">${business.business_type} · ${business.listingContext}</div>
            <div class="biz-meta">
              <span>${business.primaryMeta}</span>
              <span class="biz-phone">📞 ${business.phone}</span>
              ${business.aiLabels.map((label) => `<span>${label}</span>`).join("")}
            </div>
            <div class="biz-desc">${business.description}</div>
          </div>
          <div class="biz-actions">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window.location.href='/profile/${business.id}'">View Profile →</button>
            <div class="trust-score"><span>${business.statusValue}</span>${business.statusLabel}</div>
          </div>
        </div>
      `
    )
    .join("");

  resultsCount.innerHTML = `<span>${items.length}</span> verified results`;
  searchMeta.textContent = `Showing ${items.length} results`;
};

const updateSearchSidebar = (businesses: DirectoryBusiness[]) => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>(".sidebar-filters .filter-section"));
  if (sections.length < 4) {
    return;
  }

  const kindCounts = businesses.reduce<Record<string, number>>((counts, business) => {
    counts[business.kind] = (counts[business.kind] || 0) + 1;
    return counts;
  }, {});

  const recentCount = businesses.filter((business) => {
    const createdAt = business.created_at ? new Date(business.created_at).getTime() : 0;
    return createdAt && Date.now() - createdAt <= 30 * 86400000;
  }).length;

  sections[0].querySelector("h4")!.textContent = "Business Types";
  sections[0].innerHTML = `
    <h4>Business Types</h4>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 🏨 Hotels</label><span class="filter-count">${formatNumber(kindCounts.hotel || 0)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 🍽️ Restaurants</label><span class="filter-count">${formatNumber(kindCounts.restaurant || 0)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 🏥 Clinics</label><span class="filter-count">${formatNumber(kindCounts.clinic || 0)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 📸 Creators</label><span class="filter-count">${formatNumber(kindCounts.creator || 0)}</span></div>
  `;

  sections[1].innerHTML = `
    <h4>Contact Coverage</h4>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 📞 Phone listed</label><span class="filter-count">${formatNumber(businesses.filter((item) => normalizeText(item.phone)).length)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> ✉️ Email listed</label><span class="filter-count">${formatNumber(businesses.filter((item) => normalizeText(item.email)).length)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 👤 Owner listed</label><span class="filter-count">${formatNumber(businesses.filter((item) => normalizeText(item.owner_name)).length)}</span></div>
  `;

  sections[2].innerHTML = `
    <h4>Directory Status</h4>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> ✓ Live listings</label><span class="filter-count">${formatNumber(businesses.length)}</span></div>
    <div class="filter-item"><label><input type="checkbox" class="filter-checkbox" checked disabled> 🆕 Added in 30 days</label><span class="filter-count">${formatNumber(recentCount)}</span></div>
  `;

  sections[3].querySelector("h4")!.textContent = "Search Directory";
  const input = sections[3].querySelector<HTMLInputElement>(".input-field");
  const button = replaceInteractiveElement(sections[3].querySelector<HTMLButtonElement>(".btn"));
  if (input) {
    input.placeholder = "Owner, email, or phone...";
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        (document.getElementById("searchInput") as HTMLInputElement | null)?.focus();
        getWindowRef().doSearch?.();
      }
    });
  }
  if (button) {
    button.textContent = "Apply Search";
    button.addEventListener("click", () => {
      const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
      if (searchInput && input?.value.trim()) {
        searchInput.value = input.value.trim();
      }
      getWindowRef().doSearch?.();
    });
  }
};

const bindSearchPage = async () => {
  const win = getWindowRef();

  try {
    const businesses = (await getBusinessList(60)).map(buildDirectoryBusiness);
    win.__versaficSearchBusinesses = businesses;
    win.__versaficSearchFiltered = [...businesses];
    win.__versaficActiveSearchKind = "all";

    const featuredTitle = document.querySelector(".featured-banner div[style*='font-weight:600']") as HTMLElement | null;
    const featuredAction = replaceInteractiveElement(document.querySelector(".featured-banner .btn"));
    if (businesses[0] && featuredTitle) {
      featuredTitle.textContent = `${businesses[0].business_name} — ${businesses[0].listingContext.toLowerCase()}`;
      featuredAction?.addEventListener("click", () => {
        window.location.href = `/profile/${businesses[0].id}`;
      });
    }
    updateSearchSidebar(businesses);

    win.renderResults = () => {
      renderSearchResults(win.__versaficSearchFiltered || []);
    };

    win.setFilter = (button: HTMLElement, kind: string) => {
      document.querySelectorAll(".filter-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      win.__versaficActiveSearchKind = kind;

      const q = (document.getElementById("searchInput") as HTMLInputElement | null)?.value.trim().toLowerCase() || "";
      const source = win.__versaficSearchBusinesses || [];

      win.__versaficSearchFiltered = source.filter((business) => {
        const matchesKind = kind === "all" ? true : business.kind === kind;
        const haystack = `${business.business_name} ${business.business_type} ${business.owner_name} ${business.phone} ${business.email} ${business.listingContext}`.toLowerCase();
        const matchesQuery = q ? haystack.includes(q) : true;
        return matchesKind && matchesQuery;
      });

      win.renderResults?.();
    };

    win.doSearch = () => {
      const activeButton =
        document.querySelector<HTMLElement>(`.filter-btn.active`) || document.querySelector<HTMLElement>(".filter-btn");
      if (activeButton) {
        const kind = activeButton.textContent?.toLowerCase().includes("all")
          ? "all"
          : activeButton.textContent?.toLowerCase().includes("hotel")
            ? "hotel"
            : activeButton.textContent?.toLowerCase().includes("restaurant")
              ? "restaurant"
              : activeButton.textContent?.toLowerCase().includes("clinic")
                ? "clinic"
                : activeButton.textContent?.toLowerCase().includes("barber")
                  ? "barber"
                  : activeButton.textContent?.toLowerCase().includes("creator")
                    ? "creator"
                    : "consultant";
        win.setFilter?.(activeButton, kind);
      }
    };

    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
    searchInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        win.doSearch?.();
      }
    });

    win.closeModal = () => {
      document.getElementById("callModal")?.classList.remove("open");
    };
    win.simulateCall = async () => {
      const config = await getPublicCallConfig().catch(() => null);
      if (!config?.ai_number) {
        showToast("The AI number is not available right now.", "warn");
        return;
      }
      showToast(`Opening your phone dialer for ${config.ai_number}.`, "success");
      window.location.href = `tel:${config.ai_number}`;
    };

    const modalCallButton = replaceInteractiveElement(
      document.querySelector<HTMLButtonElement>("#callModal .btn.btn-primary")
    );
    document.getElementById("callModal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        win.closeModal?.();
      }
    });
    modalCallButton?.addEventListener("click", async () => {
      try {
        const config = await getPublicCallConfig();
        if (!config.ai_number) {
          showToast("The AI number is not configured yet.", "warn");
          return;
        }

        showToast(`Opening your phone dialer for ${config.ai_number}.`, "success");
        window.location.href = `tel:${config.ai_number}`;
      } catch {
        showToast("The AI number is not available right now.", "warn");
      }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const queryValue = urlParams.get("q");
    if (searchInput && queryValue) {
      searchInput.value = queryValue;
    }

    win.renderResults?.();
  } catch (error) {
    console.error("Failed to bind search page", error);
    renderSearchResults([]);
  }
};

const buildProfileActions = (business: DirectoryBusiness) => {
  const actionPresets: Record<BusinessKind, Array<{ icon: string; color: string; title: string; sub: string }>> = {
    hotel: [
      { icon: "📅", color: "#7c3aed", title: "Bookings", sub: "Check availability and reserve" },
      { icon: "🛎️", color: "#2563eb", title: "Guest Support", sub: "FAQs, stays, and concierge" },
      { icon: "📞", color: "#0891b2", title: "AI Calls", sub: "Customer support through the AI number" },
    ],
    restaurant: [
      { icon: "🍽️", color: "#059669", title: "Reservations", sub: "Table requests and availability" },
      { icon: "📋", color: "#2563eb", title: "Menu Questions", sub: "Menu and event details" },
      { icon: "📞", color: "#0891b2", title: "AI Calls", sub: "Phone support through the AI number" },
    ],
    clinic: [
      { icon: "📅", color: "#0284c7", title: "Appointments", sub: "Schedule visits and follow-ups" },
      { icon: "💊", color: "#0891b2", title: "Patient Support", sub: "Prescription and service questions" },
      { icon: "📞", color: "#0f766e", title: "AI Calls", sub: "Call the AI line for support" },
    ],
    barber: [
      { icon: "✂️", color: "#2563eb", title: "Book a Slot", sub: "Haircuts and grooming services" },
      { icon: "💈", color: "#6366f1", title: "Service Questions", sub: "Hours, pricing, and availability" },
      { icon: "📞", color: "#0891b2", title: "AI Calls", sub: "Phone support via the AI number" },
    ],
    creator: [
      { icon: "🤝", color: "#7c3aed", title: "Partnerships", sub: "Collaboration and campaign intake" },
      { icon: "📦", color: "#2563eb", title: "Brand Requests", sub: "Deals, briefs, and packages" },
      { icon: "📞", color: "#0891b2", title: "AI Calls", sub: "Talk to the creator AI assistant" },
    ],
    consultant: [
      { icon: "📅", color: "#0284c7", title: "Consultations", sub: "Discovery calls and bookings" },
      { icon: "📝", color: "#0891b2", title: "Intake", sub: "Share details before the call" },
      { icon: "📞", color: "#059669", title: "AI Calls", sub: "Phone support through the AI number" },
    ],
    agency: [
      { icon: "🎯", color: "#0284c7", title: "Lead Intake", sub: "Capture and qualify new inquiries" },
      { icon: "📋", color: "#0891b2", title: "Discovery", sub: "Project scope and service details" },
      { icon: "📞", color: "#6366f1", title: "AI Calls", sub: "Call the AI assistant directly" },
    ],
  };

  return actionPresets[business.kind];
};

const renderProfilePage = async (pageKey: string) => {
  const profileId = pageKey.replace("profile-", "");
  const businesses = (await getBusinessList(80)).map(buildDirectoryBusiness);
  const business = businesses.find((item) => item.id === profileId) || businesses[0] || null;
  const wrap = document.getElementById("profileWrap");
  const glow = document.getElementById("bgGlow");

  if (!wrap || !business) {
    return;
  }

  const actions = buildProfileActions(business);
  const initials = business.business_name.slice(0, 2).toUpperCase();

  if (glow) {
    glow.setAttribute("style", `background: radial-gradient(circle, ${business.accentTint.replace("0.18", "0.26")} 0%, transparent 70%);`);
  }

  wrap.innerHTML = `
    <div class="profile-avatar" style="background:${business.accentTint}">${business.emoji}</div>
    <div class="profile-name">${business.business_name}</div>
    <div class="profile-handle">${business.handle}</div>
    <div class="profile-badges">
      <span class="verified-chip">${business.badgeText}</span>
    </div>
    <p class="profile-bio">${business.description}</p>
    <div class="profile-meta">
      <div class="meta-item">👤 <span class="meta-value">${business.owner_name}</span></div>
      <div class="meta-item">📅 <span class="meta-value">${formatDate(business.created_at || null)}</span></div>
      <div class="meta-item">📞 <span class="meta-value">${business.phone}</span></div>
    </div>

    <button class="call-btn" onclick="openCallModal()">
      📞&nbsp; Call AI Assistant
    </button>
    <div class="call-btn-sub">Dial the live AI number used by ${business.business_name}</div>

    <div class="link-section-title">Services & Actions</div>
    ${actions
      .map(
        (action) => `
          <a href="#" class="link-btn" onclick="return false">
            <div class="link-btn-icon" style="background:${action.color}22;border:1px solid ${action.color}44">${action.icon}</div>
            <div class="link-btn-content">
              <div class="link-btn-title">${action.title}</div>
              <div class="link-btn-sub">${action.sub}</div>
            </div>
            <span class="link-arrow">→</span>
          </a>
        `
      )
      .join("")}

    <div class="link-section-title" style="margin-top:8px">Business details</div>
    <div class="social-platforms">
      <a href="mailto:${business.email}" class="social-platform-btn">
        <div class="sp-icon sp-website">✉️</div>
        <div style="flex:1">
          <div style="font-size:0.88rem;font-weight:600">Email</div>
          <div class="sp-handle">${business.email}</div>
        </div>
      </a>
      <a href="tel:${business.phone}" class="social-platform-btn">
        <div class="sp-icon sp-whatsapp">📞</div>
        <div style="flex:1">
          <div style="font-size:0.88rem;font-weight:600">Phone</div>
          <div class="sp-handle">${business.phone}</div>
        </div>
      </a>
      <a href="#" class="social-platform-btn" onclick="return false">
        <div class="sp-icon sp-instagram">${initials}</div>
        <div style="flex:1">
          <div style="font-size:0.88rem;font-weight:600">Owner</div>
          <div class="sp-handle">${business.owner_name}</div>
        </div>
      </a>
    </div>

    <div class="info-card" style="margin-top:16px">
      <div class="info-card-title">Availability & Trust</div>
      <div class="hours-row">
        <span class="hours-day">Business Type</span>
        <span class="hours-time">${business.business_type}</span>
      </div>
      <div class="hours-row">
        <span class="hours-day">Directory Status</span>
        <span class="hours-time">${business.statusLabel}</span>
      </div>
      <div class="hours-row">
        <span class="hours-day">Created</span>
        <span class="hours-time">${formatDate(business.created_at || null)}</span>
      </div>
    </div>

    <div class="trust-banner">
      <div>
        <div class="trust-score-num">${business.statusValue}</div>
      </div>
      <div style="flex:1">
        <div class="trust-label">${business.statusLabel}</div>
        <div class="trust-subtitle">${business.statusSubtext}</div>
      </div>
    </div>
  `;

  getWindowRef().__versaficCurrentBusiness = business;
  const modalBusinessName = document.getElementById("modalBiz");
  const modalName = document.getElementById("modalName");
  const modalAvatar = document.getElementById("modalAvatar");
  if (modalBusinessName) {
    modalBusinessName.textContent = business.business_name;
  }
  if (modalName) {
    modalName.textContent = `Call ${business.business_name}`;
  }
  if (modalAvatar) {
    modalAvatar.innerHTML = `<div class="ripple-ring"></div><div class="ripple-ring ripple-ring-2"></div>${business.emoji}`;
  }
  const creditsNote = document.querySelector(".call-credits-note");
  if (creditsNote) {
    creditsNote.textContent = "20 credits are deducted per AI call minute on the backend wallet.";
  }
};

const bindProfilePage = async (pageKey: string) => {
  await renderProfilePage(pageKey);

  const win = getWindowRef();
  win.openCallModal = () => {
    document.getElementById("callModal")?.classList.add("open");
  };
  win.closeCallModal = () => {
    document.getElementById("callModal")?.classList.remove("open");
  };
  win.startCall = async () => {
    try {
      const config = await getPublicCallConfig();
      if (!config.ai_number) {
        showToast("The AI number is not configured yet.", "warn");
        return;
      }

      showToast(`Opening your dialer for ${config.ai_number}.`, "success");
      window.location.href = `tel:${config.ai_number}`;
    } catch {
      showToast("The AI number is not available right now.", "warn");
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      win.closeCallModal?.();
    }
  });
};

const exportTable = (table: HTMLTableElement, filename: string) => {
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th, td"))
      .map((cell) => `"${cell.textContent?.trim().replace(/"/g, '""') || ""}"`)
      .join(",")
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
};

const renderCallRows = (rows: Array<Record<string, string>>) => {
  const tableBody = document.getElementById("callsTableBody");
  if (!tableBody) {
    return;
  }

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No call records synced from the backend yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.name)}</td>
          <td><span class="badge ${escapeHtml(row.intentBadge)}">${escapeHtml(row.intent)}</span></td>
          <td style="color:${escapeHtml(row.outcomeColor)};font-weight:600">${escapeHtml(row.outcome)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.duration)}</td>
          <td>${escapeHtml(row.credits)}</td>
        </tr>
      `
    )
    .join("");
};

const renderChatRows = (rows: Array<Record<string, string>>) => {
  const tableBody = document.getElementById("chatsTableBody");
  if (!tableBody) {
    return;
  }

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">No chat records synced from the backend yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.name)}</td>
          <td><span class="badge ${escapeHtml(row.intentBadge)}">${escapeHtml(row.intent)}</span></td>
          <td style="color:${escapeHtml(row.outcomeColor)};font-weight:600">${escapeHtml(row.outcome)}</td>
          <td>${escapeHtml(row.status)}</td>
          <td>${escapeHtml(row.date)}</td>
          <td>${escapeHtml(row.messages)}</td>
          <td>${escapeHtml(row.credits)}</td>
        </tr>
      `
    )
    .join("");
};

type CustomerAggregate = {
  key: string;
  name: string;
  email: string;
  phone: string;
  totalInteractions: number;
  bookings: number;
  creditsUsed: number;
  lastContact: string | null;
  statusBadge: string;
  statusLabel: string;
};

type WorkflowRow = {
  time: string;
  customer: string;
  service: string;
  assignedTo: string;
  statusBadge: string;
  statusLabel: string;
  date: string;
  notes: string;
  duration: string;
};

const filterDashboardState = (state: DashboardState, filterKey: string): DashboardState => ({
  ...state,
  callSessions: state.callSessions.filter((item) => matchesDateFilter(item.created_at, filterKey)),
  chatHistory: state.chatHistory.filter((item) => matchesDateFilter(item.created_at || item.createdAt, filterKey)),
  voiceConversations: state.voiceConversations.filter((item) => matchesDateFilter(item.created_at, filterKey)),
  resolvedInteractions: state.resolvedInteractions.filter((item) => matchesDateFilter(item.created_at, filterKey)),
});

const getSelectedDateFilter = (pageId: string) => {
  const win = getWindowRef();
  const filters = win.__versaficSelectedDateFilters || {};
  return filters[pageId] || "7D";
};

const setSelectedDateFilter = (pageId: string, filterKey: string) => {
  const win = getWindowRef();
  win.__versaficSelectedDateFilters = {
    ...(win.__versaficSelectedDateFilters || {}),
    [pageId]: filterKey,
  };
};

const buildCustomerAggregates = (state: DashboardState) => {
  const map = new Map<string, CustomerAggregate>();

  const upsert = (key: string, patch: Partial<CustomerAggregate>) => {
    const current = map.get(key) || {
      key,
      name: "Customer",
      email: "--",
      phone: "--",
      totalInteractions: 0,
      bookings: 0,
      creditsUsed: 0,
      lastContact: null,
      statusBadge: "badge-blue",
      statusLabel: "New",
    };

    const next: CustomerAggregate = {
      ...current,
      ...patch,
      totalInteractions: current.totalInteractions + (patch.totalInteractions || 0),
      bookings: current.bookings + (patch.bookings || 0),
      creditsUsed: current.creditsUsed + (patch.creditsUsed || 0),
      lastContact:
        patch.lastContact && (!current.lastContact || new Date(patch.lastContact) > new Date(current.lastContact))
          ? patch.lastContact
          : current.lastContact,
    };

    map.set(key, next);
  };

  state.voiceConversations.forEach((conversation) => {
    const key = normalizeText(conversation.email) || normalizeText(conversation.phone) || conversation.id;
    const intent = inferIntentLabel(conversation.request || conversation.ai_response);
    upsert(key, {
      name: normalizeText(conversation.customer_name) || normalizeText(conversation.phone) || "Voice lead",
      email: normalizeText(conversation.email) || "--",
      phone: normalizeText(conversation.phone) || "--",
      totalInteractions: 1,
      bookings: intent === "Bookings" || intent === "Appointments" ? 1 : 0,
      creditsUsed: 10,
      lastContact: conversation.created_at,
    });
  });

  state.callSessions.forEach((session) => {
    const phone = normalizeText(session.phone_number) || normalizeText(session.to_number) || normalizeText(session.from_number);
    const key = phone || session.id;
    const intent = inferIntentLabel(session.purpose || session.ai_response || session.metadata?.purpose?.toString());
    upsert(key, {
      name: phone || "Caller",
      phone: phone || "--",
      totalInteractions: 1,
      bookings: intent === "Bookings" || intent === "Appointments" ? 1 : 0,
      creditsUsed: session.cost_credits || state.callConfig?.call_credit_cost || 20,
      lastContact: session.created_at,
    });
  });

  return Array.from(map.values())
    .map((entry) => {
      const lastTouched = entry.lastContact ? new Date(entry.lastContact).getTime() : 0;
      const ageHours = lastTouched ? Math.max(0, Math.round((Date.now() - lastTouched) / 3600000)) : 999;
      let statusBadge = "badge-blue";
      let statusLabel = "New";
      if (entry.totalInteractions >= 5 || entry.creditsUsed >= 100) {
        statusBadge = "badge-purple";
        statusLabel = "VIP";
      } else if (ageHours <= 48) {
        statusBadge = "badge-green";
        statusLabel = "Active";
      } else if (ageHours > 24 * 14) {
        statusBadge = "badge-amber";
        statusLabel = "Inactive";
      }

      return {
        ...entry,
        statusBadge,
        statusLabel,
      };
    })
    .sort((left, right) => {
      const leftTime = left.lastContact ? new Date(left.lastContact).getTime() : 0;
      const rightTime = right.lastContact ? new Date(right.lastContact).getTime() : 0;
      return rightTime - leftTime;
    });
};

const buildWorkflowRows = (state: DashboardState): WorkflowRow[] => {
  const fromConversations = state.voiceConversations.map((conversation) => {
    const service = inferIntentLabel(conversation.request || conversation.ai_response);
    return {
      sortKey: new Date(conversation.created_at).getTime(),
      time: formatTime(conversation.created_at),
      customer: normalizeText(conversation.customer_name) || normalizeText(conversation.phone) || "Voice lead",
      service,
      assignedTo: "AI Agent",
      statusBadge: "badge-green",
      statusLabel: "Synced",
      date: formatDate(conversation.created_at),
      notes: normalizeText(conversation.request) || "Voice workflow captured",
      duration: "--",
    };
  });

  const fromCalls = state.callSessions.map((session) => {
    const service = inferIntentLabel(session.purpose || session.ai_response || session.metadata?.purpose?.toString());
    const isComplete = session.status === "completed";
    const isMissed = session.status === "no-answer";
    return {
      sortKey: new Date(session.created_at).getTime(),
      time: formatTime(session.created_at),
      customer: normalizeText(session.phone_number) || normalizeText(session.to_number) || normalizeText(session.from_number) || "Caller",
      service,
      assignedTo: session.type === "outgoing" ? "AI Callback" : "AI Agent",
      statusBadge: isComplete ? "badge-green" : isMissed ? "badge-amber" : "badge-blue",
      statusLabel: isComplete ? "Completed" : isMissed ? "Missed" : session.status,
      date: formatDate(session.created_at),
      notes: normalizeText(session.ai_response) || `Call ${session.direction}`,
      duration: formatDuration(session.duration_seconds),
    };
  });

  return [...fromCalls, ...fromConversations]
    .sort((left, right) => right.sortKey - left.sortKey)
    .map((row) => {
      const { sortKey, ...rest } = row;
      void sortKey;
      return rest;
    });
};

const renderCustomerRows = (rows: CustomerAggregate[]) => {
  const tableBody = document.getElementById("customersTableBody");
  if (!tableBody) {
    return;
  }

  if (!rows.length) {
    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted)">No customer records have synced from the backend yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.name)}</td>
          <td>${escapeHtml(row.email)}</td>
          <td>${escapeHtml(row.phone)}</td>
          <td>${escapeHtml(formatNumber(row.totalInteractions))}</td>
          <td>${escapeHtml(formatNumber(row.bookings))}</td>
          <td><span class="badge ${escapeHtml(row.statusBadge)}">${escapeHtml(row.statusLabel)}</span></td>
          <td>${escapeHtml(formatCurrency(row.creditsUsed * 10))}</td>
          <td>${escapeHtml(formatRelativeTime(row.lastContact))}</td>
        </tr>
      `
    )
    .join("");
};

const renderSimpleBarColumns = (
  containerId: string,
  rows: Array<{
    label: string;
    value: number;
    color?: string;
  }>
) => {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  if (!rows.length) {
    container.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;">No backend data available yet.</div>`;
    return;
  }

  const maxValue = Math.max(...rows.map((item) => item.value), 1);
  container.innerHTML = rows
    .map(
      (row) => `
        <div class="simple-bar-col">
          <div class="simple-bar-val">${escapeHtml(formatNumber(row.value))}</div>
          <div class="simple-bar" style="height:${Math.max(8, (row.value / maxValue) * 120)}px;background:${row.color || "linear-gradient(180deg,#6366f1,#818cf8)"}"></div>
          <div class="simple-bar-lbl">${escapeHtml(row.label)}</div>
        </div>
      `
    )
    .join("");
};

const setDonutBreakdown = (
  container: Element | null,
  totalLabel: string,
  items: Array<{ label: string; value: number; color: string }>
) => {
  if (!container) {
    return;
  }

  const donut = container.querySelector(".donut-chart") as HTMLElement | null;
  const totalValue = items.reduce((sum, item) => sum + item.value, 0);
  const safeTotal = totalValue || 1;
  let progress = 0;
  const gradient = items
    .map((item) => {
      const start = progress;
      const end = progress + (item.value / safeTotal) * 100;
      progress = end;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(",");

  if (donut) {
    donut.style.background = gradient ? `conic-gradient(${gradient})` : "conic-gradient(#374151 0% 100%)";
  }

  const valueNode = container.querySelector(".donut-inner .val");
  const labelNode = container.querySelector(".donut-inner .lbl");
  if (valueNode) {
    valueNode.textContent = formatNumber(totalValue);
  }
  if (labelNode) {
    labelNode.textContent = totalLabel;
  }

  const itemsWrap = container.querySelector(".donut-items");
  if (itemsWrap) {
    itemsWrap.innerHTML = items
      .map((item) => {
        const percentage = totalValue ? Math.round((item.value / totalValue) * 100) : 0;
        return `
          <div class="donut-item">
            <div class="donut-item-left">
              <div class="legend-dot" style="background:${item.color}"></div>${escapeHtml(item.label)}
            </div>
            <div class="donut-item-right">${escapeHtml(`${formatNumber(item.value)} (${percentage}%)`)}</div>
          </div>
        `;
      })
      .join("");
  }
};

const updateDashboardSummary = (state: DashboardState) => {
  const greeting = document.querySelector("#page-overview .dash-header h2");
  const intro = document.querySelector("#page-overview .dash-header p");
  if (greeting && state.user?.name) {
    greeting.textContent = `Good evening, ${state.user.name.split(" ")[0]} 👋`;
  }
  if (intro && state.setup?.businessName) {
    intro.textContent = `Your live workspace for ${state.setup.businessName}.`;
  }

  const topStatCards = Array.from(document.querySelectorAll("#page-overview .stat-card"));
  const totalChats = state.chatStats?.totalMessages ?? state.chatHistory.length;
  const totalCalls = state.callSessions.length;
  const totalVoiceLeads = state.voiceConversations.length;
  const totalConversations = totalChats + totalCalls + totalVoiceLeads;
  const uniqueUsers = new Set(
    [
      ...state.callSessions.map((session) => session.phone_number || session.from_number || session.to_number),
      ...state.voiceConversations.map((conversation) => conversation.phone || conversation.email || conversation.customer_name || conversation.id),
    ]
  ).size;
  const resolved = state.callSessions.filter((session) => session.status === "completed").length;
  const escalated = state.callSessions.filter((session) => ["failed", "no-answer"].includes(session.status)).length;
  const statValues = [
    { value: formatNumber(totalConversations), label: "Total Conversations", change: `${formatNumber(totalConversations)} live` },
    { value: formatNumber(uniqueUsers), label: "Unique Users", change: `${formatNumber(uniqueUsers)} callers` },
    { value: formatNumber(totalCalls), label: "AI Calls", change: `${formatNumber(totalCalls)} synced` },
    { value: formatNumber(totalChats), label: "Chats", change: `${formatNumber(totalChats)} synced` },
    { value: state.voiceStats ? formatNumber(state.voiceStats.total || 0) : "0", label: "Voice Leads", change: "Backend synced" },
    { value: formatNumber(escalated), label: "Escalated", change: `${formatNumber(resolved)} completed` },
  ];

  topStatCards.forEach((card, index) => {
    const metric = statValues[index];
    if (!metric) {
      return;
    }
    const valueNode = card.querySelector(".stat-card-value");
    const labelNode = card.querySelector(".stat-card-label");
    const changeNode = card.querySelector(".stat-card-change");
    if (valueNode) {
      valueNode.textContent = metric.value;
    }
    if (labelNode) {
      labelNode.textContent = metric.label;
    }
    if (changeNode) {
      changeNode.textContent = metric.change;
      changeNode.className = "stat-card-change up";
    }
  });
};

const updateBillingPage = (state: DashboardState) => {
  const creditsPage = document.getElementById("page-credits");
  if (!creditsPage || !state.wallet) {
    return;
  }

  const usage = computeUsageBreakdown(state.wallet);
  const heroValue = creditsPage.querySelector(".credits-value");
  const heroInfo = heroValue?.nextElementSibling as HTMLElement | null;
  const usageValue = heroValue?.closest(".credits-hero")?.querySelector("div[style*='font-size:1.8rem']") as HTMLElement | null;
  const usageFill = creditsPage.querySelector(".usage-fill") as HTMLElement | null;
  const usageCaption = creditsPage.querySelector("div[style*='font-size:0.75rem;color:var(--text-muted)']") as HTMLElement | null;

  if (heroValue) {
    heroValue.textContent = formatNumber(state.wallet.balance_credits);
  }
  if (heroInfo) {
    heroInfo.textContent = `~${Math.floor(state.wallet.balance_credits / 20)} minutes of AI call time remaining`;
  }
  if (usageValue) {
    usageValue.textContent = formatNumber(usage.used);
  }

  const totalCapacity = usage.used + state.wallet.balance_credits || 1;
  const usagePercentage = Math.min(100, Math.round((usage.used / totalCapacity) * 100));
  if (usageFill) {
    usageFill.style.width = `${usagePercentage}%`;
  }
  if (usageCaption) {
    usageCaption.textContent = `${usagePercentage}% of the current wallet has been used`;
  }

  const breakdownCards = Array.from(creditsPage.querySelectorAll(".chart-container")[0]?.querySelectorAll("div[style*='text-align:center']") || []);
  const values = [usage.calls, usage.chats, usage.sms, usage.transcripts];
  breakdownCards.forEach((card, index) => {
    const valueNode = card.querySelector("div[style*='font-size:1.4rem']");
    if (valueNode) {
      valueNode.textContent = formatNumber(values[index] || 0);
    }
  });

  const packages = Array.from(creditsPage.querySelectorAll<HTMLElement>(".credit-package"));
  state.plans.slice(0, packages.length).forEach((plan, index) => {
    const card = packages[index];
    card.dataset.planId = plan.id;
    const amountNode = card.querySelector(".pkg-amount");
    const priceNode = card.querySelector(".pkg-price");
    const perNode = card.querySelector(".pkg-per");
    const descriptionNode = card.querySelector(".pkg-credits");
    const button = replaceInteractiveElement(card.querySelector<HTMLButtonElement>("button"));

    if (amountNode) {
      amountNode.textContent = formatNumber(plan.credits);
    }
    if (descriptionNode) {
      descriptionNode.textContent = plan.name;
    }
    if (priceNode) {
      priceNode.textContent = formatCurrency(plan.amount_paise);
    }
    if (perNode) {
      perNode.textContent = plan.description;
    }

    button?.addEventListener("click", async () => {
      packages.forEach((item) => {
        item.style.outline = "";
        item.style.borderColor = "";
      });
      card.style.outline = selectedPlanOutline;
      card.style.borderColor = "#6366f1";
      setPreferredPlanId(plan.id);

      try {
        await openCheckout({
          planId: plan.id,
          onSuccess: async () => {
            await bindDashboardPage();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start checkout.";
        showToast(message, "warn");
      }
    });
  });

  const purchaseButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#page-credits .dash-header .btn.btn-primary, #page-overview .btn.btn-primary.btn-sm")
  ).map((button) => replaceInteractiveElement(button)).filter(Boolean) as HTMLButtonElement[];
  purchaseButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const preferredPlan = state.plans.find((plan) => plan.id === "growth") || state.plans[0];
      if (!preferredPlan) {
        showToast("No billing plans are configured right now.", "warn");
        return;
      }

      try {
        setPreferredPlanId(preferredPlan.id);
        await openCheckout({
          planId: preferredPlan.id,
          onSuccess: async () => {
            await bindDashboardPage();
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start checkout.";
        showToast(message, "warn");
      }
    });
  });

  const topUpSelect = creditsPage.querySelector<HTMLSelectElement>(".chart-container select");
  const topUpButton = replaceInteractiveElement(
    Array.from(creditsPage.querySelectorAll<HTMLButtonElement>(".chart-container .btn.btn-primary")).find(
      (button) => button.textContent?.trim() === "Top Up Now"
    ) || null
  );

  if (topUpSelect) {
    const topUpPlans = state.plans.slice(0, 4);
    topUpSelect.innerHTML = topUpPlans.length
      ? topUpPlans
          .map(
            (plan) =>
              `<option value="${escapeHtml(plan.id)}" data-credits="${plan.credits}" data-amount-paise="${plan.amount_paise}">${formatNumber(
                plan.credits
              )} Credits - ${formatCurrency(plan.amount_paise)}</option>`
          )
          .join("")
      : `<option value="">No live top-up packs</option>`;
  }

  topUpButton?.addEventListener("click", async () => {
    const selectedOption = topUpSelect?.selectedOptions[0] || null;
    const credits = Number(selectedOption?.getAttribute("data-credits") || 0);
    const amountPaise = Number(selectedOption?.getAttribute("data-amount-paise") || 0);

    if (!credits || !amountPaise) {
      showToast("Choose a valid top-up amount first.", "warn");
      return;
    }

    try {
      await openCheckout({
        amountPaise,
        credits,
        onSuccess: async () => {
          await bindDashboardPage();
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      showToast(message, "warn");
    }
  });

  const invoiceTable = creditsPage.querySelectorAll<HTMLTableElement>("table")[0];
  const invoiceBody = invoiceTable?.querySelector("tbody");
  if (invoiceBody) {
    const rows = state.wallet.transactions
      .filter((transaction) => transaction.type === "topup" || transaction.type === "refund")
      .slice(0, 4)
      .map((transaction) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">#TX-${transaction.id}</td>
          <td>${formatDate(transaction.created_at)}</td>
          <td>${transaction.source === "razorpay" ? "Razorpay Top-up" : transaction.source}</td>
          <td>${transaction.amount_paise ? formatCurrency(transaction.amount_paise) : "--"}</td>
          <td>${formatNumber(transaction.credits)}</td>
          <td><span class="badge ${transaction.type === "refund" ? "badge-amber" : "badge-green"}">${transaction.type === "refund" ? "Refunded" : "Paid"}</span></td>
          <td><button class="btn btn-outline btn-sm" data-export-transaction="${transaction.id}">Download</button></td>
        </tr>
      `)
      .join("");

    invoiceBody.innerHTML = rows || `
      <tr>
        <td colspan="7" style="text-align:center;color:var(--text-muted)">No billing transactions yet</td>
      </tr>
    `;
  }

  invoiceBody?.querySelectorAll<HTMLButtonElement>("[data-export-transaction]").forEach((button) => {
    const replacement = replaceInteractiveElement(button);
    replacement?.addEventListener("click", () => {
      const transactionId = replacement.getAttribute("data-export-transaction");
      if (invoiceTable) {
        exportTable(invoiceTable, `versafic-billing-${transactionId || "invoice"}.csv`);
        showToast("Billing export downloaded.", "success");
      }
    });
  });

  const paymentCards = Array.from(creditsPage.querySelectorAll(".payment-card"));
  if (paymentCards[0]) {
    const icon = paymentCards[0].querySelector(".payment-card-icon");
    if (icon) {
      icon.textContent = "RZP";
    }
    const textNodes = paymentCards[0].querySelectorAll("div");
    if (textNodes[2]) {
      textNodes[2].textContent = "Razorpay Checkout";
    }
    if (textNodes[3]) {
      textNodes[3].textContent = "Secure hosted payment flow";
    }
  }
  if (paymentCards[1]) {
    const icon = paymentCards[1].querySelector(".payment-card-icon");
    if (icon) {
      icon.textContent = "AUTO";
    }
    const textNodes = paymentCards[1].querySelectorAll("div");
    if (textNodes[2]) {
      textNodes[2].textContent = state.autopay?.settings?.enabled ? "Autopay Enabled" : "Autopay Off";
    }
    if (textNodes[3]) {
      textNodes[3].textContent = state.autopay?.settings
        ? `Threshold ${formatNumber(state.autopay.settings.threshold_credits)} credits · ${state.autopay.settings.mode}`
        : "No recharge rule saved yet";
    }
  }

  const addPaymentButton = replaceInteractiveElement(
    creditsPage.querySelector<HTMLButtonElement>(".chart-container .btn.btn-outline[style*='margin-top:12px']")
  );
  addPaymentButton?.addEventListener("click", () => {
    const autopay = state.autopay?.settings;
    if (!autopay) {
      showToast("Payment methods are handled through Razorpay checkout. Save an autopay rule to reuse it.", "info");
      return;
    }

    showToast(
      `Autopay is ${autopay.enabled ? "enabled" : "disabled"} at ${formatNumber(autopay.threshold_credits)} credits.`,
      "info"
    );
  });

  const faqAnswers = creditsPage.querySelectorAll(".faq-answer");
  if (faqAnswers[0]) {
    faqAnswers[0].textContent =
      "AI chat requests deduct 2 credits, and live AI calls deduct 20 credits per minute. Credits are enforced by the backend wallet.";
  }
  if (faqAnswers[2]) {
    faqAnswers[2].textContent =
      "When your wallet is low, requests are blocked unless you recharge or complete the triggered Razorpay checkout.";
  }
};

const updateCustomersPage = (state: DashboardState) => {
  const customersPage = document.getElementById("page-customers");
  if (!customersPage) {
    return;
  }

  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-customers"));
  const rows = buildCustomerAggregates(filteredState);
  getWindowRef().__versaficCustomerRows = rows.map((row) => ({
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.statusLabel,
  }));

  renderCustomerRows(rows);

  const searchInput = document.getElementById("customerSearch") as HTMLInputElement | null;
  getWindowRef().filterCustomersTable = () => {
    const query = searchInput?.value.trim().toLowerCase() || "";
    const filteredRows = rows.filter((row) =>
      [row.name, row.email, row.phone, row.statusLabel].some((field) => field.toLowerCase().includes(query))
    );
    renderCustomerRows(filteredRows);
  };

  const exportButton = replaceInteractiveElement(
    Array.from(customersPage.querySelectorAll<HTMLButtonElement>(".dash-header .btn")).find((button) =>
      button.textContent?.trim().includes("Export")
    ) || null
  );
  const customerTable = customersPage.querySelector("table");
  exportButton?.addEventListener("click", () => {
    if (customerTable instanceof HTMLTableElement) {
      exportTable(customerTable, "versafic-customers.csv");
      showToast("Customer directory exported.", "success");
    }
  });
};

const updateAnalyticsPage = (state: DashboardState) => {
  const analyticsPage = document.getElementById("page-analytics");
  if (!analyticsPage) {
    return;
  }

  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-analytics"));
  const totalCalls = filteredState.callSessions.length;
  const totalChats = filteredState.chatHistory.length;
  const totalVoice = filteredState.voiceConversations.length;
  const totalInteractions = totalCalls + totalChats + totalVoice;
  const uniqueUsers = new Set(
    [
      ...filteredState.callSessions.map((session) => session.phone_number || session.from_number || session.to_number),
      ...filteredState.voiceConversations.map((conversation) => conversation.phone || conversation.email || conversation.customer_name || conversation.id),
    ].filter(Boolean)
  ).size;
  const totalDurationSeconds = filteredState.callSessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
  const avgDurationSeconds = filteredState.callSessions.length
    ? Math.round(totalDurationSeconds / filteredState.callSessions.length)
    : 0;
  const resolutionRate =
    filteredState.customerResolution?.rate ??
    (filteredState.callSessions.length
      ? Math.round(
          (filteredState.callSessions.filter((session) => session.status === "completed").length /
            filteredState.callSessions.length) *
            100
        )
      : 0);

  const statCards = Array.from(analyticsPage.querySelectorAll(".stat-card"));
  const metricValues = [
    formatNumber(totalInteractions),
    formatNumber(totalCalls),
    formatNumber(totalChats),
    formatDuration(avgDurationSeconds),
    formatNumber(uniqueUsers),
    `${resolutionRate}%`,
  ];
  statCards.forEach((card, index) => {
    const valueNode = card.querySelector(".stat-card-value");
    if (valueNode) {
      valueNode.textContent = metricValues[index] || "--";
    }
  });

  const containers = Array.from(analyticsPage.querySelectorAll(".chart-container"));
  setDonutBreakdown(containers[0], "Total", [
    { label: "Calls", value: totalCalls, color: "#6366f1" },
    { label: "Chats", value: totalChats, color: "#10b981" },
    { label: "Voice Leads", value: totalVoice, color: "#3b82f6" },
    { label: "Active Sessions", value: filteredState.activeCustomerSessions.length, color: "#ef4444" },
  ]);

  const byHour = new Array(13).fill(0).map((_, index) => ({
    label: `${index + 6}${index + 6 < 12 ? "AM" : index + 6 === 12 ? "PM" : "PM"}`,
    value: 0,
  }));
  filteredState.callSessions.forEach((session) => {
    const date = new Date(session.created_at);
    const hour = date.getHours();
    if (hour >= 6 && hour <= 18) {
      byHour[hour - 6].value += 1;
    }
  });
  renderSimpleBarColumns(
    "barPeakHours",
    byHour.map((item) => ({
      label: item.label,
      value: item.value,
      color: item.value === Math.max(...byHour.map((entry) => entry.value), 0) ? "linear-gradient(180deg,#10b981,#34d399)" : "linear-gradient(180deg,#6366f1,#818cf8)",
    }))
  );

  const trendMap = new Map<string, number>();
  [...filteredState.callSessions, ...filteredState.voiceConversations].forEach((item) => {
    const createdAt = "created_at" in item ? item.created_at : "";
    const dateKey = formatDate(createdAt);
    trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
  });
  renderSimpleBarColumns(
    "barVolumeTrends",
    Array.from(trendMap.entries())
      .slice(-8)
      .map(([label, value]) => ({
        label,
        value,
        color: "linear-gradient(180deg,#6366f1,#818cf8)",
      }))
  );

  const durationBuckets = [
    { label: "1-30s", value: 0, min: 1, max: 30 },
    { label: "31-60s", value: 0, min: 31, max: 60 },
    { label: "1-2m", value: 0, min: 61, max: 120 },
    { label: "2-5m", value: 0, min: 121, max: 300 },
    { label: "5m+", value: 0, min: 301, max: Number.MAX_SAFE_INTEGER },
  ];
  filteredState.callSessions.forEach((session) => {
    const duration = session.duration_seconds || 0;
    const bucket = durationBuckets.find((entry) => duration >= entry.min && duration <= entry.max);
    if (bucket) {
      bucket.value += 1;
    }
  });
  renderSimpleBarColumns(
    "barDuration",
    durationBuckets.map((bucket, index) => ({
      label: bucket.label,
      value: bucket.value,
      color: ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"][index],
    }))
  );

  const locationContainer = containers[3];
  const locationTitle = locationContainer?.querySelector(".chart-title");
  const locationSubtitle = locationContainer?.querySelector(".chart-subtitle");
  if (locationTitle) {
    locationTitle.textContent = "Top Regions";
  }
  if (locationSubtitle) {
    locationSubtitle.textContent = "Derived from backend phone activity";
  }
  const locationHeaders = locationContainer?.querySelectorAll("th");
  if (locationHeaders && locationHeaders.length >= 5) {
    locationHeaders[1].textContent = "Calls";
    locationHeaders[2].textContent = "Voice";
  }
  const regionMap = new Map<string, { calls: number; voice: number }>();
  filteredState.callSessions.forEach((session) => {
    const region = getRegionLabel(session.phone_number || session.from_number || session.to_number);
    const current = regionMap.get(region) || { calls: 0, voice: 0 };
    current.calls += 1;
    regionMap.set(region, current);
  });
  filteredState.voiceConversations.forEach((conversation) => {
    const region = getRegionLabel(conversation.phone);
    const current = regionMap.get(region) || { calls: 0, voice: 0 };
    current.voice += 1;
    regionMap.set(region, current);
  });
  const totalRegionVolume = Array.from(regionMap.values()).reduce((sum, entry) => sum + entry.calls + entry.voice, 0) || 1;
  const locationBody = locationContainer?.querySelector("tbody");
  if (locationBody) {
    const rows = Array.from(regionMap.entries())
      .sort((left, right) => right[1].calls + right[1].voice - (left[1].calls + left[1].voice))
      .slice(0, 5)
      .map(([region, counts]) => {
        const total = counts.calls + counts.voice;
        const share = Math.round((total / totalRegionVolume) * 100);
        return `
          <tr>
            <td style="font-weight:600;color:var(--text-primary)">${escapeHtml(region)}</td>
            <td>${escapeHtml(formatNumber(counts.calls))}</td>
            <td>${escapeHtml(formatNumber(counts.voice))}</td>
            <td>${escapeHtml(formatNumber(total))}</td>
            <td><span class="badge badge-green">${escapeHtml(`${share}%`)}</span></td>
          </tr>
        `;
      })
      .join("");

    locationBody.innerHTML =
      rows || `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No regional activity has synced yet.</td></tr>`;
  }

  const sentimentContainer = containers[5];
  const sentimentTitle = sentimentContainer?.querySelector(".chart-title");
  const sentimentSubtitle = sentimentContainer?.querySelector(".chart-subtitle");
  if (sentimentTitle) {
    sentimentTitle.textContent = "Sentiment & Resolution";
  }
  if (sentimentSubtitle) {
    sentimentSubtitle.textContent = "Live customer-service outcomes";
  }
  setDonutBreakdown(sentimentContainer, "Signals", [
    { label: "Positive", value: filteredState.customerSentiment?.positive || 0, color: "#6366f1" },
    { label: "Neutral", value: filteredState.customerSentiment?.neutral || 0, color: "#10b981" },
    { label: "Negative", value: filteredState.customerSentiment?.negative || 0, color: "#f59e0b" },
    { label: "Resolved", value: filteredState.customerResolution?.resolved || 0, color: "#ef4444" },
    { label: "Unresolved", value: filteredState.customerResolution?.unresolved || 0, color: "#8b5cf6" },
  ]);
};

const updateBookingsPage = (state: DashboardState) => {
  const bookingsPage = document.getElementById("page-bookings");
  if (!bookingsPage) {
    return;
  }

  const workflowFilter = getWindowRef().__versaficSelectedWorkflowFilter || "Active";
  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-bookings"));
  const workflowRows = buildWorkflowRows(filteredState);
  const activeRows = workflowFilter === "Today"
    ? workflowRows.filter((row) => row.date === formatDate(new Date().toISOString()))
    : workflowRows;

  const header = bookingsPage.querySelector(".dash-header h2");
  const subtitle = bookingsPage.querySelector(".dash-header p");
  if (header) {
    header.textContent = "🧩 Workflows";
  }
  if (subtitle) {
    subtitle.textContent = "Operational activity synced from live calls and voice conversations.";
  }

  const activeSection = bookingsPage.querySelector("#bookingSub-active");
  if (activeSection) {
    const sectionHeaders = activeSection.querySelectorAll(".section-header h3");
    if (sectionHeaders[0]) {
      sectionHeaders[0].textContent = "🟢 Live Backend Queue";
    }
    if (sectionHeaders[1]) {
      sectionHeaders[1].textContent = "Recent Workflow Records";
    }

    const activeTableBodies = activeSection.querySelectorAll("tbody");
    const queueBody = activeTableBodies[0];
    const recordsBody = activeTableBodies[1];

    if (queueBody) {
      queueBody.innerHTML =
        activeRows
          .slice(0, 5)
          .map(
            (row) => `
              <tr>
                <td style="font-weight:600;color:var(--text-primary)">${escapeHtml(row.time)}</td>
                <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.customer)}</td>
                <td>${escapeHtml(row.service)}</td>
                <td><span style="display:flex;align-items:center;gap:6px"><span class="chat-avatar ai" style="width:20px;height:20px;font-size:0.6rem">🤖</span>${escapeHtml(row.assignedTo)}</span></td>
                <td><span class="badge ${escapeHtml(row.statusBadge)}">${escapeHtml(row.statusLabel)}</span></td>
              </tr>
            `
          )
          .join("") ||
        `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No live workflow queue entries from the backend yet.</td></tr>`;
    }

    if (recordsBody) {
      recordsBody.innerHTML =
        workflowRows
          .slice(0, 8)
          .map(
            (row) => `
              <tr>
                <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.customer)}</td>
                <td>${escapeHtml(row.service)}</td>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.time)}</td>
                <td><span class="badge ${escapeHtml(row.statusBadge)}">${escapeHtml(row.statusLabel)}</span></td>
                <td>${escapeHtml(row.notes)}</td>
              </tr>
            `
          )
          .join("") ||
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No workflow records have synced from the backend yet.</td></tr>`;
    }

    const statCards = Array.from(activeSection.querySelectorAll(".stat-card"));
    const completed = filteredState.callSessions.filter((session) => session.status === "completed").length;
    const metrics = [
      formatNumber(workflowRows.length),
      formatNumber(activeRows.slice(0, 5).length),
      `${filteredState.customerResolution?.rate || 0}%`,
      formatNumber(filteredState.activeCustomerSessions.length),
    ];
    statCards.forEach((card, index) => {
      const valueNode = card.querySelector(".stat-card-value");
      if (valueNode) {
        valueNode.textContent = metrics[index] || (index === 2 ? `${completed}%` : "--");
      }
    });
  }

  const pastSection = bookingsPage.querySelector("#bookingSub-past");
  if (pastSection) {
    const title = pastSection.querySelector(".section-header h3");
    if (title) {
      title.textContent = "Archived Workflow Records";
    }
    const tbody = pastSection.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML =
        workflowRows
          .slice(5, 15)
          .map(
            (row) => `
              <tr>
                <td>${escapeHtml(row.date)}</td>
                <td>${escapeHtml(row.time)}</td>
                <td style="color:var(--text-primary);font-weight:600">${escapeHtml(row.customer)}</td>
                <td>${escapeHtml(row.service)}</td>
                <td>${escapeHtml(row.duration)}</td>
                <td><span class="badge ${escapeHtml(row.statusBadge)}">${escapeHtml(row.statusLabel)}</span></td>
              </tr>
            `
          )
          .join("") ||
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No archived workflow records are available yet.</td></tr>`;
    }
  }

  const calendarSection = bookingsPage.querySelector("#bookingSub-calendar");
  if (calendarSection) {
    calendarSection.innerHTML = `
      <div class="chart-container">
        <div class="section-header">
          <h3>Workflow Snapshot</h3>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
          <div style="padding:18px;border:1px solid var(--border);border-radius:var(--radius-md);background:rgba(255,255,255,0.02)">
            <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">Recent voice leads</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--text-primary)">${escapeHtml(formatNumber(filteredState.voiceConversations.length))}</div>
          </div>
          <div style="padding:18px;border:1px solid var(--border);border-radius:var(--radius-md);background:rgba(255,255,255,0.02)">
            <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">Live call sessions</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--text-primary)">${escapeHtml(formatNumber(filteredState.callSessions.length))}</div>
          </div>
          <div style="padding:18px;border:1px solid var(--border);border-radius:var(--radius-md);background:rgba(255,255,255,0.02)">
            <div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:8px">Resolved interactions</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--text-primary)">${escapeHtml(formatNumber(filteredState.customerResolution?.resolved || 0))}</div>
          </div>
        </div>
      </div>
    `;
  }

  const scheduleSection = bookingsPage.querySelector("#bookingSub-schedule");
  if (scheduleSection) {
    scheduleSection.innerHTML = `
      <div class="chart-container">
        <div class="section-header">
          <h3>Live Activity Timeline</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:1px;background:var(--border);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;">
          ${
            workflowRows.slice(0, 6).map((row) => `
              <div style="display:flex;background:#fff;padding:12px 16px;">
                <div style="width:96px;font-weight:600;color:var(--text-muted);font-size:0.85rem;">${escapeHtml(row.time)}</div>
                <div style="flex:1;">
                  <div class="booking-card" style="margin:0;display:flex;align-items:center;gap:12px;">
                    <div class="chat-avatar ai" style="width:36px;height:36px;font-size:1rem;">🤖</div>
                    <div style="flex:1">
                      <div class="booking-name" style="font-size:0.95rem;">${escapeHtml(row.customer)}</div>
                      <div style="font-size:0.8rem;color:var(--text-muted);">${escapeHtml(row.service)}</div>
                    </div>
                    <div style="text-align:right">
                      <span class="badge ${escapeHtml(row.statusBadge)}" style="font-size:0.7rem">${escapeHtml(row.statusLabel)}</span>
                    </div>
                  </div>
                </div>
              </div>
            `).join("") || `<div style="display:flex;background:#fff;padding:12px 16px;"><div style="flex:1;color:var(--text-muted);font-size:0.85rem;font-style:italic;">No live workflow timeline data is available yet.</div></div>`
          }
        </div>
      </div>
    `;
  }

  const holidaysSection = bookingsPage.querySelector("#bookingSub-holidays");
  if (holidaysSection) {
    const notices = [
      {
        date: formatDate(new Date().toISOString()),
        event: "AI calling line",
        source: "Calls",
        status: filteredState.callConfig?.configured ? "Configured" : "Needs setup",
        badge: filteredState.callConfig?.configured ? "badge-green" : "badge-amber",
        notes: filteredState.callConfig?.ai_number
          ? `Live AI number ${filteredState.callConfig.ai_number}`
          : "No public AI number is available yet.",
      },
      {
        date: formatDate(new Date().toISOString()),
        event: "Autopay rule",
        source: "Billing",
        status: filteredState.autopay?.settings?.enabled ? "Enabled" : "Manual",
        badge: filteredState.autopay?.settings?.enabled ? "badge-green" : "badge-blue",
        notes: filteredState.autopay?.settings
          ? `Threshold ${formatNumber(filteredState.autopay.settings.threshold_credits)} credits in ${filteredState.autopay.settings.mode} mode.`
          : "Recharge is currently handled through manual Razorpay checkout.",
      },
      {
        date: formatDate(new Date().toISOString()),
        event: "Business profile",
        source: "Setup",
        status: filteredState.setup?.businessName ? "Ready" : "Pending",
        badge: filteredState.setup?.businessName ? "badge-green" : "badge-amber",
        notes: filteredState.setup?.businessName
          ? `${filteredState.setup.businessName} is configured for ${filteredState.setup.businessType || "customer support"}.`
          : "Complete onboarding to unlock the full workspace flow.",
      },
      {
        date: formatDate(new Date().toISOString()),
        event: "Workflow activity",
        source: "Operations",
        status: workflowRows.length ? "Synced" : "Idle",
        badge: workflowRows.length ? "badge-green" : "badge-blue",
        notes: workflowRows.length
          ? `${formatNumber(workflowRows.length)} workflow records are available for the active date filter.`
          : "No workflow records are available for the current date filter.",
      },
    ];

    holidaysSection.innerHTML = `
      <div class="chart-container">
        <div class="section-header">
          <h3>Backend Notices</h3>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Event Name</th>
                <th>Source</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${notices
                .map(
                  (notice) => `
                    <tr>
                      <td>${escapeHtml(notice.date)}</td>
                      <td style="color:var(--text-primary);font-weight:600">${escapeHtml(notice.event)}</td>
                      <td>${escapeHtml(notice.source)}</td>
                      <td><span class="badge ${escapeHtml(notice.badge)}">${escapeHtml(notice.status)}</span></td>
                      <td>${escapeHtml(notice.notes)}</td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
};

const updateCallsPage = (state: DashboardState) => {
  const callsPage = document.getElementById("page-calls");
  if (!callsPage) {
    return;
  }

  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-calls"));
  const sessions = filteredState.callSessions;
  const uniqueCallers = new Set(sessions.map((session) => session.phone_number || session.from_number || session.to_number)).size;
  const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
  const completedCalls = sessions.filter((session) => session.status === "completed").length;
  const failedCalls = sessions.filter((session) => ["failed", "no-answer"].includes(session.status)).length;
  const missedCalls = sessions.filter((session) => session.status === "no-answer").length;
  const resolutionRate = sessions.length ? Math.round((completedCalls / sessions.length) * 100) : 0;
  const dropRate = sessions.length ? ((failedCalls / sessions.length) * 100).toFixed(1) : "0.0";
  const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length) : 0;

  updateSidebarBadge("calls", sessions.length);

  const statCards = Array.from(callsPage.querySelectorAll(".stat-card"));
  const metrics = [
    formatNumber(sessions.length),
    formatNumber(uniqueCallers),
    formatDuration(avgDuration),
    `${resolutionRate}%`,
    `${dropRate}%`,
    filteredState.callConfig?.configured ? "Live" : "Off",
    formatNumber(failedCalls),
  ];
  statCards.forEach((card, index) => {
    const valueNode = card.querySelector(".stat-card-value");
    if (valueNode) {
      valueNode.textContent = metrics[index] || "--";
    }
  });

  const rows = sessions.map((session) => ({
    name: session.phone_number || session.from_number || session.to_number,
    intent:
      session.purpose?.replace(/_/g, " ") ||
      (session.type === "incoming" ? "Incoming Support" : "Outbound Follow-up"),
    intentBadge: session.type === "incoming" ? "badge-blue" : "badge-purple",
    outcome: session.status === "completed" ? "Resolved" : session.status === "no-answer" ? "Missed" : session.status,
    outcomeColor:
      session.status === "completed" ? "var(--green)" : session.status === "no-answer" ? "var(--amber)" : "var(--red)",
    status: session.status,
    date: formatDate(session.created_at),
    duration: formatDuration(session.duration_seconds),
    credits: String(session.cost_credits || filteredState.callConfig?.call_credit_cost || 20),
  }));

  getWindowRef().__versaficCallRows = rows;
  renderCallRows(rows);

  getWindowRef().filterCallsTable = () => {
    const searchValue = (document.getElementById("callSearchInput") as HTMLInputElement | null)?.value.toLowerCase() || "";
    const intentValue = (document.getElementById("callIntentFilter") as HTMLSelectElement | null)?.value.toLowerCase() || "";
    const filtered = (getWindowRef().__versaficCallRows || []).filter((row) => {
      const matchesSearch = row.name.toLowerCase().includes(searchValue);
      const matchesIntent = intentValue ? row.intent.toLowerCase().includes(intentValue) : true;
      return matchesSearch && matchesIntent;
    });
    renderCallRows(filtered);
  };

  const exportButton = replaceInteractiveElement(
    callsPage.querySelector<HTMLButtonElement>(".dash-header .btn.btn-primary.btn-sm")
  );
  const callTable = callsPage.querySelector("table");
  exportButton?.addEventListener("click", () => {
    if (callTable instanceof HTMLTableElement) {
      exportTable(callTable, "versafic-calls.csv");
      showToast("Call log exported.", "success");
    }
  });

  const outcomeContainer = Array.from(callsPage.querySelectorAll(".chart-container"))[1];
  const subtitle = outcomeContainer?.querySelector(".chart-subtitle");
  if (subtitle) {
    subtitle.textContent = "Live backend outcome mix";
  }
  setDonutBreakdown(outcomeContainer, "Calls", [
    { label: "Resolved", value: completedCalls, color: "#10b981" },
    { label: "Missed", value: missedCalls, color: "#f59e0b" },
    { label: "Failed", value: failedCalls - missedCalls, color: "#ef4444" },
    { label: "Other", value: Math.max(0, sessions.length - completedCalls - failedCalls), color: "#6b7280" },
  ]);
};

const updateChatsPage = (state: DashboardState) => {
  const chatsPage = document.getElementById("page-chats");
  if (!chatsPage) {
    return;
  }

  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-chats"));
  const totalMessages = filteredState.chatHistory.length;
  updateSidebarBadge("chats", totalMessages);
  const rows = filteredState.chatHistory.map((item) => ({
    name: item.message.slice(0, 24) || "Customer message",
    intent: "AI Chat",
    intentBadge: "badge-green",
    outcome: "Responded",
    outcomeColor: "var(--green)",
    status: "Completed",
    date: formatDate(item.created_at || item.createdAt || null),
    messages: `${Math.max(2, Math.ceil(item.message.length / 60))} msgs`,
    credits: "2",
  }));

  getWindowRef().__versaficChatRows = rows;
  renderChatRows(rows);

  getWindowRef().filterChatsTable = () => {
    const searchValue = (document.getElementById("chatSearchInput") as HTMLInputElement | null)?.value.toLowerCase() || "";
    const filtered = (getWindowRef().__versaficChatRows || []).filter((row) => row.name.toLowerCase().includes(searchValue));
    renderChatRows(filtered);
  };

  const statCards = Array.from(chatsPage.querySelectorAll(".stat-card"));
  const totalTokens = filteredState.chatHistory.reduce(
    (sum, item) => sum + (item.tokens_used || item.tokensUsed || 0),
    0
  );
  const recentChats = filteredState.chatHistory.filter((item) =>
    matchesDateFilter(item.created_at || item.createdAt || null, "1 DAY")
  ).length;
  const longThreads = filteredState.chatHistory.filter((item) => item.message.length > 120).length;
  const values = [
    formatNumber(totalMessages),
    formatNumber(filteredState.chatHistory.length),
    formatNumber(Math.ceil(totalTokens / 100 || 0)),
    "Synced",
    formatNumber(totalTokens),
    filteredState.chatHistory[0]
      ? formatDate(filteredState.chatHistory[0].created_at || filteredState.chatHistory[0].createdAt || null)
      : "--",
    formatNumber(totalMessages * 2),
  ];
  statCards.forEach((card, index) => {
    const valueNode = card.querySelector(".stat-card-value");
    if (valueNode && values[index]) {
      valueNode.textContent = values[index];
    }
  });

  const exportButton = replaceInteractiveElement(
    chatsPage.querySelector<HTMLButtonElement>(".dash-header .btn.btn-primary.btn-sm")
  );
  const chatTable = chatsPage.querySelector("table");
  exportButton?.addEventListener("click", () => {
    if (chatTable instanceof HTMLTableElement) {
      exportTable(chatTable, "versafic-chats.csv");
      showToast("Chat history exported.", "success");
    }
  });

  const outcomeContainer = Array.from(chatsPage.querySelectorAll(".chart-container"))[1];
  const title = outcomeContainer?.querySelector(".chart-title");
  const subtitle = outcomeContainer?.querySelector(".chart-subtitle");
  if (title) {
    title.textContent = "Chat Activity";
  }
  if (subtitle) {
    subtitle.textContent = "Derived from live backend chat history";
  }
  setDonutBreakdown(outcomeContainer, "Chats", [
    { label: "Responded", value: totalMessages, color: "#10b981" },
    { label: "Recent", value: recentChats, color: "#f59e0b" },
    { label: "Long Threads", value: longThreads, color: "#ef4444" },
    { label: "Token Heavy", value: filteredState.chatHistory.filter((item) => (item.tokens_used || item.tokensUsed || 0) > 500).length, color: "#6b7280" },
  ]);
};

const bindAiSettingsPanel = async (state: DashboardState) => {
  const settingsPage = document.getElementById("page-agent");
  if (!settingsPage) {
    return;
  }

  const displayNameSelect = settingsPage.querySelector<HTMLSelectElement>("#aiDisplayName");
  const greetingTextarea = settingsPage.querySelector<HTMLTextAreaElement>("#aiGreetingMessage");
  const businessNameInput = settingsPage.querySelector<HTMLInputElement>("#aiBusinessName");
  const aiNumberInput = settingsPage.querySelector<HTMLInputElement>("#aiNumberDisplay");
  const consentToggle = settingsPage.querySelector<HTMLInputElement>("#aiCallConsentToggle");
  const optOutToggle = settingsPage.querySelector<HTMLInputElement>("#aiCallOptOutToggle");
  const consentHint = settingsPage.querySelector<HTMLElement>("#aiConsentHint");
  const languageSelect = settingsPage.querySelector<HTMLSelectElement>("#aiLanguage");

  if (businessNameInput && state.setup?.businessName) {
    businessNameInput.value = state.setup.businessName;
  }
  if (greetingTextarea && state.callConfig?.intro_message) {
    greetingTextarea.value = `${state.callConfig.intro_message} How can I help you today?`;
  }
  if (aiNumberInput) {
    aiNumberInput.value = state.callConfig?.ai_number || "Not configured yet";
  }
  if (consentToggle) {
    consentToggle.checked = Boolean(state.user?.call_consent);
  }
  if (optOutToggle) {
    optOutToggle.checked = Boolean(state.user?.call_opt_out);
  }
  if (consentHint) {
    consentHint.textContent = state.user?.call_opt_out
      ? "This account is currently opted out of AI outbound calls."
      : state.user?.call_consent
        ? "This account has saved consent for AI outbound calls."
        : "Enable consent if you want this account to receive AI outbound calls.";
  }
  const updateConsentHint = () => {
    if (!consentHint) {
      return;
    }

    consentHint.textContent = optOutToggle?.checked
      ? "This account is currently opted out of AI outbound calls."
      : consentToggle?.checked
        ? "This account has saved consent for AI outbound calls."
        : "Enable consent if you want this account to receive AI outbound calls.";
  };
  consentToggle?.addEventListener("change", updateConsentHint);
  optOutToggle?.addEventListener("change", updateConsentHint);
  if (languageSelect) {
    languageSelect.value = "English (US)";
  }

  const saveButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>(".dash-header .btn.btn-primary.btn-sm")
  );

  saveButton?.addEventListener("click", async () => {
    const businessName = businessNameInput?.value.trim() || state.setup?.businessName || "";
    const user = state.user;
    if (!user?.email) {
      showToast("Log in again before saving settings.", "warn");
      return;
    }

    try {
      await updateCurrentUser({
        call_consent: consentToggle?.checked ?? state.user?.call_consent ?? false,
        call_opt_out: optOutToggle?.checked ?? state.user?.call_opt_out ?? false,
      });

      await saveSetupBusiness({
        businessName,
        businessType: state.setup?.businessType || "Business",
        industry: state.setup?.industry || "AI Services",
        phone: state.setup?.phone || state.user?.phone_number || "",
        country: state.setup?.country || "",
      });

      const businesses = await getBusinessList(50);
      const ownBusiness = businesses.find((business) => business.email === user.email);
      if (ownBusiness) {
        await updateBusiness(ownBusiness.id, {
          business_name: businessName,
          business_type: state.setup?.industry || ownBusiness.business_type,
          owner_name: user.name || ownBusiness.owner_name,
          phone: state.setup?.phone || ownBusiness.phone,
          email: ownBusiness.email,
        });
      }

      showToast(
        `${displayNameSelect?.value || "Assistant"} settings saved. AI number and call consent are now synced to your account.`,
        "success"
      );
    } catch (error) {
      const message = error instanceof LegacyApiError ? error.message : "Unable to save settings right now.";
      showToast(message, "warn");
    }
  });

  const customerServicePanel = document.getElementById("testPanelWrap");
  if (customerServicePanel) {
    const testNote = customerServicePanel.querySelector("p");
    if (testNote) {
      testNote.textContent = "This panel now sends messages through the live customer-service backend flow.";
    }
  }

  const chatInput = document.getElementById("chatInput") as HTMLInputElement | null;
  const chatMessages = document.getElementById("chatMessages");
  const sendButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>("#testPanelWrap .btn.btn-primary.btn-sm")
  );

  const sendLiveCustomerMessage = async () => {
    if (!chatInput || !chatMessages) {
      return;
    }

    const message = chatInput.value.trim();
    if (!message) {
      return;
    }

    chatMessages.insertAdjacentHTML(
      "beforeend",
      `<div class="chat-bubble user"><div class="chat-avatar user">👤</div><div class="chat-msg">${message}</div></div>`
    );
    chatInput.value = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
      let sessionId = getWindowRef().__versaficCustomerServiceSessionId || null;
      if (!sessionId) {
        const session = await startCustomerServiceSession();
        sessionId = session.sessionId;
        getWindowRef().__versaficCustomerServiceSessionId = sessionId;
      }

      const reply = await sendCustomerServiceChat({
        sessionId,
        textMessage: message,
        languageCode: "en",
      });

      chatMessages.insertAdjacentHTML(
        "beforeend",
        `<div class="chat-bubble"><div class="chat-avatar ai">🤖</div><div class="chat-msg">${reply.aiResponse}</div></div>`
      );
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      const messageText =
        error instanceof LegacyApiError ? error.message : "The AI test panel could not reach the backend.";
      showToast(messageText, "warn");
    }
  };

  getWindowRef().sendChat = sendLiveCustomerMessage;
  sendButton?.addEventListener("click", sendLiveCustomerMessage);
};

const bindDashboardFilterControls = (state: DashboardState) => {
  const win = getWindowRef();

  if (!win.__versaficSelectedDateFilters) {
    win.__versaficSelectedDateFilters = {
      "page-overview": "7D",
      "page-calls": "7D",
      "page-chats": "7D",
      "page-customers": "7D",
      "page-analytics": "7D",
      "page-bookings": "7D",
    };
  }

  if (!win.__versaficSelectedWorkflowFilter) {
    win.__versaficSelectedWorkflowFilter = "Active";
  }

  win.setDateFilter = (button: HTMLElement) => {
    const filterBar = button.closest(".date-filter-bar");
    filterBar?.querySelectorAll(".date-filter-btn").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");

    const page = button.closest(".page");
    const filterKey = button.textContent?.trim() || "7D";
    if (!page?.id) {
      return;
    }

    setSelectedDateFilter(page.id, filterKey);

    switch (page.id) {
      case "page-overview":
        updateDashboardSummary(filterDashboardState(state, filterKey));
        break;
      case "page-calls":
        updateCallsPage(state);
        break;
      case "page-chats":
        updateChatsPage(state);
        break;
      case "page-customers":
        updateCustomersPage(state);
        break;
      case "page-analytics":
        updateAnalyticsPage(state);
        break;
      case "page-bookings":
        updateBookingsPage(state);
        break;
      default:
        break;
    }

    showToast(`Showing live backend data for ${filterKey}.`, "info");
  };

  win.setBookingFilter = (button: HTMLElement) => {
    const group = button.closest(".booking-top-filters");
    group?.querySelectorAll(".booking-filter-pill").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    win.__versaficSelectedWorkflowFilter = button.textContent?.trim() || "Active";
    updateBookingsPage(state);
  };
};

const buildDashboardState = (
  user: DashboardState["user"],
  existingState?: DashboardState | null,
  overrides: Partial<DashboardState> = {}
): DashboardState => ({
  user,
  wallet: overrides.wallet ?? existingState?.wallet ?? createEmptyWallet(),
  plans: overrides.plans ?? existingState?.plans ?? [],
  autopay: overrides.autopay ?? existingState?.autopay ?? null,
  setup: overrides.setup ?? existingState?.setup ?? null,
  setupStatus: overrides.setupStatus ?? existingState?.setupStatus ?? null,
  callConfig: overrides.callConfig ?? existingState?.callConfig ?? null,
  callSessions: overrides.callSessions ?? existingState?.callSessions ?? [],
  chatHistory: overrides.chatHistory ?? existingState?.chatHistory ?? [],
  chatStats: overrides.chatStats ?? existingState?.chatStats ?? null,
  voiceStats: overrides.voiceStats ?? existingState?.voiceStats ?? null,
  voiceConversations: overrides.voiceConversations ?? existingState?.voiceConversations ?? [],
  resolvedInteractions: overrides.resolvedInteractions ?? existingState?.resolvedInteractions ?? [],
  customerSentiment: overrides.customerSentiment ?? existingState?.customerSentiment ?? null,
  customerResolution: overrides.customerResolution ?? existingState?.customerResolution ?? null,
  activeCustomerSessions: overrides.activeCustomerSessions ?? existingState?.activeCustomerSessions ?? [],
});

const applyDashboardState = async (state: DashboardState) => {
  getWindowRef().__versaficDashboardState = state;
  bindDashboardFilterControls(state);
  bindDashboardNavigation();
  updateSidebarIdentity(state);

  const backHome = replaceInteractiveElement(document.querySelector<HTMLAnchorElement>("aside .btn"));
  backHome?.setAttribute("href", "/");

  updateDashboardSummary(filterDashboardState(state, getSelectedDateFilter("page-overview")));
  updateBillingPage(state);
  updateCallsPage(state);
  updateChatsPage(state);
  updateCustomersPage(state);
  updateAnalyticsPage(state);
  updateBookingsPage(state);
  await bindAiSettingsPanel(state);
  primeRazorpayCheckout();
};

const markDashboardPagesLoaded = (...pageIds: string[]) => {
  const win = getWindowRef();
  win.__versaficLoadedDashboardPages = win.__versaficLoadedDashboardPages || {};
  pageIds.forEach((pageId) => {
    win.__versaficLoadedDashboardPages![pageId] = true;
  });
};

const loadDashboardPageData = async (pageId: string) => {
  if (!isDashboardRoute() || pageId === "overview" || pageId === "calls") {
    return;
  }

  const win = getWindowRef();
  win.__versaficLoadedDashboardPages = win.__versaficLoadedDashboardPages || {};
  if (win.__versaficLoadedDashboardPages[pageId]) {
    return;
  }

  const existingLoader = dashboardLazyLoaders.get(pageId);
  if (existingLoader) {
    await existingLoader;
    return;
  }

  const loader = (async () => {
    const currentState = win.__versaficDashboardState;
    if (!currentState?.user) {
      return;
    }

    let nextState = currentState;

    if (pageId === "credits") {
      const [autopayResult, setupStatusResult] = await Promise.allSettled([getAutopayStatus(), getSetupStatus()]);
      nextState = buildDashboardState(currentState.user, win.__versaficDashboardState, {
        autopay: autopayResult.status === "fulfilled" ? autopayResult.value : win.__versaficDashboardState?.autopay,
        setupStatus:
          setupStatusResult.status === "fulfilled" ? setupStatusResult.value : win.__versaficDashboardState?.setupStatus,
      });
      markDashboardPagesLoaded("credits");
    } else if (pageId === "chats") {
      const [chatHistoryResult, chatStatsResult] = await Promise.allSettled([getChatHistory(25), getChatStats()]);
      nextState = buildDashboardState(currentState.user, win.__versaficDashboardState, {
        chatHistory:
          chatHistoryResult.status === "fulfilled" ? chatHistoryResult.value.messages : win.__versaficDashboardState?.chatHistory,
        chatStats: chatStatsResult.status === "fulfilled" ? chatStatsResult.value : win.__versaficDashboardState?.chatStats,
      });
      markDashboardPagesLoaded("chats");
    } else if (pageId === "agent") {
      const [setupResult, setupStatusResult] = await Promise.allSettled([getSetupBusiness(), getSetupStatus()]);
      nextState = buildDashboardState(currentState.user, win.__versaficDashboardState, {
        setup: setupResult.status === "fulfilled" ? setupResult.value : win.__versaficDashboardState?.setup,
        setupStatus:
          setupStatusResult.status === "fulfilled" ? setupStatusResult.value : win.__versaficDashboardState?.setupStatus,
      });
      markDashboardPagesLoaded("agent");
    } else if (["customers", "analytics", "bookings"].includes(pageId)) {
      const [
        chatHistoryResult,
        chatStatsResult,
        voiceStatsResult,
        voiceConversationsResult,
        resolvedInteractionsResult,
        customerSentimentResult,
        customerResolutionResult,
        activeCustomerSessionsResult,
      ] = await Promise.allSettled([
        getChatHistory(25),
        getChatStats(),
        getVoiceStats(),
        getRecentVoiceConversations(12),
        getResolvedInteractions(25),
        getCustomerSentimentStats(),
        getCustomerResolutionStats(),
        getCustomerServiceActiveSessions(),
      ]);

      nextState = buildDashboardState(currentState.user, win.__versaficDashboardState, {
        chatHistory:
          chatHistoryResult.status === "fulfilled" ? chatHistoryResult.value.messages : win.__versaficDashboardState?.chatHistory,
        chatStats: chatStatsResult.status === "fulfilled" ? chatStatsResult.value : win.__versaficDashboardState?.chatStats,
        voiceStats: voiceStatsResult.status === "fulfilled" ? voiceStatsResult.value : win.__versaficDashboardState?.voiceStats,
        voiceConversations:
          voiceConversationsResult.status === "fulfilled"
            ? voiceConversationsResult.value
            : win.__versaficDashboardState?.voiceConversations,
        resolvedInteractions:
          resolvedInteractionsResult.status === "fulfilled"
            ? resolvedInteractionsResult.value
            : win.__versaficDashboardState?.resolvedInteractions,
        customerSentiment:
          customerSentimentResult.status === "fulfilled"
            ? customerSentimentResult.value
            : win.__versaficDashboardState?.customerSentiment,
        customerResolution:
          customerResolutionResult.status === "fulfilled"
            ? customerResolutionResult.value
            : win.__versaficDashboardState?.customerResolution,
        activeCustomerSessions:
          activeCustomerSessionsResult.status === "fulfilled"
            ? activeCustomerSessionsResult.value
            : win.__versaficDashboardState?.activeCustomerSessions,
      });
      markDashboardPagesLoaded("customers", "analytics", "bookings");
    }

    await applyDashboardState(nextState);
  })()
    .catch((error) => {
      console.error(`Failed to load dashboard data for ${pageId}`, error);
    })
    .finally(() => {
      dashboardLazyLoaders.delete(pageId);
    });

  dashboardLazyLoaders.set(pageId, loader);
  await loader;
};

const bindDashboardPage = async () => {
  if (dashboardRefreshInFlight) {
    return;
  }

  dashboardRefreshInFlight = true;

  try {
  let user = getStoredUser();

  if (!user) {
    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }
  }

  const existingState = getWindowRef().__versaficDashboardState;
  const initialState = buildDashboardState(user, existingState);
  await applyDashboardState(initialState);

  const [
    walletResult,
    plansResult,
    callConfigResult,
    callSessionsResult,
  ] = await Promise.allSettled([
    getWallet(),
    getPlans(),
    getCallConfig(),
    getCallSessions(12),
  ]);

  const state = buildDashboardState(user, existingState, {
    wallet: walletResult.status === "fulfilled" ? walletResult.value : existingState?.wallet,
    plans: plansResult.status === "fulfilled" ? plansResult.value.plans : existingState?.plans,
    callConfig: callConfigResult.status === "fulfilled" ? callConfigResult.value : existingState?.callConfig,
    callSessions:
      callSessionsResult.status === "fulfilled" ? callSessionsResult.value.sessions : existingState?.callSessions,
  });

  await applyDashboardState(state);
  markDashboardPagesLoaded("overview", "calls");
  void loadDashboardPageData(getDashboardPageFromLocation());
  } finally {
    dashboardRefreshInFlight = false;
  }
};

const refreshDashboardData = async () => {
  if (!isDashboardRoute()) {
    return;
  }

  try {
    await bindDashboardPage();
  } catch (error) {
    console.error("Failed to refresh dashboard data", error);
  }
};

const initializePage = async (pageKey: string) => {
  if (pageKey === "home" || pageKey === "login") {
    await bindHomePage();
    return;
  }

  if (pageKey === "onboarding") {
    await bindOnboardingPage();
    return;
  }

  if (pageKey === "search") {
    await bindSearchPage();
    return;
  }

  if (pageKey.startsWith("profile-")) {
    await bindProfilePage(pageKey);
    return;
  }

  if (pageKey.startsWith("dashboard")) {
    await bindDashboardPage();
  }
};

export function LegacyBindings({ pageKey }: LegacyBindingsProps) {
  useEffect(() => {
    if (pageKey.startsWith("dashboard")) {
      bindDashboardNavigation();
      bootstrapSidebarIdentityFromSession();
      const storedUser = getStoredUser();
      if (storedUser) {
        void applyDashboardState(buildDashboardState(storedUser, getWindowRef().__versaficDashboardState));
      }
    }

    window.setTimeout(() => {
      void initializePage(pageKey).catch((error) => {
        console.error(`Failed to initialize legacy bindings for ${pageKey}`, error);
      });
    }, 0);
  }, [pageKey]);

  useEffect(() => {
    if (!pageKey.startsWith("dashboard")) {
      return;
    }

    const handleDataChanged = () => {
      getWindowRef().__versaficLoadedDashboardPages = {};
      queueDashboardRefresh(700);
    };
    const handleFocus = () => queueDashboardRefresh(350);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        queueDashboardRefresh(350);
      }
    };

    window.addEventListener(DATA_CHANGED_EVENT, handleDataChanged as EventListener);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(DATA_CHANGED_EVENT, handleDataChanged as EventListener);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (dashboardRefreshTimer) {
        window.clearTimeout(dashboardRefreshTimer);
        dashboardRefreshTimer = null;
      }
    };
  }, [pageKey]);

  return null;
}
