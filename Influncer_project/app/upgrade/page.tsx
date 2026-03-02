"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Script from "next/script";

const API = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";
const PLAN_ID = "plan_SKmSEwh4wl4Tv6";

export default function UpgradePage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ✅ Bits & usage stats
  const [bits, setBits] = useState<number>(100);
  const [applicationsUsed, setApplicationsUsed] = useState<number>(0);
  const [campaignsCreated, setCampaignsCreated] = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const role = user?.role?.toLowerCase();
  const isBrand = role === "brand";
  const isInfluencer = role === "influencer";

  useEffect(() => {
    const stored = localStorage.getItem("cb_user");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    setUser(parsed);

    const token = parsed.token || localStorage.getItem("token");
    if (!token) return;

    // ✅ Fetch latest user stats from backend
    fetch(`${API}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.profile) {
          const p = data.profile;
          setBits(p.bits ?? 100);
          setApplicationsUsed(p.applicationsUsed ?? 0);
          setCampaignsCreated(p.campaignsCreated ?? 0);
          setIsSubscribed(p.isSubscribed ?? false);
          if (p.isSubscribed) setActivePlan(parsed.activePlan || "pro_monthly");

          // update localStorage
          const updated = { ...parsed, isSubscribed: p.isSubscribed, bits: p.bits };
          localStorage.setItem("cb_user", JSON.stringify(updated));
          setUser(updated);
        }
      })
      .catch(() => {});
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const openRazorpay = (subscriptionId: string, planId: string, planName: string) => {
    const options = {
      key: RAZORPAY_KEY,
      subscription_id: subscriptionId,
      name: "CreatorBridge",
      description: `${planName} Plan`,
      theme: { color: "#4f46e5" },
      prefill: {
        name: user?.name || "",
        email: user?.email || "",
        contact: user?.phone || "",
      },
      handler: async function () {
        await activateSubscription(planId, planName);
      },
      modal: {
        ondismiss: () => {
          showToast("Payment cancelled.", "error");
          setLoadingPlan(null);
        },
      },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", (response: any) => {
      showToast(`Payment failed: ${response.error.description}`, "error");
      setLoadingPlan(null);
    });
    rzp.open();
  };

  const activateSubscription = async (planId: string, planName: string) => {
    const stored = localStorage.getItem("cb_user");
    const parsed = JSON.parse(stored || "{}");
    const token = parsed.token || localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/subscription/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const updatedUser = { ...parsed, isSubscribed: true, activePlan: planId, activePlanName: planName };
        localStorage.setItem("cb_user", JSON.stringify(updatedUser));
        setUser(updatedUser);
        setActivePlan(planId);
        setIsSubscribed(true);
        showToast(`🎉 ${planName} plan activated!`, "success");
      } else {
        showToast(data.message || "Activation failed.", "error");
      }
    } catch {
      showToast("Activation failed. Try again.", "error");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleSubscribe = async (planId: string, planName: string) => {
    if (!user) { showToast("Please login first!", "error"); return; }
    const token = user.token || localStorage.getItem("token");
    if (!token) { showToast("Session expired.", "error"); return; }
    setLoadingPlan(planId);
    try {
      const res = await fetch(`${API}/subscription/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      showToast("Something went wrong. Try again.", "error");
      setLoadingPlan(null);
    }
  };

  const plans = {
    monthly: [
      {
        id: "free", name: "Free", price: "₹0", period: "/ month",
        tagline: "Get started with CreatorBridge",
        cta: "Your current plan", ctaDisabled: true,
        badge: null, badgeColor: "", cardBg: "#f9f9f9", cardBorder: "#e5e5e5",
        features: ["Apply to up to 3 campaigns/month", "Basic profile page", "Message brands (limited)", "Discovery feed access"],
      },
      {
        id: "pro_monthly", name: "Pro", price: "₹999", period: "/ month (incl. GST)",
        tagline: "For serious creators & growing brands",
        cta: "Upgrade to Pro", ctaDisabled: false,
        badge: null, badgeColor: "", cardBg: "#fff", cardBorder: "#e5e5e5",
        features: ["Unlimited campaign applications", "Priority listing in discovery", "Unlimited messaging", "Analytics dashboard", "Verified creator badge", "Early access to campaigns"],
      },
      {
        id: "business_monthly", name: "Business", price: "₹2,999", period: "/ month (incl. GST)",
        tagline: "For brands running multiple campaigns",
        cta: "Upgrade to Business", ctaDisabled: false,
        badge: "RECOMMENDED", badgeColor: "#4f46e5", cardBg: "#fafafe", cardBorder: "#4f46e5",
        features: ["Everything in Pro", "Post unlimited campaigns", "Advanced creator search & filters", "Team access (up to 5 seats)", "Dedicated account manager", "Campaign analytics & reports", "Custom contract templates"],
      },
    ],
    yearly: [
      {
        id: "free", name: "Free", price: "₹0", period: "/ month",
        tagline: "Get started with CreatorBridge",
        cta: "Your current plan", ctaDisabled: true,
        badge: null, badgeColor: "", cardBg: "#f9f9f9", cardBorder: "#e5e5e5",
        features: ["Apply to up to 3 campaigns/month", "Basic profile page", "Message brands (limited)", "Discovery feed access"],
      },
      {
        id: "pro_yearly", name: "Pro", price: "₹799", period: "/ month, billed yearly",
        tagline: "For serious creators & growing brands",
        cta: "Upgrade to Pro", ctaDisabled: false,
        badge: "SAVE 20%", badgeColor: "#16a34a", cardBg: "#fff", cardBorder: "#e5e5e5",
        features: ["Unlimited campaign applications", "Priority listing in discovery", "Unlimited messaging", "Analytics dashboard", "Verified creator badge", "Early access to campaigns"],
      },
      {
        id: "business_yearly", name: "Business", price: "₹2,399", period: "/ month, billed yearly",
        tagline: "For brands running multiple campaigns",
        cta: "Upgrade to Business", ctaDisabled: false,
        badge: "RECOMMENDED", badgeColor: "#4f46e5", cardBg: "#fafafe", cardBorder: "#4f46e5",
        features: ["Everything in Pro", "Post unlimited campaigns", "Advanced creator search & filters", "Team access (up to 5 seats)", "Dedicated account manager", "Campaign analytics & reports", "Custom contract templates"],
      },
    ],
  };

  const currentPlans = plans[billing];

  // ✅ Bits progress %
  const bitsMax = 100;
  const bitsPercent = Math.max(0, Math.min(100, (bits / bitsMax) * 100));
  const bitsLow = bits <= 20;
  const bitsEmpty = bits <= 0;

  // ✅ Campaign limit for brand
  const campaignMax = 5;
  const campaignPercent = Math.min(100, (campaignsCreated / campaignMax) * 100);
  const campaignLimitReached = campaignsCreated >= campaignMax && !isSubscribed;

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}

        .up-page{min-height:calc(100vh - 64px);background:#f7f7f5;font-family:'DM Sans',sans-serif;padding:40px 24px 80px}
        .up-header{text-align:center;max-width:540px;margin:0 auto 32px}
        .up-title{font-size:clamp(24px,4vw,36px);font-weight:500;color:#111;line-height:1.15;margin-bottom:10px}
        .up-subtitle{font-size:15px;color:#777;line-height:1.6;font-weight:400}

        /* ✅ USAGE STATS BOX */
        .up-usage{max-width:960px;margin:0 auto 36px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
        @media(max-width:560px){.up-usage{grid-template-columns:1fr}}

        .up-usage-card{background:#fff;border-radius:16px;padding:20px 22px;border:1.5px solid #ebebeb}
        .up-usage-card.warning{border-color:#fbbf24;background:#fffbeb}
        .up-usage-card.danger{border-color:#ef4444;background:#fff5f5}

        .up-usage-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .up-usage-label{font-size:13px;font-weight:500;color:#555;display:flex;align-items:center;gap:6px}
        .up-usage-val{font-size:22px;font-weight:600;color:#111}
        .up-usage-sub{font-size:11px;color:#aaa;margin-top:2px;font-weight:400}

        .up-progress-bar{height:6px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-top:10px}
        .up-progress-fill{height:100%;border-radius:100px;transition:width 0.5s ease}

        .up-usage-alert{margin-top:12px;font-size:12px;font-weight:500;padding:8px 12px;border-radius:8px;display:flex;align-items:center;gap:6px}
        .up-usage-alert.warn{background:#fef3c7;color:#92400e}
        .up-usage-alert.err{background:#fee2e2;color:#991b1b}

        /* TOGGLE */
        .up-toggle{display:flex;align-items:center;justify-content:center;background:#e8e8e8;border-radius:100px;padding:4px;width:fit-content;margin:0 auto 44px}
        .up-toggle-btn{padding:9px 24px;border-radius:100px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;color:#888;background:transparent}
        .up-toggle-btn.active{background:#fff;color:#111;box-shadow:0 1px 6px rgba(0,0,0,0.1)}

        /* GRID */
        .up-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:960px;margin:0 auto}
        @media(max-width:860px){.up-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:560px){.up-grid{grid-template-columns:1fr;max-width:420px}}

        .up-card{border-radius:20px;padding:28px 24px 30px;display:flex;flex-direction:column;transition:transform 0.2s,box-shadow 0.2s;position:relative}
        .up-card:hover{transform:translateY(-3px);box-shadow:0 14px 44px rgba(0,0,0,0.09)}
        .up-card.featured{box-shadow:0 4px 28px rgba(79,70,229,0.14)}
        .up-card.active-card{box-shadow:0 4px 28px rgba(22,163,74,0.15) !important}

        .up-badge{display:inline-flex;align-items:center;font-size:10px;font-weight:600;letter-spacing:0.07em;padding:4px 10px;border-radius:100px;color:#fff;margin-bottom:12px;width:fit-content}
        .up-active-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#16a34a;background:#f0fdf4;border:1px solid #86efac;padding:4px 10px;border-radius:100px;margin-bottom:12px;width:fit-content}

        .up-plan-name{font-size:24px;font-weight:500;color:#111;margin-bottom:4px}
        .up-price-row{display:flex;align-items:baseline;gap:6px;margin-bottom:6px}
        .up-price{font-size:34px;font-weight:600;color:#111;line-height:1}
        .up-period{font-size:12px;color:#bbb;line-height:1.4;max-width:110px}
        .up-tagline{font-size:13px;color:#999;line-height:1.5;margin-bottom:20px;font-weight:400}

        .up-cta{display:block;width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none;text-align:center;margin-bottom:10px}
        .up-cta.disabled{background:#f0f0f0;color:#bbb;cursor:default;border:1.5px solid #e8e8e8;margin-bottom:22px}
        .up-cta.active-plan{background:#f0fdf4;color:#16a34a;cursor:default;border:1.5px solid #86efac;font-weight:600;margin-bottom:22px}
        .up-cta.primary{background:#111;color:#fff}
        .up-cta.primary:hover:not(:disabled){background:#333;transform:translateY(-1px)}
        .up-cta.grad{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,0.3)}
        .up-cta.grad:hover:not(:disabled){box-shadow:0 6px 24px rgba(79,70,229,0.4);transform:translateY(-1px)}
        .up-cta:disabled{opacity:0.65;cursor:not-allowed;transform:none !important}

        .up-secure{display:flex;align-items:center;justify-content:center;gap:5px;font-size:11px;color:#bbb;margin-bottom:18px}
        .up-divider{height:1px;background:#f0f0f0;margin-bottom:20px}
        .up-features{display:flex;flex-direction:column;gap:11px;list-style:none}
        .up-feature{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;color:#555;line-height:1.4;font-weight:400}
        .up-check{width:18px;height:18px;border-radius:50%;background:#e8f5e9;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .up-card.featured .up-check{background:#ede9fe}
        .up-card.active-card .up-check{background:#dcfce7}

        .up-footer{text-align:center;margin-top:44px;font-size:13px;color:#bbb;font-weight:400}
        .up-footer a{color:#4f46e5;text-decoration:none;font-weight:500}

        .up-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;display:inline-block;margin-right:8px;vertical-align:middle}
        @keyframes spin{to{transform:rotate(360deg)}}

        .up-toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 24px;border-radius:12px;font-size:14px;font-weight:500;font-family:'DM Sans',sans-serif;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.15);animation:toastIn 0.3s ease;white-space:nowrap;max-width:90vw;text-align:center}
        .up-toast.success{background:#16a34a;color:#fff}
        .up-toast.error{background:#ef4444;color:#fff}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>

      {toast && <div className={`up-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="up-page">
        <div className="up-header">
          <h1 className="up-title">Upgrade your plan</h1>
          <p className="up-subtitle">Choose the right plan for creators building their brand or businesses scaling campaigns.</p>
        </div>

        {/* ✅ USAGE STATS — show only when logged in */}
        {user && (
          <div className="up-usage">

            {/* INFLUENCER — Bits */}
            {isInfluencer && (
              <div className={`up-usage-card ${bitsLow && !bitsEmpty ? "warning" : ""} ${bitsEmpty ? "danger" : ""}`}>
                <div className="up-usage-top">
                  <div className="up-usage-label">
                    🪙 Bits Remaining
                    <span style={{fontSize:"11px",color:"#aaa",fontWeight:400}}>(1 apply = 10 bits)</span>
                  </div>
                  <div>
                    <div className="up-usage-val" style={{color: bitsEmpty ? "#ef4444" : bitsLow ? "#d97706" : "#111"}}>
                      {bits}
                    </div>
                    <div className="up-usage-sub">out of {bitsMax}</div>
                  </div>
                </div>
                <div className="up-progress-bar">
                  <div className="up-progress-fill" style={{
                    width: `${bitsPercent}%`,
                    background: bitsEmpty ? "#ef4444" : bitsLow ? "#f59e0b" : "#4f46e5"
                  }} />
                </div>
                <div className="up-usage-sub" style={{marginTop:6}}>
                  {applicationsUsed} applications used
                </div>
                {bitsEmpty && !isSubscribed && (
                  <div className="up-usage-alert err">⚠️ Bits khatam! Subscribe karo to apply karo</div>
                )}
                {bitsLow && !bitsEmpty && !isSubscribed && (
                  <div className="up-usage-alert warn">⚡ Sirf {bits} bits bache — jald upgrade karo</div>
                )}
                {isSubscribed && (
                  <div className="up-usage-alert" style={{background:"#f0fdf4",color:"#16a34a"}}>✓ Pro — Unlimited applications</div>
                )}
              </div>
            )}

            {/* BRAND — Campaign limit */}
            {isBrand && (
              <div className={`up-usage-card ${campaignLimitReached ? "danger" : campaignsCreated >= 3 && !isSubscribed ? "warning" : ""}`}>
                <div className="up-usage-top">
                  <div className="up-usage-label">
                    📢 Campaigns Created
                    <span style={{fontSize:"11px",color:"#aaa",fontWeight:400}}>(free limit: 5)</span>
                  </div>
                  <div>
                    <div className="up-usage-val" style={{color: campaignLimitReached ? "#ef4444" : "#111"}}>
                      {campaignsCreated}
                    </div>
                    <div className="up-usage-sub">out of {isSubscribed ? "∞" : campaignMax}</div>
                  </div>
                </div>
                <div className="up-progress-bar">
                  <div className="up-progress-fill" style={{
                    width: `${isSubscribed ? 0 : campaignPercent}%`,
                    background: campaignLimitReached ? "#ef4444" : campaignsCreated >= 3 ? "#f59e0b" : "#4f46e5"
                  }} />
                </div>
                {campaignLimitReached && (
                  <div className="up-usage-alert err">🚫 Limit reach! Aur campaigns ke liye upgrade karo</div>
                )}
                {campaignsCreated >= 3 && !campaignLimitReached && !isSubscribed && (
                  <div className="up-usage-alert warn">⚡ {campaignMax - campaignsCreated} campaigns baaki — upgrade consider karo</div>
                )}
                {isSubscribed && (
                  <div className="up-usage-alert" style={{background:"#f0fdf4",color:"#16a34a"}}>✓ Pro — Unlimited campaigns</div>
                )}
              </div>
            )}

            {/* Subscription Status */}
            <div className="up-usage-card" style={isSubscribed ? {borderColor:"#86efac",background:"#f0fdf4"} : {}}>
              <div className="up-usage-top">
                <div className="up-usage-label">
                  {isSubscribed ? "✅" : "🔒"} Subscription Status
                </div>
                <div>
                  <div className="up-usage-val" style={{fontSize:"16px",color: isSubscribed ? "#16a34a" : "#888"}}>
                    {isSubscribed ? "Active" : "Free Plan"}
                  </div>
                </div>
              </div>
              {isSubscribed ? (
                <div style={{fontSize:"13px",color:"#16a34a",fontWeight:500}}>
                  Sab features unlock hain 🎉
                </div>
              ) : (
                <div style={{fontSize:"13px",color:"#999",fontWeight:400,lineHeight:1.5}}>
                  {isInfluencer
                    ? "Upgrade karo — unlimited bits & applications pao"
                    : "Upgrade karo — unlimited campaigns post karo"}
                </div>
              )}
            </div>

          </div>
        )}

        <div className="up-toggle">
          <button className={`up-toggle-btn ${billing === "monthly" ? "active" : ""}`} onClick={() => setBilling("monthly")}>Monthly</button>
          <button className={`up-toggle-btn ${billing === "yearly" ? "active" : ""}`} onClick={() => setBilling("yearly")}>Yearly</button>
        </div>

        <div className="up-grid">
          {currentPlans.map((plan) => {
            const isLoading = loadingPlan === plan.id;
            const isFeatured = plan.id.includes("business");
            const isActivePlan = activePlan === plan.id;

            return (
              <div
                key={plan.id}
                className={`up-card ${isFeatured && !isActivePlan ? "featured" : ""} ${isActivePlan ? "active-card" : ""}`}
                style={{ background: plan.cardBg, border: `2px solid ${isActivePlan ? "#16a34a" : plan.cardBorder}` }}
              >
                {isActivePlan ? (
                  <span className="up-active-badge">✓ Active Plan</span>
                ) : plan.badge ? (
                  <span className="up-badge" style={{ background: plan.badgeColor }}>{plan.badge}</span>
                ) : null}

                <div className="up-plan-name">{plan.name}</div>
                <div className="up-price-row">
                  <span className="up-price">{plan.price}</span>
                  <span className="up-period">{plan.period}</span>
                </div>
                <div className="up-tagline">{plan.tagline}</div>

                {isActivePlan ? (
                  <span className="up-cta active-plan">✓ Current Plan</span>
                ) : plan.ctaDisabled ? (
                  <span className="up-cta disabled">{plan.cta}</span>
                ) : (
                  <>
                    <button
                      className={`up-cta ${isFeatured ? "grad" : "primary"}`}
                      onClick={() => handleSubscribe(plan.id, plan.name)}
                      disabled={loadingPlan !== null}
                    >
                      {isLoading && <span className="up-spinner" />}
                      {isLoading ? "Processing..." : plan.cta}
                    </button>
                    <div className="up-secure">🔒 Secured by Razorpay</div>
                  </>
                )}

                <div className="up-divider" />

                <ul className="up-features">
                  {plan.features.map((f, i) => (
                    <li key={i} className="up-feature">
                      <span className="up-check">
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="up-footer">
          7-day free trial on all paid plans. No credit card required.&nbsp;&nbsp;|&nbsp;&nbsp;
          <Link href="/contact">Contact us</Link> for enterprise pricing.
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