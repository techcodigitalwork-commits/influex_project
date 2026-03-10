"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

type Role = "creator" | "brand";
type Tab = "plans" | "tokens" | "escrow" | "features";

const creatorPlans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "/month",
    badge: null,
    tokens: 100,
    features: [
      { text: "Create your profile", ok: true },
      { text: "Basic search visibility", ok: true },
      { text: "100 tokens/month", ok: true },
      { text: "10 tokens per campaign apply", ok: true },
      { text: "Max 10 applications/month", ok: true },
      { text: "Basic analytics", ok: true },
      { text: "Brand contact hidden", ok: false },
      { text: "Verified badge", ok: false },
      { text: "Profile boost", ok: false },
      { text: "AI campaign matching", ok: false },
    ],
    cta: "Current Plan",
    ctaDisabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹499",
    period: "/month",
    badge: "Popular",
    tokens: 300,
    features: [
      { text: "300 tokens/month", ok: true },
      { text: "Unlimited campaign browsing", ok: true },
      { text: "30 applications/month", ok: true },
      { text: "Profile boost in search", ok: true },
      { text: "Advanced analytics", ok: true },
      { text: "Campaign alerts", ok: true },
      { text: "Verified badge", ok: true },
      { text: "Priority support", ok: false },
      { text: "Featured profile listing", ok: false },
      { text: "AI campaign matching", ok: false },
    ],
    cta: "Upgrade to Pro",
    ctaDisabled: false,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: "₹999",
    period: "/month",
    badge: "Best Value",
    tokens: 600,
    features: [
      { text: "600 tokens/month", ok: true },
      { text: "Unlimited applications", ok: true },
      { text: "Featured profile listing", ok: true },
      { text: "Direct brand invite option", ok: true },
      { text: "Priority support", ok: true },
      { text: "AI campaign matching", ok: true },
      { text: "Verified + Featured badge", ok: true },
      { text: "Rewards & profile boost", ok: true },
      { text: "Early access to campaigns", ok: true },
      { text: "Dispute protection", ok: true },
    ],
    cta: "Upgrade to Pro+",
    ctaDisabled: false,
  },
];

const brandPlans = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "/month",
    badge: null,
    tokens: 100,
    features: [
      { text: "10 free campaign posts", ok: true },
      { text: "100 tokens/month", ok: true },
      { text: "10 tokens per campaign post", ok: true },
      { text: "Basic influencer view", ok: true },
      { text: "In-app chat", ok: true },
      { text: "Direct contact unlock", ok: false },
      { text: "Advanced filters", ok: false },
      { text: "Influencer shortlist tool", ok: false },
      { text: "AI recommended creators", ok: false },
      { text: "Priority campaign visibility", ok: false },
    ],
    cta: "Current Plan",
    ctaDisabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹999",
    period: "/month",
    badge: "Popular",
    tokens: 500,
    features: [
      { text: "30 campaign posts/month", ok: true },
      { text: "500 tokens/month", ok: true },
      { text: "Advanced filters", ok: true },
      { text: "Direct chat unlock", ok: true },
      { text: "Influencer shortlist tool", ok: true },
      { text: "Campaign analytics", ok: true },
      { text: "Escrow payment protection", ok: true },
      { text: "Priority support", ok: false },
      { text: "AI recommended creators", ok: false },
      { text: "Unlimited campaigns", ok: false },
    ],
    cta: "Upgrade to Pro",
    ctaDisabled: false,
  },
  {
    id: "pro_plus",
    name: "Pro+",
    price: "₹1,999",
    period: "/month",
    badge: "Best Value",
    tokens: 1000,
    features: [
      { text: "Unlimited campaigns", ok: true },
      { text: "1000 tokens/month", ok: true },
      { text: "Influencer analytics", ok: true },
      { text: "AI recommended creators", ok: true },
      { text: "Priority campaign visibility", ok: true },
      { text: "Featured campaign slot", ok: true },
      { text: "Escrow + dispute protection", ok: true },
      { text: "Dedicated account manager", ok: true },
      { text: "Contract management", ok: true },
      { text: "Early access to creators", ok: true },
    ],
    cta: "Upgrade to Pro+",
    ctaDisabled: false,
  },
];

const tokenPacks = [
  { tokens: 100, price: 99, bonus: 0, label: "Starter" },
  { tokens: 500, price: 399, bonus: 50, label: "Popular" },
  { tokens: 1000, price: 699, bonus: 150, label: "Best Value" },
];

const tokenUseCases = {
  creator: [
    { action: "Apply to a campaign", cost: "10 tokens" },
    { action: "Profile boost (7 days)", cost: "50 tokens" },
    { action: "Verified badge (one-time)", cost: "100 tokens" },
    { action: "Priority listing (30 days)", cost: "200 tokens" },
  ],
  brand: [
    { action: "Post a campaign", cost: "10 tokens" },
    { action: "Unlock influencer contact", cost: "20 tokens" },
    { action: "Featured campaign (7 days)", cost: "100 tokens" },
    { action: "AI creator recommendations", cost: "50 tokens" },
  ],
};

const escrowSteps = [
  { step: "1", icon: "📋", title: "Create Campaign", desc: "Brand posts a campaign and sets the budget. Example: ₹10,000" },
  { step: "2", icon: "💰", title: "Escrow Deposit", desc: "Brand deposits ₹10,000 on the platform. The money is securely locked until work is approved." },
  { step: "3", icon: "🤝", title: "Creator Accepts", desc: "Creator accepts the campaign and starts working on the deliverables." },
  { step: "4", icon: "📸", title: "Submit Work", desc: "Creator submits proof of work: reel link, post link, story screenshot." },
  { step: "5", icon: "✅", title: "Brand Approves", desc: "Brand reviews the submitted work and clicks approve." },
  { step: "6", icon: "🎉", title: "Payment Released", desc: "Platform releases payment instantly. Creator: ₹9,000 | Platform commission: ₹1,000 (10%)" },
];

const platformFeatures = [
  { icon: "🔒", title: "Contact Info Hidden", desc: "Until a deal is confirmed, creator's phone, email, WhatsApp, and Instagram are hidden. Communication stays inside the app only.", tag: "Privacy", tagColor: "#4f46e5" },
  { icon: "🚨", title: "Keyword Detection", desc: 'If anyone types "WhatsApp", "phone number", "DM me", or similar in chat, the platform shows an instant warning. All communication stays on-platform.', tag: "Safety", tagColor: "#ef4444" },
  { icon: "📄", title: "Campaign Contracts", desc: "Both brand and creator sign an agreement — deliverables, timeline, and payment terms are all legally documented before work begins.", tag: "Legal", tagColor: "#16a34a" },
  { icon: "📦", title: "Deliverables Tracking", desc: "A campaign is not marked complete until the creator uploads proof (reel/post/story) and the brand approves the submission.", tag: "Tracking", tagColor: "#d97706" },
  { icon: "🏆", title: "Reward System", desc: "Complete deals on-platform and earn extra tokens, profile boost, and better search ranking. Staying on-platform always pays more.", tag: "Rewards", tagColor: "#7c3aed" },
  { icon: "🤖", title: "AI Smart Matching", desc: "Our AI suggests the best creators for each campaign based on niche, follower count, location, and past performance.", tag: "AI", tagColor: "#0891b2" },
];

