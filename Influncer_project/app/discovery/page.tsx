"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const API          = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID      = "plan_SKmSEwh4wl4Tv6";
const FREE_COINS      = 100;
const COINS_PER_APPLY = 10;

export default function DiscoveryPage() {
  const router = useRouter();

  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [cities, setCities]             = useState<string[]>([]);
  const [categories, setCategories]     = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [appliedIds, setAppliedIds]     = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCat, setSelectedCat]   = useState("");
  const [token, setToken]               = useState("");
  const [influencerId, setInfluencerId] = useState("");

  const [coins, setCoins]               = useState<number>(FREE_COINS);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showCoinModal, setShowCoinModal] = useState(false);
  const [loadingPlan, setLoadingPlan]   = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [coinToast, setCoinToast]       = useState<string | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /* ===== AUTH — bits only, profile/me se coins KABHI override nahi ===== */
  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);

    // ✅ Stale 'coins' field hata do — sirf 'bits' use hoga
    // 'coins' field tha jo har refresh pe 100 reset karata tha
    if (parsed.coins !== undefined) {
      delete parsed.coins;
      localStorage.setItem("cb_user", JSON.stringify(parsed));
    }

    if (parsed.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
    const t = parsed.token || localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);

    const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || "";
    setInfluencerId(id);

    const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
    setAppliedIds(savedApplied);

    // ✅ SIRF localStorage.bits use karo
    // Yeh value tab update hoti hai jab:
    // 1. Influencer campaignsdetail page pe apply karta hai
    // 2. Backend response mein updated bits aata hai
    // 3. Woh value localStorage mein save hoti hai
    // profile/me KABHI bits override nahi karega — woh 100 return karta rehta tha
    const localBits = parsed.bits ?? FREE_COINS;
    setCoins(localBits);
    setIsSubscribed(parsed.isSubscribed ?? false);

    // ✅ profile/me se SIRF isSubscribed lo — bits/coins NAHI
    fetch(`${API}/profile/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => {
        if (data?.success && data?.profile) {
          const liveSub = data.profile.isSubscribed ?? false;
          setIsSubscribed(liveSub);
          // Sirf subscription update karo localStorage mein
          const updated = { ...parsed, isSubscribed: liveSub };
          delete updated.coins; // stale field kabhi nahi rakhenge
          localStorage.setItem("cb_user", JSON.stringify(updated));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAllCampaigns();
  }, [token]);

  // ✅ Window focus pe localStorage se bits reload karo
  // (Jab creator campaignsdetail pe apply karke wapas aaye — bits updated mil jayenge)
  useEffect(() => {
    const handleFocus = () => {
      const saved = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      setAppliedIds(saved);
      const raw = localStorage.getItem("cb_user");
      if (raw) {
        const p = JSON.parse(raw);
        // ✅ bits field — coins nahi
        setCoins(p.bits ?? FREE_COINS);
        setIsSubscribed(p.isSubscribed ?? false);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchAllCampaigns = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/campaigns/all`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) return;
      const campaigns = Array.isArray(data.data) ? data.data
        : Array.isArray(data.campaigns) ? data.campaigns
        : Array.isArray(data) ? data : [];
      setAllCampaigns(campaigns);

      const applied      = campaigns.filter((c: any) => c.hasApplied || c.applied).map((c: any) => c._id);
      const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      setAppliedIds([...new Set([...applied, ...savedApplied])]);

      const citySet = new Set<string>();
      const catSet  = new Set<string>();
      campaigns.forEach((camp: any) => {
        if (camp.city?.trim()) citySet.add(camp.city.toLowerCase().trim());
        if (Array.isArray(camp.categories)) {
          camp.categories.forEach((cat: string) => { if (cat?.trim()) catSet.add(cat.toLowerCase().trim()); });
        }
      });
      setCities([...citySet]);
      setCategories([...catSet]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      const cityMatch = selectedCity ? c.city?.toLowerCase() === selectedCity : true;
      const catMatch  = selectedCat
        ? Array.isArray(c.categories)
          ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCat)
          : c.category?.toLowerCase() === selectedCat
        : true;
      return cityMatch && catMatch;
    });
  }, [allCampaigns, selectedCity, selectedCat]);

  /* ===== RAZORPAY ===== */
  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const tok    = parsed.token || localStorage.getItem("token");
    const options = {
      key: RAZORPAY_KEY, subscription_id: subscriptionId,
      name: "Influex Premium", description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: { name: parsed?.name || "", email: parsed?.email || "" },
      handler: async function (response: any) {
        try {
          await fetch(`${API}/subscription/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
            body: JSON.stringify({
              razorpay_payment_id:      response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature:       response.razorpay_signature,
              plan_id: PLAN_ID, planName,
            }),
          });
        } catch {}
        const aRes  = await fetch(`${API}/subscription/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
          body: JSON.stringify({ plan_id: PLAN_ID, planId, planName }),
        });
        const aData = await aRes.json();
        if (aData.success) {
          const updated = { ...parsed, isSubscribed: true, activePlan: planId, bits: 99999 };
          delete updated.coins;
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setIsSubscribed(true); setCoins(99999); setShowCoinModal(false);
          showToast(`🎉 ${planName} activated! Unlimited applies!`, "success");
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
      const res  = await fetch(`${API}/subscription/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ plan_id: PLAN_ID }),
      });
      const data = await res.json();
      if (!data.success || !data.subscription?.id) {
        showToast(data.message || "Failed.", "error"); setLoadingPlan(null); return;
      }
      openRazorpay(data.subscription.id, planId, planName);
    } catch { showToast("Something went wrong.", "error"); setLoadingPlan(null); }
  };

  const coinsPercent = Math.max(0, Math.min(100, (coins / FREE_COINS) * 100));
  const coinsLow     = !isSubscribed && coins <= 20 && coins > 0;
  const coinsEmpty   = !isSubscribed && coins <= 0;
  const appliesLeft  = isSubscribed ? "∞" : Math.floor(coins / COINS_PER_APPLY);
  const VISIBLE_COUNT = 3;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp  { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes toastIn  { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes miniSpin { to { transform: rotate(360deg); } }

        .disc-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

        .disc-header { padding: 40px 40px 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .disc-header { padding: 24px 16px 0; } }
        .disc-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
        .disc-sub   { color: #999; font-size: 14px; margin: 0; }

        .disc-coin-pill { display: flex; align-items: center; gap: 10px; background: #fff; border: 1.5px solid #e8e8e8; border-radius: 14px; padding: 10px 16px; min-width: 200px; flex-shrink: 0; transition: border-color 0.2s; }
        .disc-coin-pill.warn  { border-color: #fbbf24; background: #fffbeb; }
        .disc-coin-pill.empty { border-color: #ef4444; background: #fff5f5; }
        .disc-coin-pill.pro   { border-color: #86efac; background: #f0fdf4; }
        .disc-coin-icon { font-size: 20px; }
        .disc-coin-info { flex: 1; min-width: 0; }
        .disc-coin-label { font-size: 11px; color: #aaa; font-weight: 500; }
        .disc-coin-val { font-size: 17px; font-weight: 800; color: #4f46e5; line-height: 1; }
        .disc-coin-val.warn-val  { color: #d97706; }
        .disc-coin-val.empty-val { color: #ef4444; }
        .disc-coin-val.pro-val   { color: #16a34a; }
        .disc-coin-sub { font-size: 11px; color: #aaa; margin-top: 2px; }
        .disc-coin-bar-wrap { width: 100%; height: 3px; background: #f0f0f0; border-radius: 2px; margin-top: 4px; overflow: hidden; }
        .disc-coin-bar { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
        .disc-coin-upgrade-btn { padding: 7px 12px; border-radius: 8px; background: #4f46e5; color: #fff; font-size: 11px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .disc-coin-upgrade-btn:hover { background: #4338ca; }
        .disc-coin-upgrade-btn.warn-btn  { background: #f59e0b; }
        .disc-coin-upgrade-btn.warn-btn:hover  { background: #d97706; }
        .disc-coin-upgrade-btn.empty-btn { background: #ef4444; }
        .disc-coin-upgrade-btn.empty-btn:hover { background: #dc2626; }

        .disc-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; }
        @media(max-width:600px){ .disc-filters { padding: 16px; } }
        .disc-select { padding: 10px 36px 10px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; color: #555; outline: none; cursor: pointer; transition: all 0.2s; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; background-color: #fff; }
        .disc-select:focus { border-color: #4f46e5; }
        .disc-select.active { border-color: #4f46e5; background-color: #4f46e5; color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); }
        .disc-clear { padding: 10px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; color: #999; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s; }
        .disc-clear:hover { border-color: #ef4444; color: #ef4444; }

        .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 16px; }
        @media(max-width:600px){ .disc-stats { padding: 0 16px 12px; } }
        .disc-stat-text  { font-size: 13px; color: #999; }
        .disc-stat-count { font-size: 13px; font-weight: 700; color: #4f46e5; }

        .disc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; padding: 0 40px 32px; }
        @media(max-width:600px){ .disc-grid { grid-template-columns: 1fr; padding: 0 16px 24px; gap: 14px; } }

        .disc-card { background: #fff; border-radius: 18px; border: 1.5px solid #ebebeb; padding: 22px; transition: all 0.2s; cursor: pointer; }
        .disc-card:hover { border-color: #c7d2fe; box-shadow: 0 8px 30px rgba(79,70,229,0.08); transform: translateY(-2px); }
        .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }
        .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
        .disc-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
        .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; flex-shrink: 0; }
        .disc-badge.applied { background: #eff6ff; color: #4f46e5; border-color: #c7d2fe; }
        .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .disc-meta { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
        .disc-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; font-weight: 500; }
        .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .disc-cat { padding: 3px 10px; border-radius: 100px; background: #f0eeff; font-size: 11px; color: #4f46e5; font-weight: 600; }

        .disc-coin-cost { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #aaa; font-weight: 600; margin-bottom: 10px; background: #fafafa; border-radius: 8px; padding: 6px 10px; }
        .disc-coin-cost.empty-cost { color: #ef4444; background: #fff5f5; }

        .disc-apply-btn { width: 100%; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .disc-apply-btn:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
        .disc-apply-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
        .disc-apply-btn.applied-btn  { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .disc-apply-btn.applied-btn:hover { background: #dcfce7; transform: none; }
        .disc-apply-btn.no-coins-btn { background: #fff5f5; color: #ef4444; border: 1.5px solid #fecaca; }
        .disc-apply-btn.no-coins-btn:hover { background: #fee2e2; transform: none; }

        .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
        .disc-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .disc-empty-title { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
        .disc-empty-sub   { color: #aaa; font-size: 14px; margin: 0; }

        .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
        .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }

        .disc-unlock-banner { margin: 0 40px 40px; background: linear-gradient(135deg, #faf5ff, #eff6ff); border: 1.5px solid #c7d2fe; border-radius: 18px; padding: 28px; text-align: center; }
        @media(max-width:600px){ .disc-unlock-banner { margin: 0 16px 24px; } }
        .disc-unlock-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
        .disc-unlock-sub   { color: #888; font-size: 13px; margin: 0 0 16px; }
        .disc-unlock-btn { display: inline-block; padding: 11px 24px; border-radius: 11px; background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; border: none; transition: background 0.2s; }
        .disc-unlock-btn:hover { background: #4338ca; }

        .coin-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
        .coin-modal { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; padding: 36px 32px 30px; position: relative; text-align: center; animation: slideUp 0.25s ease; }
        .coin-modal-close { position: absolute; top: 14px; right: 16px; background: none; border: none; font-size: 20px; cursor: pointer; color: #aaa; padding: 4px; }
        .coin-modal-close:hover { color: #555; }
        .coin-modal-icon  { font-size: 56px; margin-bottom: 16px; line-height: 1; }
        .coin-modal-title { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 8px; }
        .coin-modal-sub   { font-size: 14px; color: #777; line-height: 1.65; margin-bottom: 10px; }
        .coin-prog-wrap { margin: 16px 0 24px; }
        .coin-prog-top  { display: flex; justify-content: space-between; font-size: 12px; color: #aaa; margin-bottom: 6px; }
        .coin-prog      { height: 8px; background: #f0f0f0; border-radius: 100px; overflow: hidden; }
        .coin-prog-fill { height: 100%; border-radius: 100px; transition: width 0.6s ease; }
        .coin-plan-btn { width: 100%; padding: 14px 20px; border-radius: 14px; border: none; font-size: 15px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .coin-plan-btn:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(79,70,229,0.4); transform: translateY(-1px); }
        .coin-plan-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }
        .coin-skip   { font-size: 13px; color: #ccc; cursor: pointer; background: none; border: none; font-family: 'Plus Jakarta Sans', sans-serif; text-decoration: underline; }
        .coin-skip:hover { color: #888; }
        .coin-secure { font-size: 11px; color: #ddd; margin-top: 10px; }

        .disc-toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: toastIn 0.3s ease; white-space: nowrap; max-width: 90vw; text-align: center; }
        .disc-toast.success { background: #16a34a; color: #fff; }
        .disc-toast.error   { background: #ef4444; color: #fff; }
        .disc-coin-toast { position: fixed; top: 80px; right: 24px; background: #111; color: #fff; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99998; box-shadow: 0 4px 16px rgba(0,0,0,0.2); animation: toastIn 0.3s ease; }
        .mini-spin { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: miniSpin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
      `}</style>

      {toast     && <div className={`disc-toast ${toast.type}`}>{toast.msg}</div>}
      {coinToast && <div className="disc-coin-toast">{coinToast}</div>}

      {/* ── COIN MODAL ── */}
      {showCoinModal && (
        <div className="coin-overlay">
          <div className="coin-modal">
            <button className="coin-modal-close" onClick={() => setShowCoinModal(false)}>✕</button>
            <div className="coin-modal-icon">🪙</div>
            <div className="coin-modal-title">{coinsEmpty ? "Coins Khatam Ho Gaye!" : "Coins Khatam Hone Wale Hain!"}</div>
            <div className="coin-modal-sub">
              {coinsEmpty
                ? `Saare ${FREE_COINS} coins use ho gaye. Pro plan lo — unlimited campaigns apply karo.`
                : `Sirf ${coins} coins bache — ${Math.floor(coins / COINS_PER_APPLY)} aur applies. Upgrade karo!`}
            </div>
            <div className="coin-prog-wrap">
              <div className="coin-prog-top">
                <span>Coins used</span>
                <span>{FREE_COINS - Math.max(0, coins)} / {FREE_COINS}</span>
              </div>
              <div className="coin-prog">
                <div className="coin-prog-fill" style={{
                  width: `${Math.min(100, ((FREE_COINS - Math.max(0, coins)) / FREE_COINS) * 100)}%`,
                  background: coinsEmpty ? "#ef4444" : "#f59e0b",
                }} />
              </div>
            </div>
            <button className="coin-plan-btn" onClick={() => handleSubscribe("pro_monthly", "Pro")} disabled={loadingPlan !== null}>
              <span>
                {loadingPlan === "pro_monthly"
                  ? <><span className="mini-spin" />Processing...</>
                  : "⚡ Upgrade to Pro — Unlimited Applies"}
              </span>
              <span style={{ fontSize: 13, opacity: 0.85 }}>₹999/mo</span>
            </button>
            <button className="coin-skip" onClick={() => setShowCoinModal(false)}>Maybe later</button>
            <div className="coin-secure">🔒 Secured by Razorpay</div>
          </div>
        </div>
      )}

      <div className="disc-page">
        {/* ── HEADER ── */}
        <div className="disc-header">
          <div>
            <h1 className="disc-title">Discover Campaigns</h1>
            <p className="disc-sub">Find brand campaigns that match your vibe</p>
          </div>

          {/* COIN PILL */}
          <div className={`disc-coin-pill ${isSubscribed ? "pro" : coinsEmpty ? "empty" : coinsLow ? "warn" : ""}`}>
            <div className="disc-coin-icon">🪙</div>
            <div className="disc-coin-info">
              <div className="disc-coin-label">
                {isSubscribed ? "Unlimited Coins" : `Coins • ${appliesLeft} applies left`}
              </div>
              <div className={`disc-coin-val ${isSubscribed ? "pro-val" : coinsEmpty ? "empty-val" : coinsLow ? "warn-val" : ""}`}>
                {isSubscribed ? "∞" : coins}
              </div>
              <div className="disc-coin-sub">
                {isSubscribed ? "Pro Plan" : `${COINS_PER_APPLY} coins per apply`}
              </div>
              {!isSubscribed && (
                <div className="disc-coin-bar-wrap">
                  <div className="disc-coin-bar" style={{
                    width: `${coinsPercent}%`,
                    background: coinsEmpty ? "#ef4444" : coinsLow ? "#f59e0b" : "#4f46e5",
                  }} />
                </div>
              )}
            </div>
            {!isSubscribed && (
              <button
                className={`disc-coin-upgrade-btn ${coinsEmpty ? "empty-btn" : coinsLow ? "warn-btn" : ""}`}
                onClick={() => setShowCoinModal(true)}
              >
                {coinsEmpty ? "Upgrade!" : coinsLow ? "Upgrade ⚡" : "Upgrade"}
              </button>
            )}
          </div>
        </div>

        {/* ── FILTERS ── */}
        <div className="disc-filters">
          <select
            className={`disc-select ${selectedCity ? "active" : ""}`}
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="">🏙 All Cities</option>
            {cities.map((city, i) => (
              <option key={i} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
            ))}
          </select>
          <select
            className={`disc-select ${selectedCat ? "active" : ""}`}
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
          >
            <option value="">🎯 All Categories</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          {(selectedCity || selectedCat) && (
            <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCat(""); }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── STATS ── */}
        {!loading && allCampaigns.length > 0 && (
          <div className="disc-stats">
            <span className="disc-stat-count">{filteredCampaigns.length}</span>
            <span className="disc-stat-text">campaigns {selectedCity || selectedCat ? "found" : "available"}</span>
          </div>
        )}

        {/* ── CONTENT ── */}
        {loading ? (
          <div className="disc-loading"><div className="disc-spinner" /></div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="disc-empty">
            <div className="disc-empty-icon">🔍</div>
            <h3 className="disc-empty-title">
              {selectedCity || selectedCat ? "No matches found" : "No campaigns yet"}
            </h3>
            <p className="disc-empty-sub">
              {selectedCity || selectedCat ? "Try different filters" : "Check back soon!"}
            </p>
          </div>
        ) : (
          <>
            <div className="disc-grid">
              {filteredCampaigns.map((c, index) => {
                const isBlurred = index >= VISIBLE_COUNT;
                const isApplied = appliedIds.includes(c._id);
                const cantApply = coinsEmpty && !isSubscribed;

                return (
                  <div
                    key={c._id}
                    className={`disc-card ${isBlurred ? "blurred" : ""}`}
                    onClick={() => !isBlurred && router.push(`/campaigns/campaignsdetail?id=${c._id}`)}
                  >
                    <div className="disc-card-top">
                      <h2 className="disc-card-title">{c.title}</h2>
                      {isApplied
                        ? <span className="disc-badge applied">Applied ✓</span>
                        : <span className="disc-badge">Open</span>}
                    </div>

                    {c.description && <p className="disc-desc">{c.description}</p>}

                    <div className="disc-meta">
                      {c.budget && <span className="disc-meta-item">💰 ₹{c.budget.toLocaleString()}</span>}
                      {c.city   && <span className="disc-meta-item">📍 {c.city.charAt(0).toUpperCase() + c.city.slice(1)}</span>}
                    </div>

                    {c.categories?.length > 0 && (
                      <div className="disc-cats">
                        {c.categories.map((cat: string, i: number) => (
                          <span key={i} className="disc-cat">{cat}</span>
                        ))}
                      </div>
                    )}

                    {/* Coin cost indicator — sirf non-blurred, non-applied, non-subscribed ke liye */}
                    {!isBlurred && !isApplied && !isSubscribed && (
                      <div className={`disc-coin-cost ${cantApply ? "empty-cost" : ""}`}>
                        🪙 {COINS_PER_APPLY} coins required to apply
                        {cantApply && " — Not enough coins!"}
                      </div>
                    )}

                    {/* ── BUTTONS ── */}
                    {!isBlurred && (
                      isApplied ? (
                        // ✅ Applied — detail page pe jaao
                        <button
                          className="disc-apply-btn applied-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/campaigns/campaignsdetail?id=${c._id}`);
                          }}
                        >
                          ✓ Applied — View Details
                        </button>
                      ) : cantApply ? (
                        // ❌ Coins nahi — upgrade modal
                        <button
                          className="disc-apply-btn no-coins-btn"
                          onClick={(e) => { e.stopPropagation(); setShowCoinModal(true); }}
                        >
                          🪙 Not enough coins — Upgrade
                        </button>
                      ) : (
                        // ✅ Normal — campaignsdetail pe jaao, apply wahan hoga
                        // Coins wahan deduct honge backend se, response mein bits aayega
                        // Woh bits localStorage mein save hoga
                        // Wapas aane pe window focus bits reload kar lega
                        <button
                          className="disc-apply-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Coin check
                            if (!isSubscribed && coins < COINS_PER_APPLY) {
                              setShowCoinModal(true);
                              return;
                            }
                            router.push(`/campaigns/campaignsdetail?id=${c._id}`);
                          }}
                        >
                          View & Apply →
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {filteredCampaigns.length > VISIBLE_COUNT && (
              <div className="disc-unlock-banner">
                <p className="disc-unlock-title">🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns locked</p>
                <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
                <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
                  Complete Profile →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);
//     const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     setAppliedIds(savedApplied);
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns(); // cities/categories campaigns se extract hongi
//   }, [token]);

//   useEffect(() => {
//     const handleFocus = () => {
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds(savedApplied);
//     };
//     window.addEventListener("focus", handleFocus);
//     return () => window.removeEventListener("focus", handleFocus);
//   }, []);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/campaigns/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (!res.ok) { console.error(data.message); return; }
//       const campaigns = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.campaigns) ? data.campaigns
//         : Array.isArray(data) ? data : [];
//       setAllCampaigns(campaigns);
//       const applied = campaigns.filter((c: any) => c.hasApplied || c.applied).map((c: any) => c._id);
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds([...new Set([...applied, ...savedApplied])]);
//       // ✅ Campaigns se directly cities/categories extract karo
//       const citySet = new Set<string>();
//       const catSet = new Set<string>();
//       campaigns.forEach((camp: any) => {
//         if (camp.city?.trim()) citySet.add(camp.city.toLowerCase().trim());
//         if (Array.isArray(camp.categories)) {
//           camp.categories.forEach((cat: string) => { if (cat?.trim()) catSet.add(cat.toLowerCase().trim()); });
//         } else if (camp.category?.trim()) {
//           catSet.add(camp.category.toLowerCase().trim());
//         }
//       });
//       setCities([...citySet]);
//       setCategories([...catSet]);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       console.log("CITIES RAW:", cityData);
//       console.log("CATS RAW:", catData);

//       // ✅ Handle every possible response shape
//       const extractList = (d: any): string[] => {
//         const raw = d?.data ?? d?.cities ?? d?.categories ?? d;
//         const arr = Array.isArray(raw) ? raw : [];
//         return arr.map((item: any) =>
//           typeof item === "string" ? item : item?.name || item?.city || item?.category || ""
//         ).filter(Boolean);
//       };

//       // ✅ Deduplicate
//       // ✅ Lowercase + trim + deduplicate
//       const cityList = [...new Set(extractList(cityData).map((c: string) => c.toLowerCase().trim()))].filter(Boolean);
//       const catList  = [...new Set(extractList(catData).map((c: string) => c.toLowerCase().trim()))].filter(Boolean);

//       console.log("CITIES PARSED:", cityList);
//       console.log("CATS PARSED:", catList);

//       setCities(cityList);
//       setCategories(catList);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity ? c.city?.toLowerCase() === selectedCity.toLowerCase() : true;
//       const catMatch = selectedCategory
//         ? Array.isArray(c.categories)
//           ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
//           : c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   const applyCampaign = async (campaignId: string) => {
//     if (!influencerId) { alert("Influencer ID missing ❌"); return; }
//     if (appliedIds.includes(campaignId)) { alert("Already Applied ✅"); return; }
//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Apply failed"); return; }
//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => {
//         const updated = [...prev, campaignId];
//         localStorage.setItem("appliedCampaigns", JSON.stringify(updated));
//         return updated;
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   const VISIBLE_COUNT = 3;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .disc-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .disc-header { padding: 40px 40px 0; }
//         @media(max-width:600px){ .disc-header{ padding: 24px 16px 0; } }

//         .disc-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
//         .disc-sub { color: #999; font-size: 14px; margin: 0; }

//         .disc-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; }
//         @media(max-width:600px){ .disc-filters{ padding: 16px 16px; } }

//         .disc-select {
//           padding: 10px 36px 10px 14px;
//           border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff;
//           font-size: 13px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           font-weight: 500;
//           color: #555;
//           outline: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           appearance: none;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//           background-repeat: no-repeat;
//           background-position: right 12px center;
//           background-color: #fff;
//         }
//         .disc-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
//         .disc-select.active {
//           border-color: #4f46e5; background-color: #4f46e5; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .disc-clear {
//           padding: 10px 16px; border-radius: 100px;
//           border: 1.5px solid #e8e8e8; background: #fafafa;
//           font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;
//           color: #999; cursor: pointer; transition: all 0.2s;
//         }
//         .disc-clear:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

//         .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 16px; }
//         @media(max-width:600px){ .disc-stats{ padding: 0 16px 12px; } }
//         .disc-stat-text { font-size: 13px; color: #999; }
//         .disc-stat-count { font-size: 13px; font-weight: 700; color: #4f46e5; }

//         .disc-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
//           gap: 18px;
//           padding: 0 40px 32px;
//         }
//         @media(max-width:600px){ .disc-grid{ grid-template-columns: 1fr; padding: 0 16px 24px; gap: 14px; } }

//         .disc-card {
//           background: #fff;
//           border-radius: 18px;
//           border: 1.5px solid #ebebeb;
//           padding: 22px;
//           transition: all 0.2s;
//           cursor: pointer;
//         }
//         .disc-card:hover { border-color: #c7d2fe; box-shadow: 0 8px 30px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }

//         .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
//         .disc-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
//         .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; flex-shrink: 0; }
//         .disc-badge.applied { background: #eff6ff; color: #4f46e5; border-color: #c7d2fe; }

//         .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .disc-meta { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
//         .disc-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; font-weight: 500; }

//         .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
//         .disc-cat { padding: 3px 10px; border-radius: 100px; background: #f0eeff; font-size: 11px; color: #4f46e5; font-weight: 600; }

//         .disc-apply-btn {
//           width: 100%; padding: 11px;
//           border-radius: 11px; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           border: none; cursor: pointer; transition: all 0.2s;
//           background: #4f46e5; color: #fff;
//         }
//         .disc-apply-btn:hover { background: #4338ca; transform: translateY(-1px); }
//         .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; cursor: default; transform: none; }

//         .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
//         .disc-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .disc-empty-title { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .disc-empty-sub { color: #aaa; font-size: 14px; margin: 0; }

//         .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
//         .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }

//         .disc-unlock-banner {
//           margin: 0 40px 40px;
//           background: linear-gradient(135deg, #faf5ff, #eff6ff);
//           border: 1.5px solid #c7d2fe;
//           border-radius: 18px; padding: 28px; text-align: center;
//         }
//         @media(max-width:600px){ .disc-unlock-banner{ margin: 0 16px 24px; } }
//         .disc-unlock-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .disc-unlock-sub { color: #888; font-size: 13px; margin: 0 0 16px; }
//         .disc-unlock-btn {
//           display: inline-block; padding: 11px 24px; border-radius: 11px;
//           background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           cursor: pointer; border: none; transition: all 0.2s;
//         }
//         .disc-unlock-btn:hover { background: #4338ca; }
//       `}</style>

//       <div className="disc-page">
//         <div className="disc-header">
//           <h1 className="disc-title">Discover Campaigns</h1>
//           <p className="disc-sub">Find brand campaigns that match your vibe</p>
//         </div>

//         {/* FILTERS */}
//         <div className="disc-filters">
//           <select
//             className={`disc-select ${selectedCity ? "active" : ""}`}
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//           >
//             <option value="">🏙 All Cities</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>
//                 {city.charAt(0).toUpperCase() + city.slice(1)}
//               </option>
//             ))}
//           </select>

//           <select
//             className={`disc-select ${selectedCategory ? "active" : ""}`}
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//           >
//             <option value="">🎯 All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>
//                 {cat.charAt(0).toUpperCase() + cat.slice(1)}
//               </option>
//             ))}
//           </select>

//           {(selectedCity || selectedCategory) && (
//             <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
//               ✕ Clear
//             </button>
//           )}
//         </div>

//         {/* STATS */}
//         {!loading && allCampaigns.length > 0 && (
//           <div className="disc-stats">
//             <span className="disc-stat-count">{filteredCampaigns.length}</span>
//             <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
//           </div>
//         )}

//         {/* CONTENT */}
//         {loading ? (
//           <div className="disc-loading"><div className="disc-spinner" /></div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div className="disc-empty">
//             <div className="disc-empty-icon">🔍</div>
//             <h3 className="disc-empty-title">
//               {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
//             </h3>
//             <p className="disc-empty-sub">
//               {selectedCity || selectedCategory
//                 ? "Try different filters or clear to see all campaigns"
//                 : "Check back soon — brands are posting campaigns!"}
//             </p>
//           </div>
//         ) : (
//           <>
//             <div className="disc-grid">
//               {filteredCampaigns.map((c, index) => {
//                 const isBlurred = index >= VISIBLE_COUNT;
//                 const isApplied = appliedIds.includes(c._id);
//                 return (
//                   <div
//                     key={c._id}
//                     className={`disc-card ${isBlurred ? "blurred" : ""}`}
//                     onClick={() => !isBlurred && router.push(`/campaigns/campaignsdetail?id=${c._id}`)}
//                   >
//                     <div className="disc-card-top">
//                       <h2 className="disc-card-title">{c.title}</h2>
//                       {isApplied
//                         ? <span className="disc-badge applied">Applied ✓</span>
//                         : <span className="disc-badge">Open</span>
//                       }
//                     </div>

//                     {c.description && <p className="disc-desc">{c.description}</p>}

//                     <div className="disc-meta">
//                       {c.budget && (
//                         <span className="disc-meta-item">💰 ₹{c.budget.toLocaleString()}</span>
//                       )}
//                       {c.city && (
//                         <span className="disc-meta-item">
//                           📍 {c.city.charAt(0).toUpperCase() + c.city.slice(1)}
//                         </span>
//                       )}
//                     </div>

//                     {c.categories?.length > 0 && (
//                       <div className="disc-cats">
//                         {c.categories.map((cat: string, i: number) => (
//                           <span key={i} className="disc-cat">{cat}</span>
//                         ))}
//                       </div>
//                     )}

//                     {!isBlurred && (
//                       isApplied ? (
//                         <button className="disc-apply-btn applied-btn" disabled>✓ Applied</button>
//                       ) : (
//                         <button
//                           className="disc-apply-btn"
//                           onClick={(e) => { e.stopPropagation(); router.push(`/campaigns/campaignsdetail?id=${c._id}`); }}
//                         >
//                           View & Apply →
//                         </button>
//                       )
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="disc-unlock-banner">
//                 <p className="disc-unlock-title">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
//                 <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
//                   Complete Profile →
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </>
//   );
// }




// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);
//     const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     setAppliedIds(savedApplied);
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns(); // cities/categories campaigns se extract hongi
//   }, [token]);

//   useEffect(() => {
//     const handleFocus = () => {
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds(savedApplied);
//     };
//     window.addEventListener("focus", handleFocus);
//     return () => window.removeEventListener("focus", handleFocus);
//   }, []);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/campaigns/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (!res.ok) { console.error(data.message); return; }
//       const campaigns = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.campaigns) ? data.campaigns
//         : Array.isArray(data) ? data : [];
//       setAllCampaigns(campaigns);
//       const applied = campaigns.filter((c: any) => c.hasApplied || c.applied).map((c: any) => c._id);
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds([...new Set([...applied, ...savedApplied])]);
//       // ✅ Campaigns se directly cities/categories extract karo
//       const citySet = new Set<string>();
//       const catSet = new Set<string>();
//       campaigns.forEach((camp: any) => {
//         if (camp.city?.trim()) citySet.add(camp.city.toLowerCase().trim());
//         if (Array.isArray(camp.categories)) {
//           camp.categories.forEach((cat: string) => { if (cat?.trim()) catSet.add(cat.toLowerCase().trim()); });
//         } else if (camp.category?.trim()) {
//           catSet.add(camp.category.toLowerCase().trim());
//         }
//       });
//       setCities([...citySet]);
//       setCategories([...catSet]);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       console.log("CITIES RAW:", cityData);
//       console.log("CATS RAW:", catData);

//       // ✅ Handle every possible response shape
//       const extractList = (d: any): string[] => {
//         const raw = d?.data ?? d?.cities ?? d?.categories ?? d;
//         const arr = Array.isArray(raw) ? raw : [];
//         return arr.map((item: any) =>
//           typeof item === "string" ? item : item?.name || item?.city || item?.category || ""
//         ).filter(Boolean);
//       };

//       // ✅ Deduplicate
//       // ✅ Lowercase + trim + deduplicate
//       const cityList = [...new Set(extractList(cityData).map((c: string) => c.toLowerCase().trim()))].filter(Boolean);
//       const catList  = [...new Set(extractList(catData).map((c: string) => c.toLowerCase().trim()))].filter(Boolean);

//       console.log("CITIES PARSED:", cityList);
//       console.log("CATS PARSED:", catList);

//       setCities(cityList);
//       setCategories(catList);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity ? c.city?.toLowerCase() === selectedCity.toLowerCase() : true;
//       const catMatch = selectedCategory
//         ? Array.isArray(c.categories)
//           ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
//           : c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   const applyCampaign = async (campaignId: string) => {
//     if (!influencerId) { alert("Influencer ID missing ❌"); return; }
//     if (appliedIds.includes(campaignId)) { alert("Already Applied ✅"); return; }
//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Apply failed"); return; }
//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => {
//         const updated = [...prev, campaignId];
//         localStorage.setItem("appliedCampaigns", JSON.stringify(updated));
//         return updated;
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   const VISIBLE_COUNT = 3;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .disc-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .disc-header { padding: 40px 40px 0; }
//         @media(max-width:600px){ .disc-header{ padding: 24px 16px 0; } }

//         .disc-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
//         .disc-sub { color: #999; font-size: 14px; margin: 0; }

//         .disc-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; }
//         @media(max-width:600px){ .disc-filters{ padding: 16px 16px; } }

//         .disc-select {
//           padding: 10px 36px 10px 14px;
//           border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff;
//           font-size: 13px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           font-weight: 500;
//           color: #555;
//           outline: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           appearance: none;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//           background-repeat: no-repeat;
//           background-position: right 12px center;
//           background-color: #fff;
//         }
//         .disc-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
//         .disc-select.active {
//           border-color: #4f46e5; background-color: #4f46e5; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .disc-clear {
//           padding: 10px 16px; border-radius: 100px;
//           border: 1.5px solid #e8e8e8; background: #fafafa;
//           font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;
//           color: #999; cursor: pointer; transition: all 0.2s;
//         }
//         .disc-clear:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

//         .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 16px; }
//         @media(max-width:600px){ .disc-stats{ padding: 0 16px 12px; } }
//         .disc-stat-text { font-size: 13px; color: #999; }
//         .disc-stat-count { font-size: 13px; font-weight: 700; color: #4f46e5; }

//         .disc-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
//           gap: 18px;
//           padding: 0 40px 32px;
//         }
//         @media(max-width:600px){ .disc-grid{ grid-template-columns: 1fr; padding: 0 16px 24px; gap: 14px; } }

//         .disc-card {
//           background: #fff;
//           border-radius: 18px;
//           border: 1.5px solid #ebebeb;
//           padding: 22px;
//           transition: all 0.2s;
//           cursor: pointer;
//         }
//         .disc-card:hover { border-color: #c7d2fe; box-shadow: 0 8px 30px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }

//         .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
//         .disc-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
//         .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; flex-shrink: 0; }
//         .disc-badge.applied { background: #eff6ff; color: #4f46e5; border-color: #c7d2fe; }

//         .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .disc-meta { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
//         .disc-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; font-weight: 500; }

//         .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
//         .disc-cat { padding: 3px 10px; border-radius: 100px; background: #f0eeff; font-size: 11px; color: #4f46e5; font-weight: 600; }

//         .disc-apply-btn {
//           width: 100%; padding: 11px;
//           border-radius: 11px; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           border: none; cursor: pointer; transition: all 0.2s;
//           background: #4f46e5; color: #fff;
//         }
//         .disc-apply-btn:hover { background: #4338ca; transform: translateY(-1px); }
//         .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; cursor: default; transform: none; }

//         .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
//         .disc-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .disc-empty-title { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .disc-empty-sub { color: #aaa; font-size: 14px; margin: 0; }

//         .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
//         .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }

//         .disc-unlock-banner {
//           margin: 0 40px 40px;
//           background: linear-gradient(135deg, #faf5ff, #eff6ff);
//           border: 1.5px solid #c7d2fe;
//           border-radius: 18px; padding: 28px; text-align: center;
//         }
//         @media(max-width:600px){ .disc-unlock-banner{ margin: 0 16px 24px; } }
//         .disc-unlock-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .disc-unlock-sub { color: #888; font-size: 13px; margin: 0 0 16px; }
//         .disc-unlock-btn {
//           display: inline-block; padding: 11px 24px; border-radius: 11px;
//           background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           cursor: pointer; border: none; transition: all 0.2s;
//         }
//         .disc-unlock-btn:hover { background: #4338ca; }
//       `}</style>

//       <div className="disc-page">
//         <div className="disc-header">
//           <h1 className="disc-title">Discover Campaigns</h1>
//           <p className="disc-sub">Find brand campaigns that match your vibe</p>
//         </div>

//         {/* FILTERS */}
//         <div className="disc-filters">
//           <select
//             className={`disc-select ${selectedCity ? "active" : ""}`}
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//           >
//             <option value="">🏙 All Cities</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>
//                 {city.charAt(0).toUpperCase() + city.slice(1)}
//               </option>
//             ))}
//           </select>

//           <select
//             className={`disc-select ${selectedCategory ? "active" : ""}`}
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//           >
//             <option value="">🎯 All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>
//                 {cat.charAt(0).toUpperCase() + cat.slice(1)}
//               </option>
//             ))}
//           </select>

//           {(selectedCity || selectedCategory) && (
//             <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
//               ✕ Clear
//             </button>
//           )}
//         </div>

//         {/* STATS */}
//         {!loading && allCampaigns.length > 0 && (
//           <div className="disc-stats">
//             <span className="disc-stat-count">{filteredCampaigns.length}</span>
//             <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
//           </div>
//         )}

//         {/* CONTENT */}
//         {loading ? (
//           <div className="disc-loading"><div className="disc-spinner" /></div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div className="disc-empty">
//             <div className="disc-empty-icon">🔍</div>
//             <h3 className="disc-empty-title">
//               {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
//             </h3>
//             <p className="disc-empty-sub">
//               {selectedCity || selectedCategory
//                 ? "Try different filters or clear to see all campaigns"
//                 : "Check back soon — brands are posting campaigns!"}
//             </p>
//           </div>
//         ) : (
//           <>
//             <div className="disc-grid">
//               {filteredCampaigns.map((c, index) => {
//                 const isBlurred = index >= VISIBLE_COUNT;
//                 const isApplied = appliedIds.includes(c._id);
//                 return (
//                   <div
//                     key={c._id}
//                     className={`disc-card ${isBlurred ? "blurred" : ""}`}
//                     onClick={() => !isBlurred && router.push(`/campaigns/campaignsdetail?id=${c._id}`)}
//                   >
//                     <div className="disc-card-top">
//                       <h2 className="disc-card-title">{c.title}</h2>
//                       {isApplied
//                         ? <span className="disc-badge applied">Applied ✓</span>
//                         : <span className="disc-badge">Open</span>
//                       }
//                     </div>

//                     {c.description && <p className="disc-desc">{c.description}</p>}

//                     <div className="disc-meta">
//                       {c.budget && (
//                         <span className="disc-meta-item">💰 ₹{c.budget.toLocaleString()}</span>
//                       )}
//                       {c.city && (
//                         <span className="disc-meta-item">
//                           📍 {c.city.charAt(0).toUpperCase() + c.city.slice(1)}
//                         </span>
//                       )}
//                     </div>

//                     {c.categories?.length > 0 && (
//                       <div className="disc-cats">
//                         {c.categories.map((cat: string, i: number) => (
//                           <span key={i} className="disc-cat">{cat}</span>
//                         ))}
//                       </div>
//                     )}

//                     {!isBlurred && (
//                       isApplied ? (
//                         <button className="disc-apply-btn applied-btn" disabled>✓ Applied</button>
//                       ) : (
//                         <button
//                           className="disc-apply-btn"
//                           onClick={(e) => { e.stopPropagation(); router.push(`/campaigns/campaignsdetail?id=${c._id}`); }}
//                         >
//                           View & Apply →
//                         </button>
//                       )
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="disc-unlock-banner">
//                 <p className="disc-unlock-title">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
//                 <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
//                   Complete Profile →
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </>
//   );
// }



// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);
//     const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     setAppliedIds(savedApplied);
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns();
//     fetchMeta();
//   }, [token]);

//   useEffect(() => {
//     const handleFocus = () => {
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds(savedApplied);
//     };
//     window.addEventListener("focus", handleFocus);
//     return () => window.removeEventListener("focus", handleFocus);
//   }, []);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/campaigns/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (!res.ok) { console.error(data.message); return; }
//       const campaigns = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.campaigns) ? data.campaigns
//         : Array.isArray(data) ? data : [];
//       setAllCampaigns(campaigns);
//       const applied = campaigns.filter((c: any) => c.hasApplied || c.applied).map((c: any) => c._id);
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds([...new Set([...applied, ...savedApplied])]);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       console.log("CITIES RAW:", cityData);
//       console.log("CATS RAW:", catData);

//       // ✅ Handle every possible response shape
//       const extractList = (d: any): string[] => {
//         const raw = d?.data ?? d?.cities ?? d?.categories ?? d;
//         const arr = Array.isArray(raw) ? raw : [];
//         return arr.map((item: any) =>
//           typeof item === "string" ? item : item?.name || item?.city || item?.category || ""
//         ).filter(Boolean);
//       };

//       // ✅ Deduplicate
//       const cityList = [...new Set(extractList(cityData).map(c => c.toLowerCase()))];
//       const catList  = [...new Set(extractList(catData).map(c => c.toLowerCase()))];

//       console.log("CITIES PARSED:", cityList);
//       console.log("CATS PARSED:", catList);

//       setCities(cityList);
//       setCategories(catList);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity ? c.city?.toLowerCase() === selectedCity.toLowerCase() : true;
//       const catMatch = selectedCategory
//         ? Array.isArray(c.categories)
//           ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
//           : c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   const applyCampaign = async (campaignId: string) => {
//     if (!influencerId) { alert("Influencer ID missing ❌"); return; }
//     if (appliedIds.includes(campaignId)) { alert("Already Applied ✅"); return; }
//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Apply failed"); return; }
//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => {
//         const updated = [...prev, campaignId];
//         localStorage.setItem("appliedCampaigns", JSON.stringify(updated));
//         return updated;
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   const VISIBLE_COUNT = 3;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .disc-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .disc-header { padding: 40px 40px 0; }
//         @media(max-width:600px){ .disc-header{ padding: 24px 16px 0; } }

//         .disc-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
//         .disc-sub { color: #999; font-size: 14px; margin: 0; }

//         .disc-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; }
//         @media(max-width:600px){ .disc-filters{ padding: 16px 16px; } }

//         .disc-select {
//           padding: 10px 36px 10px 14px;
//           border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff;
//           font-size: 13px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           font-weight: 500;
//           color: #555;
//           outline: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           appearance: none;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//           background-repeat: no-repeat;
//           background-position: right 12px center;
//           background-color: #fff;
//         }
//         .disc-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
//         .disc-select.active {
//           border-color: #4f46e5; background-color: #4f46e5; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .disc-clear {
//           padding: 10px 16px; border-radius: 100px;
//           border: 1.5px solid #e8e8e8; background: #fafafa;
//           font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;
//           color: #999; cursor: pointer; transition: all 0.2s;
//         }
//         .disc-clear:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

//         .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 16px; }
//         @media(max-width:600px){ .disc-stats{ padding: 0 16px 12px; } }
//         .disc-stat-text { font-size: 13px; color: #999; }
//         .disc-stat-count { font-size: 13px; font-weight: 700; color: #4f46e5; }

//         .disc-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
//           gap: 18px;
//           padding: 0 40px 32px;
//         }
//         @media(max-width:600px){ .disc-grid{ grid-template-columns: 1fr; padding: 0 16px 24px; gap: 14px; } }

//         .disc-card {
//           background: #fff;
//           border-radius: 18px;
//           border: 1.5px solid #ebebeb;
//           padding: 22px;
//           transition: all 0.2s;
//           cursor: pointer;
//         }
//         .disc-card:hover { border-color: #c7d2fe; box-shadow: 0 8px 30px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }

//         .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
//         .disc-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
//         .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; flex-shrink: 0; }
//         .disc-badge.applied { background: #eff6ff; color: #4f46e5; border-color: #c7d2fe; }

//         .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .disc-meta { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
//         .disc-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; font-weight: 500; }

//         .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
//         .disc-cat { padding: 3px 10px; border-radius: 100px; background: #f0eeff; font-size: 11px; color: #4f46e5; font-weight: 600; }

//         .disc-apply-btn {
//           width: 100%; padding: 11px;
//           border-radius: 11px; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           border: none; cursor: pointer; transition: all 0.2s;
//           background: #4f46e5; color: #fff;
//         }
//         .disc-apply-btn:hover { background: #4338ca; transform: translateY(-1px); }
//         .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; cursor: default; transform: none; }

//         .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
//         .disc-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .disc-empty-title { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .disc-empty-sub { color: #aaa; font-size: 14px; margin: 0; }

//         .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
//         .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }

//         .disc-unlock-banner {
//           margin: 0 40px 40px;
//           background: linear-gradient(135deg, #faf5ff, #eff6ff);
//           border: 1.5px solid #c7d2fe;
//           border-radius: 18px; padding: 28px; text-align: center;
//         }
//         @media(max-width:600px){ .disc-unlock-banner{ margin: 0 16px 24px; } }
//         .disc-unlock-title { font-size: 17px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .disc-unlock-sub { color: #888; font-size: 13px; margin: 0 0 16px; }
//         .disc-unlock-btn {
//           display: inline-block; padding: 11px 24px; border-radius: 11px;
//           background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           cursor: pointer; border: none; transition: all 0.2s;
//         }
//         .disc-unlock-btn:hover { background: #4338ca; }
//       `}</style>

//       <div className="disc-page">
//         <div className="disc-header">
//           <h1 className="disc-title">Discover Campaigns</h1>
//           <p className="disc-sub">Find brand campaigns that match your vibe</p>
//         </div>

//         {/* FILTERS */}
//         <div className="disc-filters">
//           <select
//             className={`disc-select ${selectedCity ? "active" : ""}`}
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//           >
//             <option value="">🏙 All Cities</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>
//                 {city.charAt(0).toUpperCase() + city.slice(1)}
//               </option>
//             ))}
//           </select>

//           <select
//             className={`disc-select ${selectedCategory ? "active" : ""}`}
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//           >
//             <option value="">🎯 All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>
//                 {cat.charAt(0).toUpperCase() + cat.slice(1)}
//               </option>
//             ))}
//           </select>

//           {(selectedCity || selectedCategory) && (
//             <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
//               ✕ Clear
//             </button>
//           )}
//         </div>

//         {/* STATS */}
//         {!loading && allCampaigns.length > 0 && (
//           <div className="disc-stats">
//             <span className="disc-stat-count">{filteredCampaigns.length}</span>
//             <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
//           </div>
//         )}

//         {/* CONTENT */}
//         {loading ? (
//           <div className="disc-loading"><div className="disc-spinner" /></div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div className="disc-empty">
//             <div className="disc-empty-icon">🔍</div>
//             <h3 className="disc-empty-title">
//               {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
//             </h3>
//             <p className="disc-empty-sub">
//               {selectedCity || selectedCategory
//                 ? "Try different filters or clear to see all campaigns"
//                 : "Check back soon — brands are posting campaigns!"}
//             </p>
//           </div>
//         ) : (
//           <>
//             <div className="disc-grid">
//               {filteredCampaigns.map((c, index) => {
//                 const isBlurred = index >= VISIBLE_COUNT;
//                 const isApplied = appliedIds.includes(c._id);
//                 return (
//                   <div
//                     key={c._id}
//                     className={`disc-card ${isBlurred ? "blurred" : ""}`}
//                     onClick={() => !isBlurred && router.push(`/campaigns/campaignsdetail?id=${c._id}`)}
//                   >
//                     <div className="disc-card-top">
//                       <h2 className="disc-card-title">{c.title}</h2>
//                       {isApplied
//                         ? <span className="disc-badge applied">Applied ✓</span>
//                         : <span className="disc-badge">Open</span>
//                       }
//                     </div>

//                     {c.description && <p className="disc-desc">{c.description}</p>}

//                     <div className="disc-meta">
//                       {c.budget && (
//                         <span className="disc-meta-item">💰 ₹{c.budget.toLocaleString()}</span>
//                       )}
//                       {c.city && (
//                         <span className="disc-meta-item">
//                           📍 {c.city.charAt(0).toUpperCase() + c.city.slice(1)}
//                         </span>
//                       )}
//                     </div>

//                     {c.categories?.length > 0 && (
//                       <div className="disc-cats">
//                         {c.categories.map((cat: string, i: number) => (
//                           <span key={i} className="disc-cat">{cat}</span>
//                         ))}
//                       </div>
//                     )}

//                     {!isBlurred && (
//                       isApplied ? (
//                         <button className="disc-apply-btn applied-btn" disabled>✓ Applied</button>
//                       ) : (
//                         <button
//                           className="disc-apply-btn"
//                           onClick={(e) => { e.stopPropagation(); router.push(`/campaigns/campaignsdetail?id=${c._id}`); }}
//                         >
//                           View & Apply →
//                         </button>
//                       )
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="disc-unlock-banner">
//                 <p className="disc-unlock-title">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
//                 <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
//                   Complete Profile →
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </>
//   );
// }




// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }

//     const parsed = JSON.parse(user);

//     if (parsed.role?.toLowerCase() === "brand") {
//       router.push("/campaigns");
//       return;
//     }

//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }

//     setToken(t);

//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);

//     // ✅ localStorage se already applied campaigns load karo
//     const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     setAppliedIds(savedApplied);
//   }, []);

//   /* ================= FETCH DATA ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns();
//     fetchMeta();
//   }, [token]);

//   // ✅ Jab user detail page se wapas aaye — applied state refresh karo
//   useEffect(() => {
//     const handleFocus = () => {
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       setAppliedIds(savedApplied);
//     };
//     window.addEventListener("focus", handleFocus);
//     return () => window.removeEventListener("focus", handleFocus);
//   }, []);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);
//       // ✅ /campaigns/all — influencer ke liye sare open campaigns
//       const res = await fetch(`${API}/campaigns/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("ALL CAMPAIGNS 👉", data);

//       if (!res.ok) {
//         console.error(data.message);
//         return;
//       }

//       // ✅ applied flag bhi aata hai — track karo
//       // ✅ Backend {success: true, data: [...]} bhejta hai
//       const campaigns = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.campaigns) ? data.campaigns
//         : Array.isArray(data) ? data : [];

//       console.log("CAMPAIGNS COUNT:", campaigns.length);
//       setAllCampaigns(campaigns);

//       // Already applied campaigns track karo
//       const applied = campaigns
//         .filter((c: any) => c.hasApplied || c.applied)
//         .map((c: any) => c._id);

//       // Merge with localStorage applied list
//       const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       const allApplied = [...new Set([...applied, ...savedApplied])];
//       setAppliedIds(allApplied);

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const cityData = await cityRes.json();
//       const catData = await catRes.json();
//       setCities(cityData.data || []);
//       setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   /* ================= CLIENT-SIDE FILTER ================= */
//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity
//         ? c.city?.toLowerCase() === selectedCity.toLowerCase()
//         : true;
//       const catMatch = selectedCategory
//         ? Array.isArray(c.categories)
//           ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
//           : c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   /* ================= APPLY ================= */
//   const applyCampaign = async (campaignId: string) => {
//     if (!influencerId) { alert("Influencer ID missing ❌"); return; }
//     if (appliedIds.includes(campaignId)) { alert("Already Applied ✅"); return; }

//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ influencerId }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Apply failed");
//         return;
//       }

//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => {
//         const updated = [...prev, campaignId];
//         localStorage.setItem("appliedCampaigns", JSON.stringify(updated));
//         return updated;
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   const VISIBLE_COUNT = 3;

//   /* ================= UI ================= */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

//         .disc-page { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .disc-header { padding: 40px 40px 0; }
//         .disc-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 32px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
//         .disc-sub { color: #999; font-size: 14px; margin: 0; }

//         .disc-filters { display: flex; gap: 10px; padding: 24px 40px; flex-wrap: wrap; }
//         .disc-select {
//           padding: 10px 16px;
//           border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff;
//           font-size: 13px;
//           font-family: 'DM Sans', sans-serif;
//           color: #555;
//           outline: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           appearance: none;
//           padding-right: 32px;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//           background-repeat: no-repeat;
//           background-position: right 12px center;
//         }
//         .disc-select:focus { border-color: #111; }
//         .disc-select.active { border-color: #111; background-color: #111; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .disc-clear { padding: 10px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #999; cursor: pointer; transition: all 0.2s; }
//         .disc-clear:hover { border-color: #111; color: #111; }

//         .disc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding: 0 40px 40px; }

//         .disc-card {
//           background: #fff;
//           border-radius: 20px;
//           border: 1.5px solid #ebebeb;
//           padding: 24px;
//           transition: all 0.2s;
//           position: relative;
//           overflow: hidden;
//         }
//         .disc-card:hover { border-color: #d0d0d0; box-shadow: 0 8px 30px rgba(0,0,0,0.06); transform: translateY(-2px); }
//         .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }

//         .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
//         .disc-card-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 17px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
//         .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; }
//         .disc-badge.applied { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }

//         .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .disc-meta { display: flex; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
//         .disc-meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #999; }
//         .disc-meta-icon { font-size: 13px; }

//         .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
//         .disc-cat { padding: 4px 10px; border-radius: 100px; background: #f5f5f0; font-size: 11px; color: #666; font-weight: 500; }

//         .disc-apply-btn {
//           width: 100%;
//           padding: 12px;
//           border-radius: 12px;
//           font-size: 13px;
//           font-weight: 700;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           border: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           background: #4f46e5;
//           color: #fff;
//         }
//         .disc-apply-btn:hover { background: #4338ca; }
//         .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; cursor: default; }

//         .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
//         .disc-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .disc-empty-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .disc-empty-sub { color: #aaa; font-size: 14px; margin: 0; }

//         .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
//         .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #111; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }

//         .disc-unlock-banner {
//           position: relative;
//           margin: 0 40px 40px;
//           background: #fff;
//           border: 1.5px solid #ebebeb;
//           border-radius: 20px;
//           padding: 28px;
//           text-align: center;
//         }
//         .disc-unlock-title { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 18px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .disc-unlock-sub { color: #aaa; font-size: 13px; margin: 0 0 16px; }
//         .disc-unlock-btn { display: inline-block; padding: 12px 28px; border-radius: 12px; background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; border: none; transition: all 0.2s; }
//         .disc-unlock-btn:hover { background: #333; }

//         .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 20px; }
//         .disc-stat-text { font-size: 13px; color: #999; }
//         .disc-stat-count { font-size: 13px; font-weight: 600; color: #111; }
//       `}</style>

//       <div className="disc-page">
//         <div className="disc-header">
//           <h1 className="disc-title">Discover Campaigns</h1>
//           <p className="disc-sub">Find brand campaigns that match your vibe</p>
//         </div>

//         {/* FILTERS */}
//         <div className="disc-filters">
//           <select
//             className={`disc-select ${selectedCity ? "active" : ""}`}
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//           >
//             <option value="">🏙 All Cities</option>
//             {[...new Set(cities.map(c => c.toLowerCase()))].map((city, i) => (
//               <option key={i} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
//             ))}
//           </select>

//           <select
//             className={`disc-select ${selectedCategory ? "active" : ""}`}
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//           >
//             <option value="">🎯 All Categories</option>
//             {[...new Set(categories.map(c => c.toLowerCase()))].map((cat, i) => (
//               <option key={i} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
//             ))}
//           </select>

//           {(selectedCity || selectedCategory) && (
//             <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
//               ✕ Clear
//             </button>
//           )}
//         </div>

//         {/* STATS */}
//         {!loading && allCampaigns.length > 0 && (
//           <div className="disc-stats">
//             <span className="disc-stat-count">{filteredCampaigns.length}</span>
//             <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
//           </div>
//         )}

//         {/* CONTENT */}
//         {loading ? (
//           <div className="disc-loading">
//             <div className="disc-spinner" />
//           </div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div className="disc-empty">
//             <div className="disc-empty-icon">🔍</div>
//             <h3 className="disc-empty-title">
//               {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
//             </h3>
//             <p className="disc-empty-sub">
//               {selectedCity || selectedCategory
//                 ? "Try different filters or clear to see all campaigns"
//                 : "Check back soon — brands are posting campaigns!"}
//             </p>
//           </div>
//         ) : (
//           <>
//             <div className="disc-grid">
//               {filteredCampaigns.map((c, index) => {
//                 const isBlurred = index >= VISIBLE_COUNT;
//                 const isApplied = appliedIds.includes(c._id);

//                 return (
//                   <div key={c._id} className={`disc-card ${isBlurred ? "blurred" : ""}`}>
//                     <div className="disc-card-top">
//                       <h2 className="disc-card-title">{c.title}</h2>
//                       {isApplied
//                         ? <span className="disc-badge applied">Applied ✓</span>
//                         : <span className="disc-badge">Open</span>
//                       }
//                     </div>

//                     {c.description && (
//                       <p className="disc-desc">{c.description}</p>
//                     )}

//                     <div className="disc-meta">
//                       {c.budget && (
//                         <span className="disc-meta-item">
//                           <span className="disc-meta-icon">💰</span>
//                           ₹{c.budget.toLocaleString()}
//                         </span>
//                       )}
//                       {c.city && (
//                         <span className="disc-meta-item">
//                           <span className="disc-meta-icon">📍</span>
//                           {c.city.charAt(0).toUpperCase() + c.city.slice(1)}
//                         </span>
//                       )}
//                     </div>

//                     {c.categories?.length > 0 && (
//                       <div className="disc-cats">
//                         {c.categories.map((cat: string, i: number) => (
//                           <span key={i} className="disc-cat">{cat}</span>
//                         ))}
//                       </div>
//                     )}

//                     {!isBlurred && (
//                       isApplied ? (
//                         <button className="disc-apply-btn applied-btn" disabled>✓ Applied</button>
//                       ) : (
//                         <button
//                           className="disc-apply-btn"
//                           onClick={() => router.push(`/campaigns/campaignsdetail?id=${c._id}`)}
//                         >
//                           Apply Now →
//                         </button>
//                       )
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {/* BLUR BANNER */}
//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="disc-unlock-banner">
//                 <p className="disc-unlock-title">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
//                 <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
//                   Complete Profile →
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </>
//   );
// }
// final code right code"use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }

//     const parsed = JSON.parse(user);

//     if (parsed.role?.toLowerCase() === "brand") {
//       router.push("/campaigns");
//       return;
//     }

//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }

//     setToken(t);

//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);
//   }, []);

//   /* ================= FETCH DATA ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns();
//     fetchMeta();
//   }, [token]);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);
//       // ✅ /campaigns/all — influencer ke liye sare open campaigns
//       const res = await fetch(`${API}/campaigns/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("ALL CAMPAIGNS 👉", data);

//       if (!res.ok) {
//         console.error(data.message);
//         return;
//       }

//       // ✅ applied flag bhi aata hai — track karo
//       const campaigns = data.data || data.campaigns || [];
//       setAllCampaigns(campaigns);

//       // Already applied campaigns track karo
//       const applied = campaigns
//         .filter((c: any) => c.hasApplied || c.applied)
//         .map((c: any) => c._id);
//       setAppliedIds(applied);

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const cityData = await cityRes.json();
//       const catData = await catRes.json();
//       setCities(cityData.data || []);
//       setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   /* ================= CLIENT-SIDE FILTER ================= */
//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity
//         ? c.city?.toLowerCase() === selectedCity.toLowerCase()
//         : true;
//       const catMatch = selectedCategory
//         ? Array.isArray(c.categories)
//           ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
//           : c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   /* ================= APPLY ================= */
//   const applyCampaign = async (campaignId: string) => {
//     if (!influencerId) { alert("Influencer ID missing ❌"); return; }
//     if (appliedIds.includes(campaignId)) { alert("Already Applied ✅"); return; }

//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ influencerId }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Apply failed");
//         return;
//       }

//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => [...prev, campaignId]);
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   const VISIBLE_COUNT = 3;

//   /* ================= UI ================= */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');

//         .disc-page { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
//         .disc-header { padding: 40px 40px 0; }
//         .disc-title { font-family: 'Syne', sans-serif; font-size: 32px; font-weight: 800; color: #111; margin: 0 0 4px; }
//         .disc-sub { color: #999; font-size: 14px; margin: 0; }

//         .disc-filters { display: flex; gap: 10px; padding: 24px 40px; flex-wrap: wrap; }
//         .disc-select {
//           padding: 10px 16px;
//           border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff;
//           font-size: 13px;
//           font-family: 'DM Sans', sans-serif;
//           color: #555;
//           outline: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           appearance: none;
//           padding-right: 32px;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//           background-repeat: no-repeat;
//           background-position: right 12px center;
//         }
//         .disc-select:focus { border-color: #111; }
//         .disc-select.active { border-color: #111; background-color: #111; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .disc-clear { padding: 10px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; font-family: 'DM Sans', sans-serif; color: #999; cursor: pointer; transition: all 0.2s; }
//         .disc-clear:hover { border-color: #111; color: #111; }

//         .disc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; padding: 0 40px 40px; }

//         .disc-card {
//           background: #fff;
//           border-radius: 20px;
//           border: 1.5px solid #ebebeb;
//           padding: 24px;
//           transition: all 0.2s;
//           position: relative;
//           overflow: hidden;
//         }
//         .disc-card:hover { border-color: #d0d0d0; box-shadow: 0 8px 30px rgba(0,0,0,0.06); transform: translateY(-2px); }
//         .disc-card.blurred { filter: blur(4px); pointer-events: none; user-select: none; opacity: 0.5; }

//         .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
//         .disc-card-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
//         .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; }
//         .disc-badge.applied { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }

//         .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .disc-meta { display: flex; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
//         .disc-meta-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #999; }
//         .disc-meta-icon { font-size: 13px; }

//         .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
//         .disc-cat { padding: 4px 10px; border-radius: 100px; background: #f5f5f0; font-size: 11px; color: #666; font-weight: 500; }

//         .disc-apply-btn {
//           width: 100%;
//           padding: 12px;
//           border-radius: 12px;
//           font-size: 13px;
//           font-weight: 700;
//           font-family: 'Syne', sans-serif;
//           border: none;
//           cursor: pointer;
//           transition: all 0.2s;
//           background: #111;
//           color: #fff;
//         }
//         .disc-apply-btn:hover { background: #333; }
//         .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; cursor: default; }

//         .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
//         .disc-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .disc-empty-title { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
//         .disc-empty-sub { color: #aaa; font-size: 14px; margin: 0; }

//         .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
//         .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #111; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }

//         .disc-unlock-banner {
//           position: relative;
//           margin: 0 40px 40px;
//           background: #fff;
//           border: 1.5px solid #ebebeb;
//           border-radius: 20px;
//           padding: 28px;
//           text-align: center;
//         }
//         .disc-unlock-title { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; color: #111; margin: 0 0 6px; }
//         .disc-unlock-sub { color: #aaa; font-size: 13px; margin: 0 0 16px; }
//         .disc-unlock-btn { display: inline-block; padding: 12px 28px; border-radius: 12px; background: #111; color: #fff; font-size: 13px; font-weight: 700; font-family: 'Syne', sans-serif; cursor: pointer; border: none; transition: all 0.2s; }
//         .disc-unlock-btn:hover { background: #333; }

//         .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 20px; }
//         .disc-stat-text { font-size: 13px; color: #999; }
//         .disc-stat-count { font-size: 13px; font-weight: 600; color: #111; }
//       `}</style>

//       <div className="disc-page">
//         <div className="disc-header">
//           <h1 className="disc-title">Discover Campaigns</h1>
//           <p className="disc-sub">Find brand campaigns that match your vibe</p>
//         </div>

//         {/* FILTERS */}
//         <div className="disc-filters">
//           <select
//             className={`disc-select ${selectedCity ? "active" : ""}`}
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//           >
//             <option value="">🏙 All Cities</option>
//             {[...new Set(cities.map(c => c.toLowerCase()))].map((city, i) => (
//               <option key={i} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
//             ))}
//           </select>

//           <select
//             className={`disc-select ${selectedCategory ? "active" : ""}`}
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//           >
//             <option value="">🎯 All Categories</option>
//             {[...new Set(categories.map(c => c.toLowerCase()))].map((cat, i) => (
//               <option key={i} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
//             ))}
//           </select>

//           {(selectedCity || selectedCategory) && (
//             <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
//               ✕ Clear
//             </button>
//           )}
//         </div>

//         {/* STATS */}
//         {!loading && allCampaigns.length > 0 && (
//           <div className="disc-stats">
//             <span className="disc-stat-count">{filteredCampaigns.length}</span>
//             <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
//           </div>
//         )}

//         {/* CONTENT */}
//         {loading ? (
//           <div className="disc-loading">
//             <div className="disc-spinner" />
//           </div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div className="disc-empty">
//             <div className="disc-empty-icon">🔍</div>
//             <h3 className="disc-empty-title">
//               {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
//             </h3>
//             <p className="disc-empty-sub">
//               {selectedCity || selectedCategory
//                 ? "Try different filters or clear to see all campaigns"
//                 : "Check back soon — brands are posting campaigns!"}
//             </p>
//           </div>
//         ) : (
//           <>
//             <div className="disc-grid">
//               {filteredCampaigns.map((c, index) => {
//                 const isBlurred = index >= VISIBLE_COUNT;
//                 const isApplied = appliedIds.includes(c._id);

//                 return (
//                   <div key={c._id} className={`disc-card ${isBlurred ? "blurred" : ""}`}>
//                     <div className="disc-card-top">
//                       <h2 className="disc-card-title">{c.title}</h2>
//                       {isApplied
//                         ? <span className="disc-badge applied">Applied ✓</span>
//                         : <span className="disc-badge">Open</span>
//                       }
//                     </div>

//                     {c.description && (
//                       <p className="disc-desc">{c.description}</p>
//                     )}

//                     <div className="disc-meta">
//                       {c.budget && (
//                         <span className="disc-meta-item">
//                           <span className="disc-meta-icon">💰</span>
//                           ₹{c.budget.toLocaleString()}
//                         </span>
//                       )}
//                       {c.city && (
//                         <span className="disc-meta-item">
//                           <span className="disc-meta-icon">📍</span>
//                           {c.city.charAt(0).toUpperCase() + c.city.slice(1)}
//                         </span>
//                       )}
//                     </div>

//                     {c.categories?.length > 0 && (
//                       <div className="disc-cats">
//                         {c.categories.map((cat: string, i: number) => (
//                           <span key={i} className="disc-cat">{cat}</span>
//                         ))}
//                       </div>
//                     )}

//                     {!isBlurred && (
//                       <button
//                         className={`disc-apply-btn ${isApplied ? "applied-btn" : ""}`}
//                         onClick={() => !isApplied && applyCampaign(c._id)}
//                         disabled={isApplied}
//                       >
//                         {isApplied ? "✓ Applied" : "Apply Now →"}
//                       </button>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>

//             {/* BLUR BANNER */}
//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="disc-unlock-banner">
//                 <p className="disc-unlock-title">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="disc-unlock-sub">Complete your profile to unlock all campaigns</p>
//                 <button className="disc-unlock-btn" onClick={() => router.push("/my-profile")}>
//                   Complete Profile →
//                 </button>
//               </div>
//             )}
//           </>
//         )}
//       </div>
//     </>
//   );
// }
// "use client";

// import { useEffect, useState, useMemo } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");

//   /* ================= ROLE CHECK + AUTH (single useEffect) ================= */
//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);
//     console.log("DISCOVERY LOGIN DATA 👉", parsed);

//     // Brand ko discovery allow nahi
//     if (parsed.role?.toLowerCase() === "brand") {
//       router.push("/campaigns");
//       return;
//     }

//     if (!parsed.token) {
//       router.push("/login");
//       return;
//     }

//     setToken(parsed.token);

//     const id =
//       parsed.user?._id ||
//       parsed.user?.id ||
//       parsed._id ||
//       parsed.id ||
//       parsed.influencerId;

//     if (!id) {
//       alert("Influencer ID not found ❌");
//       return;
//     }

//     setInfluencerId(id);
//   }, []);

//   /* ================= FETCH ALL CAMPAIGNS (no filter params) ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchAllCampaigns();
//     fetchMeta();
//   }, [token]);

//   const fetchAllCampaigns = async () => {
//     try {
//       setLoading(true);

//       // ✅ No city/category in query — fetch ALL campaigns
//       const res = await fetch(`${API}/campaigns/matching`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();
//       console.log("ALL CAMPAIGNS 👉", data);

//       if (!res.ok) {
//         alert(data.message || "Campaign load failed");
//         return;
//       }

//       setAllCampaigns(data.data || []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= CLIENT-SIDE FILTER ================= */
//   // ✅ Campaigns filter locally — no extra API call needed
//   const filteredCampaigns = useMemo(() => {
//     return allCampaigns.filter((c) => {
//       const cityMatch = selectedCity
//         ? c.city?.toLowerCase() === selectedCity.toLowerCase()
//         : true;
//       const catMatch = selectedCategory
//         ? c.categories?.some(
//             (cat: string) =>
//               cat.toLowerCase() === selectedCategory.toLowerCase()
//           ) || c.category?.toLowerCase() === selectedCategory.toLowerCase()
//         : true;
//       return cityMatch && catMatch;
//     });
//   }, [allCampaigns, selectedCity, selectedCategory]);

//   /* ================= FETCH CITY & CATEGORY META ================= */
//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, {
//           headers: { Authorization: `Bearer ${token}` },
//         }),
//         fetch(`${API}/meta/categories`, {
//           headers: { Authorization: `Bearer ${token}` },
//         }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       console.log("CITY 👉", cityData);
//       console.log("CATEGORY 👉", catData);

//       setCities(cityData.data || []);
//       setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   /* ================= APPLY ================= */
//   const applyCampaign = async (campaignId: string) => {
//     try {
//       if (!influencerId) {
//         alert("Influencer ID missing ❌");
//         return;
//       }

//       if (appliedIds.includes(campaignId)) {
//         alert("Already Applied ✅");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ influencerId }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Apply failed");
//         console.log("APPLY ERROR 👉", data);
//         return;
//       }

//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => [...prev, campaignId]);
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   /* ================= UI ================= */
//   // Blur threshold — first 3 full, rest blurred
//   const VISIBLE_COUNT = 3;

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">Discover Campaigns</h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Cities</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>
//                 {city}
//               </option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>
//                 {cat}
//               </option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div>Loading...</div>
//         ) : filteredCampaigns.length === 0 ? (
//           <div>No Campaigns Found</div>
//         ) : (
//           <div className="space-y-6 relative">
//             {filteredCampaigns.map((c, index) => {
//               const isBlurred = index >= VISIBLE_COUNT;

//               return (
//                 <div
//                   key={c._id}
//                   className={`bg-white p-6 rounded-2xl shadow transition-all duration-300 ${
//                     isBlurred
//                       ? "blur-sm opacity-60 pointer-events-none select-none"
//                       : ""
//                   }`}
//                 >
//                   <h2 className="text-xl font-bold">{c.title}</h2>
//                   <p className="text-gray-600 mt-2">{c.description}</p>

//                   <div className="text-sm mt-3 text-gray-500 flex gap-6">
//                     <span>₹ {c.budget}</span>
//                     <span>{c.city}</span>
//                   </div>

//                   {!isBlurred && (
//                     <button
//                       onClick={() => applyCampaign(c._id)}
//                       disabled={appliedIds.includes(c._id)}
//                       className={`mt-4 px-5 py-2 rounded-xl text-white transition-colors ${
//                         appliedIds.includes(c._id)
//                           ? "bg-green-500 cursor-not-allowed"
//                           : "bg-indigo-600 hover:bg-indigo-700"
//                       }`}
//                     >
//                       {appliedIds.includes(c._id) ? "Applied ✅" : "Apply Now"}
//                     </button>
//                   )}
//                 </div>
//               );
//             })}

//             {/* ✅ Upgrade banner overlay on blurred section */}
//             {filteredCampaigns.length > VISIBLE_COUNT && (
//               <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-center py-10 bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent pointer-events-none">
//                 <p className="text-gray-700 font-semibold text-lg">
//                   🔒 {filteredCampaigns.length - VISIBLE_COUNT} more campaigns available
//                 </p>
//                 <p className="text-gray-500 text-sm mt-1">
//                   Complete your profile to unlock all campaigns
//                 </p>
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");


// /* ================= ROLE CHECK ================= */
// useEffect(() => {
//   const user = localStorage.getItem("cb_user");

//   if (!user) {
//     router.push("/login");
//     return;
//   }

//   const parsed = JSON.parse(user);

//   console.log("DISCOVERY LOGIN DATA 👉", parsed);

//   // ✅ BRAND ko DISCOVERY allow nahi
//   if (parsed.role?.toLowerCase() === "brand") {
//     router.push("/campaigns");
//     return;
//   }

//   // ✅ TOKEN
//   if (!parsed.token) {
//     router.push("/login");
//     return;
//   }

//   setToken(parsed.token);

//   // ✅ Influencer ID
//   const id =
//     parsed.user?._id ||
//     parsed.user?.id ||
//     parsed._id ||
//     parsed.id ||
//     parsed.influencerId;

//   setInfluencerId(id);
// }, []);



//   /* ================= LOGIN DATA ================= */
//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);

//     console.log("LOGIN DATA 👉", parsed);

//     // ✅ TOKEN
//     if (!parsed.token) {
//       alert("Token missing");
//       router.push("/login");
//       return;
//     }

//     setToken(parsed.token);

//     // ✅ INFLUENCER ID FIND
//     const id =
//       parsed.user?._id ||
//       parsed.user?.id ||
//       parsed._id ||
//       parsed.id ||
//       parsed.influencerId;

//     if (!id) {
//       alert("Influencer ID not found ❌");
//       return;
//     }

//     setInfluencerId(id);
//   }, []);

//   /* ================= FETCH CAMPAIGNS ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchCampaigns();
//     fetchMeta();
//   }, [token, selectedCity, selectedCategory]);

//   const fetchCampaigns = async () => {
//     try {
//       setLoading(true);

//       const query = new URLSearchParams();
//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory) query.append("categories", selectedCategory);

//       const res = await fetch(
//         `${API}/campaigns/matching?${query.toString()}`,
//         { headers: { Authorization: `Bearer ${token}` } }
//       );

//       const data = await res.json();

//       console.log("CAMPAIGNS 👉", data);

//       if (!res.ok) {
//         alert(data.message || "Campaign load failed");
//         return;
//       }

//       setCampaigns(data.data || []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= FETCH CITY & CATEGORY ================= */
//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, {
//           headers: { Authorization: `Bearer ${token}` },
//         }),
//         fetch(`${API}/meta/categories`, {
//           headers: { Authorization: `Bearer ${token}` },
//         }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       console.log("CITY 👉", cityData);
//       console.log("CATEGORY 👉", catData);

//       setCities(cityData.data || []);
//       setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error", err);
//     }
//   };

//   /* ================= APPLY ================= */
//   const applyCampaign = async (campaignId: string) => {
//     try {
//       if (!influencerId) {
//         alert("Influencer ID missing ❌");
//         return;
//       }

//       if (appliedIds.includes(campaignId)) {
//         alert("Already Applied ✅");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           influencerId: influencerId,   // ✅ IMPORTANT
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Apply failed");
//         console.log("APPLY ERROR 👉", data);
//         return;
//       }

//       alert("Applied Successfully 🎉");
//       setAppliedIds((prev) => [...prev, campaignId]);
//     } catch (err) {
//       console.error(err);
//       alert("Network error");
//     }
//   };

//   /* ================= UI ================= */
//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">Discover Campaigns</h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Cities</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div>Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div>No Campaigns Found</div>
//         ) : (
//           <div className="space-y-6">
//             {campaigns.map((c) => (
//               <div key={c._id} className="bg-white p-6 rounded-2xl shadow">
//                 <h2 className="text-xl font-bold">{c.title}</h2>
//                 <p className="text-gray-600 mt-2">{c.description}</p>

//                 <div className="text-sm mt-3 text-gray-500 flex gap-6">
//                   <span>₹ {c.budget}</span>
//                   <span>{c.city}</span>
//                 </div>

//                 <button
//                   onClick={() => applyCampaign(c._id)}
//                   className="mt-4 bg-indigo-600 text-white px-5 py-2 rounded-xl"
//                 >
//                   Apply Now
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);
//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");
//   const [token, setToken] = useState<string>("");

//   /* ================= AUTH CHECK ================= */
//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) return router.push("/login");

//     const parsed = JSON.parse(user);
//     if (!parsed.token) return router.push("/login");
//     if (parsed.role?.toLowerCase() !== "influencer") return router.push("/campaigns");

//     setToken(parsed.token);
//   }, []);

//   /* ================= FETCH META AFTER TOKEN ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchMeta();
//   }, [token]);

//   /* ================= FETCH MATCHING CAMPAIGNS ================= */
//   useEffect(() => {
//     if (!token) return;
//     fetchMatching();
//   }, [token, selectedCity, selectedCategory]);

//   const fetchMatching = async () => {
//     try {
//       setLoading(true);
//       const query = new URLSearchParams();
//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory) query.append("categories", selectedCategory);

//       const res = await fetch(`${API}/campaigns/matching?${query.toString()}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 403) {
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();
//       if (res.ok) setCampaigns(data.data || []);
//       else {
//         console.log("Matching error:", data);
//         setCampaigns([]);
//       }
//     } catch (err) {
//       console.error("Matching error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= FETCH META (Cities & Categories) ================= */
//   const fetchMeta = async () => {
//     try {
//       const [cityRes, catRes] = await Promise.all([
//         fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);

//       const cityData = await cityRes.json();
//       const catData = await catRes.json();

//       if (cityRes.ok) setCities(cityData.data || []);
//       else console.log("Cities error:", cityData);

//       if (catRes.ok) setCategories(catData.data || []);
//       else console.log("Categories error:", catData);
//     } catch (err) {
//       console.error("Meta fetch error:", err);
//     }
//   };

//   /* ================= APPLY CAMPAIGN ================= */
//   const applyCampaign = async (id: string) => {
//     try {
//       if (appliedIds.includes(id)) {
//         alert("You have already applied ✅");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({}),
//       });

//       const data = await res.json();

//       if (res.status === 403) {
//         alert("Session expired. Login again.");
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       if (!res.ok) {
//         // show exact backend error
//         console.log("Apply error:", data);
//         alert(data.message || "Failed to apply to campaign");
//         return;
//       }

//       // success
//       alert(data.message || "Application sent ✅");
//       setAppliedIds((prev) => [...prev, id]);
//     } catch (err) {
//       console.error("Apply error:", err);
//       alert("Network/server error. Try again.");
//     }
//   };

//   /* ================= UI ================= */
//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">Discover Campaigns</h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Locations</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div className="text-center font-semibold">Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div className="text-center text-gray-500">No campaigns found</div>
//         ) : (
//           <div className="space-y-8">
//             {campaigns.map((camp: any) => (
//               <div key={camp._id} className="bg-white p-6 rounded-2xl shadow border">
//                 <h3 className="text-xl font-bold mb-2">{camp.title}</h3>
//                 <div
//                   className="text-gray-600 mb-4 whitespace-pre-line"
//                   dangerouslySetInnerHTML={{ __html: camp.description }}
//                 />
//                 <div className="text-sm text-gray-500 mb-4 flex flex-wrap gap-6">
//                   <span>💰 Budget: ₹{camp.budget}</span>
//                   <span>📍 {camp.city}</span>
//                   <span>🏷 {Array.isArray(camp.categories) ? camp.categories.join(", ") : camp.categories || "Not specified"}</span>
//                 </div>
//                 <button
//                   onClick={() => applyCampaign(camp._id)}
//                   disabled={appliedIds.includes(camp._id)}
//                   className={`px-6 py-2 rounded-xl text-white ${
//                     appliedIds.includes(camp._id)
//                       ? "bg-gray-400 cursor-not-allowed"
//                       : "bg-indigo-600 hover:bg-indigo-700"
//                   }`}
//                 >
//                   {appliedIds.includes(camp._id) ? "Applied" : "Apply Now"}
//                 </button>
//               </div>
//             ))}
            
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);

//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");

//   const [token, setToken] = useState<string>("");

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);

//     if (!parsed.token) {
//       router.push("/login");
//       return;
//     }

//     if (parsed.role?.toLowerCase() !== "influencer") {
//       router.push("/campaigns");
//       return;
//     }

//     setToken(parsed.token);
//   }, []);

//   /* ================= FETCH META AFTER TOKEN ================= */

//   useEffect(() => {
//     if (!token) return;
//     fetchMeta();
//   }, [token]);

//   /* ================= MATCHING ================= */

//   useEffect(() => {
//     if (!token) return;
//     fetchMatching();
//   }, [token, selectedCity, selectedCategory]);

//   const fetchMatching = async () => {
//     try {
//       setLoading(true);

//       const query = new URLSearchParams();
//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory)
//         query.append("categories", selectedCategory);

//       const res = await fetch(
//         `${API}/campaigns/matching?${query.toString()}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (res.status === 403) {
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (res.ok) {
//         setCampaigns(data.data || []);
//       } else {
//         console.log("Matching error:", data);
//         setCampaigns([]);
//       }
//     } catch (err) {
//       console.error("Matching error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= META ================= */

//   const fetchMeta = async () => {
//     try {
//       const cityRes = await fetch(`${API}/meta/cities`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
//       const cityData = await cityRes.json();
//       if (cityRes.ok) setCities(cityData.data || []);
//       else console.log("Cities error:", cityData);

//       const catRes = await fetch(`${API}/meta/categories`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
//       const catData = await catRes.json();
//       if (catRes.ok) setCategories(catData.data || []);
//       else console.log("Categories error:", catData);
//     } catch (err) {
//       console.error("Meta error:", err);
//     }
//   };

//   /* ================= APPLY ================= */

//   const applyCampaign = async (id: string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/${id}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({}), // important
//       });

//       const data = await res.json();

//       if (res.status === 403) {
//         alert("Session expired. Login again.");
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       if (!res.ok) {
//         console.log("Apply error:", data);
//         alert(data.message || "Already applied or campaign closed");
//         return;
//       }

//       alert("Application sent ✅");
//       setAppliedIds((prev) => [...prev, id]);
//     } catch (err) {
//       console.error("Apply error:", err);
//       alert("Something went wrong");
//     }
//   };

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">
//           Discover Campaigns
//         </h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Locations</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div className="text-center font-semibold">Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div className="text-center text-gray-500">
//             No campaigns found
//           </div>
//         ) : (
//           <div className="space-y-8">
//             {campaigns.map((camp: any) => (
//               <div
//                 key={camp._id}
//                 className="bg-white p-6 rounded-2xl shadow border"
//               >
//                 <h3 className="text-xl font-bold mb-2">
//                   {camp.title}
//                 </h3>

//                 <div
//                   className="text-gray-600 mb-4 whitespace-pre-line"
//                   dangerouslySetInnerHTML={{
//                     __html: camp.description,
//                   }}
//                 />

//                 <div className="text-sm text-gray-500 mb-4 flex flex-wrap gap-6">
//                   <span>💰 Budget: ₹{camp.budget}</span>
//                   <span>📍 {camp.city}</span>
//                   <span>
//                     🏷{" "}
//                     {Array.isArray(camp.categories)
//                       ? camp.categories.join(", ")
//                       : camp.categories || "Not specified"}
//                   </span>
//                 </div>

//                 <button
//                   onClick={() => applyCampaign(camp._id)}
//                   disabled={appliedIds.includes(camp._id)}
//                   className={`px-6 py-2 rounded-xl text-white ${
//                     appliedIds.includes(camp._id)
//                       ? "bg-gray-400 cursor-not-allowed"
//                       : "bg-indigo-600 hover:bg-indigo-700"
//                   }`}
//                 >
//                   {appliedIds.includes(camp._id)
//                     ? "Applied"
//                     : "Apply Now"}
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);

//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");

//   const [token, setToken] = useState<string>("");

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);

//     if (!parsed.token) {
//       router.push("/login");
//       return;
//     }

//     if (parsed.role?.toLowerCase() !== "influencer") {
//       router.push("/campaigns");
//       return;
//     }

//     setToken(parsed.token);
//     fetchMeta();
//   }, []);

//   /* ================= MATCHING ================= */

//   useEffect(() => {
//     if (!token) return;
//     fetchMatching();
//   }, [token, selectedCity, selectedCategory]);

//   const fetchMatching = async () => {
//     try {
//       setLoading(true);

//       const query = new URLSearchParams();
//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory)
//         query.append("categories", selectedCategory);

//       const res = await fetch(
//         `${API}/campaigns/matching?${query.toString()}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );

//       if (res.status === 403) {
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (res.ok) {
//         setCampaigns(data.data || []);
//       } else {
//         setCampaigns([]);
//       }
//     } catch (err) {
//       console.error("Matching error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= META ================= */

//   const fetchMeta = async () => {
//     try {
//       const cityRes = await fetch(`${API}/meta/cities`);
//       const cityData = await cityRes.json();
//       if (cityRes.ok) setCities(cityData.data || []);

//       const catRes = await fetch(`${API}/meta/categories`);
//       const catData = await catRes.json();
//       if (catRes.ok) setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error:", err);
//     }
//   };

//   /* ================= APPLY ================= */

//   const applyCampaign = async (id: string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/${id}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//       });

//       const data = await res.json();

//       if (res.status === 403) {
//         alert("Session expired. Login again.");
//         localStorage.removeItem("cb_user");
//         router.push("/login");
//         return;
//       }

//       if (!res.ok) {
//         alert(data.message || "Already applied or campaign closed");
//         return;
//       }

//       alert("Application sent ✅");
//       setAppliedIds((prev) => [...prev, id]);
//     } catch (err) {
//       console.error("Apply error:", err);
//       alert("Something went wrong");
//     }
//   };

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">
//         <h1 className="text-3xl font-bold mb-8">
//           Discover Campaigns
//         </h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Locations</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div className="text-center font-semibold">Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div className="text-center text-gray-500">
//             No campaigns found
//           </div>
//         ) : (
//           <div className="space-y-8">
//             {campaigns.map((camp: any) => (
//               <div
//                 key={camp._id}
//                 className="bg-white p-6 rounded-2xl shadow border"
//               >
//                 <h3 className="text-xl font-bold mb-2">
//                   {camp.title}
//                 </h3>

//                 {/* Freelancer style description */}
//                 <div
//                   className="text-gray-600 mb-4 whitespace-pre-line"
//                   dangerouslySetInnerHTML={{
//                     __html: camp.description,
//                   }}
//                 />

//                 <div className="text-sm text-gray-500 mb-4 flex flex-wrap gap-6">
//                   <span>💰 Budget: ₹{camp.budget}</span>
//                   <span>📍 {camp.city}</span>
//                   <span>
//                     🏷{" "}
//                     {Array.isArray(camp.categories)
//                       ? camp.categories.join(", ")
//                       : camp.categories || "Not specified"}
//                   </span>
//                 </div>

//                 <button
//                   onClick={() => applyCampaign(camp._id)}
//                   disabled={appliedIds.includes(camp._id)}
//                   className={`px-6 py-2 rounded-xl text-white ${
//                     appliedIds.includes(camp._id)
//                       ? "bg-gray-400 cursor-not-allowed"
//                       : "bg-indigo-600 hover:bg-indigo-700"
//                   }`}
//                 >
//                   {appliedIds.includes(camp._id)
//                     ? "Applied"
//                     : "Apply Now"}
//                 </button>
//               </div>
//             ))}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }




// // "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [appliedIds, setAppliedIds] = useState<string[]>([]);

//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");

//     if (!user) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);

//     if (parsed.role?.toLowerCase() !== "influencer") {
//       router.push("/campaigns");
//       return;
//     }

//     fetchMeta();
//     fetchMatching(parsed.token);
//   }, []);

//   /* ================= META ================= */

//   const fetchMeta = async () => {
//     try {
//       const cityRes = await fetch(`${API}/meta/cities`);
//       const cityData = await cityRes.json();
//       if (cityRes.ok) setCities(cityData.data || []);

//       const catRes = await fetch(`${API}/meta/categories`);
//       const catData = await catRes.json();
//       if (catRes.ok) setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error:", err);
//     }
//   };

//   /* ================= MATCHING ================= */

//   const fetchMatching = async (token: string) => {
//     try {
//       setLoading(true);

//       const query = new URLSearchParams();

//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory)
//         query.append("categories", selectedCategory);

//       const res = await fetch(
//         `${API}/campaigns/matching?${query.toString()}`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );

//       const data = await res.json();

//       if (res.ok) {
//         setCampaigns(data.data || []);
//       } else {
//         setCampaigns([]);
//       }

//     } catch (err) {
//       console.error("Matching error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= FILTER CHANGE ================= */

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) return;

//     const parsed = JSON.parse(user);
//     fetchMatching(parsed.token);
//   }, [selectedCity, selectedCategory]);

//   /* ================= APPLY ================= */

//   const applyCampaign = async (id: string) => {
//     try {
//       const user = localStorage.getItem("cb_user");
//       if (!user) {
//         router.push("/login");
//         return;
//       }

//       const parsed = JSON.parse(user);

//       const res = await fetch(`${API}/campaigns/${id}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${parsed.token}`,
//         },
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Already applied");
//         return;
//       }

//       alert("Application sent ✅");

//       // disable button after apply
//       setAppliedIds((prev) => [...prev, id]);

//     } catch (err) {
//       console.error("Apply error:", err);
//     }
//   };

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-6xl mx-auto">

//         <h1 className="text-3xl font-bold mb-8">
//           Discover Campaigns
//         </h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Locations</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div className="text-center font-semibold">Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div className="text-center text-gray-500">No campaigns found</div>
//         ) : (
//           <div className="space-y-8">

//             {campaigns.map((camp: any) => (
//               <div
//                 key={camp._id}
//                 className="bg-white p-6 rounded-2xl shadow border"
//               >
//                 <h3 className="text-xl font-bold mb-2">{camp.title}</h3>

//                 <p className="text-gray-600 mb-3">
//                   {camp.description}
//                 </p>

//                 <div className="text-sm text-gray-500 mb-4 flex flex-wrap gap-6">
//                   <span>💰 Budget: ₹{camp.budget}</span>
//                   <span>📍 {camp.city}</span>
//                   <span>
//                     🏷{" "}
//                     {Array.isArray(camp.categories)
//                       ? camp.categories.join(", ")
//                       : camp.categories || "Not specified"}
//                   </span>
//                 </div>

//                 <button
//                   onClick={() => applyCampaign(camp._id)}
//                   disabled={appliedIds.includes(camp._id)}
//                   className={`px-6 py-2 rounded-xl text-white ${
//                     appliedIds.includes(camp._id)
//                       ? "bg-gray-400 cursor-not-allowed"
//                       : "bg-indigo-600 hover:bg-indigo-700"
//                   }`}
//                 >
//                   {appliedIds.includes(camp._id)
//                     ? "Applied"
//                     : "Apply Now"}
//                 </button>

//               </div>
//             ))}

//           </div>
//         )}

//       </div>
//     </div>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);
//   const [loading, setLoading] = useState(true);

//   const [selectedCity, setSelectedCity] = useState("");
//   const [selectedCategory, setSelectedCategory] = useState("");

//   /* ================= AUTH CHECK ================= */

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     const token = localStorage.getItem("token");

//     if (!user || !token) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(user);

//     if (parsed.role?.toLowerCase() !== "influencer") {
//       router.push("/campaigns");
//       return;
//     }

//     fetchMeta();
//     fetchMatching(token);
//   }, []);

//   /* ================= META ================= */

//   const fetchMeta = async () => {
//     try {
//       const cityRes = await fetch(`${API}/meta/cities`);
//       const cityData = await cityRes.json();
//       if (cityRes.ok) setCities(cityData.data || []);

//       const catRes = await fetch(`${API}/meta/categories`);
//       const catData = await catRes.json();
//       if (catRes.ok) setCategories(catData.data || []);
//     } catch (err) {
//       console.error("Meta error:", err);
//     }
//   };

//   /* ================= MATCHING ================= */

//   const fetchMatching = async (token: string) => {
//     try {
//       setLoading(true);

//       const query = new URLSearchParams();

//       // ✅ FIXED city param
//       if (selectedCity) query.append("city", selectedCity);
//       if (selectedCategory) query.append("categories", selectedCategory);

//       const res = await fetch(
//         `${API}/campaigns/matching?${query.toString()}`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );

//       const data = await res.json();

//       console.log("Matching response:", data);

//       if (res.ok) {
//         // ✅ FIXED response structure
//         setCampaigns(data.data || []);
//       } else {
//         setCampaigns([]);
//       }

//     } catch (err) {
//       console.error("Matching error:", err);
//       setCampaigns([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= FILTER CHANGE ================= */

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     if (token) fetchMatching(token);
//   }, [selectedCity, selectedCategory]);

//   /* ================= APPLY ================= */

//   const applyCampaign = async (id: string) => {
//     try {
//       const token = localStorage.getItem("token");
//       if (!token) return;

//       const res = await fetch(`${API}/campaigns/${id}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Already applied");
//         return;
//       }

//       alert("Application sent ✅");

//     } catch (err) {
//       console.error("Apply error:", err);
//     }
//   };

//   /* ================= UI ================= */

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-7xl mx-auto">

//         <h1 className="text-3xl font-bold mb-8">
//           Discover Campaigns
//         </h1>

//         {/* FILTERS */}
//         <div className="flex gap-4 mb-10">
//           <select
//             value={selectedCity}
//             onChange={(e) => setSelectedCity(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Locations</option>
//             {cities.map((city, i) => (
//               <option key={i} value={city}>{city}</option>
//             ))}
//           </select>

//           <select
//             value={selectedCategory}
//             onChange={(e) => setSelectedCategory(e.target.value)}
//             className="px-4 py-2 border rounded-xl"
//           >
//             <option value="">All Categories</option>
//             {categories.map((cat, i) => (
//               <option key={i} value={cat}>{cat}</option>
//             ))}
//           </select>
//         </div>

//         {loading ? (
//           <div className="text-center font-semibold">Loading...</div>
//         ) : campaigns.length === 0 ? (
//           <div className="text-center text-gray-500">No campaigns found</div>
//         ) : (
//           <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

//             {campaigns.map((camp: any) => (
//               <div
//                 key={camp._id}
//                 className="bg-white p-6 rounded-3xl shadow border"
//               >
//                 <h3 className="text-xl font-bold mb-2">{camp.title}</h3>
//                 <p className="text-sm text-gray-500 mb-4">
//                   {camp.description}
//                 </p>

//                 <div className="text-sm mb-4">
//                   <div>Budget: ₹{camp.budget}</div>
//                   {/* ✅ FIXED city field */}
//                   <div>Location: {camp.city}</div>
//                   <div>Category: {camp.categories?.join(",") || "Not specified"}</div>
//                 </div>

//                 <button
//                   onClick={() => applyCampaign(camp._id)}
//                   className="w-full py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
//                 >
//                   Apply Now
//                 </button>

//               </div>
//             ))}

//           </div>
//         )}

//       </div>
//     </div>
//   );
// }
// // "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [results, setResults] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);

//   const [searchTerm, setSearchTerm] = useState("");
//   const [selectedLocation, setSelectedLocation] = useState("All Cities");
//   const [selectedCategory, setSelectedCategory] = useState("All Categories");

//   /* ================= LOGIN CHECK ================= */

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     setUser(parsedUser);
//     setLoading(false);
//   }, [router]);

//   const isBrand = user?.role?.toLowerCase() === "brand";

//   /* ================= FETCH META DATA ================= */

//   useEffect(() => {
//     const fetchMeta = async () => {
//       try {
//         // Fetch Cities
//         const cityRes = await fetch(`${API_BASE}/meta/cities`);
//         const cityData = await cityRes.json();

//         if (cityRes.ok && cityData.success) {
//           setCities(cityData.data || []);
//         }

//         // Fetch Categories
//         const catRes = await fetch(`${API_BASE}/meta/categories`);
//         const catData = await catRes.json();

//         if (catRes.ok && catData.success) {
//           setCategories(catData.data || []);
//         }

//       } catch (err) {
//         console.error("Meta API Error:", err);
//       }
//     };

//     fetchMeta();
//   }, []);

//   /* ================= FETCH SEARCH DATA ================= */

//   const fetchData = async () => {
//     try {
//       setLoading(true);

//       const token = localStorage.getItem("token");

//       const queryParams = new URLSearchParams();

//       if (searchTerm) queryParams.append("search", searchTerm);

//       if (selectedLocation !== "All Cities")
//         queryParams.append("location", selectedLocation);

//       if (selectedCategory !== "All Categories")
//         queryParams.append("categories", selectedCategory);

//       // ✅ ROLE FIX
//       queryParams.append("role", isBrand ? "influencer" : "brand");

//       const url = `${API_BASE}/discover/search?${queryParams.toString()}`;

//       console.log("Calling:", url);

//       const res = await fetch(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const data = await res.json();

//       console.log("Search Response:", data);

//       if (res.ok && data.success) {
//         setResults(data.results || []);
//       } else {
//         setResults([]);
//       }

//     } catch (err) {
//       console.error("Search API Error:", err);
//       setResults([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (user) {
//       fetchData();
//     }
//   }, [searchTerm, selectedLocation, selectedCategory, user]);

//   if (loading && !user) return null;

//   return (
//     <div className="max-w-7xl mx-auto px-6 py-12">

//       {/* HEADER */}
//       <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
//         <h1 className="text-3xl font-bold text-slate-900">
//           {isBrand ? "Find Talent" : "Discover Brands"}
//         </h1>

//         <input
//           type="text"
//           placeholder={isBrand ? "Search influencers..." : "Search brands..."}
//           className="w-full max-w-xl px-6 py-4 bg-white border rounded-2xl shadow-sm"
//           value={searchTerm}
//           onChange={(e) => setSearchTerm(e.target.value)}
//         />
//       </div>

//       <div className="flex flex-col lg:flex-row gap-10">

//         {/* FILTER PANEL */}
//         <div className="w-full lg:w-72 bg-white p-6 rounded-3xl shadow-sm border h-fit">
//           <h3 className="font-bold text-lg mb-6">Filter</h3>

//           {isBrand && (
//             <div className="mb-6">
//               <label className="block text-xs font-bold text-slate-500 mb-2">
//                 CITY
//               </label>
//               <select
//                 value={selectedLocation}
//                 onChange={(e) => setSelectedLocation(e.target.value)}
//                 className="w-full px-4 py-3 bg-slate-50 border rounded-xl"
//               >
//                 <option>All Cities</option>
//                 {cities.map((city, index) => (
//                   <option key={index} value={city}>
//                     {city}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}

//           <div>
//             <label className="block text-xs font-bold text-slate-500 mb-2">
//               CATEGORY
//             </label>
//             <select
//               value={selectedCategory}
//               onChange={(e) => setSelectedCategory(e.target.value)}
//               className="w-full px-4 py-3 bg-slate-50 border rounded-xl"
//             >
//               <option>All Categories</option>
//               {categories.map((cat, index) => (
//                 <option key={index} value={cat}>
//                   {cat}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>

//         {/* RESULTS */}
//         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
//           {loading ? (
//             <div className="col-span-3 text-center">Loading...</div>
//           ) : results.length === 0 ? (
//             <div className="col-span-3 text-center">No results found</div>
//           ) : (
//             results.map((item: any) => (
//               <div
//                 key={item._id}
//                 className="bg-white border rounded-3xl shadow-sm overflow-hidden"
//               >
//                 {item.profileImage && (
//                   <img
//                     src={item.profileImage}
//                     className="w-full h-64 object-cover"
//                     alt={item.name}
//                   />
//                 )}
//                 <div className="p-6">
//                   <h3 className="font-bold">{item.name || item.companyName}</h3>
//                   <p className="text-sm text-slate-500">
//                     {item.role} • {item.location}
//                   </p>
//                   {item.categories && (
//                     <div className="text-xs mt-2 text-indigo-600 font-semibold">
//                       {item.categories}
//                     </div>
//                   )}
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useState, useEffect } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function DiscoveryPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [results, setResults] = useState<any[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   const [categories, setCategories] = useState<string[]>([]);

//   const [searchTerm, setSearchTerm] = useState("");
//   const [selectedLocation, setSelectedLocation] = useState("All Cities");
//   const [selectedCategory, setSelectedCategory] = useState("All Categories");

//   /* ================= LOGIN CHECK ================= */

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);
//     setUser(parsedUser);
//     setLoading(false);
//   }, [router]);

//   const isBrand = user?.role?.toLowerCase() === "brand";

//   /* ================= FETCH META DATA ================= */

//   useEffect(() => {
//     const fetchMeta = async () => {
//       try {
//         // Cities
//         const cityRes = await fetch(`${API_BASE}/meta/cities`);
//         const cityData = await cityRes.json();

//         if (cityRes.ok && cityData.success) {
//           setCities(cityData.cities || []);
//         }

//         // Categories
//         const catRes = await fetch(`${API_BASE}/meta/categories`);
//         const catData = await catRes.json();

//         if (catRes.ok && catData.success) {
//           setCategories(catData.categories || []);
//         }
//       } catch (err) {
//         console.error("Meta API Error:", err);
//       }
//     };

//     fetchMeta();
//   }, []);

//   /* ================= FETCH SEARCH DATA ================= */

//   const fetchData = async () => {
//     try {
//       setLoading(true);

//       const token = localStorage.getItem("token");

//       const queryParams = new URLSearchParams();

//       if (searchTerm) queryParams.append("search", searchTerm);

//       // 🔥 IMPORTANT FIX
//       if (selectedLocation !== "All Cities")
//         queryParams.append("location", selectedLocation);

//       if (selectedCategory !== "All Categories")
//         queryParams.append("categories", selectedCategory);

//       queryParams.append("role", isBrand ? "creator" : "campaign");

//       const url = `${API_BASE}/discover/search?${queryParams.toString()}`;

//       console.log("Calling:", url);

//       const res = await fetch(url, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const data = await res.json();

//       console.log("Search Response:", data);

//       if (res.ok && data.success) {
//         setResults(data.results || []);
//       } else {
//         setResults([]);
//       }
//     } catch (err) {
//       console.error("Search API Error:", err);
//       setResults([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (user) {
//       fetchData();
//     }
//   }, [searchTerm, selectedLocation, selectedCategory, user]);

//   if (loading && !user) return null;

//   return (
//     <div className="max-w-7xl mx-auto px-6 py-12">

//       {/* HEADER */}
//       <div className="flex flex-col lg:flex-row justify-between gap-8 mb-12">
//         <h1 className="text-3xl font-bold text-slate-900">
//           {isBrand ? "Find Talent" : "Discover Campaigns"}
//         </h1>

//         <input
//           type="text"
//           placeholder={isBrand ? "Search creators..." : "Search campaigns..."}
//           className="w-full max-w-xl px-6 py-4 bg-white border rounded-2xl shadow-sm"
//           value={searchTerm}
//           onChange={(e) => setSearchTerm(e.target.value)}
//         />
//       </div>

//       <div className="flex flex-col lg:flex-row gap-10">

//         {/* FILTER PANEL */}
//         <div className="w-full lg:w-72 bg-white p-6 rounded-3xl shadow-sm border h-fit">
//           <h3 className="font-bold text-lg mb-6">Filter</h3>

//           {isBrand && (
//             <div className="mb-6">
//               <label className="block text-xs font-bold text-slate-500 mb-2">
//                 CITY
//               </label>
//               <select
//                 value={selectedLocation}
//                 onChange={(e) => setSelectedLocation(e.target.value)}
//                 className="w-full px-4 py-3 bg-slate-50 border rounded-xl"
//               >
//                 <option>All Cities</option>
//                 {cities.map((city, index) => (
//                   <option key={index} value={city}>
//                     {city}
//                   </option>
//                 ))}
//               </select>
//             </div>
//           )}

//           <div>
//             <label className="block text-xs font-bold text-slate-500 mb-2">
//               CATEGORY
//             </label>
//             <select
//               value={selectedCategory}
//               onChange={(e) => setSelectedCategory(e.target.value)}
//               className="w-full px-4 py-3 bg-slate-50 border rounded-xl"
//             >
//               <option>All Categories</option>
//               {categories.map((cat, index) => (
//                 <option key={index} value={cat}>
//                   {cat}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>

//         {/* RESULTS */}
//         <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
//           {loading ? (
//             <div className="col-span-3 text-center">Loading...</div>
//           ) : results.length === 0 ? (
//             <div className="col-span-3 text-center">No results found</div>
//           ) : (
//             results.map((item: any) =>
//               isBrand ? (
//                 <div
//                   key={item._id}
//                   className="bg-white border rounded-3xl shadow-sm overflow-hidden"
//                 >
//                   <img
//                     src={item.profileImage}
//                     className="w-full h-64 object-cover"
//                     alt={item.name}
//                   />
//                   <div className="p-6">
//                     <h3 className="font-bold">{item.name}</h3>
//                     <p className="text-sm text-slate-500">
//                       {item.role} • {item.location}
//                     </p>
//                   </div>
//                 </div>
//               ) : (
//                 <div
//                   key={item._id}
//                   className="bg-white border rounded-3xl p-6 shadow-sm"
//                 >
//                   <div className="text-xs font-bold mb-2 text-indigo-600">
//                     {item.categories}
//                   </div>
//                   <h3 className="font-bold mb-2">{item.title}</h3>
//                   <p className="text-sm text-slate-500 mb-4">
//                     {item.description}
//                   </p>
//                 </div>
//               )
//             )
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }
