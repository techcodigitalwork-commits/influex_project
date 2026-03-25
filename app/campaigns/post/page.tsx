"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API          = "https://api.collabzy.in/api/campaigns";
const API_BASE     = "https://api.collabzy.in/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// ── Plan limits ──────────────────────────────────────────────────
const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
  free:         { label: "Free",  campaigns: 2,          price: "₹0",     tokens: 200  },
  pro:          { label: "Pro",   campaigns: 10,         price: "₹599",   tokens: 1000 },
  pro_plus:     { label: "Pro+",  campaigns: 25,         price: "₹1,099", tokens: 2500 },
  pro_year:     { label: "Pro",   campaigns: 120,        price: "₹6,499", tokens: 12000 },
  pro_plus_year:{ label: "Pro+",  campaigns: 250,        price: "₹11,999",tokens: 25000 },
};

// City is free text input now
const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
const ROLE_OPTIONS     = ["influencers"];

// ── Helper: get canonical plan id ───────────────────────────────
const toCanonical = (s: string): string => {
  if (!s) return "free";
  const v = s.toLowerCase().trim();
  if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
  if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
  if (v === "proyear" || v === "pro_year") return "pro_year";
  if (v === "pro") return "pro";
  return "free";
};

const getPlanInfo = (activePlan: string | null, isSubscribed: boolean) => {
  if (!isSubscribed || !activePlan) return PLAN_LIMITS["free"];
  return PLAN_LIMITS[toCanonical(activePlan)] ?? PLAN_LIMITS["free"];
};

