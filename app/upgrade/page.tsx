"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

type Role = "creator" | "brand";
type Tab = "plans" | "escrow" | "features";
type Billing = "monthly" | "yearly";

const brandMonthlyPlans = [
  { id: "free", name: "Free", price: 0, originalPrice: null, period: "/month", badge: null, tokens: 200, campaigns: 2, features: [{ text: "2 campaign posts", ok: true },{ text: "200 tokens/month", ok: true },{ text: "Basic influencer view", ok: true },{ text: "In-app chat", ok: true },{ text: "Direct contact unlock", ok: false },{ text: "Advanced filters", ok: false },{ text: "Influencer shortlist tool", ok: false },{ text: "AI recommended creators", ok: false },{ text: "Priority campaign visibility", ok: false },{ text: "Escrow payment protection", ok: false }], cta: "Current Plan", ctaDisabled: true },
  { id: "pro", name: "Pro", price: 599, originalPrice: 1000, period: "/month", badge: "Popular", tokens: 1000, campaigns: 10, features: [{ text: "10 campaign posts/month", ok: true },{ text: "1,000 tokens/month", ok: true },{ text: "Advanced filters", ok: true },{ text: "Direct chat unlock", ok: true },{ text: "Influencer shortlist tool", ok: true },{ text: "Campaign analytics", ok: true },{ text: "Escrow payment protection", ok: true },{ text: "Priority support", ok: false },{ text: "AI recommended creators", ok: false },{ text: "Unlimited campaigns", ok: false }], cta: "Upgrade to Pro", ctaDisabled: false },
  { id: "pro_plus", name: "Pro+", price: 1099, originalPrice: 2000, period: "/month", badge: "Best Value", tokens: 2500, campaigns: 25, features: [{ text: "25 campaigns/month", ok: true },{ text: "2,500 tokens/month", ok: true },{ text: "Influencer analytics", ok: true },{ text: "AI recommended creators", ok: true },{ text: "Priority campaign visibility", ok: true },{ text: "Featured campaign slot", ok: true },{ text: "Escrow + dispute protection", ok: true },{ text: "Dedicated account manager", ok: true },{ text: "Contract management", ok: true },{ text: "Early access to creators", ok: true }], cta: "Upgrade to Pro+", ctaDisabled: false },
];

const brandYearlyPlans = [
  { id: "free", name: "Free", price: 0, originalPrice: null, period: "/year", badge: null, tokens: 200, campaigns: 2, features: [{ text: "2 campaign posts", ok: true },{ text: "200 tokens/month", ok: true },{ text: "Basic influencer view", ok: true },{ text: "In-app chat", ok: true },{ text: "Direct contact unlock", ok: false },{ text: "Advanced filters", ok: false },{ text: "Influencer shortlist tool", ok: false },{ text: "AI recommended creators", ok: false },{ text: "Priority campaign visibility", ok: false },{ text: "Escrow payment protection", ok: false }], cta: "Current Plan", ctaDisabled: true },
  { id: "pro_year", name: "Pro", price: 6499, originalPrice: 10000, period: "/year", badge: "Popular", tokens: 12000, campaigns: 120, features: [{ text: "120 campaigns/year", ok: true },{ text: "12,000 tokens/year", ok: true },{ text: "Advanced filters", ok: true },{ text: "Direct chat unlock", ok: true },{ text: "Influencer shortlist tool", ok: true },{ text: "Campaign analytics", ok: true },{ text: "Escrow payment protection", ok: true },{ text: "Priority support", ok: false },{ text: "AI recommended creators", ok: false },{ text: "Unlimited campaigns", ok: false }], cta: "Upgrade to Pro", ctaDisabled: false },
  { id: "pro_plus_year", name: "Pro+", price: 11999, originalPrice: 20000, period: "/year", badge: "Best Value", tokens: 25000, campaigns: 250, features: [{ text: "250 campaigns/year", ok: true },{ text: "25,000 tokens/year", ok: true },{ text: "Influencer analytics", ok: true },{ text: "AI recommended creators", ok: true },{ text: "Priority campaign visibility", ok: true },{ text: "Featured campaign slot", ok: true },{ text: "Escrow + dispute protection", ok: true },{ text: "Dedicated account manager", ok: true },{ text: "Contract management", ok: true },{ text: "Early access to creators", ok: true }], cta: "Upgrade to Pro+", ctaDisabled: false },
];

const creatorMonthlyPlans = [
  { id: "free", name: "Free", price: 0, originalPrice: null, period: "/month", badge: null, tokens: 100, applies: 10, features: [{ text: "100 tokens/month", ok: true },{ text: "10 campaign applications/month", ok: true },{ text: "Create your profile", ok: true },{ text: "Basic search visibility", ok: true },{ text: "Basic analytics", ok: true },{ text: "Brand contact hidden", ok: false },{ text: "Verified badge", ok: false },{ text: "Profile boost", ok: false },{ text: "AI campaign matching", ok: false },{ text: "Priority listing", ok: false }], cta: "Current Plan", ctaDisabled: true },
  { id: "pro", name: "Pro", price: 299, originalPrice: null, period: "/month", badge: "Popular", tokens: 1000, applies: 100, features: [{ text: "1,000 tokens/month", ok: true },{ text: "100 applications/month", ok: true },{ text: "Profile boost in search", ok: true },{ text: "Advanced analytics", ok: true },{ text: "Campaign alerts", ok: true },{ text: "Verified badge", ok: true },{ text: "Direct brand invite option", ok: false },{ text: "Priority support", ok: false },{ text: "Featured profile listing", ok: false },{ text: "AI campaign matching", ok: false }], cta: "Upgrade to Pro", ctaDisabled: false },
  { id: "pro_plus", name: "Pro+", price: 499, originalPrice: null, period: "/month", badge: "Best Value", tokens: 2000, applies: 200, features: [{ text: "2,000 tokens/month", ok: true },{ text: "200 applications/month", ok: true },{ text: "Featured profile listing", ok: true },{ text: "Direct brand invite option", ok: true },{ text: "Priority support", ok: true },{ text: "AI campaign matching", ok: true },{ text: "Verified + Featured badge", ok: true },{ text: "Rewards & profile boost", ok: true },{ text: "Early access to campaigns", ok: true },{ text: "Dispute protection", ok: true }], cta: "Upgrade to Pro+", ctaDisabled: false },
];