export default function UpgradePage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("creator");
  const [tab, setTab] = useState<Tab>("plans");
  const [selectedPack, setSelectedPack] = useState<number | null>(null);

  // User state
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activePlan, setActivePlan] = useState<string | null>(null);

  // Payment state
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("cb_user");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setUser(parsed);
    const t = parsed.token || localStorage.getItem("token") || "";
    setToken(t);
    if (parsed.isSubscribed) setIsSubscribed(true);
    if (parsed.activePlan) setActivePlan(parsed.activePlan);

    // Detect role for default tab
    if (parsed.role?.toLowerCase() === "brand") setRole("brand");
    else setRole("creator");
  }, []);

  // ─── STEP 1: Call backend to create Razorpay subscription ───
  const handleSubscribe = async (planId: string, planName: string) => {
    if (!user) {
      showToast("Please login first.", "error");
      return;
    }
    if (!token) {
      showToast("Session expired. Please login again.", "error");
      return;
    }

    setLoadingPlanId(planId);

    try {
      const res = await fetch(`${API}/subscription/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_id: PLAN_ID }),
      });

      const data = await res.json();

      if (!data.success || !data.subscription?.id) {
        showToast(data.message || "Failed to create subscription. Try again.", "error");
        setLoadingPlanId(null);
        return;
      }

      // STEP 2: Open Razorpay popup with subscription id
      openRazorpay(data.subscription.id, planId, planName);

    } catch (err) {
      console.error("Subscribe error:", err);
      showToast("Something went wrong. Please try again.", "error");
      setLoadingPlanId(null);
    }
  };

  // ─── STEP 2: Open Razorpay checkout popup ───
  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const options = {
      key: RAZORPAY_KEY,
      subscription_id: subscriptionId,
      name: "Influex Premium",
      description: `${planName} Plan — Monthly Subscription`,
      theme: { color: "#4f46e5" },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      handler: async function (response: any) {
        // STEP 3: Payment success → verify on backend
        await verifyAndActivate(response, planId, planName);
      },
      modal: {
        ondismiss: () => {
          showToast("Payment cancelled.", "error");
          setLoadingPlanId(null);
        },
      },
    };

    const rzp = new (window as any).Razorpay(options);

    rzp.on("payment.failed", (resp: any) => {
      showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
      setLoadingPlanId(null);
    });

    rzp.open();
  };

  // ─── STEP 3: Verify payment signature + activate subscription ───
  const verifyAndActivate = async (
    response: {
      razorpay_payment_id: string;
      razorpay_subscription_id: string;
      razorpay_signature: string;
    },
    planId: string,
    planName: string
  ) => {
    try {
      // First try to verify signature
      const verifyRes = await fetch(`${API}/subscription/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_subscription_id: response.razorpay_subscription_id,
          razorpay_signature: response.razorpay_signature,
          plan_id: PLAN_ID,
          planId,
          planName,
        }),
      });

      const verifyData = await verifyRes.json();

      if (verifyData.success) {
        await activateSubscription(planId, planName);
      } else {
        // Verify failed — try manual activate as fallback
        console.warn("Verify failed, trying manual activate...");
        await activateSubscription(planId, planName);
      }
    } catch (err) {
      console.error("Verify error:", err);
      // Fallback to activate
      await activateSubscription(planId, planName);
    }
  };

  // ─── STEP 4: Call activate API + update localStorage ───
  const activateSubscription = async (planId: string, planName: string) => {
    try {
      const res = await fetch(`${API}/subscription/activate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_id: PLAN_ID,
          planId,
          planName,
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Update localStorage
        const stored = localStorage.getItem("cb_user");
        const parsed = stored ? JSON.parse(stored) : {};
        const updated = {
          ...parsed,
          isSubscribed: true,
          activePlan: planId,
          activePlanName: planName,
        };
        localStorage.setItem("cb_user", JSON.stringify(updated));
        setUser(updated);
        setIsSubscribed(true);
        setActivePlan(planId);
        showToast(`🎉 ${planName} plan activated successfully!`, "success");
      } else {
        showToast(data.message || "Activation failed. Contact support.", "error");
      }
    } catch (err) {
      console.error("Activate error:", err);
      showToast("Activation failed. Please contact support.", "error");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const plans = role === "creator" ? creatorPlans : brandPlans;

  return (
    <>
      {/* Load Razorpay SDK */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}

        /* TOAST */
        .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
        .up-toast.success{background:#16a34a;color:#fff}
        .up-toast.error{background:#ef4444;color:#fff}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

        /* ACTIVE PLAN BANNER */
        .up-active-banner{max-width:960px;margin:0 auto 0;padding:0 40px}
        @media(max-width:600px){.up-active-banner{padding:0 16px}}
        .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .up-active-left{display:flex;align-items:center;gap:12px}
        .up-active-title{font-size:15px;font-weight:700;color:#34d399}
        .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
        .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}

        /* HERO */
        .up-hero{position:relative;padding:60px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
        @media(max-width:600px){.up-hero{padding:40px 16px 0}}
        .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px}
        .up-hero-title{font-size:clamp(26px,5vw,50px);font-weight:900;line-height:1.1;margin-bottom:16px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .up-hero-sub{font-size:16px;color:rgba(255,255,255,0.5);max-width:520px;margin:0 auto 36px;line-height:1.6}

        .up-role{display:inline-flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:4px;margin-bottom:40px;gap:4px}
        .up-role-btn{padding:10px 28px;border-radius:10px;border:none;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
        .up-role-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}

        .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
        @media(max-width:600px){.up-tabs{padding:0 16px}}
        .up-tabs::-webkit-scrollbar{display:none}
        .up-tab{padding:14px 22px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
        .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
        .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}

        .up-content{padding:40px 40px 80px}
        @media(max-width:600px){.up-content{padding:24px 16px 60px}}

        /* Plans */
        .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:960px;margin:0 auto}
        .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
        .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
        .plan-card.active-plan{border-color:rgba(16,185,129,0.5) !important;background:rgba(16,185,129,0.06) !important}
        .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
        .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
        .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
        .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}
        .plan-name{font-size:14px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
        .plan-price{font-size:38px;font-weight:900;color:#fff;margin-bottom:4px}
        .plan-price span{font-size:16px;font-weight:500;color:rgba(255,255,255,0.4)}
        .plan-tokens{display:inline-flex;align-items:center;gap:6px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:20px}
        .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 18px}
        .plan-features{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
        .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
        .plan-feature-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
        .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
        .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}

        /* CTA Buttons */
        .plan-cta{width:100%;padding:14px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
        .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
        .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
        .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
        .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
        .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
        .plan-cta.active{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
        .plan-cta:disabled{opacity:0.6;cursor:not-allowed;transform:none !important}

        /* Spinner */
        .spin{width:15px;height:15px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
        @keyframes spinning{to{transform:rotate(360deg)}}

        /* Tokens */
        .token-hero{text-align:center;margin-bottom:40px}
        .token-hero-title{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
        .token-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto}
        .token-cols{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:900px;margin:0 auto 48px}
        @media(max-width:700px){.token-cols{grid-template-columns:1fr}}
        .token-uses-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:16px}
        .token-uses-list{display:flex;flex-direction:column;gap:10px}
        .token-use-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px}
        .token-use-action{font-size:13px;color:rgba(255,255,255,0.7)}
        .token-use-cost{font-size:12px;font-weight:800;background:rgba(251,191,36,0.12);color:#fbbf24;padding:3px 10px;border-radius:100px;border:1px solid rgba(251,191,36,0.2)}
        .token-packs-title{font-size:20px;font-weight:900;color:#fff;text-align:center;margin-bottom:20px}
        .token-packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:760px;margin:0 auto}
        .token-pack{border-radius:16px;padding:24px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;text-align:center}
        .token-pack.selected{border-color:#4f46e5;background:rgba(79,70,229,0.12)}
        .token-pack:hover{border-color:rgba(79,70,229,0.4)}
        .token-pack-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#a5b4fc;margin-bottom:10px}
        .token-pack-amount{font-size:36px;font-weight:900;color:#fff;margin-bottom:2px}
        .token-pack-bonus{font-size:12px;color:#10b981;font-weight:700;margin-bottom:12px;min-height:18px}
        .token-pack-price{font-size:22px;font-weight:900;color:#fbbf24}
        .token-pack-buy{margin-top:16px;width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-size:13px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s}
        .token-pack-buy:hover{transform:translateY(-1px)}

        /* Escrow */
        .escrow-hero{text-align:center;margin-bottom:40px}
        .escrow-hero-title{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
        .escrow-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
        .escrow-steps{display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto 48px}
        .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
        .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
        .escrow-step-num{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .escrow-step-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:4px}
        .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
        .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:28px}
        .escrow-breakdown-title{font-size:16px;font-weight:800;color:#a5b4fc;margin-bottom:20px;text-align:center}
        .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
        .escrow-row:last-child{border-bottom:none}
        .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
        .escrow-row-val{font-size:16px;font-weight:800}
        .escrow-row-val.brand{color:#f87171}
        .escrow-row-val.platform{color:#fbbf24}
        .escrow-row-val.creator{color:#34d399}
        .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:20px;width:100%;justify-content:center}

        /* Features */
        .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;max-width:960px;margin:0 auto}
        .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:24px;transition:all 0.25s}
        .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
        .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
        .feat-icon{font-size:28px}
        .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
        .feat-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:8px}
        .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}

        .section-title{font-size:22px;font-weight:900;color:#fff;text-align:center;margin-bottom:6px}
        .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:32px}

        /* Bottom CTA */
        .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:60px 40px;text-align:center}
        .up-bottom-title{font-size:clamp(22px,4vw,38px);font-weight:900;color:#fff;margin-bottom:12px}
        .up-bottom-sub{font-size:15px;color:rgba(255,255,255,0.5);margin-bottom:28px}
        .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .up-bottom-btn{padding:14px 32px;border-radius:14px;font-size:15px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
        .up-bottom-btn.primary:hover{transform:translateY(-2px)}
        .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
        .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}

        .up-secure{font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px}
      `}</style>

      {/* Toast Notification */}
      {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="up">

        {/* Active Plan Banner */}
        {isSubscribed && (
          <div className="up-active-banner" style={{ paddingTop: 20 }}>
            <div className="up-active-inner">
              <div className="up-active-left">
                <span style={{ fontSize: 28 }}>🎉</span>
                <div>
                  <div className="up-active-title">Your plan is active!</div>
                  <div className="up-active-sub">You have full access to all premium features.</div>
                </div>
              </div>
              <span className="up-active-badge">✓ {activePlan?.replace("_", " ").toUpperCase() || "Pro"} Active</span>
            </div>
          </div>
        )}

        {/* HERO */}
        <div className="up-hero">
          <div className="up-hero-label">✦ CreatorBridge Platform</div>
          <h1 className="up-hero-title">
            Close deals on platform,<br />security is guaranteed
          </h1>
          <p className="up-hero-sub">
            Escrow payments, verified creators, smart contracts — all in one platform.
            Safer and more reliable than direct deals.
          </p>

          <div className="up-role">
            <button className={`up-role-btn ${role === "creator" ? "active" : ""}`} onClick={() => setRole("creator")}>
              🎨 Creator Plans
            </button>
            <button className={`up-role-btn ${role === "brand" ? "active" : ""}`} onClick={() => setRole("brand")}>
              🏢 Brand Plans
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="up-tabs">
          {(["plans", "tokens", "escrow", "features"] as Tab[]).map((t) => (
            <button key={t} className={`up-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "plans" && "💎 Plans"}
              {t === "tokens" && "🪙 Tokens"}
              {t === "escrow" && "🔐 Escrow"}
              {t === "features" && "⚡ Features"}
            </button>
          ))}
        </div>

        <div className="up-content">

          {/* PLANS TAB */}
          {tab === "plans" && (
            <>
              <div className="section-title">{role === "creator" ? "Creator" : "Brand"} Plans</div>
              <div className="section-sub">
                {role === "creator"
                  ? "Start free, upgrade when you're ready to grow your creator career"
                  : "The right tools to find the best creators and run successful campaigns"}
              </div>
              <div className="plans-grid">
                {plans.map((plan, i) => {
                  const isThisActive = isSubscribed && activePlan === plan.id;
                  const isLoading = loadingPlanId === plan.id;

                  return (
                    <div
                      key={plan.id}
                      className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}
                    >
                      {isThisActive
                        ? <div className="plan-active-badge">✓ Your Current Plana</div>
                        : plan.badge
                          ? <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div>
                          : null
                      }

                      <div style={{ marginTop: plan.badge || isThisActive ? 20 : 0 }}>
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-price">{plan.price}<span>{plan.period}</span></div>
                        <div className="plan-tokens">🪙 {plan.tokens} tokens/month</div>
                        <hr className="plan-divider" />
                        <ul className="plan-features">
                          {plan.features.map((f, fi) => (
                            <li key={fi} className="plan-feature">
                              <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>
                                {f.ok ? "✓" : "✕"}
                              </span>
                              {f.text}
                            </li>
                          ))}
                        </ul>

                        {/* CTA Button */}
                        {isThisActive ? (
                          <button className="plan-cta active" disabled>✓ Active Plan</button>
                        ) : plan.ctaDisabled ? (
                          <button className="plan-cta secondary" disabled>{plan.cta}</button>
                        ) : (
                          <>
                            <button
                              className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`}
                              disabled={loadingPlanId !== null}
                              onClick={() => handleSubscribe(plan.id, plan.name)}
                            >
                              {isLoading && <span className="spin" />}
                              {isLoading ? "Processing..." : plan.cta}
                            </button>
                            <div className="up-secure">🔒 Secured by Razorpay</div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* TOKENS TAB */}
          {tab === "tokens" && (
            <>
              <div className="token-hero">
                <div className="token-hero-title">🪙 Token Economy</div>
                <div className="token-hero-sub">Use tokens to apply to campaigns, post opportunities, and unlock creator contacts.</div>
              </div>
              <div className="token-cols">
                <div>
                  <div className="token-uses-title">🎨 Creator — Token Uses</div>
                  <div className="token-uses-list">
                    {tokenUseCases.creator.map((u, i) => (
                      <div key={i} className="token-use-row">
                        <span className="token-use-action">{u.action}</span>
                        <span className="token-use-cost">{u.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="token-uses-title">🏢 Brand — Token Uses</div>
                  <div className="token-uses-list">
                    {tokenUseCases.brand.map((u, i) => (
                      <div key={i} className="token-use-row">
                        <span className="token-use-action">{u.action}</span>
                        <span className="token-use-cost">{u.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="token-packs-title">Purchase Extra Tokens</div>
              <div className="token-packs">
                {tokenPacks.map((pack, i) => (
                  <div
                    key={i}
                    className={`token-pack ${selectedPack === i ? "selected" : ""}`}
                    onClick={() => setSelectedPack(i)}
                  >
                    <div className="token-pack-label">{pack.label}</div>
                    <div className="token-pack-amount">{pack.tokens.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>tokens</div>
                    <div className="token-pack-bonus">{pack.bonus > 0 ? `+${pack.bonus} bonus tokens!` : " "}</div>
                    <div className="token-pack-price">₹{pack.price}</div>
                    <button className="token-pack-buy">Buy Now</button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ESCROW TAB */}
          {tab === "escrow" && (
            <>
              <div className="escrow-hero">
                <div className="escrow-hero-title">🔐 Escrow Payment System</div>
                <div className="escrow-hero-sub">
                  Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.
                </div>
              </div>
              <div className="escrow-steps">
                {escrowSteps.map((s) => (
                  <div key={s.step} className="escrow-step">
                    <div className="escrow-step-num">{s.icon}</div>
                    <div>
                      <div className="escrow-step-title">Step {s.step}: {s.title}</div>
                      <div className="escrow-step-desc">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="escrow-breakdown">
                <div className="escrow-breakdown-title">💰 Payment Breakdown Example</div>
                <div className="escrow-row"><span className="escrow-row-label">Brand deposits</span><span className="escrow-row-val brand">₹10,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Platform commission (10%)</span><span className="escrow-row-val platform">₹1,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Creator receives</span><span className="escrow-row-val creator">₹9,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Dispute protection</span><span className="escrow-row-val" style={{ color: "#a5b4fc" }}>✅ Included</span></div>
                <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
              </div>
            </>
          )}

          {/* FEATURES TAB */}
          {tab === "features" && (
            <>
              <div className="section-title">Platform Features</div>
              <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
              <div className="features-grid">
                {platformFeatures.map((f, i) => (
                  <div key={i} className="feat-card">
                    <div className="feat-top">
                      <span className="feat-icon">{f.icon}</span>
                      <span className="feat-tag" style={{ color: f.tagColor }}>{f.tag}</span>
                    </div>
                    <div className="feat-title">{f.title}</div>
                    <div className="feat-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>

        {/* BOTTOM CTA */}
        <div className="up-bottom">
          <div className="up-bottom-title">Dealing on-platform is<br />always the smarter choice</div>
          <div className="up-bottom-sub">Escrow protection · Verified creators · Smart contracts · Dispute resolution</div>
          <div className="up-bottom-btns">
            <button className="up-bottom-btn primary" onClick={() => setTab("plans")}>✦ View Plans</button>
            <button className="up-bottom-btn secondary" onClick={() => router.push("/browse")}>Browse Creators →</button>
          </div>
        </div>

      </div>
    </>
  );
}


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// // ── Coin rules ──
// const FREE_COINS        = 100;
// const COINS_PER_APPLY   = 10;   // influencer: apply karne ke liye
// const COINS_PER_CAMPAIGN= 20;   // brand: campaign post karne ke liye
// const FREE_CAMPAIGN_MAX = Math.floor(FREE_COINS / COINS_PER_CAMPAIGN); // = 5
// const FREE_APPLY_MAX    = Math.floor(FREE_COINS / COINS_PER_APPLY);    // = 10

// export default function UpgradePage() {
//   const [billing, setBilling]           = useState<"monthly" | "yearly">("monthly");
//   const [loadingPlan, setLoadingPlan]   = useState<string | null>(null);
//   const [user, setUser]                 = useState<any>(null);
//   const [activePlan, setActivePlan]     = useState<string | null>(null);
//   const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const [showLimitModal, setShowLimitModal] = useState(false);

//   // Stats
//   const [coins, setCoins]                     = useState<number>(FREE_COINS);
//   const [applicationsUsed, setApplicationsUsed] = useState<number>(0);
//   const [campaignsCreated, setCampaignsCreated] = useState<number>(0);
//   const [isSubscribed, setIsSubscribed]         = useState<boolean>(false);
//   const [planExpiry, setPlanExpiry]             = useState<string | null>(null);
//   const [checking, setChecking]                 = useState(true);

//   const role        = user?.role?.toLowerCase();
//   const isBrand     = role === "brand";
//   const isInfluencer= role === "influencer" || role === "creator";

//   // ── Load user + live subscription check on every mount (refresh-safe) ──
//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { setChecking(false); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const token = parsed.token || localStorage.getItem("token");
//     if (!token) { setChecking(false); return; }

//     Promise.all([
//       fetch(`${API}/profile/me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
//       fetch(`${API}/subscription/status`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).catch(() => null),
//     ]).then(([profileData, subData]) => {

//       // ── Profile stats ──
//       if (profileData?.success && profileData?.profile) {
//         const p = profileData.profile;
//         setCoins(p.coins ?? p.bits ?? FREE_COINS);
//         setApplicationsUsed(p.applicationsUsed ?? 0);
//         setCampaignsCreated(p.campaignsCreated ?? 0);
//       }

//       // ── Subscription status (live) ──
//       if (subData?.success && subData?.isActive) {
//         setIsSubscribed(true);
//         const pid = subData.planId || parsed.activePlan || "pro_monthly";
//         setActivePlan(pid);
//         setPlanExpiry(subData.expiresAt || null);
//         const updated = { ...parsed, isSubscribed: true, activePlan: pid };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//       } else if (subData?.success && !subData?.isActive) {
//         // Plan expired — clear localStorage
//         setIsSubscribed(false);
//         setActivePlan(null);
//         const updated = { ...parsed, isSubscribed: false, activePlan: null };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//       } else {
//         // API fail — fallback to localStorage
//         if (parsed.isSubscribed && parsed.activePlan) {
//           setIsSubscribed(true);
//           setActivePlan(parsed.activePlan);
//         }
//       }
//     }).finally(() => setChecking(false));
//   }, []);

//   // ── Show limit modal automatically when limit hit and no subscription ──
//   useEffect(() => {
//     if (checking || isSubscribed) return;
//     if (isBrand && campaignsCreated >= FREE_CAMPAIGN_MAX) setShowLimitModal(true);
//     if (isInfluencer && coins <= 0) setShowLimitModal(true);
//   }, [checking, isSubscribed, isBrand, isInfluencer, campaignsCreated, coins]);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4500);
//   };

//   // ── Razorpay handler ──
//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
//       handler: async function (response: any) {
//         // Verify signature → then activate
//         const stored  = localStorage.getItem("cb_user");
//         const parsed  = JSON.parse(stored || "{}");
//         const token   = parsed.token || localStorage.getItem("token");
//         try {
//           const vRes = await fetch(`${API}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//           const vData = await vRes.json();
//           if (vData.success) {
//             await activateSubscription(planId, planName, token, parsed);
//           } else {
//             await activateSubscription(planId, planName, token, parsed); // fallback
//           }
//         } catch {
//           await activateSubscription(planId, planName, token, parsed);
//         }
//       },
//       modal: {
//         ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); },
//       },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const activateSubscription = async (planId: string, planName: string, token: string, parsed: any) => {
//     try {
//       const res  = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//       });
//       const data = await res.json();
//       if (data.success) {
//         const updated = { ...parsed, isSubscribed: true, activePlan: planId, activePlanName: planName };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//         setActivePlan(planId);
//         setIsSubscribed(true);
//         setShowLimitModal(false);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//       } else {
//         showToast(data.message || "Activation failed.", "error");
//       }
//     } catch {
//       showToast("Activation failed. Contact support.", "error");
//     } finally {
//       setLoadingPlan(null);
//     }
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) { showToast("Please login first!", "error"); return; }
//     const token = user.token || localStorage.getItem("token");
//     if (!token) { showToast("Session expired. Login again.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription.", "error");
//         setLoadingPlan(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong. Try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   // ── Computed values ──
//   const coinsPercent       = Math.max(0, Math.min(100, (coins / FREE_COINS) * 100));
//   const coinsLow           = coins <= 20 && coins > 0;
//   const coinsEmpty         = coins <= 0;
//   const campaignPercent    = Math.min(100, (campaignsCreated / FREE_CAMPAIGN_MAX) * 100);
//   const campaignLimitHit   = campaignsCreated >= FREE_CAMPAIGN_MAX && !isSubscribed;
//   const campaignAlmostDone = campaignsCreated >= 3 && !campaignLimitHit && !isSubscribed;

//   // ── Plans ──
//   const buildPlans = (period: "monthly" | "yearly") => [
//     {
//       id: "free", name: "Free", price: "₹0", period: "/ month",
//       tagline: "Get started with Influex",
//       cta: "Your current plan", ctaDisabled: true,
//       badge: null, badgeColor: "", cardBg: "#f9f9f9", cardBorder: "#e5e5e5",
//       features: [
//         isBrand
//           ? `Post up to ${FREE_CAMPAIGN_MAX} campaigns (${COINS_PER_CAMPAIGN} coins each)`
//           : `Apply to up to ${FREE_APPLY_MAX} campaigns (${COINS_PER_APPLY} coins each)`,
//         "Basic profile page",
//         "Message brands / creators (limited)",
//         "Discovery feed access",
//       ],
//     },
//     {
//       id: period === "monthly" ? "pro_monthly" : "pro_yearly",
//       name: "Pro",
//       price: period === "monthly" ? "₹999" : "₹799",
//       period: period === "monthly" ? "/ month (incl. GST)" : "/ month, billed yearly",
//       tagline: "For serious creators & growing brands",
//       cta: "Upgrade to Pro", ctaDisabled: false,
//       badge: period === "yearly" ? "SAVE 20%" : null,
//       badgeColor: "#16a34a", cardBg: "#fff", cardBorder: "#e5e5e5",
//       features: [
//         "Unlimited coins — never run out",
//         isBrand ? "Unlimited campaign posts" : "Unlimited campaign applications",
//         "Priority listing in discovery",
//         "Unlimited messaging",
//         "Analytics dashboard",
//         "Verified badge",
//       ],
//     },
//     {
//       id: period === "monthly" ? "business_monthly" : "business_yearly",
//       name: "Business",
//       price: period === "monthly" ? "₹2,999" : "₹2,399",
//       period: period === "monthly" ? "/ month (incl. GST)" : "/ month, billed yearly",
//       tagline: "For brands running multiple campaigns",
//       cta: "Upgrade to Business", ctaDisabled: false,
//       badge: "RECOMMENDED", badgeColor: "#4f46e5", cardBg: "#fafafe", cardBorder: "#4f46e5",
//       features: [
//         "Everything in Pro",
//         "Post unlimited campaigns",
//         "Advanced creator search & filters",
//         "Team access (up to 5 seats)",
//         "Dedicated account manager",
//         "Campaign analytics & reports",
//         "Custom contract templates",
//       ],
//     },
//   ];

//   const currentPlans = buildPlans(billing);

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         :root{--primary:#4f46e5;--green:#16a34a;--red:#ef4444;--amber:#f59e0b}

//         .up-page{min-height:calc(100vh - 64px);background:#f7f7f5;font-family:'DM Sans',sans-serif;padding:40px 24px 80px}
//         .up-header{text-align:center;max-width:540px;margin:0 auto 32px}
//         .up-title{font-size:clamp(24px,4vw,36px);font-weight:500;color:#111;line-height:1.15;margin-bottom:10px}
//         .up-subtitle{font-size:15px;color:#777;line-height:1.6;font-weight:400}

//         /* CHECKING */
//         .up-checking{display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#aaa;max-width:960px;margin:0 auto 24px}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .up-mini-spin{width:15px;height:15px;border:2px solid #e0e0e0;border-top-color:var(--primary);border-radius:50%;animation:spin 0.7s linear infinite}

//         /* ACTIVE PLAN BANNER */
//         .up-active-banner{max-width:960px;margin:0 auto 28px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .up-active-banner-left{display:flex;align-items:center;gap:12px}
//         .up-active-banner-icon{font-size:28px}
//         .up-active-banner-title{font-size:15px;font-weight:600;color:#15803d}
//         .up-active-banner-sub{font-size:13px;color:var(--green);margin-top:2px}
//         .up-active-banner-badge{background:var(--green);color:#fff;font-size:12px;font-weight:600;padding:5px 14px;border-radius:100px}

//         /* LIMIT WARNING BANNER */
//         .up-limit-banner{max-width:960px;margin:0 auto 24px;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:14px;border:1.5px solid}
//         .up-limit-banner.warn{background:#fffbeb;border-color:#fbbf24}
//         .up-limit-banner.err{background:#fff5f5;border-color:var(--red)}
//         .up-limit-banner-icon{font-size:26px;flex-shrink:0}
//         .up-limit-banner-title{font-size:14px;font-weight:600;color:#111;margin-bottom:2px}
//         .up-limit-banner-sub{font-size:13px;color:#666}

//         /* USAGE CARDS */
//         .up-usage{max-width:960px;margin:0 auto 36px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
//         @media(max-width:760px){.up-usage{grid-template-columns:1fr 1fr}}
//         @media(max-width:480px){.up-usage{grid-template-columns:1fr}}

//         .up-uc{background:#fff;border-radius:16px;padding:18px 20px;border:1.5px solid #ebebeb;transition:border-color 0.2s}
//         .up-uc.warn{border-color:#fbbf24;background:#fffbeb}
//         .up-uc.err{border-color:var(--red);background:#fff5f5}
//         .up-uc.good{border-color:#86efac;background:#f0fdf4}

//         .up-uc-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;gap:8px}
//         .up-uc-label{font-size:12px;font-weight:500;color:#888}
//         .up-uc-hint{font-size:11px;color:#bbb;margin-top:2px}
//         .up-uc-val{font-size:26px;font-weight:700;color:#111;line-height:1}
//         .up-uc-val.err-val{color:var(--red)}
//         .up-uc-val.warn-val{color:#d97706}
//         .up-uc-val.good-val{color:var(--green)}

//         .up-prog{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin:6px 0 4px}
//         .up-prog-fill{height:100%;border-radius:100px;transition:width 0.6s ease}
//         .up-uc-foot{font-size:12px;color:#aaa;margin-top:2px}
//         .up-uc-foot.warn-foot{color:#d97706;font-weight:500}
//         .up-uc-foot.err-foot{color:var(--red);font-weight:600}
//         .up-uc-foot.good-foot{color:var(--green);font-weight:500}

//         /* TOGGLE */
//         .up-toggle{display:flex;align-items:center;justify-content:center;background:#e8e8e8;border-radius:100px;padding:4px;width:fit-content;margin:0 auto 44px}
//         .up-toggle-btn{padding:9px 24px;border-radius:100px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;color:#888;background:transparent}
//         .up-toggle-btn.active{background:#fff;color:#111;box-shadow:0 1px 6px rgba(0,0,0,0.1)}

//         /* PLAN GRID */
//         .up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:960px;margin:0 auto}
//         @media(max-width:860px){.up-grid{grid-template-columns:1fr 1fr}}
//         @media(max-width:560px){.up-grid{grid-template-columns:1fr;max-width:420px}}

//         .up-card{border-radius:20px;padding:28px 24px 30px;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;position:relative}
//         .up-card:hover{transform:translateY(-3px);box-shadow:0 14px 44px rgba(0,0,0,0.09)}
//         .up-card.featured{box-shadow:0 4px 28px rgba(79,70,229,0.14)}
//         .up-card.active-card{box-shadow:0 4px 28px rgba(22,163,74,0.15) !important}

//         .up-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;letter-spacing:0.07em;padding:4px 10px;border-radius:100px;color:#fff;margin-bottom:12px;width:fit-content}
//         .up-active-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--green);background:#f0fdf4;border:1px solid #86efac;padding:4px 10px;border-radius:100px;margin-bottom:12px;width:fit-content}
//         .up-placeholder-badge{height:26px;margin-bottom:12px}

//         .up-plan-name{font-size:24px;font-weight:500;color:#111;margin-bottom:4px}
//         .up-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
//         .up-price{font-size:34px;font-weight:600;color:#111;line-height:1}
//         .up-period{font-size:12px;color:#bbb;line-height:1.4;max-width:110px}
//         .up-tagline{font-size:13px;color:#999;line-height:1.5;margin-bottom:20px;font-weight:400}

//         .up-cta{display:block;width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none;text-align:center;margin-bottom:10px}
//         .up-cta.disabled{background:#f0f0f0;color:#bbb;cursor:default;border:1.5px solid #e8e8e8;margin-bottom:22px}
//         .up-cta.active-plan{background:#f0fdf4;color:var(--green);cursor:default;border:1.5px solid #86efac;font-weight:600;margin-bottom:22px}
//         .up-cta.already{background:#f5f5f5;color:#aaa;cursor:default;border:1.5px solid #e5e5e5;font-weight:500;margin-bottom:22px}
//         .up-cta.primary{background:#111;color:#fff}
//         .up-cta.primary:hover:not(:disabled){background:#333;transform:translateY(-1px)}
//         .up-cta.grad{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .up-cta.grad:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .up-cta:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}

//         .up-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#bbb;margin-bottom:18px}
//         .up-divider{height:1px;background:#f0f0f0;margin-bottom:20px}
//         .up-features{display:flex;flex-direction:column;gap:11px;list-style:none}
//         .up-feature{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#555;line-height:1.4;font-weight:400}
//         .up-check{width:18px;height:18px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
//         .up-card.featured .up-check{background:#ede9fe}
//         .up-card.active-card .up-check{background:#dcfce7}

//         /* ── LIMIT MODAL ── */
//         .up-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .up-modal{background:#fff;border-radius:24px;max-width:440px;width:100%;padding:36px 32px 32px;position:relative;animation:slideUp 0.25s ease;text-align:center}
//         @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .up-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#aaa;line-height:1;padding:4px}
//         .up-modal-close:hover{color:#555}
//         .up-modal-icon{font-size:52px;margin-bottom:16px;line-height:1}
//         .up-modal-title{font-size:22px;font-weight:600;color:#111;margin-bottom:8px;line-height:1.2}
//         .up-modal-sub{font-size:14px;color:#777;line-height:1.65;margin-bottom:26px;font-weight:400}
//         .up-modal-plans{display:flex;flex-direction:column;gap:10px;margin-bottom:20px}
//         .up-modal-plan-btn{padding:14px 20px;border-radius:14px;border:none;font-size:15px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between}
//         .up-modal-plan-btn.pro{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .up-modal-plan-btn.pro:hover{box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .up-modal-plan-btn.biz{background:#111;color:#fff}
//         .up-modal-plan-btn.biz:hover{background:#333;transform:translateY(-1px)}
//         .up-modal-plan-btn:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}
//         .up-modal-skip{font-size:13px;color:#bbb;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-decoration:underline}
//         .up-modal-skip:hover{color:#777}
//         .up-modal-secure{font-size:11px;color:#ccc;margin-top:10px}

//         /* SPINNER */
//         .up-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle}

//         /* TOAST */
//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:var(--green);color:#fff}
//         .up-toast.error{background:var(--red);color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         .up-footer{text-align:center;margin-top:44px;font-size:13px;color:#bbb;font-weight:400}
//         .up-footer a{color:var(--primary);text-decoration:none;font-weight:500}
//         .up-footer a:hover{text-decoration:underline}
//       `}</style>

//       {/* ── TOAST ── */}
//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* ── LIMIT REACHED MODAL ── */}
//       {showLimitModal && !isSubscribed && (
//         <div className="up-modal-overlay">
//           <div className="up-modal">
//             <button className="up-modal-close" onClick={() => setShowLimitModal(false)}>✕</button>
//             <div className="up-modal-icon">
//               {isBrand ? "🚫" : "🪙"}
//             </div>
//             <div className="up-modal-title">
//               {isBrand ? "Free Campaign Limit Reached!" : "Coins Khatam Ho Gaye!"}
//             </div>
//             <div className="up-modal-sub">
//               {isBrand
//                 ? `Aapne ${FREE_CAMPAIGN_MAX} campaigns post kar liye hain — free plan ki limit. Upgrade karo aur unlimited campaigns post karo.`
//                 : `Aapke coins khatam ho gaye! Apply karne ke liye ${COINS_PER_APPLY} coins chahiye. Pro plan lelo — unlimited coins milenge.`
//               }
//             </div>
//             <div className="up-modal-plans">
//               <button
//                 className="up-modal-plan-btn pro"
//                 onClick={() => { setShowLimitModal(false); handleSubscribe(billing === "yearly" ? "pro_yearly" : "pro_monthly", "Pro"); }}
//                 disabled={loadingPlan !== null}
//               >
//                 <span>
//                   {loadingPlan === "pro_monthly" || loadingPlan === "pro_yearly"
//                     ? <><span className="up-spinner" />Processing...</>
//                     : "⚡ Upgrade to Pro"}
//                 </span>
//                 <span style={{fontSize:13, opacity:0.85}}>₹{billing === "yearly" ? "799" : "999"}/mo</span>
//               </button>
//               <button
//                 className="up-modal-plan-btn biz"
//                 onClick={() => { setShowLimitModal(false); handleSubscribe(billing === "yearly" ? "business_yearly" : "business_monthly", "Business"); }}
//                 disabled={loadingPlan !== null}
//               >
//                 <span>
//                   {loadingPlan === "business_monthly" || loadingPlan === "business_yearly"
//                     ? <><span className="up-spinner" />Processing...</>
//                     : "🏢 Upgrade to Business"}
//                 </span>
//                 <span style={{fontSize:13, opacity:0.85}}>₹{billing === "yearly" ? "2,399" : "2,999"}/mo</span>
//               </button>
//             </div>
//             <button className="up-modal-skip" onClick={() => setShowLimitModal(false)}>Maybe later</button>
//             <div className="up-modal-secure">🔒 Secured by Razorpay</div>
//           </div>
//         </div>
//       )}

//       <div className="up-page">
//         <div className="up-header">
//           <h1 className="up-title">Upgrade your plan</h1>
//           <p className="up-subtitle">Choose the right plan for creators building their brand or businesses scaling campaigns.</p>
//         </div>

//         {/* ── CHECKING ── */}
//         {checking && (
//           <div className="up-checking">
//             <div className="up-mini-spin" />
//             Checking subscription status...
//           </div>
//         )}

//         {/* ── ACTIVE PLAN BANNER ── */}
//         {!checking && isSubscribed && (
//           <div className="up-active-banner">
//             <div className="up-active-banner-left">
//               <div className="up-active-banner-icon">🎉</div>
//               <div>
//                 <div className="up-active-banner-title">Aapka plan active hai!</div>
//                 <div className="up-active-banner-sub">
//                   {planExpiry
//                     ? `Valid until: ${new Date(planExpiry).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`
//                     : "Unlimited access to all features"}
//                 </div>
//               </div>
//             </div>
//             <span className="up-active-banner-badge">✓ Pro Active</span>
//           </div>
//         )}

//         {/* ── INLINE LIMIT BANNERS ── */}
//         {!checking && !isSubscribed && user && (
//           <>
//             {isBrand && campaignLimitHit && (
//               <div className="up-limit-banner err">
//                 <span className="up-limit-banner-icon">🚫</span>
//                 <div>
//                   <div className="up-limit-banner-title">Free campaign limit reach ho gayi!</div>
//                   <div className="up-limit-banner-sub">Aapne {FREE_CAMPAIGN_MAX} campaigns post kar liye. Aur post karne ke liye upgrade karo.</div>
//                 </div>
//               </div>
//             )}
//             {isBrand && campaignAlmostDone && (
//               <div className="up-limit-banner warn">
//                 <span className="up-limit-banner-icon">⚡</span>
//                 <div>
//                   <div className="up-limit-banner-title">Sirf {FREE_CAMPAIGN_MAX - campaignsCreated} free campaigns baaki!</div>
//                   <div className="up-limit-banner-sub">Limit khatam hone se pehle upgrade karo.</div>
//                 </div>
//               </div>
//             )}
//             {isInfluencer && coinsEmpty && (
//               <div className="up-limit-banner err">
//                 <span className="up-limit-banner-icon">🪙</span>
//                 <div>
//                   <div className="up-limit-banner-title">Coins khatam ho gaye!</div>
//                   <div className="up-limit-banner-sub">Pro upgrade karo — unlimited coins milenge aur kabhi apply karna band nahi hoga.</div>
//                 </div>
//               </div>
//             )}
//             {isInfluencer && coinsLow && (
//               <div className="up-limit-banner warn">
//                 <span className="up-limit-banner-icon">⚠️</span>
//                 <div>
//                   <div className="up-limit-banner-title">Sirf {coins} coins bache!</div>
//                   <div className="up-limit-banner-sub">Har apply mein {COINS_PER_APPLY} coins lagte hain. Upgrade karo aur unlimited pao.</div>
//                 </div>
//               </div>
//             )}
//           </>
//         )}

//         {/* ── USAGE CARDS ── */}
//         {!checking && user && (
//           <div className="up-usage">

//             {/* COINS */}
//             <div className={`up-uc ${isSubscribed ? "good" : coinsEmpty ? "err" : coinsLow ? "warn" : ""}`}>
//               <div className="up-uc-top">
//                 <div>
//                   <div className="up-uc-label">🪙 Coins</div>
//                   <div className="up-uc-hint">
//                     {isInfluencer ? `${COINS_PER_APPLY} coins / apply` : `${COINS_PER_CAMPAIGN} coins / campaign`}
//                   </div>
//                 </div>
//                 <div className={`up-uc-val ${isSubscribed ? "good-val" : coinsEmpty ? "err-val" : coinsLow ? "warn-val" : ""}`}>
//                   {isSubscribed ? "∞" : coins}
//                 </div>
//               </div>
//               {!isSubscribed && (
//                 <>
//                   <div className="up-prog">
//                     <div className="up-prog-fill" style={{
//                       width: `${coinsPercent}%`,
//                       background: coinsEmpty ? "#ef4444" : coinsLow ? "#f59e0b" : "#4f46e5",
//                     }} />
//                   </div>
//                   <div className={`up-uc-foot ${coinsEmpty ? "err-foot" : coinsLow ? "warn-foot" : ""}`}>
//                     {coinsEmpty ? "Coins khatam!" : `${coins} / ${FREE_COINS} remaining`}
//                   </div>
//                 </>
//               )}
//               {isSubscribed && <div className="up-uc-foot good-foot">Unlimited — Pro active</div>}
//             </div>

//             {/* INFLUENCER: APPLICATIONS */}
//             {isInfluencer && (
//               <div className={`up-uc ${isSubscribed ? "good" : coinsEmpty ? "err" : ""}`}>
//                 <div className="up-uc-top">
//                   <div>
//                     <div className="up-uc-label">📋 Applications</div>
//                     <div className="up-uc-hint">Campaigns applied to</div>
//                   </div>
//                   <div className="up-uc-val">{applicationsUsed}</div>
//                 </div>
//                 {!isSubscribed && (
//                   <>
//                     <div className="up-prog">
//                       <div className="up-prog-fill" style={{
//                         width: `${Math.min(100,(applicationsUsed/FREE_APPLY_MAX)*100)}%`,
//                         background: coinsEmpty ? "#ef4444" : applicationsUsed >= 7 ? "#f59e0b" : "#4f46e5",
//                       }} />
//                     </div>
//                     <div className="up-uc-foot">{applicationsUsed} used (Free: up to {FREE_APPLY_MAX})</div>
//                   </>
//                 )}
//                 {isSubscribed && <div className="up-uc-foot good-foot">Unlimited applications</div>}
//               </div>
//             )}

//             {/* BRAND: CAMPAIGNS */}
//             {isBrand && (
//               <div className={`up-uc ${isSubscribed ? "good" : campaignLimitHit ? "err" : campaignAlmostDone ? "warn" : ""}`}>
//                 <div className="up-uc-top">
//                   <div>
//                     <div className="up-uc-label">📢 Campaigns</div>
//                     <div className="up-uc-hint">Free limit: {FREE_CAMPAIGN_MAX}</div>
//                   </div>
//                   <div className={`up-uc-val ${campaignLimitHit && !isSubscribed ? "err-val" : ""}`}>
//                     {campaignsCreated}
//                   </div>
//                 </div>
//                 {!isSubscribed && (
//                   <>
//                     <div className="up-prog">
//                       <div className="up-prog-fill" style={{
//                         width: `${campaignPercent}%`,
//                         background: campaignLimitHit ? "#ef4444" : campaignAlmostDone ? "#f59e0b" : "#4f46e5",
//                       }} />
//                     </div>
//                     <div className={`up-uc-foot ${campaignLimitHit ? "err-foot" : campaignAlmostDone ? "warn-foot" : ""}`}>
//                       {campaignLimitHit ? "Limit reached!" : `${FREE_CAMPAIGN_MAX - campaignsCreated} remaining`}
//                     </div>
//                   </>
//                 )}
//                 {isSubscribed && <div className="up-uc-foot good-foot">Unlimited campaigns</div>}
//               </div>
//             )}

//             {/* SUBSCRIPTION STATUS */}
//             <div className={`up-uc ${isSubscribed ? "good" : ""}`}>
//               <div className="up-uc-top">
//                 <div>
//                   <div className="up-uc-label">{isSubscribed ? "✅" : "🔒"} Subscription</div>
//                   <div className="up-uc-hint">{isSubscribed ? "Active plan" : "Free plan"}</div>
//                 </div>
//                 <div className={`up-uc-val ${isSubscribed ? "good-val" : ""}`} style={{fontSize:15, marginTop:4}}>
//                   {isSubscribed ? "Pro" : "Free"}
//                 </div>
//               </div>
//               <div className={`up-uc-foot ${isSubscribed ? "good-foot" : ""}`}>
//                 {isSubscribed
//                   ? planExpiry
//                     ? `Expires: ${new Date(planExpiry).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}`
//                     : "All features unlocked 🎉"
//                   : "Upgrade for unlimited access"}
//               </div>
//             </div>

//           </div>
//         )}

//         {/* ── BILLING TOGGLE ── */}
//         <div className="up-toggle">
//           <button className={`up-toggle-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
//           <button className={`up-toggle-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
//         </div>

//         {/* ── PLAN CARDS ── */}
//         <div className="up-grid">
//           {currentPlans.map((plan) => {
//             const isLoading     = loadingPlan === plan.id;
//             const isFeatured    = plan.id.includes("business");
//             const isActivePlan  = isSubscribed && activePlan === plan.id;

//             return (
//               <div
//                 key={plan.id}
//                 className={`up-card ${isFeatured && !isActivePlan ? "featured" : ""} ${isActivePlan ? "active-card" : ""}`}
//                 style={{ background: plan.cardBg, border: `2px solid ${isActivePlan ? "#16a34a" : plan.cardBorder}` }}
//               >
//                 {isActivePlan
//                   ? <span className="up-active-badge">✓ Active Plan</span>
//                   : plan.badge
//                     ? <span className="up-badge" style={{background:plan.badgeColor}}>{plan.badge}</span>
//                     : <div className="up-placeholder-badge" />
//                 }

//                 <div className="up-plan-name">{plan.name}</div>
//                 <div className="up-price-row">
//                   <span className="up-price">{plan.price}</span>
//                   <span className="up-period">{plan.period}</span>
//                 </div>
//                 <div className="up-tagline">{plan.tagline}</div>

//                 {isActivePlan ? (
//                   <span className="up-cta active-plan">✓ Current Plan</span>
//                 ) : plan.ctaDisabled ? (
//                   <span className="up-cta disabled">{isSubscribed ? "Included in plan" : plan.cta}</span>
//                 ) : isSubscribed ? (
//                   <span className="up-cta already">Already Active</span>
//                 ) : (
//                   <>
//                     <button
//                       className={`up-cta ${isFeatured ? "grad" : "primary"}`}
//                       onClick={() => handleSubscribe(plan.id, plan.name)}
//                       disabled={loadingPlan !== null}
//                     >
//                       {isLoading && <span className="up-spinner" />}
//                       {isLoading ? "Processing..." : plan.cta}
//                     </button>
//                     <div className="up-secure">🔒 Secured by Razorpay</div>
//                   </>
//                 )}

//                 <div className="up-divider" />

//                 <ul className="up-features">
//                   {plan.features.map((f, i) => (
//                     <li key={i} className="up-feature">
//                       <span className="up-check">
//                         <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
//                           <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
//                         </svg>
//                       </span>
//                       {f}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             );
//           })}
//         </div>

//         <div className="up-footer">
//           7-day free trial on all paid plans. No credit card required.&nbsp;&nbsp;|&nbsp;&nbsp;
//           <Link href="/contact">Contact us</Link> for enterprise pricing.
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// export default function UpgradePage() {
//   const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
//   const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
//   const [user, setUser] = useState<any>(null);
//   const [activePlan, setActivePlan] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   // ✅ Bits & usage stats
//   const [bits, setBits] = useState<number>(100);
//   const [applicationsUsed, setApplicationsUsed] = useState<number>(0);
//   const [campaignsCreated, setCampaignsCreated] = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
//   const role = user?.role?.toLowerCase();
//   const isBrand = role === "brand";
//   const isInfluencer = role === "influencer";

//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     setUser(parsed);

//     const token = parsed.token || localStorage.getItem("token");
//     if (!token) return;

//     // ✅ Fetch latest user stats from backend
//     fetch(`${API}/profile/me`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then(r => r.json())
//       .then(data => {
//         if (data.success && data.profile) {
//           const p = data.profile;
//           setBits(p.bits ?? 100);
//           setApplicationsUsed(p.applicationsUsed ?? 0);
//           setCampaignsCreated(p.campaignsCreated ?? 0);
//           setIsSubscribed(p.isSubscribed ?? false);
//           if (p.isSubscribed) setActivePlan(parsed.activePlan || "pro_monthly");

//           // update localStorage
//           const updated = { ...parsed, isSubscribed: p.isSubscribed, bits: p.bits };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//         }
//       })
//       .catch(() => {});
//   }, []);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "CreatorBridge",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: {
//         name: user?.name || "",
//         email: user?.email || "",
//         contact: user?.phone || "",
//       },
//       handler: async function () {
//         await activateSubscription(planId, planName);
//       },
//       modal: {
//         ondismiss: () => {
//           showToast("Payment cancelled.", "error");
//           setLoadingPlan(null);
//         },
//       },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (response: any) => {
//       showToast(`Payment failed: ${response.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const activateSubscription = async (planId: string, planName: string) => {
//     const stored = localStorage.getItem("cb_user");
//     const parsed = JSON.parse(stored || "{}");
//     const token = parsed.token || localStorage.getItem("token");
//     try {
//       const res = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (data.success) {
//         const updatedUser = { ...parsed, isSubscribed: true, activePlan: planId, activePlanName: planName };
//         localStorage.setItem("cb_user", JSON.stringify(updatedUser));
//         setUser(updatedUser);
//         setActivePlan(planId);
//         setIsSubscribed(true);
//         showToast(`🎉 ${planName} plan activated!`, "success");
//       } else {
//         showToast(data.message || "Activation failed.", "error");
//       }
//     } catch {
//       showToast("Activation failed. Try again.", "error");
//     } finally {
//       setLoadingPlan(null);
//     }
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) { showToast("Please login first!", "error"); return; }
//     const token = user.token || localStorage.getItem("token");
//     if (!token) { showToast("Session expired.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription.", "error");
//         setLoadingPlan(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong. Try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   const plans = {
//     monthly: [
//       {
//         id: "free", name: "Free", price: "₹0", period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan", ctaDisabled: true,
//         badge: null, badgeColor: "", cardBg: "#f9f9f9", cardBorder: "#e5e5e5",
//         features: ["Apply to up to 3 campaigns/month", "Basic profile page", "Message brands (limited)", "Discovery feed access"],
//       },
//       {
//         id: "pro_monthly", name: "Pro", price: "₹999", period: "/ month (incl. GST)",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro", ctaDisabled: false,
//         badge: null, badgeColor: "", cardBg: "#fff", cardBorder: "#e5e5e5",
//         features: ["Unlimited campaign applications", "Priority listing in discovery", "Unlimited messaging", "Analytics dashboard", "Verified creator badge", "Early access to campaigns"],
//       },
//       {
//         id: "business_monthly", name: "Business", price: "₹2,999", period: "/ month (incl. GST)",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business", ctaDisabled: false,
//         badge: "RECOMMENDED", badgeColor: "#4f46e5", cardBg: "#fafafe", cardBorder: "#4f46e5",
//         features: ["Everything in Pro", "Post unlimited campaigns", "Advanced creator search & filters", "Team access (up to 5 seats)", "Dedicated account manager", "Campaign analytics & reports", "Custom contract templates"],
//       },
//     ],
//     yearly: [
//       {
//         id: "free", name: "Free", price: "₹0", period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan", ctaDisabled: true,
//         badge: null, badgeColor: "", cardBg: "#f9f9f9", cardBorder: "#e5e5e5",
//         features: ["Apply to up to 3 campaigns/month", "Basic profile page", "Message brands (limited)", "Discovery feed access"],
//       },
//       {
//         id: "pro_yearly", name: "Pro", price: "₹799", period: "/ month, billed yearly",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro", ctaDisabled: false,
//         badge: "SAVE 20%", badgeColor: "#16a34a", cardBg: "#fff", cardBorder: "#e5e5e5",
//         features: ["Unlimited campaign applications", "Priority listing in discovery", "Unlimited messaging", "Analytics dashboard", "Verified creator badge", "Early access to campaigns"],
//       },
//       {
//         id: "business_yearly", name: "Business", price: "₹2,399", period: "/ month, billed yearly",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business", ctaDisabled: false,
//         badge: "RECOMMENDED", badgeColor: "#4f46e5", cardBg: "#fafafe", cardBorder: "#4f46e5",
//         features: ["Everything in Pro", "Post unlimited campaigns", "Advanced creator search & filters", "Team access (up to 5 seats)", "Dedicated account manager", "Campaign analytics & reports", "Custom contract templates"],
//       },
//     ],
//   };

//   const currentPlans = plans[billing];

//   // ✅ Bits progress %
//   const bitsMax = 100;
//   const bitsPercent = Math.max(0, Math.min(100, (bits / bitsMax) * 100));
//   const bitsLow = bits <= 20;
//   const bitsEmpty = bits <= 0;

//   // ✅ Campaign limit for brand
//   const campaignMax = 5;
//   const campaignPercent = Math.min(100, (campaignsCreated / campaignMax) * 100);
//   const campaignLimitReached = campaignsCreated >= campaignMax && !isSubscribed;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}

//         .up-page{min-height:calc(100vh - 64px);background:#f7f7f5;font-family:'DM Sans',sans-serif;padding:40px 24px 80px}
//         .up-header{text-align:center;max-width:540px;margin:0 auto 32px}
//         .up-title{font-size:clamp(24px,4vw,36px);font-weight:500;color:#111;line-height:1.15;margin-bottom:10px}
//         .up-subtitle{font-size:15px;color:#777;line-height:1.6;font-weight:400}

//         /* ✅ USAGE STATS BOX */
//         .up-usage{max-width:960px;margin:0 auto 36px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:560px){.up-usage{grid-template-columns:1fr}}

//         .up-usage-card{background:#fff;border-radius:16px;padding:20px 22px;border:1.5px solid #ebebeb}
//         .up-usage-card.warning{border-color:#fbbf24;background:#fffbeb}
//         .up-usage-card.danger{border-color:#ef4444;background:#fff5f5}

//         .up-usage-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
//         .up-usage-label{font-size:13px;font-weight:500;color:#555;display:flex;align-items:center;gap:6px}
//         .up-usage-val{font-size:22px;font-weight:600;color:#111}
//         .up-usage-sub{font-size:11px;color:#aaa;margin-top:2px;font-weight:400}

//         .up-progress-bar{height:6px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-top:10px}
//         .up-progress-fill{height:100%;border-radius:100px;transition:width 0.5s ease}

//         .up-usage-alert{margin-top:12px;font-size:12px;font-weight:500;padding:8px 12px;border-radius:8px;display:flex;align-items:center;gap:6px}
//         .up-usage-alert.warn{background:#fef3c7;color:#92400e}
//         .up-usage-alert.err{background:#fee2e2;color:#991b1b}

//         /* TOGGLE */
//         .up-toggle{display:flex;align-items:center;justify-content:center;background:#e8e8e8;border-radius:100px;padding:4px;width:fit-content;margin:0 auto 44px}
//         .up-toggle-btn{padding:9px 24px;border-radius:100px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;color:#888;background:transparent}
//         .up-toggle-btn.active{background:#fff;color:#111;box-shadow:0 1px 6px rgba(0,0,0,0.1)}

//         /* GRID */
//         .up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:960px;margin:0 auto}
//         @media(max-width:860px){.up-grid{grid-template-columns:1fr 1fr}}
//         @media(max-width:560px){.up-grid{grid-template-columns:1fr;max-width:420px}}

//         .up-card{border-radius:20px;padding:28px 24px 30px;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;position:relative}
//         .up-card:hover{transform:translateY(-3px);box-shadow:0 14px 44px rgba(0,0,0,0.09)}
//         .up-card.featured{box-shadow:0 4px 28px rgba(79,70,229,0.14)}
//         .up-card.active-card{box-shadow:0 4px 28px rgba(22,163,74,0.15) !important}

//         .up-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;letter-spacing:0.07em;padding:4px 10px;border-radius:100px;color:#fff;margin-bottom:12px;width:fit-content}
//         .up-active-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#16a34a;background:#f0fdf4;border:1px solid #86efac;padding:4px 10px;border-radius:100px;margin-bottom:12px;width:fit-content}

//         .up-plan-name{font-size:24px;font-weight:500;color:#111;margin-bottom:4px}
//         .up-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
//         .up-price{font-size:34px;font-weight:600;color:#111;line-height:1}
//         .up-period{font-size:12px;color:#bbb;line-height:1.4;max-width:110px}
//         .up-tagline{font-size:13px;color:#999;line-height:1.5;margin-bottom:20px;font-weight:400}

//         .up-cta{display:block;width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none;text-align:center;margin-bottom:10px}
//         .up-cta.disabled{background:#f0f0f0;color:#bbb;cursor:default;border:1.5px solid #e8e8e8;margin-bottom:22px}
//         .up-cta.active-plan{background:#f0fdf4;color:#16a34a;cursor:default;border:1.5px solid #86efac;font-weight:600;margin-bottom:22px}
//         .up-cta.primary{background:#111;color:#fff}
//         .up-cta.primary:hover:not(:disabled){background:#333;transform:translateY(-1px)}
//         .up-cta.grad{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .up-cta.grad:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .up-cta:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}

//         .up-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#bbb;margin-bottom:18px}
//         .up-divider{height:1px;background:#f0f0f0;margin-bottom:20px}
//         .up-features{display:flex;flex-direction:column;gap:11px;list-style:none}
//         .up-feature{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#555;line-height:1.4;font-weight:400}
//         .up-check{width:18px;height:18px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
//         .up-card.featured .up-check{background:#ede9fe}
//         .up-card.active-card .up-check{background:#dcfce7}

//         .up-footer{text-align:center;margin-top:44px;font-size:13px;color:#bbb;font-weight:400}
//         .up-footer a{color:#4f46e5;text-decoration:none;font-weight:500}

//         .up-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle}
//         @keyframes spin{to{transform:rotate(360deg)}}

//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up-page">
//         <div className="up-header">
//           <h1 className="up-title">Upgrade your plan</h1>
//           <p className="up-subtitle">Choose the right plan for creators building their brand or businesses scaling campaigns.</p>
//         </div>

//         {/* ✅ USAGE STATS — show only when logged in */}
//         {user && (
//           <div className="up-usage">

//             {/* INFLUENCER — Bits */}
//             {isInfluencer && (
//               <div className={`up-usage-card ${bitsLow && !bitsEmpty ? "warning" : ""} ${bitsEmpty ? "danger" : ""}`}>
//                 <div className="up-usage-top">
//                   <div className="up-usage-label">
//                     🪙 Bits Remaining
//                     <span style={{fontSize:"11px",color:"#aaa",fontWeight:400}}>(1 apply = 10 bits)</span>
//                   </div>
//                   <div>
//                     <div className="up-usage-val" style={{color: bitsEmpty ? "#ef4444" : bitsLow ? "#d97706" : "#111"}}>
//                       {bits}
//                     </div>
//                     <div className="up-usage-sub">out of {bitsMax}</div>
//                   </div>
//                 </div>
//                 <div className="up-progress-bar">
//                   <div className="up-progress-fill" style={{
//                     width: `${bitsPercent}%`,
//                     background: bitsEmpty ? "#ef4444" : bitsLow ? "#f59e0b" : "#4f46e5"
//                   }} />
//                 </div>
//                 <div className="up-usage-sub" style={{marginTop:6}}>
//                   {applicationsUsed} applications used
//                 </div>
//                 {bitsEmpty && !isSubscribed && (
//                   <div className="up-usage-alert err">⚠️ Bits khatam! Subscribe karo to apply karo</div>
//                 )}
//                 {bitsLow && !bitsEmpty && !isSubscribed && (
//                   <div className="up-usage-alert warn">⚡ Sirf {bits} bits bache — jald upgrade karo</div>
//                 )}
//                 {isSubscribed && (
//                   <div className="up-usage-alert" style={{background:"#f0fdf4",color:"#16a34a"}}>✓ Pro — Unlimited applications</div>
//                 )}
//               </div>
//             )}

//             {/* BRAND — Campaign limit */}
//             {isBrand && (
//               <div className={`up-usage-card ${campaignLimitReached ? "danger" : campaignsCreated >= 3 && !isSubscribed ? "warning" : ""}`}>
//                 <div className="up-usage-top">
//                   <div className="up-usage-label">
//                     📢 Campaigns Created
//                     <span style={{fontSize:"11px",color:"#aaa",fontWeight:400}}>(free limit: 5)</span>
//                   </div>
//                   <div>
//                     <div className="up-usage-val" style={{color: campaignLimitReached ? "#ef4444" : "#111"}}>
//                       {campaignsCreated}
//                     </div>
//                     <div className="up-usage-sub">out of {isSubscribed ? "∞" : campaignMax}</div>
//                   </div>
//                 </div>
//                 <div className="up-progress-bar">
//                   <div className="up-progress-fill" style={{
//                     width: `${isSubscribed ? 0 : campaignPercent}%`,
//                     background: campaignLimitReached ? "#ef4444" : campaignsCreated >= 3 ? "#f59e0b" : "#4f46e5"
//                   }} />
//                 </div>
//                 {campaignLimitReached && (
//                   <div className="up-usage-alert err">🚫 Limit reach! Aur campaigns ke liye upgrade karo</div>
//                 )}
//                 {campaignsCreated >= 3 && !campaignLimitReached && !isSubscribed && (
//                   <div className="up-usage-alert warn">⚡ {campaignMax - campaignsCreated} campaigns baaki — upgrade consider karo</div>
//                 )}
//                 {isSubscribed && (
//                   <div className="up-usage-alert" style={{background:"#f0fdf4",color:"#16a34a"}}>✓ Pro — Unlimited campaigns</div>
//                 )}
//               </div>
//             )}

//             {/* Subscription Status */}
//             <div className="up-usage-card" style={isSubscribed ? {borderColor:"#86efac",background:"#f0fdf4"} : {}}>
//               <div className="up-usage-top">
//                 <div className="up-usage-label">
//                   {isSubscribed ? "✅" : "🔒"} Subscription Status
//                 </div>
//                 <div>
//                   <div className="up-usage-val" style={{fontSize:"16px",color: isSubscribed ? "#16a34a" : "#888"}}>
//                     {isSubscribed ? "Active" : "Free Plan"}
//                   </div>
//                 </div>
//               </div>
//               {isSubscribed ? (
//                 <div style={{fontSize:"13px",color:"#16a34a",fontWeight:500}}>
//                   Sab features unlock hain 🎉
//                 </div>
//               ) : (
//                 <div style={{fontSize:"13px",color:"#999",fontWeight:400,lineHeight:1.5}}>
//                   {isInfluencer
//                     ? "Upgrade karo — unlimited bits & applications pao"
//                     : "Upgrade karo — unlimited campaigns post karo"}
//                 </div>
//               )}
//             </div>

//           </div>
//         )}

//         <div className="up-toggle">
//           <button className={`up-toggle-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
//           <button className={`up-toggle-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
//         </div>

//         <div className="up-grid">
//           {currentPlans.map((plan) => {
//             const isLoading = loadingPlan === plan.id;
//             const isFeatured = plan.id.includes("business");
//             const isActivePlan = activePlan === plan.id;

//             return (
//               <div
//                 key={plan.id}
//                 className={`up-card ${isFeatured && !isActivePlan ? "featured" : ""} ${isActivePlan ? "active-card" : ""}`}
//                 style={{ background: plan.cardBg, border: `2px solid ${isActivePlan ? "#16a34a" : plan.cardBorder}` }}
//               >
//                 {isActivePlan ? (
//                   <span className="up-active-badge">✓ Active Plan</span>
//                 ) : plan.badge ? (
//                   <span className="up-badge" style={{ background: plan.badgeColor }}>{plan.badge}</span>
//                 ) : null}

//                 <div className="up-plan-name">{plan.name}</div>
//                 <div className="up-price-row">
//                   <span className="up-price">{plan.price}</span>
//                   <span className="up-period">{plan.period}</span>
//                 </div>
//                 <div className="up-tagline">{plan.tagline}</div>

//                 {isActivePlan ? (
//                   <span className="up-cta active-plan">✓ Current Plan</span>
//                 ) : plan.ctaDisabled ? (
//                   <span className="up-cta disabled">{plan.cta}</span>
//                 ) : (
//                   <>
//                     <button
//                       className={`up-cta ${isFeatured ? "grad" : "primary"}`}
//                       onClick={() => handleSubscribe(plan.id, plan.name)}
//                       disabled={loadingPlan !== null}
//                     >
//                       {isLoading && <span className="up-spinner" />}
//                       {isLoading ? "Processing..." : plan.cta}
//                     </button>
//                     <div className="up-secure">🔒 Secured by Razorpay</div>
//                   </>
//                 )}

//                 <div className="up-divider" />

//                 <ul className="up-features">
//                   {plan.features.map((f, i) => (
//                     <li key={i} className="up-feature">
//                       <span className="up-check">
//                         <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
//                           <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
//                         </svg>
//                       </span>
//                       {f}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             );
//           })}
//         </div>

//         <div className="up-footer">
//           7-day free trial on all paid plans. No credit card required.&nbsp;&nbsp;|&nbsp;&nbsp;
//           <Link href="/contact">Contact us</Link> for enterprise pricing.
//         </div>
//       </div>
//     </>
//   );
// }




// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// export default function UpgradePage() {
//   const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
//   const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
//   const [user, setUser] = useState<any>(null);
//   const [activePlan, setActivePlan] = useState<string | null>(null); // ✅ active plan state
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       const parsed = JSON.parse(stored);
//       setUser(parsed);
//       // ✅ Load saved active plan from localStorage
//       if (parsed.activePlan) setActivePlan(parsed.activePlan);
//     }
//   }, []);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // ✅ After payment success → mark plan as active
//   const markPlanActive = (planId: string, planName: string) => {
//     setActivePlan(planId);
//     const updatedUser = { ...user, activePlan: planId, activePlanName: planName };
//     localStorage.setItem("cb_user", JSON.stringify(updatedUser));
//     setUser(updatedUser);
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "CreatorBridge",
//       description: `${planName} Subscription`,
//       theme: { color: "#4f46e5" },
//       prefill: {
//         name: user?.name || "",
//         email: user?.email || "",
//         contact: user?.phone || "",
//       },
//       handler: function (response: any) {
//         // ✅ Payment done → mark plan active immediately
//         markPlanActive(planId, planName);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//         setLoadingPlan(null);
//       },
//       modal: {
//         ondismiss: () => {
//           showToast("Payment cancelled.", "error");
//           setLoadingPlan(null);
//         },
//       },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) {
//       showToast("Please login first!", "error");
//       return;
//     }
//     const token = user.token || localStorage.getItem("token");
//     if (!token) {
//       showToast("Session expired. Please login again.", "error");
//       return;
//     }

//     setLoadingPlan(planId);

//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });

//       const data = await res.json();

//       if (!data.success) {
//         showToast(data.message || "Failed to create subscription.", "error");
//         setLoadingPlan(null);
//         return;
//       }

//       openRazorpay(data.subscription.id, planId, planName);
//     } catch (err) {
//       console.error(err);
//       showToast("Something went wrong. Try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   const plans = {
//     monthly: [
//       {
//         id: "free",
//         name: "Free",
//         price: "₹0",
//         period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan",
//         ctaDisabled: true,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#f9f9f9",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Apply to up to 3 campaigns/month",
//           "Basic profile page",
//           "Message brands (limited)",
//           "Discovery feed access",
//         ],
//       },
//       {
//         id: "pro_monthly",
//         name: "Pro",
//         price: "₹999",
//         period: "/ month (incl. GST)",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro",
//         ctaDisabled: false,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#fff",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Unlimited campaign applications",
//           "Priority listing in discovery",
//           "Unlimited messaging",
//           "Analytics dashboard",
//           "Verified creator badge",
//           "Early access to campaigns",
//         ],
//       },
//       {
//         id: "business_monthly",
//         name: "Business",
//         price: "₹2,999",
//         period: "/ month (incl. GST)",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business",
//         ctaDisabled: false,
//         badge: "RECOMMENDED",
//         badgeColor: "#4f46e5",
//         cardBg: "#fafafe",
//         cardBorder: "#4f46e5",
//         features: [
//           "Everything in Pro",
//           "Post unlimited campaigns",
//           "Advanced creator search & filters",
//           "Team access (up to 5 seats)",
//           "Dedicated account manager",
//           "Campaign analytics & reports",
//           "Custom contract templates",
//         ],
//       },
//     ],
//     yearly: [
//       {
//         id: "free",
//         name: "Free",
//         price: "₹0",
//         period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan",
//         ctaDisabled: true,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#f9f9f9",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Apply to up to 3 campaigns/month",
//           "Basic profile page",
//           "Message brands (limited)",
//           "Discovery feed access",
//         ],
//       },
//       {
//         id: "pro_yearly",
//         name: "Pro",
//         price: "₹799",
//         period: "/ month, billed yearly",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro",
//         ctaDisabled: false,
//         badge: "SAVE 20%",
//         badgeColor: "#16a34a",
//         cardBg: "#fff",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Unlimited campaign applications",
//           "Priority listing in discovery",
//           "Unlimited messaging",
//           "Analytics dashboard",
//           "Verified creator badge",
//           "Early access to campaigns",
//         ],
//       },
//       {
//         id: "business_yearly",
//         name: "Business",
//         price: "₹2,399",
//         period: "/ month, billed yearly",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business",
//         ctaDisabled: false,
//         badge: "RECOMMENDED",
//         badgeColor: "#4f46e5",
//         cardBg: "#fafafe",
//         cardBorder: "#4f46e5",
//         features: [
//           "Everything in Pro",
//           "Post unlimited campaigns",
//           "Advanced creator search & filters",
//           "Team access (up to 5 seats)",
//           "Dedicated account manager",
//           "Campaign analytics & reports",
//           "Custom contract templates",
//         ],
//       },
//     ],
//   };

//   const currentPlans = plans[billing];

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}

//         .up-page{min-height:calc(100vh - 64px);background:#f7f7f5;font-family:'DM Sans',sans-serif;padding:52px 24px 80px}
//         .up-header{text-align:center;max-width:540px;margin:0 auto 36px}
//         .up-title{font-size:clamp(26px,4vw,38px);font-weight:500;color:#111;line-height:1.15;margin-bottom:12px}
//         .up-subtitle{font-size:15px;color:#777;line-height:1.6;font-weight:400}

//         .up-toggle{display:flex;align-items:center;justify-content:center;background:#e8e8e8;border-radius:100px;padding:4px;width:fit-content;margin:0 auto 44px}
//         .up-toggle-btn{padding:9px 24px;border-radius:100px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;color:#888;background:transparent}
//         .up-toggle-btn.active{background:#fff;color:#111;box-shadow:0 1px 6px rgba(0,0,0,0.1)}

//         .up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:960px;margin:0 auto}
//         @media(max-width:860px){.up-grid{grid-template-columns:1fr 1fr}}
//         @media(max-width:560px){.up-grid{grid-template-columns:1fr;max-width:420px}}

//         .up-card{border-radius:20px;padding:28px 24px 30px;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;position:relative}
//         .up-card:hover{transform:translateY(-3px);box-shadow:0 14px 44px rgba(0,0,0,0.09)}
//         .up-card.featured{box-shadow:0 4px 28px rgba(79,70,229,0.14)}

//         .up-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;letter-spacing:0.07em;padding:4px 10px;border-radius:100px;color:#fff;margin-bottom:12px;width:fit-content}
//         .up-plan-name{font-size:26px;font-weight:500;color:#111;margin-bottom:4px}
//         .up-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
//         .up-price{font-size:36px;font-weight:600;color:#111;line-height:1}
//         .up-period{font-size:12px;color:#bbb;line-height:1.4;max-width:110px}
//         .up-tagline{font-size:13px;color:#999;line-height:1.5;margin-bottom:20px;font-weight:400}

//         /* ✅ Active Plan Button */
//         .up-cta{display:block;width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none;text-align:center;margin-bottom:10px}
//         .up-cta.disabled{background:#f0f0f0;color:#bbb;cursor:default;border:1.5px solid #e8e8e8;margin-bottom:22px}
//         .up-cta.active-plan{background:#f0fdf4;color:#16a34a;cursor:default;border:1.5px solid #86efac;margin-bottom:22px;font-weight:600}
//         .up-cta.primary{background:#111;color:#fff}
//         .up-cta.primary:hover:not(:disabled){background:#333;transform:translateY(-1px)}
//         .up-cta.grad{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .up-cta.grad:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .up-cta:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}

//         /* ✅ Active plan card glow */
//         .up-card.active{border-color:#16a34a !important;box-shadow:0 4px 28px rgba(22,163,74,0.15) !important}
//         .up-active-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#16a34a;background:#f0fdf4;border:1px solid #86efac;padding:4px 10px;border-radius:100px;margin-bottom:12px;width:fit-content}

//         .up-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#bbb;margin-bottom:18px}
//         .up-divider{height:1px;background:#f0f0f0;margin-bottom:20px}
//         .up-features{display:flex;flex-direction:column;gap:11px;list-style:none}
//         .up-feature{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#555;line-height:1.4;font-weight:400}
//         .up-check{width:18px;height:18px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
//         .up-card.featured .up-check{background:#ede9fe}
//         .up-card.active .up-check{background:#dcfce7}

//         .up-footer{text-align:center;margin-top:44px;font-size:13px;color:#bbb;font-weight:400}
//         .up-footer a{color:#4f46e5;text-decoration:none;font-weight:500}

//         .up-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle}
//         @keyframes spin{to{transform:rotate(360deg)}}

//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up-page">
//         <div className="up-header">
//           <h1 className="up-title">Upgrade your plan</h1>
//           <p className="up-subtitle">Choose the right plan for creators building their brand or businesses scaling campaigns.</p>
//         </div>

//         <div className="up-toggle">
//           <button className={`up-toggle-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
//           <button className={`up-toggle-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
//         </div>

//         <div className="up-grid">
//           {currentPlans.map((plan) => {
//             const isLoading = loadingPlan === plan.id;
//             const isFeatured = plan.id.includes("business");
//             const isActivePlan = activePlan === plan.id; // ✅ check active

//             return (
//               <div
//                 key={plan.id}
//                 className={`up-card ${isFeatured && !isActivePlan ? "featured" : ""} ${isActivePlan ? "active" : ""}`}
//                 style={{ background: plan.cardBg, border: `2px solid ${isActivePlan ? "#16a34a" : plan.cardBorder}` }}
//               >
//                 {/* ✅ Show ACTIVE badge if plan is active */}
//                 {isActivePlan ? (
//                   <span className="up-active-badge">✓ Active Plan</span>
//                 ) : plan.badge ? (
//                   <span className="up-badge" style={{ background: plan.badgeColor }}>{plan.badge}</span>
//                 ) : null}

//                 <div className="up-plan-name">{plan.name}</div>
//                 <div className="up-price-row">
//                   <span className="up-price">{plan.price}</span>
//                   <span className="up-period">{plan.period}</span>
//                 </div>
//                 <div className="up-tagline">{plan.tagline}</div>

//                 {/* ✅ CTA Logic */}
//                 {isActivePlan ? (
//                   <span className="up-cta active-plan">✓ Current Plan</span>
//                 ) : plan.ctaDisabled ? (
//                   <span className="up-cta disabled">{plan.cta}</span>
//                 ) : (
//                   <>
//                     <button
//                       className={`up-cta ${isFeatured ? "grad" : "primary"}`}
//                       onClick={() => handleSubscribe(plan.id, plan.name)}
//                       disabled={loadingPlan !== null}
//                     >
//                       {isLoading && <span className="up-spinner" />}
//                       {isLoading ? "Processing..." : plan.cta}
//                     </button>
//                     <div className="up-secure">🔒 Secured by Razorpay</div>
//                   </>
//                 )}

//                 <div className="up-divider" />

//                 <ul className="up-features">
//                   {plan.features.map((f, i) => (
//                     <li key={i} className="up-feature">
//                       <span className="up-check">
//                         <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
//                           <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
//                         </svg>
//                       </span>
//                       {f}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             );
//           })}
//         </div>

//         <div className="up-footer">
//           7-day free trial on all paid plans. No credit card required.&nbsp;&nbsp;|&nbsp;&nbsp;
//           <Link href="/contact">Contact us</Link> for enterprise pricing.
//         </div>
//       </div>
//     </>
//   );
// }



// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";

// // ✅ Razorpay Plan ID
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// export default function UpgradePage() {
//   const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
//   const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
//   const [user, setUser] = useState<any>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) setUser(JSON.parse(stored));
//   }, []);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // STEP 2: Open Razorpay popup
//   const openRazorpay = (subscriptionId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "CreatorBridge",
//       description: `${planName} Subscription`,
//       theme: { color: "#4f46e5" },
//       prefill: {
//         name: user?.name || "",
//         email: user?.email || "",
//         contact: user?.phone || "",
//       },
//       handler: function (response: any) {
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//         const updatedUser = { ...user, plan: planName };
//         localStorage.setItem("cb_user", JSON.stringify(updatedUser));
//         setUser(updatedUser);
//         setLoadingPlan(null);
//         setTimeout(() => window.location.reload(), 1500);
//       },
//       modal: {
//         ondismiss: () => {
//           showToast("Payment cancelled.", "error");
//           setLoadingPlan(null);
//         },
//       },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.open();
//   };

//   // STEP 1: Create subscription → open Razorpay
//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) {
//       showToast("Please login first!", "error");
//       return;
//     }
//     const token = user.token || localStorage.getItem("token");
//     if (!token) {
//       showToast("Session expired. Please login again.", "error");
//       return;
//     }

//     setLoadingPlan(planId);

//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });

//       const data = await res.json();

//       if (!data.success) {
//         showToast(data.message || "Failed to create subscription.", "error");
//         setLoadingPlan(null);
//         return;
//       }

//       openRazorpay(data.subscription.id, planName);
//     } catch (err) {
//       console.error(err);
//       showToast("Something went wrong. Try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   const plans = {
//     monthly: [
//       {
//         id: "free",
//         name: "Free",
//         price: "₹0",
//         period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan",
//         ctaDisabled: true,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#f9f9f9",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Apply to up to 3 campaigns/month",
//           "Basic profile page",
//           "Message brands (limited)",
//           "Discovery feed access",
//         ],
//       },
//       {
//         id: "pro_monthly",
//         name: "Pro",
//         price: "₹999",
//         period: "/ month (incl. GST)",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro",
//         ctaDisabled: false,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#fff",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Unlimited campaign applications",
//           "Priority listing in discovery",
//           "Unlimited messaging",
//           "Analytics dashboard",
//           "Verified creator badge",
//           "Early access to campaigns",
//         ],
//       },
//       {
//         id: "business_monthly",
//         name: "Business",
//         price: "₹2,999",
//         period: "/ month (incl. GST)",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business",
//         ctaDisabled: false,
//         badge: "RECOMMENDED",
//         badgeColor: "#4f46e5",
//         cardBg: "#fafafe",
//         cardBorder: "#4f46e5",
//         features: [
//           "Everything in Pro",
//           "Post unlimited campaigns",
//           "Advanced creator search & filters",
//           "Team access (up to 5 seats)",
//           "Dedicated account manager",
//           "Campaign analytics & reports",
//           "Custom contract templates",
//         ],
//       },
//     ],
//     yearly: [
//       {
//         id: "free",
//         name: "Free",
//         price: "₹0",
//         period: "/ month",
//         tagline: "Get started with CreatorBridge",
//         cta: "Your current plan",
//         ctaDisabled: true,
//         badge: null,
//         badgeColor: "",
//         cardBg: "#f9f9f9",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Apply to up to 3 campaigns/month",
//           "Basic profile page",
//           "Message brands (limited)",
//           "Discovery feed access",
//         ],
//       },
//       {
//         id: "pro_yearly",
//         name: "Pro",
//         price: "₹799",
//         period: "/ month, billed yearly",
//         tagline: "For serious creators & growing brands",
//         cta: "Upgrade to Pro",
//         ctaDisabled: false,
//         badge: "SAVE 20%",
//         badgeColor: "#16a34a",
//         cardBg: "#fff",
//         cardBorder: "#e5e5e5",
//         features: [
//           "Unlimited campaign applications",
//           "Priority listing in discovery",
//           "Unlimited messaging",
//           "Analytics dashboard",
//           "Verified creator badge",
//           "Early access to campaigns",
//         ],
//       },
//       {
//         id: "business_yearly",
//         name: "Business",
//         price: "₹2,399",
//         period: "/ month, billed yearly",
//         tagline: "For brands running multiple campaigns",
//         cta: "Upgrade to Business",
//         ctaDisabled: false,
//         badge: "RECOMMENDED",
//         badgeColor: "#4f46e5",
//         cardBg: "#fafafe",
//         cardBorder: "#4f46e5",
//         features: [
//           "Everything in Pro",
//           "Post unlimited campaigns",
//           "Advanced creator search & filters",
//           "Team access (up to 5 seats)",
//           "Dedicated account manager",
//           "Campaign analytics & reports",
//           "Custom contract templates",
//         ],
//       },
//     ],
//   };

//   const currentPlans = plans[billing];

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}

//         .up-page{min-height:calc(100vh - 64px);background:#f7f7f5;font-family:'DM Sans',sans-serif;padding:52px 24px 80px}
//         .up-header{text-align:center;max-width:540px;margin:0 auto 36px}
//         .up-title{font-size:clamp(26px,4vw,38px);font-weight:500;color:#111;line-height:1.15;margin-bottom:12px}
//         .up-subtitle{font-size:15px;color:#777;line-height:1.6;font-weight:400}

//         .up-toggle{display:flex;align-items:center;justify-content:center;background:#e8e8e8;border-radius:100px;padding:4px;width:fit-content;margin:0 auto 44px}
//         .up-toggle-btn{padding:9px 24px;border-radius:100px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;color:#888;background:transparent}
//         .up-toggle-btn.active{background:#fff;color:#111;box-shadow:0 1px 6px rgba(0,0,0,0.1)}

//         .up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:960px;margin:0 auto}
//         @media(max-width:860px){.up-grid{grid-template-columns:1fr 1fr}}
//         @media(max-width:560px){.up-grid{grid-template-columns:1fr;max-width:420px}}

//         .up-card{border-radius:20px;padding:28px 24px 30px;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;position:relative}
//         .up-card:hover{transform:translateY(-3px);box-shadow:0 14px 44px rgba(0,0,0,0.09)}
//         .up-card.featured{box-shadow:0 4px 28px rgba(79,70,229,0.14)}

//         .up-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;letter-spacing:0.07em;padding:4px 10px;border-radius:100px;color:#fff;margin-bottom:12px;width:fit-content}
//         .up-plan-name{font-size:26px;font-weight:500;color:#111;margin-bottom:4px}
//         .up-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
//         .up-price{font-size:36px;font-weight:600;color:#111;line-height:1}
//         .up-period{font-size:12px;color:#bbb;line-height:1.4;max-width:110px}
//         .up-tagline{font-size:13px;color:#999;line-height:1.5;margin-bottom:20px;font-weight:400}

//         .up-cta{display:block;width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none;text-align:center;margin-bottom:10px}
//         .up-cta.disabled{background:#f0f0f0;color:#bbb;cursor:default;border:1.5px solid #e8e8e8;margin-bottom:22px}
//         .up-cta.primary{background:#111;color:#fff}
//         .up-cta.primary:hover:not(:disabled){background:#333;transform:translateY(-1px)}
//         .up-cta.grad{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .up-cta.grad:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .up-cta:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}

//         .up-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#bbb;margin-bottom:18px}
//         .up-divider{height:1px;background:#f0f0f0;margin-bottom:20px}
//         .up-features{display:flex;flex-direction:column;gap:11px;list-style:none}
//         .up-feature{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#555;line-height:1.4;font-weight:400}
//         .up-check{width:18px;height:18px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
//         .up-card.featured .up-check{background:#ede9fe}

//         .up-footer{text-align:center;margin-top:44px;font-size:13px;color:#bbb;font-weight:400}
//         .up-footer a{color:#4f46e5;text-decoration:none;font-weight:500}

//         .up-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle}
//         @keyframes spin{to{transform:rotate(360deg)}}

//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#111;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up-page">
//         <div className="up-header">
//           <h1 className="up-title">Upgrade your plan</h1>
//           <p className="up-subtitle">Choose the right plan for creators building their brand or businesses scaling campaigns.</p>
//         </div>

//         <div className="up-toggle">
//           <button className={`up-toggle-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
//           <button className={`up-toggle-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
//         </div>

//         <div className="up-grid">
//           {currentPlans.map((plan) => {
//             const isLoading = loadingPlan === plan.id;
//             const isFeatured = plan.id.includes("business");

//             return (
//               <div
//                 key={plan.id}
//                 className={`up-card ${isFeatured ? "featured" : ""}`}
//                 style={{ background: plan.cardBg, border: `2px solid ${plan.cardBorder}` }}
//               >
//                 {plan.badge && (
//                   <span className="up-badge" style={{ background: plan.badgeColor }}>{plan.badge}</span>
//                 )}

//                 <div className="up-plan-name">{plan.name}</div>
//                 <div className="up-price-row">
//                   <span className="up-price">{plan.price}</span>
//                   <span className="up-period">{plan.period}</span>
//                 </div>
//                 <div className="up-tagline">{plan.tagline}</div>

//                 {plan.ctaDisabled ? (
//                   <span className="up-cta disabled">{plan.cta}</span>
//                 ) : (
//                   <>
//                     <button
//                       className={`up-cta ${isFeatured ? "grad" : "primary"}`}
//                       onClick={() => handleSubscribe(plan.id, plan.name)}
//                       disabled={loadingPlan !== null}
//                     >
//                       {isLoading && <span className="up-spinner" />}
//                       {isLoading ? "Processing..." : plan.cta}
//                     </button>
//                     <div className="up-secure">🔒 Secured by Razorpay</div>
//                   </>
//                 )}

//                 <div className="up-divider" />

//                 <ul className="up-features">
//                   {plan.features.map((f, i) => (
//                     <li key={i} className="up-feature">
//                       <span className="up-check">
//                         <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
//                           <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
//                         </svg>
//                       </span>
//                       {f}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             );
//           })}
//         </div>

//         <div className="up-footer">
//           7-day free trial on all paid plans. No credit card required.&nbsp;&nbsp;|&nbsp;&nbsp;
//           <Link href="/contact">Contact us</Link> for enterprise pricing.
//         </div>
//       </div>
//     </>
//   );
// }