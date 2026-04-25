"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  BillingPlan,
  BusinessRecord,
  CallSession,
  ChatHistoryItem,
  ChatStats,
  CustomerResolutionStats,
  CustomerSentimentStats,
  CustomerServiceInteraction,
  AutopayTriggerResponse,
  RazorpayCheckoutOrder,
  VoiceConversation,
  getOAuthStartUrl,
  createBusinessRecord,
  createOrder,
  enableAutopay,
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
  getSmsConfig,
  getSetupBusiness,
  getSetupStatus,
  getPreferredPlanId,
  getStoredSession,
  getStoredUser,
  getVoiceStats,
  getWallet,
  clearSession,
  LegacyApiError,
  login,
  register,
  requestPasswordReset,
  saveSetupBusiness,
  sendSmsDemo,
  sendTestEmail,
  sendCustomerServiceChat,
  simulateExotelIncoming,
  startExotelCall,
  setPreferredPlanId,
  startCustomerServiceSession,
  triggerAutopay,
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

type PublicCallConfig = Awaited<ReturnType<typeof getPublicCallConfig>>;

type RazorpayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  lucide?: { createIcons: () => void };
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
  setBookingSubNav?: (button: HTMLElement, sectionId: string) => void;
  toggleBookingView?: (view: "main" | "settings") => void;
  renderWeeklyCalendar?: () => void;
  renderActiveBookings?: () => void;
  renderPastBookings?: () => void;
  renderWeeklySchedule?: () => void;
  renderBlockedSlots?: () => void;
  renderHolidays?: () => void;
  doSearch?: () => void;
  startCall?: () => void;
  simulateCall?: () => void;
  openModal?: () => void;
  closeModal?: () => void;
  submitBooking?: (event: Event) => void;
  openDayDetail?: (dateValue: string) => void;
  saveSchedule?: () => void;
  addBlockedSlot?: () => void;
  addHoliday?: () => void;
  exportTableCSV?: (bodyId: string, filename: string) => void;
  openCallModal?: () => void;
  closeCallModal?: () => void;
  __versaficOriginalNextStep?: () => void;
  __versaficOnboardingAccountCreated?: boolean;
  __versaficCustomerServiceSessionId?: string | null;
  __versaficSearchBusinesses?: DirectoryBusiness[];
  __versaficSearchFiltered?: DirectoryBusiness[];
  __versaficActiveSearchKind?: string;
  __versaficSearchSelectedKinds?: string[];
  __versaficSearchContactFilters?: string[];
  __versaficSearchDirectoryFilters?: string[];
  __versaficCurrentBusiness?: DirectoryBusiness | null;
  __versaficDashboardState?: DashboardState;
  __versaficCallRows?: Array<Record<string, string>>;
  __versaficChatRows?: Array<Record<string, string>>;
  __versaficCustomerRows?: Array<Record<string, string>>;
  __versaficSelectedDateFilters?: Record<string, string>;
  __versaficSelectedBookingFilter?: string;
  __versaficDashboardPopstateBound?: boolean;
  __versaficLoadedDashboardPages?: Record<string, boolean>;
  __versaficRefreshIcons?: () => void;
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
let activeBookingsPage = 1;
let pastBookingsPage = 1;
let bookingCalendarMonth = new Date();
let publicCallConfigCache: PublicCallConfig | null = null;
let publicCallConfigPromise: Promise<PublicCallConfig | null> | null = null;

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
    case "chats":
      return "/dashboard/chats";
    case "bookings":
      return "/dashboard/bookings";
    case "customers":
      return "/dashboard/customers";
    case "analytics":
      return "/dashboard/analytics";
    case "credits":
      return "/dashboard/billing";
    case "agent":
      return "/dashboard/agent";
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
  if (pathname.endsWith("/chats")) {
    return "chats";
  }
  if (pathname.endsWith("/bookings")) {
    return "bookings";
  }
  if (pathname.endsWith("/customers")) {
    return "customers";
  }
  if (pathname.endsWith("/analytics")) {
    return "analytics";
  }
  if (pathname.endsWith("/billing")) {
    return "credits";
  }
  if (pathname.endsWith("/agent")) {
    return "agent";
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
  let badge = document.querySelector<HTMLElement>(`.sidebar-live-badge[data-badge-for="${pageId}"]`);
  if (!badge) {
    const navIndex = pageId === "calls" ? 2 : 3;
    badge = document.querySelector<HTMLElement>(`.sidebar-nav .nav-item:nth-child(${navIndex}) .badge`);
    if (badge) {
      badge.classList.add("sidebar-live-badge");
      badge.dataset.badgeFor = pageId;
    }
  }
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
  const identityBlock =
    document.querySelector(".sidebar-header [style*='margin-top:16px']") ||
    document.querySelector(".sidebar-header > div:last-of-type");
  const fallbackTextWrap = identityBlock?.querySelector("div:last-child");

  const nameNode =
    document.querySelector<HTMLElement>(".sidebar-user-name") ||
    fallbackTextWrap?.querySelector<HTMLElement>("div:first-child") ||
    null;
  const subtitleNode =
    document.querySelector<HTMLElement>(".sidebar-user-subtitle") ||
    fallbackTextWrap?.querySelector<HTMLElement>("div:nth-child(2)") ||
    null;
  const initialsNode =
    document.querySelector<HTMLElement>(".sidebar-user-initials") ||
    identityBlock?.querySelector<HTMLElement>("div:first-child") ||
    null;

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

  const currentUrl = `${window.location.pathname}${window.location.search}`;
  const normalizedInitialUrl = getDashboardUrlForPage(initialPageId);
  if (currentUrl !== normalizedInitialUrl) {
    window.history.replaceState({ pageId: initialPageId }, "", normalizedInitialUrl);
  }
};

const escapeHtml = (value?: string | number | null) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const iconHtml = (name: string, extraClass = "vf-icon") =>
  `<span class="vf-icon-wrap"><i data-lucide="${escapeHtml(name)}" class="${escapeHtml(extraClass)}"></i></span>`;

const iconLabelHtml = (name: string, text: string, extraClass = "vf-icon") =>
  `${iconHtml(name, extraClass)} ${escapeHtml(text)}`;

const refreshLegacyIcons = () => {
  window.setTimeout(() => {
    try {
      getWindowRef().__versaficRefreshIcons?.();
    } catch (error) {
      console.error("Failed to refresh legacy icons", error);
    }
  }, 0);
};

const setDashboardReady = (ready: boolean) => {
  document.querySelector<HTMLElement>(".app-layout")?.setAttribute("data-dashboard-ready", ready ? "true" : "false");
};

const normalizeText = (value?: string | null) => value?.trim() || "";

const primePublicCallConfig = (): Promise<PublicCallConfig | null> => {
  if (!publicCallConfigPromise) {
    publicCallConfigPromise = getPublicCallConfig()
      .then((config) => {
        publicCallConfigCache = config;
        return config;
      })
      .catch(() => {
        publicCallConfigCache = null;
        return null;
      });
  }

  return publicCallConfigPromise;
};

const openDialerLink = (phoneNumber: string) => {
  const anchor = document.createElement("a");
  anchor.href = `tel:${phoneNumber}`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

const triggerPublicCallDialer = (messagePrefix = "Opening your phone dialer for") => {
  const config = publicCallConfigCache;
  if (!config?.ai_number) {
    showToast("The AI number is loading. Please try again in a moment.", "info");
    void primePublicCallConfig();
    return;
  }

  showToast(`${messagePrefix} ${config.ai_number}.`, "success");
  openDialerLink(config.ai_number);
};

const isExotelKycBlockMessage = (message: string) =>
  /kyc|not yet kyc compliant|mandatory before making outbound calls/i.test(message);

const getBasicEmailValidationMessage = (value?: string | null) => {
  const email = normalizeText(value).toLowerCase();
  if (!email) {
    return "Email is required.";
  }

  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!basicEmailPattern.test(email)) {
    return "Enter a valid email address.";
  }

  return null;
};

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
  const looksLikeIndianMobile =
    /^[6-9]\d{9}$/.test(digits) ||
    (/^0\d{10}$/.test(digits) && /^[6-9]\d{9}$/.test(digits.slice(1))) ||
    (/^91\d{10}$/.test(digits) && /^[6-9]\d{9}$/.test(digits.slice(2)));

  if (normalizedCountry === "IN" || trimmed.startsWith("+91") || digits.startsWith("91") || looksLikeIndianMobile) {
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

const getActiveOnboardingSubcategory = () => {
  const accountType = getActiveOnboardingAccountType().toLowerCase();
  const selector =
    accountType === "personal" ? "#per-sub-categories .tag-pill.active" : "#bus-sub-categories .tag-pill.active";

  return document.querySelector<HTMLElement>(selector)?.textContent?.trim() || "";
};

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
      emoji: iconHtml("hotel"),
      badgeClass: "badge-blue",
      badgeText: "✓ Listed",
      accentTint: "rgba(59,130,246,0.18)",
      aiLabels: [iconLabelHtml("calendar", "Bookings"), iconLabelHtml("concierge-bell", "Support"), iconLabelHtml("phone", "Calls")],
    },
    restaurant: {
      emoji: iconHtml("utensils"),
      badgeClass: "badge-green",
      badgeText: "✓ Listed",
      accentTint: "rgba(16,185,129,0.18)",
      aiLabels: [iconLabelHtml("calendar", "Reservations"), iconLabelHtml("wine", "Menus"), iconLabelHtml("phone", "Calls")],
    },
    clinic: {
      emoji: iconHtml("hospital"),
      badgeClass: "badge-green",
      badgeText: "✓ Listed",
      accentTint: "rgba(16,185,129,0.18)",
      aiLabels: [iconLabelHtml("calendar", "Appointments"), iconLabelHtml("pill", "Support"), iconLabelHtml("phone", "Calls")],
    },
    barber: {
      emoji: iconHtml("scissors"),
      badgeClass: "badge-blue",
      badgeText: "✓ Listed",
      accentTint: "rgba(59,130,246,0.18)",
      aiLabels: [iconLabelHtml("calendar", "Appointments"), iconLabelHtml("scissors", "Services"), iconLabelHtml("phone", "Calls")],
    },
    creator: {
      emoji: iconHtml("camera"),
      badgeClass: "badge-purple",
      badgeText: "✓ Creator",
      accentTint: "rgba(139,92,246,0.18)",
      aiLabels: [iconLabelHtml("handshake", "Collaborations"), iconLabelHtml("message-square", "Inquiries"), iconLabelHtml("phone", "Calls")],
    },
    consultant: {
      emoji: iconHtml("briefcase"),
      badgeClass: "badge-cyan",
      badgeText: "✓ Listed",
      accentTint: "rgba(6,182,212,0.18)",
      aiLabels: [iconLabelHtml("calendar", "Consultations"), iconLabelHtml("briefcase", "Intake"), iconLabelHtml("phone", "Calls")],
    },
    agency: {
      emoji: iconHtml("rocket"),
      badgeClass: "badge-cyan",
      badgeText: "✓ Listed",
      accentTint: "rgba(6,182,212,0.18)",
      aiLabels: [iconLabelHtml("clipboard-list", "Discovery"), iconLabelHtml("handshake", "Leads"), iconLabelHtml("phone", "Calls")],
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
    primaryMeta: iconLabelHtml("user", ownerName),
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

  refreshLegacyIcons();
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
    const timeoutId = window.setTimeout(
      () => fail("Razorpay checkout is taking too long to load. Allow checkout.razorpay.com and retry."),
      RAZORPAY_LOAD_TIMEOUT_MS
    );

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
    script.onerror = () => fail("Razorpay checkout failed to load. Allow checkout.razorpay.com and retry.");
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

  await openRazorpayCheckout(order, {
    onSuccess: planPayload.onSuccess,
    successMessage: "Payment confirmed and credits added.",
  });
};

