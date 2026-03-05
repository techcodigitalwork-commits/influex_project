"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API_BASE           = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY       = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID            = "plan_SKmSEwh4wl4Tv6";
const FREE_COINS         = 100;
const COINS_PER_CAMPAIGN = 20;
const FREE_CAMPAIGN_MAX  = FREE_COINS / COINS_PER_CAMPAIGN;

export default function CampaignBoard() {
  const router = useRouter();
  const [campaigns, setCampaigns]         = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [role, setRole]                   = useState<string>("");
  const [coins, setCoins]                 = useState<number>(FREE_COINS);
  const [isSubscribed, setIsSubscribed]   = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [loadingPlan, setLoadingPlan]     = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cb_user");
    if (!stored) { router.push("/login"); return; }
    const parsed = JSON.parse(stored);
    const userRole = parsed?.role?.toLowerCase();
    setRole(userRole);
    const token = parsed.token || localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    // Load from localStorage first
    const localBits = parsed.bits ?? parsed.coins ?? FREE_COINS;
    setCoins(localBits);
    setIsSubscribed(parsed.isSubscribed ?? false);
    // Sync stale coins field with bits (coins field may be outdated)
    if (parsed.bits !== undefined && parsed.bits !== parsed.coins) {
      parsed.coins = parsed.bits;
      localStorage.setItem("cb_user", JSON.stringify(parsed));
    }

    fetchCampaigns(token, userRole);

    // Fetch fresh bits from backend for brand users
    if (userRole === "brand" || userRole === "admin") {
      const endpoints = [`${API_BASE}/auth/me`, `${API_BASE}/users/me`, `${API_BASE}/profile/me`];
      const tryNext = (i: number) => {
        if (i >= endpoints.length) return;
        fetch(endpoints[i], { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(data => {
            const b = data?.bits ?? data?.user?.bits ?? data?.data?.bits ?? data?.profile?.bits ?? null;
            const sub = data?.isSubscribed ?? data?.user?.isSubscribed ?? data?.profile?.isSubscribed ?? null;
            if (b !== null && b !== undefined) {
              setCoins(b);
              if (sub !== null) setIsSubscribed(sub);
              localStorage.setItem("cb_user", JSON.stringify({
                ...parsed, bits: b, coins: b,
                isSubscribed: sub ?? parsed.isSubscribed ?? false
              }));
            } else {
              tryNext(i + 1);
            }
          })
          .catch(() => tryNext(i + 1));
      };
      tryNext(0);
    }

  }, []);

  const fetchCampaigns = async (token: string, userRole: string) => {
    try {
      setLoading(true);
      const endpoint = (userRole === "brand" || userRole === "admin") ? "/campaigns/my" : "/campaigns/all";
      const res  = await fetch(`${API_BASE}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { if (res.status === 401) { localStorage.clear(); router.push("/login"); } setCampaigns([]); return; }
      const list = Array.isArray(data) ? data : Array.isArray(data.campaigns) ? data.campaigns : Array.isArray(data.data) ? data.data : [];
      setCampaigns(list);
    } catch { setCampaigns([]); } finally { setLoading(false); }
  };

  const completeCampaign = async (campaignId: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      showToast("Campaign completed ✓", "success");
      fetchCampaigns(token, role);
    } catch (err: any) { showToast(err.message || "Something went wrong", "error"); }
  };

  const handleCreateClick = (e: React.MouseEvent) => {
    if (isSubscribed) return;
    if (coins < COINS_PER_CAMPAIGN) { e.preventDefault(); setShowCoinModal(true); }
  };

  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    const options = {
      key: RAZORPAY_KEY, subscription_id: subscriptionId,
      name: "Influex Premium", description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: parsed?.name || "", email: parsed?.email || "" },
      handler: async function (response: any) {
        try {
          await fetch(`${API_BASE}/subscription/verify`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ razorpay_payment_id: response.razorpay_payment_id, razorpay_subscription_id: response.razorpay_subscription_id, razorpay_signature: response.razorpay_signature, plan_id: PLAN_ID, planName }) });
        } catch {}
        const aRes  = await fetch(`${API_BASE}/subscription/activate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }) });
        const aData = await aRes.json();
        if (aData.success) {
          const updated = { ...parsed, isSubscribed: true, activePlan: planId, coins: 99999, bits: 99999 };
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setIsSubscribed(true); setCoins(99999); setShowCoinModal(false);
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
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token  = parsed.token || localStorage.getItem("token");
    if (!token) { showToast("Session expired.", "error"); return; }
    setLoadingPlan(planId);
    try {
      const res  = await fetch(`${API_BASE}/subscription/create`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ plan_id: PLAN_ID }) });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) { showToast(data.message || "Failed.", "error"); setLoadingPlan(null); return; }
      openRazorpay(data.subscription.id, planId, planName);
    } catch { showToast("Something went wrong.", "error"); setLoadingPlan(null); }
  };

  const isBrand       = role === "brand" || role === "admin";
  const coinsPercent  = Math.max(0, Math.min(100, (coins / FREE_COINS) * 100));
  const coinsLow      = !isSubscribed && coins <= 40 && coins > 0;
  const coinsEmpty    = !isSubscribed && coins <= 0;
  const campaignsLeft = isSubscribed ? "∞" : Math.floor(coins / COINS_PER_CAMPAIGN);

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "32px", height: "32px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

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
        .cb{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .cb-header{background:#fff;border-bottom:1px solid #ebebeb;padding:22px 32px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
        @media(max-width:600px){.cb-header{padding:16px}}
        .cb-title{font-size:20px;font-weight:600;color:#111;margin:0 0 2px}
        .cb-sub{color:#aaa;font-size:13px;margin:0;font-weight:400}
        .cb-header-right{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .cb-coin-pill{display:flex;align-items:center;gap:10px;border:1.5px solid #e8e8e8;border-radius:12px;padding:8px 14px;background:#fff;min-width:185px}
        .cb-coin-pill.warn{border-color:#fbbf24;background:#fffbeb}
        .cb-coin-pill.empty{border-color:#ef4444;background:#fff5f5}
        .cb-coin-pill.pro{border-color:#86efac;background:#f0fdf4}
        .cb-coin-icon{font-size:18px}
        .cb-coin-body{flex:1;min-width:0}
        .cb-coin-label{font-size:10px;color:#aaa;font-weight:500}
        .cb-coin-val{font-size:16px;font-weight:700;color:#4f46e5;line-height:1}
        .cb-coin-val.warn-val{color:#d97706}
        .cb-coin-val.empty-val{color:#ef4444}
        .cb-coin-val.pro-val{color:#16a34a}
        .cb-coin-bar-wrap{height:3px;background:#f0f0f0;border-radius:2px;margin-top:3px;overflow:hidden}
        .cb-coin-bar{height:100%;border-radius:2px;transition:width 0.5s ease}
        .cb-coin-up-btn{padding:5px 10px;border-radius:7px;background:#4f46e5;color:#fff;font-size:11px;font-weight:700;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;white-space:nowrap}
        .cb-coin-up-btn.warn-up{background:#f59e0b}
        .cb-coin-up-btn.empty-up{background:#ef4444}
        .cb-create-btn{padding:9px 18px;background:#4f46e5;color:#fff;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap;flex-shrink:0;font-family:'DM Sans',sans-serif;border:none;cursor:pointer}
        .cb-create-btn:hover{background:#4338ca}
        .cb-create-btn.blocked{background:#e5e5e5;color:#aaa;cursor:not-allowed;pointer-events:none}
        .cb-limit-banner{margin:16px 32px 0;border-radius:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        @media(max-width:600px){.cb-limit-banner{margin:12px 12px 0}}
        .cb-limit-banner.danger{background:#fff5f5;border:1.5px solid #fecaca}
        .cb-limit-banner.warn{background:#fffbeb;border:1.5px solid #fde68a}
        .cb-limit-text{font-size:14px;font-weight:500}
        .cb-limit-text.danger{color:#991b1b}
        .cb-limit-text.warn{color:#92400e}
        .cb-limit-sub{font-size:12px;color:#aaa;margin-top:2px}
        .cb-limit-btn{padding:8px 18px;border-radius:10px;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap}
        .cb-limit-btn.danger{background:#ef4444;color:#fff}
        .cb-limit-btn.warn{background:#f59e0b;color:#fff}
        .cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;padding:20px 32px 32px}
        @media(max-width:768px){.cb-grid{grid-template-columns:1fr;padding:14px 16px 24px;gap:12px}}
        .cb-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px;transition:all 0.2s}
        .cb-card:hover{border-color:#d0d0d0;box-shadow:0 6px 24px rgba(0,0,0,0.06);transform:translateY(-1px)}
        .cb-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
        .cb-card-title{font-size:15px;font-weight:600;color:#111;margin:0;flex:1;line-height:1.4}
        .cb-badge{padding:3px 10px;border-radius:100px;font-size:11px;font-weight:600;flex-shrink:0}
        .cb-badge-open{background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe}
        .cb-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
        .cb-badge-completed{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
        .cb-desc{color:#888;font-size:13px;line-height:1.6;margin:0 0 14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .cb-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px}
        .cb-meta-item{background:#fafafa;border-radius:10px;padding:10px 12px}
        .cb-meta-label{font-size:10px;color:#bbb;text-transform:uppercase;letter-spacing:0.06em;font-weight:500}
        .cb-meta-val{font-size:13px;font-weight:600;color:#111;margin-top:2px}
        .cb-actions{display:flex;gap:8px;flex-wrap:wrap}
        .cb-btn{flex:1;min-width:70px;padding:9px 12px;border-radius:10px;font-size:12px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;white-space:nowrap}
        .cb-btn-view{background:#f4f4f4;color:#555}
        .cb-btn-apps{background:#eff6ff;color:#2563eb}
        .cb-btn-complete{background:#f0fdf4;color:#16a34a}
        .cb-card-coin{display:flex;align-items:center;gap:4px;font-size:11px;color:#aaa;font-weight:600;margin-bottom:10px}
        .cb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;margin:20px 32px;background:#fff;border-radius:16px;border:1.5px dashed #e0e0e0}
        .cb-empty-icon{font-size:44px;margin-bottom:14px}
        .cb-empty-title{font-size:18px;font-weight:600;color:#111;margin:0 0 6px}
        .cb-empty-sub{color:#aaa;font-size:13px;margin:0 0 20px;line-height:1.6}
        .cm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease}
        .cm-box{background:#fff;border-radius:24px;max-width:420px;width:100%;padding:36px 32px 30px;position:relative;text-align:center;animation:slideUp 0.25s ease}
        .cm-close{position:absolute;top:14px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:#aaa}
        .cm-icon{font-size:52px;margin-bottom:14px;line-height:1}
        .cm-title{font-size:22px;font-weight:700;color:#111;margin-bottom:8px}
        .cm-sub{font-size:14px;color:#777;line-height:1.65;margin-bottom:10px}
        .cm-prog-wrap{margin:16px 0 22px}
        .cm-prog-top{display:flex;justify-content:space-between;font-size:12px;color:#aaa;margin-bottom:6px}
        .cm-prog{height:8px;background:#f0f0f0;border-radius:100px;overflow:hidden}
        .cm-prog-fill{height:100%;border-radius:100px;transition:width 0.6s ease}
        .cm-plan-btn{width:100%;padding:14px 20px;border-radius:14px;border:none;font-size:15px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
        .cm-plan-btn:disabled{opacity:0.65;cursor:not-allowed}
        .cm-skip{font-size:13px;color:#ccc;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;text-decoration:underline}
        .cm-secure{font-size:11px;color:#ddd;margin-top:10px}
        .cm-mini-spin{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:6px;vertical-align:middle}
        .cb-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;white-space:nowrap;max-width:90vw;text-align:center;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.12)}
        .cb-toast.success{background:#111;color:#fff}
        .cb-toast.error{background:#ef4444;color:#fff}
        .cb-toast.warn{background:#f59e0b;color:#fff}
      `}</style>

      {toast && <div className={`cb-toast ${toast.type}`}>{toast.msg}</div>}

      {showCoinModal && (
        <div className="cm-overlay">
          <div className="cm-box">
            <button className="cm-close" onClick={() => setShowCoinModal(false)}>✕</button>
            <div className="cm-icon">🪙</div>
            <div className="cm-title">{coinsEmpty ? "Coins Khatam!" : "Coins Khatam Hone Wale!"}</div>
            <div className="cm-sub">
              {coinsEmpty
                ? `${FREE_COINS} free coins use ho gaye (${COINS_PER_CAMPAIGN} per campaign = ${FREE_CAMPAIGN_MAX} campaigns). Pro lo.`
                : `Sirf ${coins} coins bache — ${Math.floor(coins / COINS_PER_CAMPAIGN)} aur campaigns. Upgrade karo!`}
            </div>
            <div className="cm-prog-wrap">
              <div className="cm-prog-top"><span>Coins used</span><span>{FREE_COINS - Math.max(0, coins)} / {FREE_COINS}</span></div>
              <div className="cm-prog">
                <div className="cm-prog-fill" style={{ width: `${Math.min(100, ((FREE_COINS - Math.max(0, coins)) / FREE_COINS) * 100)}%`, background: coinsEmpty ? "#ef4444" : "#f59e0b" }} />
              </div>
            </div>
            <button className="cm-plan-btn" onClick={() => handleSubscribe("pro_monthly", "Pro")} disabled={loadingPlan !== null}>
              <span>{loadingPlan === "pro_monthly" ? <><span className="cm-mini-spin" />Processing...</> : "⚡ Upgrade to Pro — Unlimited Campaigns"}</span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>₹999/mo</span>
            </button>
            <button className="cm-skip" onClick={() => setShowCoinModal(false)}>Maybe later</button>
            <div className="cm-secure">🔒 Secured by Razorpay</div>
          </div>
        </div>
      )}

      <div className="cb">
        <div className="cb-header">
          <div>
            <h1 className="cb-title">{isBrand ? "My Campaigns" : "All Campaigns"}</h1>
            <p className="cb-sub">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} found</p>
          </div>
          <div className="cb-header-right">
            {isBrand && (
              <div className={`cb-coin-pill ${isSubscribed ? "pro" : coinsEmpty ? "empty" : coinsLow ? "warn" : ""}`}>
                <div className="cb-coin-icon">🪙</div>
                <div className="cb-coin-body">
                  <div className="cb-coin-label">{isSubscribed ? "Unlimited" : `${campaignsLeft} campaigns left`}</div>
                  <div className={`cb-coin-val ${isSubscribed ? "pro-val" : coinsEmpty ? "empty-val" : coinsLow ? "warn-val" : ""}`}>
                    {isSubscribed ? "∞" : coins}
                  </div>
                  {!isSubscribed && (
                    <div className="cb-coin-bar-wrap">
                      <div className="cb-coin-bar" style={{ width: `${coinsPercent}%`, background: coinsEmpty ? "#ef4444" : coinsLow ? "#f59e0b" : "#4f46e5" }} />
                    </div>
                  )}
                </div>
                {!isSubscribed && (
                  <button className={`cb-coin-up-btn ${coinsEmpty ? "empty-up" : coinsLow ? "warn-up" : ""}`} onClick={() => setShowCoinModal(true)}>
                    {coinsEmpty ? "Upgrade!" : "Upgrade"}
                  </button>
                )}
              </div>
            )}
            {isBrand && (
              <Link href="/campaigns/post" className={`cb-create-btn ${!isSubscribed && coinsEmpty ? "blocked" : ""}`} onClick={handleCreateClick}>
                + Create Campaign
              </Link>
            )}
          </div>
        </div>

        {isBrand && coinsEmpty && !isSubscribed && (
          <div className="cb-limit-banner danger">
            <div>
              <div className="cb-limit-text danger">🚫 No coins left! Cannot post more campaigns</div>
              <div className="cb-limit-sub">Free plan: {FREE_COINS} coins, {COINS_PER_CAMPAIGN} per campaign = {FREE_CAMPAIGN_MAX} campaigns</div>
            </div>
            <button className="cb-limit-btn danger" onClick={() => setShowCoinModal(true)}>Upgrade Now →</button>
          </div>
        )}
        {isBrand && coinsLow && !coinsEmpty && !isSubscribed && (
          <div className="cb-limit-banner warn">
            <div>
              <div className="cb-limit-text warn">⚡ Only {Math.floor(coins / COINS_PER_CAMPAIGN)} campaign{Math.floor(coins / COINS_PER_CAMPAIGN) !== 1 ? "s" : ""} left!</div>
              <div className="cb-limit-sub">Coins remaining: {coins}</div>
            </div>
            <button className="cb-limit-btn warn" onClick={() => setShowCoinModal(true)}>Upgrade →</button>
          </div>
        )}

        {campaigns.length === 0 ? (
          <div className="cb-empty">
            <div className="cb-empty-icon">📋</div>
            <h3 className="cb-empty-title">No campaigns yet</h3>
            <p className="cb-empty-sub">{isBrand ? "Create your first campaign to find creators" : "No campaigns available right now"}</p>
            {isBrand && !coinsEmpty && <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link>}
          </div>
        ) : (
          <div className="cb-grid">
            {campaigns.map((c) => (
              <div key={c._id} className="cb-card">
                <div className="cb-card-top">
                  <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
                  <span className={`cb-badge ${c.status === "completed" ? "cb-badge-completed" : c.status === "ongoing" ? "cb-badge-ongoing" : "cb-badge-open"}`}>{c.status || "open"}</span>
                </div>
                {c.description && <p className="cb-desc">{c.description}</p>}
                {isBrand && !isSubscribed && <div className="cb-card-coin">🪙 {COINS_PER_CAMPAIGN} coins per campaign post</div>}
                <div className="cb-meta">
                  <div className="cb-meta-item"><div className="cb-meta-label">Budget</div><div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div></div>
                  <div className="cb-meta-item"><div className="cb-meta-label">City</div><div className="cb-meta-val">{c.city || "—"}</div></div>
                  <div className="cb-meta-item"><div className="cb-meta-label">Category</div><div className="cb-meta-val" style={{ fontSize: "12px" }}>{Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}</div></div>
                  <div className="cb-meta-item"><div className="cb-meta-label">Applications</div><div className="cb-meta-val">{c.applicationsCount || 0}</div></div>
                </div>
                <div className="cb-actions">
                  <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">View</Link>
                  {isBrand && (
                    <>
                      <Link href={`/campaigns/${c._id}/applications`} className="cb-btn cb-btn-apps">Applications</Link>
                      {c.status !== "completed" && <button className="cb-btn cb-btn-complete" onClick={() => completeCampaign(c._id)}>Complete ✓</button>}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";
// const FREE_CAMPAIGN_LIMIT = 5;

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [role, setRole] = useState<string>("");

//   // ✅ Subscription & usage state
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [campaignsCreated, setCampaignsCreated] = useState(0);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const userRole = parsedUser?.role?.toLowerCase();
//     setRole(userRole);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { router.push("/login"); return; }

//     fetchCampaigns(token, userRole);

//     // ✅ Fetch subscription & usage stats
//     if (userRole === "brand") {
//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           if (data.success && data.profile) {
//             setIsSubscribed(data.profile.isSubscribed ?? false);
//             setCampaignsCreated(data.profile.campaignsCreated ?? 0);
//           }
//         })
//         .catch(() => {});
//     }
//   }, []);

//   const fetchCampaigns = async (token: string, userRole: string) => {
//     try {
//       setLoading(true);
//       const endpoint = (userRole === "brand" || userRole === "admin") ? "/campaigns/my" : "/campaigns/all";
//       const res = await fetch(`${API_BASE}${endpoint}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         if (res.status === 401) { localStorage.clear(); router.push("/login"); }
//         setCampaigns([]); return;
//       }
//       const list = Array.isArray(data) ? data
//         : Array.isArray(data.campaigns) ? data.campaigns
//         : Array.isArray(data.data) ? data.data : [];
//       setCampaigns(list);
//     } catch (err) {
//       console.error(err); setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const completeCampaign = async (campaignId: string) => {
//     const stored = localStorage.getItem("cb_user");
//     const parsed = JSON.parse(stored || "{}");
//     const token = parsed.token || localStorage.getItem("token");
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, {
//         method: "POST", headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed");
//       showToast("Campaign completed ✓", "success");
//       fetchCampaigns(token, role);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     }
//   };

//   // ✅ Check limit before navigating to post
//   const handleCreateClick = (e: React.MouseEvent) => {
//     if (!isSubscribed && campaignsCreated >= FREE_CAMPAIGN_LIMIT) {
//       e.preventDefault();
//       showToast("Campaign limit reach! Upgrade karo to aur post karo 🚀", "error");
//       setTimeout(() => router.push("/upgrade"), 1500);
//     }
//   };

//   const isBrand = role === "brand" || role === "admin";
//   const limitReached = !isSubscribed && campaignsCreated >= FREE_CAMPAIGN_LIMIT;
//   const limitNear = !isSubscribed && campaignsCreated >= 3 && campaignsCreated < FREE_CAMPAIGN_LIMIT;
//   const campaignPercent = Math.min(100, (campaignsCreated / FREE_CAMPAIGN_LIMIT) * 100);

//   if (loading) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ textAlign: "center" }}>
//         <div style={{ width: "32px", height: "32px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
//         <p style={{ color: "#999", fontSize: "14px", fontFamily: "DM Sans, sans-serif" }}>Loading...</p>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; }

//         .cb { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

//         /* HEADER */
//         .cb-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 22px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
//         @media(max-width:600px){ .cb-header{ padding: 16px 16px; } }
//         .cb-title { font-size: 20px; font-weight: 600; color: #111; margin: 0 0 2px; }
//         .cb-sub { color: #aaa; font-size: 13px; margin: 0; font-weight: 400; }

//         .cb-header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

//         /* ✅ Campaign usage pill in header */
//         .cb-usage-pill {
//           display: flex; align-items: center; gap: 8px;
//           background: #fafafa; border: 1.5px solid #ebebeb;
//           border-radius: 100px; padding: 7px 14px; font-size: 12px; font-weight: 500; color: #666;
//         }
//         .cb-usage-pill.warn { background: #fffbeb; border-color: #fde68a; color: #92400e; }
//         .cb-usage-pill.danger { background: #fff5f5; border-color: #fecaca; color: #991b1b; }
//         .cb-usage-pill.subscribed { background: #f0fdf4; border-color: #86efac; color: #166534; }

//         .cb-usage-bar-wrap { width: 60px; height: 4px; background: #f0f0f0; border-radius: 100px; overflow: hidden; }
//         .cb-usage-bar-fill { height: 100%; border-radius: 100px; transition: width 0.4s ease; }

//         .cb-create-btn {
//           padding: 9px 18px; background: #4f46e5; color: #fff;
//           border-radius: 10px; font-size: 13px; font-weight: 600;
//           text-decoration: none; transition: background 0.2s; white-space: nowrap; flex-shrink: 0;
//           font-family: 'DM Sans', sans-serif; border: none; cursor: pointer;
//         }
//         .cb-create-btn:hover { background: #4338ca; }
//         .cb-create-btn.blocked {
//           background: #e5e5e5; color: #aaa; cursor: not-allowed;
//           box-shadow: none; pointer-events: none;
//         }

//         /* ✅ LIMIT BANNERS */
//         .cb-limit-banner {
//           margin: 16px 32px 0;
//           border-radius: 14px; padding: 14px 18px;
//           display: flex; align-items: center; justify-content: space-between;
//           flex-wrap: wrap; gap: 12px;
//         }
//         @media(max-width:600px){ .cb-limit-banner{ margin: 12px 12px 0; } }
//         .cb-limit-banner.danger { background: #fff5f5; border: 1.5px solid #fecaca; }
//         .cb-limit-banner.warn   { background: #fffbeb; border: 1.5px solid #fde68a; }

//         .cb-limit-text { font-size: 14px; font-weight: 500; }
//         .cb-limit-text.danger { color: #991b1b; }
//         .cb-limit-text.warn   { color: #92400e; }
//         .cb-limit-sub { font-size: 12px; color: #aaa; margin-top: 2px; font-weight: 400; }

//         .cb-limit-btn {
//           padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
//           border: none; cursor: pointer; transition: all 0.2s;
//           font-family: 'DM Sans', sans-serif; white-space: nowrap;
//         }
//         .cb-limit-btn.danger { background: #ef4444; color: #fff; }
//         .cb-limit-btn.danger:hover { background: #dc2626; }
//         .cb-limit-btn.warn  { background: #f59e0b; color: #fff; }
//         .cb-limit-btn.warn:hover  { background: #d97706; }

//         /* GRID */
//         .cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 20px 32px 32px; }
//         @media(max-width:768px){ .cb-grid{ grid-template-columns: 1fr; padding: 14px 16px 24px; gap: 12px; } }
//         @media(max-width:600px){ .cb-grid{ padding: 12px 12px 20px; } }

//         /* CARD */
//         .cb-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 20px; transition: all 0.2s; }
//         .cb-card:hover { border-color: #d0d0d0; box-shadow: 0 6px 24px rgba(0,0,0,0.06); transform: translateY(-1px); }

//         .cb-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
//         .cb-card-title { font-size: 15px; font-weight: 600; color: #111; margin: 0; flex: 1; line-height: 1.4; }

//         .cb-badge { padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; flex-shrink: 0; }
//         .cb-badge-open { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
//         .cb-badge-ongoing { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
//         .cb-badge-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

//         .cb-desc { color: #888; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-weight: 400; }

//         .cb-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
//         .cb-meta-item { background: #fafafa; border-radius: 10px; padding: 10px 12px; }
//         .cb-meta-label { font-size: 10px; color: #bbb; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; }
//         .cb-meta-val { font-size: 13px; font-weight: 600; color: #111; margin-top: 2px; }

//         .cb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
//         .cb-btn { flex: 1; min-width: 70px; padding: 9px 12px; border-radius: 10px; font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; white-space: nowrap; }
//         .cb-btn-view { background: #f4f4f4; color: #555; }
//         .cb-btn-view:hover { background: #eee; }
//         .cb-btn-apps { background: #eff6ff; color: #2563eb; }
//         .cb-btn-apps:hover { background: #dbeafe; }
//         .cb-btn-complete { background: #f0fdf4; color: #16a34a; }
//         .cb-btn-complete:hover { background: #dcfce7; }

//         /* EMPTY */
//         .cb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 16px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .cb-empty{ margin: 14px 12px; padding: 40px 20px; } }
//         .cb-empty-icon { font-size: 44px; margin-bottom: 14px; }
//         .cb-empty-title { font-size: 18px; font-weight: 600; color: #111; margin: 0 0 6px; }
//         .cb-empty-sub { color: #aaa; font-size: 13px; margin: 0 0 20px; line-height: 1.6; font-weight: 400; }

//         /* Toast */
//         .cb-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; text-align: center; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .cb-toast.success { background: #111; color: #fff; }
//         .cb-toast.error   { background: #ef4444; color: #fff; }
//         .cb-toast.warn    { background: #f59e0b; color: #fff; }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>

//       {toast && <div className={`cb-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cb">
//         {/* HEADER */}
//         <div className="cb-header">
//           <div>
//             <h1 className="cb-title">{isBrand ? "My Campaigns" : "All Campaigns"}</h1>
//             <p className="cb-sub">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} found</p>
//           </div>

//           <div className="cb-header-right">
//             {/* ✅ Usage pill for brand */}
//             {isBrand && (
//               isSubscribed ? (
//                 <div className="cb-usage-pill subscribed">
//                   ✓ Pro — Unlimited campaigns
//                 </div>
//               ) : (
//                 <div className={`cb-usage-pill ${limitReached ? "danger" : limitNear ? "warn" : ""}`}>
//                   📢 {campaignsCreated}/{FREE_CAMPAIGN_LIMIT} campaigns
//                   <div className="cb-usage-bar-wrap">
//                     <div className="cb-usage-bar-fill" style={{
//                       width: `${campaignPercent}%`,
//                       background: limitReached ? "#ef4444" : limitNear ? "#f59e0b" : "#4f46e5"
//                     }} />
//                   </div>
//                 </div>
//               )
//             )}

//             {isBrand && (
//               <Link
//                 href="/campaigns/post"
//                 className={`cb-create-btn ${limitReached ? "blocked" : ""}`}
//                 onClick={handleCreateClick}
//               >
//                 + Create Campaign
//               </Link>
//             )}
//           </div>
//         </div>

//         {/* ✅ LIMIT REACHED BANNER */}
//         {isBrand && limitReached && (
//           <div className="cb-limit-banner danger">
//             <div>
//               <div className="cb-limit-text danger">🚫 Campaign limit reach ho gayi!</div>
//               <div className="cb-limit-sub">Free plan mein sirf {FREE_CAMPAIGN_LIMIT} campaigns allowed hain</div>
//             </div>
//             <button className="cb-limit-btn danger" onClick={() => router.push("/upgrade")}>
//               Upgrade Now →
//             </button>
//           </div>
//         )}

//         {/* ✅ LIMIT NEAR BANNER */}
//         {isBrand && limitNear && (
//           <div className="cb-limit-banner warn">
//             <div>
//               <div className="cb-limit-text warn">⚡ {FREE_CAMPAIGN_LIMIT - campaignsCreated} campaigns baaki hain</div>
//               <div className="cb-limit-sub">Limit se pehle upgrade kar lo unlimited campaigns ke liye</div>
//             </div>
//             <button className="cb-limit-btn warn" onClick={() => router.push("/upgrade")}>
//               Upgrade →
//             </button>
//           </div>
//         )}

//         {/* CAMPAIGNS */}
//         {campaigns.length === 0 ? (
//           <div className="cb-empty">
//             <div className="cb-empty-icon">📋</div>
//             <h3 className="cb-empty-title">No campaigns yet</h3>
//             <p className="cb-empty-sub">
//               {isBrand ? "Create your first campaign to find creators" : "No campaigns available right now"}
//             </p>
//             {isBrand && !limitReached && (
//               <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link>
//             )}
//           </div>
//         ) : (
//           <div className="cb-grid">
//             {campaigns.map((c) => (
//               <div key={c._id} className="cb-card">
//                 <div className="cb-card-top">
//                   <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
//                   <span className={`cb-badge ${
//                     c.status === "completed" ? "cb-badge-completed"
//                     : c.status === "ongoing" ? "cb-badge-ongoing"
//                     : "cb-badge-open"
//                   }`}>{c.status || "open"}</span>
//                 </div>

//                 {c.description && <p className="cb-desc">{c.description}</p>}

//                 <div className="cb-meta">
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Budget</div>
//                     <div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">City</div>
//                     <div className="cb-meta-val">{c.city || "—"}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Category</div>
//                     <div className="cb-meta-val" style={{ fontSize: "12px" }}>
//                       {Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}
//                     </div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Applications</div>
//                     <div className="cb-meta-val">{c.applicationsCount || 0}</div>
//                   </div>
//                 </div>

//                 <div className="cb-actions">
//                   <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">View</Link>
//                   {isBrand && (
//                     <>
//                       <Link href={`/campaigns/${c._id}/applications`} className="cb-btn cb-btn-apps">Applications</Link>
//                       {c.status !== "completed" && (
//                         <button className="cb-btn cb-btn-complete" onClick={() => completeCampaign(c._id)}>Complete ✓</button>
//                       )}
//                     </>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }



//right code "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [role, setRole] = useState<string>("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const userRole = parsedUser?.role?.toLowerCase();
//     setRole(userRole);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { router.push("/login"); return; }
//     fetchCampaigns(token, userRole);
//   }, []);

//   const fetchCampaigns = async (token: string, userRole: string) => {
//     try {
//       setLoading(true);
//       const endpoint = (userRole === "brand" || userRole === "admin") ? "/campaigns/my" : "/campaigns/all";
//       const res = await fetch(`${API_BASE}${endpoint}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CAMPAIGNS:", data);
//       if (!res.ok) { if (res.status === 401) { localStorage.clear(); router.push("/login"); } setCampaigns([]); return; }
//       const list = Array.isArray(data) ? data : Array.isArray(data.campaigns) ? data.campaigns : Array.isArray(data.data) ? data.data : [];
//       setCampaigns(list);
//     } catch (err) {
//       console.error(err); setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const completeCampaign = async (campaignId: string) => {
//     const stored = localStorage.getItem("cb_user");
//     const { token } = JSON.parse(stored || "{}");
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, {
//         method: "POST", headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed");
//       fetchCampaigns(token, role);
//     } catch (err: any) {
//       alert(err.message || "Something went wrong");
//     }
//   };

//   if (loading) return (
//     <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
//       <div style={{textAlign:"center"}}>
//         <div style={{width:"32px",height:"32px",border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}}/>
//         <p style={{color:"#999",fontSize:"14px",fontFamily:"sans-serif"}}>Loading...</p>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         * { box-sizing: border-box; }
//         .cb { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

//         /* HEADER */
//         .cb-header {
//           background: #fff;
//           border-bottom: 1px solid #ebebeb;
//           padding: 24px 32px;
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           gap: 16px;
//           flex-wrap: wrap;
//         }
//         @media(max-width: 600px) {
//           .cb-header { padding: 16px 20px; }
//         }
//         .cb-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 2px; }
//         .cb-sub { color: #aaa; font-size: 13px; margin: 0; }
//         .cb-create-btn {
//           padding: 10px 20px;
//           background: #4f46e5;
//           color: #fff;
//           border-radius: 10px;
//           font-size: 13px;
//           font-weight: 700;
//           text-decoration: none;
//           transition: background 0.2s;
//           white-space: nowrap;
//           flex-shrink: 0;
//         }
//         .cb-create-btn:hover { background: #4338ca; }

//         /* GRID */
//         .cb-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
//           gap: 16px;
//           padding: 24px 32px;
//         }
//         @media(max-width: 768px) {
//           .cb-grid { grid-template-columns: 1fr; padding: 16px 16px; gap: 12px; }
//         }
//         @media(max-width: 600px) {
//           .cb-grid { padding: 12px; }
//         }

//         /* CARD */
//         .cb-card {
//           background: #fff;
//           border-radius: 16px;
//           border: 1.5px solid #ebebeb;
//           padding: 20px;
//           transition: all 0.2s;
//         }
//         .cb-card:hover { border-color: #d0d0d0; box-shadow: 0 6px 24px rgba(0,0,0,0.07); transform: translateY(-1px); }

//         .cb-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 8px; }
//         .cb-card-title { font-size: 15px; font-weight: 700; color: #111; margin: 0; flex: 1; line-height: 1.4; }

//         .cb-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; flex-shrink: 0; }
//         .cb-badge-open { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
//         .cb-badge-ongoing { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
//         .cb-badge-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

//         .cb-desc { color: #888; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .cb-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
//         .cb-meta-item { background: #fafafa; border-radius: 10px; padding: 10px 12px; }
//         .cb-meta-label { font-size: 10px; color: #bbb; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
//         .cb-meta-val { font-size: 13px; font-weight: 700; color: #111; margin-top: 2px; }

//         .cb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
//         .cb-btn {
//           flex: 1;
//           min-width: 70px;
//           padding: 9px 12px;
//           border-radius: 10px;
//           font-size: 12px;
//           font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           border: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           text-align: center;
//           text-decoration: none;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           white-space: nowrap;
//         }
//         .cb-btn-view { background: #f4f4f4; color: #555; }
//         .cb-btn-view:hover { background: #eee; }
//         .cb-btn-apps { background: #eff6ff; color: #2563eb; }
//         .cb-btn-apps:hover { background: #dbeafe; }
//         .cb-btn-complete { background: #f0fdf4; color: #16a34a; }
//         .cb-btn-complete:hover { background: #dcfce7; }

//         /* EMPTY */
//         .cb-empty {
//           display: flex; flex-direction: column; align-items: center;
//           justify-content: center; padding: 60px 24px; text-align: center;
//           margin: 24px 32px; background: #fff; border-radius: 16px;
//           border: 1.5px dashed #e0e0e0;
//         }
//         @media(max-width: 600px) { .cb-empty { margin: 16px 12px; padding: 40px 20px; } }
//         .cb-empty-icon { font-size: 44px; margin-bottom: 14px; }
//         .cb-empty-title { font-size: 18px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .cb-empty-sub { color: #aaa; font-size: 13px; margin: 0 0 20px; line-height: 1.6; }

//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>

//       <div className="cb">
//         {/* HEADER */}
//         <div className="cb-header">
//           <div>
//             <h1 className="cb-title">
//               {role === "brand" || role === "admin" ? "My Campaigns" : "All Campaigns"}
//             </h1>
//             <p className="cb-sub">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} found</p>
//           </div>
//           {(role === "brand" || role === "admin") && (
//             <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link>
//           )}
//         </div>

//         {/* CAMPAIGNS */}
//         {campaigns.length === 0 ? (
//           <div className="cb-empty">
//             <div className="cb-empty-icon">📋</div>
//             <h3 className="cb-empty-title">No campaigns yet</h3>
//             <p className="cb-empty-sub">
//               {role === "brand" ? "Create your first campaign to find creators" : "No campaigns available right now"}
//             </p>
//             {(role === "brand" || role === "admin") && (
//               <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link>
//             )}
//           </div>
//         ) : (
//           <div className="cb-grid">
//             {campaigns.map((c) => (
//               <div key={c._id} className="cb-card">
//                 <div className="cb-card-top">
//                   <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
//                   <span className={`cb-badge ${
//                     c.status === "completed" ? "cb-badge-completed"
//                     : c.status === "ongoing" ? "cb-badge-ongoing"
//                     : "cb-badge-open"
//                   }`}>{c.status || "open"}</span>
//                 </div>

//                 {c.description && <p className="cb-desc">{c.description}</p>}

//                 <div className="cb-meta">
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Budget</div>
//                     <div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">City</div>
//                     <div className="cb-meta-val">{c.city || "—"}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Category</div>
//                     <div className="cb-meta-val" style={{fontSize:"12px"}}>
//                       {Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}
//                     </div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Applications</div>
//                     <div className="cb-meta-val">{c.applicationsCount || 0}</div>
//                   </div>
//                 </div>

//                 <div className="cb-actions">
//                   <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">View</Link>
//                   {(role === "brand" || role === "admin") && (
//                     <>
//                       <Link href={`/campaigns/${c._id}/applications`} className="cb-btn cb-btn-apps">
//                         Applications
//                       </Link>
//                       {c.status !== "completed" && (
//                         <button className="cb-btn cb-btn-complete" onClick={() => completeCampaign(c._id)}>
//                           Complete ✓
//                         </button>
//                       )}
//                     </>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }



// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [role, setRole] = useState<string>("");

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }

//     const parsedUser = JSON.parse(storedUser);
//     const userRole = parsedUser?.role?.toLowerCase();
//     setRole(userRole);

//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { router.push("/login"); return; }

//     fetchCampaigns(token, userRole);
//   }, []);

//   /* ================= FETCH ================= */
//   const fetchCampaigns = async (token: string, userRole: string) => {
//     try {
//       setLoading(true);

//       // ✅ Brand → /campaigns/my, Influencer → /campaigns/all
//       const endpoint = (userRole === "brand" || userRole === "admin")
//         ? "/campaigns/my"
//         : "/campaigns/all";

//       const res = await fetch(`${API_BASE}${endpoint}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();
//       console.log("CAMPAIGNS RESPONSE 👉", data);

//       if (!res.ok) {
//         if (res.status === 401) { localStorage.clear(); router.push("/login"); }
//         setCampaigns([]);
//         return;
//       }

//       // ✅ Sare possible response formats handle karo
//       const list = Array.isArray(data)
//         ? data
//         : Array.isArray(data.campaigns)
//         ? data.campaigns
//         : Array.isArray(data.data)
//         ? data.data
//         : [];

//       setCampaigns(list);
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= COMPLETE ================= */
//   const completeCampaign = async (campaignId: string) => {
//     const { token } = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       if (!res.ok) throw new Error("Failed");
//       fetchCampaigns(token, role);
//     } catch (err: any) {
//       alert(err.message || "Something went wrong");
//     }
//   };

//   /* ================= UI ================= */
//   if (loading) {
//     return (
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//         <div style={{ textAlign: "center" }}>
//           <div style={{ width: "36px", height: "36px", border: "3px solid #f0f0f0", borderTopColor: "#111", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
//           <p style={{ color: "#999", fontSize: "14px" }}>Loading campaigns...</p>
//           <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
//         .cb-page { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .cb-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 32px 40px; display: flex; justify-content: space-between; align-items: center; }
//         .cb-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #111; margin: 0 0 4px; }
//         .cb-sub { color: #999; font-size: 14px; margin: 0; }
//         .cb-create-btn { padding: 12px 24px; background: #111; color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif; text-decoration: none; transition: background 0.2s; }
//         .cb-create-btn:hover { background: #333; }
//         .cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding: 32px 40px; }
//         .cb-card { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 24px; transition: all 0.2s; }
//         .cb-card:hover { border-color: #d0d0d0; box-shadow: 0 8px 30px rgba(0,0,0,0.06); transform: translateY(-2px); }
//         .cb-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
//         .cb-card-title { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; color: #111; margin: 0; }
//         .cb-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; }
//         .cb-badge-open { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
//         .cb-badge-ongoing { background: #fefce8; color: #ca8a04; border: 1px solid #fde68a; }
//         .cb-badge-completed { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .cb-desc { color: #888; font-size: 13px; line-height: 1.6; margin: 0 0 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
//         .cb-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px; }
//         .cb-meta-item { background: #fafafa; border-radius: 10px; padding: 10px 12px; }
//         .cb-meta-label { font-size: 10px; color: #bbb; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
//         .cb-meta-val { font-size: 14px; font-weight: 600; color: #111; margin-top: 2px; }
//         .cb-actions { display: flex; gap: 8px; }
//         .cb-btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Syne', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; }
//         .cb-btn-view { background: #f4f4f4; color: #555; }
//         .cb-btn-view:hover { background: #eee; }
//         .cb-btn-apps { background: #eff6ff; color: #2563eb; }
//         .cb-btn-apps:hover { background: #dbeafe; }
//         .cb-btn-complete { background: #f0fdf4; color: #16a34a; }
//         .cb-btn-complete:hover { background: #dcfce7; }
//         .cb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; margin: 32px 40px; background: #fff; border-radius: 20px; border: 1.5px dashed #e0e0e0; }
//         .cb-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .cb-empty-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .cb-empty-sub { color: #aaa; font-size: 14px; margin: 0 0 20px; }
//         @keyframes spin { to { transform: rotate(360deg); } }
//       `}</style>

//       <div className="cb-page">
//         {/* HEADER */}
//         <div className="cb-header">
//           <div>
//             <h1 className="cb-title">
//               {role === "brand" || role === "admin" ? "My Campaigns" : "All Campaigns"}
//             </h1>
//             <p className="cb-sub">
//               {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} found
//             </p>
//           </div>

//           {(role === "brand" || role === "admin") && (
//             <Link href="/campaigns/post" className="cb-create-btn">
//               + Create Campaign
//             </Link>
//           )}
//         </div>

//         {/* CAMPAIGNS */}
//         {campaigns.length === 0 ? (
//           <div className="cb-empty">
//             <div className="cb-empty-icon">📋</div>
//             <h3 className="cb-empty-title">No campaigns yet</h3>
//             <p className="cb-empty-sub">
//               {role === "brand"
//                 ? "Create your first campaign to find creators"
//                 : "No campaigns available right now"}
//             </p>
//             {(role === "brand" || role === "admin") && (
//               <Link href="/campaigns/post" className="cb-create-btn">
//                 + Create Campaign
//               </Link>
//             )}
//           </div>
//         ) : (
//           <div className="cb-grid">
//             {campaigns.map((c) => (
//               <div key={c._id} className="cb-card">
//                 <div className="cb-card-top">
//                   <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
//                   <span className={`cb-badge ${
//                     c.status === "completed" ? "cb-badge-completed"
//                     : c.status === "ongoing" ? "cb-badge-ongoing"
//                     : "cb-badge-open"
//                   }`}>
//                     {c.status || "open"}
//                   </span>
//                 </div>

//                 {c.description && (
//                   <p className="cb-desc">{c.description}</p>
//                 )}

//                 <div className="cb-meta">
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Budget</div>
//                     <div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">City</div>
//                     <div className="cb-meta-val">{c.city || "—"}</div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Category</div>
//                     <div className="cb-meta-val" style={{fontSize:"12px"}}>
//                       {Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}
//                     </div>
//                   </div>
//                   <div className="cb-meta-item">
//                     <div className="cb-meta-label">Applications</div>
//                     <div className="cb-meta-val">{c.applicationsCount || 0}</div>
//                   </div>
//                 </div>

//                 <div className="cb-actions">
//                   <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">
//                     View
//                   </Link>

//                   {(role === "brand" || role === "admin") && (
//                     <>
//                       <Link href={`/campaigns/${c._id}/applications`} className="cb-btn cb-btn-apps">
//                         Applications
//                       </Link>
//                       {c.status !== "completed" && (
//                         <button className="cb-btn cb-btn-complete"
//                           onClick={() => completeCampaign(c._id)}>
//                           Complete ✓
//                         </button>
//                       )}
//                     </>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [role, setRole] = useState<string>("");

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const userRole = parsedUser?.role?.toLowerCase();
//     setRole(userRole);

//     if (!["brand", "admin", "influencer"].includes(userRole)) {
//       router.push("/discovery");
//       return;
//     }

//     const token = parsedUser.token;
//     if (!token) {
//       router.push("/login");
//       return;
//     }

//     fetchCampaigns(token, userRole);
//   }, [router]);

//   /* ================= FETCH CAMPAIGNS ================= */
//   const fetchCampaigns = async (token: string, userRole: string) => {
//     try {
//       setLoading(true);
//       let endpoint =
//         userRole === "brand" || userRole === "admin"
//           ? "/campaigns/my"
//           : "/campaigns";

//       const res = await fetch(`${API_BASE}${endpoint}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) {
//         if (res.status === 401) {
//           localStorage.clear();
//           router.push("/login");
//         }
//         setCampaigns([]);
//         return;
//       }

//       const data = await res.json();
//       setCampaigns(Array.isArray(data) ? data : data.campaigns || []);
//     } catch (err) {
//       console.error(err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= COMPLETE CAMPAIGN ================= */
//   const completeCampaign = async (campaignId: string) => {
//     if (role !== "brand" && role !== "admin") return;

//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) return;

//     const { token } = JSON.parse(storedUser);

//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Failed to complete campaign");

//       fetchCampaigns(token, role);
//     } catch (err: any) {
//       alert(err.message || "Something went wrong");
//     }
//   };

//   /* ================= APPLY CAMPAIGN (Influencer) ================= */
//   const applyCampaign = async (campaignId: string) => {
//     if (role !== "influencer") return;

//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) return;

//     const { token, _id: creatorId } = JSON.parse(storedUser);

//     try {
//       const res = await fetch(`${API_BASE}/applications`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ campaignId, creatorId }),
//       });

//       if (!res.ok) throw new Error("Failed to apply");

//       alert("Application submitted successfully!");
//     } catch (err: any) {
//       alert(err.message || "Something went wrong");
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaigns...
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">
//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">Campaign Studio</h1>
//             <p className="text-slate-500 mt-2 font-medium">Manage campaigns.</p>
//           </div>

//           {(role === "brand" || role === "admin") && (
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
//             >
//               + Create Campaign
//             </Link>
//           )}
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">
//         {campaigns.length > 0 ? (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
//             {campaigns.map((campaign) => (
//               <div
//                 key={campaign._id}
//                 className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition"
//               >
//                 {/* TITLE + STATUS */}
//                 <div className="flex justify-between items-start mb-6">
//                   <h3 className="text-xl font-black text-slate-900">
//                     {campaign.title || "Untitled"}
//                   </h3>

//                   <span
//                     className={`px-3 py-1 text-xs font-bold rounded-full ${
//                       campaign.status === "completed"
//                         ? "bg-green-100 text-green-600"
//                         : campaign.status === "ongoing"
//                         ? "bg-yellow-100 text-yellow-600"
//                         : "bg-indigo-50 text-indigo-600"
//                     }`}
//                   >
//                     {campaign.status || "pending"}
//                   </span>
//                 </div>

//                 {/* DESCRIPTION */}
//                 <p className="text-slate-500 text-sm mb-6 line-clamp-3">
//                   {campaign.description || "No description"}
//                 </p>

//                 {/* DETAILS */}
//                 <div className="space-y-3 text-sm">
//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">Budget</span>
//                     <span className="font-bold text-indigo-600">
//                       ₹{campaign.budget || 0}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">Category</span>
//                     <span className="font-bold text-slate-700">
//                       {(campaign.categories && campaign.categories.join(", ")) || "N/A"}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">City</span>
//                     <span className="font-bold text-slate-700">{campaign.city || "N/A"}</span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">Applications</span>
//                     <span className="font-bold text-slate-700">{campaign.applicationsCount || 0}</span>
//                   </div>
//                 </div>

//                 {/* ACTIONS */}
//                 <div className="mt-8 flex flex-wrap gap-3">
//                   <Link
//                     href={`/campaigns/${campaign._id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-slate-100 font-semibold hover:bg-slate-200"
//                   >
//                     View
//                   </Link>

//                   {(role === "brand" || role === "admin") && (
//                     <>
//                       <Link
//                         href={`/campaigns/${campaign._id}/applications`}
//                         className="flex-1 text-center py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
//                       >
//                         Applications
//                       </Link>

//                       {campaign.status !== "completed" && (
//                         <button
//                           onClick={() => completeCampaign(campaign._id)}
//                           className="flex-1 text-center py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
//                         >
//                           Complete
//                         </button>
//                       )}
//                     </>
//                   )}

//                   {role === "influencer" && (
//                     <button
//                       onClick={() => applyCampaign(campaign._id)}
//                       className="flex-1 text-center py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
//                     >
//                       Apply
//                     </button>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">No Campaigns Found</h3>
//             <p className="text-slate-400 mb-6">Create or apply to campaigns to get started.</p>
//             {(role === "brand" || role === "admin") && (
//               <Link
//                 href="/campaigns/post"
//                 className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//               >
//                 Create Campaign
//               </Link>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     const token = localStorage.getItem("token");

//     if (!storedUser || !token) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const role = parsedUser?.role?.toLowerCase();

//     if (role !== "brand" && role !== "admin") {
//       router.push("/discovery");
//       return;
//     }

//     fetchCampaigns(token);
//   }, [router]);

//   /* ================= FETCH CAMPAIGNS ================= */
//   const fetchCampaigns = async (token: string) => {
//     try {
//       setLoading(true);

//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (Array.isArray(data)) {
//         setCampaigns(data);
//       } else if (Array.isArray(data.campaigns)) {
//         setCampaigns(data.campaigns);
//       } else {
//         setCampaigns([]);
//       }
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= COMPLETE CAMPAIGN ================= */
//   const completeCampaign = async (id: string) => {
//     try {
//       const token = localStorage.getItem("token");

//       const res = await fetch(`${API_BASE}/campaigns/${id}/complete`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (!res.ok) throw new Error("Failed");

//       fetchCampaigns(token!);
//     } catch {
//       alert("Something went wrong");
//     }
//   };

//   /* ================= LOADING ================= */
//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaigns...
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">
//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">
//               Campaign Studio
//             </h1>
//             <p className="text-slate-500 mt-2 font-medium">
//               Manage your brand campaigns.
//             </p>
//           </div>

//           <Link
//             href="/campaigns/post"
//             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
//           >
//             + Create Campaign
//           </Link>
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">
//         {campaigns.length > 0 ? (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
//             {campaigns.map((campaign: any) => (
//               <div
//                 key={campaign._id}
//                 className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition"
//               >
//                 {/* TITLE + STATUS */}
//                 <div className="flex justify-between items-start mb-6">
//                   <h3 className="text-xl font-black text-slate-900">
//                     {campaign.title}
//                   </h3>

//                   <span
//                     className={`px-3 py-1 text-xs font-bold rounded-full ${
//                       campaign.status === "completed"
//                         ? "bg-green-100 text-green-600"
//                         : campaign.status === "ongoing"
//                         ? "bg-yellow-100 text-yellow-600"
//                         : "bg-indigo-50 text-indigo-600"
//                     }`}
//                   >
//                     {campaign.status}
//                   </span>
//                 </div>

//                 {/* DESCRIPTION */}
//                 <p className="text-slate-500 text-sm mb-6 line-clamp-3">
//                   {campaign.description}
//                 </p>

//                 {/* DETAILS */}
//                 <div className="space-y-3 text-sm">
//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Budget
//                     </span>
//                     <span className="font-bold text-indigo-600">
//                       ₹{campaign.budget}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Category
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.  categories || "N/A"}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       City
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.city || "N/A"}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Applications
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.applicationsCount || 0}
//                     </span>
//                   </div>
//                 </div>

//                 {/* ACTIONS */}
//                 <div className="mt-8 flex flex-wrap gap-3">
//                   <Link
//                     href={`/campaigns/${campaign._id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-slate-100 font-semibold hover:bg-slate-200"
//                   >
//                     View
//                   </Link>

//                   <Link
//                     href={`/campaigns/${campaign._id}/applications`}
//                     className="flex-1 text-center py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
//                   >
//                     Applications
//                   </Link>

//                   {campaign.status !== "completed" && (
//                     <button
//                       onClick={() => completeCampaign(campaign._id)}
//                       className="flex-1 text-center py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
//                     >
//                       Complete
//                     </button>
//                   )}
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">
//               No Campaigns Found
//             </h3>
//             <p className="text-slate-400 mb-6">
//               Create your first campaign to get started.
//             </p>
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//             >
//               Create Campaign
//             </Link>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     const token = localStorage.getItem("token");

//     if (!storedUser || !token) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const role = parsedUser?.role?.toLowerCase();

//     if (role !== "brand" && role !== "admin") {
//       router.push("/discovery");
//       return;
//     }

//     fetchCampaigns(token);
//   }, [router]);

//   /* ================= FETCH CAMPAIGNS ================= */

//   const fetchCampaigns = async (token: string) => {
//     try {
//       setLoading(true);

//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (Array.isArray(data)) {
//         setCampaigns(data);
//       } else if (Array.isArray(data.campaigns)) {
//         setCampaigns(data.campaigns);
//       } else {
//         setCampaigns([]);
//       }
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= COMPLETE CAMPAIGN ================= */

//   const completeCampaign = async (id: string) => {
//     try {
//       const token = localStorage.getItem("token");

//       const res = await fetch(
//         `${API_BASE}/campaigns/${id}/complete`,
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!res.ok) throw new Error("Failed");

//       fetchCampaigns(token!);
//     } catch (err) {
//       alert("Something went wrong");
//     }
//   };

//   /* ================= LOADING ================= */

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaigns...
//       </div>
//     );
//   }

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">

//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">
//               Campaign Studio
//             </h1>
//             <p className="text-slate-500 mt-2 font-medium">
//               Manage your brand campaigns.
//             </p>
//           </div>

//           <Link
//             href="/campaigns/post"
//             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
//           >
//             + Create Campaign
//           </Link>
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">

//         {campaigns.length > 0 ? (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

//             {campaigns.map((campaign: any) => (
//               <div
//                 key={campaign._id}
//                 className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition"
//               >
//                 <div className="flex justify-between items-start mb-6">
//                   <h3 className="text-xl font-black text-slate-900">
//                     {campaign.title}
//                   </h3>

//                   <span
//                     className={`px-3 py-1 text-xs font-bold rounded-full ${
//                       campaign.status === "completed"
//                         ? "bg-green-100 text-green-600"
//                         : campaign.status === "ongoing"
//                         ? "bg-yellow-100 text-yellow-600"
//                         : "bg-indigo-50 text-indigo-600"
//                     }`}
//                   >
//                     {campaign.status}
//                   </span>
//                 </div>

//                 <p className="text-slate-500 text-sm mb-6 line-clamp-3">
//                   {campaign.description}
//                 </p>

//                 <div className="space-y-3 text-sm">

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Budget
//                     </span>
//                     <span className="font-bold text-indigo-600">
//                       ₹{campaign.budget}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       City
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.city || "N/A"}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Applications
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.applicationsCount || 0}
//                     </span>
//                   </div>

//                 </div>

//                 <div className="mt-8 flex flex-wrap gap-3">

//                   <Link
//                     href={`/campaigns/${campaign._id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-slate-100 font-semibold hover:bg-slate-200"
//                   >
//                     View
//                   </Link>

//                   <Link
//                     href={`/campaigns/${campaign._id}/applications`}
//                     className="flex-1 text-center py-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
//                   >
//                     Applications
//                   </Link>

//                   {campaign.status !== "completed" && (
//                     <button
//                       onClick={() => completeCampaign(campaign._id)}
//                       className="flex-1 text-center py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
//                     >
//                       Complete
//                     </button>
//                   )}

//                 </div>
//               </div>
//             ))}

//           </div>
//         ) : (

//           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">
//               No Campaigns Found
//             </h3>
//             <p className="text-slate-400 mb-6">
//               Create your first campaign to get started.
//             </p>
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//             >
//               Create Campaign
//             </Link>
//           </div>

//         )}

//       </div>
//     </div>
//   );
// }


// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignBoard() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     const token = localStorage.getItem("token");

//     console.log("Stored User:", storedUser);
//     console.log("Stored Token:", token);

//     if (!storedUser || !token) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const role = parsedUser?.role?.toLowerCase();

//     if (role !== "brand" && role !== "admin") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);

//     // ✅ IMPORTANT: token direct localStorage se pass karna hai
//     fetchCampaigns(token);

//   }, [router]);

//   /* ================= FETCH CAMPAIGNS ================= */

//   const fetchCampaigns = async (token: string) => {
//     try {
//       setLoading(true);

//       console.log("🔑 TOKEN USED:", token);

//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         method: "GET",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       console.log("📡 STATUS:", res.status);

//       if (res.status === 401) {
//         console.log("❌ Unauthorized — Redirecting to login");
//         localStorage.removeItem("cb_user");
//         localStorage.removeItem("token");
//         router.push("/login");
//         return;
//       }

//       if (!res.ok) {
//         throw new Error("Failed to fetch campaigns");
//       }

//       const data = await res.json();
//       console.log("📦 API RESPONSE:", data);

//       // Handle all response types safely
//       if (Array.isArray(data)) {
//         setCampaigns(data);
//       } else if (Array.isArray(data.campaigns)) {
//         setCampaigns(data.campaigns);
//       } else if (Array.isArray(data.data)) {
//         setCampaigns(data.data);
//       } else {
//         setCampaigns([]);
//       }

//     } catch (error) {
//       console.error("🔥 Fetch Error:", error);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= LOADING ================= */

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-lg font-bold">
//         Loading Campaigns...
//       </div>
//     );
//   }

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">

//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">
//               Campaign Studio
//             </h1>
//             <p className="text-slate-500 mt-2 font-medium">
//               Manage your brand campaigns.
//             </p>
//           </div>

//           <Link
//             href="/campaigns/post"
//             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
//           >
//             + Create Campaign
//           </Link>
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">

//         {campaigns.length > 0 ? (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

//             {campaigns.map((campaign: any) => (
//               <div
//                 key={campaign._id || campaign.id}
//                 className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all"
//               >
//                 <div className="flex justify-between items-start mb-6">
//                   <h3 className="text-xl font-black text-slate-900">
//                     {campaign.title}
//                   </h3>

//                   <span className="px-3 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-full">
//                     {campaign.status || "Open"}
//                   </span>
//                 </div>

//                 <p className="text-slate-500 text-sm mb-6 line-clamp-3">
//                   {campaign.description}
//                 </p>

//                 <div className="space-y-3 text-sm">

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Budget
//                     </span>
//                     <span className="font-bold text-indigo-600">
//                       ₹{campaign.budget}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Category
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.category}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Deadline
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.deadline
//                         ? new Date(campaign.deadline).toLocaleDateString()
//                         : "N/A"}
//                     </span>
//                   </div>

//                 </div>

//                 <div className="mt-8 flex gap-3">
//                   <Link
//                     href={`/campaigns/${campaign._id || campaign.id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-slate-100 font-semibold hover:bg-slate-200"
//                   >
//                     View
//                   </Link>

//                   <Link
//                     href={`/campaigns/edit/${campaign._id || campaign.id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
//                   >
//                     Edit
//                   </Link>
//                 </div>

//               </div>
//             ))}

//           </div>
//         ) : (

//           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">
//               No Campaigns Found
//             </h3>
//             <p className="text-slate-400 mb-6">
//               Create your first campaign to get started.
//             </p>
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//             >
//               Create Campaign
//             </Link>
//           </div>

//         )}

//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// export default function CampaignBoard() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const role = parsedUser?.role?.toLowerCase();

//     if (role !== "brand" && role !== "admin") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);
//     fetchCampaigns(parsedUser.token);
//   }, [router]);

//   // 🔥 SAFE FETCH FUNCTION
//   const fetchCampaigns = async (token: string) => {
//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/campaigns/my",
//         {
//           method: "GET",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (!res.ok) {
//         throw new Error("Failed to fetch campaigns");
//       }

//       const data = await res.json();

//       console.log("API RESPONSE:", data);

//       // ✅ HANDLE ALL POSSIBLE RESPONSE STRUCTURES
//       if (Array.isArray(data)) {
//         setCampaigns(data);
//       } else if (Array.isArray(data.campaigns)) {
//         setCampaigns(data.campaigns);
//       } else if (Array.isArray(data.data)) {
//         setCampaigns(data.data);
//       } else {
//         setCampaigns([]);
//       }
//     } catch (error) {
//       console.error("Fetch Error:", error);
//       alert("Error fetching campaigns");
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-lg font-bold">
//         Loading Campaigns...
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">
//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200 shadow-sm">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">
//               Campaign Studio
//             </h1>
//             <p className="text-slate-500 mt-2 font-medium">
//               Manage your brand campaigns.
//             </p>
//           </div>

//           <Link
//             href="/campaigns/post"
//             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
//           >
//             + Create Campaign
//           </Link>
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">
//         {campaigns.length > 0 ? (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
//             {campaigns.map((campaign: any) => (
//               <div
//                 key={campaign._id || campaign.id}
//                 className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-lg transition-all"
//               >
//                 <div className="flex justify-between items-start mb-6">
//                   <h3 className="text-xl font-black text-slate-900">
//                     {campaign.title}
//                   </h3>

//                   <span className="px-3 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-full">
//                     {campaign.status || "Open"}
//                   </span>
//                 </div>

//                 <p className="text-slate-500 text-sm mb-6 line-clamp-3">
//                   {campaign.description}
//                 </p>

//                 <div className="space-y-3 text-sm">
//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Budget
//                     </span>
//                     <span className="font-bold text-indigo-600">
//                       ₹{campaign.budget}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Category
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.category}
//                     </span>
//                   </div>

//                   <div className="flex justify-between">
//                     <span className="text-slate-400 font-semibold">
//                       Deadline
//                     </span>
//                     <span className="font-bold text-slate-700">
//                       {campaign.deadline
//                         ? new Date(
//                             campaign.deadline
//                           ).toLocaleDateString()
//                         : "N/A"}
//                     </span>
//                   </div>
//                 </div>

//                 <div className="mt-8 flex gap-3">
//                   <Link
//                     href={`/campaigns/${campaign._id || campaign.id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-slate-100 font-semibold hover:bg-slate-200"
//                   >
//                     View
//                   </Link>

//                   <Link
//                     href={`/campaigns/edit/${campaign._id || campaign.id}`}
//                     className="flex-1 text-center py-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
//                   >
//                     Edit
//                   </Link>
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">
//               No Campaigns Found
//             </h3>
//             <p className="text-slate-400 mb-6">
//               Create your first campaign to get started.
//             </p>
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//             >
//               Create Campaign
//             </Link>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, useEffect } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { MOCK_CAMPAIGNS } from "@/lib/constants";
// import { UserRole } from "@/lib/types";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [applications, setApplications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     const role = parsedUser?.role?.toLowerCase();

//     // 🔒 Only Brand or Admin allowed
//     if (role !== "brand" && role !== "admin") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);

//     const savedCampaigns = JSON.parse(
//       localStorage.getItem("cb_campaigns") || "[]"
//     );

//     setAllCampaigns([...savedCampaigns, ...MOCK_CAMPAIGNS]);

//     const apps = JSON.parse(
//       localStorage.getItem("cb_applications") || "[]"
//     );

//     setApplications(apps);

//     setLoading(false);
//   }, [router]);

//   if (loading || !user) return null;

//   const brandCampaigns = allCampaigns.filter(
//     (c) =>
//       c.brandId === user?.id ||
//       c.brandName === user?.name
//   );

//   return (
//     <div className="min-h-screen bg-[#f8fafc] pb-24">

//       {/* HEADER */}
//       <div className="bg-white border-b border-slate-200">
//         <div className="max-w-7xl mx-auto px-6 py-10 flex justify-between items-center">
//           <div>
//             <h1 className="text-4xl font-black text-slate-900">
//               Campaign Studio
//             </h1>
//             <p className="text-slate-500 mt-2 font-medium">
//               Manage your brand campaigns and review applications.
//             </p>
//           </div>

//           <Link
//             href="/campaigns/post"
//             className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
//           >
//             + Create Campaign
//           </Link>
//         </div>
//       </div>

//       {/* CONTENT */}
//       <div className="max-w-7xl mx-auto px-6 mt-12">

//         {brandCampaigns.length > 0 ? (
//           <div className="space-y-8">
//             {brandCampaigns.map((campaign) => (
//               <div
//                 key={campaign.id}
//                 className="bg-white rounded-3xl border p-8 shadow-sm"
//               >
//                 <div className="flex justify-between items-start mb-6">
//                   <div>
//                     <h3 className="text-2xl font-black text-slate-900">
//                       {campaign.title}
//                     </h3>
//                     <p className="text-slate-500 text-sm mt-2">
//                       Category: {campaign.category}
//                     </p>
//                   </div>
//                   <div className="text-indigo-600 font-bold text-lg">
//                     {campaign.budget}
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-2 gap-6">
//                   <div className="p-4 bg-slate-50 rounded-xl">
//                     <p className="text-xs text-slate-400 font-bold uppercase">
//                       Deadline
//                     </p>
//                     <p className="font-bold text-slate-700">
//                       {new Date(
//                         campaign.deadline
//                       ).toLocaleDateString()}
//                     </p>
//                   </div>

//                   <div className="p-4 bg-slate-50 rounded-xl">
//                     <p className="text-xs text-slate-400 font-bold uppercase">
//                       Applicants
//                     </p>
//                     <p className="font-bold text-indigo-600">
//                       {
//                         applications.filter(
//                           (a) =>
//                             a.campaignId === campaign.id
//                         ).length
//                       }
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         ) : (
//           <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
//             <h3 className="text-xl font-black text-slate-900 mb-2">
//               No Campaigns Yet
//             </h3>
//             <p className="text-slate-400 mb-6">
//               Start by creating your first campaign.
//             </p>
//             <Link
//               href="/campaigns/post"
//               className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold"
//             >
//               Create Campaign
//             </Link>
//           </div>
//         )}

//       </div>
//     </div>
//   );
// }
