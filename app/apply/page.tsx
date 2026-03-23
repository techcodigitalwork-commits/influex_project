"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter , useSearchParams} from "next/navigation";

const API = "https://api.collabzy.in/api";

const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
  free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
  pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
  pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
  pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
  pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
};

const toCanonical = (s: string): string => {
  if (!s) return "free";
  const v = s.toLowerCase().trim();
  if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
  if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
  if (v === "proyear" || v === "pro_year") return "pro_year";
  if (v === "pro") return "pro";
  return "free";
};

function ApplyPageInner() {
  const router = useRouter();

  // const campaignId = typeof window !== "undefined"
  //   ? new URLSearchParams(window.location.search).get("id") || ""
  //   : "";

  const searchParams = useSearchParams();
const campaignId = searchParams?.get("id") || "";

  const [campaign, setCampaign]           = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [applying, setApplying]           = useState(false);
  const [applied, setApplied]             = useState(false);
  const [token, setToken]                 = useState("");
  const [showModal, setShowModal]         = useState(false);
  const [proposal, setProposal]           = useState("");
  const [bidAmount, setBidAmount]         = useState("");
  const [proposalError, setProposalError] = useState("");
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

  const [bits, setBits]                 = useState<number>(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [activePlan, setActivePlan]     = useState<string>("free");
  const [appliesUsed, setAppliesUsed]   = useState(0);
  const [campaignDeal, setCampaignDeal] = useState<any>(null);

  const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const user = localStorage.getItem("cb_user");
    if (!user) { router.push("/login"); return; }
    const parsed = JSON.parse(user);
    const t = parsed.token || localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);

    const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
    if (campaignId && appliedList.includes(campaignId)) setApplied(true);
    checkAlreadyApplied(t, campaignId);

    const subbed = parsed.isSubscribed ?? false;
    const plan   = toCanonical(parsed.activePlan || "free");
    setIsSubscribed(subbed);
    setActivePlan(subbed ? plan : "free");
    setBits(parsed.bits ?? 0);
    fetchAppliesUsed(t);
  }, []);

  useEffect(() => {
    if (!token || !campaignId) return;
    fetchCampaign();
    fetchCampaignDeal();
  }, [token, campaignId]);

  const checkAlreadyApplied = async (t: string, campId: string) => {
    if (!campId) return;
    try {
      const appRes = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
      if (appRes.ok) {
        const appData = await appRes.json();
        const myApps: any[] = appData.applications || appData.data || [];
        const alreadyApplied = myApps.some((a: any) => {
          const cid = typeof a.campaignId === "object" ? a.campaignId?._id : a.campaignId;
          return cid === campId;
        });
        if (alreadyApplied) setApplied(true);
      }
    } catch { /* silent */ }
  };

  const fetchAppliesUsed = async (t: string) => {
    try {
      const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
      if (!res.ok) return;
      const text = await res.text();
      if (text.startsWith("<!")) return;
      const data = JSON.parse(text);
      const list: any[] = data.applications || data.data || [];
      const raw    = localStorage.getItem("cb_user");
      const parsed = raw ? JSON.parse(raw) : {};
      const planStart = parsed.planActivatedAt
        ? new Date(parsed.planActivatedAt)
        : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
      const sinceActivation = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
      const count = sinceActivation.length;
      setAppliesUsed(count);
      const subbed = parsed.isSubscribed ?? false;
      if (!subbed && count > 0) {
        const calculatedBits = Math.max(0, 100 - (count * 10));
        setBits(calculatedBits);
        localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: calculatedBits }));
        window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(calculatedBits) }));
      }
    } catch { /* silent */ }
  };

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const c    = data.campaign || data.data || data;
      setCampaign(c);
      if (c?.hasApplied || c?.applied) setApplied(true);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // const fetchCampaignDeal = async () => {
  //   try {
  //     const res = await fetch(`${API}/deal/campaign/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
  //     if (res.ok) {
  //       const data = await res.json();
  //       const deals: any[] = Array.isArray(data) ? data : (data.deals || data.data || []);
  //       if (deals.length > 0) { setCampaignDeal(deals[0]); return; }
  //     }
  //     const res2 = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${token}` } });
  //     if (res2.ok) {
  //       const data2 = await res2.json();
  //       const allDeals: any[] = Array.isArray(data2) ? data2 : (data2.deals || data2.data || []);
  //       const match = allDeals.find((d: any) => {
  //         const cid = typeof d.campaignId === "object" ? d.campaignId?._id : d.campaignId;
  //         return cid === campaignId;
  //       });
  //       if (match) setCampaignDeal(match);
  //     }
  //   } catch { /* silent */ }
  // };

  const fetchCampaignDeal = async () => {
  try {
    const res = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      const allDeals: any[] = Array.isArray(data) ? data : (data.deals || data.data || []);
      const match = allDeals.find((d: any) => {
        const cid = typeof d.campaignId === "object" ? d.campaignId?._id : d.campaignId;
        return cid === campaignId;
      });
      if (match) setCampaignDeal(match);
    }
  } catch { /* silent */ }
};

  const handleApply = async () => {
    if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
    if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

    const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
    const isUnlimited = planInfo.appliesPerMonth === "unlimited";
    const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
    const cost        = planInfo.tokensPerApply;

    if (!isUnlimited && appliesUsed >= limit) {
      setShowModal(false);
      showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
      return;
    }
    if (cost > 0 && bits < cost) {
      setShowModal(false);
      showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
      return;
    }

    setProposalError("");
    let applicationId = "";
    try {
      setApplying(true);
      const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
      });
      const data = await res.json();
      // ✅ applicationId backend response se nikalo
      applicationId = data?.application?._id || data?.data?._id || data?._id || "";
      if (!res.ok) {
        const msg = (data.message || "").toLowerCase();
        if (msg.includes("already") || res.status === 400 || res.status === 500) {
          // Apply happened — treat as success
        } else {
          showToast(data.message || "Apply failed", "error");
          return;
        }
      }

      if (cost > 0) {
        const newBits = Math.max(0, bits - cost);
        setBits(newBits);
        const stored = localStorage.getItem("cb_user");
        const p = stored ? JSON.parse(stored) : {};
        localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
        window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(newBits) }));
      }

      setAppliesUsed(prev => prev + 1);
      const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      list.push(campaignId);
      localStorage.setItem("appliedCampaigns", JSON.stringify(list));
      setShowModal(false);
      setApplied(true);
      showToast("🎉 Application submitted!", "success");

      // ✅ Brand ko notification bhejo
      try {
        const brandId = typeof campaign?.brandId === "object"
          ? (campaign?.brandId?._id || campaign?.brandId?.id || "")
          : (campaign?.brandId || "");
        console.log("Brand notification — brandId:", brandId, "campaign.brandId:", campaign?.brandId);
        if (brandId) {
          const notifRes = await fetch(`${API}/notification/create`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: String(brandId),
              message: `New application received for "${campaign?.title || "your campaign"}"`,
              type: "new_application",
              link: `/campaigns/${campaignId}/applications`,
              applicationId: applicationId,
            }),
          });
          const notifData = await notifRes.json();
          console.log("Notification response:", notifData);
        }
      } catch (e) { console.error("Notification error:", e); }

    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!campaign) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🔍</div>
      <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
      <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
    </div>
  );

  const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
  const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
  const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
  const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
  const costPerApply = planInfo.tokensPerApply;
  const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
  const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
  const barPct       = isUnlimited ? 100 : Math.min(100, (bits / (planInfo.tokens as number || 100)) * 100);
  const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
        .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .cd-back:hover{background:#f4f4f4}
        .cd-bar-title{font-size:15px;font-weight:700;color:#111}
        .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
        @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
        @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
        .cd-left{display:flex;flex-direction:column;gap:16px}
        .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
        @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
        .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
        .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
        .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
        .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
        .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
        .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
        .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
        .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
        .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
        .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
        .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
        .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
        .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
        @media(max-width:768px){.cd-side{position:static}}
        .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
        .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
        .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
        .cd-info-row:last-of-type{border-bottom:none}
        .cd-info-label{font-size:13px;color:#aaa}
        .cd-info-val{font-size:13px;font-weight:600;color:#111}
        .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
        .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
        .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
        .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
        .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
        .cd-plan-label{font-size:12px;color:#999}
        .cd-plan-val{font-size:14px;font-weight:700}
        .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
        .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
        .cd-plan-hint{font-size:11px;color:#bbb}
        .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
        .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
        .cd-applies-label{font-size:12px;color:#999}
        .cd-applies-val{font-size:13px;font-weight:700}
        .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
        .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
        .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
        .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
        .cd-deal-btn{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 10px rgba(34,197,94,.25)}
        .cd-deal-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(34,197,94,.35)}
        .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
        .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
        .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
        .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
        .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
        @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
        .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
        .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
        .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
        .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
        .cd-modal-campaign-meta{font-size:13px;color:#777}
        .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
        .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
        .cd-input:focus{border-color:#4f46e5;background:#fff}
        .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
        .cd-textarea:focus{border-color:#4f46e5;background:#fff}
        .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
        .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
        .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
        .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
        .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
        .cd-cancel:hover{background:#eee;color:#555}
        .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
        .cd-submit:hover:not(:disabled){background:#4338ca}
        .cd-submit:disabled{opacity:.4;cursor:not-allowed}
        .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
        .cd-toast.success{background:#111;color:#fff}
        .cd-toast.error{background:#ef4444;color:#fff}
        .cd-toast.warn{background:#f59e0b;color:#fff}
      `}</style>

      {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cd">
        <div className="cd-bar">
          <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
          <span className="cd-bar-title">Campaign Details</span>
        </div>

        <div className="cd-wrap">
          <div className="cd-left">
            <div className="cd-card">
              <div className="cd-title-row">
                <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
                <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
                  {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
                </span>
              </div>
              <div className="cd-metas">
                {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
                {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
                {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
              </div>
              {campaign.categories?.length > 0 && (
                <>
                  <span className="cd-sec-label">Categories</span>
                  <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
                    {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
                  </div>
                </>
              )}
              {campaign.roles?.length > 0 && (
                <>
                  <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
                  <div className="cd-tags">
                    {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
                  </div>
                </>
              )}
            </div>
            {campaign.description && (
              <div className="cd-card">
                <span className="cd-sec-label">About This Campaign</span>
                <p className="cd-desc">{campaign.description}</p>
              </div>
            )}
          </div>

          <div className="cd-side">
            <div className="cd-card">
              <div className="cd-budget-label">Total Budget</div>
              <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
              <div className="cd-info-row">
                <span className="cd-info-label">Location</span>
                <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
              </div>
              <div className="cd-info-row">
                <span className="cd-info-label">Status</span>
                <span className="cd-info-val">{campaign.status || "Open"}</span>
              </div>
              <div className="cd-info-row">
                <span className="cd-info-label">Applicants</span>
                <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
              </div>

              <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
                {costPerApply > 0 && (
                  <>
                    <div className="cd-plan-row">
                      <span className="cd-plan-label">🪙 Tokens remaining</span>
                      <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
                    </div>
                    <div className="cd-plan-bar">
                      <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
                    </div>
                    <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
                    <div className="cd-plan-divider" />
                  </>
                )}
                <div className="cd-applies-row">
                  <span className="cd-applies-label">📩 Applies this month</span>
                  <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
                    {isUnlimited
                      ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
                      : `${appliesUsed} / ${monthlyLimit}`}
                  </span>
                </div>
                {!isUnlimited && (
                  <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
                    {appliesLeft === 0
                      ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
                      : isLow ? `Only ${appliesLeft} applies left this month`
                      : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
                      : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
                  </div>
                )}
                {isUnlimited && (
                  <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
                )}
              </div>

              {campaignDeal && (
                <button className="cd-deal-btn" onClick={() => router.push(`/deals/${campaignDeal._id}`)}>
                  🤝 View Deal — ₹{(campaignDeal.amount || 0).toLocaleString("en-IN")}
                </button>
              )}

              {applied ? (
                <>
                  <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
                  <div className="cd-success-box" style={{ marginTop: 12 }}>
                    <span>🎉</span>
                    <span className="cd-success-text">Application submitted!</span>
                  </div>
                  <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
                </>
              ) : campaign.status === "completed" ? (
                <button className="cd-apply-btn" disabled>Campaign Closed</button>
              ) : !canApply ? (
                <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
                  {appliesLeft === 0
                    ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
                    : "🪙 Not enough tokens — Upgrade"}
                </button>
              ) : (
                <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
                  Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="cd-modal">
            <h2 className="cd-modal-title">Apply to Campaign</h2>
            <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
            <div className="cd-modal-preview">
              <div className="cd-modal-campaign-name">{campaign.title}</div>
              <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
            </div>
            <label className="cd-modal-label">Your Bid Amount (₹)</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
              <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
                placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
                value={bidAmount} min="1"
                onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
            </div>
            {bidAmount && Number(bidAmount) > 0 && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
              </div>
            )}
            <label className="cd-modal-label">Your Proposal</label>
            <textarea className="cd-textarea" rows={6}
              placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
              value={proposal}
              onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
            <div className="cd-char">{proposal.length} characters</div>
            {proposalError && <p className="cd-err">{proposalError}</p>}
            {costPerApply > 0 && (
              <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
                <span>Token cost</span>
                <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
              </div>
            )}
            <div className="cd-modal-btns">
              <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="cd-submit" onClick={handleApply} disabled={applying}>
                {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ApplyPageInner />
    </Suspense>
  );
}



// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);
//   const [campaignDeal, setCampaignDeal] = useState<any>(null);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);
//     checkAlreadyApplied(t, campaignId);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     setBits(parsed.bits ?? 0);
//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//     fetchCampaignDeal();
//   }, [token, campaignId]);

//   const checkAlreadyApplied = async (t: string, campId: string) => {
//     if (!campId) return;
//     try {
//       const appRes = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (appRes.ok) {
//         const appData = await appRes.json();
//         const myApps: any[] = appData.applications || appData.data || [];
//         const alreadyApplied = myApps.some((a: any) => {
//           const cid = typeof a.campaignId === "object" ? a.campaignId?._id : a.campaignId;
//           return cid === campId;
//         });
//         if (alreadyApplied) setApplied(true);
//       }
//     } catch { /* silent */ }
//   };

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];
//       const raw    = localStorage.getItem("cb_user");
//       const parsed = raw ? JSON.parse(raw) : {};
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
//       const sinceActivation = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//       const count = sinceActivation.length;
//       setAppliesUsed(count);
//       const subbed = parsed.isSubscribed ?? false;
//       if (!subbed && count > 0) {
//         const calculatedBits = Math.max(0, 100 - (count * 10));
//         setBits(calculatedBits);
//         localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: calculatedBits }));
//         window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(calculatedBits) }));
//       }
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const fetchCampaignDeal = async () => {
//     try {
//       const res = await fetch(`${API}/deal/campaign/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       if (res.ok) {
//         const data = await res.json();
//         const deals: any[] = Array.isArray(data) ? data : (data.deals || data.data || []);
//         if (deals.length > 0) { setCampaignDeal(deals[0]); return; }
//       }
//       const res2 = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${token}` } });
//       if (res2.ok) {
//         const data2 = await res2.json();
//         const allDeals: any[] = Array.isArray(data2) ? data2 : (data2.deals || data2.data || []);
//         const match = allDeals.find((d: any) => {
//           const cid = typeof d.campaignId === "object" ? d.campaignId?._id : d.campaignId;
//           return cid === campaignId;
//         });
//         if (match) setCampaignDeal(match);
//       }
//     } catch { /* silent */ }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }
//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       // const data = await res.json();
//       // if (!res.ok) {
//       //   const msg = (data.message || "").toLowerCase();
//       //   if (msg.includes("already") || res.status === 400 || res.status === 500) {
//       //     // Apply happened — treat as success
//       //   } else {
//       //     showToast(data.message || "Apply failed", "error");
//       //     return;
//       //   }
//       // }
//       const data = await res.json();
//       if (!res.ok) {
//         const msg = (data.message || "").toLowerCase();
//         if (msg.includes("already") || res.status === 400 || res.status === 500) {
//           // Apply happened — treat as success
//         } else {
//           showToast(data.message || "Apply failed", "error");
//           return;
//         }
//       }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored = localStorage.getItem("cb_user");
//         const p = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//         window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(newBits) }));
//       }

//       setAppliesUsed(prev => prev + 1);
//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));
//       setShowModal(false);
//       setApplied(true);
//       showToast("🎉 Application submitted!", "success");

//       // ✅ Brand ko notification bhejo
//       try {
//         const brandId = typeof campaign?.brandId === "object"
//           ? (campaign?.brandId?._id || campaign?.brandId?.id || "")
//           : (campaign?.brandId || "");
//         console.log("Brand notification — brandId:", brandId, "campaign.brandId:", campaign?.brandId);
//         if (brandId) {
//           const notifRes = await fetch(`${API}/notification/create`, {
//             method: "POST",
//             headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//          body: JSON.stringify({
//               userId: String(brandId),
//               message: `New application received for "${campaign?.title || "your campaign"}"`,
//               type: "new_application",
//               link: `/campaigns/${campaignId}/applications`,
//               applicationId: applicationId,
//             }),
//           });
//           const notifData = await notifRes.json();
//           console.log("Notification response:", notifData);
//         }
//       } catch (e) { console.error("Notification error:", e); }

//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / (planInfo.tokens as number || 100)) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-deal-btn{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 10px rgba(34,197,94,.25)}
//         .cd-deal-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(34,197,94,.35)}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {campaignDeal && (
//                 <button className="cd-deal-btn" onClick={() => router.push(`/deals/${campaignDeal._id}`)}>
//                   🤝 View Deal — ₹{(campaignDeal.amount || 0).toLocaleString("en-IN")}
//                 </button>
//               )}

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);
//   // ✅ Deal for this campaign (if exists)
//   const [campaignDeal, setCampaignDeal] = useState<any>(null);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);
//     // Also check from /api/application/my
//     checkAlreadyApplied(t, campaignId);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");

//     // ✅ Fetch live bits from backend — don't rely on localStorage
//     fetchLiveBits(t, parsed, subbed, subbed ? plan : "free");
//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//     fetchCampaignDeal();
//   }, [token, campaignId]);

//   // ✅ bits localStorage se lo — login pe backend se sync hota hai
//   // parsed.bits = database se aaya hua accurate value
//   const fetchLiveBits = async (t: string, parsed: any, subbed: boolean, plan: string) => {
//     // parsed.bits is accurate — set directly from localStorage
//     setBits(parsed.bits ?? 0);
//   };

//   const checkAlreadyApplied = async (t: string, campId: string) => {
//     if (!campId) return;
//     try {
//       const appRes = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (appRes.ok) {
//         const appData = await appRes.json();
//         const myApps: any[] = appData.applications || appData.data || [];
//         const alreadyApplied = myApps.some((a: any) => {
//           const cid = typeof a.campaignId === "object" ? a.campaignId?._id : a.campaignId;
//           return cid === campId;
//         });
//         if (alreadyApplied) setApplied(true);
//       }
//     } catch { /* silent */ }
//   };

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];
//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d > planStart;
//       });
//       const count = sinceActivation.length;
//       setAppliesUsed(count);

//       // ✅ Recalculate bits based on actual applies used
//       // Free plan: 100 base tokens, 10 per apply
//       const subbed = parsed.isSubscribed ?? false;
//       if (!subbed && count > 0) {
//         const baseBits = 100; // free plan base
//         const costPerApply = 10;
//         const calculatedBits = Math.max(0, baseBits - (count * costPerApply));
//         setBits(calculatedBits);
//         // Update localStorage
//         const updated = { ...parsed, bits: calculatedBits };
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//         window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(calculatedBits) }));
//       }
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   // ✅ Fetch deal for this campaign
//   const fetchCampaignDeal = async () => {
//     try {
//       // First try campaign-specific route
//       const res  = await fetch(`${API}/deal/campaign/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       if (res.ok) {
//         const data = await res.json();
//         const deals: any[] = Array.isArray(data) ? data : (data.deals || data.data || []);
//         if (deals.length > 0) { setCampaignDeal(deals[0]); return; }
//       }
//       // Fallback: get all my deals and filter by campaignId
//       const res2 = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${token}` } });
//       if (res2.ok) {
//         const data2 = await res2.json();
//         const allDeals: any[] = Array.isArray(data2) ? data2 : (data2.deals || data2.data || []);
//         const match = allDeals.find((d: any) => {
//           const cid = typeof d.campaignId === "object" ? d.campaignId?._id : d.campaignId;
//           return cid === campaignId;
//         });
//         if (match) setCampaignDeal(match);
//       }
//     } catch { /* silent */ }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       // const data = await res.json();
//       // if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }
//       const data = await res.json();
// if (!res.ok) {
//   const msg = (data.message || "").toLowerCase();
//   if (msg.includes("already") || res.status === 400 || res.status === 500) {
//     // Apply happened — treat as success
//   } else {
//     showToast(data.message || "Apply failed", "error");
//     return;
//   }
// }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//         // ✅ Signal navbar
//         window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(newBits) }));
//       }

//       setAppliesUsed(prev => prev + 1);
//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));
//       setShowModal(false);
//       setApplied(true);
//       showToast("🎉 Application submitted!", "success");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / (planInfo.tokens as number || 100)) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-deal-btn{width:100%;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;margin-top:10px;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 10px rgba(34,197,94,.25)}
//         .cd-deal-btn:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(34,197,94,.35)}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {/* ✅ Deal button — agar is campaign ke liye deal hai */}
//               {campaignDeal && (
//                 <button className="cd-deal-btn" onClick={() => router.push(`/deals/${campaignDeal._id}`)}>
//                   🤝 View Deal — ₹{(campaignDeal.amount || 0).toLocaleString("en-IN")}
//                 </button>
//               )}

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     // ✅ Subscribed user ke liye plan tokens dikhao — purana bits ignore karo
//     const planInfo = CREATOR_PLANS[subbed ? plan : "free"];
//     if (subbed && planInfo.tokens !== "unlimited") {
//       setBits(planInfo.tokens as number);
//     } else {
//       setBits(parsed.bits ?? 0);
//     }

//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];

//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke applies count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setAppliesUsed(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }





// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useParams, useRouter } from "next/navigation";

// const API          = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";

// function DealDetailPageInner() {
//   const { id }   = useParams();
//   const router   = useRouter();

//   const [deal,          setDeal]          = useState<any>(null);
//   const [escrow,        setEscrow]        = useState<any>(null);
//   const [loading,       setLoading]       = useState(true);
//   const [token,         setToken]         = useState("");
//   const [role,          setRole]          = useState("");
//   const [userName,      setUserName]      = useState("");
//   const [userEmail,     setUserEmail]     = useState("");
//   const [actionLoading, setActionLoading] = useState("");
//   const [toast,         setToast]         = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
//   const [submitNote,    setSubmitNote]    = useState("");
//   const [submitFile,    setSubmitFile]    = useState("");
//   const [showSubmit,    setShowSubmit]    = useState(false);
//   const [brandName,     setBrandName]     = useState("");
//   const [creatorName,   setCreatorName]   = useState("");

//   const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
//     setToast({msg,type}); setTimeout(() => setToast(null), 4500);
//   };

//   useEffect(() => {
//     if (typeof window !== "undefined" && !(window as any).Razorpay) {
//       const s = document.createElement("script");
//       s.src = "https://checkout.razorpay.com/v1/checkout.js";
//       s.async = true;
//       document.head.appendChild(s);
//     }
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const u = JSON.parse(raw);
//     setToken(u.token);
//     setRole((u.role || u.user?.role || "").toLowerCase());
//     setUserName(u.name || u.user?.name || "");
//     setUserEmail(u.email || u.user?.email || "");
//     fetchDeal(u.token);
//   }, [id]);

//   const fetchDeal = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/deal/${id}`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed");
//       const d = data.deal || data.data || (data._id ? data : null) || data;
//       setDeal(d);
//       const esc = d.escrow || data.escrow || null;
//       if (esc) setEscrow(esc);

//       // Fetch brand & creator names
//       const brandId   = d.brandId?._id   || d.brandId;
//       const creatorId = d.influencerId?._id || d.influencerId;
//       if (brandId && typeof brandId === "string") {
//         fetch(`${API}/profile/user/${brandId}`, { headers: { Authorization: `Bearer ${t}` } })
//           .then(r => r.json()).then(pd => {
//             const p = pd.profile || pd.data || pd;
//             setBrandName(p?.companyName || p?.name || "");
//           }).catch(() => {});
//       }
//       if (creatorId && typeof creatorId === "string") {
//         fetch(`${API}/profile/user/${creatorId}`, { headers: { Authorization: `Bearer ${t}` } })
//           .then(r => r.json()).then(pd => {
//             const p = pd.profile || pd.data || pd;
//             setCreatorName(p?.name || p?.username || "");
//           }).catch(() => {});
//       }
//     } catch(e:any) {
//       showToast(e.message || "Failed to load deal", "error");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDeposit = async (t?: string) => {
//     const tk = t || token;
//     if (!deal) return;
//     setActionLoading("deposit");
//     try {
//       const dealAmount    = Number(deal.amount || 0);
//       const commission    = Math.round(dealAmount * 0.10);
//       const creatorAmount = dealAmount - commission;
//       const rawInf        = deal.influencerId;
//       const influencerId  = (typeof rawInf === "object" && rawInf !== null)
//         ? (rawInf._id || rawInf.id || String(rawInf))
//         : String(rawInf || "");

//       const res  = await fetch(`${API}/payment/deposit`, {
//         method:  "POST",
//         headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
//         body:    JSON.stringify({ dealId: id, amount: dealAmount, commission, creatorAmount, influencerId }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed to create order");
//       if (!data.order?.id) throw new Error("No order returned from server");

//       if (!(window as any).Razorpay) {
//         await new Promise<void>((resolve, reject) => {
//           const ex = document.querySelector('script[src*="razorpay"]');
//           if (ex) ex.remove();
//           const s = document.createElement("script");
//           s.src = "https://checkout.razorpay.com/v1/checkout.js";
//           s.async = true;
//           s.onload  = () => setTimeout(resolve, 500);
//           s.onerror = () => reject(new Error("Razorpay failed to load"));
//           document.head.appendChild(s);
//         });
//       }

//       const rzp = new (window as any).Razorpay({
//         key:         RAZORPAY_KEY,
//         order_id:    data.order.id,
//         amount:      data.order.amount,
//         currency:    data.order.currency || "INR",
//         name:        "Influex Escrow",
//         description: `Deal: ${deal.title || id}`,
//         theme:       { color: "#4f46e5" },
//         prefill:     { name: userName, email: userEmail },
//         handler: async (response: any) => {
//           try {
//             const vRes = await fetch(`${API}/payment/verify`, {
//               method:  "POST",
//               headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
//               body:    JSON.stringify({
//                 dealId:              id,
//                 razorpay_order_id:   response.razorpay_order_id,
//                 razorpay_payment_id: response.razorpay_payment_id,
//                 razorpay_signature:  response.razorpay_signature,
//                 influencerId:        (typeof deal?.influencerId === "object" && deal?.influencerId !== null)
//                                        ? (deal.influencerId._id || deal.influencerId.id || String(deal.influencerId))
//                                        : String(deal?.influencerId || ""),
//                 amount: Number(deal?.amount || 0),
//               }),
//             });
//             const vData = await vRes.json();
//             if (!vRes.ok) throw new Error(vData.message || "Verification failed");
//             setEscrow(vData.escrow || { status: "funded" });
//             setDeal((prev: any) => ({ ...prev, paymentStatus: "deposited" }));
//             showToast("✅ Escrow funded! Deal is now active.", "success");
//             await fetchDeal(tk);
//           } catch(e:any) {
//             showToast(e.message || "Verification failed", "error");
//           } finally { setActionLoading(""); }
//         },
//         modal: { ondismiss: () => setActionLoading("") },
//       });
//       rzp.open();
//     } catch(e:any) {
//       showToast(e.message || "Payment failed", "error");
//       setActionLoading("");
//     }
//   };

//   // ✅ Creator submits work — POST /api/deal/:dealId/submit-deliverable
//   const handleSubmitWork = async () => {
//     if (!submitNote.trim() && !submitFile.trim()) {
//       showToast("Please add a work link or note", "error");
//       return;
//     }
//     if (!submitFile.trim()) {
//       showToast("Please enter your work link", "error");
//       return;
//     }
//     setActionLoading("submit");
//     try {
//       const res = await fetch(`${API}/deal/${id}/submit-deliverable`, {
//         method:  "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body:    JSON.stringify({
//           workLink:    submitFile,
//           description: submitNote || submitFile,
//           notes:       submitNote,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Submit failed");
//       showToast("📤 Work submitted! Waiting for brand approval.", "success");
//       setShowSubmit(false);
//       setSubmitNote("");
//       setSubmitFile("");
//       // Update local state immediately
//       setDeal((prev: any) => ({ ...prev, workStatus: "submitted" }));
//       await fetchDeal(token);
//     } catch (e:any) {
//       showToast(e.message || "Submit failed", "error");
//     } finally { setActionLoading(""); }
//   };

//   // ✅ Brand approves work
//   const handleApprove = async () => {
//     if (!confirm("Approve work and release payment to creator?")) return;
//     setActionLoading("approve");
//     try {
//       const res = await fetch(`${API}/deal/approve`, {
//         method:  "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body:    JSON.stringify({ dealId: id }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Approval failed");
//       showToast("🎉 Approved! Payment released to creator.", "success");
//       await fetchDeal(token);
//     } catch(e:any) {
//       showToast(e.message || "Approval failed", "error");
//     } finally { setActionLoading(""); }
//   };

//   const isEscrowFunded  = deal?.paymentStatus === "deposited" || deal?.paymentStatus === "released" || escrow?.status === "funded" || escrow?.status === "released";
//   const isWorkSubmitted = deal?.workStatus === "submitted" || deal?.workStatus === "approved" || deal?.workStatus === "completed";
//   const isCompleted     = deal?.paymentStatus === "released" || deal?.paymentStatus === "completed" || escrow?.status === "released";
//   const isBrand         = role === "brand";
//   const isCreator       = role === "influencer" || role === "creator";

//   const getStep = (): number => {
//     if (!deal) return 0;
//     if (isCompleted)     return 4;
//     if (isWorkSubmitted) return 3;
//     if (isEscrowFunded)  return 2;
//     return 1;
//   };

//   const STEPS = [
//     { label: "Deal\nCreated",     icon: "🤝" },
//     { label: "Escrow\nFunded",    icon: "💰" },
//     { label: "Work\nSubmitted",   icon: "📤" },
//     { label: "Brand\nApproved",   icon: "✅" },
//     { label: "Payment\nReleased", icon: "🚀" },
//   ];

//   if (loading) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
//       <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!deal) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5",fontFamily:"Plus Jakarta Sans,sans-serif",flexDirection:"column",gap:16}}>
//       <div style={{fontSize:48}}>🤝</div>
//       <div style={{fontWeight:700,color:"#111",fontSize:18}}>Deal not found</div>
//       <button onClick={() => router.push("/deals")} style={{padding:"10px 24px",background:"#4f46e5",color:"#fff",border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit"}}>← Back to Deals</button>
//     </div>
//   );

//   const step = getStep();

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         body{font-family:'Plus Jakarta Sans',sans-serif}
//         .dd{background:#f7f7f5;min-height:100vh;padding-bottom:60px}
//         .dd-hdr{background:#fff;border-bottom:1px solid #efefef;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
//         .dd-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#555;text-decoration:none;font-family:inherit}
//         .dd-title{font-size:17px;font-weight:800;color:#111}
//         .dd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
//         .dd-body{max-width:640px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:14px;animation:fadeIn .3s ease}
//         .dd-card{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px}
//         .dd-card-title{font-size:12px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}
//         .dd-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:14px}
//         .dd-row:last-child{border-bottom:none}
//         .dd-lbl{color:#888;font-weight:500}
//         .dd-val{font-weight:700;color:#111}
//         .flow{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px 16px}
//         .flow-hdr{font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px}
//         .flow-row{display:flex;align-items:flex-start}
//         .flow-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
//         .flow-line{position:absolute;top:16px;left:50%;right:-50%;height:2px;background:#e8e8e8;z-index:0;transition:background .4s}
//         .flow-line.on{background:linear-gradient(90deg,#4f46e5,#7c3aed)}
//         .flow-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #e8e8e8;background:#fff;color:#bbb;z-index:1;position:relative;transition:all .3s}
//         .flow-dot.done{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-color:#4f46e5;color:#fff}
//         .flow-dot.cur{background:#fff;border-color:#4f46e5;color:#4f46e5;box-shadow:0 0 0 4px #eef2ff}
//         .flow-lbl{font-size:9px;font-weight:600;color:#bbb;margin-top:5px;text-align:center;line-height:1.3;white-space:pre-line}
//         .flow-lbl.done{color:#4f46e5}
//         .flow-lbl.cur{color:#4f46e5;font-weight:800}
//         .esc-amt{font-size:36px;font-weight:800;color:#4f46e5;text-align:center;padding:12px 0 4px}
//         .esc-lbl{font-size:12px;color:#aaa;text-align:center;margin-bottom:14px}
//         .esc-status{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:12px}
//         .esc-funded{background:#f0fdf4;color:#16a34a;border:1.5px solid #86efac}
//         .esc-pending{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a}
//         .esc-released{background:#eef2ff;color:#4f46e5;border:1.5px solid #c7d2fe}
//         .btn{width:100%;padding:14px;border-radius:14px;font-size:14px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
//         .btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important}
//         .btn-deposit{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,.28)}
//         .btn-deposit:hover:not(:disabled){transform:translateY(-1px)}
//         .btn-approve{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;box-shadow:0 4px 16px rgba(34,197,94,.25)}
//         .btn-approve:hover:not(:disabled){transform:translateY(-1px)}
//         .btn-submit{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;box-shadow:0 4px 16px rgba(245,158,11,.25)}
//         .btn-submit:hover:not(:disabled){transform:translateY(-1px)}
//         .btn-ghost{background:#f5f5f3;color:#555}
//         .btn-contract{background:#f0f9ff;color:#0369a1;border:1.5px solid #bae6fd;text-decoration:none}
//         .sf{background:#f8f9ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;margin-top:10px}
//         .sf-lbl{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;display:block}
//         .sf-input{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;margin-bottom:10px;color:#111}
//         .sf-input:focus{border-color:#4f46e5}
//         .sf-ta{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:80px;margin-bottom:10px;color:#111;line-height:1.6}
//         .sf-ta:focus{border-color:#4f46e5}
//         .info{padding:11px 14px;border-radius:10px;font-size:13px;font-weight:600;margin-top:8px}
//         .info-green{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .info-blue{background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe}
//         .info-orange{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}
//         .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .toast.success{background:#111;color:#fff}
//         .toast.error{background:#ef4444;color:#fff}
//         .toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="dd">
//         <div className="dd-hdr">
//           <div style={{display:"flex",alignItems:"center",gap:10}}>
//             <a href="/deals" className="dd-back">← Back</a>
//             <div className="dd-title">{deal.title || "Deal"}</div>
//           </div>
//           <div className="dd-badge" style={{
//             background: isCompleted ? "#f0fdf4" : isEscrowFunded ? "#eef2ff" : "#fffbeb",
//             color:      isCompleted ? "#16a34a" : isEscrowFunded ? "#4f46e5" : "#d97706",
//             border:     `1.5px solid ${isCompleted ? "#86efac" : isEscrowFunded ? "#c7d2fe" : "#fde68a"}`,
//           }}>{deal.paymentStatus || "pending"}</div>
//         </div>

//         <div className="dd-body">

//           {/* FLOW STEPS */}
//           <div className="flow">
//             <div className="flow-hdr">Deal Progress</div>
//             <div className="flow-row">
//               {STEPS.map((s, i) => (
//                 <div key={i} className="flow-step">
//                   {i < STEPS.length - 1 && <div className={`flow-line ${i < step ? "on" : ""}`}/>}
//                   <div className={`flow-dot ${i < step ? "done" : i === step ? "cur" : ""}`}>
//                     {i < step ? "✓" : s.icon}
//                   </div>
//                   <div className={`flow-lbl ${i < step ? "done" : i === step ? "cur" : ""}`}>{s.label}</div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* DEAL INFO */}
//           <div className="dd-card">
//             <div className="dd-card-title">📋 Deal Info</div>
//             <div className="dd-row"><span className="dd-lbl">Campaign</span><span className="dd-val">{deal.campaignId?.title || deal.campaignTitle || "—"}</span></div>
//             <div className="dd-row"><span className="dd-lbl">Brand</span><span className="dd-val">{brandName || deal.brandId?.name || "—"}</span></div>
//             <div className="dd-row"><span className="dd-lbl">Creator</span><span className="dd-val">{creatorName || deal.influencerId?.name || "—"}</span></div>
//             <div className="dd-row"><span className="dd-lbl">Amount</span><span className="dd-val">₹{Number(deal.amount||0).toLocaleString("en-IN")}</span></div>
//             <div className="dd-row"><span className="dd-lbl">Platform Fee (10%)</span><span className="dd-val">₹{Number(deal.platformCommission||0).toLocaleString("en-IN")}</span></div>
//             <div className="dd-row"><span className="dd-lbl">Creator Gets</span><span className="dd-val" style={{color:"#16a34a"}}>₹{Number(deal.creatorAmount||0).toLocaleString("en-IN")}</span></div>
//             {deal.deadline && <div className="dd-row"><span className="dd-lbl">Deadline</span><span className="dd-val">{new Date(deal.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</span></div>}
//             {deal.description && (
//               <div style={{marginTop:10,padding:"10px 12px",background:"#f9f9f8",borderRadius:10,fontSize:13,color:"#555",lineHeight:1.6}}>
//                 {deal.description}
//               </div>
//             )}
//           </div>

//           {/* ESCROW / PAYMENT */}
//           <div className="dd-card">
//             <div className="dd-card-title">💰 Escrow Payment</div>
//             <div className="esc-amt">₹{Number(deal.amount||0).toLocaleString("en-IN")}</div>
//             <div className="esc-lbl">Deal Amount</div>

//             {isCompleted ? (
//               <div className="esc-status esc-released">🚀 Payment released to creator!</div>
//             ) : isEscrowFunded ? (
//               <div className="esc-status esc-funded">🔒 Funds held in escrow — Creator gets ₹{Number(deal.creatorAmount||0).toLocaleString("en-IN")}</div>
//             ) : (
//               <div className="esc-status esc-pending">⏳ Awaiting escrow deposit</div>
//             )}

//             {/* Brand: deposit */}
//             {isBrand && !isEscrowFunded && !isCompleted && (
//               <button className="btn btn-deposit" disabled={actionLoading==="deposit"} onClick={() => handleDeposit()}>
//                 {actionLoading==="deposit" ? "⏳ Opening payment..." : `💰 Deposit ₹${Number(deal.amount||0).toLocaleString("en-IN")} to Escrow`}
//               </button>
//             )}

//             {/* Brand: waiting for work */}
//             {isBrand && isEscrowFunded && !isWorkSubmitted && !isCompleted && (
//               <div className="info info-orange">⏳ Waiting for creator to submit work...</div>
//             )}

//             {/* Brand: approve work */}
//             {isBrand && isEscrowFunded && isWorkSubmitted && !isCompleted && (
//               <>
//                 <div className="info info-blue">🎯 Creator submitted work. Review and approve to release payment.</div>
//                 <button className="btn btn-approve" disabled={actionLoading==="approve"} onClick={handleApprove}>
//                   {actionLoading==="approve" ? "⏳ Releasing..." : "✅ Approve Work & Release Payment"}
//                 </button>
//               </>
//             )}

//             {isCompleted && (
//               <div className="info info-green" style={{textAlign:"center",marginTop:8}}>🎉 Deal completed successfully!</div>
//             )}

//             {isBrand && (
//               <a
//                 href={`/contracts/create?dealId=${deal._id}&campaignId=${deal.campaignId?._id||deal.campaignId||""}&creatorId=${deal.influencerId?._id||deal.influencerId||""}`}
//                 className="btn btn-contract"
//                 style={{marginTop:10}}
//               >📄 Create Contract for this Deal</a>
//             )}
//           </div>

//           {/* Deliverables */}
//           {deal.deliverables?.length > 0 && (
//             <div className="dd-card">
//               <div className="dd-card-title">✅ Deliverables</div>
//               {(Array.isArray(deal.deliverables) ? deal.deliverables : [deal.deliverables]).map((d:string, i:number) => (
//                 <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5",fontSize:14,color:"#444",alignItems:"flex-start"}}>
//                   <div style={{width:22,height:22,background:"#eef2ff",color:"#4f46e5",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</div>
//                   <div style={{flex:1,lineHeight:1.5}}>{d}</div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* ✅ CREATOR: Submit Work Section */}
//           {isCreator && isEscrowFunded && !isCompleted && (
//             <div className="dd-card">
//               <div className="dd-card-title">📤 Submit Your Work</div>

//               {isWorkSubmitted ? (
//                 <>
//                   <div className="info info-green">✅ Work submitted! Waiting for brand approval.</div>
//                   {/* Show submitted work link if available */}
//                   {(deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0] || deal.workLink) && (
//                     <a
//                       href={deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0] || deal.workLink}
//                       target="_blank" rel="noreferrer"
//                       style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,color:"#16a34a",fontWeight:600,fontSize:13,textDecoration:"none",border:"1px solid #bbf7d0",marginTop:10}}
//                     >
//                       🔗 View Your Submitted Work →
//                     </a>
//                   )}
//                 </>
//               ) : !showSubmit ? (
//                 <>
//                   <div style={{fontSize:14,color:"#555",lineHeight:1.6,marginBottom:14}}>
//                     Escrow is funded! Submit your completed work for brand review. Payment of <strong style={{color:"#4f46e5"}}>₹{Number(deal.creatorAmount||deal.amount||0).toLocaleString("en-IN")}</strong> will be released after approval.
//                   </div>
//                   <button className="btn btn-submit" onClick={() => setShowSubmit(true)}>
//                     📤 Submit Completed Work
//                   </button>
//                 </>
//               ) : (
//                 <div className="sf">
//                   <label className="sf-lbl">Work Link / Drive URL <span style={{color:"#ef4444"}}>*</span></label>
//                   <input
//                     className="sf-input"
//                     value={submitFile}
//                     onChange={e => setSubmitFile(e.target.value)}
//                     placeholder="https://drive.google.com/... or Instagram post link"
//                   />
//                   <div style={{fontSize:11,color:"#aaa",marginTop:-8,marginBottom:10}}>Google Drive, Instagram, YouTube, Dropbox or any public link</div>

//                   <label className="sf-lbl">Notes for Brand <span style={{color:"#ef4444"}}>*</span></label>
//                   <textarea
//                     className="sf-ta"
//                     value={submitNote}
//                     onChange={e => setSubmitNote(e.target.value)}
//                     placeholder="Describe what you've completed and how it meets the requirements..."
//                   />

//                   <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"10px 14px",marginBottom:10,fontSize:13,color:"#92400e",lineHeight:1.6}}>
//                     ⚠️ Once submitted, brand will review and release ₹{Number(deal.creatorAmount||deal.amount||0).toLocaleString("en-IN")} from escrow.
//                   </div>

//                   <button
//                     className="btn btn-submit"
//                     disabled={actionLoading==="submit"}
//                     onClick={handleSubmitWork}
//                   >
//                     {actionLoading==="submit" ? "⏳ Submitting..." : "✅ Submit Work"}
//                   </button>
//                   <button className="btn btn-ghost" style={{marginTop:6}} onClick={() => setShowSubmit(false)}>
//                     Cancel
//                   </button>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Creator: deal completed */}
//           {isCreator && isCompleted && (
//             <div style={{background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:"1.5px solid #86efac",borderRadius:18,padding:24,textAlign:"center"}}>
//               <div style={{fontSize:40,marginBottom:10}}>🎉</div>
//               <div style={{fontSize:20,fontWeight:800,color:"#15803d",marginBottom:8}}>Payment Released!</div>
//               <div style={{fontSize:15,color:"#16a34a",lineHeight:1.6}}>
//                 ₹{Number(deal.creatorAmount||deal.amount||0).toLocaleString("en-IN")} has been released. Great work!
//               </div>
//             </div>
//           )}

//           {/* Brand: view submitted work */}
//           {isBrand && isWorkSubmitted && (
//             <div className="dd-card" style={{border:"1.5px solid #c7d2fe",background:"#f8f9ff"}}>
//               <div className="dd-card-title">📩 Creator's Submission</div>
//               {deal.submittedWork?.note && (
//                 <div style={{fontSize:13,color:"#444",lineHeight:1.65,marginBottom:10,padding:"10px 12px",background:"#fff",borderRadius:10}}>
//                   {deal.submittedWork.note}
//                 </div>
//               )}
//               {(deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0]) ? (
//                 <a href={deal.submittedWork?.fileUrl || deal.submittedWork?.links?.[0]} target="_blank" rel="noreferrer"
//                   style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff",borderRadius:10,color:"#4f46e5",fontWeight:600,fontSize:13,textDecoration:"none",border:"1px solid #c7d2fe"}}>
//                   📎 View Submitted Work →
//                 </a>
//               ) : (
//                 <div className="info info-blue">Work submitted — no link provided by creator.</div>
//               )}
//             </div>
//           )}

//         </div>
//       </div>
//     </>
//   );
// }

// export default function DealDetailPage() {
//   return (
//     <Suspense fallback={
//       <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
//         <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <DealDetailPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     // ✅ Subscribed user ke liye plan tokens dikhao — purana bits ignore karo
//     const planInfo = CREATOR_PLANS[subbed ? plan : "free"];
//     if (subbed && planInfo.tokens !== "unlimited") {
//       setBits(planInfo.tokens as number);
//     } else {
//       setBits(parsed.bits ?? 0);
//     }

//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];

//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke applies count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setAppliesUsed(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }



// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 10 },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 10 },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     const planInfo = CREATOR_PLANS[subbed ? plan : "free"];
//     const planTokens = planInfo.tokens === "unlimited" ? 0 : (planInfo.tokens as number);
//     // ✅ bits = actual remaining (localStorage se), fallback = plan full tokens
//     const currentBits = parsed.bits !== undefined ? parsed.bits : planTokens;
//     setBits(currentBits);
//     // Agar bits set nahi hai localStorage mein, set karo plan tokens se
//     if (parsed.bits === undefined && subbed && planTokens > 0) {
//       const updated = { ...parsed, bits: planTokens };
//       localStorage.setItem("cb_user", JSON.stringify(updated));
//     }

//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];

//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke applies count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setAppliesUsed(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 0  },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 0  },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const [bits, setBits]                 = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]     = useState<string>("free");
//   const [appliesUsed, setAppliesUsed]   = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     // ✅ Subscribed user ke liye plan tokens dikhao — purana bits ignore karo
//     const planInfo = CREATOR_PLANS[subbed ? plan : "free"];
//     if (subbed && planInfo.tokens !== "unlimited") {
//       setBits(planInfo.tokens as number);
//     } else {
//       setBits(parsed.bits ?? 0);
//     }

//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];

//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       // ✅ Sirf planActivatedAt ke BAAD ke applies count karo (strictly after >)
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d > planStart; // ✅ strictly AFTER activation
//       });
//       setAppliesUsed(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited ? true : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>
//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly ? "Free trial limit reached — upgrade to keep applying" : "Monthly limit reached — upgrade to apply more"
//                       : isLow ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                       : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}
//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>{planInfo.label} yearly plan — unlimited applies</div>
//                 )}
//               </div>

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly ? "🚫 Free trial ended — Upgrade Plan" : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ── Creator plan limits ─────────────────────────────────────────
// // ── Plan limits matching UpgradePage exactly ─────────────────
// // Free:          100 tokens/month, 10 applies/month (first month only, then upgrade)
// // Pro monthly:   1000 tokens/month, 100 applies/month — ₹299
// // Pro+ monthly:  2000 tokens/month, 200 applies/month — ₹499
// // Pro yearly:    Unlimited tokens + applies — ₹2999
// // Pro+ yearly:   Unlimited tokens + applies — ₹5999
// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 10 },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 10 },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   // Read campaignId from URL without useSearchParams
//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   // Plan state
//   const [bits, setBits]               = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]   = useState<string>("free");
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     // Plan info
//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     setBits(parsed.bits ?? 0);

//     // Fetch applies used this month
//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];

//       // Count applies SINCE plan activation — not calendar month
//       // This ensures upgrading gives fresh limit, not deducting old applies
//       const raw       = localStorage.getItem("cb_user");
//       const parsed    = raw ? JSON.parse(raw) : {};
//       const planStart = parsed.planActivatedAt
//         ? new Date(parsed.planActivatedAt)
//         : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();

//       const sinceActivation = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d >= planStart;
//       });
//       setAppliesUsed(sinceActivation.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     // Check monthly apply limit
//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     // Check token balance (only if cost > 0)
//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       // Deduct tokens if cost > 0
//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       // Update applies used
//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   // ── Derived plan info ──────────────────────────────────────────
//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited
//     ? true
//     : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}

//         /* Plan box */
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}

//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}

//         /* Modal */
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               {/* ── Plan-based token/apply box ── */}
//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>

//                 {/* Tokens row (only if cost > 0) */}
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}

//                 {/* Applies row */}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>

//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly
//                         ? "Free trial limit reached — upgrade to keep applying"
//                         : "Monthly limit reached — upgrade to apply more"
//                       : isLow
//                       ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly
//                         ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                         : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}

//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>
//                     {planInfo.label} yearly plan — unlimited applies
//                   </div>
//                 )}
//               </div>

//               {/* Apply button */}
//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly
//                       ? "🚫 Free trial ended — Upgrade Plan"
//                       : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}

//             {/* Cost summary in modal */}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}

//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ── Creator plan limits ─────────────────────────────────────────
// // ── Plan limits matching UpgradePage exactly ─────────────────
// // Free:          100 tokens/month, 10 applies/month (first month only, then upgrade)
// // Pro monthly:   1000 tokens/month, 100 applies/month — ₹299
// // Pro+ monthly:  2000 tokens/month, 200 applies/month — ₹499
// // Pro yearly:    Unlimited tokens + applies — ₹2999
// // Pro+ yearly:   Unlimited tokens + applies — ₹5999
// const CREATOR_PLANS: Record<string, { label: string; appliesPerMonth: number | "unlimited"; tokens: number | "unlimited"; tokensPerApply: number; freeTrialOnly?: boolean }> = {
//   free:          { label: "Free",  appliesPerMonth: 10,          tokens: 100,          tokensPerApply: 10, freeTrialOnly: true },
//   pro:           { label: "Pro",   appliesPerMonth: 100,         tokens: 1000,         tokensPerApply: 10 },
//   pro_plus:      { label: "Pro+",  appliesPerMonth: 200,         tokens: 2000,         tokensPerApply: 10 },
//   pro_year:      { label: "Pro",   appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
//   pro_plus_year: { label: "Pro+",  appliesPerMonth: "unlimited", tokens: "unlimited",  tokensPerApply: 0  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// function ApplyPageInner() {
//   const router = useRouter();

//   // Read campaignId from URL without useSearchParams
//   const campaignId = typeof window !== "undefined"
//     ? new URLSearchParams(window.location.search).get("id") || ""
//     : "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   // Plan state
//   const [bits, setBits]               = useState<number>(0);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [activePlan, setActivePlan]   = useState<string>("free");
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);

//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);

//     // Plan info
//     const subbed = parsed.isSubscribed ?? false;
//     const plan   = toCanonical(parsed.activePlan || "free");
//     setIsSubscribed(subbed);
//     setActivePlan(subbed ? plan : "free");
//     setBits(parsed.bits ?? 0);

//     // Fetch applies used this month
//     fetchAppliesUsed(t);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchAppliesUsed = async (t: string) => {
//     try {
//       const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
//       if (!res.ok) return;
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const list: any[] = data.applications || data.data || [];
//       const now  = new Date();
//       const thisMonth = list.filter((a: any) => {
//         const d = new Date(a.createdAt || a.appliedAt || 0);
//         return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
//       });
//       setAppliesUsed(thisMonth.length);
//     } catch { /* silent */ }
//   };

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }

//     const planInfo    = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//     const isUnlimited = planInfo.appliesPerMonth === "unlimited";
//     const limit       = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//     const cost        = planInfo.tokensPerApply;

//     // Check monthly apply limit
//     if (!isUnlimited && appliesUsed >= limit) {
//       setShowModal(false);
//       showToast(`Monthly apply limit reached (${limit}/${limit}). Upgrade your plan!`, "error");
//       return;
//     }

//     // Check token balance (only if cost > 0)
//     if (cost > 0 && bits < cost) {
//       setShowModal(false);
//       showToast(`Not enough tokens. Need ${cost} tokens to apply.`, "error");
//       return;
//     }

//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       // Deduct tokens if cost > 0
//       if (cost > 0) {
//         const newBits = Math.max(0, bits - cost);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: newBits }));
//       }

//       // Update applies used
//       setAppliesUsed(prev => prev + 1);

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   // ── Derived plan info ──────────────────────────────────────────
//   const planInfo     = CREATOR_PLANS[activePlan] || CREATOR_PLANS["free"];
//   const isUnlimited  = planInfo.appliesPerMonth === "unlimited";
//   const monthlyLimit = isUnlimited ? Infinity : (planInfo.appliesPerMonth as number);
//   const appliesLeft  = isUnlimited ? Infinity : Math.max(0, monthlyLimit - appliesUsed);
//   const costPerApply = planInfo.tokensPerApply;
//   const canApply     = isUnlimited
//     ? true
//     : appliesLeft > 0 && (costPerApply === 0 || bits >= costPerApply);
//   const isLow        = !isUnlimited && appliesLeft <= 3 && appliesLeft > 0;
//   const barPct       = isUnlimited ? 100 : Math.min(100, (bits / 100) * 100);
//   const barColor     = bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all .2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}

//         /* Plan box */
//         .cd-plan-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-plan-box.unlimited{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-plan-box.warn{background:#fffbeb;border-color:#fde68a}
//         .cd-plan-box.danger{background:#fff5f5;border-color:#fecaca}
//         .cd-plan-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
//         .cd-plan-label{font-size:12px;color:#999}
//         .cd-plan-val{font-size:14px;font-weight:700}
//         .cd-plan-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:5px}
//         .cd-plan-fill{height:100%;border-radius:100px;transition:width .4s}
//         .cd-plan-hint{font-size:11px;color:#bbb}
//         .cd-plan-divider{height:1px;background:#f0f0f0;margin:8px 0}
//         .cd-applies-row{display:flex;justify-content:space-between;align-items:center}
//         .cd-applies-label{font-size:12px;color:#999}
//         .cd-applies-val{font-size:13px;font-weight:700}

//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all .2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}

//         /* Modal */
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn .2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up .25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color .2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color .2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all .2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn .3s ease;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? 16 : 0 }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: 14 }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               {/* ── Plan-based token/apply box ── */}
//               <div className={`cd-plan-box ${isUnlimited ? "unlimited" : appliesLeft === 0 ? "danger" : isLow ? "warn" : ""}`}>

//                 {/* Tokens row (only if cost > 0) */}
//                 {costPerApply > 0 && (
//                   <>
//                     <div className="cd-plan-row">
//                       <span className="cd-plan-label">🪙 Tokens remaining</span>
//                       <span className="cd-plan-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                     </div>
//                     <div className="cd-plan-bar">
//                       <div className="cd-plan-fill" style={{ width: `${barPct}%`, background: barColor }} />
//                     </div>
//                     <div className="cd-plan-hint">{costPerApply} tokens per apply · {planInfo.label} plan</div>
//                     <div className="cd-plan-divider" />
//                   </>
//                 )}

//                 {/* Applies row */}
//                 <div className="cd-applies-row">
//                   <span className="cd-applies-label">📩 Applies this month</span>
//                   <span className="cd-applies-val" style={{ color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#16a34a" }}>
//                     {isUnlimited
//                       ? <span style={{ color: "#16a34a" }}>∞ Unlimited</span>
//                       : `${appliesUsed} / ${monthlyLimit}`}
//                   </span>
//                 </div>

//                 {!isUnlimited && (
//                   <div style={{ marginTop: 6, fontSize: 11, color: appliesLeft === 0 ? "#ef4444" : isLow ? "#d97706" : "#bbb" }}>
//                     {appliesLeft === 0
//                       ? planInfo.freeTrialOnly
//                         ? "Free trial limit reached — upgrade to keep applying"
//                         : "Monthly limit reached — upgrade to apply more"
//                       : isLow
//                       ? `Only ${appliesLeft} applies left this month`
//                       : planInfo.freeTrialOnly
//                         ? `${appliesLeft} applies left in free trial · Upgrade for more`
//                         : `${appliesLeft} applies remaining · ${planInfo.label} plan`}
//                   </div>
//                 )}

//                 {isUnlimited && (
//                   <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a" }}>
//                     {planInfo.label} yearly plan — unlimited applies
//                   </div>
//                 )}
//               </div>

//               {/* Apply button */}
//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: 12 }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !canApply ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   {appliesLeft === 0
//                     ? planInfo.freeTrialOnly
//                       ? "🚫 Free trial ended — Upgrade Plan"
//                       : "🚫 Apply limit reached — Upgrade"
//                     : "🪙 Not enough tokens — Upgrade"}
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now →{costPerApply > 0 ? ` (${costPerApply} 🪙)` : ""}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} · {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: 16 }}>
//               <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 16, fontWeight: 600 }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: 32, height: 48 }}
//                 placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`}
//                 value={bidAmount} min="1"
//                 onChange={e => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..."
//               value={proposal}
//               onChange={e => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}

//             {/* Cost summary in modal */}
//             {costPerApply > 0 && (
//               <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 10, padding: "10px 14px", marginTop: 12, fontSize: 13, color: "#555", display: "flex", justifyContent: "space-between" }}>
//                 <span>Token cost</span>
//                 <strong style={{ color: "#4f46e5" }}>−{costPerApply} 🪙</strong>
//               </div>
//             )}

//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : `Submit Application${costPerApply > 0 ? ` (−${costPerApply} 🪙)` : ""} →`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );




// "use client";

// import { useEffect, useState, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// function ApplyPageInner() {
//   const router       = useRouter();
//   const searchParams = useSearchParams();
//   const campaignId   = searchParams.get("id") || "";

//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [applying, setApplying]           = useState(false);
//   const [applied, setApplied]             = useState(false);
//   const [token, setToken]                 = useState("");
//   const [showModal, setShowModal]         = useState(false);
//   const [proposal, setProposal]           = useState("");
//   const [bidAmount, setBidAmount]         = useState("");
//   const [proposalError, setProposalError] = useState("");
//   const [bits, setBits]                   = useState<number>(100);
//   const [isSubscribed, setIsSubscribed]   = useState<boolean>(false);
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.coins !== undefined) {
//       delete parsed.coins;
//       localStorage.setItem("cb_user", JSON.stringify(parsed));
//     }
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (campaignId && appliedList.includes(campaignId)) setApplied(true);
//     setBits(parsed.bits ?? 100);
//     setIsSubscribed(parsed.isSubscribed ?? false);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const c    = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) { setProposalError("Please enter your bid amount"); return; }
//     if (proposal.trim().length < 20) { setProposalError("Proposal must be at least 20 characters"); return; }
//     if (!isSubscribed && bits < 10) {
//       setShowModal(false);
//       showToast("Not enough coins to apply. Please upgrade!", "error");
//       return;
//     }
//     setProposalError("");
//     try {
//       setApplying(true);
//       const res  = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       if (!res.ok) { showToast(data.message || "Apply failed", "error"); return; }

//       if (!isSubscribed) {
//         const newBits = Math.max(0, bits - 10);
//         setBits(newBits);
//         const stored  = localStorage.getItem("cb_user");
//         const p       = stored ? JSON.parse(stored) : {};
//         const updated = { ...p, bits: newBits };
//         delete updated.coins;
//         localStorage.setItem("cb_user", JSON.stringify(updated));
//       }

//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setShowModal(false);
//       // ✅ Seedha /discovery — koi conflict nahi
//       router.push("/discovery");
//     } catch {
//       showToast("Network error. Please try again.", "error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: "36px", height: "36px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: "16px" }}>
//       <div style={{ fontSize: "48px" }}>🔍</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Campaign not found</h2>
//       <button onClick={() => router.push("/discovery")} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
//         .cd-back:hover{background:#f4f4f4}
//         .cd-bar-title{font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px}
//         @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-coins-box{border-radius:12px;padding:14px;margin-top:16px;border:1px solid #f0f0f0;background:#fafafa}
//         .cd-coins-box.pro{background:#f0fdf4;border-color:#bbf7d0}
//         .cd-coins-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
//         .cd-coins-label{font-size:12px;color:#999}
//         .cd-coins-val{font-size:16px;font-weight:700}
//         .cd-coins-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:6px}
//         .cd-coins-fill{height:100%;border-radius:100px;transition:width 0.4s}
//         .cd-coins-hint{font-size:11px;color:#bbb}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover:not(:disabled){background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0!important;cursor:default!important}
//         .cd-no-coins-btn{background:#fff5f5!important;color:#ef4444!important;border:1.5px solid #fecaca!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn 0.2s}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;animation:up 0.25s ease}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px}}
//         .cd-modal-title{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:7px}
//         .cd-input{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;transition:border-color 0.2s}
//         .cd-input:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color 0.2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#4f46e5;background:#fff}
//         .cd-textarea::placeholder,.cd-input::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif}
//         .cd-cancel:hover{background:#eee;color:#555}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all 0.2s}
//         .cd-submit:hover:not(:disabled){background:#4338ca}
//         .cd-submit:disabled{opacity:0.4;cursor:not-allowed}
//         .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.12)}
//         .cd-toast.success{background:#111;color:#fff}
//         .cd-toast.error{background:#ef4444;color:#fff}
//         .cd-toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cd">
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.push("/discovery")}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           <div className="cd-left">
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${campaign.status === "completed" ? "cd-badge-completed" : campaign.status === "ongoing" ? "cd-badge-ongoing" : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>
//               <div className="cd-metas">
//                 {campaign.city   && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>
//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{ marginBottom: campaign.roles?.length ? "16px" : "0" }}>
//                     {campaign.categories.map((cat: string, i: number) => <span key={i} className="cd-tag">{cat}</span>)}
//                   </div>
//                 </>
//               )}
//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{ marginTop: "14px" }}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => <span key={i} className="cd-tag cd-tag-role">{r}</span>)}
//                   </div>
//                 </>
//               )}
//             </div>
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           <div className="cd-side">
//             <div className="cd-card">
//               <div className="cd-budget-label">Total Budget</div>
//               <div className="cd-budget-num">₹{(campaign.budget || 0).toLocaleString()}</div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Location</span>
//                 <span className="cd-info-val">{campaign.city ? campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1) : "—"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Status</span>
//                 <span className="cd-info-val">{campaign.status || "Open"}</span>
//               </div>
//               <div className="cd-info-row">
//                 <span className="cd-info-label">Applicants</span>
//                 <span className="cd-info-val">{campaign.applicationsCount || 0}</span>
//               </div>

//               {isSubscribed ? (
//                 <div className="cd-coins-box pro">
//                   <span style={{ fontSize: "13px", color: "#16a34a", fontWeight: 600 }}>✓ Pro Plan — Unlimited applies</span>
//                 </div>
//               ) : (
//                 <div className="cd-coins-box">
//                   <div className="cd-coins-row">
//                     <span className="cd-coins-label">🪙 Coins remaining</span>
//                     <span className="cd-coins-val" style={{ color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111" }}>{bits}</span>
//                   </div>
//                   <div className="cd-coins-bar">
//                     <div className="cd-coins-fill" style={{ width: `${Math.min(100, (bits / 100) * 100)}%`, background: bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5" }} />
//                   </div>
//                   <div className="cd-coins-hint">10 coins required to apply</div>
//                 </div>
//               )}

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box" style={{ marginTop: "12px" }}>
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : campaign.status === "completed" ? (
//                 <button className="cd-apply-btn" disabled>Campaign Closed</button>
//               ) : !isSubscribed && bits < 10 ? (
//                 <button className="cd-apply-btn cd-no-coins-btn" onClick={() => router.push("/upgrade")}>
//                   🪙 Not enough coins — Upgrade
//                 </button>
//               ) : (
//                 <button className="cd-apply-btn" onClick={() => setShowModal(true)}>
//                   Apply Now {!isSubscribed ? "→ (10 🪙)" : "→"}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {showModal && (
//         <div className="cd-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>
//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} • {campaign.city || "—"}</div>
//             </div>
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{ position: "relative", marginBottom: "16px" }}>
//               <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: "16px", fontWeight: "600" }}>₹</span>
//               <input type="number" className="cd-input" style={{ paddingLeft: "32px", height: "48px" }} placeholder={`Campaign budget: ₹${(campaign.budget || 0).toLocaleString()}`} value={bidAmount} min="1" onChange={(e) => { setBidAmount(e.target.value); setProposalError(""); }} />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}
//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea className="cd-textarea" rows={6} placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring..." value={proposal} onChange={(e) => { setProposal(e.target.value); setProposalError(""); }} />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}
//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>{applying ? "Submitting..." : "Submit Application →"}</button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function ApplyPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//         <div style={{ width: "36px", height: "36px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <ApplyPageInner />
//     </Suspense>
//   );
// }