const openRazorpayCheckout = async (
  order: RazorpayCheckoutOrder,
  options: {
    onSuccess?: () => Promise<void> | void;
    successMessage?: string;
  } = {}
) => {
  const win = getWindowRef();
  await ensureRazorpay();
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
          await options.onSuccess?.();
          showToast(options.successMessage || "Payment confirmed and credits added.", "success");
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

const getCheckoutFromAutopay = (result: AutopayTriggerResponse | Awaited<ReturnType<typeof getAutopayStatus>> | null) => {
  if (!result) {
    return null;
  }

  if ("checkout" in result && result.checkout) {
    return result.checkout;
  }

  if ("pending_checkout" in result && result.pending_checkout) {
    return result.pending_checkout;
  }

  return null;
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

const DEFAULT_RECHARGE_MIN_CREDITS = 100;
const DEFAULT_RECHARGE_MAX_CREDITS = 5000;
const DEFAULT_RECHARGE_STEP = 10;

const getRechargeAmountPaise = (credits: number, plans: BillingPlan[]) => {
  const exactPlan = plans.find((plan) => plan.credits === credits);
  if (exactPlan) {
    return exactPlan.amount_paise;
  }

  return Math.max(100, credits * 10);
};

const getRechargeLabel = (credits: number, plans: BillingPlan[]) => {
  const exactPlan = plans.find((plan) => plan.credits === credits);
  if (exactPlan) {
    return `${exactPlan.name} pack · live Razorpay checkout`;
  }

  return "Custom recharge · live Razorpay checkout";
};

const getHomeAccountLabel = () => {
  const user = getStoredUser();
  const name = normalizeText(user?.name);
  if (name) {
    return name.length > 18 ? `${name.slice(0, 17)}…` : name;
  }

  const email = normalizeText(user?.email);
  if (email) {
    const localPart = email.split("@")[0] || email;
    return localPart.length > 18 ? `${localPart.slice(0, 17)}…` : localPart;
  }

  return "My Account";
};

const syncHomeSessionActions = () => {
  const session = getStoredSession();
  if (!session?.accessToken) {
    return;
  }

  const accountButton = replaceInteractiveElement(document.getElementById("homeLoginButton"));
  const logoutButton = replaceInteractiveElement(document.getElementById("homeSignupButton"));
  const primaryCta = replaceInteractiveElement(document.getElementById("homePrimaryCta"));

  if (accountButton) {
    accountButton.textContent = "Dashboard";
    accountButton.setAttribute("title", getHomeAccountLabel());
    accountButton.addEventListener("click", () => {
      window.location.href = "/dashboard";
    });
  }

  if (logoutButton) {
    logoutButton.textContent = "Log out";
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      clearSession();
      showToast("Logged out successfully.", "success");
      window.location.href = "/";
    });
  }

  if (primaryCta) {
    primaryCta.textContent = "Open dashboard →";
    primaryCta.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "/dashboard";
    });
  }

  getWindowRef().closeLogin?.();
};

const syncSearchSessionActions = () => {
  const session = getStoredSession();
  if (!session?.accessToken) {
    return;
  }

  const dashboardButton = replaceInteractiveElement(document.getElementById("searchDashboardButton"));
  const logoutButton = replaceInteractiveElement(document.getElementById("searchSignupButton"));

  if (dashboardButton) {
    dashboardButton.textContent = "Dashboard";
    dashboardButton.setAttribute("title", getHomeAccountLabel());
    dashboardButton.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "/dashboard";
    });
  }

  if (logoutButton) {
    logoutButton.textContent = "Log out";
    logoutButton.className = "btn btn-ghost btn-sm";
    logoutButton.addEventListener("click", (event) => {
      event.preventDefault();
      clearSession();
      showToast("Logged out successfully.", "success");
      window.location.href = "/";
    });
  }
};

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
  const forgotModal = document.getElementById("forgotPasswordModal");
  const emailInput = document.getElementById("loginEmail") as HTMLInputElement | null;
  const passwordInput = document.getElementById("loginPass") as HTMLInputElement | null;
  const forgotPasswordLink = document.getElementById("forgotPasswordLink") as HTMLAnchorElement | null;
  const forgotPasswordEmailInput = document.getElementById("forgotPasswordEmail") as HTMLInputElement | null;
  const forgotPasswordSubmitButton = replaceInteractiveElement(
    document.getElementById("forgotPasswordSubmitBtn") as HTMLButtonElement | null
  );
  const loginButton = replaceInteractiveElement(
    modal?.querySelector<HTMLButtonElement>('.btn.btn-primary[style*="width:100%"]') ?? null
  );

  const openForgotPasswordModal = () => {
    forgotModal?.classList.add("open");
    window.setTimeout(() => forgotPasswordEmailInput?.focus(), 60);
  };

  const closeForgotPasswordModal = () => {
    forgotModal?.classList.remove("open");
  };

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
    if (button.textContent?.toLowerCase().includes("github")) {
      button.remove();
      return;
    }

    button.style.display = "";
    const provider = button.getAttribute("data-auth-provider") === "google" ? "google" : "google";
    const interactiveButton = replaceInteractiveElement(button);
    interactiveButton?.addEventListener("click", () => {
      window.location.href = getOAuthStartUrl(provider);
    });
  });
  const dividerRow = modal?.querySelector<HTMLElement>(".divider-row");
  if (dividerRow) {
    dividerRow.style.display = "";
  }

  forgotPasswordLink?.addEventListener("click", (event) => {
    event.preventDefault();
    getWindowRef().closeLogin?.();
    openForgotPasswordModal();
  });

  forgotPasswordSubmitButton?.addEventListener("click", async () => {
    const email = normalizeText(forgotPasswordEmailInput?.value || "");
    const emailValidationMessage = getBasicEmailValidationMessage(email);

    if (emailValidationMessage) {
      showToast(emailValidationMessage, "warn");
      forgotPasswordEmailInput?.focus();
      return;
    }

    const originalText = forgotPasswordSubmitButton.textContent;
    forgotPasswordSubmitButton.textContent = "Sending...";
    forgotPasswordSubmitButton.setAttribute("disabled", "true");

    try {
      await requestPasswordReset(email);
      showToast("If that email is registered, a reset link is on the way.", "success");
      closeForgotPasswordModal();
    } catch (error) {
      const message =
        error instanceof LegacyApiError ? error.message : "Unable to send a reset link right now.";
      showToast(message, "warn");
    } finally {
      forgotPasswordSubmitButton.textContent = originalText || "Send reset link";
      forgotPasswordSubmitButton.removeAttribute("disabled");
    }
  });

  forgotPasswordEmailInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      forgotPasswordSubmitButton?.click();
    }
  });

  syncHomeSessionActions();

  const loadPublicHomepageData = async () => {
    const [planResponse, publicCallConfig] = await Promise.all([
      getPlans(),
      primePublicCallConfig(),
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
    window.setTimeout(() => {
      getWindowRef().openLogin?.();
    }, 120);
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
          call_consent: false,
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
    refreshLegacyIcons();
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
              <span class="biz-phone">${iconLabelHtml("phone", business.phone)}</span>
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
  refreshLegacyIcons();
};

const setSearchFilterButtonState = (kind: string) => {
  const buttons = Array.from(document.querySelectorAll<HTMLElement>(".filter-btn"));
  buttons.forEach((button) => button.classList.remove("active"));

  const targetButton =
    buttons.find((button) => button.getAttribute("onclick")?.includes(`'${kind}'`) || button.dataset.filterKind === kind) ||
    buttons.find((button) => button.textContent?.trim().toLowerCase() === kind.toLowerCase()) ||
    null;

  targetButton?.classList.add("active");
};

const applySearchFilters = () => {
  const win = getWindowRef();
  const source = win.__versaficSearchBusinesses || [];
  const query = (document.getElementById("searchInput") as HTMLInputElement | null)?.value.trim().toLowerCase() || "";
  const selectedKinds = win.__versaficSearchSelectedKinds || searchSidebarKindOptions.map((option) => option.kind);
  const contactFilters = win.__versaficSearchContactFilters || [];
  const directoryFilters = win.__versaficSearchDirectoryFilters || [];
  const activeKind = win.__versaficActiveSearchKind || "all";

  const filtered = source.filter((business) => {
    const haystack = `${business.business_name} ${business.business_type} ${business.owner_name} ${business.phone} ${business.email} ${business.listingContext}`.toLowerCase();
    const matchesQuery = query ? haystack.includes(query) : true;
    const matchesChip = activeKind === "all" ? true : business.kind === activeKind;
    const matchesKind = selectedKinds.length ? selectedKinds.includes(business.kind) : false;
    const matchesPhone = !contactFilters.includes("phone") || Boolean(normalizeText(business.phone));
    const matchesEmail = !contactFilters.includes("email") || Boolean(normalizeText(business.email));
    const matchesOwner = !contactFilters.includes("owner") || Boolean(normalizeText(business.owner_name));
    const createdAt = business.created_at ? new Date(business.created_at).getTime() : 0;
    const isRecent = Boolean(createdAt && Date.now() - createdAt <= 30 * 86400000);
    const matchesLive = !directoryFilters.includes("live") || true;
    const matchesRecent = !directoryFilters.includes("recent") || isRecent;

    return matchesQuery && matchesChip && matchesKind && matchesPhone && matchesEmail && matchesOwner && matchesLive && matchesRecent;
  });

  win.__versaficSearchFiltered = filtered;
  win.renderResults?.();
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
    ${searchSidebarKindOptions
      .map(
        (option) => `<div class="filter-item"><label><input type="checkbox" class="filter-checkbox" data-filter-group="kind" data-filter-value="${escapeHtml(option.kind)}" checked> ${iconLabelHtml(option.icon, option.label)}</label><span class="filter-count">${formatNumber(kindCounts[option.kind] || 0)}</span></div>`
      )
      .join("")}
  `;

  sections[1].innerHTML = `
    <h4>Contact Coverage</h4>
    ${searchContactFilterOptions
      .map((option) => {
        const count =
          option.key === "phone"
            ? businesses.filter((item) => normalizeText(item.phone)).length
            : option.key === "email"
              ? businesses.filter((item) => normalizeText(item.email)).length
              : businesses.filter((item) => normalizeText(item.owner_name)).length;

        return `<div class="filter-item"><label><input type="checkbox" class="filter-checkbox" data-filter-group="contact" data-filter-value="${escapeHtml(option.key)}"> ${iconLabelHtml(option.icon, option.label)}</label><span class="filter-count">${formatNumber(count)}</span></div>`;
      })
      .join("")}
  `;

  sections[2].innerHTML = `
    <h4>Directory Status</h4>
    ${searchDirectoryFilterOptions
      .map((option) => {
        const count = option.key === "live" ? businesses.length : recentCount;
        return `<div class="filter-item"><label><input type="checkbox" class="filter-checkbox" data-filter-group="directory" data-filter-value="${escapeHtml(option.key)}"${option.key === "live" ? " checked" : ""}> ${iconLabelHtml(option.icon, option.label)}</label><span class="filter-count">${formatNumber(count)}</span></div>`;
      })
      .join("")}
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
      applySearchFilters();
    });
  }

  const win = getWindowRef();
  const kindCheckboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.filter-checkbox[data-filter-group="kind"]')
  );
  const contactCheckboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.filter-checkbox[data-filter-group="contact"]')
  );
  const directoryCheckboxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('.filter-checkbox[data-filter-group="directory"]')
  );

  win.__versaficSearchSelectedKinds = kindCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.dataset.filterValue || "");
  win.__versaficSearchContactFilters = contactCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.dataset.filterValue || "");
  win.__versaficSearchDirectoryFilters = directoryCheckboxes.filter((checkbox) => checkbox.checked).map((checkbox) => checkbox.dataset.filterValue || "");

  kindCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      win.__versaficSearchSelectedKinds = kindCheckboxes
        .filter((node) => node.checked)
        .map((node) => node.dataset.filterValue || "");
      win.__versaficActiveSearchKind = "all";
      setSearchFilterButtonState("all");
      applySearchFilters();
    });
  });

  contactCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      win.__versaficSearchContactFilters = contactCheckboxes
        .filter((node) => node.checked)
        .map((node) => node.dataset.filterValue || "");
      applySearchFilters();
    });
  });

  directoryCheckboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      win.__versaficSearchDirectoryFilters = directoryCheckboxes
        .filter((node) => node.checked)
        .map((node) => node.dataset.filterValue || "");
      applySearchFilters();
    });
  });

  refreshLegacyIcons();
};

