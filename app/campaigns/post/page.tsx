"use client";

import { useState, useEffect, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API          = "https://api.collabzy.in/api/campaigns";
const API_BASE     = "https://api.collabzy.in/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

const TOKENS_PER_CAMPAIGN = 100;

const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
  free:             { label: "Free",  campaigns: 2,   price: "₹0",      tokens: 200   },
  pro:              { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
  pro_plus:         { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
  pro_year:         { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
  pro_plus_year:    { label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
  pro_monthly:      { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
  pro_plus_monthly: { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
  pro_yearly:       { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
  pro_plus_yearly:  { label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
};

const MAIN_CATEGORIES = [
  { value: "influencer",    label: "Influencer",    emoji: "📱" },
  { value: "photographer",  label: "Photographer",  emoji: "📸" },
  { value: "singer",        label: "Singer",        emoji: "🎤" },
  { value: "model",         label: "Model",         emoji: "💃" },
  { value: "makeup_artist", label: "Makeup Artist", emoji: "💄" },
  { value: "anchor_host",   label: "Anchor / Host", emoji: "🎙️" },
];

const SUB_CATEGORY_MAP: Record<string, string[]> = {
  photographer: [
    "Wedding Photographer",
    "Event Photographer",
    "Product Photographer",
    "Fashion Photographer",
  ],
  singer: [
    "Wedding Singer",
    "Club / Bar Singer",
    "Indie Artist",
    "Classical Singer",
  ],
  model: [
    "Fashion Model",
    "Commercial Model",
    "Fitness Model",
    "Instagram Model",
  ],
  influencer: [
    "Beauty Influencer",
    "Tech Influencer",
    "Fitness Influencer",
    "Travel Influencer",
    "Food Influencer",
  ],
  makeup_artist: [
    "Bridal Makeup Artist",
    "Editorial Makeup Artist",
    "SFX Makeup Artist",
    "Freelance Makeup Artist",
  ],
  anchor_host: [
    "Event Anchor",
    "TV / YouTube Host",
    "Corporate Emcee",
    "Wedding Anchor",
  ],
};



const toCanonical = (s: string): string => {
  if (!s) return "free";
  const v = s.toLowerCase().trim();
  const map: Record<string, string> = {
    pro_monthly: "pro_monthly", pro_plus_monthly: "pro_plus_monthly",
    pro_yearly: "pro_yearly", pro_plus_yearly: "pro_plus_yearly",
    pro: "pro_monthly", pro_plus: "pro_plus_monthly",
    "pro+": "pro_plus_monthly", pro_year: "pro_yearly", pro_plus_year: "pro_plus_yearly",
  };
  return map[v] ?? "free";
};

const getPlanInfo = (p: string | null) => PLAN_LIMITS[toCanonical(p || "")] ?? PLAN_LIMITS["free"];
const isPaidPlan  = (p: string | null) => !!p && toCanonical(p) !== "free";

const upgradePlans = [
  { id: "pro",      name: "Pro",  price: "₹599/mo",   originalPrice: "₹1,000", tokens: 1000, popular: true  },
  { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", tokens: 2500, popular: false },
];

function syncUserToStorage(updates: Record<string, any>) {
  try {
    const raw = localStorage.getItem("cb_user");
    const merged = { ...(raw ? JSON.parse(raw) : {}), ...updates, _updatedAt: Date.now() };
    localStorage.setItem("cb_user", JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("plan_updated", { detail: { refresh: true, bits: merged.bits, time: Date.now() } }));
    return merged;
  } catch { return null; }
}

// ── Custom Tag Input Component ────────────────────────────────────────────────
function CustomTagInput({
  placeholder,
  onAdd,
  label,
}: {
  placeholder: string;
  onAdd: (val: string) => void;
  label: string;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="custom-tag-input-wrap">
      <span className="custom-tag-icon">✏️</span>
      <input
        ref={inputRef}
        className="custom-tag-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
      />
      <button
        type="button"
        className="custom-tag-btn"
        onClick={handleAdd}
        disabled={!value.trim()}
      >
        + Add
      </button>
    </div>
  );
}

export default function PostCampaignPage() {
  const router = useRouter();

  const [user, setUser]         = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [checking, setChecking] = useState(true);
  const [activePlan, setActivePlan]           = useState<string>("free");
  const [availableTokens, setAvailableTokens] = useState<number>(0);
  const [tokensLoaded, setTokensLoaded]       = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan]         = useState<string>("pro");

  // ── custom categories & subcategories typed by user ──────────────────────
  const [customCategories, setCustomCategories]       = useState<string[]>([]);
  const [customSubCategories, setCustomSubCategories] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    title: "", description: "", budget: "", city: "",
    categories:    [] as string[],
    subCategories: [] as string[],
  });

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchLiveTokens = async (token: string) => {
    try {
      const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const b    = data?.user?.bits ?? data?.profile?.bits ?? data?.bits ?? null;
      if (b !== null) { setAvailableTokens(Number(b)); syncUserToStorage({ bits: Number(b) }); }
      else { const r = localStorage.getItem("cb_user"); if (r) setAvailableTokens(Number(JSON.parse(r).bits ?? 0)); }
    } catch {
      const r = localStorage.getItem("cb_user"); if (r) setAvailableTokens(Number(JSON.parse(r).bits ?? 0));
    } finally { setTokensLoaded(true); }
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }
    setUser(parsed);
    setActivePlan(parsed.plan || parsed.activePlan || "free");
    if (parsed.bits != null) setAvailableTokens(Number(parsed.bits));
    const token = parsed.token || localStorage.getItem("token");
    if (token) fetchLiveTokens(token);
    setChecking(false);
  }, []);

  // ── Toggle main category — removing one also removes its subs ───────────
  const toggleCategory = (val: string) => {
    setFormData(prev => {
      const already  = prev.categories.includes(val);
      const newSubs  = already
        ? prev.subCategories.filter(s => !(SUB_CATEGORY_MAP[val] || []).includes(s))
        : prev.subCategories;
      return {
        ...prev,
        categories:    already ? prev.categories.filter(c => c !== val) : [...prev.categories, val],
        subCategories: newSubs,
      };
    });
  };

  const toggleSubCategory = (val: string) =>
    setFormData(prev => ({
      ...prev,
      subCategories: prev.subCategories.includes(val)
        ? prev.subCategories.filter(s => s !== val)
        : [...prev.subCategories, val],
    }));



  // ── Custom category add / remove ─────────────────────────────────────────
  const addCustomCategory = (val: string) => {
    if (customCategories.includes(val)) return;
    setCustomCategories(prev => [...prev, val]);
    // auto-select it in formData
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(val) ? prev.categories : [...prev.categories, val],
    }));
  };

  const removeCustomCategory = (val: string) => {
    setCustomCategories(prev => prev.filter(c => c !== val));
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== val),
      // also remove custom subcategories that were under it (can't know, so we skip — or remove all custom subs)
    }));
  };

  const addCustomSubCategory = (val: string) => {
    if (customSubCategories.includes(val)) return;
    setCustomSubCategories(prev => [...prev, val]);
    setFormData(prev => ({
      ...prev,
      subCategories: prev.subCategories.includes(val) ? prev.subCategories : [...prev.subCategories, val],
    }));
  };

  const removeCustomSubCategory = (val: string) => {
    setCustomSubCategories(prev => prev.filter(s => s !== val));
    setFormData(prev => ({
      ...prev,
      subCategories: prev.subCategories.filter(s => s !== val),
    }));
  };

  const planInfo          = getPlanInfo(activePlan);
  const isSubscribed      = isPaidPlan(activePlan);
  const campaignsPossible = Math.floor(availableTokens / TOKENS_PER_CAMPAIGN);
  const isAtLimit         = tokensLoaded && campaignsPossible === 0;
  const isLow             = campaignsPossible <= 2 && campaignsPossible > 0;
  const barColor          = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";
  const barPercent        = Math.min(100, (availableTokens / (planInfo.tokens || 200)) * 100);
  const selected          = upgradePlans.find(p => p.id === selectedPlan) ?? upgradePlans[0];

  // merge preset + custom for final categories / subcategories
  const allSelectedCategories    = formData.categories;
  const allSelectedSubCategories = formData.subCategories;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (availableTokens < TOKENS_PER_CAMPAIGN) { showToast(`Need ${TOKENS_PER_CAMPAIGN} tokens.`, "error"); setShowUpgradeModal(true); return; }
    if (!formData.title || !formData.description || !formData.budget || !formData.city) { showToast("Please fill all required fields.", "error"); return; }
    try {
      setLoading(true);
      const token = user.token || localStorage.getItem("token");
      const res   = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title:         formData.title.trim(),
          description:   formData.description.trim(),
          budget:        Number(formData.budget),
          city:          formData.city,
          categories:    allSelectedCategories,
          subCategories: allSelectedSubCategories,

        }),
      });
      const data = await res.json();
      if (!res.ok) { if (res.status === 403) { setShowUpgradeModal(true); return; } throw new Error(data.message || "Failed"); }
      let newBits = Math.max(0, availableTokens - TOKENS_PER_CAMPAIGN);
      try {
        const pr = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
        const pd = await pr.json();
        const bb = pd?.user?.bits ?? pd?.profile?.bits ?? pd?.bits ?? null;
        if (bb !== null) newBits = Number(bb);
      } catch {}
      setAvailableTokens(newBits);
      syncUserToStorage({ bits: newBits });
      showToast("Campaign created successfully! 🚀", "success");
      setTimeout(() => router.push("/campaigns"), 1200);
    } catch (err: any) {
      showToast(err.message || "Something went wrong.", "error");
    } finally { setLoading(false); }
  };

  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    const options = {
      key: RAZORPAY_KEY, subscription_id: subscriptionId,
      name: "Influex Premium", description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: parsed?.name || "", email: parsed?.email || "" },
      handler: async (response: any) => {
        try { await fetch(`${API_BASE}/subscription/verify`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...response, plan_id: PLAN_ID, planName }) }); } catch {}
        const planDbMap: Record<string, string> = { pro: "pro_monthly", pro_plus: "pro_plus_monthly", pro_year: "pro_yearly", pro_plus_year: "pro_plus_yearly" };
        const canonicalPlan = planDbMap[planId] || planId;
        const aRes  = await fetch(`${API_BASE}/subscription/activate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }) });
        const aData = await aRes.json();
        if (aData.success) {
          const newBits = PLAN_LIMITS[canonicalPlan]?.tokens ?? 0;
          const updated = { ...parsed, isSubscribed: true, activePlan: canonicalPlan, plan: canonicalPlan, planActivatedAt: new Date().toISOString(), bits: newBits };
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setUser(updated); setActivePlan(canonicalPlan); setAvailableTokens(newBits); setShowUpgradeModal(false);
          window.dispatchEvent(new CustomEvent("plan_updated", { detail: { refresh: true, bits: newBits, time: Date.now() } }));
          showToast(`🎉 ${planName} activated!`, "success");
        } else { showToast("Activation failed. Contact support.", "error"); }
        setLoadingPlan(null);
      },
      modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", (r: any) => { showToast(`Payment failed: ${r.error.description}`, "error"); setLoadingPlan(null); });
    rzp.open();
  };

  const handleSubscribe = async (planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const t      = parsed.token || localStorage.getItem("token");
    if (!t) { showToast("Session expired.", "error"); return; }
    setLoadingPlan(planId);
    try {
      const res  = await fetch(`${API_BASE}/subscription/create`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify({ plan_id: PLAN_ID }) });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) { showToast(data.message || "Failed.", "error"); setLoadingPlan(null); return; }
      openRazorpay(data.subscription.id, planId, planName);
    } catch { showToast("Something went wrong.", "error"); setLoadingPlan(null); }
  };

  if (checking) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return null;

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
        @keyframes subIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
        @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
        .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
        @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
        .pcp-title{font-size:26px;font-weight:700;color:#111;margin:0 0 6px}
        .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}

        /* TOKEN BAR */
        .token-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;transition:all 0.2s}
        .token-bar.low{background:#fffbeb;border-color:#fde68a}
        .token-bar.empty{background:#fff5f5;border-color:#fecaca}
        .token-bar.good{background:#f0fdf4;border-color:#86efac}
        .token-icon{font-size:24px;flex-shrink:0}
        .token-info{flex:1;min-width:0}
        .token-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .token-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
        .token-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;color:#fff}
        .token-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
        .token-fill{height:100%;border-radius:100px;transition:width 0.6s}
        .token-text{font-size:12px;font-weight:500}
        .token-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
        .token-btn.normal{color:#4f46e5;background:#eef2ff}.token-btn.normal:hover{background:#e0e7ff}
        .token-btn.warn{color:#d97706;background:#fef3c7}
        .token-btn.danger{color:#dc2626;background:#fee2e2}

        /* FORM */
        .pcp-form{display:flex;flex-direction:column;gap:0}
        .pcp-section{margin-bottom:28px}
        .pcp-section-label{font-size:11px;font-weight:600;color:#bbb;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #f3f4f6}
        .pcp-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media(max-width:480px){.pcp-row{grid-template-columns:1fr}}
        .pcp-field{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
        .pcp-label{font-size:13px;font-weight:600;color:#374151;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .pcp-label .req{color:#ef4444}
        .pcp-label .opt{font-size:11px;color:#aaa;font-weight:400}
        .pcp-input{width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;transition:border-color 0.2s}
        .pcp-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
        .pcp-input::placeholder{color:#9ca3af}
        .pcp-textarea{resize:none;line-height:1.6}

        /* MAIN CATEGORY CHIPS */
        .cat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media(max-width:480px){.cat-grid{grid-template-columns:repeat(2,1fr)}}
        .cat-chip{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:12px;border:1.5px solid #e5e7eb;background:#fff;cursor:pointer;transition:all 0.18s;user-select:none;text-align:left;font-family:'DM Sans',sans-serif}
        .cat-chip:hover{border-color:#4f46e5;background:#f8f7ff}
        .cat-chip.sel{background:#4f46e5;border-color:#4f46e5;box-shadow:0 2px 10px rgba(79,70,229,0.25)}
        .cat-chip-emoji{font-size:20px;line-height:1;flex-shrink:0}
        .cat-chip-label{font-size:13px;font-weight:600;color:#374151;line-height:1.2}
        .cat-chip.sel .cat-chip-label{color:#fff}

        /* CUSTOM CATEGORY CHIPS (user-added) */
        .custom-cat-chip{display:flex;align-items:center;gap:8px;padding:11px 14px;border-radius:12px;border:1.5px dashed #a78bfa;background:#f8f7ff;cursor:default;transition:all 0.18s;user-select:none;text-align:left;font-family:'DM Sans',sans-serif}
        .custom-cat-chip.sel{background:#4f46e5;border-color:#4f46e5;border-style:solid;box-shadow:0 2px 10px rgba(79,70,229,0.25)}
        .custom-cat-chip-label{font-size:13px;font-weight:600;color:#6d28d9;line-height:1.2;flex:1}
        .custom-cat-chip.sel .custom-cat-chip-label{color:#fff}
        .custom-cat-chip-remove{background:none;border:none;cursor:pointer;font-size:14px;color:#a78bfa;padding:0;line-height:1;flex-shrink:0;transition:color 0.15s}
        .custom-cat-chip.sel .custom-cat-chip-remove{color:rgba(255,255,255,0.7)}
        .custom-cat-chip-remove:hover{color:#dc2626}

        /* CUSTOM TAG INPUT */
        .custom-tag-input-wrap{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;border:1.5px dashed #c4b5fd;background:#faf5ff;margin-top:10px;transition:border-color 0.2s}
        .custom-tag-input-wrap:focus-within{border-color:#7c3aed;background:#f5f0ff}
        .custom-tag-icon{font-size:14px;flex-shrink:0;opacity:0.6}
        .custom-tag-input{flex:1;border:none;outline:none;background:transparent;font-size:13px;font-family:'DM Sans',sans-serif;color:#374151;min-width:0}
        .custom-tag-input::placeholder{color:#c4b5fd}
        .custom-tag-btn{padding:5px 12px;border-radius:8px;border:none;background:#7c3aed;color:#fff;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:background 0.15s;white-space:nowrap;flex-shrink:0}
        .custom-tag-btn:hover:not(:disabled){background:#6d28d9}
        .custom-tag-btn:disabled{opacity:0.4;cursor:not-allowed}
        .custom-tag-hint{font-size:11px;color:#a78bfa;margin-top:6px;display:flex;align-items:center;gap:4px}

        /* SUB CATEGORY SECTION */
        .subcat-section{margin-top:4px;margin-bottom:16px;padding:18px;background:#fafbff;border-radius:14px;border:1.5px solid #e8e5ff;animation:subIn 0.22s ease}
        .subcat-header{font-size:12px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:14px;display:flex;align-items:center;gap:6px}
        .subcat-group{margin-bottom:16px}
        .subcat-group:last-child{margin-bottom:0}
        .subcat-group-label{font-size:12px;font-weight:700;color:#555;margin-bottom:8px;display:flex;align-items:center;gap:5px}
        .subcat-chips{display:flex;flex-wrap:wrap;gap:8px}
        .subcat-chip{padding:7px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;color:#555;cursor:pointer;transition:all 0.15s;user-select:none}
        .subcat-chip:hover{border-color:#16a34a;color:#16a34a;background:#f0fdf4}
        .subcat-chip.sel{background:#16a34a;border-color:#16a34a;color:#fff;box-shadow:0 2px 6px rgba(22,163,74,0.2)}

        /* CUSTOM SUBCAT CHIPS */
        .subcat-chip-custom{padding:7px 12px;border-radius:100px;border:1.5px dashed #a78bfa;background:#faf5ff;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;color:#7c3aed;cursor:default;display:flex;align-items:center;gap:6px;transition:all 0.15s}
        .subcat-chip-custom.sel{background:#7c3aed;border-color:#7c3aed;border-style:solid;color:#fff}
        .subcat-chip-custom-remove{background:none;border:none;cursor:pointer;font-size:12px;color:inherit;padding:0;line-height:1;opacity:0.6;flex-shrink:0}
        .subcat-chip-custom-remove:hover{opacity:1}

        .subcat-none{font-size:12px;color:#aaa;font-style:italic;margin-top:6px}

        /* CUSTOM SUBCAT INPUT */
        .subcat-custom-section{margin-top:14px;padding-top:14px;border-top:1px dashed #e8e5ff}
        .subcat-custom-label{font-size:11px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;display:flex;align-items:center;gap:5px}

        /* ROLES */
        .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
        .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
        .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
        .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}

        /* ACTIONS */
        .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
        .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer;transition:background 0.2s}
        .pcp-btn-cancel:hover{background:#e5e7eb}
        .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
        .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
        .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}

        /* BLOCKED */
        .pcp-blocked{text-align:center;padding:52px 24px}
        .pcp-blocked-icon{font-size:52px;margin-bottom:16px}
        .pcp-blocked-title{font-size:22px;font-weight:700;color:#111;margin:0 0 10px}
        .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
        .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer}

        /* UPGRADE MODAL */
        .up-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
        .up-modal{background:#0f0f18;border-radius:24px;max-width:460px;width:100%;padding:32px 28px 28px;position:relative;animation:slideUp 0.25s ease;border:1px solid rgba(255,255,255,0.07)}
        .up-modal-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.06);border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;color:#aaa;display:flex;align-items:center;justify-content:center}
        .up-modal-icon{font-size:40px;margin-bottom:10px;text-align:center}
        .up-modal-title{font-size:20px;font-weight:700;color:#fff;text-align:center;margin-bottom:6px}
        .up-modal-sub{font-size:13px;color:rgba(255,255,255,0.45);text-align:center;line-height:1.6;margin-bottom:20px}
        .up-token-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
        .up-token-label{font-size:12px;color:rgba(255,255,255,0.4)}
        .up-token-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
        .up-token-need{font-size:12px;color:#f87171;font-weight:600}
        .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
        .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
        .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
        .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;white-space:nowrap}
        .up-plan-name{font-size:15px;font-weight:700;color:#fff;margin-bottom:3px}
        .up-plan-desc{font-size:12px;color:rgba(255,255,255,0.4)}
        .up-plan-og{font-size:12px;color:rgba(255,255,255,0.25);text-decoration:line-through;margin-bottom:1px}
        .up-plan-price{font-size:17px;font-weight:800;color:#fff}
        .up-plan-btn{width:100%;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:700;font-family:'DM Sans',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3);margin-top:4px}
        .up-plan-btn:disabled{opacity:0.6;cursor:not-allowed}
        .up-modal-skip{width:100%;text-align:center;font-size:13px;color:rgba(255,255,255,0.25);cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;margin-top:10px;text-decoration:underline}
        .up-secure{font-size:11px;color:rgba(255,255,255,0.15);text-align:center;margin-top:8px}
        .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;flex-shrink:0}
        .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
        .pcp-toast.success{background:#111;color:#fff}
        .pcp-toast.error{background:#ef4444;color:#fff}
      `}</style>

      {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

      {/* ── UPGRADE MODAL ── */}
      {showUpgradeModal && (
        <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="up-modal" onClick={e => e.stopPropagation()}>
            <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
            <div className="up-modal-icon">🪙</div>
            <div className="up-modal-title">Not Enough Tokens</div>
            <div className="up-modal-sub">
              Posting a campaign requires <strong style={{ color: "#fff" }}>{TOKENS_PER_CAMPAIGN} tokens</strong>.<br />
              Tokens can also unlock email and Instagram details.
            </div>
            <div className="up-token-pill">
              <div><div className="up-token-label">Available Tokens</div><div className="up-token-val">{availableTokens} tokens</div></div>
              <div className="up-token-need">Need {TOKENS_PER_CAMPAIGN}</div>
            </div>
            <div className="up-plan-cards">
              {upgradePlans.map(plan => (
                <div key={plan.id} className="up-plan-card"
                  onClick={() => setSelectedPlan(plan.id)}
                  style={selectedPlan === plan.id ? { borderColor: "rgba(79,70,229,0.7)", background: "rgba(79,70,229,0.12)" } : {}}>
                  {plan.popular && <div className="up-popular-tag">POPULAR</div>}
                  <div>
                    <div className="up-plan-name">{plan.name}</div>
                    <div className="up-plan-desc">{plan.tokens.toLocaleString("en-IN")} tokens · ~{Math.floor(plan.tokens / TOKENS_PER_CAMPAIGN)} campaigns</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="up-plan-og">{plan.originalPrice}</div>
                    <div className="up-plan-price">{plan.price}</div>
                  </div>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selectedPlan === plan.id ? "#4f46e5" : "rgba(255,255,255,0.2)"}`, background: selectedPlan === plan.id ? "#4f46e5" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selectedPlan === plan.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                </div>
              ))}
            </div>
            <button className="up-plan-btn" disabled={loadingPlan !== null} onClick={() => handleSubscribe(selected.id, selected.name)}>
              {loadingPlan === selected.id ? <><span className="mini-spin" /> Processing...</> : `Upgrade to ${selected.name} — ${selected.price}`}
            </button>
            <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>Maybe later</button>
            <div className="up-secure">🔒 Secured by Razorpay</div>
          </div>
        </div>
      )}

      <div className="pcp">
        <div className="pcp-inner">
          <div className="pcp-card">
            <h1 className="pcp-title">Create Campaign</h1>
            <p className="pcp-sub">Find the right creators for your brand</p>

            {/* TOKEN BAR */}
            <div className={`token-bar ${isAtLimit ? "empty" : isLow ? "low" : isSubscribed ? "good" : ""}`}>
              <div className="token-icon">🪙</div>
              <div className="token-info">
                <div className="token-top">
                  <span className="token-label">Token Balance</span>
                  {isSubscribed && (
                    <span className="token-badge" style={{ background: activePlan?.includes("plus") ? "linear-gradient(135deg,#7c3aed,#ec4899)" : "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
                      {planInfo.label}
                    </span>
                  )}
                </div>
                <div className="token-track">
                  <div className="token-fill" style={{ width: `${barPercent}%`, background: barColor }} />
                </div>
                <div className="token-text" style={{ color: barColor }}>
                  {isAtLimit
                    ? `⚠️ ${availableTokens} tokens — need ${TOKENS_PER_CAMPAIGN} to post`
                    : isLow
                    ? `⚡ ${availableTokens} tokens left — ${campaignsPossible} campaign${campaignsPossible === 1 ? "" : "s"} left`
                    : `${availableTokens} tokens — can post ${campaignsPossible} campaign${campaignsPossible === 1 ? "" : "s"}`}
                </div>
              </div>
              <button className={`token-btn ${isAtLimit ? "danger" : isLow ? "warn" : "normal"}`} onClick={() => setShowUpgradeModal(true)}>
                {isAtLimit ? "Get Tokens!" : isLow ? "Top Up ⚡" : "Upgrade ✦"}
              </button>
            </div>

            {isAtLimit ? (
              <div className="pcp-blocked">
                <div className="pcp-blocked-icon">🪙</div>
                <h2 className="pcp-blocked-title">Not Enough Tokens</h2>
                <p className="pcp-blocked-sub">
                  Posting a campaign requires <strong>{TOKENS_PER_CAMPAIGN} tokens</strong>.<br />
                  You currently have <strong>{availableTokens} tokens</strong> available.
                </p>
                <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>⚡ Get More Tokens →</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pcp-form">

                {/* ── CAMPAIGN INFO ── */}
                <div className="pcp-section">
                  <div className="pcp-section-label">Campaign Info</div>
                  <div className="pcp-field">
                    <label className="pcp-label">Title <span className="req">*</span></label>
                    <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot"
                      value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                  </div>
                  <div className="pcp-field">
                    <label className="pcp-label">Description <span className="req">*</span></label>
                    <textarea className="pcp-input pcp-textarea" rows={4} placeholder="Describe your campaign requirements..."
                      value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                  </div>
                  <div className="pcp-row">
                    <div className="pcp-field">
                      <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
                      <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000"
                        value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} required />
                    </div>
                    <div className="pcp-field">
                      <label className="pcp-label">City <span className="req">*</span></label>
                      <input className="pcp-input" type="text" placeholder="e.g. Indore, Mumbai..."
                        value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, borderRadius:10, padding:"10px 14px", fontSize:13, background: isLow ? "#fffbeb" : "#f8f7ff", border:`1px solid ${isLow ? "#fde68a" : "#e8e5ff"}`, color: isLow ? "#92400e" : "#7c3aed" }}>
                    🪙 This campaign costs <strong style={{ margin:"0 3px" }}>{TOKENS_PER_CAMPAIGN} tokens</strong> · After posting:{" "}
                    <strong style={{ margin:"0 3px", color: isLow ? "#d97706" : "#4f46e5" }}>{Math.max(0, availableTokens - TOKENS_PER_CAMPAIGN)}</strong> remaining
                  </div>
                </div>

                {/* ── TARGETING ── */}
                <div className="pcp-section">
                  <div className="pcp-section-label">Targeting</div>

                  {/* STEP 1 — Category */}
                  <div className="pcp-field">
                    <label className="pcp-label">
                      Category <span className="opt">Who are you looking for?</span>
                    </label>

                    {/* Preset chips */}
                    <div className="cat-grid">
                      {MAIN_CATEGORIES.map(cat => (
                        <button key={cat.value} type="button"
                          className={`cat-chip ${formData.categories.includes(cat.value) ? "sel" : ""}`}
                          onClick={() => toggleCategory(cat.value)}>
                          <span className="cat-chip-emoji">{cat.emoji}</span>
                          <span className="cat-chip-label">{cat.label}</span>
                        </button>
                      ))}

                      {/* Custom category chips (user-added) */}
                      {customCategories.map(cat => (
                        <div key={cat} className={`custom-cat-chip ${formData.categories.includes(cat) ? "sel" : ""}`}>
                          <span className="cat-chip-emoji">🏷️</span>
                          <span className="custom-cat-chip-label">{cat}</span>
                          <button
                            type="button"
                            className="custom-cat-chip-remove"
                            title="Remove"
                            onClick={() => removeCustomCategory(cat)}
                          >✕</button>
                        </div>
                      ))}
                    </div>

                    {/* Custom category input */}
                    <CustomTagInput
                      placeholder='Type a custom category & press Enter (e.g. "DJ", "Chef")'
                      label="custom category"
                      onAdd={addCustomCategory}
                    />
                    <div className="custom-tag-hint">
                      💡 Can't find your category above? Type it here and press Enter or click + Add
                    </div>
                  </div>

                  {/* STEP 2 — Sub Category (appears only when category selected) */}
                  {formData.categories.length > 0 && (
                    <div className="subcat-section">
                      <div className="subcat-header">
                        🎯 Select Sub Type
                      </div>

                      {/* Preset sub-categories grouped by parent */}
                      {formData.categories.map(catVal => {
                        const catInfo = MAIN_CATEGORIES.find(c => c.value === catVal);
                        const subs    = SUB_CATEGORY_MAP[catVal] || [];
                        // skip custom categories (no preset subs)
                        if (subs.length === 0) return null;
                        return (
                          <div key={catVal} className="subcat-group">
                            <div className="subcat-group-label">
                              {catInfo?.emoji} {catInfo?.label}
                            </div>
                            <div className="subcat-chips">
                              {subs.map(sub => (
                                <button key={sub} type="button"
                                  className={`subcat-chip ${formData.subCategories.includes(sub) ? "sel" : ""}`}
                                  onClick={() => toggleSubCategory(sub)}>
                                  {sub}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {/* Custom sub-category chips */}
                      {customSubCategories.length > 0 && (
                        <div className="subcat-group">
                          <div className="subcat-group-label">🏷️ Custom Sub Types</div>
                          <div className="subcat-chips">
                            {customSubCategories.map(sub => (
                              <div key={sub} className={`subcat-chip-custom ${formData.subCategories.includes(sub) ? "sel" : ""}`}>
                                {sub}
                                <button
                                  type="button"
                                  className="subcat-chip-custom-remove"
                                  title="Remove"
                                  onClick={() => removeCustomSubCategory(sub)}
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom sub-category input */}
                      <div className="subcat-custom-section">
                        <div className="subcat-custom-label">✏️ Add Custom Sub Type</div>
                        <CustomTagInput
                          placeholder='e.g. "Kids Photographer", "Podcast Host"...'
                          label="custom sub type"
                          onAdd={addCustomSubCategory}
                        />
                        <div className="custom-tag-hint" style={{ marginTop: 6 }}>
                          💡 Don't see the right sub type? Add your own above
                        </div>
                      </div>

                      {allSelectedSubCategories.length === 0 && customSubCategories.length === 0 && (
                        <div className="subcat-none">No sub type selected — all types will be matched</div>
                      )}
                    </div>
                  )}


                </div>

                <div className="pcp-actions">
                  <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
                  <button type="submit" className="pcp-btn-submit" disabled={loading}>
                    {loading ? <><span className="pcp-spinner" /> Creating...</> : "Create Campaign 🚀"}
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

// const API          = "https://api.collabzy.in/api/campaigns";
// const API_BASE     = "https://api.collabzy.in/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
// const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";

// const TOKENS_PER_CAMPAIGN = 100;

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; price: string; tokens: number }> = {
//   free:             { label: "Free",  campaigns: 2,   price: "₹0",      tokens: 200   },
//   pro:              { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
//   pro_plus:         { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
//   pro_year:         { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
//   pro_plus_year:    { label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
//   pro_monthly:      { label: "Pro",   campaigns: 10,  price: "₹599",    tokens: 1000  },
//   pro_plus_monthly: { label: "Pro+",  campaigns: 25,  price: "₹1,099",  tokens: 2500  },
//   pro_yearly:       { label: "Pro",   campaigns: 120, price: "₹6,499",  tokens: 12000 },
//   pro_plus_yearly:  { label: "Pro+",  campaigns: 250, price: "₹11,999", tokens: 25000 },
// };

// const SUGGESTED_CATEGORIES = [
//   "fashion","fitness","tech","food","travel","beauty",
//   "lifestyle","gaming","education","health","finance",
//   "music","sports","art","photography",
// ];
// const ROLE_OPTIONS = ["influencers"];

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   const map: Record<string, string> = {
//     pro_monthly:      "pro_monthly",
//     pro_plus_monthly: "pro_plus_monthly",
//     pro_yearly:       "pro_yearly",
//     pro_plus_yearly:  "pro_plus_yearly",
//     pro:              "pro_monthly",
//     pro_plus:         "pro_plus_monthly",
//     "pro+":           "pro_plus_monthly",
//     pro_year:         "pro_yearly",
//     pro_plus_year:    "pro_plus_yearly",
//   };
//   return map[v] ?? "free";
// };

// const getPlanInfo = (planStr: string | null) => {
//   if (!planStr) return PLAN_LIMITS["free"];
//   return PLAN_LIMITS[toCanonical(planStr)] ?? PLAN_LIMITS["free"];
// };

// const isPaidPlan = (planStr: string | null): boolean => {
//   if (!planStr) return false;
//   return toCanonical(planStr) !== "free";
// };

// const upgradePlans = [
//   { id: "pro",      name: "Pro",  price: "₹599/mo",   originalPrice: "₹1,000", tokens: 1000, popular: true  },
//   { id: "pro_plus", name: "Pro+", price: "₹1,099/mo", originalPrice: "₹2,000", tokens: 2500, popular: false },
// ];

// // ─── Helper: localStorage update + navbar event ───────────────────────────────
// function syncUserToStorage(updates: Record<string, any>) {
//   try {
//     const raw = localStorage.getItem("cb_user");
//     const base = raw ? JSON.parse(raw) : {};
//     const merged = { ...base, ...updates, _updatedAt: Date.now() };
//     localStorage.setItem("cb_user", JSON.stringify(merged));
//     // Always fire — no early return before this
//     window.dispatchEvent(
//       new CustomEvent("plan_updated", {
//         detail: { refresh: true, bits: merged.bits, time: Date.now() },
//       })
//     );
//     return merged;
//   } catch {
//     return null;
//   }
// }

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(false);
//   const [checking, setChecking] = useState(true);

//   const [activePlan, setActivePlan]           = useState<string>("free");
//   const [availableTokens, setAvailableTokens] = useState<number>(0);
//   const [tokensLoaded, setTokensLoaded]       = useState(false);

//   const [showUpgradeModal, setShowUpgradeModal] = useState(false);
//   const [loadingPlan, setLoadingPlan]           = useState<string | null>(null);
//   const [selectedPlan, setSelectedPlan]         = useState<string>("pro");

//   const [categoryInput, setCategoryInput] = useState("");
//   const [showSuggestions, setShowSuggestions] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "", description: "", budget: "", city: "",
//     categories: [] as string[], roles: [] as string[],
//   });

//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   // ── Fetch live tokens from backend ───────────────────────────
//   const fetchLiveTokens = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const b = data?.user?.bits ?? data?.profile?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         const newBits = Number(b);
//         setAvailableTokens(newBits);
//         syncUserToStorage({ bits: newBits });
//       } else {
//         const raw = localStorage.getItem("cb_user");
//         if (raw) setAvailableTokens(Number(JSON.parse(raw).bits ?? 0));
//       }
//     } catch {
//       const raw = localStorage.getItem("cb_user");
//       if (raw) setAvailableTokens(Number(JSON.parse(raw).bits ?? 0));
//     } finally {
//       setTokensLoaded(true);
//     }
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }

//     setUser(parsed);
//     const plan = parsed.plan || parsed.activePlan || "free";
//     setActivePlan(plan);
//     if (parsed.bits != null) setAvailableTokens(Number(parsed.bits));

//     const token = parsed.token || localStorage.getItem("token");
//     if (token) fetchLiveTokens(token);
//     setChecking(false);
//   }, []);

//   // ── Category helpers ─────────────────────────────────────────
//   const addCategory = (cat: string) => {
//     const trimmed = cat.trim().toLowerCase();
//     if (!trimmed || formData.categories.includes(trimmed)) return;
//     setFormData(prev => ({ ...prev, categories: [...prev.categories, trimmed] }));
//     setCategoryInput("");
//     setShowSuggestions(false);
//   };

//   const removeCategory = (cat: string) =>
//     setFormData(prev => ({ ...prev, categories: prev.categories.filter(c => c !== cat) }));

//   const handleCategoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
//     if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addCategory(categoryInput); }
//     if (e.key === "Backspace" && !categoryInput && formData.categories.length > 0)
//       removeCategory(formData.categories[formData.categories.length - 1]);
//   };

//   const filteredSuggestions = SUGGESTED_CATEGORIES.filter(
//     s => s.includes(categoryInput.toLowerCase()) && !formData.categories.includes(s)
//   );

//   const toggleRole = (value: string) =>
//     setFormData(prev => ({
//       ...prev,
//       roles: prev.roles.includes(value)
//         ? prev.roles.filter(v => v !== value)
//         : [...prev.roles, value],
//     }));

//   // ── Computed values ───────────────────────────────────────────
//   const planInfo          = getPlanInfo(activePlan);
//   const isSubscribed      = isPaidPlan(activePlan);
//   const campaignsPossible = Math.floor(availableTokens / TOKENS_PER_CAMPAIGN);
//   const isAtLimit         = tokensLoaded && campaignsPossible === 0;
//   const isLow             = campaignsPossible <= 2 && campaignsPossible > 0;
//   const barColor          = isAtLimit ? "#ef4444" : isLow ? "#f59e0b" : "#4f46e5";
//   const barPercent        = planInfo.tokens > 0
//     ? Math.min(100, (availableTokens / planInfo.tokens) * 100)
//     : Math.min(100, (availableTokens / 200) * 100);

//   const selected = upgradePlans.find(p => p.id === selectedPlan) ?? upgradePlans[0];

//   // ── Submit ────────────────────────────────────────────────────
//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     // Double-submit guard
//     if (loading) return;

//     if (availableTokens < TOKENS_PER_CAMPAIGN) {
//       showToast(`Need ${TOKENS_PER_CAMPAIGN} tokens to post. You have ${availableTokens}.`, "error");
//       setShowUpgradeModal(true);
//       return;
//     }
//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       showToast("Please fill all required fields.", "error");
//       return;
//     }
//     if (formData.roles.length === 0) {
//       showToast("Select at least one target role.", "error");
//       return;
//     }

//     try {
//       setLoading(true);

//       // Single token variable — no redeclaration anywhere below
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
//         if (res.status === 403) { setShowUpgradeModal(true); return; }
//         throw new Error(data.message || "Failed to create campaign.");
//       }

//       // ── Sync real bits from backend ───────────────────────────
//       let newBits = Math.max(0, availableTokens - TOKENS_PER_CAMPAIGN); // fallback optimistic

//       try {
//         const profileRes  = await fetch(`${API_BASE}/profile/me`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const profileData = await profileRes.json();
//         const backendBits = profileData?.user?.bits ?? profileData?.profile?.bits ?? profileData?.bits ?? null;
//         if (backendBits !== null) newBits = Number(backendBits);
//       } catch {
//         // backend fail → use optimistic value already set above
//       }

//       // ── Update state ──────────────────────────────────────────
//       setAvailableTokens(newBits);

//       // ── Update localStorage AND fire navbar event (guaranteed, no early return) ──
//       syncUserToStorage({ bits: newBits });

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
//       key:             RAZORPAY_KEY,
//       subscription_id: subscriptionId,
//       name:            "Influex Premium",
//       description:     `${planName} Plan`,
//       theme:           { color: "#4f46e5" },
//       prefill:         { name: parsed?.name || "", email: parsed?.email || "" },
//       handler: async (response: any) => {
//         try {
//           await fetch(`${API_BASE}/subscription/verify`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//             body: JSON.stringify({ ...response, plan_id: PLAN_ID, planName }),
//           });
//         } catch {}

//         const planDbMap: Record<string, string> = {
//           pro:           "pro_monthly",
//           pro_plus:      "pro_plus_monthly",
//           pro_year:      "pro_yearly",
//           pro_plus_year: "pro_plus_yearly",
//         };
//         const canonicalPlan = planDbMap[planId] || planId;

//         const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//           body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
//         });
//         const aData = await aRes.json();

//         if (aData.success) {
//           const newBits = PLAN_LIMITS[canonicalPlan]?.tokens ?? 0;
//           const updated = {
//             ...parsed,
//             isSubscribed:     true,
//             activePlan:       canonicalPlan,
//             plan:             canonicalPlan,
//             planActivatedAt:  new Date().toISOString(),
//             bits:             newBits,
//           };
//           localStorage.setItem("cb_user", JSON.stringify(updated));
//           setUser(updated);
//           setActivePlan(canonicalPlan);
//           setAvailableTokens(newBits);
//           setShowUpgradeModal(false);
//           // Fire navbar update
//           window.dispatchEvent(
//             new CustomEvent("plan_updated", {
//               detail: { refresh: true, bits: newBits, time: Date.now() },
//             })
//           );
//           showToast(`🎉 ${planName} activated!`, "success");
//         } else {
//           showToast("Activation failed. Contact support.", "error");
//         }
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
//     rzp.on("payment.failed", (r: any) => {
//       showToast(`Payment failed: ${r.error.description}`, "error");
//       setLoadingPlan(null);
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
//         showToast(data.message || "Failed to create subscription.", "error");
//         setLoadingPlan(null);
//         return;
//       }
//       openRazorpay(data.subscription.id, planId, planName);
//     } catch {
//       showToast("Something went wrong.", "error");
//       setLoadingPlan(null);
//     }
//   };

//   // ── Loading / auth guard ──────────────────────────────────────
//   if (checking) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );
//   if (!user) return null;

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
//         .token-bar{display:flex;align-items:center;gap:14px;border-radius:14px;padding:14px 18px;margin-bottom:28px;border:1.5px solid #ebebeb;background:#fafafa;transition:all 0.2s}
//         .token-bar.low{background:#fffbeb;border-color:#fde68a}
//         .token-bar.empty{background:#fff5f5;border-color:#fecaca}
//         .token-bar.good{background:#f0fdf4;border-color:#86efac}
//         .token-icon{font-size:24px;flex-shrink:0}
//         .token-info{flex:1;min-width:0}
//         .token-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
//         .token-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#aaa}
//         .token-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;color:#fff}
//         .token-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .token-fill{height:100%;border-radius:100px;transition:width 0.6s}
//         .token-text{font-size:12px;font-weight:500}
//         .token-btn{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;white-space:nowrap;transition:all 0.2s;flex-shrink:0}
//         .token-btn.normal{color:#4f46e5;background:#eef2ff}.token-btn.normal:hover{background:#e0e7ff}
//         .token-btn.warn{color:#d97706;background:#fef3c7}
//         .token-btn.danger{color:#dc2626;background:#fee2e2}
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
//         .cat-wrap{position:relative}
//         .cat-box{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border:1.5px solid #e5e7eb;border-radius:12px;min-height:46px;background:#fff;cursor:text;transition:border-color 0.2s}
//         .cat-box:focus-within{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
//         .cat-tag{display:inline-flex;align-items:center;gap:4px;background:#eef2ff;color:#4f46e5;border-radius:100px;padding:3px 10px;font-size:12px;font-weight:600;text-transform:capitalize}
//         .cat-tag-x{background:none;border:none;cursor:pointer;color:#4f46e5;font-size:14px;line-height:1;padding:0;display:flex;align-items:center;opacity:0.6}
//         .cat-tag-x:hover{opacity:1}
//         .cat-input{border:none;outline:none;font-size:13px;font-family:'DM Sans',sans-serif;color:#111;background:transparent;min-width:120px;flex:1;padding:2px 4px}
//         .cat-input::placeholder{color:#9ca3af}
//         .cat-suggestions{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1.5px solid #e5e7eb;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);z-index:100;max-height:200px;overflow-y:auto;padding:6px}
//         .cat-suggestion{padding:8px 12px;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;cursor:pointer;color:#374151;text-transform:capitalize;transition:background 0.15s}
//         .cat-suggestion:hover{background:#f5f5f5}
//         .cat-hint{font-size:11px;color:#aaa;margin-top:4px}
//         .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
//         .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
//         .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
//         .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}
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
//         .up-token-pill{display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 16px;margin-bottom:20px}
//         .up-token-label{font-size:12px;color:rgba(255,255,255,0.4)}
//         .up-token-val{font-size:13px;font-weight:600;color:rgba(255,255,255,0.8)}
//         .up-token-need{font-size:12px;color:#f87171;font-weight:600}
//         .up-plan-cards{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
//         .up-plan-card{border-radius:14px;padding:16px 18px;border:1.5px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative}
//         .up-plan-card:hover{border-color:rgba(79,70,229,0.5);background:rgba(79,70,229,0.08)}
//         .up-popular-tag{position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:10px;font-weight:700;padding:3px 12px;border-radius:100px;white-space:nowrap}
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

//       {/* ── UPGRADE MODAL ── */}
//       {showUpgradeModal && (
//         <div className="up-overlay" onClick={() => setShowUpgradeModal(false)}>
//           <div className="up-modal" onClick={e => e.stopPropagation()}>
//             <button className="up-modal-close" onClick={() => setShowUpgradeModal(false)}>✕</button>
//             <div className="up-modal-icon">🪙</div>
//             <div className="up-modal-title">Not Enough Tokens</div>
//             <div className="up-modal-sub">
//               Posting a campaign requires{" "}
//               <strong style={{ color: "#fff" }}>{TOKENS_PER_CAMPAIGN} tokens</strong>   You currently have .<br />
//               {" "}
//               Tokens can also be used to unlock email and Instagram details.
//             </div>
//             <div className="up-token-pill">
//               <div>
//                 <div className="up-token-label">Available Tokens</div>
//                 <div className="up-token-val">{availableTokens} tokens</div>
//               </div>
//               <div className="up-token-need">Need {TOKENS_PER_CAMPAIGN}</div>
//             </div>
//             <div className="up-plan-cards">
//               {upgradePlans.map(plan => (
//                 <div
//                   key={plan.id}
//                   className="up-plan-card"
//                   onClick={() => setSelectedPlan(plan.id)}
//                   style={
//                     selectedPlan === plan.id
//                       ? { borderColor: "rgba(79,70,229,0.7)", background: "rgba(79,70,229,0.12)" }
//                       : {}
//                   }
//                 >
//                   {plan.popular && <div className="up-popular-tag">POPULAR</div>}
//                   <div>
//                     <div className="up-plan-name">{plan.name}</div>
//                     <div className="up-plan-desc">
//                       {plan.tokens.toLocaleString("en-IN")} tokens ·{" "}
//                       ~{Math.floor(plan.tokens / TOKENS_PER_CAMPAIGN)} campaigns possible
//                     </div>
//                   </div>
//                   <div style={{ textAlign: "right", flexShrink: 0 }}>
//                     <div className="up-plan-og">{plan.originalPrice}</div>
//                     <div className="up-plan-price">{plan.price}</div>
//                   </div>
//                   <div
//                     style={{
//                       width: 18, height: 18, borderRadius: "50%",
//                       border: `2px solid ${selectedPlan === plan.id ? "#4f46e5" : "rgba(255,255,255,0.2)"}`,
//                       background: selectedPlan === plan.id ? "#4f46e5" : "transparent",
//                       display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
//                     }}
//                   >
//                     {selectedPlan === plan.id && (
//                       <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />
//                     )}
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <button
//               className="up-plan-btn"
//               disabled={loadingPlan !== null}
//               onClick={() => handleSubscribe(selected.id, selected.name)}
//             >
//               {loadingPlan === selected.id
//                 ? <><span className="mini-spin" /> Processing...</>
//                 : `Upgrade to ${selected.name} — ${selected.price}`}
//             </button>
//             <button className="up-modal-skip" onClick={() => setShowUpgradeModal(false)}>
//               Maybe later
//             </button>
//             <div className="up-secure">🔒 Secured by Razorpay</div>
//           </div>
//         </div>
//       )}

//       <div className="pcp">
//         <div className="pcp-inner">
//           <div className="pcp-card">
//             <h1 className="pcp-title">Create Campaign</h1>
//             <p className="pcp-sub">Find the right creators for your brand</p>

//             {/* TOKEN BALANCE BAR */}
//             <div className={`token-bar ${isAtLimit ? "empty" : isLow ? "low" : isSubscribed ? "good" : ""}`}>
//               <div className="token-icon">🪙</div>
//               <div className="token-info">
//                 <div className="token-top">
//                   <span className="token-label">Token Balance</span>
//                   {isSubscribed && (
//                     <span
//                       className="token-badge"
//                       style={{
//                         background: activePlan?.includes("plus")
//                           ? "linear-gradient(135deg,#7c3aed,#ec4899)"
//                           : "linear-gradient(135deg,#4f46e5,#7c3aed)",
//                       }}
//                     >
//                       {planInfo.label}
//                     </span>
//                   )}
//                 </div>
//                 <div className="token-track">
//                   <div className="token-fill" style={{ width: `${barPercent}%`, background: barColor }} />
//                 </div>
//                 <div className="token-text" style={{ color: barColor }}>
//                   {isAtLimit
//                     ? `⚠️ ${availableTokens} tokens — need ${TOKENS_PER_CAMPAIGN} to post a campaign`
//                     : isLow
//                     ? `⚡ ${availableTokens} tokens left — can post ${campaignsPossible} more campaign${campaignsPossible === 1 ? "" : "s"}`
//                     : `${availableTokens} tokens available — can post ${campaignsPossible} campaign${campaignsPossible === 1 ? "" : "s"} (${TOKENS_PER_CAMPAIGN} each)`}
//                 </div>
//               </div>
//               <button
//                 className={`token-btn ${isAtLimit ? "danger" : isLow ? "warn" : "normal"}`}
//                 onClick={() => setShowUpgradeModal(true)}
//               >
//                 {isAtLimit ? "Get Tokens!" : isLow ? "Top Up ⚡" : "Upgrade ✦"}
//               </button>
//             </div>

//             {/* BLOCKED STATE */}
//             {isAtLimit ? (
//               <div className="pcp-blocked">
//                 <div className="pcp-blocked-icon">🪙</div>
//                 <h2 className="pcp-blocked-title">Not Enough Tokens</h2>
//                 <p className="pcp-blocked-sub">
//                     Posting a campaign requires <strong>{TOKENS_PER_CAMPAIGN} tokens</strong>  You currently have<br />
//                    <strong>{availableTokens} tokens</strong> available.<br />
//                   Tokens can also be used to unlock email and Instagram details.
//                 </p>
//                 <button className="pcp-blocked-btn" onClick={() => setShowUpgradeModal(true)}>
//                   ⚡ Get More Tokens →
//                 </button>
//               </div>
//             ) : (
//               <form onSubmit={handleSubmit} className="pcp-form">
//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Campaign Info</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Title <span className="req">*</span></label>
//                     <input
//                       className="pcp-input"
//                       type="text"
//                       placeholder="e.g. Summer Fashion Shoot"
//                       value={formData.title}
//                       onChange={e => setFormData({ ...formData, title: e.target.value })}
//                       required
//                     />
//                   </div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Description <span className="req">*</span></label>
//                     <textarea
//                       className="pcp-input pcp-textarea"
//                       rows={4}
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
//                         className="pcp-input"
//                         type="number"
//                         min={0}
//                         placeholder="e.g. 5000"
//                         value={formData.budget}
//                         onChange={e => setFormData({ ...formData, budget: e.target.value })}
//                         required
//                       />
//                     </div>
//                     <div className="pcp-field">
//                       <label className="pcp-label">City <span className="req">*</span></label>
//                       <input
//                         className="pcp-input"
//                         type="text"
//                         placeholder="e.g. Indore, Mumbai, Delhi..."
//                         value={formData.city}
//                         onChange={e => setFormData({ ...formData, city: e.target.value })}
//                         required
//                       />
//                     </div>
//                   </div>
//                   <div
//                     style={{
//                       display: "flex", alignItems: "center", gap: 6, borderRadius: 10,
//                       padding: "10px 14px", fontSize: 13,
//                       background: isLow ? "#fffbeb" : "#f8f7ff",
//                       border: `1px solid ${isLow ? "#fde68a" : "#e8e5ff"}`,
//                       color: isLow ? "#92400e" : "#7c3aed", marginTop: 4,
//                     }}
//                   >
//                     🪙 This campaign costs{" "}
//                     <strong style={{ margin: "0 3px" }}>{TOKENS_PER_CAMPAIGN} tokens</strong> · You have{" "}
//                     <strong style={{ margin: "0 3px", color: isLow ? "#d97706" : "#4f46e5" }}>
//                       {availableTokens}
//                     </strong>{" "}
//                     remaining after this:{" "}
//                     <strong style={{ margin: "0 3px" }}>
//                       {Math.max(0, availableTokens - TOKENS_PER_CAMPAIGN)}
//                     </strong>
//                   </div>
//                 </div>

//                 <div className="pcp-section">
//                   <div className="pcp-section-label">Targeting</div>
//                   <div className="pcp-field">
//                     <label className="pcp-label">Categories</label>
//                     <div className="cat-wrap">
//                       <div
//                         className="cat-box"
//                         onClick={() => (document.getElementById("cat-input") as HTMLInputElement)?.focus()}
//                       >
//                         {formData.categories.map(cat => (
//                           <span key={cat} className="cat-tag">
//                             {cat}
//                             <button type="button" className="cat-tag-x" onClick={() => removeCategory(cat)}>×</button>
//                           </span>
//                         ))}
//                         <input
//                           id="cat-input"
//                           className="cat-input"
//                           placeholder={formData.categories.length === 0 ? "Type or select categories..." : "Add more..."}
//                           value={categoryInput}
//                           onChange={e => { setCategoryInput(e.target.value); setShowSuggestions(true); }}
//                           onKeyDown={handleCategoryKeyDown}
//                           onFocus={() => setShowSuggestions(true)}
//                           onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
//                           autoComplete="off"
//                         />
//                       </div>
//                       {showSuggestions && filteredSuggestions.length > 0 && (
//                         <div className="cat-suggestions">
//                           {filteredSuggestions.map(s => (
//                             <div key={s} className="cat-suggestion" onMouseDown={() => addCategory(s)}>{s}</div>
//                           ))}
//                         </div>
//                       )}
//                     </div>
//                     <div className="cat-hint">Press Enter or comma to add · Koi bhi custom category type kar sakte hain</div>
//                   </div>
//                   <div className="pcp-field" style={{ marginBottom: 0 }}>
//                     <label className="pcp-label">Target Roles <span className="req">*</span></label>
//                     <div className="pcp-chips">
//                       {ROLE_OPTIONS.map(r => (
//                         <button
//                           key={r}
//                           type="button"
//                           className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`}
//                           onClick={() => toggleRole(r)}
//                          >
//                         {r}
//                         </button>
//                       ))}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="pcp-actions">
//                   <button
//                     type="button"
//                     className="pcp-btn-cancel"
//                     onClick={() => router.push("/campaigns")}
//                   >
//                     Cancel
//                   </button>
//                   <button type="submit" className="pcp-btn-submit" disabled={loading}>
//                     {loading
//                       ? <><span className="pcp-spinner" /> Creating...</>
//                       : "Create Campaign 🚀"}
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