const creatorYearlyPlans = [
  { id: "free", name: "Free", price: 0, originalPrice: null, period: "/year", badge: null, tokens: 100, applies: 10, features: [{ text: "100 tokens/month", ok: true },{ text: "10 campaign applications/month", ok: true },{ text: "Create your profile", ok: true },{ text: "Basic search visibility", ok: true },{ text: "Basic analytics", ok: true },{ text: "Brand contact hidden", ok: false },{ text: "Verified badge", ok: false },{ text: "Profile boost", ok: false },{ text: "AI campaign matching", ok: false },{ text: "Priority listing", ok: false }], cta: "Current Plan", ctaDisabled: true },
  { id: "pro_year", name: "Pro", price: 2999, originalPrice: null, period: "/year", badge: "Popular", tokens: "Unlimited", applies: "Unlimited", features: [{ text: "Unlimited tokens/year", ok: true },{ text: "Unlimited applications/year", ok: true },{ text: "Profile boost in search", ok: true },{ text: "Advanced analytics", ok: true },{ text: "Campaign alerts", ok: true },{ text: "Verified badge", ok: true },{ text: "Direct brand invite option", ok: false },{ text: "Priority support", ok: false },{ text: "Featured profile listing", ok: false },{ text: "AI campaign matching", ok: false }], cta: "Upgrade to Pro", ctaDisabled: false },
  { id: "pro_plus_year", name: "Pro+", price: 5999, originalPrice: null, period: "/year", badge: "Best Value", tokens: "Unlimited", applies: "Unlimited", features: [{ text: "Unlimited tokens/year", ok: true },{ text: "Unlimited applications/year", ok: true },{ text: "Featured profile listing", ok: true },{ text: "Direct brand invite option", ok: true },{ text: "Priority support", ok: true },{ text: "AI campaign matching", ok: true },{ text: "Verified + Featured badge", ok: true },{ text: "Rewards & profile boost", ok: true },{ text: "Early access to campaigns", ok: true },{ text: "Dispute protection", ok: true }], cta: "Upgrade to Pro+", ctaDisabled: false },
];

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
  const [billing, setBilling] = useState<Billing>("monthly");

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string>("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const stored = localStorage.getItem("cb_user");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setUser(parsed);
    const t = parsed.token || localStorage.getItem("token") || "";
    setToken(t);
    if (parsed.role?.toLowerCase() === "brand") setRole("brand");
    else setRole("creator");
    if (parsed.isSubscribed) setIsSubscribed(true);
    if (parsed.activePlan) {
      const nameToId: Record<string, string> = {
        "pro+": "pro_plus", "Pro+": "pro_plus", "proplus": "pro_plus",
        "Pro": "pro", "pro": "pro",
        "Pro+ Year": "pro_plus_year", "Pro Year": "pro_year",
      };
      const corrected = nameToId[parsed.activePlan] || parsed.activePlan;
      setActivePlan(corrected);
      if (corrected !== parsed.activePlan) {
        const fix = { ...parsed, activePlan: corrected };
        localStorage.setItem("cb_user", JSON.stringify(fix));
      }
    }
    if (t) fetchActivePlan(t, parsed);
  }, []);

  const fetchActivePlan = async (t: string, parsed: any) => {
    try {
      const res = await fetch(`${API}/subscription/status`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) return;
      const text = await res.text();
      if (text.startsWith("<!")) return;
      const data = JSON.parse(text);
      const sub = data.data || data.subscription || data;
      const active = sub.isSubscribed === true || sub.status === "active" || sub.subscriptionStatus === "active" || sub.isPremium === true;
      const planId = sub.activePlan || sub.planId || sub.plan_id || sub.planName || parsed.activePlan || null;
      if (active && planId) {
        setIsSubscribed(true);
        setActivePlan(planId);
        const updated = { ...parsed, isSubscribed: true, activePlan: planId, planActivatedAt: new Date().toISOString() };
        localStorage.setItem("cb_user", JSON.stringify(updated));
      }
    } catch { /* silent */ }
  };

  const handleSubscribe = async (planId: string, planName: string) => {
    if (!user) { showToast("Please login first.", "error"); return; }
    if (!token) { showToast("Session expired. Please login again.", "error"); return; }
    setLoadingPlanId(planId);
    try {
      const res = await fetch(`${API}/subscription/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: PLAN_ID }),
      });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) {
        showToast(data.message || "Failed to create subscription. Try again.", "error");
        setLoadingPlanId(null);
        return;
      }
      openRazorpay(data.subscription.id, planId, planName);
    } catch {
      showToast("Something went wrong. Please try again.", "error");
      setLoadingPlanId(null);
    }
  };

  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const options = {
      key: RAZORPAY_KEY,
      subscription_id: subscriptionId,
      name: "Influex Premium",
      description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
      handler: async (response: any) => { await verifyAndActivate(response, planId, planName); },
      modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlanId(null); } },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", (resp: any) => {
      showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
      setLoadingPlanId(null);
    });
    rzp.open();
  };

  const verifyAndActivate = async (response: any, planId: string, planName: string) => {
    try {
      const verifyRes = await fetch(`${API}/subscription/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...response, plan_id: PLAN_ID, planId, planName }),
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) await activateSubscription(planId, planName);
      else await activateSubscription(planId, planName);
    } catch {
      await activateSubscription(planId, planName);
    }
  };

  const activateSubscription = async (planId: string, planName: string) => {
    try {
      const res = await fetch(`${API}/subscription/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
      });
      const data = await res.json();
      if (data.success) {
        const storedPlanId = planId;
        const stored = localStorage.getItem("cb_user");
        const parsed = stored ? JSON.parse(stored) : {};
        const updated = { ...parsed, isSubscribed: true, activePlan: storedPlanId, activePlanName: planName, planActivatedAt: new Date().toISOString() };
        localStorage.setItem("cb_user", JSON.stringify(updated));
        setUser(updated);
        setIsSubscribed(true);
        setActivePlan(storedPlanId);

        // ✅ Signal navbar to update bits live
        const allPlans = [...brandMonthlyPlans, ...brandYearlyPlans, ...creatorMonthlyPlans, ...creatorYearlyPlans];
        const matchedPlan = allPlans.find(p => p.id === storedPlanId);
        const planBits = matchedPlan?.tokens;
        const bitsNum = typeof planBits === "number" ? planBits : 0;
        if (bitsNum > 0) {
          window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(bitsNum) }));
        }
        window.dispatchEvent(new StorageEvent("storage", { key: "cb_plan_updated", newValue: storedPlanId }));

        showToast(`🎉 ${planName} plan activated successfully!`, "success");
      } else {
        showToast(data.message || "Activation failed. Contact support.", "error");
      }
    } catch {
      showToast("Activation failed. Please contact support.", "error");
    } finally {
      setLoadingPlanId(null);
    }
  };

  const getPlans = () => {
    if (role === "brand") return billing === "monthly" ? brandMonthlyPlans : brandYearlyPlans;
    return billing === "monthly" ? creatorMonthlyPlans : creatorYearlyPlans;
  };

  const plans = getPlans();
  const fmtPrice = (p: number) => p === 0 ? "₹0" : `₹${p.toLocaleString("en-IN")}`;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}
        .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
        .up-toast.success{background:#16a34a;color:#fff}
        .up-toast.error{background:#ef4444;color:#fff}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .up-active-banner{max-width:1000px;margin:0 auto;padding:20px 40px 0}
        @media(max-width:600px){.up-active-banner{padding:16px 16px 0}}
        .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .up-active-title{font-size:15px;font-weight:700;color:#34d399}
        .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
        .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}
        .up-hero{position:relative;padding:52px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
        @media(max-width:600px){.up-hero{padding:36px 16px 0}}
        .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px}
        .up-hero-title{font-size:clamp(24px,4.5vw,46px);font-weight:900;line-height:1.1;margin-bottom:14px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .up-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto 28px;line-height:1.6}
        .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
        @media(max-width:600px){.up-tabs{padding:0 16px}}
        .up-tabs::-webkit-scrollbar{display:none}
        .up-tab{padding:13px 20px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
        .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
        .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}
        .up-content{padding:36px 40px 80px}
        @media(max-width:600px){.up-content{padding:20px 16px 60px}}
        .billing-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:36px}
        .billing-toggle{display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:3px}
        .billing-btn{padding:8px 22px;border-radius:100px;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
        .billing-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
        .billing-save{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:0.04em}
        .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1000px;margin:0 auto}
        .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
        .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
        .plan-card.active-plan{border-color:rgba(16,185,129,0.5)!important;background:rgba(16,185,129,0.06)!important}
        .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
        .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
        .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
        .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}
        .plan-name{font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px}
        .plan-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap}
        .plan-original{font-size:18px;font-weight:700;color:rgba(255,255,255,0.25);text-decoration:line-through}
        .plan-price{font-size:36px;font-weight:900;color:#fff}
        .plan-price span{font-size:15px;font-weight:500;color:rgba(255,255,255,0.4)}
        .plan-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
        .plan-pill{display:inline-flex;align-items:center;gap:5px;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700}
        .plan-pill.token{background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);color:#fbbf24}
        .plan-pill.camp{background:rgba(79,70,229,0.12);border:1px solid rgba(79,70,229,0.25);color:#a5b4fc}
        .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 16px}
        .plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
        .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
        .plan-feature-icon{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;margin-top:2px}
        .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
        .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}
        .plan-cta{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
        .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
        .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
        .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
        .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
        .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
        .plan-cta.active-cta{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
        .plan-cta:disabled{opacity:0.7;cursor:not-allowed;transform:none!important}
        .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
        @keyframes spinning{to{transform:rotate(360deg)}}
        .up-secure{font-size:11px;color:rgba(255,255,255,0.22);text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px}
        .escrow-hero{text-align:center;margin-bottom:36px}
        .escrow-hero-title{font-size:26px;font-weight:900;color:#fff;margin-bottom:8px}
        .escrow-hero-sub{font-size:14px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
        .escrow-steps{display:flex;flex-direction:column;gap:14px;max-width:640px;margin:0 auto 40px}
        .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
        .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
        .escrow-step-num{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .escrow-step-title{font-size:14px;font-weight:800;color:#fff;margin-bottom:3px}
        .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
        .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:26px}
        .escrow-breakdown-title{font-size:15px;font-weight:800;color:#a5b4fc;margin-bottom:18px;text-align:center}
        .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
        .escrow-row:last-child{border-bottom:none}
        .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
        .escrow-row-val{font-size:15px;font-weight:800}
        .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:18px;width:100%;justify-content:center}
        .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-width:1000px;margin:0 auto}
        .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:22px;transition:all 0.25s}
        .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
        .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .feat-icon{font-size:26px}
        .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
        .feat-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:7px}
        .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}
        .section-title{font-size:21px;font-weight:900;color:#fff;text-align:center;margin-bottom:5px}
        .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:28px}
        .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:56px 40px;text-align:center}
        .up-bottom-title{font-size:clamp(20px,4vw,36px);font-weight:900;color:#fff;margin-bottom:10px}
        .up-bottom-sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:26px}
        .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
        .up-bottom-btn{padding:13px 30px;border-radius:14px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
        .up-bottom-btn.primary:hover{transform:translateY(-2px)}
        .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
        .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}
      `}</style>

      {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="up">
        {isSubscribed && (() => {
          const allPlans = [...brandMonthlyPlans, ...brandYearlyPlans, ...creatorMonthlyPlans, ...creatorYearlyPlans];
          const toC = (s: string) => { if (!s) return ""; const v = s.toLowerCase().trim(); if (v==="pro+"||v==="pro_plus"||v==="proplus") return "pro_plus"; if (v==="pro+year"||v==="pro_plus_year"||v==="proplusyear") return "pro_plus_year"; if (v==="proyear"||v==="pro_year") return "pro_year"; if (v==="pro") return "pro"; return v; };
          const matched = allPlans.find(p => p.id !== "free" && toC(p.id) === toC(activePlan || ""));
          const displayName = matched?.name || activePlan?.replace(/_year$/, "").replace("_", " ") || "Pro";
          return (
            <div className="up-active-banner">
              <div className="up-active-inner">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 26 }}>🎉</span>
                  <div>
                    <div className="up-active-title">Your plan is active!</div>
                    <div className="up-active-sub">You have full access to all premium features.</div>
                  </div>
                </div>
                <span className="up-active-badge">✓ {displayName} Active</span>
              </div>
            </div>
          );
        })()}

        <div className="up-hero">
          <div className="up-hero-label">✦ CreatorBridge Platform</div>
          <h1 className="up-hero-title">Close deals on platform,<br />security is guaranteed</h1>
          <p className="up-hero-sub">Escrow payments, verified creators, smart contracts — all in one platform.</p>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(79,70,229,0.15)",border:"1px solid rgba(79,70,229,0.3)",borderRadius:100,padding:"8px 20px",fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:8}}>
            {role === "brand" ? "🏢 Brand Plans" : "🎨 Creator Plans"}
          </div>
        </div>

        <div className="up-tabs">
          {(["plans", "escrow", "features"] as Tab[]).map((t) => (
            <button key={t} className={`up-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "plans" && "💎 Plans"}{t === "escrow" && "🔐 Escrow"}{t === "features" && "⚡ Features"}
            </button>
          ))}
        </div>

        <div className="up-content">
          {tab === "plans" && (
            <>
              <div className="section-title">{role === "creator" ? "Creator" : "Brand"} Plans</div>
              <div className="section-sub">{role === "creator" ? "Start free, upgrade when you're ready to grow your creator career" : "The right tools to find the best creators and run successful campaigns"}</div>
              <div className="billing-wrap">
                <div className="billing-toggle">
                  <button className={`billing-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
                  <button className={`billing-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
                </div>
                {billing === "yearly" && <span className="billing-save">🎉 Save up to 45%</span>}
              </div>
              <div className="plans-grid">
                {plans.map((plan: any, i: number) => {
                  const toC = (s: string) => { if (!s) return ""; const v = s.toLowerCase().trim(); if (v==="pro+"||v==="pro_plus"||v==="proplus") return "pro_plus"; if (v==="pro+year"||v==="pro_plus_year"||v==="proplusyear") return "pro_plus_year"; if (v==="proyear"||v==="pro_year") return "pro_year"; if (v==="pro") return "pro"; return v; };
                  const isThisActive = isSubscribed && plan.id !== "free" && !!activePlan && toC(activePlan) === toC(plan.id);
                  const isLoading = loadingPlanId === plan.id;
                  return (
                    <div key={plan.id} className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}>
                      {isThisActive ? <div className="plan-active-badge">✓ Your Current Plan</div> : plan.badge ? <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div> : null}
                      <div style={{ marginTop: (plan.badge || isThisActive) ? 20 : 0 }}>
                        <div className="plan-name">{plan.name}</div>
                        <div className="plan-price-row">
                          {plan.originalPrice && <span className="plan-original">{fmtPrice(plan.originalPrice)}</span>}
                          <span className="plan-price">{fmtPrice(plan.price)}<span>{plan.period}</span></span>
                        </div>
                        <div className="plan-pills">
                          <span className="plan-pill token">🪙 {typeof plan.tokens === "number" ? plan.tokens.toLocaleString("en-IN") : plan.tokens} tokens</span>
                          {role === "brand" && <span className="plan-pill camp">📢 {plan.campaigns} campaigns</span>}
                          {role === "creator" && <span className="plan-pill camp">📩 {typeof plan.applies === "number" ? plan.applies.toLocaleString("en-IN") : plan.applies} applies</span>}
                        </div>
                        <hr className="plan-divider" />
                        <ul className="plan-features">
                          {plan.features.map((f: any, fi: number) => (
                            <li key={fi} className="plan-feature">
                              <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>{f.ok ? "✓" : "✕"}</span>
                              {f.text}
                            </li>
                          ))}
                        </ul>
                        {isThisActive ? (
                          <button className="plan-cta active-cta" disabled>✓ Active Plan</button>
                        ) : plan.ctaDisabled ? (
                          <button className="plan-cta secondary" disabled>{plan.cta}</button>
                        ) : (
                          <>
                            <button className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`} disabled={loadingPlanId !== null} onClick={() => handleSubscribe(plan.id, plan.name)}>
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

          {tab === "escrow" && (
            <>
              <div className="escrow-hero">
                <div className="escrow-hero-title">🔐 Escrow Payment System</div>
                <div className="escrow-hero-sub">Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.</div>
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
                <div className="escrow-row"><span className="escrow-row-label">Brand deposits</span><span className="escrow-row-val" style={{color:"#f87171"}}>₹10,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Platform commission (10%)</span><span className="escrow-row-val" style={{color:"#fbbf24"}}>₹1,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Creator receives</span><span className="escrow-row-val" style={{color:"#34d399"}}>₹9,000</span></div>
                <div className="escrow-row"><span className="escrow-row-label">Dispute protection</span><span className="escrow-row-val" style={{color:"#a5b4fc"}}>✅ Included</span></div>
                <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
              </div>
            </>
          )}

          {tab === "features" && (
            <>
              <div className="section-title">Platform Features</div>
              <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
              <div className="features-grid">
                {platformFeatures.map((f, i) => (
                  <div key={i} className="feat-card">
                    <div className="feat-top"><span className="feat-icon">{f.icon}</span><span className="feat-tag" style={{color:f.tagColor}}>{f.tag}</span></div>
                    <div className="feat-title">{f.title}</div>
                    <div className="feat-desc">{f.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

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
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// type Role = "creator" | "brand";
// type Tab = "plans" | "escrow" | "features";
// type Billing = "monthly" | "yearly";

// // ─── BRAND PLANS ───────────────────────────────────────────────
// const brandMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 599,
//     originalPrice: 1000,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     campaigns: 10,
//     features: [
//       { text: "10 campaign posts/month", ok: true },
//       { text: "1,000 tokens/month", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 1099,
//     originalPrice: 2000,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2500,
//     campaigns: 25,
//     features: [
//       { text: "25 campaigns/month", ok: true },
//       { text: "2,500 tokens/month", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const brandYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 6499,
//     originalPrice: 10000,
//     period: "/year",
//     badge: "Popular",
//     tokens: 12000,
//     campaigns: 120,
//     features: [
//       { text: "120 campaigns/year", ok: true },
//       { text: "12,000 tokens/year", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 11999,
//     originalPrice: 20000,
//     period: "/year",
//     badge: "Best Value",
//     tokens: 25000,
//     campaigns: 250,
//     features: [
//       { text: "250 campaigns/year", ok: true },
//       { text: "25,000 tokens/year", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── CREATOR PLANS ─────────────────────────────────────────────
// const creatorMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 100,
//     applies: 10,
//     features: [
//       { text: "100 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 299,
//     originalPrice: null,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     applies: 100,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "100 applications/month", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 499,
//     originalPrice: null,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2000,
//     applies: 200,
//     features: [
//       { text: "2,000 tokens/month", ok: true },
//       { text: "200 applications/month", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const creatorYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 100,
//     applies: 10,
//     features: [
//       { text: "100 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 2999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Popular",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 5999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Best Value",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── ESCROW & FEATURES (same for both roles) ───────────────────
// const escrowSteps = [
//   { step: "1", icon: "📋", title: "Create Campaign", desc: "Brand posts a campaign and sets the budget. Example: ₹10,000" },
//   { step: "2", icon: "💰", title: "Escrow Deposit", desc: "Brand deposits ₹10,000 on the platform. The money is securely locked until work is approved." },
//   { step: "3", icon: "🤝", title: "Creator Accepts", desc: "Creator accepts the campaign and starts working on the deliverables." },
//   { step: "4", icon: "📸", title: "Submit Work", desc: "Creator submits proof of work: reel link, post link, story screenshot." },
//   { step: "5", icon: "✅", title: "Brand Approves", desc: "Brand reviews the submitted work and clicks approve." },
//   { step: "6", icon: "🎉", title: "Payment Released", desc: "Platform releases payment instantly. Creator: ₹9,000 | Platform commission: ₹1,000 (10%)" },
// ];

// const platformFeatures = [
//   { icon: "🔒", title: "Contact Info Hidden", desc: "Until a deal is confirmed, creator's phone, email, WhatsApp, and Instagram are hidden. Communication stays inside the app only.", tag: "Privacy", tagColor: "#4f46e5" },
//   { icon: "🚨", title: "Keyword Detection", desc: 'If anyone types "WhatsApp", "phone number", "DM me", or similar in chat, the platform shows an instant warning. All communication stays on-platform.', tag: "Safety", tagColor: "#ef4444" },
//   { icon: "📄", title: "Campaign Contracts", desc: "Both brand and creator sign an agreement — deliverables, timeline, and payment terms are all legally documented before work begins.", tag: "Legal", tagColor: "#16a34a" },
//   { icon: "📦", title: "Deliverables Tracking", desc: "A campaign is not marked complete until the creator uploads proof (reel/post/story) and the brand approves the submission.", tag: "Tracking", tagColor: "#d97706" },
//   { icon: "🏆", title: "Reward System", desc: "Complete deals on-platform and earn extra tokens, profile boost, and better search ranking. Staying on-platform always pays more.", tag: "Rewards", tagColor: "#7c3aed" },
//   { icon: "🤖", title: "AI Smart Matching", desc: "Our AI suggests the best creators for each campaign based on niche, follower count, location, and past performance.", tag: "AI", tagColor: "#0891b2" },
// ];

// export default function UpgradePage() {
//   const router = useRouter();
//   const [role, setRole] = useState<Role>("creator");
//   const [tab, setTab] = useState<Tab>("plans");
//   const [billing, setBilling] = useState<Billing>("monthly");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState<string>("");
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan] = useState<string | null>(null);

//   const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // ── Load user + detect role ──
//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     setToken(t);

//     // Auto set role from login
//     if (parsed.role?.toLowerCase() === "brand") setRole("brand");
//     else setRole("creator");

//     // Restore active plan from localStorage first (instant)
//     if (parsed.isSubscribed) setIsSubscribed(true);
//     if (parsed.activePlan) {
//       // If stored as planName like "Pro+" normalize to planId
//       const nameToId: Record<string, string> = {
//         "pro+": "pro_plus", "Pro+": "pro_plus", "proplus": "pro_plus",
//         "Pro": "pro", "pro": "pro",
//         "Pro+ Year": "pro_plus_year", "Pro Year": "pro_year",
//       };
//       const corrected = nameToId[parsed.activePlan] || parsed.activePlan;
//       setActivePlan(corrected);
//       if (corrected !== parsed.activePlan) {
//         const fix = { ...parsed, activePlan: corrected };
//         localStorage.setItem("cb_user", JSON.stringify(fix));
//       }
//     }

//     // Then verify from backend (source of truth)
//     if (t) fetchActivePlan(t, parsed);
//   }, []);

//   const fetchActivePlan = async (t: string, parsed: any) => {
//     try {
//       const res = await fetch(`${API}/subscription/status`, {
//         headers: { Authorization: `Bearer ${t}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       // Backend may return { isSubscribed, activePlan, planId, planName, status }
//       const sub = data.data || data.subscription || data;
//       const active =
//         sub.isSubscribed === true ||
//         sub.status === "active" ||
//         sub.subscriptionStatus === "active" ||
//         sub.isPremium === true;
//       const planId =
//         sub.activePlan || sub.planId || sub.plan_id || sub.planName || parsed.activePlan || null;

//       if (active && planId) {
//         setIsSubscribed(true);
//         setActivePlan(planId);
//         // Sync to localStorage
//         const updated = { ...parsed, isSubscribed: true, activePlan: planId, planActivatedAt: new Date().toISOString() };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//       }
//     } catch {
//       // silently fail — localStorage already loaded above
//     }
//   };

//   // ── Subscribe flow ──
//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) { showToast("Please login first.", "error"); return; }
//     if (!token) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlanId(planId);
//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription. Try again.", "error");
//         setLoadingPlanId(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlanId(null);
//     }
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
//       handler: async (response: any) => { await verifyAndActivate(response, planId, planName); },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlanId(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (resp: any) => {
//       showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
//       setLoadingPlanId(null);
//     });
//     rzp.open();
//   };

//   const verifyAndActivate = async (response: any, planId: string, planName: string) => {
//     try {
//       const verifyRes = await fetch(`${API}/subscription/verify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ ...response, plan_id: PLAN_ID, planId, planName }),
//       });
//       const verifyData = await verifyRes.json();
//       if (verifyData.success) await activateSubscription(planId, planName);
//       else await activateSubscription(planId, planName);
//     } catch {
//       await activateSubscription(planId, planName);
//     }
//   };

//   const activateSubscription = async (planId: string, planName: string) => {
//     try {
//       const res = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//       });
//       const data = await res.json();
//       if (data.success) {
//         const storedPlanId = planId; // use the exact id we passed (e.g. "pro_plus")
//         const stored = localStorage.getItem("cb_user");
//         const parsed = stored ? JSON.parse(stored) : {};
//         const updated = { ...parsed, isSubscribed: true, activePlan: storedPlanId, activePlanName: planName, planActivatedAt: new Date().toISOString() };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//         setIsSubscribed(true);
//         setActivePlan(storedPlanId);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//       } else {
//         showToast(data.message || "Activation failed. Contact support.", "error");
//       }
//     } catch {
//       showToast("Activation failed. Please contact support.", "error");
//     } finally {
//       setLoadingPlanId(null);
//     }
//   };

//   // ── Get correct plans based on role + billing ──
//   const getPlans = () => {
//     if (role === "brand") return billing === "monthly" ? brandMonthlyPlans : brandYearlyPlans;
//     return billing === "monthly" ? creatorMonthlyPlans : creatorYearlyPlans;
//   };

//   const plans = getPlans();

//   const fmtPrice = (p: number) => p === 0 ? "₹0" : `₹${p.toLocaleString("en-IN")}`;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

//         .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}

//         /* TOAST */
//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         /* ACTIVE PLAN BANNER */
//         .up-active-banner{max-width:1000px;margin:0 auto;padding:20px 40px 0}
//         @media(max-width:600px){.up-active-banner{padding:16px 16px 0}}
//         .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .up-active-title{font-size:15px;font-weight:700;color:#34d399}
//         .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
//         .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}

//         /* HERO */
//         .up-hero{position:relative;padding:52px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
//         @media(max-width:600px){.up-hero{padding:36px 16px 0}}
//         .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px}
//         .up-hero-title{font-size:clamp(24px,4.5vw,46px);font-weight:900;line-height:1.1;margin-bottom:14px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
//         .up-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto 28px;line-height:1.6}

//         /* ROLE TOGGLE */
//         .up-role{display:inline-flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:4px;margin-bottom:32px;gap:4px}
//         .up-role-btn{padding:10px 26px;border-radius:10px;border:none;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .up-role-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}

//         /* TABS */
//         .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
//         @media(max-width:600px){.up-tabs{padding:0 16px}}
//         .up-tabs::-webkit-scrollbar{display:none}
//         .up-tab{padding:13px 20px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
//         .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
//         .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}

//         .up-content{padding:36px 40px 80px}
//         @media(max-width:600px){.up-content{padding:20px 16px 60px}}

//         /* BILLING TOGGLE */
//         .billing-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:36px}
//         .billing-toggle{display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:3px}
//         .billing-btn{padding:8px 22px;border-radius:100px;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .billing-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
//         .billing-save{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:0.04em}

//         /* PLANS GRID */
//         .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1000px;margin:0 auto}
//         .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
//         .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
//         .plan-card.active-plan{border-color:rgba(16,185,129,0.5)!important;background:rgba(16,185,129,0.06)!important}
//         .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
//         .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
//         .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}

//         .plan-name{font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px}

//         /* Price row */
//         .plan-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap}
//         .plan-original{font-size:18px;font-weight:700;color:rgba(255,255,255,0.25);text-decoration:line-through}
//         .plan-price{font-size:36px;font-weight:900;color:#fff}
//         .plan-price span{font-size:15px;font-weight:500;color:rgba(255,255,255,0.4)}

//         /* Token + campaign pills */
//         .plan-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
//         .plan-pill{display:inline-flex;align-items:center;gap:5px;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700}
//         .plan-pill.token{background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);color:#fbbf24}
//         .plan-pill.camp{background:rgba(79,70,229,0.12);border:1px solid rgba(79,70,229,0.25);color:#a5b4fc}

//         .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 16px}
//         .plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
//         .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
//         .plan-feature-icon{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;margin-top:2px}
//         .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
//         .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}

//         /* CTA */
//         .plan-cta{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
//         .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
//         .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
//         .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
//         .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
//         .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
//         .plan-cta.active-cta{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
//         .plan-cta:disabled{opacity:0.7;cursor:not-allowed;transform:none!important}

//         .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
//         @keyframes spinning{to{transform:rotate(360deg)}}

//         .up-secure{font-size:11px;color:rgba(255,255,255,0.22);text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px}

//         /* ESCROW */
//         .escrow-hero{text-align:center;margin-bottom:36px}
//         .escrow-hero-title{font-size:26px;font-weight:900;color:#fff;margin-bottom:8px}
//         .escrow-hero-sub{font-size:14px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
//         .escrow-steps{display:flex;flex-direction:column;gap:14px;max-width:640px;margin:0 auto 40px}
//         .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
//         .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
//         .escrow-step-num{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
//         .escrow-step-title{font-size:14px;font-weight:800;color:#fff;margin-bottom:3px}
//         .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
//         .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:26px}
//         .escrow-breakdown-title{font-size:15px;font-weight:800;color:#a5b4fc;margin-bottom:18px;text-align:center}
//         .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
//         .escrow-row:last-child{border-bottom:none}
//         .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
//         .escrow-row-val{font-size:15px;font-weight:800}
//         .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:18px;width:100%;justify-content:center}

//         /* FEATURES */
//         .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-width:1000px;margin:0 auto}
//         .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:22px;transition:all 0.25s}
//         .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
//         .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
//         .feat-icon{font-size:26px}
//         .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
//         .feat-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:7px}
//         .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}

//         .section-title{font-size:21px;font-weight:900;color:#fff;text-align:center;margin-bottom:5px}
//         .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:28px}

//         /* BOTTOM CTA */
//         .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:56px 40px;text-align:center}
//         .up-bottom-title{font-size:clamp(20px,4vw,36px);font-weight:900;color:#fff;margin-bottom:10px}
//         .up-bottom-sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:26px}
//         .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
//         .up-bottom-btn{padding:13px 30px;border-radius:14px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
//         .up-bottom-btn.primary:hover{transform:translateY(-2px)}
//         .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
//         .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up">

//         {/* Active Plan Banner */}
//         {isSubscribed && (() => {
//           // Find which plan is active to show correct name
//           const allPlans = [...brandMonthlyPlans, ...brandYearlyPlans, ...creatorMonthlyPlans, ...creatorYearlyPlans];
//           const toCanonicalBanner = (s: string): string => {
//             if (!s) return "";
//             const v = s.toLowerCase().trim();
//             if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//             if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//             if (v === "proyear" || v === "pro_year") return "pro_year";
//             if (v === "pro") return "pro";
//             return v;
//           };
//           const canonicalActiveBanner = toCanonicalBanner(activePlan || "");
//           const matched = allPlans.find(p => p.id !== "free" && toCanonicalBanner(p.id) === canonicalActiveBanner);
//           const displayName = matched?.name || activePlan?.replace(/_year$/, "").replace("_", " ") || "Pro";
//           return (
//             <div className="up-active-banner">
//               <div className="up-active-inner">
//                 <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
//                   <span style={{ fontSize: 26 }}>🎉</span>
//                   <div>
//                     <div className="up-active-title">Your plan is active!</div>
//                     <div className="up-active-sub">You have full access to all premium features.</div>
//                   </div>
//                 </div>
//                 <span className="up-active-badge">✓ {displayName} Active</span>
//               </div>
//             </div>
//           );
//         })()}

//         {/* HERO */}
//         <div className="up-hero">
//           <div className="up-hero-label">✦ CreatorBridge Platform</div>
//           <h1 className="up-hero-title">
//             Close deals on platform,<br />security is guaranteed
//           </h1>
//           <p className="up-hero-sub">
//             Escrow payments, verified creators, smart contracts — all in one platform.
//           </p>

//           {/* Role pill — just shows which plan type, not clickable */}
//           <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(79,70,229,0.15)",border:"1px solid rgba(79,70,229,0.3)",borderRadius:100,padding:"8px 20px",fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:8}}>
//             {role === "brand" ? "🏢 Brand Plans" : "🎨 Creator Plans"}
//           </div>
//         </div>

//         {/* TABS — tokens tab removed */}
//         <div className="up-tabs">
//           {(["plans", "escrow", "features"] as Tab[]).map((t) => (
//             <button
//               key={t}
//               className={`up-tab ${tab === t ? "active" : ""}`}
//               onClick={() => setTab(t)}
//             >
//               {t === "plans" && "💎 Plans"}
//               {t === "escrow" && "🔐 Escrow"}
//               {t === "features" && "⚡ Features"}
//             </button>
//           ))}
//         </div>

//         <div className="up-content">

//           {/* PLANS TAB */}
//           {tab === "plans" && (
//             <>
//               <div className="section-title">
//                 {role === "creator" ? "Creator" : "Brand"} Plans
//               </div>
//               <div className="section-sub">
//                 {role === "creator"
//                   ? "Start free, upgrade when you're ready to grow your creator career"
//                   : "The right tools to find the best creators and run successful campaigns"}
//               </div>

//               {/* Monthly / Yearly billing toggle */}
//               <div className="billing-wrap">
//                 <div className="billing-toggle">
//                   <button
//                     className={`billing-btn ${billing === "monthly" ? "active" : ""}`}
//                     onClick={() => setBilling("monthly")}
//                   >
//                     Monthly
//                   </button>
//                   <button
//                     className={`billing-btn ${billing === "yearly" ? "active" : ""}`}
//                     onClick={() => setBilling("yearly")}
//                   >
//                     Yearly
//                   </button>
//                 </div>
//                 {billing === "yearly" && (
//                   <span className="billing-save">🎉 Save up to 45%</span>
//                 )}
//               </div>

//               <div className="plans-grid">
//                 {plans.map((plan: any, i: number) => {
//                   // Strict canonical matching — each value maps to exactly one plan id
//                   const toCanonical = (s: string): string => {
//                     if (!s) return "";
//                     const v = s.toLowerCase().trim();
//                     if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//                     if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//                     if (v === "proyear" || v === "pro_year") return "pro_year";
//                     if (v === "pro") return "pro";
//                     return v;
//                   };
//                   const canonicalActive = toCanonical(activePlan || "");
//                   const canonicalPlan   = toCanonical(plan.id);
//                   const isThisActive =
//                     isSubscribed &&
//                     plan.id !== "free" &&
//                     !!activePlan &&
//                     canonicalActive === canonicalPlan;

//                   const isLoading = loadingPlanId === plan.id;

//                   return (
//                     <div
//                       key={plan.id}
//                       className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}
//                     >
//                       {/* Badge */}
//                       {isThisActive ? (
//                         <div className="plan-active-badge">✓ Your Current Plan</div>
//                       ) : plan.badge ? (
//                         <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div>
//                       ) : null}

//                       <div style={{ marginTop: (plan.badge || isThisActive) ? 20 : 0 }}>
//                         <div className="plan-name">{plan.name}</div>

//                         {/* Price with strikethrough */}
//                         <div className="plan-price-row">
//                           {plan.originalPrice && (
//                             <span className="plan-original">{fmtPrice(plan.originalPrice)}</span>
//                           )}
//                           <span className="plan-price">
//                             {fmtPrice(plan.price)}
//                             <span>{plan.period}</span>
//                           </span>
//                         </div>

//                         {/* Token + campaign pills */}
//                         <div className="plan-pills">
//                           <span className="plan-pill token">
//                             🪙 {typeof plan.tokens === "number" ? plan.tokens.toLocaleString("en-IN") : plan.tokens} tokens
//                           </span>
//                           {role === "brand" && (
//                             <span className="plan-pill camp">
//                               📢 {plan.campaigns} campaigns
//                             </span>
//                           )}
//                           {role === "creator" && (
//                             <span className="plan-pill camp">
//                               📩 {typeof plan.applies === "number" ? plan.applies.toLocaleString("en-IN") : plan.applies} applies
//                             </span>
//                           )}
//                         </div>

//                         <hr className="plan-divider" />

//                         <ul className="plan-features">
//                           {plan.features.map((f: any, fi: number) => (
//                             <li key={fi} className="plan-feature">
//                               <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>
//                                 {f.ok ? "✓" : "✕"}
//                               </span>
//                               {f.text}
//                             </li>
//                           ))}
//                         </ul>

//                         {/* CTA */}
//                         {isThisActive ? (
//                           <button className="plan-cta active-cta" disabled>✓ Active Plan</button>
//                         ) : plan.ctaDisabled ? (
//                           <button className="plan-cta secondary" disabled>{plan.cta}</button>
//                         ) : (
//                           <>
//                             <button
//                               className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`}
//                               disabled={loadingPlanId !== null}
//                               onClick={() => handleSubscribe(plan.id, plan.name)}
//                             >
//                               {isLoading && <span className="spin" />}
//                               {isLoading ? "Processing..." : plan.cta}
//                             </button>
//                             <div className="up-secure">🔒 Secured by Razorpay</div>
//                           </>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </>
//           )}

//           {/* ESCROW TAB */}
//           {tab === "escrow" && (
//             <>
//               <div className="escrow-hero">
//                 <div className="escrow-hero-title">🔐 Escrow Payment System</div>
//                 <div className="escrow-hero-sub">
//                   Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.
//                 </div>
//               </div>
//               <div className="escrow-steps">
//                 {escrowSteps.map((s) => (
//                   <div key={s.step} className="escrow-step">
//                     <div className="escrow-step-num">{s.icon}</div>
//                     <div>
//                       <div className="escrow-step-title">Step {s.step}: {s.title}</div>
//                       <div className="escrow-step-desc">{s.desc}</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="escrow-breakdown">
//                 <div className="escrow-breakdown-title">💰 Payment Breakdown Example</div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Brand deposits</span>
//                   <span className="escrow-row-val" style={{ color: "#f87171" }}>₹10,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Platform commission (10%)</span>
//                   <span className="escrow-row-val" style={{ color: "#fbbf24" }}>₹1,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Creator receives</span>
//                   <span className="escrow-row-val" style={{ color: "#34d399" }}>₹9,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Dispute protection</span>
//                   <span className="escrow-row-val" style={{ color: "#a5b4fc" }}>✅ Included</span>
//                 </div>
//                 <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
//               </div>
//             </>
//           )}

//           {/* FEATURES TAB */}
//           {tab === "features" && (
//             <>
//               <div className="section-title">Platform Features</div>
//               <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
//               <div className="features-grid">
//                 {platformFeatures.map((f, i) => (
//                   <div key={i} className="feat-card">
//                     <div className="feat-top">
//                       <span className="feat-icon">{f.icon}</span>
//                       <span className="feat-tag" style={{ color: f.tagColor }}>{f.tag}</span>
//                     </div>
//                     <div className="feat-title">{f.title}</div>
//                     <div className="feat-desc">{f.desc}</div>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//         </div>

//         {/* BOTTOM CTA */}
//         <div className="up-bottom">
//           <div className="up-bottom-title">Dealing on-platform is<br />always the smarter choice</div>
//           <div className="up-bottom-sub">Escrow protection · Verified creators · Smart contracts · Dispute resolution</div>
//           <div className="up-bottom-btns">
//             <button className="up-bottom-btn primary" onClick={() => setTab("plans")}>✦ View Plans</button>
//             <button className="up-bottom-btn secondary" onClick={() => router.push("/browse")}>Browse Creators →</button>
//           </div>
//         </div>

//       </div>
//     </>
//   );
// }



// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// type Role = "creator" | "brand";
// type Tab = "plans" | "escrow" | "features";
// type Billing = "monthly" | "yearly";

// // ─── BRAND PLANS ───────────────────────────────────────────────
// const brandMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 599,
//     originalPrice: 1000,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     campaigns: 10,
//     features: [
//       { text: "10 campaign posts/month", ok: true },
//       { text: "1,000 tokens/month", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 1099,
//     originalPrice: 2000,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2500,
//     campaigns: 25,
//     features: [
//       { text: "25 campaigns/month", ok: true },
//       { text: "2,500 tokens/month", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const brandYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 6499,
//     originalPrice: 10000,
//     period: "/year",
//     badge: "Popular",
//     tokens: 12000,
//     campaigns: 120,
//     features: [
//       { text: "120 campaigns/year", ok: true },
//       { text: "12,000 tokens/year", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 11999,
//     originalPrice: 20000,
//     period: "/year",
//     badge: "Best Value",
//     tokens: 25000,
//     campaigns: 250,
//     features: [
//       { text: "250 campaigns/year", ok: true },
//       { text: "25,000 tokens/year", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── CREATOR PLANS ─────────────────────────────────────────────
// const creatorMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 1000,
//     applies: 10,
//     features: [
//       { text: "100 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 299,
//     originalPrice: null,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     applies: 100,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "100 applications/month", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 499,
//     originalPrice: null,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2000,
//     applies: 200,
//     features: [
//       { text: "2,000 tokens/month", ok: true },
//       { text: "200 applications/month", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const creatorYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 1000,
//     applies: 10,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 2999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Popular",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 5999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Best Value",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── ESCROW & FEATURES (same for both roles) ───────────────────
// const escrowSteps = [
//   { step: "1", icon: "📋", title: "Create Campaign", desc: "Brand posts a campaign and sets the budget. Example: ₹10,000" },
//   { step: "2", icon: "💰", title: "Escrow Deposit", desc: "Brand deposits ₹10,000 on the platform. The money is securely locked until work is approved." },
//   { step: "3", icon: "🤝", title: "Creator Accepts", desc: "Creator accepts the campaign and starts working on the deliverables." },
//   { step: "4", icon: "📸", title: "Submit Work", desc: "Creator submits proof of work: reel link, post link, story screenshot." },
//   { step: "5", icon: "✅", title: "Brand Approves", desc: "Brand reviews the submitted work and clicks approve." },
//   { step: "6", icon: "🎉", title: "Payment Released", desc: "Platform releases payment instantly. Creator: ₹9,000 | Platform commission: ₹1,000 (10%)" },
// ];

// const platformFeatures = [
//   { icon: "🔒", title: "Contact Info Hidden", desc: "Until a deal is confirmed, creator's phone, email, WhatsApp, and Instagram are hidden. Communication stays inside the app only.", tag: "Privacy", tagColor: "#4f46e5" },
//   { icon: "🚨", title: "Keyword Detection", desc: 'If anyone types "WhatsApp", "phone number", "DM me", or similar in chat, the platform shows an instant warning. All communication stays on-platform.', tag: "Safety", tagColor: "#ef4444" },
//   { icon: "📄", title: "Campaign Contracts", desc: "Both brand and creator sign an agreement — deliverables, timeline, and payment terms are all legally documented before work begins.", tag: "Legal", tagColor: "#16a34a" },
//   { icon: "📦", title: "Deliverables Tracking", desc: "A campaign is not marked complete until the creator uploads proof (reel/post/story) and the brand approves the submission.", tag: "Tracking", tagColor: "#d97706" },
//   { icon: "🏆", title: "Reward System", desc: "Complete deals on-platform and earn extra tokens, profile boost, and better search ranking. Staying on-platform always pays more.", tag: "Rewards", tagColor: "#7c3aed" },
//   { icon: "🤖", title: "AI Smart Matching", desc: "Our AI suggests the best creators for each campaign based on niche, follower count, location, and past performance.", tag: "AI", tagColor: "#0891b2" },
// ];

// export default function UpgradePage() {
//   const router = useRouter();
//   const [role, setRole] = useState<Role>("creator");
//   const [tab, setTab] = useState<Tab>("plans");
//   const [billing, setBilling] = useState<Billing>("monthly");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState<string>("");
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan] = useState<string | null>(null);

//   const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // ── Load user + detect role ──
//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     setToken(t);

//     // Auto set role from login
//     if (parsed.role?.toLowerCase() === "brand") setRole("brand");
//     else setRole("creator");

//     // Restore active plan from localStorage first (instant)
//     if (parsed.isSubscribed) setIsSubscribed(true);
//     if (parsed.activePlan) {
//       // If stored as planName like "Pro+" normalize to planId
//       const nameToId: Record<string, string> = {
//         "pro+": "pro_plus", "Pro+": "pro_plus", "proplus": "pro_plus",
//         "Pro": "pro", "pro": "pro",
//         "Pro+ Year": "pro_plus_year", "Pro Year": "pro_year",
//       };
//       const corrected = nameToId[parsed.activePlan] || parsed.activePlan;
//       setActivePlan(corrected);
//       if (corrected !== parsed.activePlan) {
//         const fix = { ...parsed, activePlan: corrected };
//         localStorage.setItem("cb_user", JSON.stringify(fix));
//       }
//     }

//     // Then verify from backend (source of truth)
//     if (t) fetchActivePlan(t, parsed);
//   }, []);

//   const fetchActivePlan = async (t: string, parsed: any) => {
//     try {
//       const res = await fetch(`${API}/subscription/status`, {
//         headers: { Authorization: `Bearer ${t}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       // Backend may return { isSubscribed, activePlan, planId, planName, status }
//       const sub = data.data || data.subscription || data;
//       const active =
//         sub.isSubscribed === true ||
//         sub.status === "active" ||
//         sub.subscriptionStatus === "active" ||
//         sub.isPremium === true;
//       const planId =
//         sub.activePlan || sub.planId || sub.plan_id || sub.planName || parsed.activePlan || null;

//       if (active && planId) {
//         setIsSubscribed(true);
//         setActivePlan(planId);
//         // Sync to localStorage
//         const updated = { ...parsed, isSubscribed: true, activePlan: planId };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//       }
//     } catch {
//       // silently fail — localStorage already loaded above
//     }
//   };

//   // ── Subscribe flow ──
//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) { showToast("Please login first.", "error"); return; }
//     if (!token) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlanId(planId);
//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription. Try again.", "error");
//         setLoadingPlanId(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlanId(null);
//     }
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
//       handler: async (response: any) => { await verifyAndActivate(response, planId, planName); },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlanId(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (resp: any) => {
//       showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
//       setLoadingPlanId(null);
//     });
//     rzp.open();
//   };

//   const verifyAndActivate = async (response: any, planId: string, planName: string) => {
//     try {
//       const verifyRes = await fetch(`${API}/subscription/verify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ ...response, plan_id: PLAN_ID, planId, planName }),
//       });
//       const verifyData = await verifyRes.json();
//       if (verifyData.success) await activateSubscription(planId, planName);
//       else await activateSubscription(planId, planName);
//     } catch {
//       await activateSubscription(planId, planName);
//     }
//   };

//   const activateSubscription = async (planId: string, planName: string) => {
//     try {
//       const res = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//       });
//       const data = await res.json();
//       if (data.success) {
//         const storedPlanId = planId; // use the exact id we passed (e.g. "pro_plus")
//         const stored = localStorage.getItem("cb_user");
//         const parsed = stored ? JSON.parse(stored) : {};
//         const updated = { ...parsed, isSubscribed: true, activePlan: storedPlanId, activePlanName: planName };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//         setIsSubscribed(true);
//         setActivePlan(storedPlanId);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//       } else {
//         showToast(data.message || "Activation failed. Contact support.", "error");
//       }
//     } catch {
//       showToast("Activation failed. Please contact support.", "error");
//     } finally {
//       setLoadingPlanId(null);
//     }
//   };

//   // ── Get correct plans based on role + billing ──
//   const getPlans = () => {
//     if (role === "brand") return billing === "monthly" ? brandMonthlyPlans : brandYearlyPlans;
//     return billing === "monthly" ? creatorMonthlyPlans : creatorYearlyPlans;
//   };

//   const plans = getPlans();

//   const fmtPrice = (p: number) => p === 0 ? "₹0" : `₹${p.toLocaleString("en-IN")}`;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

//         .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}

//         /* TOAST */
//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         /* ACTIVE PLAN BANNER */
//         .up-active-banner{max-width:1000px;margin:0 auto;padding:20px 40px 0}
//         @media(max-width:600px){.up-active-banner{padding:16px 16px 0}}
//         .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .up-active-title{font-size:15px;font-weight:700;color:#34d399}
//         .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
//         .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}

//         /* HERO */
//         .up-hero{position:relative;padding:52px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
//         @media(max-width:600px){.up-hero{padding:36px 16px 0}}
//         .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px}
//         .up-hero-title{font-size:clamp(24px,4.5vw,46px);font-weight:900;line-height:1.1;margin-bottom:14px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
//         .up-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto 28px;line-height:1.6}

//         /* ROLE TOGGLE */
//         .up-role{display:inline-flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:4px;margin-bottom:32px;gap:4px}
//         .up-role-btn{padding:10px 26px;border-radius:10px;border:none;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .up-role-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}

//         /* TABS */
//         .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
//         @media(max-width:600px){.up-tabs{padding:0 16px}}
//         .up-tabs::-webkit-scrollbar{display:none}
//         .up-tab{padding:13px 20px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
//         .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
//         .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}

//         .up-content{padding:36px 40px 80px}
//         @media(max-width:600px){.up-content{padding:20px 16px 60px}}

//         /* BILLING TOGGLE */
//         .billing-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:36px}
//         .billing-toggle{display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:3px}
//         .billing-btn{padding:8px 22px;border-radius:100px;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .billing-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
//         .billing-save{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:0.04em}

//         /* PLANS GRID */
//         .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1000px;margin:0 auto}
//         .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
//         .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
//         .plan-card.active-plan{border-color:rgba(16,185,129,0.5)!important;background:rgba(16,185,129,0.06)!important}
//         .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
//         .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
//         .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}

//         .plan-name{font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px}

//         /* Price row */
//         .plan-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap}
//         .plan-original{font-size:18px;font-weight:700;color:rgba(255,255,255,0.25);text-decoration:line-through}
//         .plan-price{font-size:36px;font-weight:900;color:#fff}
//         .plan-price span{font-size:15px;font-weight:500;color:rgba(255,255,255,0.4)}

//         /* Token + campaign pills */
//         .plan-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
//         .plan-pill{display:inline-flex;align-items:center;gap:5px;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700}
//         .plan-pill.token{background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);color:#fbbf24}
//         .plan-pill.camp{background:rgba(79,70,229,0.12);border:1px solid rgba(79,70,229,0.25);color:#a5b4fc}

//         .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 16px}
//         .plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
//         .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
//         .plan-feature-icon{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;margin-top:2px}
//         .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
//         .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}

//         /* CTA */
//         .plan-cta{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
//         .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
//         .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
//         .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
//         .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
//         .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
//         .plan-cta.active-cta{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
//         .plan-cta:disabled{opacity:0.7;cursor:not-allowed;transform:none!important}

//         .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
//         @keyframes spinning{to{transform:rotate(360deg)}}

//         .up-secure{font-size:11px;color:rgba(255,255,255,0.22);text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px}

//         /* ESCROW */
//         .escrow-hero{text-align:center;margin-bottom:36px}
//         .escrow-hero-title{font-size:26px;font-weight:900;color:#fff;margin-bottom:8px}
//         .escrow-hero-sub{font-size:14px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
//         .escrow-steps{display:flex;flex-direction:column;gap:14px;max-width:640px;margin:0 auto 40px}
//         .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
//         .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
//         .escrow-step-num{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
//         .escrow-step-title{font-size:14px;font-weight:800;color:#fff;margin-bottom:3px}
//         .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
//         .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:26px}
//         .escrow-breakdown-title{font-size:15px;font-weight:800;color:#a5b4fc;margin-bottom:18px;text-align:center}
//         .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
//         .escrow-row:last-child{border-bottom:none}
//         .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
//         .escrow-row-val{font-size:15px;font-weight:800}
//         .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:18px;width:100%;justify-content:center}

//         /* FEATURES */
//         .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-width:1000px;margin:0 auto}
//         .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:22px;transition:all 0.25s}
//         .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
//         .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
//         .feat-icon{font-size:26px}
//         .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
//         .feat-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:7px}
//         .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}

//         .section-title{font-size:21px;font-weight:900;color:#fff;text-align:center;margin-bottom:5px}
//         .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:28px}

//         /* BOTTOM CTA */
//         .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:56px 40px;text-align:center}
//         .up-bottom-title{font-size:clamp(20px,4vw,36px);font-weight:900;color:#fff;margin-bottom:10px}
//         .up-bottom-sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:26px}
//         .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
//         .up-bottom-btn{padding:13px 30px;border-radius:14px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
//         .up-bottom-btn.primary:hover{transform:translateY(-2px)}
//         .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
//         .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up">

//         {/* Active Plan Banner */}
//         {isSubscribed && (() => {
//           // Find which plan is active to show correct name
//           const allPlans = [...brandMonthlyPlans, ...brandYearlyPlans, ...creatorMonthlyPlans, ...creatorYearlyPlans];
//           const toCanonicalBanner = (s: string): string => {
//             if (!s) return "";
//             const v = s.toLowerCase().trim();
//             if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//             if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//             if (v === "proyear" || v === "pro_year") return "pro_year";
//             if (v === "pro") return "pro";
//             return v;
//           };
//           const canonicalActiveBanner = toCanonicalBanner(activePlan || "");
//           const matched = allPlans.find(p => p.id !== "free" && toCanonicalBanner(p.id) === canonicalActiveBanner);
//           const displayName = matched?.name || activePlan?.replace(/_year$/, "").replace("_", " ") || "Pro";
//           return (
//             <div className="up-active-banner">
//               <div className="up-active-inner">
//                 <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
//                   <span style={{ fontSize: 26 }}>🎉</span>
//                   <div>
//                     <div className="up-active-title">Your plan is active!</div>
//                     <div className="up-active-sub">You have full access to all premium features.</div>
//                   </div>
//                 </div>
//                 <span className="up-active-badge">✓ {displayName} Active</span>
//               </div>
//             </div>
//           );
//         })()}

//         {/* HERO */}
//         <div className="up-hero">
//           <div className="up-hero-label">✦ CreatorBridge Platform</div>
//           <h1 className="up-hero-title">
//             Close deals on platform,<br />security is guaranteed
//           </h1>
//           <p className="up-hero-sub">
//             Escrow payments, verified creators, smart contracts — all in one platform.
//           </p>

//           {/* Role pill — just shows which plan type, not clickable */}
//           <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(79,70,229,0.15)",border:"1px solid rgba(79,70,229,0.3)",borderRadius:100,padding:"8px 20px",fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:8}}>
//             {role === "brand" ? "🏢 Brand Plans" : "🎨 Creator Plans"}
//           </div>
//         </div>

//         {/* TABS — tokens tab removed */}
//         <div className="up-tabs">
//           {(["plans", "escrow", "features"] as Tab[]).map((t) => (
//             <button
//               key={t}
//               className={`up-tab ${tab === t ? "active" : ""}`}
//               onClick={() => setTab(t)}
//             >
//               {t === "plans" && "💎 Plans"}
//               {t === "escrow" && "🔐 Escrow"}
//               {t === "features" && "⚡ Features"}
//             </button>
//           ))}
//         </div>

//         <div className="up-content">

//           {/* PLANS TAB */}
//           {tab === "plans" && (
//             <>
//               <div className="section-title">
//                 {role === "creator" ? "Creator" : "Brand"} Plans
//               </div>
//               <div className="section-sub">
//                 {role === "creator"
//                   ? "Start free, upgrade when you're ready to grow your creator career"
//                   : "The right tools to find the best creators and run successful campaigns"}
//               </div>

//               {/* Monthly / Yearly billing toggle */}
//               <div className="billing-wrap">
//                 <div className="billing-toggle">
//                   <button
//                     className={`billing-btn ${billing === "monthly" ? "active" : ""}`}
//                     onClick={() => setBilling("monthly")}
//                   >
//                     Monthly
//                   </button>
//                   <button
//                     className={`billing-btn ${billing === "yearly" ? "active" : ""}`}
//                     onClick={() => setBilling("yearly")}
//                   >
//                     Yearly
//                   </button>
//                 </div>
//                 {billing === "yearly" && (
//                   <span className="billing-save">🎉 Save up to 45%</span>
//                 )}
//               </div>

//               <div className="plans-grid">
//                 {plans.map((plan: any, i: number) => {
//                   // Strict canonical matching — each value maps to exactly one plan id
//                   const toCanonical = (s: string): string => {
//                     if (!s) return "";
//                     const v = s.toLowerCase().trim();
//                     if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//                     if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//                     if (v === "proyear" || v === "pro_year") return "pro_year";
//                     if (v === "pro") return "pro";
//                     return v;
//                   };
//                   const canonicalActive = toCanonical(activePlan || "");
//                   const canonicalPlan   = toCanonical(plan.id);
//                   const isThisActive =
//                     isSubscribed &&
//                     plan.id !== "free" &&
//                     !!activePlan &&
//                     canonicalActive === canonicalPlan;

//                   const isLoading = loadingPlanId === plan.id;

//                   return (
//                     <div
//                       key={plan.id}
//                       className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}
//                     >
//                       {/* Badge */}
//                       {isThisActive ? (
//                         <div className="plan-active-badge">✓ Your Current Plan</div>
//                       ) : plan.badge ? (
//                         <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div>
//                       ) : null}

//                       <div style={{ marginTop: (plan.badge || isThisActive) ? 20 : 0 }}>
//                         <div className="plan-name">{plan.name}</div>

//                         {/* Price with strikethrough */}
//                         <div className="plan-price-row">
//                           {plan.originalPrice && (
//                             <span className="plan-original">{fmtPrice(plan.originalPrice)}</span>
//                           )}
//                           <span className="plan-price">
//                             {fmtPrice(plan.price)}
//                             <span>{plan.period}</span>
//                           </span>
//                         </div>

//                         {/* Token + campaign pills */}
//                         <div className="plan-pills">
//                           <span className="plan-pill token">
//                             🪙 {typeof plan.tokens === "number" ? plan.tokens.toLocaleString("en-IN") : plan.tokens} tokens
//                           </span>
//                           {role === "brand" && (
//                             <span className="plan-pill camp">
//                               📢 {plan.campaigns} campaigns
//                             </span>
//                           )}
//                           {role === "creator" && (
//                             <span className="plan-pill camp">
//                               📩 {typeof plan.applies === "number" ? plan.applies.toLocaleString("en-IN") : plan.applies} applies
//                             </span>
//                           )}
//                         </div>

//                         <hr className="plan-divider" />

//                         <ul className="plan-features">
//                           {plan.features.map((f: any, fi: number) => (
//                             <li key={fi} className="plan-feature">
//                               <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>
//                                 {f.ok ? "✓" : "✕"}
//                               </span>
//                               {f.text}
//                             </li>
//                           ))}
//                         </ul>

//                         {/* CTA */}
//                         {isThisActive ? (
//                           <button className="plan-cta active-cta" disabled>✓ Active Plan</button>
//                         ) : plan.ctaDisabled ? (
//                           <button className="plan-cta secondary" disabled>{plan.cta}</button>
//                         ) : (
//                           <>
//                             <button
//                               className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`}
//                               disabled={loadingPlanId !== null}
//                               onClick={() => handleSubscribe(plan.id, plan.name)}
//                             >
//                               {isLoading && <span className="spin" />}
//                               {isLoading ? "Processing..." : plan.cta}
//                             </button>
//                             <div className="up-secure">🔒 Secured by Razorpay</div>
//                           </>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </>
//           )}

//           {/* ESCROW TAB */}
//           {tab === "escrow" && (
//             <>
//               <div className="escrow-hero">
//                 <div className="escrow-hero-title">🔐 Escrow Payment System</div>
//                 <div className="escrow-hero-sub">
//                   Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.
//                 </div>
//               </div>
//               <div className="escrow-steps">
//                 {escrowSteps.map((s) => (
//                   <div key={s.step} className="escrow-step">
//                     <div className="escrow-step-num">{s.icon}</div>
//                     <div>
//                       <div className="escrow-step-title">Step {s.step}: {s.title}</div>
//                       <div className="escrow-step-desc">{s.desc}</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="escrow-breakdown">
//                 <div className="escrow-breakdown-title">💰 Payment Breakdown Example</div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Brand deposits</span>
//                   <span className="escrow-row-val" style={{ color: "#f87171" }}>₹10,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Platform commission (10%)</span>
//                   <span className="escrow-row-val" style={{ color: "#fbbf24" }}>₹1,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Creator receives</span>
//                   <span className="escrow-row-val" style={{ color: "#34d399" }}>₹9,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Dispute protection</span>
//                   <span className="escrow-row-val" style={{ color: "#a5b4fc" }}>✅ Included</span>
//                 </div>
//                 <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
//               </div>
//             </>
//           )}

//           {/* FEATURES TAB */}
//           {tab === "features" && (
//             <>
//               <div className="section-title">Platform Features</div>
//               <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
//               <div className="features-grid">
//                 {platformFeatures.map((f, i) => (
//                   <div key={i} className="feat-card">
//                     <div className="feat-top">
//                       <span className="feat-icon">{f.icon}</span>
//                       <span className="feat-tag" style={{ color: f.tagColor }}>{f.tag}</span>
//                     </div>
//                     <div className="feat-title">{f.title}</div>
//                     <div className="feat-desc">{f.desc}</div>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//         </div>

//         {/* BOTTOM CTA */}
//         <div className="up-bottom">
//           <div className="up-bottom-title">Dealing on-platform is<br />always the smarter choice</div>
//           <div className="up-bottom-sub">Escrow protection · Verified creators · Smart contracts · Dispute resolution</div>
//           <div className="up-bottom-btns">
//             <button className="up-bottom-btn primary" onClick={() => setTab("plans")}>✦ View Plans</button>
//             <button className="up-bottom-btn secondary" onClick={() => router.push("/browse")}>Browse Creators →</button>
//           </div>
//         </div>

//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// type Role = "creator" | "brand";
// type Tab = "plans" | "escrow" | "features";
// type Billing = "monthly" | "yearly";

// // ─── BRAND PLANS ───────────────────────────────────────────────
// const brandMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 599,
//     originalPrice: 1000,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     campaigns: 10,
//     features: [
//       { text: "10 campaign posts/month", ok: true },
//       { text: "1,000 tokens/month", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 1099,
//     originalPrice: 2000,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2500,
//     campaigns: 25,
//     features: [
//       { text: "25 campaigns/month", ok: true },
//       { text: "2,500 tokens/month", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const brandYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 200,
//     campaigns: 2,
//     features: [
//       { text: "2 campaign posts", ok: true },
//       { text: "200 tokens/month", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//       { text: "Escrow payment protection", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 6499,
//     originalPrice: 10000,
//     period: "/year",
//     badge: "Popular",
//     tokens: 12000,
//     campaigns: 120,
//     features: [
//       { text: "120 campaigns/year", ok: true },
//       { text: "12,000 tokens/year", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 11999,
//     originalPrice: 20000,
//     period: "/year",
//     badge: "Best Value",
//     tokens: 25000,
//     campaigns: 250,
//     features: [
//       { text: "250 campaigns/year", ok: true },
//       { text: "25,000 tokens/year", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── CREATOR PLANS ─────────────────────────────────────────────
// const creatorMonthlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/month",
//     badge: null,
//     tokens: 1000,
//     applies: 10,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: 299,
//     originalPrice: null,
//     period: "/month",
//     badge: "Popular",
//     tokens: 1000,
//     applies: 100,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "100 applications/month", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: 499,
//     originalPrice: null,
//     period: "/month",
//     badge: "Best Value",
//     tokens: 2000,
//     applies: 200,
//     features: [
//       { text: "2,000 tokens/month", ok: true },
//       { text: "200 applications/month", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const creatorYearlyPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: 0,
//     originalPrice: null,
//     period: "/year",
//     badge: null,
//     tokens: 1000,
//     applies: 10,
//     features: [
//       { text: "1,000 tokens/month", ok: true },
//       { text: "10 campaign applications/month", ok: true },
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//       { text: "Priority listing", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro_year",
//     name: "Pro",
//     price: 2999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Popular",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Direct brand invite option", ok: false },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus_year",
//     name: "Pro+",
//     price: 5999,
//     originalPrice: null,
//     period: "/year",
//     badge: "Best Value",
//     tokens: "Unlimited",
//     applies: "Unlimited",
//     features: [
//       { text: "Unlimited tokens/year", ok: true },
//       { text: "Unlimited applications/year", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// // ─── ESCROW & FEATURES (same for both roles) ───────────────────
// const escrowSteps = [
//   { step: "1", icon: "📋", title: "Create Campaign", desc: "Brand posts a campaign and sets the budget. Example: ₹10,000" },
//   { step: "2", icon: "💰", title: "Escrow Deposit", desc: "Brand deposits ₹10,000 on the platform. The money is securely locked until work is approved." },
//   { step: "3", icon: "🤝", title: "Creator Accepts", desc: "Creator accepts the campaign and starts working on the deliverables." },
//   { step: "4", icon: "📸", title: "Submit Work", desc: "Creator submits proof of work: reel link, post link, story screenshot." },
//   { step: "5", icon: "✅", title: "Brand Approves", desc: "Brand reviews the submitted work and clicks approve." },
//   { step: "6", icon: "🎉", title: "Payment Released", desc: "Platform releases payment instantly. Creator: ₹9,000 | Platform commission: ₹1,000 (10%)" },
// ];

// const platformFeatures = [
//   { icon: "🔒", title: "Contact Info Hidden", desc: "Until a deal is confirmed, creator's phone, email, WhatsApp, and Instagram are hidden. Communication stays inside the app only.", tag: "Privacy", tagColor: "#4f46e5" },
//   { icon: "🚨", title: "Keyword Detection", desc: 'If anyone types "WhatsApp", "phone number", "DM me", or similar in chat, the platform shows an instant warning. All communication stays on-platform.', tag: "Safety", tagColor: "#ef4444" },
//   { icon: "📄", title: "Campaign Contracts", desc: "Both brand and creator sign an agreement — deliverables, timeline, and payment terms are all legally documented before work begins.", tag: "Legal", tagColor: "#16a34a" },
//   { icon: "📦", title: "Deliverables Tracking", desc: "A campaign is not marked complete until the creator uploads proof (reel/post/story) and the brand approves the submission.", tag: "Tracking", tagColor: "#d97706" },
//   { icon: "🏆", title: "Reward System", desc: "Complete deals on-platform and earn extra tokens, profile boost, and better search ranking. Staying on-platform always pays more.", tag: "Rewards", tagColor: "#7c3aed" },
//   { icon: "🤖", title: "AI Smart Matching", desc: "Our AI suggests the best creators for each campaign based on niche, follower count, location, and past performance.", tag: "AI", tagColor: "#0891b2" },
// ];

// export default function UpgradePage() {
//   const router = useRouter();
//   const [role, setRole] = useState<Role>("creator");
//   const [tab, setTab] = useState<Tab>("plans");
//   const [billing, setBilling] = useState<Billing>("monthly");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState<string>("");
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan] = useState<string | null>(null);

//   const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // ── Load user + detect role ──
//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     setToken(t);

//     // Auto set role from login
//     if (parsed.role?.toLowerCase() === "brand") setRole("brand");
//     else setRole("creator");

//     // Restore active plan
//     if (parsed.isSubscribed) setIsSubscribed(true);
//     if (parsed.activePlan) setActivePlan(parsed.activePlan);
//   }, []);

//   // ── Subscribe flow ──
//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) { showToast("Please login first.", "error"); return; }
//     if (!token) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlanId(planId);
//     try {
//       const res = await fetch(`${API}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription. Try again.", "error");
//         setLoadingPlanId(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlanId(null);
//     }
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone || "" },
//       handler: async (response: any) => { await verifyAndActivate(response, planId, planName); },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlanId(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (resp: any) => {
//       showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
//       setLoadingPlanId(null);
//     });
//     rzp.open();
//   };

//   const verifyAndActivate = async (response: any, planId: string, planName: string) => {
//     try {
//       const verifyRes = await fetch(`${API}/subscription/verify`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ ...response, plan_id: PLAN_ID, planId, planName }),
//       });
//       const verifyData = await verifyRes.json();
//       if (verifyData.success) await activateSubscription(planId, planName);
//       else await activateSubscription(planId, planName);
//     } catch {
//       await activateSubscription(planId, planName);
//     }
//   };

//   const activateSubscription = async (planId: string, planName: string) => {
//     try {
//       const res = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//       });
//       const data = await res.json();
//       if (data.success) {
//         const stored = localStorage.getItem("cb_user");
//         const parsed = stored ? JSON.parse(stored) : {};
//         const updated = { ...parsed, isSubscribed: true, activePlan: planId, activePlanName: planName };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//         setIsSubscribed(true);
//         setActivePlan(planId);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//       } else {
//         showToast(data.message || "Activation failed. Contact support.", "error");
//       }
//     } catch {
//       showToast("Activation failed. Please contact support.", "error");
//     } finally {
//       setLoadingPlanId(null);
//     }
//   };

//   // ── Get correct plans based on role + billing ──
//   const getPlans = () => {
//     if (role === "brand") return billing === "monthly" ? brandMonthlyPlans : brandYearlyPlans;
//     return billing === "monthly" ? creatorMonthlyPlans : creatorYearlyPlans;
//   };

//   const plans = getPlans();

//   const fmtPrice = (p: number) => p === 0 ? "₹0" : `₹${p.toLocaleString("en-IN")}`;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

//         .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}

//         /* TOAST */
//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         /* ACTIVE PLAN BANNER */
//         .up-active-banner{max-width:1000px;margin:0 auto;padding:20px 40px 0}
//         @media(max-width:600px){.up-active-banner{padding:16px 16px 0}}
//         .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .up-active-title{font-size:15px;font-weight:700;color:#34d399}
//         .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
//         .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}

//         /* HERO */
//         .up-hero{position:relative;padding:52px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
//         @media(max-width:600px){.up-hero{padding:36px 16px 0}}
//         .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:18px}
//         .up-hero-title{font-size:clamp(24px,4.5vw,46px);font-weight:900;line-height:1.1;margin-bottom:14px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
//         .up-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto 28px;line-height:1.6}

//         /* ROLE TOGGLE */
//         .up-role{display:inline-flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:4px;margin-bottom:32px;gap:4px}
//         .up-role-btn{padding:10px 26px;border-radius:10px;border:none;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .up-role-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}

//         /* TABS */
//         .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
//         @media(max-width:600px){.up-tabs{padding:0 16px}}
//         .up-tabs::-webkit-scrollbar{display:none}
//         .up-tab{padding:13px 20px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
//         .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
//         .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}

//         .up-content{padding:36px 40px 80px}
//         @media(max-width:600px){.up-content{padding:20px 16px 60px}}

//         /* BILLING TOGGLE */
//         .billing-wrap{display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:36px}
//         .billing-toggle{display:flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:100px;padding:3px}
//         .billing-btn{padding:8px 22px;border-radius:100px;border:none;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .billing-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff}
//         .billing-save{background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#34d399;font-size:11px;font-weight:800;padding:4px 12px;border-radius:100px;letter-spacing:0.04em}

//         /* PLANS GRID */
//         .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:1000px;margin:0 auto}
//         .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
//         .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
//         .plan-card.active-plan{border-color:rgba(16,185,129,0.5)!important;background:rgba(16,185,129,0.06)!important}
//         .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
//         .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
//         .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}

//         .plan-name{font-size:13px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:10px}

//         /* Price row */
//         .plan-price-row{display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap}
//         .plan-original{font-size:18px;font-weight:700;color:rgba(255,255,255,0.25);text-decoration:line-through}
//         .plan-price{font-size:36px;font-weight:900;color:#fff}
//         .plan-price span{font-size:15px;font-weight:500;color:rgba(255,255,255,0.4)}

//         /* Token + campaign pills */
//         .plan-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px}
//         .plan-pill{display:inline-flex;align-items:center;gap:5px;border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700}
//         .plan-pill.token{background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);color:#fbbf24}
//         .plan-pill.camp{background:rgba(79,70,229,0.12);border:1px solid rgba(79,70,229,0.25);color:#a5b4fc}

//         .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 16px}
//         .plan-features{list-style:none;display:flex;flex-direction:column;gap:9px;margin-bottom:22px}
//         .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
//         .plan-feature-icon{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0;margin-top:2px}
//         .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
//         .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}

//         /* CTA */
//         .plan-cta{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
//         .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
//         .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
//         .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
//         .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
//         .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
//         .plan-cta.active-cta{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
//         .plan-cta:disabled{opacity:0.7;cursor:not-allowed;transform:none!important}

//         .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
//         @keyframes spinning{to{transform:rotate(360deg)}}

//         .up-secure{font-size:11px;color:rgba(255,255,255,0.22);text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:4px}

//         /* ESCROW */
//         .escrow-hero{text-align:center;margin-bottom:36px}
//         .escrow-hero-title{font-size:26px;font-weight:900;color:#fff;margin-bottom:8px}
//         .escrow-hero-sub{font-size:14px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
//         .escrow-steps{display:flex;flex-direction:column;gap:14px;max-width:640px;margin:0 auto 40px}
//         .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:18px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
//         .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
//         .escrow-step-num{width:42px;height:42px;border-radius:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
//         .escrow-step-title{font-size:14px;font-weight:800;color:#fff;margin-bottom:3px}
//         .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
//         .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:26px}
//         .escrow-breakdown-title{font-size:15px;font-weight:800;color:#a5b4fc;margin-bottom:18px;text-align:center}
//         .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
//         .escrow-row:last-child{border-bottom:none}
//         .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
//         .escrow-row-val{font-size:15px;font-weight:800}
//         .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:18px;width:100%;justify-content:center}

//         /* FEATURES */
//         .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:18px;max-width:1000px;margin:0 auto}
//         .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:22px;transition:all 0.25s}
//         .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
//         .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
//         .feat-icon{font-size:26px}
//         .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
//         .feat-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:7px}
//         .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}

//         .section-title{font-size:21px;font-weight:900;color:#fff;text-align:center;margin-bottom:5px}
//         .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:28px}

//         /* BOTTOM CTA */
//         .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:56px 40px;text-align:center}
//         .up-bottom-title{font-size:clamp(20px,4vw,36px);font-weight:900;color:#fff;margin-bottom:10px}
//         .up-bottom-sub{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:26px}
//         .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
//         .up-bottom-btn{padding:13px 30px;border-radius:14px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
//         .up-bottom-btn.primary:hover{transform:translateY(-2px)}
//         .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
//         .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}
//       `}</style>

//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up">

//         {/* Active Plan Banner */}
//         {isSubscribed && (
//           <div className="up-active-banner">
//             <div className="up-active-inner">
//               <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
//                 <span style={{ fontSize: 26 }}>🎉</span>
//                 <div>
//                   <div className="up-active-title">Your plan is active!</div>
//                   <div className="up-active-sub">You have full access to all premium features.</div>
//                 </div>
//               </div>
//               <span className="up-active-badge">
//                 ✓ {activePlan?.replace(/_year$/, "").replace("_", " ").toUpperCase() || "Pro"} Active
//               </span>
//             </div>
//           </div>
//         )}

//         {/* HERO */}
//         <div className="up-hero">
//           <div className="up-hero-label">✦ CreatorBridge Platform</div>
//           <h1 className="up-hero-title">
//             Close deals on platform,<br />security is guaranteed
//           </h1>
//           <p className="up-hero-sub">
//             Escrow payments, verified creators, smart contracts — all in one platform.
//           </p>

//           {/* Role pill — just shows which plan type, not clickable */}
//           <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(79,70,229,0.15)",border:"1px solid rgba(79,70,229,0.3)",borderRadius:100,padding:"8px 20px",fontSize:13,fontWeight:700,color:"#a5b4fc",marginBottom:8}}>
//             {role === "brand" ? "🏢 Brand Plans" : "🎨 Creator Plans"}
//           </div>
//         </div>

//         {/* TABS — tokens tab removed */}
//         <div className="up-tabs">
//           {(["plans", "escrow", "features"] as Tab[]).map((t) => (
//             <button
//               key={t}
//               className={`up-tab ${tab === t ? "active" : ""}`}
//               onClick={() => setTab(t)}
//             >
//               {t === "plans" && "💎 Plans"}
//               {t === "escrow" && "🔐 Escrow"}
//               {t === "features" && "⚡ Features"}
//             </button>
//           ))}
//         </div>

//         <div className="up-content">

//           {/* PLANS TAB */}
//           {tab === "plans" && (
//             <>
//               <div className="section-title">
//                 {role === "creator" ? "Creator" : "Brand"} Plans
//               </div>
//               <div className="section-sub">
//                 {role === "creator"
//                   ? "Start free, upgrade when you're ready to grow your creator career"
//                   : "The right tools to find the best creators and run successful campaigns"}
//               </div>

//               {/* Monthly / Yearly billing toggle */}
//               <div className="billing-wrap">
//                 <div className="billing-toggle">
//                   <button
//                     className={`billing-btn ${billing === "monthly" ? "active" : ""}`}
//                     onClick={() => setBilling("monthly")}
//                   >
//                     Monthly
//                   </button>
//                   <button
//                     className={`billing-btn ${billing === "yearly" ? "active" : ""}`}
//                     onClick={() => setBilling("yearly")}
//                   >
//                     Yearly
//                   </button>
//                 </div>
//                 {billing === "yearly" && (
//                   <span className="billing-save">🎉 Save up to 45%</span>
//                 )}
//               </div>

//               <div className="plans-grid">
//                 {plans.map((plan: any, i: number) => {
//                   const isThisActive = isSubscribed && activePlan === plan.id;
//                   const isLoading = loadingPlanId === plan.id;

//                   return (
//                     <div
//                       key={plan.id}
//                       className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}
//                     >
//                       {/* Badge */}
//                       {isThisActive ? (
//                         <div className="plan-active-badge">✓ Your Current Plan</div>
//                       ) : plan.badge ? (
//                         <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div>
//                       ) : null}

//                       <div style={{ marginTop: (plan.badge || isThisActive) ? 20 : 0 }}>
//                         <div className="plan-name">{plan.name}</div>

//                         {/* Price with strikethrough */}
//                         <div className="plan-price-row">
//                           {plan.originalPrice && (
//                             <span className="plan-original">{fmtPrice(plan.originalPrice)}</span>
//                           )}
//                           <span className="plan-price">
//                             {fmtPrice(plan.price)}
//                             <span>{plan.period}</span>
//                           </span>
//                         </div>

//                         {/* Token + campaign pills */}
//                         <div className="plan-pills">
//                           <span className="plan-pill token">
//                             🪙 {typeof plan.tokens === "number" ? plan.tokens.toLocaleString("en-IN") : plan.tokens} tokens
//                           </span>
//                           {role === "brand" && (
//                             <span className="plan-pill camp">
//                               📢 {plan.campaigns} campaigns
//                             </span>
//                           )}
//                           {role === "creator" && (
//                             <span className="plan-pill camp">
//                               📩 {typeof plan.applies === "number" ? plan.applies.toLocaleString("en-IN") : plan.applies} applies
//                             </span>
//                           )}
//                         </div>

//                         <hr className="plan-divider" />

//                         <ul className="plan-features">
//                           {plan.features.map((f: any, fi: number) => (
//                             <li key={fi} className="plan-feature">
//                               <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>
//                                 {f.ok ? "✓" : "✕"}
//                               </span>
//                               {f.text}
//                             </li>
//                           ))}
//                         </ul>

//                         {/* CTA */}
//                         {isThisActive ? (
//                           <button className="plan-cta active-cta" disabled>✓ Active Plan</button>
//                         ) : plan.ctaDisabled ? (
//                           <button className="plan-cta secondary" disabled>{plan.cta}</button>
//                         ) : (
//                           <>
//                             <button
//                               className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`}
//                               disabled={loadingPlanId !== null}
//                               onClick={() => handleSubscribe(plan.id, plan.name)}
//                             >
//                               {isLoading && <span className="spin" />}
//                               {isLoading ? "Processing..." : plan.cta}
//                             </button>
//                             <div className="up-secure">🔒 Secured by Razorpay</div>
//                           </>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </>
//           )}

//           {/* ESCROW TAB */}
//           {tab === "escrow" && (
//             <>
//               <div className="escrow-hero">
//                 <div className="escrow-hero-title">🔐 Escrow Payment System</div>
//                 <div className="escrow-hero-sub">
//                   Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.
//                 </div>
//               </div>
//               <div className="escrow-steps">
//                 {escrowSteps.map((s) => (
//                   <div key={s.step} className="escrow-step">
//                     <div className="escrow-step-num">{s.icon}</div>
//                     <div>
//                       <div className="escrow-step-title">Step {s.step}: {s.title}</div>
//                       <div className="escrow-step-desc">{s.desc}</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="escrow-breakdown">
//                 <div className="escrow-breakdown-title">💰 Payment Breakdown Example</div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Brand deposits</span>
//                   <span className="escrow-row-val" style={{ color: "#f87171" }}>₹10,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Platform commission (10%)</span>
//                   <span className="escrow-row-val" style={{ color: "#fbbf24" }}>₹1,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Creator receives</span>
//                   <span className="escrow-row-val" style={{ color: "#34d399" }}>₹9,000</span>
//                 </div>
//                 <div className="escrow-row">
//                   <span className="escrow-row-label">Dispute protection</span>
//                   <span className="escrow-row-val" style={{ color: "#a5b4fc" }}>✅ Included</span>
//                 </div>
//                 <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
//               </div>
//             </>
//           )}

//           {/* FEATURES TAB */}
//           {tab === "features" && (
//             <>
//               <div className="section-title">Platform Features</div>
//               <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
//               <div className="features-grid">
//                 {platformFeatures.map((f, i) => (
//                   <div key={i} className="feat-card">
//                     <div className="feat-top">
//                       <span className="feat-icon">{f.icon}</span>
//                       <span className="feat-tag" style={{ color: f.tagColor }}>{f.tag}</span>
//                     </div>
//                     <div className="feat-title">{f.title}</div>
//                     <div className="feat-desc">{f.desc}</div>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//         </div>

//         {/* BOTTOM CTA */}
//         <div className="up-bottom">
//           <div className="up-bottom-title">Dealing on-platform is<br />always the smarter choice</div>
//           <div className="up-bottom-sub">Escrow protection · Verified creators · Smart contracts · Dispute resolution</div>
//           <div className="up-bottom-btns">
//             <button className="up-bottom-btn primary" onClick={() => setTab("plans")}>✦ View Plans</button>
//             <button className="up-bottom-btn secondary" onClick={() => router.push("/browse")}>Browse Creators →</button>
//           </div>
//         </div>

//       </div>
//     </>
//   );
// }



// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

// type Role = "creator" | "brand";
// type Tab = "plans" | "tokens" | "escrow" | "features";

// const creatorPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: "₹0",
//     period: "/month",
//     badge: null,
//     tokens: 100,
//     features: [
//       { text: "Create your profile", ok: true },
//       { text: "Basic search visibility", ok: true },
//       { text: "100 tokens/month", ok: true },
//       { text: "10 tokens per campaign apply", ok: true },
//       { text: "Max 10 applications/month", ok: true },
//       { text: "Basic analytics", ok: true },
//       { text: "Brand contact hidden", ok: false },
//       { text: "Verified badge", ok: false },
//       { text: "Profile boost", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: "₹499",
//     period: "/month",
//     badge: "Popular",
//     tokens: 300,
//     features: [
//       { text: "300 tokens/month", ok: true },
//       { text: "Unlimited campaign browsing", ok: true },
//       { text: "30 applications/month", ok: true },
//       { text: "Profile boost in search", ok: true },
//       { text: "Advanced analytics", ok: true },
//       { text: "Campaign alerts", ok: true },
//       { text: "Verified badge", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "Featured profile listing", ok: false },
//       { text: "AI campaign matching", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: "₹999",
//     period: "/month",
//     badge: "Best Value",
//     tokens: 600,
//     features: [
//       { text: "600 tokens/month", ok: true },
//       { text: "Unlimited applications", ok: true },
//       { text: "Featured profile listing", ok: true },
//       { text: "Direct brand invite option", ok: true },
//       { text: "Priority support", ok: true },
//       { text: "AI campaign matching", ok: true },
//       { text: "Verified + Featured badge", ok: true },
//       { text: "Rewards & profile boost", ok: true },
//       { text: "Early access to campaigns", ok: true },
//       { text: "Dispute protection", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const brandPlans = [
//   {
//     id: "free",
//     name: "Free",
//     price: "₹0",
//     period: "/month",
//     badge: null,
//     tokens: 100,
//     features: [
//       { text: "10 free campaign posts", ok: true },
//       { text: "100 tokens/month", ok: true },
//       { text: "10 tokens per campaign post", ok: true },
//       { text: "Basic influencer view", ok: true },
//       { text: "In-app chat", ok: true },
//       { text: "Direct contact unlock", ok: false },
//       { text: "Advanced filters", ok: false },
//       { text: "Influencer shortlist tool", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Priority campaign visibility", ok: false },
//     ],
//     cta: "Current Plan",
//     ctaDisabled: true,
//   },
//   {
//     id: "pro",
//     name: "Pro",
//     price: "₹999",
//     period: "/month",
//     badge: "Popular",
//     tokens: 500,
//     features: [
//       { text: "30 campaign posts/month", ok: true },
//       { text: "500 tokens/month", ok: true },
//       { text: "Advanced filters", ok: true },
//       { text: "Direct chat unlock", ok: true },
//       { text: "Influencer shortlist tool", ok: true },
//       { text: "Campaign analytics", ok: true },
//       { text: "Escrow payment protection", ok: true },
//       { text: "Priority support", ok: false },
//       { text: "AI recommended creators", ok: false },
//       { text: "Unlimited campaigns", ok: false },
//     ],
//     cta: "Upgrade to Pro",
//     ctaDisabled: false,
//   },
//   {
//     id: "pro_plus",
//     name: "Pro+",
//     price: "₹1,999",
//     period: "/month",
//     badge: "Best Value",
//     tokens: 1000,
//     features: [
//       { text: "Unlimited campaigns", ok: true },
//       { text: "1000 tokens/month", ok: true },
//       { text: "Influencer analytics", ok: true },
//       { text: "AI recommended creators", ok: true },
//       { text: "Priority campaign visibility", ok: true },
//       { text: "Featured campaign slot", ok: true },
//       { text: "Escrow + dispute protection", ok: true },
//       { text: "Dedicated account manager", ok: true },
//       { text: "Contract management", ok: true },
//       { text: "Early access to creators", ok: true },
//     ],
//     cta: "Upgrade to Pro+",
//     ctaDisabled: false,
//   },
// ];

// const tokenPacks = [
//   { tokens: 100, price: 99, bonus: 0, label: "Starter" },
//   { tokens: 500, price: 399, bonus: 50, label: "Popular" },
//   { tokens: 1000, price: 699, bonus: 150, label: "Best Value" },
// ];

// const tokenUseCases = {
//   creator: [
//     { action: "Apply to a campaign", cost: "10 tokens" },
//     { action: "Profile boost (7 days)", cost: "50 tokens" },
//     { action: "Verified badge (one-time)", cost: "100 tokens" },
//     { action: "Priority listing (30 days)", cost: "200 tokens" },
//   ],
//   brand: [
//     { action: "Post a campaign", cost: "10 tokens" },
//     { action: "Unlock influencer contact", cost: "20 tokens" },
//     { action: "Featured campaign (7 days)", cost: "100 tokens" },
//     { action: "AI creator recommendations", cost: "50 tokens" },
//   ],
// };

// const escrowSteps = [
//   { step: "1", icon: "📋", title: "Create Campaign", desc: "Brand posts a campaign and sets the budget. Example: ₹10,000" },
//   { step: "2", icon: "💰", title: "Escrow Deposit", desc: "Brand deposits ₹10,000 on the platform. The money is securely locked until work is approved." },
//   { step: "3", icon: "🤝", title: "Creator Accepts", desc: "Creator accepts the campaign and starts working on the deliverables." },
//   { step: "4", icon: "📸", title: "Submit Work", desc: "Creator submits proof of work: reel link, post link, story screenshot." },
//   { step: "5", icon: "✅", title: "Brand Approves", desc: "Brand reviews the submitted work and clicks approve." },
//   { step: "6", icon: "🎉", title: "Payment Released", desc: "Platform releases payment instantly. Creator: ₹9,000 | Platform commission: ₹1,000 (10%)" },
// ];

// const platformFeatures = [
//   { icon: "🔒", title: "Contact Info Hidden", desc: "Until a deal is confirmed, creator's phone, email, WhatsApp, and Instagram are hidden. Communication stays inside the app only.", tag: "Privacy", tagColor: "#4f46e5" },
//   { icon: "🚨", title: "Keyword Detection", desc: 'If anyone types "WhatsApp", "phone number", "DM me", or similar in chat, the platform shows an instant warning. All communication stays on-platform.', tag: "Safety", tagColor: "#ef4444" },
//   { icon: "📄", title: "Campaign Contracts", desc: "Both brand and creator sign an agreement — deliverables, timeline, and payment terms are all legally documented before work begins.", tag: "Legal", tagColor: "#16a34a" },
//   { icon: "📦", title: "Deliverables Tracking", desc: "A campaign is not marked complete until the creator uploads proof (reel/post/story) and the brand approves the submission.", tag: "Tracking", tagColor: "#d97706" },
//   { icon: "🏆", title: "Reward System", desc: "Complete deals on-platform and earn extra tokens, profile boost, and better search ranking. Staying on-platform always pays more.", tag: "Rewards", tagColor: "#7c3aed" },
//   { icon: "🤖", title: "AI Smart Matching", desc: "Our AI suggests the best creators for each campaign based on niche, follower count, location, and past performance.", tag: "AI", tagColor: "#0891b2" },
// ];

// export default function UpgradePage() {
//   const router = useRouter();
//   const [role, setRole] = useState<Role>("creator");
//   const [tab, setTab] = useState<Tab>("plans");
//   const [selectedPack, setSelectedPack] = useState<number | null>(null);

//   // User state
//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState<string>("");
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan] = useState<string | null>(null);

//   // Payment state
//   const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

//   // Toast
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // Load user from localStorage on mount
//   useEffect(() => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     setToken(t);
//     if (parsed.isSubscribed) setIsSubscribed(true);
//     if (parsed.activePlan) setActivePlan(parsed.activePlan);

//     // Detect role for default tab
//     if (parsed.role?.toLowerCase() === "brand") setRole("brand");
//     else setRole("creator");
//   }, []);

//   // ─── STEP 1: Call backend to create Razorpay subscription ───
//   const handleSubscribe = async (planId: string, planName: string) => {
//     if (!user) {
//       showToast("Please login first.", "error");
//       return;
//     }
//     if (!token) {
//       showToast("Session expired. Please login again.", "error");
//       return;
//     }

//     setLoadingPlanId(planId);

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

//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed to create subscription. Try again.", "error");
//         setLoadingPlanId(null);
//         return;
//       }

//       // STEP 2: Open Razorpay popup with subscription id
//       openRazorpay(data.subscription.id, planId, planName);

//     } catch (err) {
//       console.error("Subscribe error:", err);
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlanId(null);
//     }
//   };

//   // ─── STEP 2: Open Razorpay checkout popup ───
//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan — Monthly Subscription`,
//       theme: { color: "#4f46e5" },
//       prefill: {
//         name: user?.name || "",
//         email: user?.email || "",
//         contact: user?.phone || "",
//       },
//       handler: async function (response: any) {
//         // STEP 3: Payment success → verify on backend
//         await verifyAndActivate(response, planId, planName);
//       },
//       modal: {
//         ondismiss: () => {
//           showToast("Payment cancelled.", "error");
//           setLoadingPlanId(null);
//         },
//       },
//     };

//     const rzp = new (window as any).Razorpay(options);

//     rzp.on("payment.failed", (resp: any) => {
//       showToast(`Payment failed: ${resp.error?.description || "Unknown error"}`, "error");
//       setLoadingPlanId(null);
//     });

//     rzp.open();
//   };

//   // ─── STEP 3: Verify payment signature + activate subscription ───
//   const verifyAndActivate = async (
//     response: {
//       razorpay_payment_id: string;
//       razorpay_subscription_id: string;
//       razorpay_signature: string;
//     },
//     planId: string,
//     planName: string
//   ) => {
//     try {
//       // First try to verify signature
//       const verifyRes = await fetch(`${API}/subscription/verify`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           razorpay_payment_id: response.razorpay_payment_id,
//           razorpay_subscription_id: response.razorpay_subscription_id,
//           razorpay_signature: response.razorpay_signature,
//           plan_id: PLAN_ID,
//           planId,
//           planName,
//         }),
//       });

//       const verifyData = await verifyRes.json();

//       if (verifyData.success) {
//         await activateSubscription(planId, planName);
//       } else {
//         // Verify failed — try manual activate as fallback
//         console.warn("Verify failed, trying manual activate...");
//         await activateSubscription(planId, planName);
//       }
//     } catch (err) {
//       console.error("Verify error:", err);
//       // Fallback to activate
//       await activateSubscription(planId, planName);
//     }
//   };

//   // ─── STEP 4: Call activate API + update localStorage ───
//   const activateSubscription = async (planId: string, planName: string) => {
//     try {
//       const res = await fetch(`${API}/subscription/activate`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           plan_id: PLAN_ID,
//           planId,
//           planName,
//         }),
//       });

//       const data = await res.json();

//       if (data.success) {
//         // Update localStorage
//         const stored = localStorage.getItem("cb_user");
//         const parsed = stored ? JSON.parse(stored) : {};
//         const updated = {
//           ...parsed,
//           isSubscribed: true,
//           activePlan: planId,
//           activePlanName: planName,
//         };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);
//         setIsSubscribed(true);
//         setActivePlan(planId);
//         showToast(`🎉 ${planName} plan activated successfully!`, "success");
//       } else {
//         showToast(data.message || "Activation failed. Contact support.", "error");
//       }
//     } catch (err) {
//       console.error("Activate error:", err);
//       showToast("Activation failed. Please contact support.", "error");
//     } finally {
//       setLoadingPlanId(null);
//     }
//   };

//   const plans = role === "creator" ? creatorPlans : brandPlans;

//   return (
//     <>
//       {/* Load Razorpay SDK */}
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

//         .up{font-family:'Plus Jakarta Sans',sans-serif;background:#0a0a0f;min-height:100vh;color:#fff;overflow-x:hidden}

//         /* TOAST */
//         .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.3);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
//         .up-toast.success{background:#16a34a;color:#fff}
//         .up-toast.error{background:#ef4444;color:#fff}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         /* ACTIVE PLAN BANNER */
//         .up-active-banner{max-width:960px;margin:0 auto 0;padding:0 40px}
//         @media(max-width:600px){.up-active-banner{padding:0 16px}}
//         .up-active-inner{background:linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.05));border:1px solid rgba(16,185,129,0.3);border-radius:16px;padding:16px 22px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .up-active-left{display:flex;align-items:center;gap:12px}
//         .up-active-title{font-size:15px;font-weight:700;color:#34d399}
//         .up-active-sub{font-size:13px;color:rgba(52,211,153,0.7);margin-top:2px}
//         .up-active-badge{background:#10b981;color:#fff;font-size:12px;font-weight:700;padding:5px 14px;border-radius:100px}

//         /* HERO */
//         .up-hero{position:relative;padding:60px 40px 0;text-align:center;background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(79,70,229,0.35) 0%,transparent 70%)}
//         @media(max-width:600px){.up-hero{padding:40px 16px 0}}
//         .up-hero-label{display:inline-flex;align-items:center;gap:8px;background:rgba(79,70,229,0.15);border:1px solid rgba(79,70,229,0.3);border-radius:100px;padding:6px 16px;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:20px}
//         .up-hero-title{font-size:clamp(26px,5vw,50px);font-weight:900;line-height:1.1;margin-bottom:16px;background:linear-gradient(135deg,#fff 30%,#a5b4fc 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
//         .up-hero-sub{font-size:16px;color:rgba(255,255,255,0.5);max-width:520px;margin:0 auto 36px;line-height:1.6}

//         .up-role{display:inline-flex;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:14px;padding:4px;margin-bottom:40px;gap:4px}
//         .up-role-btn{padding:10px 28px;border-radius:10px;border:none;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;background:transparent;color:rgba(255,255,255,0.45)}
//         .up-role-btn.active{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}

//         .up-tabs{display:flex;gap:0;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 40px;overflow-x:auto;scrollbar-width:none}
//         @media(max-width:600px){.up-tabs{padding:0 16px}}
//         .up-tabs::-webkit-scrollbar{display:none}
//         .up-tab{padding:14px 22px;border:none;background:transparent;color:rgba(255,255,255,0.4);font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border-bottom:2px solid transparent;white-space:nowrap;margin-bottom:-1px}
//         .up-tab.active{color:#a5b4fc;border-bottom-color:#4f46e5}
//         .up-tab:hover:not(.active){color:rgba(255,255,255,0.7)}

//         .up-content{padding:40px 40px 80px}
//         @media(max-width:600px){.up-content{padding:24px 16px 60px}}

//         /* Plans */
//         .plans-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;max-width:960px;margin:0 auto}
//         .plan-card{border-radius:20px;padding:28px;position:relative;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);transition:all 0.3s}
//         .plan-card.featured{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08);transform:scale(1.02)}
//         .plan-card.active-plan{border-color:rgba(16,185,129,0.5) !important;background:rgba(16,185,129,0.06) !important}
//         .plan-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.06)}
//         .plan-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap}
//         .plan-badge.best{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .plan-active-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:100px;white-space:nowrap}
//         .plan-name{font-size:14px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px}
//         .plan-price{font-size:38px;font-weight:900;color:#fff;margin-bottom:4px}
//         .plan-price span{font-size:16px;font-weight:500;color:rgba(255,255,255,0.4)}
//         .plan-tokens{display:inline-flex;align-items:center;gap:6px;background:rgba(255,193,7,0.1);border:1px solid rgba(255,193,7,0.2);border-radius:100px;padding:4px 12px;font-size:12px;font-weight:700;color:#fbbf24;margin-bottom:20px}
//         .plan-divider{border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0 0 18px}
//         .plan-features{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:24px}
//         .plan-feature{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:rgba(255,255,255,0.65);line-height:1.4}
//         .plan-feature-icon{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;margin-top:1px}
//         .plan-feature-icon.ok{background:rgba(16,185,129,0.15);color:#10b981}
//         .plan-feature-icon.no{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2)}

//         /* CTA Buttons */
//         .plan-cta{width:100%;padding:14px;border-radius:12px;font-size:14px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.25s;display:flex;align-items:center;justify-content:center;gap:8px}
//         .plan-cta.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 20px rgba(79,70,229,0.4)}
//         .plan-cta.primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 28px rgba(79,70,229,0.55)}
//         .plan-cta.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.35);cursor:default}
//         .plan-cta.pro-plus{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;box-shadow:0 4px 20px rgba(124,58,237,0.4)}
//         .plan-cta.pro-plus:hover:not(:disabled){transform:translateY(-2px)}
//         .plan-cta.active{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.3);cursor:default}
//         .plan-cta:disabled{opacity:0.6;cursor:not-allowed;transform:none !important}

//         /* Spinner */
//         .spin{width:15px;height:15px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spinning 0.7s linear infinite;flex-shrink:0}
//         @keyframes spinning{to{transform:rotate(360deg)}}

//         /* Tokens */
//         .token-hero{text-align:center;margin-bottom:40px}
//         .token-hero-title{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
//         .token-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:500px;margin:0 auto}
//         .token-cols{display:grid;grid-template-columns:1fr 1fr;gap:32px;max-width:900px;margin:0 auto 48px}
//         @media(max-width:700px){.token-cols{grid-template-columns:1fr}}
//         .token-uses-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:16px}
//         .token-uses-list{display:flex;flex-direction:column;gap:10px}
//         .token-use-row{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px}
//         .token-use-action{font-size:13px;color:rgba(255,255,255,0.7)}
//         .token-use-cost{font-size:12px;font-weight:800;background:rgba(251,191,36,0.12);color:#fbbf24;padding:3px 10px;border-radius:100px;border:1px solid rgba(251,191,36,0.2)}
//         .token-packs-title{font-size:20px;font-weight:900;color:#fff;text-align:center;margin-bottom:20px}
//         .token-packs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:760px;margin:0 auto}
//         .token-pack{border-radius:16px;padding:24px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;text-align:center}
//         .token-pack.selected{border-color:#4f46e5;background:rgba(79,70,229,0.12)}
//         .token-pack:hover{border-color:rgba(79,70,229,0.4)}
//         .token-pack-label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#a5b4fc;margin-bottom:10px}
//         .token-pack-amount{font-size:36px;font-weight:900;color:#fff;margin-bottom:2px}
//         .token-pack-bonus{font-size:12px;color:#10b981;font-weight:700;margin-bottom:12px;min-height:18px}
//         .token-pack-price{font-size:22px;font-weight:900;color:#fbbf24}
//         .token-pack-buy{margin-top:16px;width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;font-size:13px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s}
//         .token-pack-buy:hover{transform:translateY(-1px)}

//         /* Escrow */
//         .escrow-hero{text-align:center;margin-bottom:40px}
//         .escrow-hero-title{font-size:28px;font-weight:900;color:#fff;margin-bottom:8px}
//         .escrow-hero-sub{font-size:15px;color:rgba(255,255,255,0.5);max-width:540px;margin:0 auto}
//         .escrow-steps{display:flex;flex-direction:column;gap:16px;max-width:640px;margin:0 auto 48px}
//         .escrow-step{display:flex;align-items:flex-start;gap:16px;padding:20px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;transition:all 0.2s}
//         .escrow-step:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05)}
//         .escrow-step-num{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
//         .escrow-step-title{font-size:15px;font-weight:800;color:#fff;margin-bottom:4px}
//         .escrow-step-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.5}
//         .escrow-breakdown{max-width:640px;margin:0 auto;background:rgba(79,70,229,0.08);border:1px solid rgba(79,70,229,0.2);border-radius:20px;padding:28px}
//         .escrow-breakdown-title{font-size:16px;font-weight:800;color:#a5b4fc;margin-bottom:20px;text-align:center}
//         .escrow-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
//         .escrow-row:last-child{border-bottom:none}
//         .escrow-row-label{font-size:14px;color:rgba(255,255,255,0.6)}
//         .escrow-row-val{font-size:16px;font-weight:800}
//         .escrow-row-val.brand{color:#f87171}
//         .escrow-row-val.platform{color:#fbbf24}
//         .escrow-row-val.creator{color:#34d399}
//         .escrow-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:100px;padding:8px 18px;color:#34d399;font-size:13px;font-weight:700;margin-top:20px;width:100%;justify-content:center}

//         /* Features */
//         .features-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;max-width:960px;margin:0 auto}
//         .feat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:20px;padding:24px;transition:all 0.25s}
//         .feat-card:hover{border-color:rgba(79,70,229,0.3);background:rgba(79,70,229,0.05);transform:translateY(-2px)}
//         .feat-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
//         .feat-icon{font-size:28px}
//         .feat-tag{font-size:11px;font-weight:700;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.06);letter-spacing:0.05em}
//         .feat-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:8px}
//         .feat-desc{font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6}

//         .section-title{font-size:22px;font-weight:900;color:#fff;text-align:center;margin-bottom:6px}
//         .section-sub{font-size:14px;color:rgba(255,255,255,0.4);text-align:center;margin-bottom:32px}

//         /* Bottom CTA */
//         .up-bottom{background:radial-gradient(ellipse 70% 60% at 50% 100%,rgba(79,70,229,0.3) 0%,transparent 70%);padding:60px 40px;text-align:center}
//         .up-bottom-title{font-size:clamp(22px,4vw,38px);font-weight:900;color:#fff;margin-bottom:12px}
//         .up-bottom-sub{font-size:15px;color:rgba(255,255,255,0.5);margin-bottom:28px}
//         .up-bottom-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
//         .up-bottom-btn{padding:14px 32px;border-radius:14px;font-size:15px;font-weight:800;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .up-bottom-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 24px rgba(79,70,229,0.4)}
//         .up-bottom-btn.primary:hover{transform:translateY(-2px)}
//         .up-bottom-btn.secondary{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}
//         .up-bottom-btn.secondary:hover{background:rgba(255,255,255,0.1)}

//         .up-secure{font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:5px}
//       `}</style>

//       {/* Toast Notification */}
//       {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="up">

//         {/* Active Plan Banner */}
//         {isSubscribed && (
//           <div className="up-active-banner" style={{ paddingTop: 20 }}>
//             <div className="up-active-inner">
//               <div className="up-active-left">
//                 <span style={{ fontSize: 28 }}>🎉</span>
//                 <div>
//                   <div className="up-active-title">Your plan is active!</div>
//                   <div className="up-active-sub">You have full access to all premium features.</div>
//                 </div>
//               </div>
//               <span className="up-active-badge">✓ {activePlan?.replace("_", " ").toUpperCase() || "Pro"} Active</span>
//             </div>
//           </div>
//         )}

//         {/* HERO */}
//         <div className="up-hero">
//           <div className="up-hero-label">✦ CreatorBridge Platform</div>
//           <h1 className="up-hero-title">
//             Close deals on platform,<br />security is guaranteed
//           </h1>
//           <p className="up-hero-sub">
//             Escrow payments, verified creators, smart contracts — all in one platform.
//             Safer and more reliable than direct deals.
//           </p>

//           <div className="up-role">
//             <button className={`up-role-btn ${role === "creator" ? "active" : ""}`} onClick={() => setRole("creator")}>
//               🎨 Creator Plans
//             </button>
//             <button className={`up-role-btn ${role === "brand" ? "active" : ""}`} onClick={() => setRole("brand")}>
//               🏢 Brand Plans
//             </button>
//           </div>
//         </div>

//         {/* TABS */}
//         <div className="up-tabs">
//           {(["plans", "tokens", "escrow", "features"] as Tab[]).map((t) => (
//             <button key={t} className={`up-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
//               {t === "plans" && "💎 Plans"}
//               {t === "tokens" && "🪙 Tokens"}
//               {t === "escrow" && "🔐 Escrow"}
//               {t === "features" && "⚡ Features"}
//             </button>
//           ))}
//         </div>

//         <div className="up-content">

//           {/* PLANS TAB */}
//           {tab === "plans" && (
//             <>
//               <div className="section-title">{role === "creator" ? "Creator" : "Brand"} Plans</div>
//               <div className="section-sub">
//                 {role === "creator"
//                   ? "Start free, upgrade when you're ready to grow your creator career"
//                   : "The right tools to find the best creators and run successful campaigns"}
//               </div>
//               <div className="plans-grid">
//                 {plans.map((plan, i) => {
//                   const isThisActive = isSubscribed && activePlan === plan.id;
//                   const isLoading = loadingPlanId === plan.id;

//                   return (
//                     <div
//                       key={plan.id}
//                       className={`plan-card ${i === 1 && !isThisActive ? "featured" : ""} ${isThisActive ? "active-plan" : ""}`}
//                     >
//                       {isThisActive
//                         ? <div className="plan-active-badge">✓ Your Current Plana</div>
//                         : plan.badge
//                           ? <div className={`plan-badge ${i === 2 ? "best" : ""}`}>{plan.badge}</div>
//                           : null
//                       }

//                       <div style={{ marginTop: plan.badge || isThisActive ? 20 : 0 }}>
//                         <div className="plan-name">{plan.name}</div>
//                         <div className="plan-price">{plan.price}<span>{plan.period}</span></div>
//                         <div className="plan-tokens">🪙 {plan.tokens} tokens/month</div>
//                         <hr className="plan-divider" />
//                         <ul className="plan-features">
//                           {plan.features.map((f, fi) => (
//                             <li key={fi} className="plan-feature">
//                               <span className={`plan-feature-icon ${f.ok ? "ok" : "no"}`}>
//                                 {f.ok ? "✓" : "✕"}
//                               </span>
//                               {f.text}
//                             </li>
//                           ))}
//                         </ul>

//                         {/* CTA Button */}
//                         {isThisActive ? (
//                           <button className="plan-cta active" disabled>✓ Active Plan</button>
//                         ) : plan.ctaDisabled ? (
//                           <button className="plan-cta secondary" disabled>{plan.cta}</button>
//                         ) : (
//                           <>
//                             <button
//                               className={`plan-cta ${i === 2 ? "pro-plus" : "primary"}`}
//                               disabled={loadingPlanId !== null}
//                               onClick={() => handleSubscribe(plan.id, plan.name)}
//                             >
//                               {isLoading && <span className="spin" />}
//                               {isLoading ? "Processing..." : plan.cta}
//                             </button>
//                             <div className="up-secure">🔒 Secured by Razorpay</div>
//                           </>
//                         )}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             </>
//           )}

//           {/* TOKENS TAB */}
//           {tab === "tokens" && (
//             <>
//               <div className="token-hero">
//                 <div className="token-hero-title">🪙 Token Economy</div>
//                 <div className="token-hero-sub">Use tokens to apply to campaigns, post opportunities, and unlock creator contacts.</div>
//               </div>
//               <div className="token-cols">
//                 <div>
//                   <div className="token-uses-title">🎨 Creator — Token Uses</div>
//                   <div className="token-uses-list">
//                     {tokenUseCases.creator.map((u, i) => (
//                       <div key={i} className="token-use-row">
//                         <span className="token-use-action">{u.action}</span>
//                         <span className="token-use-cost">{u.cost}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//                 <div>
//                   <div className="token-uses-title">🏢 Brand — Token Uses</div>
//                   <div className="token-uses-list">
//                     {tokenUseCases.brand.map((u, i) => (
//                       <div key={i} className="token-use-row">
//                         <span className="token-use-action">{u.action}</span>
//                         <span className="token-use-cost">{u.cost}</span>
//                       </div>
//                     ))}
//                   </div>
//                 </div>
//               </div>
//               <div className="token-packs-title">Purchase Extra Tokens</div>
//               <div className="token-packs">
//                 {tokenPacks.map((pack, i) => (
//                   <div
//                     key={i}
//                     className={`token-pack ${selectedPack === i ? "selected" : ""}`}
//                     onClick={() => setSelectedPack(i)}
//                   >
//                     <div className="token-pack-label">{pack.label}</div>
//                     <div className="token-pack-amount">{pack.tokens.toLocaleString()}</div>
//                     <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>tokens</div>
//                     <div className="token-pack-bonus">{pack.bonus > 0 ? `+${pack.bonus} bonus tokens!` : " "}</div>
//                     <div className="token-pack-price">₹{pack.price}</div>
//                     <button className="token-pack-buy">Buy Now</button>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//           {/* ESCROW TAB */}
//           {tab === "escrow" && (
//             <>
//               <div className="escrow-hero">
//                 <div className="escrow-hero-title">🔐 Escrow Payment System</div>
//                 <div className="escrow-hero-sub">
//                   Brand's money is held securely. Creator completes the work, brand approves, and payment is released instantly. 100% safe.
//                 </div>
//               </div>
//               <div className="escrow-steps">
//                 {escrowSteps.map((s) => (
//                   <div key={s.step} className="escrow-step">
//                     <div className="escrow-step-num">{s.icon}</div>
//                     <div>
//                       <div className="escrow-step-title">Step {s.step}: {s.title}</div>
//                       <div className="escrow-step-desc">{s.desc}</div>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="escrow-breakdown">
//                 <div className="escrow-breakdown-title">💰 Payment Breakdown Example</div>
//                 <div className="escrow-row"><span className="escrow-row-label">Brand deposits</span><span className="escrow-row-val brand">₹10,000</span></div>
//                 <div className="escrow-row"><span className="escrow-row-label">Platform commission (10%)</span><span className="escrow-row-val platform">₹1,000</span></div>
//                 <div className="escrow-row"><span className="escrow-row-label">Creator receives</span><span className="escrow-row-val creator">₹9,000</span></div>
//                 <div className="escrow-row"><span className="escrow-row-label">Dispute protection</span><span className="escrow-row-val" style={{ color: "#a5b4fc" }}>✅ Included</span></div>
//                 <div className="escrow-badge">🔒 Payment is released only after brand approval</div>
//               </div>
//             </>
//           )}

//           {/* FEATURES TAB */}
//           {tab === "features" && (
//             <>
//               <div className="section-title">Platform Features</div>
//               <div className="section-sub">Features that ensure every deal stays safely on the platform</div>
//               <div className="features-grid">
//                 {platformFeatures.map((f, i) => (
//                   <div key={i} className="feat-card">
//                     <div className="feat-top">
//                       <span className="feat-icon">{f.icon}</span>
//                       <span className="feat-tag" style={{ color: f.tagColor }}>{f.tag}</span>
//                     </div>
//                     <div className="feat-title">{f.title}</div>
//                     <div className="feat-desc">{f.desc}</div>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//         </div>

//         {/* BOTTOM CTA */}
//         <div className="up-bottom">
//           <div className="up-bottom-title">Dealing on-platform is<br />always the smarter choice</div>
//           <div className="up-bottom-sub">Escrow protection · Verified creators · Smart contracts · Dispute resolution</div>
//           <div className="up-bottom-btns">
//             <button className="up-bottom-btn primary" onClick={() => setTab("plans")}>✦ View Plans</button>
//             <button className="up-bottom-btn secondary" onClick={() => router.push("/browse")}>Browse Creators →</button>
//           </div>
//         </div>

//       </div>
//     </>
//   );
// }