const bindSearchPage = async () => {
  const win = getWindowRef();
  void primePublicCallConfig();

  try {
    syncSearchSessionActions();

    const businesses = (await getBusinessList(60)).map(buildDirectoryBusiness);
    win.__versaficSearchBusinesses = businesses;
    win.__versaficSearchFiltered = [...businesses];
    win.__versaficActiveSearchKind = "all";
    win.__versaficSearchSelectedKinds = searchSidebarKindOptions.map((option) => option.kind);
    win.__versaficSearchContactFilters = [];
    win.__versaficSearchDirectoryFilters = ["live"];

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

      const kindCheckboxes = Array.from(
        document.querySelectorAll<HTMLInputElement>('.filter-checkbox[data-filter-group="kind"]')
      );
      if (kindCheckboxes.length) {
        kindCheckboxes.forEach((checkbox) => {
          checkbox.checked = kind === "all" ? true : checkbox.dataset.filterValue === kind;
        });
        win.__versaficSearchSelectedKinds = kindCheckboxes
          .filter((checkbox) => checkbox.checked)
          .map((checkbox) => checkbox.dataset.filterValue || "");
      }

      applySearchFilters();
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
        return;
      }

      applySearchFilters();
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
      triggerPublicCallDialer();
    };

    const modalCallButton = replaceInteractiveElement(
      document.querySelector<HTMLButtonElement>("#callModal .btn.btn-primary")
    );
    document.getElementById("callModal")?.addEventListener("click", (event) => {
      if (event.target === event.currentTarget) {
        win.closeModal?.();
      }
    });
    modalCallButton?.addEventListener("click", () => {
      triggerPublicCallDialer();
    });

    const urlParams = new URLSearchParams(window.location.search);
    const queryValue = urlParams.get("q");
    if (searchInput && queryValue) {
      searchInput.value = queryValue;
    }

    setSearchFilterButtonState("all");
    applySearchFilters();
  } catch (error) {
    console.error("Failed to bind search page", error);
    renderSearchResults([]);
  }
};

const buildProfileActions = (business: DirectoryBusiness) => {
  const actionPresets: Record<BusinessKind, Array<{ icon: string; color: string; title: string; sub: string }>> = {
    hotel: [
      { icon: iconHtml("calendar"), color: "#7c3aed", title: "Bookings", sub: "Check availability and reserve" },
      { icon: iconHtml("concierge-bell"), color: "#2563eb", title: "Guest Support", sub: "FAQs, stays, and concierge" },
      { icon: iconHtml("phone"), color: "#0891b2", title: "AI Calls", sub: "Customer support through the AI number" },
    ],
    restaurant: [
      { icon: iconHtml("utensils"), color: "#059669", title: "Reservations", sub: "Table requests and availability" },
      { icon: iconHtml("clipboard-list"), color: "#2563eb", title: "Menu Questions", sub: "Menu and event details" },
      { icon: iconHtml("phone"), color: "#0891b2", title: "AI Calls", sub: "Phone support through the AI number" },
    ],
    clinic: [
      { icon: iconHtml("calendar"), color: "#0284c7", title: "Appointments", sub: "Schedule visits and follow-ups" },
      { icon: iconHtml("pill"), color: "#0891b2", title: "Patient Support", sub: "Prescription and service questions" },
      { icon: iconHtml("phone"), color: "#0f766e", title: "AI Calls", sub: "Call the AI line for support" },
    ],
    barber: [
      { icon: iconHtml("scissors"), color: "#2563eb", title: "Book a Slot", sub: "Haircuts and grooming services" },
      { icon: iconHtml("circle-help"), color: "#6366f1", title: "Service Questions", sub: "Hours, pricing, and availability" },
      { icon: iconHtml("phone"), color: "#0891b2", title: "AI Calls", sub: "Phone support via the AI number" },
    ],
    creator: [
      { icon: iconHtml("handshake"), color: "#7c3aed", title: "Partnerships", sub: "Collaboration and campaign intake" },
      { icon: iconHtml("package"), color: "#2563eb", title: "Brand Requests", sub: "Deals, briefs, and packages" },
      { icon: iconHtml("phone"), color: "#0891b2", title: "AI Calls", sub: "Talk to the creator AI assistant" },
    ],
    consultant: [
      { icon: iconHtml("calendar"), color: "#0284c7", title: "Consultations", sub: "Discovery calls and bookings" },
      { icon: iconHtml("file-text"), color: "#0891b2", title: "Intake", sub: "Share details before the call" },
      { icon: iconHtml("phone"), color: "#059669", title: "AI Calls", sub: "Phone support through the AI number" },
    ],
    agency: [
      { icon: iconHtml("target"), color: "#0284c7", title: "Lead Intake", sub: "Capture and qualify new inquiries" },
      { icon: iconHtml("clipboard-list"), color: "#0891b2", title: "Discovery", sub: "Project scope and service details" },
      { icon: iconHtml("phone"), color: "#6366f1", title: "AI Calls", sub: "Call the AI assistant directly" },
    ],
  };

  return actionPresets[business.kind];
};

const renderProfilePage = async (pageKey: string) => {
  const searchParams = new URLSearchParams(window.location.search);
  const pathSegments = window.location.pathname.split("/").filter(Boolean);
  const pathId = pathSegments[0] === "profile" ? pathSegments[1] || "" : "";
  const profileId = pageKey.startsWith("profile-")
    ? pageKey.replace("profile-", "")
    : searchParams.get("id") || pathId || "";
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
      <div class="meta-item">${iconHtml("user")} <span class="meta-value">${business.owner_name}</span></div>
      <div class="meta-item">${iconHtml("calendar")} <span class="meta-value">${formatDate(business.created_at || null)}</span></div>
      <div class="meta-item">${iconHtml("phone")} <span class="meta-value">${business.phone}</span></div>
    </div>

    <button class="call-btn" onclick="openCallModal()">
      ${iconHtml("phone")}&nbsp; Call AI Assistant
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
        <div class="sp-icon sp-website">${iconHtml("mail")}</div>
        <div style="flex:1">
          <div style="font-size:0.88rem;font-weight:600">Email</div>
          <div class="sp-handle">${business.email}</div>
        </div>
      </a>
      <a href="tel:${business.phone}" class="social-platform-btn">
        <div class="sp-icon sp-whatsapp">${iconHtml("phone")}</div>
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

  refreshLegacyIcons();

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
  void primePublicCallConfig();

  const win = getWindowRef();
  win.openCallModal = () => {
    document.getElementById("callModal")?.classList.add("open");
  };
  win.closeCallModal = () => {
    document.getElementById("callModal")?.classList.remove("open");
  };
  win.startCall = async () => {
    triggerPublicCallDialer("Opening your dialer for");
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

type BookingRow = {
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

type ManualBookingEntry = {
  id: string;
  customer: string;
  service: string;
  date: string;
  time: string;
  notes: string;
  createdAt: string;
};

type WeeklyScheduleEntry = {
  day: string;
  enabled: boolean;
  from: string;
  to: string;
};

type BlockedSlotEntry = {
  id: string;
  day: string;
  from: string;
  to: string;
  reason: string;
};

type HolidayEntry = {
  id: string;
  date: string;
  reason: string;
};

const MANUAL_BOOKINGS_KEY = "versafic.manualBookings";
const BOOKING_SCHEDULE_KEY = "versafic.bookingSchedule";
const BLOCKED_SLOTS_KEY = "versafic.blockedSlots";
const HOLIDAYS_KEY = "versafic.holidays";
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DEFAULT_WEEKLY_SCHEDULE: WeeklyScheduleEntry[] = [
  { day: "Monday", enabled: true, from: "09:00", to: "17:00" },
  { day: "Tuesday", enabled: true, from: "09:00", to: "17:00" },
  { day: "Wednesday", enabled: true, from: "09:00", to: "17:00" },
  { day: "Thursday", enabled: true, from: "09:00", to: "17:00" },
  { day: "Friday", enabled: true, from: "09:00", to: "17:00" },
  { day: "Saturday", enabled: false, from: "10:00", to: "14:00" },
  { day: "Sunday", enabled: false, from: "10:00", to: "14:00" },
];

const searchSidebarKindOptions: Array<{ kind: BusinessKind; label: string; icon: string }> = [
  { kind: "hotel", label: "Hotels", icon: "hotel" },
  { kind: "restaurant", label: "Restaurants", icon: "utensils" },
  { kind: "clinic", label: "Clinics", icon: "hospital" },
  { kind: "barber", label: "Barbers", icon: "scissors" },
  { kind: "creator", label: "Creators", icon: "camera" },
  { kind: "consultant", label: "Consultants", icon: "briefcase" },
  { kind: "agency", label: "Agencies", icon: "building-2" },
];

const searchContactFilterOptions = [
  { key: "phone", label: "Phone listed", icon: "phone" },
  { key: "email", label: "Email listed", icon: "mail" },
  { key: "owner", label: "Owner listed", icon: "user" },
] as const;

const searchDirectoryFilterOptions = [
  { key: "live", label: "Live listings", icon: "badge-check" },
  { key: "recent", label: "Added in 30 days", icon: "sparkles" },
] as const;

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

const buildBookingRows = (state: DashboardState): BookingRow[] => {
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
      notes: normalizeText(conversation.request) || "Voice booking captured",
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

const readStoredArray = <T,>(key: string): T[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStoredArray = (key: string, value: unknown[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const getManualBookings = () => readStoredArray<ManualBookingEntry>(MANUAL_BOOKINGS_KEY);
const saveManualBookings = (entries: ManualBookingEntry[]) => writeStoredArray(MANUAL_BOOKINGS_KEY, entries);

const getWeeklyScheduleEntries = (): WeeklyScheduleEntry[] => {
  const stored = readStoredArray<WeeklyScheduleEntry>(BOOKING_SCHEDULE_KEY);
  if (!stored.length) {
    return DEFAULT_WEEKLY_SCHEDULE;
  }

  return WEEK_DAYS.map((day) => {
    const existing = stored.find((item) => item.day === day);
    return existing || DEFAULT_WEEKLY_SCHEDULE.find((item) => item.day === day)!;
  });
};

const saveWeeklyScheduleEntries = (entries: WeeklyScheduleEntry[]) => writeStoredArray(BOOKING_SCHEDULE_KEY, entries);
const getBlockedSlotEntries = () => readStoredArray<BlockedSlotEntry>(BLOCKED_SLOTS_KEY);
const saveBlockedSlotEntries = (entries: BlockedSlotEntry[]) => writeStoredArray(BLOCKED_SLOTS_KEY, entries);
const getHolidayEntries = () => readStoredArray<HolidayEntry>(HOLIDAYS_KEY);
const saveHolidayEntries = (entries: HolidayEntry[]) => writeStoredArray(HOLIDAYS_KEY, entries);

const formatManualBookingTime = (timeValue: string) => {
  if (!timeValue) {
    return "--";
  }

  const [hours, minutes] = timeValue.split(":").map((value) => Number(value));
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return timeValue;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toBookingTimestamp = (row: BookingRow) => {
  const parsed = new Date(`${row.date} ${row.time}`);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  const dateOnly = new Date(row.date);
  if (!Number.isNaN(dateOnly.getTime())) {
    return dateOnly.getTime();
  }

  return 0;
};

const buildRuntimeBookingRows = (state: DashboardState): BookingRow[] => {
  const manualRows = getManualBookings().map<BookingRow>((entry) => ({
    customer: entry.customer,
    service: entry.service,
    assignedTo: "Manual",
    statusBadge: "badge-blue",
    statusLabel: "Pending",
    date: formatDate(entry.date),
    time: formatManualBookingTime(entry.time),
    notes: entry.notes || "Manual booking",
    duration: "--",
  }));

  return [...manualRows, ...buildBookingRows(state)].sort((left, right) => toBookingTimestamp(right) - toBookingTimestamp(left));
};

const filterBookingRowsByView = (rows: BookingRow[], filterKey: string) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0, 23, 59, 59, 999);

  if (filterKey === "Today") {
    return rows.filter((row) => {
      const timestamp = toBookingTimestamp(row);
      return timestamp >= startOfToday.getTime() && timestamp < startOfToday.getTime() + 86400000;
    });
  }

  if (filterKey === "This Week") {
    return rows.filter((row) => {
      const timestamp = toBookingTimestamp(row);
      return timestamp >= startOfToday.getTime() && timestamp <= endOfWeek.getTime();
    });
  }

  if (filterKey === "This Month") {
    return rows.filter((row) => {
      const timestamp = toBookingTimestamp(row);
      return timestamp >= startOfToday.getTime() && timestamp <= endOfMonth.getTime();
    });
  }

  return rows;
};

const renderBookingsPagination = (
  containerId: string,
  totalRows: number,
  pageSize: number,
  currentPage: number,
  onPageChange: (page: number) => void
) => {
  const container = document.getElementById(containerId);
  if (!container) {
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalRows / Math.max(pageSize, 1)));
  const clampedPage = Math.min(Math.max(currentPage, 1), totalPages);
  const startRow = totalRows === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const endRow = totalRows === 0 ? 0 : Math.min(totalRows, clampedPage * pageSize);

  container.innerHTML = `
    <div>Showing ${startRow}-${endRow} of ${totalRows} bookings</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" type="button" data-page-action="prev" ${clampedPage <= 1 ? "disabled" : ""}>Previous</button>
      <span>Page ${clampedPage} / ${totalPages}</span>
      <button class="btn btn-outline btn-sm" type="button" data-page-action="next" ${clampedPage >= totalPages ? "disabled" : ""}>Next</button>
    </div>
  `;

  const prevButton = container.querySelector<HTMLButtonElement>('[data-page-action="prev"]');
  const nextButton = container.querySelector<HTMLButtonElement>('[data-page-action="next"]');
  prevButton?.addEventListener("click", () => onPageChange(clampedPage - 1));
  nextButton?.addEventListener("click", () => onPageChange(clampedPage + 1));
};

const renderBookingsCalendar = (rows: BookingRow[]) => {
  const calendarSection = document.getElementById("bookingSub-calendar");
  const container = calendarSection?.querySelector(".chart-container");
  if (!container) {
    return;
  }

  const calendarMonthStart = new Date(bookingCalendarMonth);
  calendarMonthStart.setDate(1);
  calendarMonthStart.setHours(0, 0, 0, 0);
  const monthName = calendarMonthStart.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const startDay = calendarMonthStart.getDay();
  const daysInMonth = new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() + 1, 0).getDate();
  const totalCells = Math.ceil((startDay + daysInMonth) / 7) * 7;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startDay + 1;
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    const cellDate = new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth(), dayNumber);
    const dateLabel = formatDate(cellDate.toISOString());
    const dayRows = inMonth ? rows.filter((row) => row.date === dateLabel).slice(0, 2) : [];
    const isToday = inMonth && formatDate(new Date().toISOString()) === dateLabel;

    return `
      <div data-booking-date="${inMonth ? cellDate.toISOString() : ""}" style="background:${inMonth ? (isToday ? "rgba(99,102,241,0.03)" : "#fff") : "#f9fafb"};min-height:110px;padding:8px;${inMonth ? "cursor:pointer;" : ""}">
        <div style="${isToday ? "display:inline-block;background:var(--indigo);color:#fff;border-radius:50%;width:24px;height:24px;line-height:24px;text-align:center;font-size:0.8rem;font-weight:700;margin-bottom:6px;" : "font-size:0.8rem;color:" + (inMonth ? "var(--text-primary)" : "var(--text-muted)") + ";font-weight:500;margin-bottom:6px;"}">${inMonth ? dayNumber : ""}</div>
        ${dayRows
          .map(
            (row) => `
              <div style="background:rgba(99,102,241,0.1);color:var(--indigo);padding:4px 8px;border-radius:4px;font-size:0.7rem;font-weight:600;margin-bottom:4px;">
                ${escapeHtml(`${row.time} - ${row.customer}`)}
              </div>
            `
          )
          .join("")}
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="weekly-header-bar" style="border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:16px;">
        <h3 style="margin:0;font-size:1.15rem;font-weight:700;">${escapeHtml(monthName)}</h3>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" type="button" data-calendar-nav="prev">&lt;</button>
          <button class="btn btn-outline btn-sm" type="button" data-calendar-nav="today">Today</button>
          <button class="btn btn-outline btn-sm" type="button" data-calendar-nav="next">&gt;</button>
        </div>
      </div>
      <div style="font-size:0.82rem;color:var(--text-muted);">Live bookings calendar</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(7, 1fr);background:var(--border);gap:1px;">
      ${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        .map(
          (day) => `
            <div style="background:#f9fafb;padding:12px;text-align:center;font-weight:600;font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;">${day}</div>
          `
        )
        .join("")}
      ${cells}
    </div>
  `;

  container.querySelectorAll<HTMLElement>("[data-booking-date]").forEach((cell) => {
    const iso = cell.dataset.bookingDate;
    if (!iso) {
      return;
    }
    cell.addEventListener("click", () => {
      getWindowRef().openDayDetail?.(iso);
    });
  });

  container.querySelector<HTMLButtonElement>('[data-calendar-nav="prev"]')?.addEventListener("click", () => {
    bookingCalendarMonth = new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() - 1, 1);
    renderBookingsCalendar(rows);
  });
  container.querySelector<HTMLButtonElement>('[data-calendar-nav="today"]')?.addEventListener("click", () => {
    bookingCalendarMonth = new Date();
    renderBookingsCalendar(rows);
  });
  container.querySelector<HTMLButtonElement>('[data-calendar-nav="next"]')?.addEventListener("click", () => {
    bookingCalendarMonth = new Date(calendarMonthStart.getFullYear(), calendarMonthStart.getMonth() + 1, 1);
    renderBookingsCalendar(rows);
  });
};

const renderBookingScheduleTable = () => {
  const body = document.getElementById("weeklyScheduleBody");
  if (!body) {
    return;
  }

  body.innerHTML = getWeeklyScheduleEntries()
    .map(
      (entry, index) => `
        <div class="schedule-row ${entry.enabled ? "" : "inactive-day"}" style="display:grid;grid-template-columns:150px 120px 1fr;align-items:center;background:#fff;padding:16px;gap:12px;">
          <div style="font-weight:600;color:var(--text-primary)">${escapeHtml(entry.day)}</div>
          <label class="toggle-switch">
            <input type="checkbox" data-schedule-toggle="${index}" ${entry.enabled ? "checked" : ""}>
            <div class="toggle-track"></div>
          </label>
          <div class="schedule-times">
            ${
              entry.enabled
                ? `<input type="time" class="input-field time-sm" data-schedule-from="${index}" value="${escapeHtml(entry.from)}"><span class="time-sep">-</span><input type="time" class="input-field time-sm" data-schedule-to="${index}" value="${escapeHtml(entry.to)}">`
                : '<span class="closed-text">Closed</span>'
            }
          </div>
        </div>
      `
    )
    .join("");
};

const renderBlockedSlotsTable = () => {
  const body = document.getElementById("blockedSlotsBody");
  if (!body) {
    return;
  }

  const rows = getBlockedSlotEntries();
  body.innerHTML =
    rows
      .map(
        (row, index) => `
          <tr>
            <td>${escapeHtml(row.day)}</td>
            <td>${escapeHtml(`${row.from} - ${row.to}`)}</td>
            <td>${escapeHtml(row.reason)}</td>
            <td><button class="btn btn-outline btn-sm" type="button" data-remove-blocked-slot="${index}">Remove</button></td>
          </tr>
        `
      )
      .join("") ||
    `<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">No blocked slots added yet.</td></tr>`;

  body.querySelectorAll<HTMLButtonElement>("[data-remove-blocked-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeBlockedSlot);
      const nextRows = getBlockedSlotEntries().filter((_, rowIndex) => rowIndex !== index);
      saveBlockedSlotEntries(nextRows);
      renderBlockedSlotsTable();
      showToast("Blocked slot removed.", "success");
    });
  });
};

