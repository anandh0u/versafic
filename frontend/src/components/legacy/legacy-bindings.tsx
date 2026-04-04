"use client";

import { useEffect } from "react";
import {
  BillingPlan,
  BusinessRecord,
  CallSession,
  ChatHistoryItem,
  ChatStats,
  createBusinessRecord,
  createOrder,
  getAutopayStatus,
  getBusinessList,
  getCallConfig,
  getCallSessions,
  getChatHistory,
  getChatStats,
  getCurrentUser,
  getPlans,
  getPublicCallConfig,
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
  city: string;
  rating: string;
  reviews: string;
  trust: number;
  aiLabels: string[];
  description: string;
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
};

type RazorpayWindow = Window & {
  Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  showToast?: (message: string, type?: string) => void;
  openLogin?: () => void;
  closeLogin?: () => void;
  nextStep?: () => void;
  sendChat?: () => void;
  filterCallsTable?: () => void;
  filterChatsTable?: () => void;
  renderResults?: () => void;
  setFilter?: (button: HTMLElement, kind: string) => void;
  doSearch?: () => void;
  startCall?: () => void;
  simulateCall?: () => void;
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
};

const selectedPlanOutline = "2px solid #6366f1";
let razorpayLoader: Promise<void> | null = null;

const getWindowRef = (): RazorpayWindow => window as RazorpayWindow;

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

const buildDirectoryBusiness = (business: BusinessRecord): DirectoryBusiness => {
  const kind = slugKind(`${business.business_type} ${business.business_name}`);
  const presets: Record<
    BusinessKind,
    {
      emoji: string;
      badgeClass: string;
      badgeText: string;
      city: string;
      rating: string;
      reviews: string;
      trust: number;
      aiLabels: string[];
      description: string;
    }
  > = {
    hotel: {
      emoji: "🏨",
      badgeClass: "badge-blue",
      badgeText: "✓ Verified",
      city: "Hospitality",
      rating: "4.9",
      reviews: "240+",
      trust: 98,
      aiLabels: ["📅 Bookings", "🛎️ Support", "📞 Calls"],
      description: "AI concierge, booking, and customer support powered through Versafic.",
    },
    restaurant: {
      emoji: "🍽️",
      badgeClass: "badge-green",
      badgeText: "✓ Verified",
      city: "Dining",
      rating: "4.8",
      reviews: "180+",
      trust: 95,
      aiLabels: ["📅 Reservations", "🍷 Menus", "📞 Calls"],
      description: "AI-powered reservations, inquiries, and guest communication.",
    },
    clinic: {
      emoji: "🏥",
      badgeClass: "badge-green",
      badgeText: "✓ Verified",
      city: "Healthcare",
      rating: "4.8",
      reviews: "320+",
      trust: 99,
      aiLabels: ["📅 Appointments", "💊 Support", "📞 Calls"],
      description: "AI scheduling, intake, and patient communication assistant.",
    },
    barber: {
      emoji: "✂️",
      badgeClass: "badge-blue",
      badgeText: "✓ Verified",
      city: "Personal Care",
      rating: "4.9",
      reviews: "140+",
      trust: 97,
      aiLabels: ["📅 Appointments", "✂️ Services", "📞 Calls"],
      description: "AI booking and answer handling for service businesses.",
    },
    creator: {
      emoji: "📸",
      badgeClass: "badge-purple",
      badgeText: "✓ Creator",
      city: "Creator Economy",
      rating: "4.9",
      reviews: "500+",
      trust: 96,
      aiLabels: ["🤝 Collaborations", "💬 Inquiries", "📞 Calls"],
      description: "AI assistant for creator partnerships, deals, and inbound interest.",
    },
    consultant: {
      emoji: "💼",
      badgeClass: "badge-cyan",
      badgeText: "✓ Verified",
      city: "Professional Services",
      rating: "4.7",
      reviews: "90+",
      trust: 92,
      aiLabels: ["📅 Consultations", "💼 Intake", "📞 Calls"],
      description: "AI-powered intake, scheduling, and qualification for service teams.",
    },
    agency: {
      emoji: "🚀",
      badgeClass: "badge-cyan",
      badgeText: "✓ Verified",
      city: "Agency",
      rating: "4.8",
      reviews: "110+",
      trust: 94,
      aiLabels: ["📋 Discovery", "🤝 Leads", "📞 Calls"],
      description: "AI assistant for inbound leads, qualification, and follow-up.",
    },
  };

  const preset = presets[kind];

  return {
    ...business,
    kind,
    emoji: preset.emoji,
    badgeClass: preset.badgeClass,
    badgeText: preset.badgeText,
    city: preset.city,
    rating: preset.rating,
    reviews: preset.reviews,
    trust: preset.trust,
    aiLabels: preset.aiLabels,
    description: preset.description,
  };
};