export default function PostCampaignPage() {
  const router = useRouter();

  const [user, setUser]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);

  // Plan state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activePlan, setActivePlan]     = useState<string | null>(null);
  const [usedCampaigns, setUsedCampaigns] = useState(0);

  // Modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "", description: "", budget: "", city: "",
    categories: [] as string[], roles: [] as string[],
  });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

    setUser(parsed);
    const subscribed = parsed.isSubscribed ?? false;
    const plan       = parsed.activePlan ?? null;
    setIsSubscribed(subscribed);
    setActivePlan(plan);

    // Fetch how many campaigns brand has posted this month
    const token = parsed.token || localStorage.getItem("token");
    if (token) fetchUsedCampaigns(token);

    setChecking(false);
  }, []);

  const fetchUsedCampaigns = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const text = await res.text();
      if (text.startsWith("<!")) return;
      const data = JSON.parse(text);
      const list: any[] = data.data || data.campaigns || [];

      // Count campaigns AFTER plan activation date (not calendar month)
      // This ensures upgrading gives fresh limit, not deducting old campaigns
      const raw       = localStorage.getItem("cb_user");
      const parsed    = raw ? JSON.parse(raw) : {};
      const planStart = parsed.planActivatedAt
        ? new Date(parsed.planActivatedAt)
        : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

      const sinceActivation = list.filter((c: any) => {
        const d = new Date(c.createdAt || c.created_at || 0);
        return d >= planStart;
      });
      setUsedCampaigns(sinceActivation.length);
    } catch {
      // silently fail
    }
  };

  const toggleChip = (field: "categories" | "roles", value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }));
  };

  // ── Derived plan info ─────────────────────────────────────────
  const planInfo    = getPlanInfo(activePlan, isSubscribed);
  const limit       = planInfo.campaigns;
  const remaining   = Math.max(0, limit - usedCampaigns);
  const isAtLimit   = remaining === 0;
  const usagePercent = Math.min(100, (usedCampaigns / limit) * 100);
  const isLow       = remaining <= 2 && remaining > 0;
  const barColor    = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isAtLimit) { setShowUpgradeModal(true); return; }
    if (!formData.title || !formData.description || !formData.budget || !formData.city) {
      showToast("Please fill all required fields.", "error"); return;
    }
    if (formData.roles.length === 0) { showToast("Select at least one target role.", "error"); return; }

    try {
      setLoading(true);
      const token = user.token || localStorage.getItem("token");
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title:       formData.title.trim(),
          description: formData.description.trim(),
          budget:      Number(formData.budget),
          city:        formData.city,
          categories:  formData.categories,
          roles:       formData.roles,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) { setShowUpgradeModal(true); setLoading(false); return; }
        throw new Error(data.message || "Failed to create campaign.");
      }

      setUsedCampaigns(prev => prev + 1);
      showToast("Campaign created successfully! 🚀", "success");
      setTimeout(() => router.push("/campaigns"), 1200);
    } catch (err: any) {
      showToast(err.message || "Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Razorpay ──────────────────────────────────────────────────
  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    const options = {
      key: RAZORPAY_KEY,
      subscription_id: subscriptionId,
      name: "Influex Premium",
      description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: parsed?.name || "", email: parsed?.email || "" },
      handler: async (response: any) => {
        try {
          await fetch(`${API_BASE}/subscription/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:       response.razorpay_signature,
              plan_id: PLAN_ID, planName,
            }),
          });
        } catch {}
        const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
        });
        const aData = await aRes.json();
        if (aData.success) {
          const canonical = toCanonical(planId);
          const updated   = { ...parsed, isSubscribed: true, activePlan: canonical };
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setUser(updated);
          setIsSubscribed(true);
          setActivePlan(canonical);
          setShowUpgradeModal(false);
          showToast(`🎉 ${planName} activated! You can now post more campaigns.`, "success");
        } else {
          showToast("Activation failed. Please contact support.", "error");
        }
        setLoadingPlan(null);
      },
      modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", (r: any) => {
      showToast(`Payment failed: ${r.error.description}`, "error");
      setLoadingPlan(null);
    });
    rzp.open();
  };

  const handleSubscribe = async (planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const t      = parsed.token || localStorage.getItem("token");
    if (!t) { showToast("Session expired. Please login again.", "error"); return; }
    setLoadingPlan(planId);
    try {
      const res  = await fetch(`${API_BASE}/subscription/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ plan_id: PLAN_ID }),
      });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) {
        showToast(data.message || "Failed to create subscription.", "error");
        setLoadingPlan(null);
        return;
      }
      openRazorpay(data.subscription.id, planId, planName);
    } catch {
      showToast("Something went wrong. Please try again.", "error");
      setLoadingPlan(null);
    }
  };

  if (checking) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return null;

  // ── Upgrade modal plan cards ──────────────────────────────────
  const upgradePlans = [
    { id: "pro",      name: "Pro",  price: "₹599/mo",  originalPrice: "₹1,000", campaigns: 10,  tokens: 1000,  popular: true  },
    { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", campaigns: 25, tokens: 2500,  popular: false },
  ];

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

        .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
        @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
        .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
        @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
        .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
        .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}

        /* ── Plan usage bar ── */
        .pcp-plan-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;cursor:default;transition:border-color 0.2s}
        .pcp-plan-bar.warn{background:#fffbeb;border-color:#fde68a}
        .pcp-plan-bar.full{background:#fff5f5;border-color:#fecaca;cursor:pointer}
        .pcp-plan-bar.paid{background:#f0fdf4;border-color:#86efac}
        .pcp-plan-icon{font-size:24px;flex-shrink:0}
        .pcp-plan-info{flex:1;min-width:0}
        .pcp-plan-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .pcp-plan-name{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
        .pcp-plan-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#4f46e5;color:#fff}
        .pcp-plan-badge.pro-badge{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
        .pcp-plan-badge.proplus-badge{background:linear-gradient(135deg,#7c3aed,#ec4899)}
        .pcp-plan-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
        .pcp-plan-fill{height:100%;border-radius:100px;transition:width 0.5s}
        .pcp-plan-count{font-size:12px;font-weight:500}
        .pcp-upgrade-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
        .pcp-upgrade-btn.normal{color:#4f46e5;background:#eef2ff}
        .pcp-upgrade-btn.normal:hover{background:#e0e7ff}
        .pcp-upgrade-btn.warn-btn{color:#d97706;background:#fef3c7}
        .pcp-upgrade-btn.danger-btn{color:#dc2626;background:#fee2e2}

        /* ── Form ── */
        .pcp-form{display:flex;flex-direction:column;gap:0}
        .pcp-section{margin-bottom:28px}
        .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
        .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
        .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
        .pcp-label{font-size:13px;font-weight:600;color:#374151}
        .pcp-label .req{color:#ef4444;margin-left:2px}
        .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
        .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
        .pcp-input::placeholder{color:#9ca3af}
        .pcp-textarea{resize:none;line-height:1.6}
        .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 14px center;outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s}
        .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
        .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
        .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
        .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
        .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
        .pcp-limit-note{display:flex;align-items:center;gap:6px;border-radius:10px;padding:10px 14px;font-size:13px;margin-top:4px;background:#fafafa;border:1px solid #f0f0f0;color:#888}
        .pcp-limit-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
        .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
        .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
        .pcp-btn-cancel:hover{background:#e5e7eb}
        .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
        .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
        .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}

        /* ── Blocked state ── */
        .pcp-blocked{text-align:center;padding:52px 24px}
        .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
        .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
        .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
        .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}

        /* ── Upgrade modal ── */
        .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
        .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
        .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
        .up-modal-close:hover{background:rgba(255,255,255,0.12);color:#fff}
        .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
        .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
        .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}

        /* current plan info pill */
        .up-current-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
        .up-current-label{font-size:12px;color:rgba(255,255,255,0.4)}
        .up-current-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
        .up-current-used{font-size:12px;color:#f87171;font-weight:600}

        /* plan cards in modal */
        .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
        .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
        .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
        .up-plan-card.popular-card{border-color:rgba(79,70,229,0.4);background:rgba(79,70,229,0.07)}
        .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;letter-spacing:0.05em;white-space:nowrap}
        .up-plan-left{}
        .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
        .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
        .up-plan-right{text-align:right;flex-shrink:0}
        .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
        .up-plan-price{font-size:17px;font-weight:800;color:#fff}

        .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
        .up-plan-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(79,70,229,0.45)}
        .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
        .up-modal-skip:hover{color:rgba(255,255,255,0.5)}
        .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}

        .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}

        /* ── Toast ── */
        .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
        .pcp-toast.success{background:#111;color:#fff}
        .pcp-toast.error{background:#ef4444;color:#fff}
      `}</style>

      {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

      {/* ── UPGRADE MODAL ─────────────────────────────────────── */}
      {showUpgradeModal && (() => {
        const [selectedPlan, setSelectedPlan] = useState<string>("pro");
        const selected = upgradePlans.find(p => p.id === selectedPlan)!;
        return (
          <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
            <div className="up-modal" onClick={e => e.stopPropagation()}>
              <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
              <div className="up-modal-icon">🚀</div>
              <div className="up-modal-title">Campaign Limit Reached</div>
              <div className="up-modal-sub">
                You've used all {limit} campaigns on your <strong style={{color:"#fff"}}>{planInfo.label}</strong> plan this month.<br/>
                Upgrade to post more campaigns.
              </div>

              {/* Current plan usage */}
              <div className="up-current-pill">
                <div>
                  <div className="up-current-label">Current Plan</div>
                  <div className="up-current-val">{planInfo.label} — {limit} campaigns/month</div>
                </div>
                <div className="up-current-used">{usedCampaigns}/{limit} used</div>
              </div>

              {/* Plan cards */}
              <div className="up-plan-cards">
                {upgradePlans.map(plan => (
                  <div
                    key={plan.id}
                    className={`up-plan-card ${plan.popular ? "popular-card" : ""} ${selectedPlan === plan.id ? "popular-card" : ""}`}
                    onClick={() => setSelectedPlan(plan.id)}
                    style={selectedPlan === plan.id ? {borderColor:"rgba(79,70,229,0.7)",background:"rgba(79,70,229,0.12)"} : {}}
                  >
                    {plan.popular && <div className="up-popular-tag">POPULAR</div>}
                    <div className="up-plan-left">
                      <div className="up-plan-name">{plan.name}</div>
                      <div className="up-plan-desc">
                        {plan.campaigns} campaigns/month · {plan.tokens.toLocaleString("en-IN")} tokens
                      </div>
                    </div>
                    <div className="up-plan-right">
                      <div className="up-plan-og">{plan.originalPrice}</div>
                      <div className="up-plan-price">{plan.price}</div>
                    </div>
                    {/* Radio dot */}
                    <div style={{
                      width:18,height:18,borderRadius:"50%",border:`2px solid ${selectedPlan===plan.id?"#4f46e5":"rgba(255,255,255,0.2)"}`,
                      background:selectedPlan===plan.id?"#4f46e5":"transparent",
                      display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
                    }}>
                      {selectedPlan===plan.id && <div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
                    </div>
                  </div>
                ))}
              </div>

              <button
                className="up-plan-btn"
                disabled={loadingPlan !== null}
                onClick={() => handleSubscribe(selected.id, selected.name)}
              >
                {loadingPlan === selected.id
                  ? <><span className="mini-spin" /> Processing...</>
                  : `Upgrade to ${selected.name} — ${selected.price}`
                }
              </button>
              <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
              <div className="up-secure">🔒 Secured by Razorpay</div>
            </div>
          </div>
        );
      })()}

      <div className="pcp">
        <div className="pcp-inner">
          <div className="pcp-card">
            <h1 className="pcp-title">Create Campaign</h1>
            <p className="pcp-sub">Find the right creators for your brand</p>

            {/* ── PLAN USAGE BAR ── */}
            <div
              className={`pcp-plan-bar ${isAtLimit ? "full" : isLow ? "warn" : isSubscribed ? "paid" : ""}`}
              onClick={() => isAtLimit && setShowUpgradeModal(true)}
            >
              <div className="pcp-plan-icon">
                {isSubscribed ? "⭐" : "🎯"}
              </div>
              <div className="pcp-plan-info">
                <div className="pcp-plan-top">
                  <span className="pcp-plan-name">
                    {isSubscribed ? planInfo.label + " Plan" : "Free Plan"}
                  </span>
                  {isSubscribed && (
                    <span className={`pcp-plan-badge ${activePlan?.includes("plus") ? "proplus-badge" : "pro-badge"}`}>
                      {planInfo.label}
                    </span>
                  )}
                </div>
                <div className="pcp-plan-track">
                  <div className="pcp-plan-fill" style={{ width: `${usagePercent}%`, background: barColor }} />
                </div>
                <div className="pcp-plan-count" style={{ color: barColor }}>
                  {isAtLimit
                    ? `⚠️ Limit reached — ${usedCampaigns}/${limit} campaigns used this month`
                    : isLow
                    ? `⚡ Only ${remaining} campaign${remaining === 1 ? "" : "s"} left this month (${usedCampaigns}/${limit} used)`
                    : `${remaining} campaign${remaining === 1 ? "" : "s"} remaining this month (${usedCampaigns}/${limit} used)`
                  }
                </div>
              </div>
              {!isAtLimit && (
                <button
                  className={`pcp-upgrade-btn ${isLow ? "warn-btn" : "normal"}`}
                  onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
                >
                  {isSubscribed ? "Change Plan" : "Upgrade ✦"}
                </button>
              )}
              {isAtLimit && (
                <button
                  className="pcp-upgrade-btn danger-btn"
                  onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
                >
                  Upgrade!
                </button>
              )}
            </div>

            {/* ── BLOCKED STATE ── */}
            {isAtLimit ? (
              <div className="pcp-blocked">
                <div className="pcp-blocked-icon">🚫</div>
                <h2 className="pcp-blocked-title">Monthly Limit Reached</h2>
                <p className="pcp-blocked-sub">
                  You've used all <strong>{limit} campaigns</strong> on your <strong>{planInfo.label}</strong> plan this month.<br />
                  Upgrade your plan to post more campaigns.
                </p>
                <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>
                  ⚡ Upgrade Plan →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pcp-form">
                <div className="pcp-section">
                  <div className="pcp-section-label">Campaign Info</div>
                  <div className="pcp-field">
                    <label className="pcp-label">Title <span className="req">*</span></label>
                    <input
                      className="pcp-input" type="text"
                      placeholder="e.g. Summer Fashion Shoot"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="pcp-field">
                    <label className="pcp-label">Description <span className="req">*</span></label>
                    <textarea
                      className="pcp-input pcp-textarea" rows={4}
                      placeholder="Describe your campaign requirements..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>
                  <div className="pcp-row">
                    <div className="pcp-field">
                      <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
                      <input
                        className="pcp-input" type="number" min={0}
                        placeholder="e.g. 5000"
                        value={formData.budget}
                        onChange={e => setFormData({ ...formData, budget: e.target.value })}
                        required
                      />
                    </div>
                    <div className="pcp-field">
                      <label className="pcp-label">City <span className="req">*</span></label>
                      <input className="pcp-input" type="text" placeholder="e.g. Indore, Mumbai, Delhi..." value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} required />
                    </div>
                  </div>
                  <div className={`pcp-limit-note ${isLow ? "warn-note" : ""}`}>
                    📋 You have <strong>{remaining} campaign{remaining === 1 ? "" : "s"}</strong> remaining on your <strong>{planInfo.label}</strong> plan this month.
                    {isLow && " Consider upgrading soon."}
                  </div>
                </div>

                <div className="pcp-section">
                  <div className="pcp-section-label">Targeting</div>
                  <div className="pcp-field">
                    <label className="pcp-label">Categories</label>
                    <div className="pcp-chips">
                      {CATEGORY_OPTIONS.map(cat => (
                        <button
                          key={cat} type="button"
                          className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
                          onClick={() => toggleChip("categories", cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pcp-field" style={{ marginBottom: 0 }}>
                    <label className="pcp-label">Target Roles <span className="req">*</span></label>
                    <div className="pcp-chips">
                      {ROLE_OPTIONS.map(r => (
                        <button
                          key={r} type="button"
                          className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`}
                          onClick={() => toggleChip("roles", r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pcp-actions">
                  <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>
                    Cancel
                  </button>
                  <button type="submit" className="pcp-btn-submit" disabled={loading}>
                    {loading
                      ? <><span className="pcp-spinner" /> Creating...</>
                      : "Create Campaign 🚀"
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}




// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API          = "http://api.collabzy.in/api/campaigns";
// const API_BASE     = "http://api.collabzy.in/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
//   free:         { label: "Free",  campaigns: 2,   price: "₹0",      tokens: 200   },
//   pro:          { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
//   pro_plus:     { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
//   pro_year:     { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
//   pro_plus_year:{ label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
// };

// const CITY_OPTIONS     = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS     = ["influencers"];

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const getPlanInfo = (activePlan: string | null, isSubscribed: boolean) => {
//   if (!isSubscribed || !activePlan) return PLAN_LIMITS["free"];
//   return PLAN_LIMITS[toCanonical(activePlan)] ?? PLAN_LIMITS["free"];
// };

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]         = useState<any>(null);
//   const [loading, setLoading]   = useState(false);
//   const [checking, setChecking] = useState(true);

//   const [isSubscribed, setIsSubscribed]   = useState(false);
//   const [activePlan, setActivePlan]       = useState<string | null>(null);
//   const [usedCampaigns, setUsedCampaigns] = useState(0);

//   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);
//   const [selectedPlan, setSelectedPlan]         = useState<string>("pro");

//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

//     setUser(parsed);
//     const subscribed = parsed.isSubscribed ?? false;
//     const plan       = parsed.activePlan ?? null;
//     setIsSubscribed(subscribed);
//     setActivePlan(plan);

//     const token = parsed.token || localStorage.getItem("token");
//     if (token) fetchUsedCampaigns(token);

//     setChecking(false);
//   }, []);

//   const fetchUsedCampaigns = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.data || data.campaigns || [];

//       const raw    = localStorage.getItem("cb_user");
//       const parsed = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke campaigns count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((c: any) => {
//         const d = new Date(c.createdAt || c.created_at || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setUsedCampaigns(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   const planInfo     = getPlanInfo(activePlan, isSubscribed);
//   const limit        = planInfo.campaigns;
//   const remaining    = Math.max(0, limit - usedCampaigns);
//   const isAtLimit    = remaining === 0;
//   const usagePercent = Math.min(100, (usedCampaigns / limit) * 100);
//   const isLow        = remaining <= 2 && remaining > 0;
//   const barColor     = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (isAtLimit) { setShowUpgradeModal(true); return; }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields.", "error"); return;
//     }
//     if (formData.roles.length === 0) { showToast("Select at least one target role.", "error"); return; }

//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title:       formData.title.trim(),
//           description: formData.description.trim(),
//           budget:      Number(formData.budget),
//           city:        formData.city,
//           categories:  formData.categories,
//           roles:       formData.roles,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         if (res.status === 403) { setShowUpgradeModal(true); setLoading(false); return; }
//         throw new Error(data.message || "Failed to create campaign.");
//       }

//       setUsedCampaigns(prev => prev + 1);
//       showToast("Campaign created successfully! 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong.", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token  = parsed.token || localStorage.getItem("token");
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async (response: any) => {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//         } catch {}
//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();
//         if (aData.success) {
//           const canonical = toCanonical(planId);
//           // ✅ planActivatedAt bhi set karo
//           const updated = {
//             ...parsed,
//             isSubscribed: true,
//             activePlan: canonical,
//             planActivatedAt: new Date().toISOString(),
//           };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//           setIsSubscribed(true);
//           setActivePlan(canonical);
//           setUsedCampaigns(0); // ✅ reset on upgrade
//           setShowUpgradeModal(false);
//           showToast(`🎉 ${planName} activated! You can now post more campaigns.`, "success");
//         } else {
//           showToast("Activation failed. Please contact support.", "error");
//         }
//         setLoadingPlan(null);
//       },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const t      = parsed.token || localStorage.getItem("token");
//     if (!t) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API_BASE}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
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
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

//   const upgradePlans = [
//     { id: "pro",      name: "Pro",  price: "₹599/mo",  originalPrice: "₹1,000", campaigns: 10, tokens: 1000,  popular: true  },
//     { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", campaigns: 25, tokens: 2500, popular: false },
//   ];
//   const selected = upgradePlans.find(p => p.id === selectedPlan)!;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
//         *,*::before,*::after{box-sizing:border-box}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
//         @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
//         .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
//         @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
//         .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
//         .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}
//         .pcp-plan-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;cursor:default;transition:border-color 0.2s}
//         .pcp-plan-bar.warn{background:#fffbeb;border-color:#fde68a}
//         .pcp-plan-bar.full{background:#fff5f5;border-color:#fecaca;cursor:pointer}
//         .pcp-plan-bar.paid{background:#f0fdf4;border-color:#86efac}
//         .pcp-plan-icon{font-size:24px;flex-shrink:0}
//         .pcp-plan-info{flex:1;min-width:0}
//         .pcp-plan-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
//         .pcp-plan-name{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
//         .pcp-plan-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#4f46e5;color:#fff}
//         .pcp-plan-badge.pro-badge{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
//         .pcp-plan-badge.proplus-badge{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .pcp-plan-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .pcp-plan-fill{height:100%;border-radius:100px;transition:width 0.5s}
//         .pcp-plan-count{font-size:12px;font-weight:500}
//         .pcp-upgrade-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
//         .pcp-upgrade-btn.normal{color:#4f46e5;background:#eef2ff}
//         .pcp-upgrade-btn.normal:hover{background:#e0e7ff}
//         .pcp-upgrade-btn.warn-btn{color:#d97706;background:#fef3c7}
//         .pcp-upgrade-btn.danger-btn{color:#dc2626;background:#fee2e2}
//         .pcp-form{display:flex;flex-direction:column;gap:0}
//         .pcp-section{margin-bottom:28px}
//         .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
//         .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
//         .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
//         .pcp-label{font-size:13px;font-weight:600;color:#374151}
//         .pcp-label .req{color:#ef4444;margin-left:2px}
//         .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
//         .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-input::placeholder{color:#9ca3af}
//         .pcp-textarea{resize:none;line-height:1.6}
//         .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 14px center;outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s}
//         .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
//         .pcp-limit-note{display:flex;align-items:center;gap:6px;border-radius:10px;padding:10px 14px;font-size:13px;margin-top:4px;background:#fafafa;border:1px solid #f0f0f0;color:#888}
//         .pcp-limit-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
//         .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
//         .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
//         .pcp-btn-cancel:hover{background:#e5e7eb}
//         .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
//         .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
//         .pcp-blocked{text-align:center;padding:52px 24px}
//         .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
//         .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
//         .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
//         .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}
//         .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
//         .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
//         .up-modal-close:hover{background:rgba(255,255,255,0.12);color:#fff}
//         .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
//         .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
//         .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}
//         .up-current-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
//         .up-current-label{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-current-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
//         .up-current-used{font-size:12px;color:#f87171;font-weight:600}
//         .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
//         .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
//         .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
//         .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;letter-spacing:0.05em;white-space:nowrap}
//         .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
//         .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
//         .up-plan-price{font-size:17px;font-weight:800;color:#fff}
//         .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
//         .up-plan-btn:hover:not(:disabled){transform:translateY(-1px)}
//         .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
//         .up-modal-skip:hover{color:rgba(255,255,255,0.5)}
//         .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}
//         .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
//         .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
//         .pcp-toast.success{background:#111;color:#fff}
//         .pcp-toast.error{background:#ef4444;color:#fff}
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* UPGRADE MODAL */}
//       {showUpgradeModal && (
//         <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
//           <div className="up-modal" onClick={e => e.stopPropagation()}>
//             <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
//             <div className="up-modal-icon">🚀</div>
//             <div className="up-modal-title">Campaign Limit Reached</div>
//             <div className="up-modal-sub">
//               You've used all {limit} campaigns on your <strong style={{color:"#fff"}}>{planInfo.label}</strong> plan.<br/>
//               Upgrade to post more campaigns.
//             </div>
//             <div className="up-current-pill">
//               <div>
//                 <div className="up-current-label">Current Plan</div>
//                 <div className="up-current-val">{planInfo.label} — {limit} campaigns/month</div>
//               </div>
//               <div className="up-current-used">{usedCampaigns}/{limit} used</div>
//             </div>
//             <div className="up-plan-cards">
//               {upgradePlans.map(plan => (
//                 <div
//                   key={plan.id}
//                   className="up-plan-card"
//                   onClick={() => setSelectedPlan(plan.id)}
//                   style={selectedPlan === plan.id ? {borderColor:"rgba(79,70,229,0.7)",background:"rgba(79,70,229,0.12)"} : {}}
//                 >
//                   {plan.popular && <div className="up-popular-tag">POPULAR</div>}
//                   <div>
//                     <div className="up-plan-name">{plan.name}</div>
//                     <div className="up-plan-desc">{plan.campaigns} campaigns/month · {plan.tokens.toLocaleString("en-IN")} tokens</div>
//                   </div>
//                   <div style={{textAlign:"right",flexShrink:0}}>
//                     <div className="up-plan-og">{plan.originalPrice}</div>
//                     <div className="up-plan-price">{plan.price}</div>
//                   </div>
//                   <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${selectedPlan===plan.id?"#4f46e5":"rgba(255,255,255,0.2)"}`,background:selectedPlan===plan.id?"#4f46e5":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
//                     {selectedPlan===plan.id && <div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <button className="up-plan-btn" disabled={loadingPlan !== null} onClick={() => handleSubscribe(selected.id, selected.name)}>
//               {loadingPlan === selected.id ? <><span className="mini-spin"/> Processing...</> : `Upgrade to ${selected.name} — ${selected.price}`}
//             </button>
//             <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
//             <div className="up-secure">🔒 Secured by Razorpay</div>
//           </div>
//         </div>
//       )}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             <div className={`pcp-plan-bar ${isAtLimit ? "full" : isLow ? "warn" : isSubscribed ? "paid" : ""}`} onClick={() => isAtLimit && setShowUpgradeModal(true)}>
//               <div className="pcp-plan-icon">{isSubscribed ? "⭐" : "🎯"}</div>
//               <div className="pcp-plan-info">
//                 <div className="pcp-plan-top">
//                   <span className="pcp-plan-name">{isSubscribed ? planInfo.label + " Plan" : "Free Plan"}</span>
//                   {isSubscribed && <span className={`pcp-plan-badge ${activePlan?.includes("plus") ? "proplus-badge" : "pro-badge"}`}>{planInfo.label}</span>}
//                 </div>
//                 <div className="pcp-plan-track">
//                   <div className="pcp-plan-fill" style={{ width: `${usagePercent}%`, background: barColor }} />
//                 </div>
//                 <div className="pcp-plan-count" style={{ color: barColor }}>
//                   {isAtLimit
//                     ? `⚠️ Limit reached — ${usedCampaigns}/${limit} campaigns used`
//                     : isLow
//                     ? `⚡ Only ${remaining} campaign${remaining===1?"":"s"} left (${usedCampaigns}/${limit} used)`
//                     : `${remaining} campaign${remaining===1?"":"s"} remaining (${usedCampaigns}/${limit} used)`}
//                 </div>
//               </div>
//               {!isAtLimit
//                 ? <button className={`pcp-upgrade-btn ${isLow ? "warn-btn" : "normal"}`} onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}>{isSubscribed ? "Change Plan" : "Upgrade ✦"}</button>
//                 : <button className="pcp-upgrade-btn danger-btn" onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}>Upgrade!</button>}
//             </div>

//             {isAtLimit ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Monthly Limit Reached</h2>
//                 <p className="pcp-blocked-sub">You've used all <strong>{limit} campaigns</strong> on your <strong>{planInfo.label}</strong> plan.<br/>Upgrade to post more campaigns.</p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>⚡ Upgrade Plan →</button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea className="pcp-input pcp-textarea" rows={4} placeholder="Describe your campaign requirements..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
//                   </div>
//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} required />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <select className="pcp-select" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required>
//                         <option value="">Select City</option>
//                         {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
//                       </select>
//                     </div>
//                   </div>
//                   <div className={`pcp-limit-note ${isLow ? "warn-note" : ""}`}>
//                     📋 You have <strong>{remaining} campaign{remaining===1?"":"s"}</strong> remaining on your <strong>{planInfo.label}</strong> plan.
//                     {isLow && " Consider upgrading soon."}
//                   </div>
//                 </div>
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button key={cat} type="button" className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`} onClick={() => toggleChip("categories", cat)}>{cat}</button>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="pcp-field" style={{marginBottom:0}}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button key={r} type="button" className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`} onClick={() => toggleChip("roles", r)}>{r}</button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading ? <><span className="pcp-spinner"/> Creating...</> : "Create Campaign 🚀"}
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API          = "https://54.252.201.93:5000/api/campaigns";
// const API_BASE     = "https://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// // ── Plan limits ──────────────────────────────────────────────────
// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
//   free:         { label: "Free",  campaigns: 2,          price: "₹0",     tokens: 200  },
//   pro:          { label: "Pro",   campaigns: 10,         price: "₹599",   tokens: 1000 },
//   pro_plus:     { label: "Pro+",  campaigns: 25,         price: "₹1,099", tokens: 2500 },
//   pro_year:     { label: "Pro",   campaigns: 120,        price: "₹6,499", tokens: 12000 },
//   pro_plus_year:{ label: "Pro+",  campaigns: 250,        price: "₹11,999",tokens: 25000 },
// };

// // City is free text input now
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS     = ["influencers"];

// // ── Helper: get canonical plan id ───────────────────────────────
// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const getPlanInfo = (activePlan: string | null, isSubscribed: boolean) => {
//   if (!isSubscribed || !activePlan) return PLAN_LIMITS["free"];
//   return PLAN_LIMITS[toCanonical(activePlan)] ?? PLAN_LIMITS["free"];
// };

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]         = useState<any>(null);
//   const [loading, setLoading]   = useState(false);
//   const [checking, setChecking] = useState(true);

//   // Plan state
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string | null>(null);
//   const [usedCampaigns, setUsedCampaigns] = useState(0);

//   // Modal
//   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);

//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

//     setUser(parsed);
//     const subscribed = parsed.isSubscribed ?? false;
//     const plan       = parsed.activePlan ?? null;
//     setIsSubscribed(subscribed);
//     setActivePlan(plan);

//     // Fetch how many campaigns brand has posted this month
//     const token = parsed.token || localStorage.getItem("token");
//     if (token) fetchUsedCampaigns(token);

//     setChecking(false);
//   }, []);

//   const fetchUsedCampaigns = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.data || data.campaigns || [];

//       // Count campaigns AFTER plan activation date (not calendar month)
//       // This ensures upgrading gives fresh limit, not deducting old campaigns
//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((c: any) => {
//         const d = new Date(c.createdAt || c.created_at || 0);
//         return d >= planStart;
//       });
//       setUsedCampaigns(sinceActivation.length);
//     } catch {
//       // silently fail
//     }
//   };

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   // ── Derived plan info ─────────────────────────────────────────
//   const planInfo    = getPlanInfo(activePlan, isSubscribed);
//   const limit       = planInfo.campaigns;
//   const remaining   = Math.max(0, limit - usedCampaigns);
//   const isAtLimit   = remaining === 0;
//   const usagePercent = Math.min(100, (usedCampaigns / limit) * 100);
//   const isLow       = remaining <= 2 && remaining > 0;
//   const barColor    = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";

//   // ── Submit ────────────────────────────────────────────────────
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (isAtLimit) { setShowUpgradeModal(true); return; }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields.", "error"); return;
//     }
//     if (formData.roles.length === 0) { showToast("Select at least one target role.", "error"); return; }

//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title:       formData.title.trim(),
//           description: formData.description.trim(),
//           budget:      Number(formData.budget),
//           city:        formData.city,
//           categories:  formData.categories,
//           roles:       formData.roles,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         if (res.status === 403) { setShowUpgradeModal(true); setLoading(false); return; }
//         throw new Error(data.message || "Failed to create campaign.");
//       }

//       setUsedCampaigns(prev => prev + 1);
//       showToast("Campaign created successfully! 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong.", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Razorpay ──────────────────────────────────────────────────
//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token  = parsed.token || localStorage.getItem("token");
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async (response: any) => {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//         } catch {}
//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();
//         if (aData.success) {
//           const canonical = toCanonical(planId);
//           const updated   = { ...parsed, isSubscribed: true, activePlan: canonical };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//           setIsSubscribed(true);
//           setActivePlan(canonical);
//           setShowUpgradeModal(false);
//           showToast(`🎉 ${planName} activated! You can now post more campaigns.`, "success");
//         } else {
//           showToast("Activation failed. Please contact support.", "error");
//         }
//         setLoadingPlan(null);
//       },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const t      = parsed.token || localStorage.getItem("token");
//     if (!t) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API_BASE}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
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
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

//   // ── Upgrade modal plan cards ──────────────────────────────────
//   const upgradePlans = [
//     { id: "pro",      name: "Pro",  price: "₹599/mo",  originalPrice: "₹1,000", campaigns: 10,  tokens: 1000,  popular: true  },
//     { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", campaigns: 25, tokens: 2500,  popular: false },
//   ];

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
//         *,*::before,*::after{box-sizing:border-box}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
//         @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
//         .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
//         @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
//         .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
//         .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}

//         /* ── Plan usage bar ── */
//         .pcp-plan-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;cursor:default;transition:border-color 0.2s}
//         .pcp-plan-bar.warn{background:#fffbeb;border-color:#fde68a}
//         .pcp-plan-bar.full{background:#fff5f5;border-color:#fecaca;cursor:pointer}
//         .pcp-plan-bar.paid{background:#f0fdf4;border-color:#86efac}
//         .pcp-plan-icon{font-size:24px;flex-shrink:0}
//         .pcp-plan-info{flex:1;min-width:0}
//         .pcp-plan-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
//         .pcp-plan-name{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
//         .pcp-plan-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#4f46e5;color:#fff}
//         .pcp-plan-badge.pro-badge{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
//         .pcp-plan-badge.proplus-badge{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .pcp-plan-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .pcp-plan-fill{height:100%;border-radius:100px;transition:width 0.5s}
//         .pcp-plan-count{font-size:12px;font-weight:500}
//         .pcp-upgrade-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
//         .pcp-upgrade-btn.normal{color:#4f46e5;background:#eef2ff}
//         .pcp-upgrade-btn.normal:hover{background:#e0e7ff}
//         .pcp-upgrade-btn.warn-btn{color:#d97706;background:#fef3c7}
//         .pcp-upgrade-btn.danger-btn{color:#dc2626;background:#fee2e2}

//         /* ── Form ── */
//         .pcp-form{display:flex;flex-direction:column;gap:0}
//         .pcp-section{margin-bottom:28px}
//         .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
//         .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
//         .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
//         .pcp-label{font-size:13px;font-weight:600;color:#374151}
//         .pcp-label .req{color:#ef4444;margin-left:2px}
//         .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
//         .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-input::placeholder{color:#9ca3af}
//         .pcp-textarea{resize:none;line-height:1.6}
//         .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 14px center;outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s}
//         .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
//         .pcp-limit-note{display:flex;align-items:center;gap:6px;border-radius:10px;padding:10px 14px;font-size:13px;margin-top:4px;background:#fafafa;border:1px solid #f0f0f0;color:#888}
//         .pcp-limit-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
//         .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
//         .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
//         .pcp-btn-cancel:hover{background:#e5e7eb}
//         .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
//         .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}

//         /* ── Blocked state ── */
//         .pcp-blocked{text-align:center;padding:52px 24px}
//         .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
//         .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
//         .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
//         .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}

//         /* ── Upgrade modal ── */
//         .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
//         .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
//         .up-modal-close:hover{background:rgba(255,255,255,0.12);color:#fff}
//         .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
//         .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
//         .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}

//         /* current plan info pill */
//         .up-current-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
//         .up-current-label{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-current-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
//         .up-current-used{font-size:12px;color:#f87171;font-weight:600}

//         /* plan cards in modal */
//         .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
//         .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
//         .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
//         .up-plan-card.popular-card{border-color:rgba(79,70,229,0.4);background:rgba(79,70,229,0.07)}
//         .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;letter-spacing:0.05em;white-space:nowrap}
//         .up-plan-left{}
//         .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
//         .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-plan-right{text-align:right;flex-shrink:0}
//         .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
//         .up-plan-price{font-size:17px;font-weight:800;color:#fff}

//         .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
//         .up-plan-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(79,70,229,0.45)}
//         .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
//         .up-modal-skip:hover{color:rgba(255,255,255,0.5)}
//         .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}

//         .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}

//         /* ── Toast ── */
//         .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
//         .pcp-toast.success{background:#111;color:#fff}
//         .pcp-toast.error{background:#ef4444;color:#fff}
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* ── UPGRADE MODAL ─────────────────────────────────────── */}
//       {showUpgradeModal && (() => {
//         const [selectedPlan, setSelectedPlan] = useState<string>("pro");
//         const selected = upgradePlans.find(p => p.id === selectedPlan)!;
//         return (
//           <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
//             <div className="up-modal" onClick={e => e.stopPropagation()}>
//               <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
//               <div className="up-modal-icon">🚀</div>
//               <div className="up-modal-title">Campaign Limit Reached</div>
//               <div className="up-modal-sub">
//                 You've used all {limit} campaigns on your <strong style={{color:"#fff"}}>{planInfo.label}</strong> plan this month.<br/>
//                 Upgrade to post more campaigns.
//               </div>

//               {/* Current plan usage */}
//               <div className="up-current-pill">
//                 <div>
//                   <div className="up-current-label">Current Plan</div>
//                   <div className="up-current-val">{planInfo.label} — {limit} campaigns/month</div>
//                 </div>
//                 <div className="up-current-used">{usedCampaigns}/{limit} used</div>
//               </div>

//               {/* Plan cards */}
//               <div className="up-plan-cards">
//                 {upgradePlans.map(plan => (
//                   <div
//                     key={plan.id}
//                     className={`up-plan-card ${plan.popular ? "popular-card" : ""} ${selectedPlan === plan.id ? "popular-card" : ""}`}
//                     onClick={() => setSelectedPlan(plan.id)}
//                     style={selectedPlan === plan.id ? {borderColor:"rgba(79,70,229,0.7)",background:"rgba(79,70,229,0.12)"} : {}}
//                   >
//                     {plan.popular && <div className="up-popular-tag">POPULAR</div>}
//                     <div className="up-plan-left">
//                       <div className="up-plan-name">{plan.name}</div>
//                       <div className="up-plan-desc">
//                         {plan.campaigns} campaigns/month · {plan.tokens.toLocaleString("en-IN")} tokens
//                       </div>
//                     </div>
//                     <div className="up-plan-right">
//                       <div className="up-plan-og">{plan.originalPrice}</div>
//                       <div className="up-plan-price">{plan.price}</div>
//                     </div>
//                     {/* Radio dot */}
//                     <div style={{
//                       width:18,height:18,borderRadius:"50%",border:`2px solid ${selectedPlan===plan.id?"#4f46e5":"rgba(255,255,255,0.2)"}`,
//                       background:selectedPlan===plan.id?"#4f46e5":"transparent",
//                       display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
//                     }}>
//                       {selectedPlan===plan.id && <div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
//                     </div>
//                   </div>
//                 ))}
//               </div>

//               <button
//                 className="up-plan-btn"
//                 disabled={loadingPlan !== null}
//                 onClick={() => handleSubscribe(selected.id, selected.name)}
//               >
//                 {loadingPlan === selected.id
//                   ? <><span className="mini-spin" /> Processing...</>
//                   : `Upgrade to ${selected.name} — ${selected.price}`
//                 }
//               </button>
//               <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
//               <div className="up-secure">🔒 Secured by Razorpay</div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             {/* ── PLAN USAGE BAR ── */}
//             <div
//               className={`pcp-plan-bar ${isAtLimit ? "full" : isLow ? "warn" : isSubscribed ? "paid" : ""}`}
//               onClick={() => isAtLimit && setShowUpgradeModal(true)}
//             >
//               <div className="pcp-plan-icon">
//                 {isSubscribed ? "⭐" : "🎯"}
//               </div>
//               <div className="pcp-plan-info">
//                 <div className="pcp-plan-top">
//                   <span className="pcp-plan-name">
//                     {isSubscribed ? planInfo.label + " Plan" : "Free Plan"}
//                   </span>
//                   {isSubscribed && (
//                     <span className={`pcp-plan-badge ${activePlan?.includes("plus") ? "proplus-badge" : "pro-badge"}`}>
//                       {planInfo.label}
//                     </span>
//                   )}
//                 </div>
//                 <div className="pcp-plan-track">
//                   <div className="pcp-plan-fill" style={{ width: `${usagePercent}%`, background: barColor }} />
//                 </div>
//                 <div className="pcp-plan-count" style={{ color: barColor }}>
//                   {isAtLimit
//                     ? `⚠️ Limit reached — ${usedCampaigns}/${limit} campaigns used this month`
//                     : isLow
//                     ? `⚡ Only ${remaining} campaign${remaining === 1 ? "" : "s"} left this month (${usedCampaigns}/${limit} used)`
//                     : `${remaining} campaign${remaining === 1 ? "" : "s"} remaining this month (${usedCampaigns}/${limit} used)`
//                   }
//                 </div>
//               </div>
//               {!isAtLimit && (
//                 <button
//                   className={`pcp-upgrade-btn ${isLow ? "warn-btn" : "normal"}`}
//                   onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
//                 >
//                   {isSubscribed ? "Change Plan" : "Upgrade ✦"}
//                 </button>
//               )}
//               {isAtLimit && (
//                 <button
//                   className="pcp-upgrade-btn danger-btn"
//                   onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
//                 >
//                   Upgrade!
//                 </button>
//               )}
//             </div>

//             {/* ── BLOCKED STATE ── */}
//             {isAtLimit ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Monthly Limit Reached</h2>
//                 <p className="pcp-blocked-sub">
//                   You've used all <strong>{limit} campaigns</strong> on your <strong>{planInfo.label}</strong> plan this month.<br />
//                   Upgrade your plan to post more campaigns.
//                 </p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>
//                   ⚡ Upgrade Plan →
//                 </button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input
//                       className="pcp-input" type="text"
//                       placeholder="e.g. Summer Fashion Shoot"
//                       value={formData.title}
//                       onChange={e => setFormData({ ...formData, title: e.target.value })}
//                       required
//                     />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea
//                       className="pcp-input pcp-textarea" rows={4}
//                       placeholder="Describe your campaign requirements..."
//                       value={formData.description}
//                       onChange={e => setFormData({ ...formData, description: e.target.value })}
//                       required
//                     />
//                   </div>
//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input
//                         className="pcp-input" type="number" min={0}
//                         placeholder="e.g. 5000"
//                         value={formData.budget}
//                         onChange={e => setFormData({ ...formData, budget: e.target.value })}
//                         required
//                       />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <input className="pcp-input" type="text" placeholder="e.g. Indore, Mumbai, Delhi..." value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} required />
//                     </div>
//                   </div>
//                   <div className={`pcp-limit-note ${isLow ? "warn-note" : ""}`}>
//                     📋 You have <strong>{remaining} campaign{remaining === 1 ? "" : "s"}</strong> remaining on your <strong>{planInfo.label}</strong> plan this month.
//                     {isLow && " Consider upgrading soon."}
//                   </div>
//                 </div>

//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button
//                           key={cat} type="button"
//                           className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
//                           onClick={() => toggleChip("categories", cat)}
//                         >
//                           {cat}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="pcp-field" style={{ marginBottom: 0 }}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button
//                           key={r} type="button"
//                           className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`}
//                           onClick={() => toggleChip("roles", r)}
//                         >
//                           {r}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>
//                     Cancel
//                   </button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading
//                       ? <><span className="pcp-spinner" /> Creating...</>
//                       : "Create Campaign 🚀"
//                     }
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }



// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API          = "http://api.collabzy.in/api/campaigns";
// const API_BASE     = "http://api.collabzy.in/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
//   free:         { label: "Free",  campaigns: 2,   price: "₹0",      tokens: 200   },
//   pro:          { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
//   pro_plus:     { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
//   pro_year:     { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
//   pro_plus_year:{ label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
// };

// const CITY_OPTIONS     = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS     = ["influencers"];

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const getPlanInfo = (activePlan: string | null, isSubscribed: boolean) => {
//   if (!isSubscribed || !activePlan) return PLAN_LIMITS["free"];
//   return PLAN_LIMITS[toCanonical(activePlan)] ?? PLAN_LIMITS["free"];
// };

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]         = useState<any>(null);
//   const [loading, setLoading]   = useState(false);
//   const [checking, setChecking] = useState(true);

//   const [isSubscribed, setIsSubscribed]   = useState(false);
//   const [activePlan, setActivePlan]       = useState<string | null>(null);
//   const [usedCampaigns, setUsedCampaigns] = useState(0);

//   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);
//   const [selectedPlan, setSelectedPlan]         = useState<string>("pro");

//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

//     setUser(parsed);
//     const subscribed = parsed.isSubscribed ?? false;
//     const plan       = parsed.activePlan ?? null;
//     setIsSubscribed(subscribed);
//     setActivePlan(plan);

//     const token = parsed.token || localStorage.getItem("token");
//     if (token) fetchUsedCampaigns(token);

//     setChecking(false);
//   }, []);

//   const fetchUsedCampaigns = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.data || data.campaigns || [];

//       const raw    = localStorage.getItem("cb_user");
//       const parsed = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke campaigns count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((c: any) => {
//         const d = new Date(c.createdAt || c.created_at || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setUsedCampaigns(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   const planInfo     = getPlanInfo(activePlan, isSubscribed);
//   const limit        = planInfo.campaigns;
//   const remaining    = Math.max(0, limit - usedCampaigns);
//   const isAtLimit    = remaining === 0;
//   const usagePercent = Math.min(100, (usedCampaigns / limit) * 100);
//   const isLow        = remaining <= 2 && remaining > 0;
//   const barColor     = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (isAtLimit) { setShowUpgradeModal(true); return; }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields.", "error"); return;
//     }
//     if (formData.roles.length === 0) { showToast("Select at least one target role.", "error"); return; }

//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title:       formData.title.trim(),
//           description: formData.description.trim(),
//           budget:      Number(formData.budget),
//           city:        formData.city,
//           categories:  formData.categories,
//           roles:       formData.roles,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         if (res.status === 403) { setShowUpgradeModal(true); setLoading(false); return; }
//         throw new Error(data.message || "Failed to create campaign.");
//       }

//       setUsedCampaigns(prev => prev + 1);
//       showToast("Campaign created successfully! 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong.", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token  = parsed.token || localStorage.getItem("token");
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async (response: any) => {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//         } catch {}
//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();
//         if (aData.success) {
//           const canonical = toCanonical(planId);
//           // ✅ planActivatedAt bhi set karo
//           const updated = {
//             ...parsed,
//             isSubscribed: true,
//             activePlan: canonical,
//             planActivatedAt: new Date().toISOString(),
//           };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//           setIsSubscribed(true);
//           setActivePlan(canonical);
//           setUsedCampaigns(0); // ✅ reset on upgrade
//           setShowUpgradeModal(false);
//           showToast(`🎉 ${planName} activated! You can now post more campaigns.`, "success");
//         } else {
//           showToast("Activation failed. Please contact support.", "error");
//         }
//         setLoadingPlan(null);
//       },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const t      = parsed.token || localStorage.getItem("token");
//     if (!t) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API_BASE}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
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
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

//   const upgradePlans = [
//     { id: "pro",      name: "Pro",  price: "₹599/mo",  originalPrice: "₹1,000", campaigns: 10, tokens: 1000,  popular: true  },
//     { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", campaigns: 25, tokens: 2500, popular: false },
//   ];
//   const selected = upgradePlans.find(p => p.id === selectedPlan)!;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
//         *,*::before,*::after{box-sizing:border-box}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
//         @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
//         .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
//         @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
//         .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
//         .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}
//         .pcp-plan-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;cursor:default;transition:border-color 0.2s}
//         .pcp-plan-bar.warn{background:#fffbeb;border-color:#fde68a}
//         .pcp-plan-bar.full{background:#fff5f5;border-color:#fecaca;cursor:pointer}
//         .pcp-plan-bar.paid{background:#f0fdf4;border-color:#86efac}
//         .pcp-plan-icon{font-size:24px;flex-shrink:0}
//         .pcp-plan-info{flex:1;min-width:0}
//         .pcp-plan-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
//         .pcp-plan-name{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
//         .pcp-plan-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#4f46e5;color:#fff}
//         .pcp-plan-badge.pro-badge{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
//         .pcp-plan-badge.proplus-badge{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .pcp-plan-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .pcp-plan-fill{height:100%;border-radius:100px;transition:width 0.5s}
//         .pcp-plan-count{font-size:12px;font-weight:500}
//         .pcp-upgrade-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
//         .pcp-upgrade-btn.normal{color:#4f46e5;background:#eef2ff}
//         .pcp-upgrade-btn.normal:hover{background:#e0e7ff}
//         .pcp-upgrade-btn.warn-btn{color:#d97706;background:#fef3c7}
//         .pcp-upgrade-btn.danger-btn{color:#dc2626;background:#fee2e2}
//         .pcp-form{display:flex;flex-direction:column;gap:0}
//         .pcp-section{margin-bottom:28px}
//         .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
//         .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
//         .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
//         .pcp-label{font-size:13px;font-weight:600;color:#374151}
//         .pcp-label .req{color:#ef4444;margin-left:2px}
//         .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
//         .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-input::placeholder{color:#9ca3af}
//         .pcp-textarea{resize:none;line-height:1.6}
//         .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 14px center;outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s}
//         .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
//         .pcp-limit-note{display:flex;align-items:center;gap:6px;border-radius:10px;padding:10px 14px;font-size:13px;margin-top:4px;background:#fafafa;border:1px solid #f0f0f0;color:#888}
//         .pcp-limit-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
//         .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
//         .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
//         .pcp-btn-cancel:hover{background:#e5e7eb}
//         .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
//         .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
//         .pcp-blocked{text-align:center;padding:52px 24px}
//         .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
//         .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
//         .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
//         .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}
//         .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
//         .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
//         .up-modal-close:hover{background:rgba(255,255,255,0.12);color:#fff}
//         .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
//         .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
//         .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}
//         .up-current-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
//         .up-current-label{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-current-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
//         .up-current-used{font-size:12px;color:#f87171;font-weight:600}
//         .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
//         .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
//         .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
//         .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;letter-spacing:0.05em;white-space:nowrap}
//         .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
//         .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
//         .up-plan-price{font-size:17px;font-weight:800;color:#fff}
//         .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
//         .up-plan-btn:hover:not(:disabled){transform:translateY(-1px)}
//         .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
//         .up-modal-skip:hover{color:rgba(255,255,255,0.5)}
//         .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}
//         .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
//         .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
//         .pcp-toast.success{background:#111;color:#fff}
//         .pcp-toast.error{background:#ef4444;color:#fff}
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* UPGRADE MODAL */}
//       {showUpgradeModal && (
//         <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
//           <div className="up-modal" onClick={e => e.stopPropagation()}>
//             <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
//             <div className="up-modal-icon">🚀</div>
//             <div className="up-modal-title">Campaign Limit Reached</div>
//             <div className="up-modal-sub">
//               You've used all {limit} campaigns on your <strong style={{color:"#fff"}}>{planInfo.label}</strong> plan.<br/>
//               Upgrade to post more campaigns.
//             </div>
//             <div className="up-current-pill">
//               <div>
//                 <div className="up-current-label">Current Plan</div>
//                 <div className="up-current-val">{planInfo.label} — {limit} campaigns/month</div>
//               </div>
//               <div className="up-current-used">{usedCampaigns}/{limit} used</div>
//             </div>
//             <div className="up-plan-cards">
//               {upgradePlans.map(plan => (
//                 <div
//                   key={plan.id}
//                   className="up-plan-card"
//                   onClick={() => setSelectedPlan(plan.id)}
//                   style={selectedPlan === plan.id ? {borderColor:"rgba(79,70,229,0.7)",background:"rgba(79,70,229,0.12)"} : {}}
//                 >
//                   {plan.popular && <div className="up-popular-tag">POPULAR</div>}
//                   <div>
//                     <div className="up-plan-name">{plan.name}</div>
//                     <div className="up-plan-desc">{plan.campaigns} campaigns/month · {plan.tokens.toLocaleString("en-IN")} tokens</div>
//                   </div>
//                   <div style={{textAlign:"right",flexShrink:0}}>
//                     <div className="up-plan-og">{plan.originalPrice}</div>
//                     <div className="up-plan-price">{plan.price}</div>
//                   </div>
//                   <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${selectedPlan===plan.id?"#4f46e5":"rgba(255,255,255,0.2)"}`,background:selectedPlan===plan.id?"#4f46e5":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
//                     {selectedPlan===plan.id && <div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <button className="up-plan-btn" disabled={loadingPlan !== null} onClick={() => handleSubscribe(selected.id, selected.name)}>
//               {loadingPlan === selected.id ? <><span className="mini-spin"/> Processing...</> : `Upgrade to ${selected.name} — ${selected.price}`}
//             </button>
//             <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
//             <div className="up-secure">🔒 Secured by Razorpay</div>
//           </div>
//         </div>
//       )}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             <div className={`pcp-plan-bar ${isAtLimit ? "full" : isLow ? "warn" : isSubscribed ? "paid" : ""}`} onClick={() => isAtLimit && setShowUpgradeModal(true)}>
//               <div className="pcp-plan-icon">{isSubscribed ? "⭐" : "🎯"}</div>
//               <div className="pcp-plan-info">
//                 <div className="pcp-plan-top">
//                   <span className="pcp-plan-name">{isSubscribed ? planInfo.label + " Plan" : "Free Plan"}</span>
//                   {isSubscribed && <span className={`pcp-plan-badge ${activePlan?.includes("plus") ? "proplus-badge" : "pro-badge"}`}>{planInfo.label}</span>}
//                 </div>
//                 <div className="pcp-plan-track">
//                   <div className="pcp-plan-fill" style={{ width: `${usagePercent}%`, background: barColor }} />
//                 </div>
//                 <div className="pcp-plan-count" style={{ color: barColor }}>
//                   {isAtLimit
//                     ? `⚠️ Limit reached — ${usedCampaigns}/${limit} campaigns used`
//                     : isLow
//                     ? `⚡ Only ${remaining} campaign${remaining===1?"":"s"} left (${usedCampaigns}/${limit} used)`
//                     : `${remaining} campaign${remaining===1?"":"s"} remaining (${usedCampaigns}/${limit} used)`}
//                 </div>
//               </div>
//               {!isAtLimit
//                 ? <button className={`pcp-upgrade-btn ${isLow ? "warn-btn" : "normal"}`} onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}>{isSubscribed ? "Change Plan" : "Upgrade ✦"}</button>
//                 : <button className="pcp-upgrade-btn danger-btn" onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}>Upgrade!</button>}
//             </div>

//             {isAtLimit ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Monthly Limit Reached</h2>
//                 <p className="pcp-blocked-sub">You've used all <strong>{limit} campaigns</strong> on your <strong>{planInfo.label}</strong> plan.<br/>Upgrade to post more campaigns.</p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>⚡ Upgrade Plan →</button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea className="pcp-input pcp-textarea" rows={4} placeholder="Describe your campaign requirements..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
//                   </div>
//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000" value={formData.budget} onChange={e => setFormData({...formData, budget: e.target.value})} required />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <select className="pcp-select" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} required>
//                         <option value="">Select City</option>
//                         {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
//                       </select>
//                     </div>
//                   </div>
//                   <div className={`pcp-limit-note ${isLow ? "warn-note" : ""}`}>
//                     📋 You have <strong>{remaining} campaign{remaining===1?"":"s"}</strong> remaining on your <strong>{planInfo.label}</strong> plan.
//                     {isLow && " Consider upgrading soon."}
//                   </div>
//                 </div>
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button key={cat} type="button" className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`} onClick={() => toggleChip("categories", cat)}>{cat}</button>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="pcp-field" style={{marginBottom:0}}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button key={r} type="button" className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`} onClick={() => toggleChip("roles", r)}>{r}</button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading ? <><span className="pcp-spinner"/> Creating...</> : "Create Campaign 🚀"}
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API          = "http://54.252.201.93:5000/api/campaigns";
// const API_BASE     = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// // ── Plan limits ──────────────────────────────────────────────────
// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
//   free:         { label: "Free",  campaigns: 2,          price: "₹0",     tokens: 200  },
//   pro:          { label: "Pro",   campaigns: 10,         price: "₹599",   tokens: 1000 },
//   pro_plus:     { label: "Pro+",  campaigns: 25,         price: "₹1,099", tokens: 2500 },
//   pro_year:     { label: "Pro",   campaigns: 120,        price: "₹6,499", tokens: 12000 },
//   pro_plus_year:{ label: "Pro+",  campaigns: 250,        price: "₹11,999",tokens: 25000 },
// };

// const CITY_OPTIONS     = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS     = ["influencers", "brand"];

// // ── Helper: get canonical plan id ───────────────────────────────
// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const getPlanInfo = (activePlan: string | null, isSubscribed: boolean) => {
//   if (!isSubscribed || !activePlan) return PLAN_LIMITS["free"];
//   return PLAN_LIMITS[toCanonical(activePlan)] ?? PLAN_LIMITS["free"];
// };

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]         = useState<any>(null);
//   const [loading, setLoading]   = useState(false);
//   const [checking, setChecking] = useState(true);

//   // Plan state
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string | null>(null);
//   const [usedCampaigns, setUsedCampaigns] = useState(0);

//   // Modal
//   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);

//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

//     setUser(parsed);
//     const subscribed = parsed.isSubscribed ?? false;
//     const plan       = parsed.activePlan ?? null;
//     setIsSubscribed(subscribed);
//     setActivePlan(plan);

//     // Fetch how many campaigns brand has posted this month
//     const token = parsed.token || localStorage.getItem("token");
//     if (token) fetchUsedCampaigns(token);

//     setChecking(false);
//   }, []);

//   const fetchUsedCampaigns = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.data || data.campaigns || [];

//       // Count campaigns AFTER plan activation date (not calendar month)
//       // This ensures upgrading gives fresh limit, not deducting old campaigns
//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((c: any) => {
//         const d = new Date(c.createdAt || c.created_at || 0);
//         return d >= planStart;
//       });
//       setUsedCampaigns(sinceActivation.length);
//     } catch {
//       // silently fail
//     }
//   };

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   // ── Derived plan info ─────────────────────────────────────────
//   const planInfo    = getPlanInfo(activePlan, isSubscribed);
//   const limit       = planInfo.campaigns;
//   const remaining   = Math.max(0, limit - usedCampaigns);
//   const isAtLimit   = remaining === 0;
//   const usagePercent = Math.min(100, (usedCampaigns / limit) * 100);
//   const isLow       = remaining <= 2 && remaining > 0;
//   const barColor    = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";

//   // ── Submit ────────────────────────────────────────────────────
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (isAtLimit) { setShowUpgradeModal(true); return; }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields.", "error"); return;
//     }
//     if (formData.roles.length === 0) { showToast("Select at least one target role.", "error"); return; }

//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title:       formData.title.trim(),
//           description: formData.description.trim(),
//           budget:      Number(formData.budget),
//           city:        formData.city,
//           categories:  formData.categories,
//           roles:       formData.roles,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         if (res.status === 403) { setShowUpgradeModal(true); setLoading(false); return; }
//         throw new Error(data.message || "Failed to create campaign.");
//       }

//       setUsedCampaigns(prev => prev + 1);
//       showToast("Campaign created successfully! 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong.", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Razorpay ──────────────────────────────────────────────────
//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token  = parsed.token || localStorage.getItem("token");
//     const options = {
//       key: RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name: "Influex Premium",
//       description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async (response: any) => {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//         } catch {}
//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();
//         if (aData.success) {
//           const canonical = toCanonical(planId);
//           const updated   = { ...parsed, isSubscribed: true, activePlan: canonical };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//           setIsSubscribed(true);
//           setActivePlan(canonical);
//           setShowUpgradeModal(false);
//           showToast(`🎉 ${planName} activated! You can now post more campaigns.`, "success");
//         } else {
//           showToast("Activation failed. Please contact support.", "error");
//         }
//         setLoadingPlan(null);
//       },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const t      = parsed.token || localStorage.getItem("token");
//     if (!t) { showToast("Session expired. Please login again.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API_BASE}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
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
//       showToast("Something went wrong. Please try again.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

//   // ── Upgrade modal plan cards ──────────────────────────────────
//   const upgradePlans = [
//     { id: "pro",      name: "Pro",  price: "₹599/mo",  originalPrice: "₹1,000", campaigns: 10,  tokens: 1000,  popular: true  },
//     { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", campaigns: 25, tokens: 2500,  popular: false },
//   ];

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
//         *,*::before,*::after{box-sizing:border-box}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{transform:translateY(22px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

//         .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
//         @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
//         .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
//         @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
//         .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
//         .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}

//         /* ── Plan usage bar ── */
//         .pcp-plan-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;cursor:default;transition:border-color 0.2s}
//         .pcp-plan-bar.warn{background:#fffbeb;border-color:#fde68a}
//         .pcp-plan-bar.full{background:#fff5f5;border-color:#fecaca;cursor:pointer}
//         .pcp-plan-bar.paid{background:#f0fdf4;border-color:#86efac}
//         .pcp-plan-icon{font-size:24px;flex-shrink:0}
//         .pcp-plan-info{flex:1;min-width:0}
//         .pcp-plan-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
//         .pcp-plan-name{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
//         .pcp-plan-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#4f46e5;color:#fff}
//         .pcp-plan-badge.pro-badge{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
//         .pcp-plan-badge.proplus-badge{background:linear-gradient(135deg,#7c3aed,#ec4899)}
//         .pcp-plan-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .pcp-plan-fill{height:100%;border-radius:100px;transition:width 0.5s}
//         .pcp-plan-count{font-size:12px;font-weight:500}
//         .pcp-upgrade-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
//         .pcp-upgrade-btn.normal{color:#4f46e5;background:#eef2ff}
//         .pcp-upgrade-btn.normal:hover{background:#e0e7ff}
//         .pcp-upgrade-btn.warn-btn{color:#d97706;background:#fef3c7}
//         .pcp-upgrade-btn.danger-btn{color:#dc2626;background:#fee2e2}

//         /* ── Form ── */
//         .pcp-form{display:flex;flex-direction:column;gap:0}
//         .pcp-section{margin-bottom:28px}
//         .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
//         .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
//         .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
//         .pcp-label{font-size:13px;font-weight:600;color:#374151}
//         .pcp-label .req{color:#ef4444;margin-left:2px}
//         .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
//         .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-input::placeholder{color:#9ca3af}
//         .pcp-textarea{resize:none;line-height:1.6}
//         .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 14px center;outline:none;appearance:none;cursor:pointer;transition:border-color 0.2s}
//         .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
//         .pcp-limit-note{display:flex;align-items:center;gap:6px;border-radius:10px;padding:10px 14px;font-size:13px;margin-top:4px;background:#fafafa;border:1px solid #f0f0f0;color:#888}
//         .pcp-limit-note.warn-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
//         .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
//         .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
//         .pcp-btn-cancel:hover{background:#e5e7eb}
//         .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
//         .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}

//         /* ── Blocked state ── */
//         .pcp-blocked{text-align:center;padding:52px 24px}
//         .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
//         .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
//         .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
//         .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}

//         /* ── Upgrade modal ── */
//         .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
//         .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
//         .up-modal-close:hover{background:rgba(255,255,255,0.12);color:#fff}
//         .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
//         .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
//         .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}

//         /* current plan info pill */
//         .up-current-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
//         .up-current-label{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-current-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
//         .up-current-used{font-size:12px;color:#f87171;font-weight:600}

//         /* plan cards in modal */
//         .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
//         .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
//         .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
//         .up-plan-card.popular-card{border-color:rgba(79,70,229,0.4);background:rgba(79,70,229,0.07)}
//         .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;letter-spacing:0.05em;white-space:nowrap}
//         .up-plan-left{}
//         .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
//         .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-plan-right{text-align:right;flex-shrink:0}
//         .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
//         .up-plan-price{font-size:17px;font-weight:800;color:#fff}

//         .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
//         .up-plan-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 24px rgba(79,70,229,0.45)}
//         .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
//         .up-modal-skip:hover{color:rgba(255,255,255,0.5)}
//         .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}

//         .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}

//         /* ── Toast ── */
//         .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
//         .pcp-toast.success{background:#111;color:#fff}
//         .pcp-toast.error{background:#ef4444;color:#fff}
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* ── UPGRADE MODAL ─────────────────────────────────────── */}
//       {showUpgradeModal && (() => {
//         const [selectedPlan, setSelectedPlan] = useState<string>("pro");
//         const selected = upgradePlans.find(p => p.id === selectedPlan)!;
//         return (
//           <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
//             <div className="up-modal" onClick={e => e.stopPropagation()}>
//               <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
//               <div className="up-modal-icon">🚀</div>
//               <div className="up-modal-title">Campaign Limit Reached</div>
//               <div className="up-modal-sub">
//                 You've used all {limit} campaigns on your <strong style={{color:"#fff"}}>{planInfo.label}</strong> plan this month.<br/>
//                 Upgrade to post more campaigns.
//               </div>

//               {/* Current plan usage */}
//               <div className="up-current-pill">
//                 <div>
//                   <div className="up-current-label">Current Plan</div>
//                   <div className="up-current-val">{planInfo.label} — {limit} campaigns/month</div>
//                 </div>
//                 <div className="up-current-used">{usedCampaigns}/{limit} used</div>
//               </div>

//               {/* Plan cards */}
//               <div className="up-plan-cards">
//                 {upgradePlans.map(plan => (
//                   <div
//                     key={plan.id}
//                     className={`up-plan-card ${plan.popular ? "popular-card" : ""} ${selectedPlan === plan.id ? "popular-card" : ""}`}
//                     onClick={() => setSelectedPlan(plan.id)}
//                     style={selectedPlan === plan.id ? {borderColor:"rgba(79,70,229,0.7)",background:"rgba(79,70,229,0.12)"} : {}}
//                   >
//                     {plan.popular && <div className="up-popular-tag">POPULAR</div>}
//                     <div className="up-plan-left">
//                       <div className="up-plan-name">{plan.name}</div>
//                       <div className="up-plan-desc">
//                         {plan.campaigns} campaigns/month · {plan.tokens.toLocaleString("en-IN")} tokens
//                       </div>
//                     </div>
//                     <div className="up-plan-right">
//                       <div className="up-plan-og">{plan.originalPrice}</div>
//                       <div className="up-plan-price">{plan.price}</div>
//                     </div>
//                     {/* Radio dot */}
//                     <div style={{
//                       width:18,height:18,borderRadius:"50%",border:`2px solid ${selectedPlan===plan.id?"#4f46e5":"rgba(255,255,255,0.2)"}`,
//                       background:selectedPlan===plan.id?"#4f46e5":"transparent",
//                       display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,
//                     }}>
//                       {selectedPlan===plan.id && <div style={{width:7,height:7,borderRadius:"50%",background:"#fff"}}/>}
//                     </div>
//                   </div>
//                 ))}
//               </div>

//               <button
//                 className="up-plan-btn"
//                 disabled={loadingPlan !== null}
//                 onClick={() => handleSubscribe(selected.id, selected.name)}
//               >
//                 {loadingPlan === selected.id
//                   ? <><span className="mini-spin" /> Processing...</>
//                   : `Upgrade to ${selected.name} — ${selected.price}`
//                 }
//               </button>
//               <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
//               <div className="up-secure">🔒 Secured by Razorpay</div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             {/* ── PLAN USAGE BAR ── */}
//             <div
//               className={`pcp-plan-bar ${isAtLimit ? "full" : isLow ? "warn" : isSubscribed ? "paid" : ""}`}
//               onClick={() => isAtLimit && setShowUpgradeModal(true)}
//             >
//               <div className="pcp-plan-icon">
//                 {isSubscribed ? "⭐" : "🎯"}
//               </div>
//               <div className="pcp-plan-info">
//                 <div className="pcp-plan-top">
//                   <span className="pcp-plan-name">
//                     {isSubscribed ? planInfo.label + " Plan" : "Free Plan"}
//                   </span>
//                   {isSubscribed && (
//                     <span className={`pcp-plan-badge ${activePlan?.includes("plus") ? "proplus-badge" : "pro-badge"}`}>
//                       {planInfo.label}
//                     </span>
//                   )}
//                 </div>
//                 <div className="pcp-plan-track">
//                   <div className="pcp-plan-fill" style={{ width: `${usagePercent}%`, background: barColor }} />
//                 </div>
//                 <div className="pcp-plan-count" style={{ color: barColor }}>
//                   {isAtLimit
//                     ? `⚠️ Limit reached — ${usedCampaigns}/${limit} campaigns used this month`
//                     : isLow
//                     ? `⚡ Only ${remaining} campaign${remaining === 1 ? "" : "s"} left this month (${usedCampaigns}/${limit} used)`
//                     : `${remaining} campaign${remaining === 1 ? "" : "s"} remaining this month (${usedCampaigns}/${limit} used)`
//                   }
//                 </div>
//               </div>
//               {!isAtLimit && (
//                 <button
//                   className={`pcp-upgrade-btn ${isLow ? "warn-btn" : "normal"}`}
//                   onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
//                 >
//                   {isSubscribed ? "Change Plan" : "Upgrade ✦"}
//                 </button>
//               )}
//               {isAtLimit && (
//                 <button
//                   className="pcp-upgrade-btn danger-btn"
//                   onClick={e => { e.stopPropagation(); setShowUpgradeModal(true); }}
//                 >
//                   Upgrade!
//                 </button>
//               )}
//             </div>

//             {/* ── BLOCKED STATE ── */}
//             {isAtLimit ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Monthly Limit Reached</h2>
//                 <p className="pcp-blocked-sub">
//                   You've used all <strong>{limit} campaigns</strong> on your <strong>{planInfo.label}</strong> plan this month.<br />
//                   Upgrade your plan to post more campaigns.
//                 </p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>
//                   ⚡ Upgrade Plan →
//                 </button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input
//                       className="pcp-input" type="text"
//                       placeholder="e.g. Summer Fashion Shoot"
//                       value={formData.title}
//                       onChange={e => setFormData({ ...formData, title: e.target.value })}
//                       required
//                     />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea
//                       className="pcp-input pcp-textarea" rows={4}
//                       placeholder="Describe your campaign requirements..."
//                       value={formData.description}
//                       onChange={e => setFormData({ ...formData, description: e.target.value })}
//                       required
//                     />
//                   </div>
//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input
//                         className="pcp-input" type="number" min={0}
//                         placeholder="e.g. 5000"
//                         value={formData.budget}
//                         onChange={e => setFormData({ ...formData, budget: e.target.value })}
//                         required
//                       />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <select
//                         className="pcp-select"
//                         value={formData.city}
//                         onChange={e => setFormData({ ...formData, city: e.target.value })}
//                         required
//                       >
//                         <option value="">Select City</option>
//                         {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
//                       </select>
//                     </div>
//                   </div>
//                   <div className={`pcp-limit-note ${isLow ? "warn-note" : ""}`}>
//                     📋 You have <strong>{remaining} campaign{remaining === 1 ? "" : "s"}</strong> remaining on your <strong>{planInfo.label}</strong> plan this month.
//                     {isLow && " Consider upgrading soon."}
//                   </div>
//                 </div>

//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button
//                           key={cat} type="button"
//                           className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
//                           onClick={() => toggleChip("categories", cat)}
//                         >
//                           {cat}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="pcp-field" style={{ marginBottom: 0 }}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button
//                           key={r} type="button"
//                           className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`}
//                           onClick={() => toggleChip("roles", r)}
//                         >
//                           {r}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>
//                     Cancel
//                   </button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading
//                       ? <><span className="pcp-spinner" /> Creating...</>
//                       : "Create Campaign 🚀"
//                     }
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";
// import Script from "next/script";

// const API           = "http://54.252.201.93:5000/api/campaigns";
// const API_BASE      = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY  = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID       = "plan_SKmSEwh4wl4Tv6";
// const FREE_COINS    = 100;
// const COINS_PER_CAM = 20;

// const CITY_OPTIONS     = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS     = ["influencers", "brand"];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]           = useState<any>(null);
//   const [loading, setLoading]     = useState(false);
//   const [checking, setChecking]   = useState(true);
//   const [coins, setCoins]         = useState<number>(FREE_COINS);
//   const [isSubscribed, setIsSubscribed]   = useState(false);
//   const [showCoinModal, setShowCoinModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]     = useState<string | null>(null);
//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);

//     // ✅ Clean up stale 'coins' field — 'bits' is source of truth
//     if (parsed.coins !== undefined) {
//       delete parsed.coins;
//       localStorage.setItem("cb_user", JSON.stringify(parsed));
//     }

//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }
//     setUser(parsed);

//     // ✅ Read from bits — this is set by backend response after campaign create
//     const localBits = parsed.bits ?? FREE_COINS;
//     setCoins(localBits);
//     setIsSubscribed(parsed.isSubscribed ?? false);

//     // Show modal if not enough coins
//     if (!parsed.isSubscribed && localBits < COINS_PER_CAM) {
//       setTimeout(() => setShowCoinModal(true), 300);
//     }

//     setChecking(false);
//     // ✅ NO profile/me call here — it would override our correct bits value with 100
//   }, []);

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     // Coin gate
//     if (!isSubscribed && coins < COINS_PER_CAM) { setShowCoinModal(true); return; }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields", "error"); return;
//     }
//     if (formData.roles.length === 0) { showToast("Select at least one role", "error"); return; }

//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title: formData.title.trim(),
//           description: formData.description.trim(),
//           budget: Number(formData.budget),
//           city: formData.city,
//           categories: formData.categories,
//           roles: formData.roles,
//         }),
//       });
//       const data = await res.json();

//       if (!res.ok) {
//         // 403 = coin limit reached on backend
//         if (res.status === 403) {
//           // ✅ Backend ka bits value sync karo agar available ho
//           if (data.bits !== undefined) {
//             const raw2   = localStorage.getItem("cb_user");
//             const parsed = raw2 ? JSON.parse(raw2) : {};
//             const updated = { ...parsed, bits: data.bits };
//             delete updated.coins;
//             localStorage.setItem("cb_user", JSON.stringify(updated));
//             setCoins(data.bits);
//           }
//           setShowCoinModal(true);
//           setLoading(false);
//           return;
//         }
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       // ✅ SUCCESS — backend ne bits deduct karke response mein bheja
//       // data.bits = updated bits after deduction (e.g. 80 after 1st campaign)
//       // YAHI SAHI VALUE HAI — localStorage mein save karo
//       if (!isSubscribed) {
//         const newBits = data.bits !== undefined ? data.bits : Math.max(0, coins - COINS_PER_CAM);
//         setCoins(newBits);

//         const raw2   = localStorage.getItem("cb_user");
//         const parsed = raw2 ? JSON.parse(raw2) : {};
//         const updated = { ...parsed, bits: newBits };
//         delete updated.coins; // stale field hata do
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         setUser(updated);

//         // Auto-show plan modal agar agle campaign ke liye bhi coins nahi
//         if (newBits < COINS_PER_CAM) {
//           setTimeout(() => setShowCoinModal(true), 1300);
//         }
//       }

//       showToast("Campaign Created Successfully 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Razorpay ──
//   const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token  = parsed.token || localStorage.getItem("token");
//     const options = {
//       key: RAZORPAY_KEY, subscription_id: subscriptionId,
//       name: "Influex Premium", description: `${planName} Plan`,
//       theme: { color: "#4f46e5" },
//       prefill: { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async function (response: any) {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({
//               razorpay_payment_id:      response.razorpay_payment_id,
//               razorpay_subscription_id: response.razorpay_subscription_id,
//               razorpay_signature:       response.razorpay_signature,
//               plan_id: PLAN_ID, planName,
//             }),
//           });
//         } catch {}
//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();
//         if (aData.success) {
//           const updated = { ...parsed, isSubscribed: true, activePlan: planId, bits: 99999 };
//           delete updated.coins;
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated); setIsSubscribed(true); setCoins(99999); setShowCoinModal(false);
//           showToast(`🎉 ${planName} activated! Unlimited campaigns!`, "success");
//         } else { showToast("Activation failed.", "error"); }
//         setLoadingPlan(null);
//       },
//       modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
//     };
//     const rzp = new (window as any).Razorpay(options);
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error"); setLoadingPlan(null);
//     });
//     rzp.open();
//   };

//   const handleSubscribe = async (planId: string, planName: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const t      = parsed.token || localStorage.getItem("token");
//     if (!t) { showToast("Session expired.", "error"); return; }
//     setLoadingPlan(planId);
//     try {
//       const res  = await fetch(`${API_BASE}/subscription/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
//         body: JSON.stringify({ plan_id: PLAN_ID }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.subscription?.id) {
//         showToast(data.message || "Failed.", "error"); setLoadingPlan(null); return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch { showToast("Something went wrong.", "error"); setLoadingPlan(null); }
//   };

//   const coinsPercent = Math.max(0, Math.min(100, (coins / FREE_COINS) * 100));
//   const coinsLow     = !isSubscribed && coins <= 40 && coins >= COINS_PER_CAM;
//   const coinsEmpty   = !isSubscribed && coins < COINS_PER_CAM;
//   const camsLeft     = isSubscribed ? "∞" : Math.floor(coins / COINS_PER_CAM);
//   const usageColor   = coinsEmpty ? "#ef4444" : coinsLow ? "#f59e0b" : "#4f46e5";

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: "28px", height: "28px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *,*::before,*::after{box-sizing:border-box}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
//         @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
//         .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
//         @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
//         .pcp-title{font-size:26px;font-weight:600;color:#111;margin:0 0 6px}
//         .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}
//         .pcp-coin-bar{display:flex;align-items:center;gap:14px;background:#fafafa;border:1.5px solid #ebebeb;border-radius:14px;padding:14px 18px;margin-bottom:28px;cursor:pointer;transition:border-color 0.2s}
//         .pcp-coin-bar:hover{border-color:#4f46e5}
//         .pcp-coin-bar.warn{background:#fffbeb;border-color:#fde68a}
//         .pcp-coin-bar.empty{background:#fff5f5;border-color:#fecaca}
//         .pcp-coin-bar.pro{background:#f0fdf4;border-color:#86efac;cursor:default}
//         .pcp-coin-icon{font-size:24px}
//         .pcp-coin-info{flex:1}
//         .pcp-coin-label{font-size:11px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
//         .pcp-coin-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:4px}
//         .pcp-coin-fill{height:100%;border-radius:100px;transition:width 0.5s}
//         .pcp-coin-count{font-size:12px;font-weight:500}
//         .pcp-upgrade-tag{font-size:12px;font-weight:600;padding:5px 12px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;color:#4f46e5;background:#eef2ff;white-space:nowrap;transition:background 0.2s}
//         .pcp-upgrade-tag:hover{background:#e0e7ff}
//         .pcp-upgrade-tag.warn-tag{color:#d97706;background:#fef3c7}
//         .pcp-upgrade-tag.empty-tag{color:#dc2626;background:#fee2e2}
//         .pcp-form{display:flex;flex-direction:column;gap:0}
//         .pcp-section{margin-bottom:28px}
//         .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
//         .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
//         @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
//         .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
//         .pcp-label{font-size:13px;font-weight:600;color:#374151}
//         .pcp-label .req{color:#ef4444;margin-left:2px}
//         .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
//         .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-input::placeholder{color:#9ca3af}
//         .pcp-textarea{resize:none;line-height:1.6}
//         .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
//         .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
//         .pcp-coin-cost-note{display:flex;align-items:center;gap:6px;background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:10px 14px;font-size:13px;color:#888;margin-top:4px}
//         .pcp-coin-cost-note.low-note{background:#fffbeb;border-color:#fde68a;color:#92400e}
//         .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
//         .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
//         .pcp-btn-cancel:hover{background:#e5e7eb}
//         .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
//         .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}
//         .pcp-blocked{text-align:center;padding:56px 24px}
//         .pcp-blocked-icon{font-size:52px;margin-bottom:18px}
//         .pcp-blocked-title{font-size:22px;font-weight:600;color:#111;margin:0 0 10px}
//         .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
//         .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pcp-blocked-btn:hover{background:#4338ca;transform:translateY(-1px)}
//         .coin-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
//         .coin-modal{background:#fff;border-radius:24px;max-width:420px;width:100%;padding:36px 32px 30px;position:relative;text-align:center;animation:slideUp 0.25s ease}
//         .coin-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#aaa;padding:4px}
//         .coin-modal-close:hover{color:#555}
//         .coin-modal-icon{font-size:52px;margin-bottom:14px;line-height:1}
//         .coin-modal-title{font-size:22px;font-weight:700;color:#111;margin-bottom:8px}
//         .coin-modal-sub{font-size:14px;color:#777;line-height:1.65;margin-bottom:10px}
//         .coin-modal-prog-wrap{margin:14px 0 22px}
//         .coin-modal-prog-top{display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:6px}
//         .coin-modal-prog{height:8px;background:#f0f0f0;border-radius:100px;overflow:hidden}
//         .coin-modal-prog-fill{height:100%;border-radius:100px;transition:width 0.6s ease}
//         .coin-plan-btn{width:100%;padding:14px 20px;border-radius:14px;border:none;font-size:15px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
//         .coin-plan-btn:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
//         .coin-plan-btn:disabled{opacity:0.65;cursor:not-allowed;transform:none}
//         .coin-modal-skip{font-size:13px;color:#ccc;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-decoration:underline}
//         .coin-modal-skip:hover{color:#888}
//         .coin-modal-secure{font-size:11px;color:#ddd;margin-top:10px}
//         .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:6px;vertical-align:middle}
//         .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
//         .pcp-toast.success{background:#111;color:#fff}
//         .pcp-toast.error{background:#ef4444;color:#fff}
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       {showCoinModal && (
//         <div className="coin-modal-overlay">
//           <div className="coin-modal">
//             <button className="coin-modal-close" onClick={() => setShowCoinModal(false)}>✕</button>
//             <div className="coin-modal-icon">🪙</div>
//             <div className="coin-modal-title">{coins <= 0 ? "Coins Khatam!" : "Coins Khatam Hone Wale!"}</div>
//             <div className="coin-modal-sub">
//               {coins <= 0
//                 ? `Saare ${FREE_COINS} coins use ho gaye. Pro plan lo — unlimited campaigns post karo.`
//                 : `Campaign post karne ke liye ${COINS_PER_CAM} coins chahiye — aapke paas sirf ${coins} hain.`}
//             </div>
//             <div className="coin-modal-prog-wrap">
//               <div className="coin-modal-prog-top">
//                 <span>Coins used</span>
//                 <span>{FREE_COINS - Math.max(0, coins)} / {FREE_COINS}</span>
//               </div>
//               <div className="coin-modal-prog">
//                 <div className="coin-modal-prog-fill" style={{ width: `${100 - coinsPercent}%`, background: coins <= 0 ? "#ef4444" : "#f59e0b" }} />
//               </div>
//             </div>
//             <button className="coin-plan-btn" onClick={() => handleSubscribe("pro_monthly", "Pro")} disabled={loadingPlan !== null}>
//               <span>{loadingPlan === "pro_monthly" ? <><span className="mini-spin" />Processing...</> : "⚡ Upgrade to Pro — Unlimited Campaigns"}</span>
//               <span style={{ fontSize: 13, opacity: 0.85 }}>₹999/mo</span>
//             </button>
//             <button className="coin-modal-skip" onClick={() => setShowCoinModal(false)}>Maybe later</button>
//             <div className="coin-modal-secure">🔒 Secured by Razorpay</div>
//           </div>
//         </div>
//       )}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             {/* COIN BAR */}
//             <div
//               className={`pcp-coin-bar ${isSubscribed ? "pro" : coinsEmpty ? "empty" : coinsLow ? "warn" : ""}`}
//               onClick={() => !isSubscribed && setShowCoinModal(true)}
//             >
//               <div className="pcp-coin-icon">🪙</div>
//               <div className="pcp-coin-info">
//                 <div className="pcp-coin-label">{isSubscribed ? "Unlimited Coins (Pro)" : `Coins — ${COINS_PER_CAM} per campaign`}</div>
//                 {!isSubscribed && (
//                   <div className="pcp-coin-track">
//                     <div className="pcp-coin-fill" style={{ width: `${coinsPercent}%`, background: usageColor }} />
//                   </div>
//                 )}
//                 <div className="pcp-coin-count" style={{ color: isSubscribed ? "#15803d" : usageColor }}>
//                   {isSubscribed ? "✓ Pro — Unlimited campaigns"
//                     : coinsEmpty ? "⚠️ No coins left — please upgrade"
//                     : `${coins} coins remaining · ${camsLeft} campaigns left`}
//                 </div>
//               </div>
//               {!isSubscribed && (
//                 <button
//                   className={`pcp-upgrade-tag ${coinsEmpty ? "empty-tag" : coinsLow ? "warn-tag" : ""}`}
//                   onClick={(e) => { e.stopPropagation(); setShowCoinModal(true); }}
//                 >
//                   {coinsEmpty ? "Upgrade!" : "Upgrade ✦"}
//                 </button>
//               )}
//             </div>

//             {coinsEmpty ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Coins Khatam!</h2>
//                 <p className="pcp-blocked-sub">
//                   Free plan mein <strong>{FREE_COINS / COINS_PER_CAM} campaigns</strong> allowed hain.<br />
//                   Pro upgrade karo aur unlimited post karo.
//                 </p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowCoinModal(true)}>⚡ Upgrade to Pro →</button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot"
//                       value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea className="pcp-input pcp-textarea" rows={4} placeholder="Describe your campaign..."
//                       value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
//                   </div>
//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000"
//                         value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} required />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <select className="pcp-select" value={formData.city}
//                         onChange={e => setFormData({ ...formData, city: e.target.value })} required>
//                         <option value="">Select City</option>
//                         {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
//                       </select>
//                     </div>
//                   </div>
//                   {!isSubscribed && (
//                     <div className={`pcp-coin-cost-note ${coinsLow ? "low-note" : ""}`}>
//                       🪙 Campaign post karne pe <strong>{COINS_PER_CAM} coins</strong> katenge
//                       {coinsLow && ` — sirf ${camsLeft} campaigns baaki!`}
//                     </div>
//                   )}
//                 </div>

//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button key={cat} type="button"
//                           className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
//                           onClick={() => toggleChip("categories", cat)}>{cat}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                   <div className="pcp-field" style={{ marginBottom: 0 }}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button key={r} type="button"
//                           className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`}
//                           onClick={() => toggleChip("roles", r)}>{r}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading
//                       ? <><span className="pcp-spinner" /> Creating...</>
//                       : `Create Campaign 🚀${!isSubscribed ? ` (−${COINS_PER_CAM} 🪙)` : ""}`}
//                   </button>
//                 </div>
//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api/campaigns";
// const API_BASE = "http://54.252.201.93:5000/api";
// const FREE_CAMPAIGN_LIMIT = 5;

// const CITY_OPTIONS = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
// const ROLE_OPTIONS = ["influencers", "brand"];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);
//   const [checking, setChecking] = useState(true);

//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [campaignsCreated, setCampaignsCreated] = useState(0);
//   const [limitReached, setLimitReached] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [] as string[],
//     roles: [] as string[],
//   });

//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const parsedUser = JSON.parse(storedUser);
//     if (parsedUser.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }
//     setUser(parsedUser);

//     const token = parsedUser.token || localStorage.getItem("token");

//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         if (data.success && data.profile) {
//           const sub = data.profile.isSubscribed ?? false;
//           const created = data.profile.campaignsCreated ?? 0;
//           setIsSubscribed(sub);
//           setCampaignsCreated(created);
//           if (!sub && created >= FREE_CAMPAIGN_LIMIT) setLimitReached(true);
//         }
//       })
//       .catch(() => {})
//       .finally(() => setChecking(false));
//   }, []);

//   const toggleChip = (field: "categories" | "roles", value: string) => {
//     setFormData(prev => ({
//       ...prev,
//       [field]: prev[field].includes(value)
//         ? prev[field].filter((v: string) => v !== value)
//         : [...prev[field], value],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();
//     if (!isSubscribed && campaignsCreated >= FREE_CAMPAIGN_LIMIT) {
//       showToast("Campaign limit reach! Upgrade karo 🚀", "error");
//       setTimeout(() => router.push("/upgrade"), 1500);
//       return;
//     }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields", "error");
//       return;
//     }
//     if (formData.roles.length === 0) {
//       showToast("Select at least one role", "error");
//       return;
//     }
//     try {
//       setLoading(true);
//       const token = user.token || localStorage.getItem("token");
//       const res = await fetch(API, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({
//           title: formData.title.trim(),
//           description: formData.description.trim(),
//           budget: Number(formData.budget),
//           city: formData.city,
//           categories: formData.categories,
//           roles: formData.roles,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         if (res.status === 403) {
//           showToast(data.message || "Campaign limit reach! Upgrade karo", "error");
//           setTimeout(() => router.push("/upgrade"), 1500);
//           return;
//         }
//         throw new Error(data.message || "Failed to create campaign");
//       }
//       showToast("Campaign Created Successfully 🚀", "success");
//       setTimeout(() => router.push("/campaigns"), 1200);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: "28px", height: "28px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!user) return null;

//   const usagePercent = Math.min(100, (campaignsCreated / FREE_CAMPAIGN_LIMIT) * 100);
//   const usageColor = limitReached ? "#ef4444" : campaignsCreated >= 3 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; }

//         .pcp { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

//         .pcp-inner {
//           max-width: 720px; margin: 0 auto;
//           padding: 40px 20px 80px;
//         }
//         @media(max-width:600px){ .pcp-inner{ padding: 24px 16px 60px; } }

//         /* CARD */
//         .pcp-card {
//           background: #fff; border-radius: 24px;
//           padding: 40px; border: 1px solid #ebebeb;
//           box-shadow: 0 2px 20px rgba(0,0,0,0.05);
//         }
//         @media(max-width:600px){ .pcp-card{ padding: 24px 20px; border-radius: 18px; } }

//         .pcp-head { margin-bottom: 32px; }
//         .pcp-title { font-size: 26px; font-weight: 600; color: #111; margin: 0 0 6px; }
//         .pcp-sub { font-size: 14px; color: #999; font-weight: 400; margin: 0; }

//         /* Usage bar */
//         .pcp-usage {
//           display: flex; align-items: center; gap: 14px;
//           background: #fafafa; border: 1.5px solid #ebebeb;
//           border-radius: 12px; padding: 14px 16px; margin-bottom: 28px;
//         }
//         .pcp-usage.warn   { background: #fffbeb; border-color: #fde68a; }
//         .pcp-usage.danger { background: #fff5f5; border-color: #fecaca; }
//         .pcp-usage.pro    { background: #f0fdf4; border-color: #86efac; }
//         .pcp-usage-info { flex: 1; }
//         .pcp-usage-label { font-size: 11px; font-weight: 500; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
//         .pcp-usage-track { height: 5px; background: #e8e8e8; border-radius: 100px; overflow: hidden; margin-bottom: 5px; }
//         .pcp-usage-fill  { height: 100%; border-radius: 100px; transition: width 0.4s; }
//         .pcp-usage-count { font-size: 12px; font-weight: 500; }
//         .pcp-upgrade-link {
//           font-size: 12px; font-weight: 600; color: #4f46e5;
//           text-decoration: none; white-space: nowrap;
//           background: #eef2ff; padding: 5px 12px; border-radius: 8px;
//         }
//         .pcp-upgrade-link:hover { background: #e0e7ff; }

//         /* FORM */
//         .pcp-form { display: flex; flex-direction: column; gap: 0; }

//         .pcp-section { margin-bottom: 28px; }
//         .pcp-section-label {
//           font-size: 11px; font-weight: 600; color: #bbb;
//           text-transform: uppercase; letter-spacing: 0.08em;
//           margin-bottom: 18px; padding-bottom: 10px;
//           border-bottom: 1px solid #f3f4f6;
//         }

//         .pcp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
//         @media(max-width:480px){ .pcp-row{ grid-template-columns: 1fr; } }

//         .pcp-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
//         .pcp-field:last-child { margin-bottom: 0; }

//         .pcp-label { font-size: 13px; font-weight: 600; color: #374151; }
//         .pcp-label .req { color: #ef4444; margin-left: 2px; }

//         .pcp-input {
//           width: 100%; padding: 12px 14px;
//           border: 1.5px solid #e5e7eb; border-radius: 12px;
//           font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 400;
//           color: #111; background: #fff; outline: none;
//           transition: border-color 0.2s, box-shadow 0.2s;
//         }
//         .pcp-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
//         .pcp-input::placeholder { color: #9ca3af; }
//         .pcp-textarea { resize: none; line-height: 1.6; }

//         .pcp-select {
//           width: 100%; padding: 12px 40px 12px 14px;
//           border: 1.5px solid #e5e7eb; border-radius: 12px;
//           font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 400;
//           color: #111; background: #fff; outline: none; appearance: none; cursor: pointer;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
//           background-repeat: no-repeat; background-position: right 14px center;
//           transition: border-color 0.2s;
//         }
//         .pcp-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }

//         /* CHIPS */
//         .pcp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
//         .pcp-chip {
//           padding: 8px 16px; border-radius: 100px;
//           border: 1.5px solid #e5e7eb; background: #fff;
//           font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif;
//           color: #6b7280; cursor: pointer; transition: all 0.15s;
//           text-transform: capitalize;
//         }
//         .pcp-chip:hover { border-color: #4f46e5; color: #4f46e5; }
//         .pcp-chip.sel { background: #4f46e5; border-color: #4f46e5; color: #fff; }

//         /* ACTIONS */
//         .pcp-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 28px; border-top: 1px solid #f3f4f6; gap: 12px; }
//         .pcp-btn-cancel {
//           padding: 12px 24px; border-radius: 12px;
//           font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif;
//           color: #6b7280; background: #f3f4f6; border: none; cursor: pointer;
//           transition: background 0.2s;
//         }
//         .pcp-btn-cancel:hover { background: #e5e7eb; }
//         .pcp-btn-submit {
//           padding: 12px 32px; border-radius: 12px;
//           font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
//           color: #fff; background: #4f46e5; border: none; cursor: pointer;
//           transition: all 0.2s; display: flex; align-items: center; gap: 8px;
//         }
//         .pcp-btn-submit:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
//         .pcp-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

//         .pcp-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

//         /* BLOCKED */
//         .pcp-blocked { text-align: center; padding: 56px 24px; }
//         .pcp-blocked-icon { font-size: 52px; margin-bottom: 18px; }
//         .pcp-blocked-title { font-size: 22px; font-weight: 600; color: #111; margin: 0 0 10px; }
//         .pcp-blocked-sub { font-size: 14px; color: #888; line-height: 1.7; margin: 0 0 28px; font-weight: 400; }
//         .pcp-blocked-btn {
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 13px 32px; border-radius: 12px; background: #4f46e5;
//           color: #fff; font-size: 14px; font-weight: 600;
//           font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s;
//         }
//         .pcp-blocked-btn:hover { background: #4338ca; transform: translateY(-1px); }

//         /* TOAST */
//         .pcp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; text-align: center; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.14); }
//         .pcp-toast.success { background: #111; color: #fff; }
//         .pcp-toast.error   { background: #ef4444; color: #fff; }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>

//       {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <div className="pcp-head">
//               <h1 className="pcp-title">Create Campaign</h1>
//               <p className="pcp-sub">Find the right creators for your brand</p>
//             </div>

//             {/* USAGE INDICATOR */}
//             {isSubscribed ? (
//               <div className="pcp-usage pro">
//                 <div className="pcp-usage-info">
//                   <div className="pcp-usage-label">Campaign Usage</div>
//                   <div className="pcp-usage-count" style={{ color: "#15803d" }}>✓ Pro — Unlimited campaigns</div>
//                 </div>
//               </div>
//             ) : (
//               <div className={`pcp-usage ${limitReached ? "danger" : campaignsCreated >= 3 ? "warn" : ""}`}>
//                 <div className="pcp-usage-info">
//                   <div className="pcp-usage-label">Campaigns Used</div>
//                   <div className="pcp-usage-track">
//                     <div className="pcp-usage-fill" style={{ width: `${usagePercent}%`, background: usageColor }} />
//                   </div>
//                   <div className="pcp-usage-count" style={{ color: usageColor }}>
//                     {campaignsCreated} of {FREE_CAMPAIGN_LIMIT} used
//                     {!limitReached && ` · ${FREE_CAMPAIGN_LIMIT - campaignsCreated} remaining`}
//                   </div>
//                 </div>
//                 <a href="/upgrade" className="pcp-upgrade-link">Upgrade ✦</a>
//               </div>
//             )}

//             {/* BLOCKED */}
//             {limitReached ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🚫</div>
//                 <h2 className="pcp-blocked-title">Campaign Limit Reached</h2>
//                 <p className="pcp-blocked-sub">
//                   Free plan allows only <strong>{FREE_CAMPAIGN_LIMIT} campaigns</strong>.<br />
//                   Upgrade to Pro to post unlimited campaigns.
//                 </p>
//                 <button className="pcp-blocked-btn" onClick={() => router.push("/upgrade")}>
//                   Upgrade to Pro →
//                 </button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">

//                 {/* Campaign Info */}
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>

//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot"
//                       value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
//                   </div>

//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea className="pcp-input pcp-textarea" rows={4}
//                       placeholder="Describe your campaign, deliverables, requirements..."
//                       value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
//                   </div>

//                   <div className="pcp-row">
//                     <div className="pcp-field">
//                       <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
//                       <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000"
//                         value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} required />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <select className="pcp-select" value={formData.city}
//                         onChange={e => setFormData({ ...formData, city: e.target.value })} required>
//                         <option value="">Select City</option>
//                         {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
//                       </select>
//                     </div>
//                   </div>
//                 </div>

//                 {/* Targeting */}
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>

//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="pcp-chips">
//                       {CATEGORY_OPTIONS.map(cat => (
//                         <button key={cat} type="button"
//                           className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
//                           onClick={() => toggleChip("categories", cat)}>{cat}</button>
//                       ))}
//                     </div>
//                   </div>

//                   <div className="pcp-field" style={{ marginBottom: 0 }}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(role => (
//                         <button key={role} type="button"
//                           className={`pcp-chip ${formData.roles.includes(role) ? "sel" : ""}`}
//                           onClick={() => toggleChip("roles", role)}>{role}</button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 {/* Actions */}
//                 <div className="pcp-actions">
//                   <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading ? <><span className="pcp-spinner" /> Creating...</> : "Create Campaign 🚀"}
//                   </button>
//                 </div>

//               </form>
//             )}
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