const renderHolidayRows = () => {
  const body = document.getElementById("holidaysTableBody");
  if (!body) {
    return;
  }

  const rows = getHolidayEntries();
  body.innerHTML =
    rows
      .map(
        (row, index) => `
          <tr>
            <td>${escapeHtml(formatDate(row.date))}</td>
            <td>${escapeHtml(row.reason)}</td>
            <td>Admin</td>
            <td><span class="badge badge-amber">Blocked</span></td>
            <td><button class="btn btn-outline btn-sm" type="button" data-remove-holiday="${index}">Remove</button></td>
          </tr>
        `
      )
      .join("") ||
    `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No blocked dates added yet.</td></tr>`;

  body.querySelectorAll<HTMLButtonElement>("[data-remove-holiday]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.removeHoliday);
      const nextRows = getHolidayEntries().filter((_, rowIndex) => rowIndex !== index);
      saveHolidayEntries(nextRows);
      renderHolidayRows();
      showToast("Blocked date removed.", "success");
    });
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

const renderOverviewVolumeChart = (
  chartContainer: HTMLElement | null,
  labelContainer: HTMLElement | null,
  rows: Array<{ label: string; calls: number; chats: number }>
) => {
  if (!chartContainer || !labelContainer) {
    return;
  }

  const hasAnyVolume = rows.some((row) => row.calls > 0 || row.chats > 0);

  if (!rows.length || !hasAnyVolume) {
    chartContainer.innerHTML = `<div style="color:var(--text-muted);font-size:0.85rem;">No backend data available yet.</div>`;
    labelContainer.innerHTML = "";
    return;
  }

  const maxValue = Math.max(
    ...rows.flatMap((row) => [row.calls, row.chats]),
    1
  );

  chartContainer.innerHTML = rows
    .map((row) => {
      const callHeight = row.calls > 0 ? Math.max(8, (row.calls / maxValue) * 160) : 4;
      const chatHeight = row.chats > 0 ? Math.max(8, (row.chats / maxValue) * 160) : 4;
      return `
        <div class="volume-bar-group">
          <div class="volume-bar" style="height:${callHeight}px;background:linear-gradient(180deg,#6366f1,#818cf8);box-shadow:0 2px 6px rgba(99,102,241,0.2)" title="${escapeHtml(`${row.calls} calls`)}"></div>
          <div class="volume-bar" style="height:${chatHeight}px;background:linear-gradient(180deg,#10b981,#34d399);box-shadow:0 2px 6px rgba(16,185,129,0.2)" title="${escapeHtml(`${row.chats} chats`)}"></div>
        </div>
      `;
    })
    .join("");

  labelContainer.innerHTML = rows
    .map((row) => `<span>${escapeHtml(row.label)}</span>`)
    .join("");
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
  const incomplete = Math.max(0, totalCalls - resolved - escalated);
  const bookingRows = buildBookingRows(state);
  const aiBooked = bookingRows.filter((row) => ["Synced", "Completed"].includes(row.statusLabel)).length;
  const manualBookings = 0;
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

  const overviewContainers = Array.from(document.querySelectorAll("#page-overview .chart-container"));
  const callsVsChatsContainer = overviewContainers[0] || null;
  const bookingsContainer = overviewContainers[1] || null;
  const outcomeContainer = overviewContainers[3] || null;

  setDonutBreakdown(callsVsChatsContainer, "Total", [
    { label: "Calls", value: totalCalls, color: "#6366f1" },
    { label: "Chats", value: totalChats, color: "#10b981" },
  ]);

  setDonutBreakdown(bookingsContainer, "Total", [
    { label: "AI Booked", value: aiBooked, color: "#8b5cf6" },
    { label: "Manual", value: manualBookings, color: "#f59e0b" },
  ]);

  setDonutBreakdown(outcomeContainer, "Calls", [
    { label: "Resolved", value: resolved, color: "#10b981" },
    { label: "Escalated", value: escalated, color: "#f59e0b" },
    { label: "Incomplete", value: incomplete, color: "#ef4444" },
  ]);

  const volumeRows = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (13 - index));
    const dateKey = date.toISOString().slice(0, 10);

    const calls = state.callSessions.filter((session) => (session.created_at || "").slice(0, 10) === dateKey).length;
    const chats = state.chatHistory.filter((message) => {
      const createdAt = message.created_at || message.createdAt || "";
      return createdAt.slice(0, 10) === dateKey;
    }).length;

    return {
      label: date.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
      calls,
      chats,
    };
  });

  renderOverviewVolumeChart(
    document.getElementById("overviewVolumeChart"),
    document.getElementById("overviewVolumeLabels"),
    volumeRows
  );
};

