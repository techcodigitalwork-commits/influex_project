"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API          = "http://54.252.201.93:5000/api/campaigns";
const API_BASE     = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";
const FREE_COINS    = 100;
const COINS_PER_CAM = 20;

const CITY_OPTIONS     = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
const ROLE_OPTIONS     = ["influencers", "brand"];

export default function PostCampaignPage() {
  const router = useRouter();

  const [user, setUser]           = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [checking, setChecking]   = useState(true);
  const [coins, setCoins]         = useState<number>(FREE_COINS);
  const [isSubscribed, setIsSubscribed]     = useState(false);
  const [showCoinModal, setShowCoinModal]   = useState(false);
  const [loadingPlan, setLoadingPlan]       = useState<string | null>(null);
  const [formData, setFormData]   = useState({
    title: "", description: "", budget: "", city: "",
    categories: [] as string[], roles: [] as string[],
  });
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch bits from backend — try multiple endpoints
  const fetchBitsFromBackend = (token: string, localBits: number) => {
    // Fetch bits from /profile/me
    const tryEndpoints = [
      `${API_BASE}/profile/me`,
    ];

    const tryNext = (index: number) => {
      if (index >= tryEndpoints.length) {
        // All endpoints failed or returned no bits — keep localStorage value
        setChecking(false);
        return;
      }
      fetch(tryEndpoints[index], { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          // Search for bits in every possible location
          const bits =
            data?.bits ??
            data?.user?.bits ??
            data?.profile?.bits ??
            data?.data?.bits ??
            null;

          const sub =
            data?.isSubscribed ??
            data?.profile?.isSubscribed ??
            data?.user?.isSubscribed ??
            false;

          console.log(`[coins] ${tryEndpoints[index]} →`, data, "| bits found:", bits);

          if (bits !== null && bits !== undefined) {
            setCoins(bits);
            setIsSubscribed(sub);
            const stored = localStorage.getItem("cb_user");
            const p = stored ? JSON.parse(stored) : {};
            localStorage.setItem("cb_user", JSON.stringify({ ...p, bits, coins: bits, isSubscribed: sub }));
          } else {
            // This endpoint didn't have bits — try next
            tryNext(index + 1);
          }
          setChecking(false);
        })
        .catch(() => tryNext(index + 1));
    };

    tryNext(0);
  };

  useEffect(() => {
    const stored = localStorage.getItem("cb_user");
    if (!stored) { router.push("/login"); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }
    setUser(parsed);
    const token = parsed.token || localStorage.getItem("token");

    // Show localStorage value immediately (fast)
    const localBits = parsed.bits ?? parsed.coins ?? FREE_COINS;
    setCoins(localBits);
    setIsSubscribed(parsed.isSubscribed ?? false);

    // Then get accurate value from backend
    fetchBitsFromBackend(token, localBits);
  }, []);

  const toggleChip = (field: "categories" | "roles", value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSubscribed && coins < COINS_PER_CAM) { setShowCoinModal(true); return; }
    if (!formData.title || !formData.description || !formData.budget || !formData.city) {
      showToast("Please fill all required fields", "error"); return;
    }
    if (formData.roles.length === 0) { showToast("Select at least one role", "error"); return; }

    try {
      setLoading(true);
      const token = user.token || localStorage.getItem("token");
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: formData.title.trim(), description: formData.description.trim(),
          budget: Number(formData.budget), city: formData.city,
          categories: formData.categories, roles: formData.roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) { setShowCoinModal(true); setLoading(false); return; }
        throw new Error(data.message || "Failed to create campaign");
      }

      // Deduct coins immediately — backend already deducted, sync localStorage
      if (!isSubscribed) {
        // If backend returned updated bits use it, else subtract locally
        const newCoins = (data.bits !== undefined && data.bits !== null)
          ? data.bits
          : Math.max(0, coins - COINS_PER_CAM);
        setCoins(newCoins);
        const stored2 = localStorage.getItem("cb_user");
        const p2 = stored2 ? JSON.parse(stored2) : {};
        localStorage.setItem("cb_user", JSON.stringify({ ...p2, bits: newCoins, coins: newCoins }));
        console.log("[coins] Campaign created. New bits:", newCoins);
        if (newCoins < COINS_PER_CAM) setTimeout(() => setShowCoinModal(true), 1200);
      }

      showToast("Campaign Created Successfully 🚀", "success");
      setTimeout(() => router.push("/campaigns"), 1200);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Razorpay ──
  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const stored = localStorage.getItem("cb_user");
    const parsed = JSON.parse(stored || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    const options = {
      key: RAZORPAY_KEY, subscription_id: subscriptionId,
      name: "Influex Premium", description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: parsed?.name || "", email: parsed?.email || "" },
      handler: async function (response: any) {
        try {
          await fetch(`${API_BASE}/subscription/verify`, {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id, razorpay_subscription_id: response.razorpay_subscription_id, razorpay_signature: response.razorpay_signature, plan_id: PLAN_ID, planName }),
          });
        } catch {}
        const aRes  = await fetch(`${API_BASE}/subscription/activate`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
        });
        const aData = await aRes.json();
        if (aData.success) {
          const updated = { ...parsed, isSubscribed: true, activePlan: planId, coins: 99999, bits: 99999 };
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setUser(updated); setIsSubscribed(true); setCoins(99999); setShowCoinModal(false);
          showToast(`🎉 ${planName} activated!`, "success");
        } else { showToast("Activation failed.", "error"); }
        setLoadingPlan(null);
      },
      modal: { ondismiss: () => { showToast("Payment cancelled.", "error"); setLoadingPlan(null); } },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", (r: any) => { showToast(`Payment failed: ${r.error.description}`, "error"); setLoadingPlan(null); });
    rzp.open();
  };

  const handleSubscribe = async (planId: string, planName: string) => {
    const stored = localStorage.getItem("cb_user");
    const parsed = JSON.parse(stored || "{}");
    const t      = parsed.token || localStorage.getItem("token");
    if (!t) { showToast("Session expired.", "error"); return; }
    setLoadingPlan(planId);
    try {
      const res  = await fetch(`${API_BASE}/subscription/create`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ plan_id: PLAN_ID }),
      });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) { showToast(data.message || "Failed.", "error"); setLoadingPlan(null); return; }
      openRazorpay(data.subscription.id, planId, planName);
    } catch { showToast("Something went wrong.", "error"); setLoadingPlan(null); }
  };

  const coinsPercent = Math.max(0, Math.min(100, (coins / FREE_COINS) * 100));
  const coinsLow     = !isSubscribed && coins <= 40 && coins >= COINS_PER_CAM;
  const coinsEmpty   = !isSubscribed && coins < COINS_PER_CAM;
  const camsLeft     = isSubscribed ? "∞" : Math.floor(coins / COINS_PER_CAM);
  const usageColor   = coinsEmpty ? "#ef4444" : coinsLow ? "#f59e0b" : "#4f46e5";

  if (checking) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "28px", height: "28px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!user) return null;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

        .pcp{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .pcp-inner{max-width:720px;margin:0 auto;padding:40px 20px 80px}
        @media(max-width:600px){.pcp-inner{padding:24px 16px 60px}}
        .pcp-card{background:#fff;border-radius:24px;padding:40px;border:1px solid #ebebeb;box-shadow:0 2px 20px rgba(0,0,0,0.05)}
        @media(max-width:600px){.pcp-card{padding:24px 20px;border-radius:18px}}
        .pcp-title{font-size:26px;font-weight:600;color:#111;margin:0 0 6px}
        .pcp-sub{font-size:14px;color:#999;margin:0 0 28px}

        .pcp-coin-bar{display:flex;align-items:center;gap:14px;background:#fafafa;border:1.5px solid #ebebeb;border-radius:14px;padding:14px 18px;margin-bottom:28px;cursor:pointer;transition:border-color 0.2s}
        .pcp-coin-bar:hover{border-color:#4f46e5}
        .pcp-coin-bar.warn{background:#fffbeb;border-color:#fde68a}
        .pcp-coin-bar.empty{background:#fff5f5;border-color:#fecaca}
        .pcp-coin-bar.pro{background:#f0fdf4;border-color:#86efac;cursor:default}
        .pcp-coin-icon{font-size:24px}
        .pcp-coin-info{flex:1}
        .pcp-coin-label{font-size:11px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
        .pcp-coin-track{height:5px;background:#e8e8e8;border-radius:100px;overflow:hidden;margin-bottom:4px}
        .pcp-coin-fill{height:100%;border-radius:100px;transition:width 0.5s}
        .pcp-coin-count{font-size:12px;font-weight:500}
        .pcp-upgrade-tag{font-size:12px;font-weight:600;padding:5px 12px;border-radius:8px;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;color:#4f46e5;background:#eef2ff;white-space:nowrap}
        .pcp-upgrade-tag.warn-tag{color:#d97706;background:#fef3c7}
        .pcp-upgrade-tag.empty-tag{color:#dc2626;background:#fee2e2}

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
        .pcp-select{width:100%;padding:12px 40px 12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;background:#fff;outline:none;appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
        .pcp-select:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,0.08)}
        .pcp-chips{display:flex;flex-wrap:wrap;gap:8px}
        .pcp-chip{padding:8px 16px;border-radius:100px;border:1.5px solid #e5e7eb;background:#fff;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;cursor:pointer;transition:all 0.15s;text-transform:capitalize}
        .pcp-chip:hover{border-color:#4f46e5;color:#4f46e5}
        .pcp-chip.sel{background:#4f46e5;border-color:#4f46e5;color:#fff}

        .pcp-coin-cost-note{display:flex;align-items:center;gap:6px;background:#fafafa;border:1px solid #f0f0f0;border-radius:10px;padding:10px 14px;font-size:13px;color:#888;margin-top:4px}
        .pcp-coin-cost-note.low-note{background:#fffbeb;border-color:#fde68a;color:#92400e}

        .pcp-actions{display:flex;justify-content:space-between;align-items:center;padding-top:28px;border-top:1px solid #f3f4f6;gap:12px}
        .pcp-btn-cancel{padding:12px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;color:#6b7280;background:#f3f4f6;border:none;cursor:pointer}
        .pcp-btn-cancel:hover{background:#e5e7eb}
        .pcp-btn-submit{padding:12px 32px;border-radius:12px;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;color:#fff;background:#4f46e5;border:none;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;gap:8px}
        .pcp-btn-submit:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
        .pcp-btn-submit:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .pcp-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite}

        .pcp-blocked{text-align:center;padding:56px 24px}
        .pcp-blocked-icon{font-size:52px;margin-bottom:18px}
        .pcp-blocked-title{font-size:22px;font-weight:600;color:#111;margin:0 0 10px}
        .pcp-blocked-sub{font-size:14px;color:#888;line-height:1.7;margin:0 0 28px}
        .pcp-blocked-btn{display:inline-flex;align-items:center;gap:6px;padding:13px 32px;border-radius:12px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer}
        .pcp-blocked-btn:hover{background:#4338ca}

        .coin-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
        .coin-modal{background:#fff;border-radius:24px;max-width:420px;width:100%;padding:36px 32px 30px;position:relative;text-align:center;animation:slideUp 0.25s ease}
        .coin-modal-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#aaa}
        .coin-modal-icon{font-size:52px;margin-bottom:14px;line-height:1}
        .coin-modal-title{font-size:22px;font-weight:700;color:#111;margin-bottom:8px}
        .coin-modal-sub{font-size:14px;color:#777;line-height:1.65;margin-bottom:10px}
        .coin-modal-prog-wrap{margin:14px 0 22px}
        .coin-modal-prog-top{display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:6px}
        .coin-modal-prog{height:8px;background:#f0f0f0;border-radius:100px;overflow:hidden}
        .coin-modal-prog-fill{height:100%;border-radius:100px;transition:width 0.6s ease}
        .coin-plan-btn{width:100%;padding:14px 20px;border-radius:14px;border:none;font-size:15px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
        .coin-plan-btn:hover{box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
        .coin-plan-btn:disabled{opacity:0.65;cursor:not-allowed;transform:none}
        .coin-modal-skip{font-size:13px;color:#ccc;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-decoration:underline}
        .coin-modal-secure{font-size:11px;color:#ddd;margin-top:10px}
        .mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:6px;vertical-align:middle}

        .pcp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.14)}
        .pcp-toast.success{background:#111;color:#fff}
        .pcp-toast.error{background:#ef4444;color:#fff}
      `}</style>

      {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

      {showCoinModal && (
        <div className="coin-modal-overlay">
          <div className="coin-modal">
            <button className="coin-modal-close" onClick={() => setShowCoinModal(false)}>✕</button>
            <div className="coin-modal-icon">🪙</div>
            <div className="coin-modal-title">{coins <= 0 ? "Coins Khatam Ho Gaye!" : "Coins Kam Hain!"}</div>
            <div className="coin-modal-sub">
              {coins <= 0
                ? `Saare ${FREE_COINS} coins use ho gaye. Pro plan lo — unlimited campaigns post karo.`
                : `Campaign post karne ke liye ${COINS_PER_CAM} coins chahiye — aapke paas sirf ${coins} hain.`}
            </div>
            <div className="coin-modal-prog-wrap">
              <div className="coin-modal-prog-top">
                <span>Coins used</span>
                <span>{FREE_COINS - Math.max(0, coins)} / {FREE_COINS}</span>
              </div>
              <div className="coin-modal-prog">
                <div className="coin-modal-prog-fill" style={{ width: `${100 - coinsPercent}%`, background: coins <= 0 ? "#ef4444" : "#f59e0b" }} />
              </div>
            </div>
            <button className="coin-plan-btn" onClick={() => handleSubscribe("pro_monthly", "Pro")} disabled={loadingPlan !== null}>
              <span>{loadingPlan === "pro_monthly" ? <><span className="mini-spin" />Processing...</> : "⚡ Upgrade to Pro — Unlimited Campaigns"}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>₹999/mo</span>
            </button>
            <button className="coin-modal-skip" onClick={() => setShowCoinModal(false)}>Maybe later</button>
            <div className="coin-modal-secure">🔒 Secured by Razorpay</div>
          </div>
        </div>
      )}

      <div className="pcp">
        <div className="pcp-inner">
          <div className="pcp-card">
            <h1 className="pcp-title">Create Campaign</h1>
            <p className="pcp-sub">Find the right creators for your brand</p>

            {/* COIN BAR */}
            <div className={`pcp-coin-bar ${isSubscribed ? "pro" : coinsEmpty ? "empty" : coinsLow ? "warn" : ""}`}
              onClick={() => !isSubscribed && setShowCoinModal(true)}>
              <div className="pcp-coin-icon">🪙</div>
              <div className="pcp-coin-info">
                <div className="pcp-coin-label">{isSubscribed ? "Unlimited Coins (Pro)" : `Coins — ${COINS_PER_CAM} per campaign`}</div>
                {!isSubscribed && (
                  <div className="pcp-coin-track">
                    <div className="pcp-coin-fill" style={{ width: `${coinsPercent}%`, background: usageColor }} />
                  </div>
                )}
                <div className="pcp-coin-count" style={{ color: isSubscribed ? "#15803d" : usageColor }}>
                  {isSubscribed ? "✓ Pro — Unlimited campaigns"
                    : coinsEmpty ? "⚠️ Coins nahi hain — upgrade karo"
                    : `${coins} coins remaining · ${camsLeft} campaigns left`}
                </div>
              </div>
              {!isSubscribed && (
                <button className={`pcp-upgrade-tag ${coinsEmpty ? "empty-tag" : coinsLow ? "warn-tag" : ""}`}
                  onClick={(e) => { e.stopPropagation(); setShowCoinModal(true); }}>
                  {coinsEmpty ? "Upgrade!" : "Upgrade ✦"}
                </button>
              )}
            </div>

            {coinsEmpty ? (
              <div className="pcp-blocked">
                <div className="pcp-blocked-icon">🚫</div>
                <h2 className="pcp-blocked-title">Coins Khatam!</h2>
                <p className="pcp-blocked-sub">Free plan mein <strong>{FREE_COINS / COINS_PER_CAM} campaigns</strong> allowed hain.<br />Pro upgrade karo aur unlimited post karo.</p>
                <button className="pcp-blocked-btn" onClick={() => setShowCoinModal(true)}>⚡ Upgrade to Pro →</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pcp-form">
                <div className="pcp-section">
                  <div className="pcp-section-label">Campaign Info</div>
                  <div className="pcp-field">
                    <label className="pcp-label">Title <span className="req">*</span></label>
                    <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                  </div>
                  <div className="pcp-field">
                    <label className="pcp-label">Description <span className="req">*</span></label>
                    <textarea className="pcp-input pcp-textarea" rows={4} placeholder="Describe your campaign..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                  </div>
                  <div className="pcp-row">
                    <div className="pcp-field">
                      <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
                      <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000" value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} required />
                    </div>
                    <div className="pcp-field">
                      <label className="pcp-label">City <span className="req">*</span></label>
                      <select className="pcp-select" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} required>
                        <option value="">Select City</option>
                        {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
                      </select>
                    </div>
                  </div>
                  {!isSubscribed && (
                    <div className={`pcp-coin-cost-note ${coinsLow ? "low-note" : ""}`}>
                      🪙 Campaign post karne pe <strong>{COINS_PER_CAM} coins</strong> katenge
                      {coinsLow && ` — sirf ${camsLeft} campaigns baaki!`}
                    </div>
                  )}
                </div>

                <div className="pcp-section">
                  <div className="pcp-section-label">Targeting</div>
                  <div className="pcp-field">
                    <label className="pcp-label">Categories</label>
                    <div className="pcp-chips">
                      {CATEGORY_OPTIONS.map(cat => (
                        <button key={cat} type="button" className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`} onClick={() => toggleChip("categories", cat)}>{cat}</button>
                      ))}
                    </div>
                  </div>
                  <div className="pcp-field" style={{ marginBottom: 0 }}>
                    <label className="pcp-label">Target Roles <span className="req">*</span></label>
                    <div className="pcp-chips">
                      {ROLE_OPTIONS.map(r => (
                        <button key={r} type="button" className={`pcp-chip ${formData.roles.includes(r) ? "sel" : ""}`} onClick={() => toggleChip("roles", r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pcp-actions">
                  <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
                  <button type="submit" className="pcp-btn-submit" disabled={loading}>
                    {loading ? <><span className="pcp-spinner" /> Creating...</> : `Create Campaign 🚀${!isSubscribed ? ` (−${COINS_PER_CAM} 🪙)` : ""}`}
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