const parseTopUpOption = (label: string) => {
  const match = label.match(/([\d,]+)\s*Credits?\s*-\s*(?:₹|INR\s*)?([\d,]+)/i);
  if (!match) {
    return null;
  }

  const credits = Number(match[1].replace(/,/g, ""));
  const rupees = Number(match[2].replace(/,/g, ""));
  if (!credits || !rupees) {
    return null;
  }

  return {
    credits,
    amountPaise: rupees * 100,
  };
};

const ensureRazorpay = async () => {
  const win = getWindowRef();
  if (win.Razorpay) {
    return;
  }

  if (!razorpayLoader) {
    razorpayLoader = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Razorpay failed to load")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.dataset.razorpay = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay failed to load"));
      document.head.appendChild(script);
    });
  }

  await razorpayLoader;
};

const openCheckout = async (planPayload: {
  planId?: string;
  amountPaise?: number;
  credits?: number;
  onSuccess?: () => Promise<void> | void;
}) => {
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
  if (session?.accessToken && location.pathname === "/login") {
    window.location.href = "/dashboard";
    return;
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

  modal?.querySelectorAll<HTMLButtonElement>(".social-btn").forEach((button) => {
    const replacement = replaceInteractiveElement(button);
    replacement?.addEventListener("click", () => {
      showToast("Social sign-in can be added next. Use email login for now.", "info");
    });
  });
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
  injectOnboardingPasswordField();
  await patchOnboardingPlans();

  const win = getWindowRef();
  const originalNextStep = win.__versaficOriginalNextStep || win.nextStep;
  if (originalNextStep) {
    win.__versaficOriginalNextStep = originalNextStep;
  }

  win.nextStep = async () => {
    const activeStep = document.querySelector(".step-content.active")?.id;
    const nextButton = document.getElementById("btnNext") as HTMLButtonElement | null;

    if (activeStep === "step-4" && !win.__versaficOnboardingAccountCreated) {
      const name = (document.getElementById("fullName") as HTMLInputElement | null)?.value.trim() || "";
      const email = (document.getElementById("accountEmail") as HTMLInputElement | null)?.value.trim() || "";
      const password = (document.getElementById("accountPassword") as HTMLInputElement | null)?.value.trim() || "";

      if (!name || !email || !password) {
        showToast("Add your name, email, and password before creating the account.", "warn");
        return;
      }

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
      const phone = `${phonePrefix}${phoneInputs[1]?.value.trim() || ""}`;
      const accountType =
        document.querySelector<HTMLElement>(".acc-type.active .card-text")?.textContent?.trim() || "Business";
      const activeSubcategory =
        document.querySelector<HTMLElement>("#bus-sub-categories .tag-pill.active, #per-sub-categories .tag-pill.active")
          ?.textContent?.trim() || accountType;
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
      }

      return;
    }

    win.__versaficOriginalNextStep?.();
  };
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
          <div class="biz-avatar" style="background:rgba(99,102,241,0.14)">${business.emoji}</div>
          <div class="biz-info">
            <div class="biz-name-row">
              <span class="biz-name">${business.business_name}</span>
              <span class="badge ${business.badgeClass}">${business.badgeText}</span>
            </div>
            <div class="biz-category">${business.business_type} · ${business.city}</div>
            <div class="biz-meta">
              <span>⭐ ${business.rating} (${business.reviews})</span>
              <span class="biz-phone">📞 ${business.phone}</span>
              ${business.aiLabels.map((label) => `<span>${label}</span>`).join("")}
            </div>
            <div class="biz-desc">${business.description}</div>
          </div>
          <div class="biz-actions">
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();window.location.href='/profile/${business.id}'">View Profile →</button>
            <div class="trust-score"><span>${business.trust}%</span>Trust Score</div>
          </div>
        </div>
      `
    )
    .join("");

  resultsCount.innerHTML = `<span>${items.length}</span> verified results`;
  searchMeta.textContent = `Showing ${items.length} results`;
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
      featuredTitle.textContent = `${businesses[0].business_name} — live on the Versafic directory`;
      featuredAction?.addEventListener("click", () => {
        window.location.href = `/profile/${businesses[0].id}`;
      });
    }

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
        const haystack = `${business.business_name} ${business.business_type} ${business.owner_name} ${business.city}`.toLowerCase();
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

    const modalCallButton = replaceInteractiveElement(
      document.querySelector<HTMLButtonElement>("#callModal .btn.btn-primary")
    );
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
    const searchInput = document.getElementById("searchInput") as HTMLInputElement | null;
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
    glow.setAttribute("style", "background: radial-gradient(circle, rgba(99,102,241,0.26) 0%, transparent 70%);");
  }

  wrap.innerHTML = `
    <div class="profile-avatar" style="background:rgba(99,102,241,0.15)">${business.emoji}</div>
    <div class="profile-name">${business.business_name}</div>
    <div class="profile-handle">@${business.business_name.toLowerCase().replace(/[^a-z0-9]+/g, "")}</div>
    <div class="profile-badges">
      <span class="verified-chip">${business.badgeText}</span>
    </div>
    <p class="profile-bio">${business.description}</p>
    <div class="profile-meta">
      <div class="meta-item">⭐ <span class="meta-value">${business.rating}</span>(${business.reviews})</div>
      <div class="meta-item">⚡ <span class="meta-value">&lt; 2s</span> response</div>
      <div class="meta-item">📍 <span class="meta-value">${business.city}</span></div>
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
        <span class="hours-day">Versafic Trust Score</span>
        <span class="hours-time">${business.trust}%</span>
      </div>
      <div class="hours-row">
        <span class="hours-day">Created</span>
        <span class="hours-time">${formatDate(business.created_at || null)}</span>
      </div>
    </div>

    <div class="trust-banner">
      <div>
        <div class="trust-score-num">${business.trust}%</div>
      </div>
      <div style="flex:1">
        <div class="trust-label">Versafic Trust Score</div>
        <div class="trust-subtitle">✓ Listed business · ✓ AI-ready workflow · ✓ Directory verified</div>
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

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">${row.name}</td>
          <td><span class="badge ${row.intentBadge}">${row.intent}</span></td>
          <td style="color:${row.outcomeColor};font-weight:600">${row.outcome}</td>
          <td>${row.status}</td>
          <td>${row.date}</td>
          <td>${row.duration}</td>
          <td>${row.credits}</td>
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

  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td style="color:var(--text-primary);font-weight:600">${row.name}</td>
          <td><span class="badge ${row.intentBadge}">${row.intent}</span></td>
          <td style="color:${row.outcomeColor};font-weight:600">${row.outcome}</td>
          <td>${row.status}</td>
          <td>${row.date}</td>
          <td>${row.messages}</td>
          <td>${row.credits}</td>
        </tr>
      `
    )
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
  const totalConversations = totalChats + totalCalls;
  const uniqueUsers = new Set(
    state.callSessions.map((session) => session.phone_number || session.from_number || session.to_number)
  ).size;
  const resolved = state.callSessions.filter((session) => session.status === "completed").length;
  const escalated = state.callSessions.filter((session) => ["failed", "no-answer"].includes(session.status)).length;
  const statValues = [
    { value: formatNumber(totalConversations), label: "Total Conversations", change: `${formatNumber(totalConversations)} live` },
    { value: formatNumber(uniqueUsers), label: "Unique Users", change: `${formatNumber(uniqueUsers)} callers` },
    { value: formatNumber(totalCalls), label: "AI Calls", change: `${formatNumber(totalCalls)} synced` },
    { value: formatNumber(totalChats), label: "Chats", change: `${formatNumber(totalChats)} synced` },
    { value: state.voiceStats ? String(state.voiceStats.totalBookings || 0) : "0", label: "Bookings", change: "Backend ready" },
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
    heroInfo.textContent = `~${Math.max(1, Math.floor(state.wallet.balance_credits / 20))} minutes of AI call time remaining`;
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
    topUpSelect.innerHTML = `
      <option>100 Credits - INR 10</option>
      <option>250 Credits - INR 25</option>
      <option>500 Credits - INR 50</option>
      <option>1000 Credits - INR 100</option>
    `;
  }

  topUpButton?.addEventListener("click", async () => {
    const option = topUpSelect?.selectedOptions[0]?.textContent || "";
    const parsed = parseTopUpOption(option);
    if (!parsed) {
      showToast("Choose a valid top-up amount first.", "warn");
      return;
    }

    try {
      await openCheckout({
        amountPaise: parsed.amountPaise,
        credits: parsed.credits,
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
    const textNodes = paymentCards[0].querySelectorAll("div");
    if (textNodes[2]) {
      textNodes[2].textContent = "Razorpay Checkout";
    }
    if (textNodes[3]) {
      textNodes[3].textContent = "Secure hosted payment flow";
    }
  }
  if (paymentCards[1]) {
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
      showToast("Autopay is not configured yet. Enable it from the billing backend flow.", "info");
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

const updateCallsPage = (state: DashboardState) => {
  const callsPage = document.getElementById("page-calls");
  if (!callsPage) {
    return;
  }

  const sessions = state.callSessions;
  const uniqueCallers = new Set(sessions.map((session) => session.phone_number || session.from_number || session.to_number)).size;
  const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);
  const completedCalls = sessions.filter((session) => session.status === "completed").length;
  const failedCalls = sessions.filter((session) => ["failed", "no-answer"].includes(session.status)).length;
  const resolutionRate = sessions.length ? Math.round((completedCalls / sessions.length) * 100) : 0;
  const dropRate = sessions.length ? ((failedCalls / sessions.length) * 100).toFixed(1) : "0.0";
  const avgDuration = sessions.length ? Math.round(totalDuration / sessions.length) : 0;

  const statCards = Array.from(callsPage.querySelectorAll(".stat-card"));
  const metrics = [
    formatNumber(sessions.length),
    formatNumber(uniqueCallers),
    formatDuration(avgDuration),
    `${resolutionRate}%`,
    `${dropRate}%`,
    state.callConfig?.configured ? "Live" : "Off",
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
    intent: session.purpose?.replace(/_/g, " ") || (session.type === "incoming" ? "Incoming Support" : "Outbound Follow-up"),
    intentBadge: session.type === "incoming" ? "badge-blue" : "badge-purple",
    outcome: session.status === "completed" ? "Resolved" : session.status === "no-answer" ? "Missed" : session.status,
    outcomeColor:
      session.status === "completed" ? "var(--green)" : session.status === "no-answer" ? "var(--amber)" : "var(--red)",
    status: session.status,
    date: formatDate(session.created_at),
    duration: formatDuration(session.duration_seconds),
    credits: String(session.cost_credits || state.callConfig?.call_credit_cost || 20),
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
};

const updateChatsPage = (state: DashboardState) => {
  const chatsPage = document.getElementById("page-chats");
  if (!chatsPage) {
    return;
  }

  const rows = state.chatHistory.map((item) => ({
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
  const totalMessages = state.chatStats?.totalMessages ?? state.chatHistory.length;
  const totalTokens = state.chatStats?.totalTokens ?? 0;
  const values = [
    formatNumber(totalMessages),
    formatNumber(state.chatHistory.length),
    formatNumber(Math.ceil(totalTokens / 100 || 0)),
    "Synced",
    formatNumber(totalTokens),
    state.chatHistory[0] ? formatDate(state.chatHistory[0].created_at || state.chatHistory[0].createdAt || null) : "--",
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
};

const bindAiSettingsPanel = async (state: DashboardState) => {
  const settingsPage = document.getElementById("page-agent");
  if (!settingsPage) {
    return;
  }

  const inputs = collectPageInputs(settingsPage, ".settings-section .input-field");
  const displayNameSelect = inputs[0] as HTMLSelectElement | undefined;
  const greetingTextarea = inputs[1] as HTMLTextAreaElement | undefined;
  const businessNameInput = inputs[2] as HTMLInputElement | undefined;
  const languageSelect = inputs[4] as HTMLSelectElement | undefined;

  if (businessNameInput && state.setup?.businessName) {
    businessNameInput.value = state.setup.businessName;
  }
  if (greetingTextarea && state.callConfig?.intro_message) {
    greetingTextarea.value = `${state.callConfig.intro_message} How can I help you today?`;
  }
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
        `${displayNameSelect?.value || "Assistant"} settings saved. Voice and intent toggles remain linked to the current backend defaults.`,
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

const bindDashboardPage = async () => {
  let user = getStoredUser();

  if (!user) {
    try {
      user = await getCurrentUser();
    } catch {
      window.location.href = "/login";
      return;
    }
  }

  const [
    walletResult,
    plansResult,
    autopayResult,
    setupResult,
    setupStatusResult,
    callConfigResult,
    callSessionsResult,
    chatHistoryResult,
    chatStatsResult,
    voiceStatsResult,
  ] = await Promise.allSettled([
    getWallet(),
    getPlans(),
    getAutopayStatus(),
    getSetupBusiness(),
    getSetupStatus(),
    getCallConfig(),
    getCallSessions(),
    getChatHistory(),
    getChatStats(),
    getVoiceStats(),
  ]);

  const state: DashboardState = {
    user,
    wallet: walletResult.status === "fulfilled" ? walletResult.value : null,
    plans: plansResult.status === "fulfilled" ? plansResult.value.plans : [],
    autopay: autopayResult.status === "fulfilled" ? autopayResult.value : null,
    setup: setupResult.status === "fulfilled" ? setupResult.value : null,
    setupStatus: setupStatusResult.status === "fulfilled" ? setupStatusResult.value : null,
    callConfig: callConfigResult.status === "fulfilled" ? callConfigResult.value : null,
    callSessions: callSessionsResult.status === "fulfilled" ? callSessionsResult.value.sessions : [],
    chatHistory: chatHistoryResult.status === "fulfilled" ? chatHistoryResult.value.messages : [],
    chatStats: chatStatsResult.status === "fulfilled" ? chatStatsResult.value : null,
    voiceStats: voiceStatsResult.status === "fulfilled" ? voiceStatsResult.value : null,
  };

  getWindowRef().__versaficDashboardState = state;

  const backHome = replaceInteractiveElement(document.querySelector<HTMLAnchorElement>("aside .btn"));
  backHome?.setAttribute("href", "/");

  updateDashboardSummary(state);
  updateBillingPage(state);
  updateCallsPage(state);
  updateChatsPage(state);
  await bindAiSettingsPanel(state);
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
    window.setTimeout(() => {
      void initializePage(pageKey).catch((error) => {
        console.error(`Failed to initialize legacy bindings for ${pageKey}`, error);
      });
    }, 120);
  }, [pageKey]);

  return null;
}