const updateBillingPage = (state: DashboardState) => {
  const creditsPage = document.getElementById("page-credits");
  if (!creditsPage || !state.wallet) {
    return;
  }

  const usage = computeUsageBreakdown(state.wallet);
  const heroValue = creditsPage.querySelector(".credits-value");
  const heroInfo = creditsPage.querySelector<HTMLElement>("#billingHeroInfo");
  const usageValue = creditsPage.querySelector<HTMLElement>("#billingUsageValue");
  const usageFill = creditsPage.querySelector<HTMLElement>("#billingUsageFill");
  const usageCaption = creditsPage.querySelector<HTMLElement>("#billingUsageCaption");

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

  const breakdownTargets: Array<[string, number]> = [
    ["#billingBreakdownCalls", usage.calls],
    ["#billingBreakdownChats", usage.chats],
    ["#billingBreakdownSms", usage.sms],
    ["#billingBreakdownTranscripts", usage.transcripts],
  ];
  breakdownTargets.forEach(([selector, value]) => {
    const node = creditsPage.querySelector<HTMLElement>(selector);
    if (node) {
      node.textContent = formatNumber(value || 0);
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

  const topUpSlider = replaceInteractiveElement(
    creditsPage.querySelector<HTMLInputElement>("#billingTopUpSlider")
  ) as HTMLInputElement | null;
  const topUpSelect = creditsPage.querySelector<HTMLSelectElement>("#billingTopUpSelect");
  const topUpCredits = creditsPage.querySelector<HTMLElement>("#billingTopUpCredits");
  const topUpPrice = creditsPage.querySelector<HTMLElement>("#billingTopUpPrice");
  const topUpHint = creditsPage.querySelector<HTMLElement>("#billingTopUpHint");
  const topUpButton = replaceInteractiveElement(creditsPage.querySelector<HTMLButtonElement>("#billingTopUpButton"));
  const sortedTopUpPlans = [...state.plans].sort((left, right) => left.credits - right.credits);
  const preferredPlanId = getPreferredPlanId();
  const preferredPlan = sortedTopUpPlans.find((plan) => plan.id === preferredPlanId)
    || sortedTopUpPlans.find((plan) => plan.id === "growth")
    || sortedTopUpPlans[0]
    || null;

  const getSelectedTopUpPlan = () => {
    if (topUpSelect) {
      return (
        sortedTopUpPlans.find((plan) => plan.id === topUpSelect.value)
        || sortedTopUpPlans.find((plan) => String(plan.credits) === topUpSelect.value)
        || preferredPlan
      );
    }

    return null;
  };

  if (topUpSelect) {
    const selectedPlanId = preferredPlan?.id || sortedTopUpPlans[0]?.id || "";
    
    // Only update innerHTML if we have plans to display
    if (sortedTopUpPlans.length > 0) {
      topUpSelect.innerHTML = sortedTopUpPlans
        .map((plan) => {
          const label = `${formatNumber(plan.credits)} Credits - ${formatCurrency(plan.amount_paise)}`;
          return `<option value="${escapeHtml(plan.id)}">${escapeHtml(label)}</option>`;
        })
        .join("");
      if (selectedPlanId) {
        topUpSelect.value = selectedPlanId;
      }
    } else {
      // Fallback: Add a default option if no plans are available
      if (topUpSelect.options.length === 0) {
        const option = document.createElement('option');
        option.text = 'Loading plans...';
        option.value = '';
        topUpSelect.appendChild(option);
      }
    }
  }

  const updateTopUpPreview = () => {
    const selectedPlan = getSelectedTopUpPlan();
    const selectedCredits = selectedPlan
      ? selectedPlan.credits
      : Math.max(
          DEFAULT_RECHARGE_MIN_CREDITS,
          Number(topUpSlider?.value || preferredPlan?.credits || DEFAULT_RECHARGE_MIN_CREDITS)
        );
    const amountPaise = selectedPlan?.amount_paise || getRechargeAmountPaise(selectedCredits, sortedTopUpPlans);

    if (topUpCredits) {
      topUpCredits.textContent = `${formatNumber(selectedCredits)} credits`;
    }
    if (topUpPrice) {
      topUpPrice.textContent = formatCurrency(amountPaise);
    }
    if (topUpHint) {
      topUpHint.textContent = selectedPlan
        ? `${selectedPlan.name} · ${selectedPlan.description}`
        : `${getRechargeLabel(selectedCredits, sortedTopUpPlans)} · ${formatCurrency(amountPaise)}`;
    }

    return {
      plan: selectedPlan,
      credits: selectedCredits,
      amountPaise,
    };
  };

  if (topUpSlider) {
    const sliderMin = DEFAULT_RECHARGE_MIN_CREDITS;
    const sliderMax = Math.max(
      DEFAULT_RECHARGE_MAX_CREDITS,
      sortedTopUpPlans[sortedTopUpPlans.length - 1]?.credits || DEFAULT_RECHARGE_MAX_CREDITS
    );
    const sliderValue = preferredPlan?.credits || Number(topUpSlider.value || DEFAULT_RECHARGE_MIN_CREDITS);

    topUpSlider.min = String(sliderMin);
    topUpSlider.max = String(sliderMax);
    topUpSlider.step = String(DEFAULT_RECHARGE_STEP);
    topUpSlider.value = String(Math.min(sliderMax, Math.max(sliderMin, sliderValue)));
    topUpSlider.addEventListener("input", () => {
      updateTopUpPreview();
    });
  }
  topUpSelect?.addEventListener("change", () => {
    const selectedPlan = getSelectedTopUpPlan();
    if (selectedPlan) {
      setPreferredPlanId(selectedPlan.id);
    }
    updateTopUpPreview();
  });

  updateTopUpPreview();

  topUpButton?.addEventListener("click", async () => {
    const { plan, credits, amountPaise } = updateTopUpPreview();

    if (!credits || !amountPaise) {
      showToast("Choose a valid top-up amount first.", "warn");
      return;
    }

    try {
      const checkoutRequest = plan
        ? {
            planId: plan.id,
            onSuccess: async () => {
              if (topUpHint) {
                topUpHint.textContent = `Recharge successful · ${formatNumber(plan.credits)} credits were added to your wallet.`;
              }
              await bindDashboardPage();
            },
          }
        : {
            amountPaise,
            credits,
            onSuccess: async () => {
              if (topUpHint) {
                topUpHint.textContent = `Recharge successful · ${formatNumber(credits)} credits were added to your wallet.`;
              }
              await bindDashboardPage();
            },
          };

      await openCheckout(checkoutRequest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start checkout.";
      showToast(message, "warn");
    }
  });

  const invoiceBody = creditsPage.querySelector<HTMLTableSectionElement>("#billingInvoiceBody");
  const invoiceTable = invoiceBody?.closest("table") as HTMLTableElement | null;
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

  const primaryPaymentIcon = creditsPage.querySelector<HTMLElement>("#billingPrimaryPaymentIcon");
  const primaryPaymentLabel = creditsPage.querySelector<HTMLElement>("#billingPrimaryPaymentLabel");
  const primaryPaymentSubLabel = creditsPage.querySelector<HTMLElement>("#billingPrimaryPaymentSubLabel");
  const secondaryPaymentIcon = creditsPage.querySelector<HTMLElement>("#billingSecondaryPaymentIcon");
  const secondaryPaymentLabel = creditsPage.querySelector<HTMLElement>("#billingSecondaryPaymentLabel");
  const secondaryPaymentSubLabel = creditsPage.querySelector<HTMLElement>("#billingSecondaryPaymentSubLabel");

  if (primaryPaymentIcon) {
    primaryPaymentIcon.textContent = "RZP";
  }
  if (primaryPaymentLabel) {
    primaryPaymentLabel.textContent = "Razorpay Checkout";
  }
  if (primaryPaymentSubLabel) {
    primaryPaymentSubLabel.textContent = "Secure hosted payment flow";
  }
  if (secondaryPaymentIcon) {
    secondaryPaymentIcon.textContent = "AUTO";
  }
  if (secondaryPaymentLabel) {
    secondaryPaymentLabel.textContent = state.autopay?.settings?.enabled ? "Autopay Enabled" : "Autopay Off";
  }
  if (secondaryPaymentSubLabel) {
    secondaryPaymentSubLabel.textContent = state.autopay?.settings
      ? `Threshold ${formatNumber(state.autopay.settings.threshold_credits)} credits · ${state.autopay.settings.mode}`
      : "No recharge rule saved yet";
  }

  const addPaymentButton = replaceInteractiveElement(
    creditsPage.querySelector<HTMLButtonElement>("#billingAddPaymentButton")
  );
  addPaymentButton?.addEventListener("click", async () => {
    const originalLabel = addPaymentButton.textContent;
    const selectedPlan = getSelectedTopUpPlan()
      || preferredPlan
      || sortedTopUpPlans.find((plan) => plan.id === "growth")
      || sortedTopUpPlans[0];

    if (!selectedPlan) {
      showToast("No Razorpay recharge plan is configured right now.", "warn");
      return;
    }

    addPaymentButton.textContent = "Opening...";
    addPaymentButton.setAttribute("disabled", "true");

    try {
      const latestStatus = await getAutopayStatus().catch(() => state.autopay);
      const pendingCheckout = getCheckoutFromAutopay(latestStatus);

      if (pendingCheckout) {
        await openRazorpayCheckout(pendingCheckout, {
          onSuccess: bindDashboardPage,
          successMessage: "Autopay checkout confirmed and credits added.",
        });
        return;
      }

      const thresholdCredits =
        latestStatus?.settings?.threshold_credits
        ?? state.autopay?.settings?.threshold_credits
        ?? DEFAULT_RECHARGE_MIN_CREDITS;

      await enableAutopay({
        threshold_credits: thresholdCredits,
        recharge_amount: selectedPlan.amount_paise,
        mode: "real",
        selected_plan: selectedPlan.id,
      });

      const triggerResult = await triggerAutopay({
        triggered_by: "manual_retry",
        force: true,
      });
      const checkout = getCheckoutFromAutopay(triggerResult);

      if (!checkout) {
        showToast("Autopay is enabled. Razorpay did not return a checkout request yet.", "info");
        await bindDashboardPage();
        return;
      }

      await openRazorpayCheckout(checkout, {
        onSuccess: bindDashboardPage,
        successMessage: "Autopay checkout confirmed and credits added.",
      });
    } catch (error) {
      const message = error instanceof LegacyApiError ? error.message : "Unable to open Razorpay autopay checkout.";
      showToast(message, "warn");
    } finally {
      addPaymentButton.textContent = originalLabel || "+ Add Payment Method";
      addPaymentButton.removeAttribute("disabled");
    }
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

  const bookingFilter = getWindowRef().__versaficSelectedBookingFilter || "Active";
  const filteredState = filterDashboardState(state, getSelectedDateFilter("page-bookings"));
  const bookingRows = buildRuntimeBookingRows(filteredState);
  const todayLabel = formatDate(new Date().toISOString());
  const todaysRows = bookingRows.filter((row) => row.date === todayLabel);
  const activeRows = filterBookingRowsByView(bookingRows, bookingFilter);
  const completedRows = bookingRows.filter((row) => row.statusLabel === "Completed");
  const rescheduledRows = bookingRows.filter((row) => row.statusLabel.toLowerCase().includes("resched"));

  const header = bookingsPage.querySelector(".dash-header h2");
  const subtitle = bookingsPage.querySelector(".dash-header p");
  if (header) {
    header.innerHTML = `${iconHtml("calendar")} Bookings`;
  }
  if (subtitle) {
    subtitle.textContent = "Appointments scheduled by your AI agent.";
  }

  const activeSection = bookingsPage.querySelector("#bookingSub-active");
  if (activeSection) {
    const sectionHeaders = activeSection.querySelectorAll(".section-header h3");
    if (sectionHeaders[0]) {
      sectionHeaders[0].innerHTML = `${iconHtml("activity")} Active Queue Right Now`;
    }
    if (sectionHeaders[1]) {
      sectionHeaders[1].textContent = "Upcoming Bookings";
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
                <td><span style="display:flex;align-items:center;gap:6px"><span class="chat-avatar ai" style="width:20px;height:20px;font-size:0.6rem">${iconHtml("bot")}</span>${escapeHtml(row.assignedTo)}</span></td>
                <td><span class="badge ${escapeHtml(row.statusBadge)}">${escapeHtml(row.statusLabel)}</span></td>
              </tr>
            `
          )
          .join("") ||
        `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No active bookings in the queue right now.</td></tr>`;
    }

    if (recordsBody) {
      recordsBody.innerHTML =
        bookingRows
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
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No booking records are available yet.</td></tr>`;
    }

    const statCards = Array.from(activeSection.querySelectorAll(".stat-card"));
    const metrics = [
      formatNumber(bookingRows.length),
      formatNumber(todaysRows.length),
      `${bookingRows.length ? Math.round((completedRows.length / bookingRows.length) * 100) : 0}%`,
      formatNumber(rescheduledRows.length),
    ];
    statCards.forEach((card, index) => {
      const valueNode = card.querySelector(".stat-card-value");
      if (valueNode) {
        valueNode.textContent = metrics[index] || "--";
      }
    });
  }

  const pastSection = bookingsPage.querySelector("#bookingSub-past");
  if (pastSection) {
    const title = pastSection.querySelector(".section-header h3");
    if (title) {
      title.textContent = "Past Bookings";
    }
    const tbody = pastSection.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML =
        bookingRows
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
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No past bookings are available yet.</td></tr>`;
    }
  }

  bindBookingsPanelInteractions(filteredState);
  getWindowRef().renderActiveBookings?.();
  getWindowRef().renderPastBookings?.();
  getWindowRef().renderWeeklyCalendar?.();
  getWindowRef().renderWeeklySchedule?.();
  getWindowRef().renderBlockedSlots?.();
  getWindowRef().renderHolidays?.();
};

const bindBookingsPanelInteractions = (state: DashboardState) => {
  const win = getWindowRef();

  const getCurrentRows = () => {
    const latestState = filterDashboardState(win.__versaficDashboardState || state, getSelectedDateFilter("page-bookings"));
    const latestRows = buildRuntimeBookingRows(latestState);
    return filterBookingRowsByView(latestRows, win.__versaficSelectedBookingFilter || "Active");
  };

  const renderRowsIntoTable = (
    bodyId: string,
    rows: BookingRow[],
    pageSizeSelectId: string,
    searchInputId: string,
    fromInputId: string,
    toInputId: string,
    paginationId: string,
    pageRef: "active" | "past"
  ) => {
    const body = document.getElementById(bodyId);
    if (!body) {
      return;
    }

    const pageSize = Math.max(
      1,
      Number((document.getElementById(pageSizeSelectId) as HTMLSelectElement | null)?.value || 10)
    );
    const query = ((document.getElementById(searchInputId) as HTMLInputElement | null)?.value || "").trim().toLowerCase();
    const fromValue = (document.getElementById(fromInputId) as HTMLInputElement | null)?.value || "";
    const toValue = (document.getElementById(toInputId) as HTMLInputElement | null)?.value || "";

    const filteredRows = rows.filter((row) => {
      const rowTimestamp = toBookingTimestamp(row);
      const matchesQuery = query
        ? [row.customer, row.service, row.notes, row.statusLabel].some((field) => field.toLowerCase().includes(query))
        : true;
      const matchesFrom = fromValue ? rowTimestamp >= new Date(fromValue).getTime() : true;
      const matchesTo = toValue ? rowTimestamp <= new Date(`${toValue}T23:59:59`).getTime() : true;
      return matchesQuery && matchesFrom && matchesTo;
    });

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (pageRef === "active") {
      activeBookingsPage = Math.min(Math.max(activeBookingsPage, 1), totalPages);
    } else {
      pastBookingsPage = Math.min(Math.max(pastBookingsPage, 1), totalPages);
    }

    const currentPage = pageRef === "active" ? activeBookingsPage : pastBookingsPage;
    const startIndex = (currentPage - 1) * pageSize;
    const pageRows = filteredRows.slice(startIndex, startIndex + pageSize);

    if (pageRef === "active") {
      body.innerHTML =
        pageRows
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
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No matching upcoming bookings yet.</td></tr>`;
    } else {
      body.innerHTML =
        pageRows
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
        `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No matching past bookings yet.</td></tr>`;
    }

    renderBookingsPagination(paginationId, filteredRows.length, pageSize, currentPage, (nextPage) => {
      if (pageRef === "active") {
        activeBookingsPage = nextPage;
        win.renderActiveBookings?.();
      } else {
        pastBookingsPage = nextPage;
        win.renderPastBookings?.();
      }
    });
  };

  win.toggleBookingView = (view: "main" | "settings") => {
    const mainView = document.getElementById("booking-main-view");
    const settingsView = document.getElementById("booking-settings-view");
    const settingsButton = document.getElementById("btn-booking-settings");
    const mainButton = document.getElementById("btn-booking-main");

    if (mainView) {
      mainView.style.display = view === "main" ? "block" : "none";
    }
    if (settingsView) {
      settingsView.style.display = view === "settings" ? "block" : "none";
    }
    if (settingsButton) {
      settingsButton.style.display = view === "main" ? "inline-flex" : "none";
    }
    if (mainButton) {
      mainButton.style.display = view === "settings" ? "inline-flex" : "none";
    }

    if (view === "settings") {
      win.renderWeeklySchedule?.();
      win.renderBlockedSlots?.();
      win.renderHolidays?.();
    }
  };

  win.setBookingSubNav = (button: HTMLElement, sectionId: string) => {
    button.closest(".booking-sub-nav")?.querySelectorAll(".booking-sub-btn").forEach((node) => node.classList.remove("active"));
    button.classList.add("active");
    ["bookingSub-active", "bookingSub-past", "bookingSub-calendar", "bookingSub-schedule", "bookingSub-holidays"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        section.style.display = id === sectionId ? "block" : "none";
      }
    });

    if (sectionId === "bookingSub-active") {
      win.renderActiveBookings?.();
    } else if (sectionId === "bookingSub-past") {
      win.renderPastBookings?.();
    } else if (sectionId === "bookingSub-calendar") {
      win.renderWeeklyCalendar?.();
    } else if (sectionId === "bookingSub-schedule") {
      win.renderWeeklySchedule?.();
      win.renderBlockedSlots?.();
    } else if (sectionId === "bookingSub-holidays") {
      win.renderHolidays?.();
    }
  };

  win.openModal = () => {
    const modal = document.getElementById("bookingModal") as HTMLDialogElement | null;
    modal?.showModal();
  };

  win.closeModal = () => {
    const bookingModal = document.getElementById("bookingModal") as HTMLDialogElement | null;
    if (bookingModal?.open) {
      bookingModal.close();
      return;
    }

    document.getElementById("callModal")?.classList.remove("open");
  };

  win.submitBooking = (event: Event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement | null;
    const resolveBookingValue = (
      fieldName: string,
      fallbackId: string
    ) => {
      const scopedInput = form?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-booking-field="${fieldName}"], [name="booking${fieldName.charAt(0).toUpperCase()}${fieldName.slice(1)}"]`
      );
      const fallbackInput = document.getElementById(fallbackId) as HTMLInputElement | HTMLTextAreaElement | null;
      return normalizeText(scopedInput?.value || fallbackInput?.value || "");
    };

    const customer = resolveBookingValue("customer", "bookName");
    const phone = resolveBookingValue("phone", "bookPhone");
    const date = resolveBookingValue("date", "bookDate");
    const time = resolveBookingValue("time", "bookTime");

    if (!customer || !phone || !date || !time) {
      showToast("Fill in all booking fields before saving.", "warn");
      return;
    }

    const nextEntries = [
      {
        id: crypto.randomUUID(),
        customer,
        service: "Manual Booking",
        date,
        time,
        notes: `Phone ${phone}`,
        createdAt: new Date().toISOString(),
      },
      ...getManualBookings(),
    ];

    saveManualBookings(nextEntries);
    form?.reset();
    win.closeModal?.();
    showToast(`Booking created for ${customer}.`, "success");
    updateBookingsPage(win.__versaficDashboardState || state);
  };

  win.renderActiveBookings = () => {
    renderRowsIntoTable(
      "activeBookingsBody",
      getCurrentRows(),
      "activeBookingPageSize",
      "activeBookingSearch",
      "activeBookingFrom",
      "activeBookingTo",
      "activeBookingsPagination",
      "active"
    );
  };

  win.renderPastBookings = () => {
    const rows = [...getCurrentRows()].reverse();
    renderRowsIntoTable(
      "pastBookingsBody",
      rows,
      "pastBookingPageSize",
      "pastBookingSearch",
      "pastBookingFrom",
      "pastBookingTo",
      "pastBookingsPagination",
      "past"
    );
  };

  win.openDayDetail = (dateValue: string) => {
    const dialog = document.getElementById("bookingDetailDialog") as HTMLDialogElement | null;
    const title = document.getElementById("detailDialogTitle");
    const content = document.getElementById("detailDialogContent");
    if (!dialog || !title || !content) {
      return;
    }

    const displayDate = formatDate(dateValue);
    const rows = getCurrentRows().filter((row) => row.date === displayDate);
    title.textContent = `Bookings on ${displayDate}`;
    content.innerHTML =
      rows
        .map(
          (row) => `
            <div style="padding:12px 0;border-bottom:1px solid var(--border)">
              <div style="font-weight:700;color:var(--text-primary)">${escapeHtml(row.customer)}</div>
              <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:4px">${escapeHtml(`${row.time} · ${row.service}`)}</div>
              <div style="font-size:0.8rem;color:var(--text-muted);margin-top:6px">${escapeHtml(row.notes)}</div>
            </div>
          `
        )
        .join("") ||
      `<div style="text-align:center;padding:24px 0;color:var(--text-muted);font-size:0.9rem;">No bookings scheduled for this day.</div>`;
    dialog.showModal();
  };

  win.renderWeeklyCalendar = () => {
    renderBookingsCalendar(getCurrentRows());
  };

  win.renderWeeklySchedule = () => {
    renderBookingScheduleTable();
  };

  win.saveSchedule = () => {
    const rows = WEEK_DAYS.map((day, index) => {
      const enabled = (document.querySelector<HTMLInputElement>(`[data-schedule-toggle="${index}"]`)?.checked) ?? false;
      const from = document.querySelector<HTMLInputElement>(`[data-schedule-from="${index}"]`)?.value || "09:00";
      const to = document.querySelector<HTMLInputElement>(`[data-schedule-to="${index}"]`)?.value || "17:00";
      return { day, enabled, from, to };
    });

    saveWeeklyScheduleEntries(rows);
    win.renderWeeklySchedule?.();
    showToast("Schedule saved locally for this dashboard.", "success");
  };

  win.renderBlockedSlots = () => {
    renderBlockedSlotsTable();
  };

  win.addBlockedSlot = () => {
    const day = normalizeText((document.getElementById("blockDay") as HTMLSelectElement | null)?.value);
    const from = normalizeText((document.getElementById("blockFrom") as HTMLInputElement | null)?.value);
    const to = normalizeText((document.getElementById("blockTo") as HTMLInputElement | null)?.value);
    const reason = normalizeText((document.getElementById("blockReason") as HTMLInputElement | null)?.value) || "Blocked";

    if (!day || !from || !to) {
      showToast("Choose a day and time range first.", "warn");
      return;
    }

    const nextEntries = [{ id: crypto.randomUUID(), day, from, to, reason }, ...getBlockedSlotEntries()];
    saveBlockedSlotEntries(nextEntries);
    (document.getElementById("blockReason") as HTMLInputElement | null)?.setAttribute("value", "");
    const reasonInput = document.getElementById("blockReason") as HTMLInputElement | null;
    if (reasonInput) {
      reasonInput.value = "";
    }
    win.renderBlockedSlots?.();
    showToast("Blocked slot added.", "success");
  };

  win.renderHolidays = () => {
    renderHolidayRows();
  };

  win.addHoliday = () => {
    const date = normalizeText((document.getElementById("holidayDate") as HTMLInputElement | null)?.value);
    const reason = normalizeText((document.getElementById("holidayReason") as HTMLInputElement | null)?.value);

    if (!date || !reason) {
      showToast("Enter a date and reason before blocking it.", "warn");
      return;
    }

    const nextEntries = [{ id: crypto.randomUUID(), date, reason }, ...getHolidayEntries()];
    saveHolidayEntries(nextEntries);
    const reasonInput = document.getElementById("holidayReason") as HTMLInputElement | null;
    if (reasonInput) {
      reasonInput.value = "";
    }
    win.renderHolidays?.();
    showToast("Blocked date added.", "success");
  };

  win.exportTableCSV = (bodyId: string, filename: string) => {
    const table = document.getElementById(bodyId)?.closest("table");
    if (table instanceof HTMLTableElement) {
      exportTable(table, filename);
      showToast("CSV exported.", "success");
    }
  };
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

  const sections = settingsPage.querySelectorAll<HTMLElement>(".settings-section");
  const identitySection = sections[0] || null;
  const voiceSection = sections[1] || null;

  const displayNameSelect =
    settingsPage.querySelector<HTMLSelectElement>("#aiDisplayName") ||
    identitySection?.querySelector<HTMLSelectElement>("select") ||
    null;
  const greetingTextarea =
    settingsPage.querySelector<HTMLTextAreaElement>("#aiGreetingMessage") ||
    identitySection?.querySelector<HTMLTextAreaElement>("textarea") ||
    null;
  const businessNameInput =
    settingsPage.querySelector<HTMLInputElement>("#aiBusinessName") ||
    identitySection?.querySelector<HTMLInputElement>("input[type='text']") ||
    null;
  const languageSelect =
    settingsPage.querySelector<HTMLSelectElement>("#aiLanguage") ||
    (voiceSection?.querySelectorAll<HTMLSelectElement>("select")[1] ?? null);

  if (displayNameSelect && !displayNameSelect.id) {
    displayNameSelect.id = "aiDisplayName";
  }
  if (greetingTextarea && !greetingTextarea.id) {
    greetingTextarea.id = "aiGreetingMessage";
  }
  if (businessNameInput && !businessNameInput.id) {
    businessNameInput.id = "aiBusinessName";
  }
  if (languageSelect && !languageSelect.id) {
    languageSelect.id = "aiLanguage";
  }

  if (!settingsPage.querySelector("#aiNumberDisplay")) {
    const callSection = document.createElement("div");
    callSection.className = "settings-section";
    callSection.id = "aiCallControlsSection";
    callSection.innerHTML = `
      <h3><i data-lucide="phone" style="width:1em;height:1em;vertical-align:middle"></i> AI Calling Access</h3>
      <div class="form-group">
        <label class="input-label">AI Number</label>
        <input class="input-field" id="aiNumberDisplay" type="text" readonly>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">Outbound Call Consent</div>
          <div class="setting-desc">Enable this account to receive AI outbound calls from the configured AI number.</div>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input id="aiCallConsentToggle" type="checkbox">
            <div class="toggle-track"></div>
          </label>
        </div>
      </div>
      <div class="setting-row">
        <div class="setting-info">
          <div class="setting-label">Opt Out of AI Calls</div>
          <div class="setting-desc">Turn this on to block future AI outbound calls for this account.</div>
        </div>
        <div class="setting-control">
          <label class="toggle-switch">
            <input id="aiCallOptOutToggle" type="checkbox">
            <div class="toggle-track"></div>
          </label>
        </div>
      </div>
      <div id="aiConsentHint" style="font-size:0.82rem;color:var(--text-muted);margin-top:10px"></div>
      <div class="form-group" style="margin-top:16px">
        <label class="input-label">Test Call Number</label>
        <input class="input-field" id="aiTestCallNumber" type="text" placeholder="Enter the phone number to receive the Exotel test call">
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="aiPlaceTestCallBtn" type="button">Place Test Call</button>
        <div id="aiCallActionHint" style="font-size:0.82rem;color:var(--text-muted)">Save consent, then place a test call to the number above.</div>
      </div>
    `;

    const insertionPoint = voiceSection || identitySection;
    if (insertionPoint?.parentNode) {
      insertionPoint.parentNode.insertBefore(callSection, insertionPoint.nextSibling);
    } else {
      settingsPage.appendChild(callSection);
    }
    refreshLegacyIcons();
  }

  if (!settingsPage.querySelector("#aiTestCallNumber")) {
    const testCallWrap = document.createElement("div");
    testCallWrap.id = "aiTestCallWrap";
    testCallWrap.innerHTML = `
      <div class="form-group" style="margin-top:16px">
        <label class="input-label">Test Call Number</label>
        <input class="input-field" id="aiTestCallNumber" type="text" placeholder="Enter the phone number to receive the Exotel test call">
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="aiPlaceTestCallBtn" type="button">Place Test Call</button>
        <div id="aiCallActionHint" style="font-size:0.82rem;color:var(--text-muted)">Save consent, then place a test call to the number above.</div>
      </div>
    `;

    const hintNode = settingsPage.querySelector("#aiConsentHint");
    if (hintNode?.parentNode) {
      hintNode.parentNode.insertBefore(testCallWrap, hintNode.nextSibling);
    } else {
      settingsPage.appendChild(testCallWrap);
    }
  }

  if (!settingsPage.querySelector("#simulateIncomingCallBtn")) {
    const incomingDemoWrap = document.createElement("div");
    incomingDemoWrap.id = "incomingCallDemoWrap";
    incomingDemoWrap.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:16px">
          <button class="btn btn-secondary btn-sm" id="simulateIncomingCallBtn" type="button">Simulate Incoming AI Call</button>
          <div id="incomingCallDemoStatus" style="font-size:0.82rem;color:var(--text-muted)">Run a local Exotel webhook simulation and view the AI voice response.</div>
        </div>
        <div id="incomingCallDemoLog" style="margin-top:10px;font-size:0.82rem;color:var(--text-muted);line-height:1.6"></div>
      `;

    const callHintNode = settingsPage.querySelector("#aiCallActionHint");
    if (callHintNode?.parentNode) {
      callHintNode.parentNode.insertBefore(incomingDemoWrap, callHintNode.nextSibling);
    } else {
      settingsPage.appendChild(incomingDemoWrap);
    }
  }

  if (!settingsPage.querySelector("#mailgunDemoEmail")) {
    const mailgunDemoWrap = document.createElement("div");
    mailgunDemoWrap.id = "mailgunDemoWrap";
    mailgunDemoWrap.innerHTML = `
      <div class="form-group" style="margin-top:16px">
        <label class="input-label">Mailgun Demo Email</label>
        <input class="input-field" id="mailgunDemoEmail" type="email" placeholder="Enter the email address to receive a demo email">
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="mailgunSendTestBtn" type="button">Send Demo Email</button>
        <div id="mailgunDemoHint" style="font-size:0.82rem;color:var(--text-muted)">Send a Mailgun demo email from the configured backend mail service. If the Mailgun domain is sandboxed or restricted, only approved recipients can receive the email.</div>
      </div>
    `;

    const callHintNode = settingsPage.querySelector("#aiCallActionHint");
    if (callHintNode?.parentNode) {
      callHintNode.parentNode.insertBefore(mailgunDemoWrap, callHintNode.parentNode.nextSibling);
    } else {
      settingsPage.appendChild(mailgunDemoWrap);
    }
  }

  if (!settingsPage.querySelector("#smsDemoPhone")) {
    const smsDemoWrap = document.createElement("div");
    smsDemoWrap.id = "smsDemoWrap";
    smsDemoWrap.innerHTML = `
      <div class="form-group" style="margin-top:16px">
        <label class="input-label">SMS Demo Number</label>
        <input class="input-field" id="smsDemoPhone" type="text" placeholder="Enter the phone number to receive a demo SMS">
      </div>
      <div class="form-group">
        <label class="input-label">SMS Demo Message</label>
        <textarea class="input-field" id="smsDemoMessage" rows="3" placeholder="Enter a short demo message"></textarea>
      </div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" id="smsSendDemoBtn" type="button">Send Demo SMS</button>
        <div id="smsDemoHint" style="font-size:0.82rem;color:var(--text-muted)">Send a transactional MSG91 demo SMS from the configured backend SMS service.</div>
      </div>
    `;

    const mailgunHintNode = settingsPage.querySelector("#mailgunDemoHint");
    if (mailgunHintNode?.parentNode) {
      mailgunHintNode.parentNode.insertBefore(smsDemoWrap, mailgunHintNode.parentNode.nextSibling);
    } else {
      settingsPage.appendChild(smsDemoWrap);
    }
  }

  const aiNumberInput = settingsPage.querySelector<HTMLInputElement>("#aiNumberDisplay");
  const consentToggle = settingsPage.querySelector<HTMLInputElement>("#aiCallConsentToggle");
  const optOutToggle = settingsPage.querySelector<HTMLInputElement>("#aiCallOptOutToggle");
  const consentHint = settingsPage.querySelector<HTMLElement>("#aiConsentHint");
  const testCallNumberInput = settingsPage.querySelector<HTMLInputElement>("#aiTestCallNumber");
  const mailgunDemoEmailInput = settingsPage.querySelector<HTMLInputElement>("#mailgunDemoEmail");
  const smsDemoPhoneInput = settingsPage.querySelector<HTMLInputElement>("#smsDemoPhone");
  const smsDemoMessageInput = settingsPage.querySelector<HTMLTextAreaElement>("#smsDemoMessage");
  const testCallButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>("#aiPlaceTestCallBtn")
  );
  const simulateIncomingCallButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>("#simulateIncomingCallBtn")
  );
  const mailgunDemoButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>("#mailgunSendTestBtn")
  );
  const smsDemoButton = replaceInteractiveElement(
    settingsPage.querySelector<HTMLButtonElement>("#smsSendDemoBtn")
  );
  const testCallHint = settingsPage.querySelector<HTMLElement>("#aiCallActionHint");
  const incomingCallDemoStatus = settingsPage.querySelector<HTMLElement>("#incomingCallDemoStatus");
  const incomingCallDemoLog = settingsPage.querySelector<HTMLElement>("#incomingCallDemoLog");
  const mailgunDemoHint = settingsPage.querySelector<HTMLElement>("#mailgunDemoHint");
  const smsDemoHint = settingsPage.querySelector<HTMLElement>("#smsDemoHint");

  if (businessNameInput && state.setup?.businessName) {
    businessNameInput.value = state.setup.businessName;
  }
  if (greetingTextarea && state.callConfig?.intro_message) {
    greetingTextarea.value = `${state.callConfig.intro_message} How can I help you today?`;
  }
  if (aiNumberInput) {
    aiNumberInput.value = state.callConfig?.ai_number || "Not configured yet";
  }
  if (testCallNumberInput) {
    testCallNumberInput.value = state.user?.phone_number || state.setup?.phone || "";
  }
  if (mailgunDemoEmailInput) {
    mailgunDemoEmailInput.value = state.user?.email || "";
  }
  if (smsDemoPhoneInput) {
    smsDemoPhoneInput.value = state.user?.phone_number || state.setup?.phone || "";
  }
  if (smsDemoMessageInput) {
    smsDemoMessageInput.value = "hi welcome to versafic";
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
        ? "This account has saved consent for Exotel AI outbound calls."
        : "Enable consent if you want this account to receive Exotel AI outbound calls.";
  }
  const updateConsentHint = () => {
    if (!consentHint) {
      return;
    }

    consentHint.textContent = optOutToggle?.checked
      ? "This account is currently opted out of AI outbound calls."
      : consentToggle?.checked
        ? "This account has saved consent for Exotel AI outbound calls."
        : "Enable consent if you want this account to receive Exotel AI outbound calls.";
  };
  consentToggle?.addEventListener("change", updateConsentHint);
  optOutToggle?.addEventListener("change", updateConsentHint);
  if (languageSelect) {
    languageSelect.value = "English (US)";
  }

  const smsConfig = await getSmsConfig().catch(() => null);
  if (smsDemoHint) {
    smsDemoHint.textContent = smsConfig?.configured
      ? `MSG91 is configured${smsConfig.senderId ? ` with sender ${smsConfig.senderId}` : ""}. Use the demo send button to verify delivery.`
      : "MSG91 SMS demo is not configured on the backend yet.";
  }
  if (smsDemoButton && smsConfig && !smsConfig.configured) {
    smsDemoButton.setAttribute("disabled", "true");
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
      if (testCallHint && state.callConfig?.ai_number) {
        testCallHint.textContent = `Your account is now ready for Exotel calls from ${state.callConfig.ai_number}.`;
      }
    } catch (error) {
      const message = error instanceof LegacyApiError ? error.message : "Unable to save settings right now.";
      showToast(message, "warn");
    }
  });

  testCallButton?.addEventListener("click", async () => {
    const user = state.user;
    const phone = normalizeText(testCallNumberInput?.value) || normalizeText(user?.phone_number) || normalizeText(state.setup?.phone);
    const phoneValidationMessage = getPhoneValidationMessage(phone);

    if (!user?.email) {
      showToast("Log in again before placing a test call.", "warn");
      return;
    }

    if (!state.callConfig?.configured || !state.callConfig?.ai_number) {
      showToast("The Exotel AI number is not configured yet.", "warn");
      return;
    }

    if (phoneValidationMessage) {
      if (testCallHint) {
        testCallHint.textContent = phoneValidationMessage;
      }
      showToast(phoneValidationMessage, "warn");
      testCallNumberInput?.focus();
      return;
    }

    if (optOutToggle?.checked) {
      const message = "Turn off call opt-out before placing an Exotel test call.";
      if (testCallHint) {
        testCallHint.textContent = message;
      }
      showToast(message, "warn");
      return;
    }

    if (!consentToggle?.checked) {
      const message = "Enable outbound call consent before placing an Exotel test call.";
      if (testCallHint) {
        testCallHint.textContent = message;
      }
      showToast(message, "warn");
      consentToggle?.focus();
      return;
    }

    const originalLabel = testCallButton.textContent;
    testCallButton.textContent = "Calling...";
    testCallButton.setAttribute("disabled", "true");

    try {
      await updateCurrentUser({
        phone_number: phone,
        call_consent: true,
        call_opt_out: false,
      });

      const businesses = await getBusinessList(50);
      const ownBusiness = businesses.find((business) => business.email === user.email);

      await startExotelCall({
        customer_number: phone,
        business_id: ownBusiness?.id,
      });

      if (testCallHint) {
        testCallHint.textContent = `Exotel call requested from ${state.callConfig.ai_number} to ${phone}.`;
      }
      showToast(`Exotel is calling ${phone} now.`, "success");
    } catch (error) {
      const message = error instanceof LegacyApiError ? error.message : "Unable to place the Exotel test call right now.";
      if (isExotelKycBlockMessage(message) && state.callConfig?.ai_number) {
        const inboundMessage = `Outbound calling is waiting for Exotel KYC. For now, call the AI number ${state.callConfig.ai_number} to test the inbound assistant.`;
        if (testCallHint) {
          testCallHint.textContent = inboundMessage;
        }
        showToast(inboundMessage, "info");
        triggerPublicCallDialer("Opening inbound AI number");
        return;
      }

      if (testCallHint) {
        testCallHint.textContent = message;
      }
      showToast(message, "warn");
    } finally {
      testCallButton.textContent = originalLabel || "Place Test Call";
      testCallButton.removeAttribute("disabled");
    }
  });

  simulateIncomingCallButton?.addEventListener("click", async () => {
    const user = state.user;
    const phone = normalizeText(testCallNumberInput?.value) || normalizeText(user?.phone_number) || normalizeText(state.setup?.phone);
    const phoneValidationMessage = phone ? getPhoneValidationMessage(phone) : null;

    if (!user?.email) {
      showToast("Log in again before simulating an incoming call.", "warn");
      return;
    }

    if (phoneValidationMessage) {
      if (incomingCallDemoStatus) {
        incomingCallDemoStatus.textContent = phoneValidationMessage;
      }
      showToast(phoneValidationMessage, "warn");
      testCallNumberInput?.focus();
      return;
    }

    const originalLabel = simulateIncomingCallButton.textContent;
    simulateIncomingCallButton.textContent = "Calling...";
    simulateIncomingCallButton.setAttribute("disabled", "true");
    if (incomingCallDemoStatus) {
      incomingCallDemoStatus.textContent = "calling...";
    }
    if (incomingCallDemoLog) {
      incomingCallDemoLog.textContent = "calling...";
    }

    try {
      const businesses = await getBusinessList(50);
      const ownBusiness = businesses.find((business) => business.email === user.email);
      const response = await simulateExotelIncoming({
        customer_number: phone || undefined,
        business_id: ownBusiness?.id,
      });

      response.statuses.forEach((entry, index) => {
        window.setTimeout(() => {
          if (incomingCallDemoStatus) {
            incomingCallDemoStatus.textContent = entry.status;
          }
          if (incomingCallDemoLog) {
            incomingCallDemoLog.innerHTML = response.statuses
              .slice(0, index + 1)
              .map((item) => `<div><strong>${escapeHtml(item.status)}</strong> · ${escapeHtml(item.message)}</div>`)
              .join("");
          }
        }, index * 450);
      });

      window.setTimeout(() => {
        if (incomingCallDemoLog) {
          incomingCallDemoLog.innerHTML += `<div><strong>AI response</strong> · ${escapeHtml(response.ai_response)}</div>`;
        }
      }, response.statuses.length * 450);

      showToast("Incoming AI call simulation completed.", "success");
    } catch (error) {
      const message =
        error instanceof LegacyApiError ? error.message : "Unable to simulate the incoming AI call right now.";
      if (incomingCallDemoStatus) {
        incomingCallDemoStatus.textContent = message;
      }
      if (incomingCallDemoLog) {
        incomingCallDemoLog.textContent = message;
      }
      showToast(message, "warn");
    } finally {
      window.setTimeout(() => {
        simulateIncomingCallButton.textContent = originalLabel || "Simulate Incoming AI Call";
        simulateIncomingCallButton.removeAttribute("disabled");
      }, 1500);
    }
  });

  mailgunDemoButton?.addEventListener("click", async () => {
    const recipient = normalizeText(mailgunDemoEmailInput?.value || state.user?.email || "");
    const emailValidationMessage = getBasicEmailValidationMessage(recipient);

    if (emailValidationMessage) {
      if (mailgunDemoHint) {
        mailgunDemoHint.textContent = emailValidationMessage;
      }
      showToast(emailValidationMessage, "warn");
      mailgunDemoEmailInput?.focus();
      return;
    }

    const originalLabel = mailgunDemoButton.textContent;
    mailgunDemoButton.textContent = "Sending...";
    mailgunDemoButton.setAttribute("disabled", "true");

    try {
      const response = await sendTestEmail(recipient);
      const provider = normalizeText(response.provider) || "Mailgun";
      const deliveredTo = normalizeText(response.recipient) || recipient;
      if (mailgunDemoHint) {
        mailgunDemoHint.textContent = `${provider} accepted the demo email for ${deliveredTo}.`;
      }
      showToast(`Demo email queued for ${deliveredTo}.`, "success");
    } catch (error) {
      const message = error instanceof LegacyApiError ? error.message : "Unable to send the Mailgun demo email right now.";
      if (mailgunDemoHint) {
        mailgunDemoHint.textContent = message;
      }
      showToast(message, "warn");
    } finally {
      mailgunDemoButton.textContent = originalLabel || "Send Demo Email";
      mailgunDemoButton.removeAttribute("disabled");
    }
  });

  smsDemoButton?.addEventListener("click", async () => {
    const phone = normalizeText(smsDemoPhoneInput?.value || state.user?.phone_number || state.setup?.phone);
    const phoneValidationMessage = getPhoneValidationMessage(phone);
    const message = normalizeText(smsDemoMessageInput?.value || "");

    if (phoneValidationMessage) {
      if (smsDemoHint) {
        smsDemoHint.textContent = phoneValidationMessage;
      }
      showToast(phoneValidationMessage, "warn");
      smsDemoPhoneInput?.focus();
      return;
    }

    if (!message) {
      const hintMessage = "Enter a short SMS demo message before sending.";
      if (smsDemoHint) {
        smsDemoHint.textContent = hintMessage;
      }
      showToast(hintMessage, "warn");
      smsDemoMessageInput?.focus();
      return;
    }

    const originalLabel = smsDemoButton.textContent;
    smsDemoButton.textContent = "Sending...";
    smsDemoButton.setAttribute("disabled", "true");

    try {
      const response = await sendSmsDemo({
        phoneNumber: phone,
        message,
      });

      if (smsDemoHint) {
        smsDemoHint.textContent = response.warning
          ? `MSG91 accepted the demo SMS for ${response.phoneNumber}. ${response.warning}`
          : `MSG91 accepted the demo SMS for ${response.phoneNumber}.`;
      }
      showToast(
        response.warning ? "SMS queued, but DLT setup is needed for Indian delivery." : `Demo SMS queued for ${response.phoneNumber}.`,
        response.warning ? "warn" : "success"
      );
    } catch (error) {
      const messageText =
        error instanceof LegacyApiError ? error.message : "Unable to send the SMS demo right now.";
      if (smsDemoHint) {
        smsDemoHint.textContent = messageText;
      }
      showToast(messageText, "warn");
    } finally {
      smsDemoButton.textContent = originalLabel || "Send Demo SMS";
      if (!smsConfig || smsConfig.configured) {
        smsDemoButton.removeAttribute("disabled");
      }
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
      `<div class="chat-bubble user"><div class="chat-avatar user">${iconHtml("user")}</div><div class="chat-msg">${message}</div></div>`
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
        `<div class="chat-bubble"><div class="chat-avatar ai">${iconHtml("bot")}</div><div class="chat-msg">${reply.aiResponse}</div></div>`
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

  if (!win.__versaficSelectedBookingFilter) {
    win.__versaficSelectedBookingFilter = "Active";
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
    win.__versaficSelectedBookingFilter = button.textContent?.trim() || "Active";
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

const applyDashboardState = async (state: DashboardState, options?: { markReady?: boolean }) => {
  getWindowRef().__versaficDashboardState = state;
  bindDashboardFilterControls(state);
  bindDashboardNavigation();
  updateSidebarIdentity(state);

  const backHome = replaceInteractiveElement(document.querySelector<HTMLAnchorElement>("aside .btn"));
  backHome?.setAttribute("href", "/search");

  updateDashboardSummary(filterDashboardState(state, getSelectedDateFilter("page-overview")));
  updateBillingPage(state);
  updateCallsPage(state);
  updateChatsPage(state);
  updateCustomersPage(state);
  updateAnalyticsPage(state);
  updateBookingsPage(state);
  await bindAiSettingsPanel(state);
  primeRazorpayCheckout();
  refreshLegacyIcons();
  if (options?.markReady) {
    setDashboardReady(true);
  }
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
  setDashboardReady(false);
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
  await applyDashboardState(initialState, { markReady: false });

  const [
    walletResult,
    plansResult,
    callConfigResult,
    callSessionsResult,
    chatStatsResult,
    voiceStatsResult,
    setupResult,
  ] = await Promise.allSettled([
    getWallet(),
    getPlans(),
    getCallConfig(),
    getCallSessions(12),
    getChatStats(),
    getVoiceStats(),
    getSetupBusiness(),
  ]);

  const state = buildDashboardState(user, existingState, {
    wallet: walletResult.status === "fulfilled" ? walletResult.value : existingState?.wallet,
    plans: plansResult.status === "fulfilled" ? plansResult.value.plans : existingState?.plans,
    callConfig: callConfigResult.status === "fulfilled" ? callConfigResult.value : existingState?.callConfig,
    callSessions:
      callSessionsResult.status === "fulfilled" ? callSessionsResult.value.sessions : existingState?.callSessions,
    chatStats: chatStatsResult.status === "fulfilled" ? chatStatsResult.value : existingState?.chatStats,
    voiceStats: voiceStatsResult.status === "fulfilled" ? voiceStatsResult.value : existingState?.voiceStats,
    setup: setupResult.status === "fulfilled" ? setupResult.value : existingState?.setup,
  });

  await applyDashboardState(state, { markReady: true });
  markDashboardPagesLoaded("overview", "calls");
  void loadDashboardPageData(getDashboardPageFromLocation());
  } catch (error) {
    console.error("Failed to bind dashboard page", error);
    setDashboardReady(true);
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

  if (pageKey === "profile" || pageKey.startsWith("profile-")) {
    await bindProfilePage(pageKey);
    return;
  }

  if (pageKey.startsWith("dashboard")) {
    await bindDashboardPage();
  }
};

export function LegacyBindings({ pageKey }: LegacyBindingsProps) {
  useLayoutEffect(() => {
    if (pageKey.startsWith("dashboard")) {
      setDashboardReady(false);
      bindDashboardNavigation();
      bootstrapSidebarIdentityFromSession();
      const storedUser = getStoredUser();
      if (storedUser) {
        void applyDashboardState(buildDashboardState(storedUser, getWindowRef().__versaficDashboardState), {
          markReady: false,
        });
      }
    }

    void initializePage(pageKey)
      .catch((error) => {
        console.error(`Failed to initialize legacy bindings for ${pageKey}`, error);
      })
      .finally(() => {
        refreshLegacyIcons();
      });
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
