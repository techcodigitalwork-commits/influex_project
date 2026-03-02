"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

function CampaignDetailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("id") || "";

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [token, setToken] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [proposal, setProposal] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [proposalError, setProposalError] = useState("");
  const [bits, setBits] = useState<number>(100);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);

  const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
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
    const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
    setInfluencerId(id);

    // Check already applied
    const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
    if (appliedList.includes(searchParams?.get('id') || '')) setApplied(true);

    // ✅ Bits & subscription fetch
    fetch(`${API}/profile/me`, { headers: { Authorization: `Bearer ${t}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.profile) {
          setBits(data.profile.bits ?? 100);
          setIsSubscribed(data.profile.isSubscribed ?? false);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !campaignId) return;
    fetchCampaign();
  }, [token, campaignId]);

  const fetchCampaign = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/campaigns/${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log("CAMPAIGN DETAIL:", data);
      const c = data.campaign || data.data || data;
      setCampaign(c);
      if (c?.hasApplied || c?.applied) setApplied(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!bidAmount || Number(bidAmount) <= 0) {
      setProposalError("Please enter your bid amount");
      return;
    }
    if (proposal.trim().length < 20) {
      setProposalError("Kam se kam 20 characters likhein");
      return;
    }

    // ✅ Bits check — 10 bits per apply
    if (!isSubscribed && bits < 10) {
      setShowModal(false);
      showToast("Bits khatam! Upgrade karo 🪙", "error");
      setTimeout(() => router.push("/upgrade"), 1500);
      return;
    }

    setProposalError("");
    try {
      setApplying(true);
      const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ influencerId, proposal, bidAmount: Number(bidAmount) }),
      });
      const data = await res.json();
      console.log("APPLY:", data);
      if (!res.ok) {
        if (res.status === 403 || data.message?.toLowerCase().includes("bit")) {
          showToast(data.message || "Bits khatam! Upgrade karo 🪙", "error");
          setTimeout(() => router.push("/upgrade"), 1500);
          return;
        }
        showToast(data.message || "Apply failed ❌", "error");
        return;
      }

      // ✅ Bits deduct locally
      if (!isSubscribed) {
        const newBits = bits - 10;
        setBits(newBits);
        const stored = localStorage.getItem("cb_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: newBits }));
        }
      }

      // Permanently save applied state
      const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      list.push(campaignId);
      localStorage.setItem("appliedCampaigns", JSON.stringify(list));

      setApplied(true);
      setShowModal(false);
      showToast("Applied successfully! 🎉", "success");

      // ✅ 2 seconds baad discovery page pe wapas jao
      setTimeout(() => router.push("/campaigns/discovery"), 2000);
    } catch (err) {
      showToast("Network error ❌", "error");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0"}}>
      <div style={{width:"36px",height:"36px",border:"3px solid #e0e0e0",borderTopColor:"#111",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!campaign) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0",flexDirection:"column",gap:"16px"}}>
      <div style={{fontSize:"48px"}}>🔍</div>
      <h2 style={{fontFamily:"Syne,sans-serif",color:"#111"}}>Campaign not found</h2>
      <button onClick={() => router.back()} style={{padding:"10px 24px",background:"#111",color:"#fff",border:"none",borderRadius:"10px",cursor:"pointer"}}>Go Back</button>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
        .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
        .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;transition:all 0.2s;display:flex;align-items:center;justify-content:center}
        .cd-back:hover{background:#f4f4f4;border-color:#ddd}
        .cd-bar-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:700;color:#111}
        .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
        @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
        @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
        .cd-left{display:flex;flex-direction:column;gap:16px}
        .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px} @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
        .cd-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
        @media(max-width:480px){.cd-title{font-size:20px}}
        .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
        .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
        .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
        .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
        .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
        .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px} @media(max-width:480px){.cd-metas{gap:8px}}
        .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
        .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;display:block}
        .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
        .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
        .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
        .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
        .cd-sep{height:1px;background:#f0f0f0;margin:16px 0}
        /* SIDEBAR */
        .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
        @media(max-width:768px){.cd-side{position:static}}
        .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
        .cd-budget-num{font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
        .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
        .cd-info-row:last-of-type{border-bottom:none}
        .cd-info-label{font-size:13px;color:#aaa}
        .cd-info-val{font-size:13px;font-weight:600;color:#111}
        .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:#4f46e5;color:#fff;margin-top:16px}
        .cd-apply-btn:hover{background:#4338ca;transform:translateY(-1px)}
        .cd-apply-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0;cursor:default!important;transform:none!important}
        .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
        .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
        .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
        /* MODAL */
        .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn 0.2s}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;animation:up 0.25s ease}
        @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px;margin:0 4px}} .cd-modal{max-height:90vh;overflow-y:auto}
        .cd-modal-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
        .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
        .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
        .cd-modal-campaign-name{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
        .cd-modal-campaign-meta{font-size:13px;color:#777}
        .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:7px}
        .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color 0.2s;line-height:1.6}
        .cd-textarea:focus{border-color:#111;background:#fff}
        .cd-textarea::placeholder{color:#c0c0c0}
        .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
        .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
        .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
        .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;transition:all 0.2s}
        .cd-cancel:hover{color:#555;background:#eee}
        .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all 0.2s}
        .cd-submit:hover{background:#4338ca}
        .cd-submit:disabled{opacity:0.4;cursor:not-allowed}
        /* Toast */
        .cd-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;font-family:'Plus Jakarta Sans',sans-serif;z-index:99999;white-space:nowrap;animation:toastIn 0.3s ease;box-shadow:0 4px 20px rgba(0,0,0,0.12);}
        .cd-toast.success{background:#111;color:#fff}
        .cd-toast.error{background:#ef4444;color:#fff}
        .cd-toast.warn{background:#f59e0b;color:#fff}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        /* Bits bar */
        .cd-bits-box{background:#fafafa;border:1px solid #f0f0f0;border-radius:12px;padding:14px;margin-bottom:16px}
        .cd-bits-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
        .cd-bits-label{font-size:12px;color:#999}
        .cd-bits-val{font-size:16px;font-weight:700;color:#111}
        .cd-bits-bar{height:5px;background:#f0f0f0;border-radius:100px;overflow:hidden;margin-bottom:6px}
        .cd-bits-fill{height:100%;border-radius:100px;transition:width 0.4s}
        .cd-bits-hint{font-size:11px;color:#bbb}
      `}</style>

      {toast && <div className={`cd-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cd">
        {/* TOP BAR */}
        <div className="cd-bar">
          <button className="cd-back" onClick={() => router.back()}>←</button>
          <span className="cd-bar-title">Campaign Details</span>
        </div>

        <div className="cd-wrap">
          {/* LEFT */}
          <div className="cd-left">

            {/* Title + Status */}
            <div className="cd-card">
              <div className="cd-title-row">
                <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
                <span className={`cd-badge ${
                  campaign.status === "completed" ? "cd-badge-completed"
                  : campaign.status === "ongoing" ? "cd-badge-ongoing"
                  : "cd-badge-open"}`}>
                  {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
                </span>
              </div>

              <div className="cd-metas">
                {campaign.city && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
                {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
                {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
              </div>

              {campaign.categories?.length > 0 && (
                <>
                  <span className="cd-sec-label">Categories</span>
                  <div className="cd-tags" style={{marginBottom: campaign.roles?.length ? "16px" : "0"}}>
                    {campaign.categories.map((cat: string, i: number) => (
                      <span key={i} className="cd-tag">{cat}</span>
                    ))}
                  </div>
                </>
              )}

              {campaign.roles?.length > 0 && (
                <>
                  <span className="cd-sec-label" style={{marginTop:"14px"}}>Looking For</span>
                  <div className="cd-tags">
                    {campaign.roles.map((r: string, i: number) => (
                      <span key={i} className="cd-tag cd-tag-role">{r}</span>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            {campaign.description && (
              <div className="cd-card">
                <span className="cd-sec-label">About This Campaign</span>
                <p className="cd-desc">{campaign.description}</p>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
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

              {/* ✅ Bits indicator */}
              {!isSubscribed && (
                <div className="cd-bits-box">
                  <div className="cd-bits-row">
                    <span className="cd-bits-label">🪙 Bits remaining</span>
                    <span className="cd-bits-val" style={{color: bits <= 10 ? "#ef4444" : bits <= 30 ? "#d97706" : "#111"}}>{bits}</span>
                  </div>
                  <div className="cd-bits-bar">
                    <div className="cd-bits-fill" style={{
                      width: `${Math.min(100, (bits/100)*100)}%`,
                      background: bits <= 10 ? "#ef4444" : bits <= 30 ? "#f59e0b" : "#4f46e5"
                    }} />
                  </div>
                  <div className="cd-bits-hint">Apply karne pe 10 bits lagenge</div>
                </div>
              )}
              {isSubscribed && (
                <div className="cd-bits-box" style={{background:"#f0fdf4",border:"1px solid #bbf7d0"}}>
                  <span style={{fontSize:"13px",color:"#16a34a",fontWeight:600}}>✓ Pro Plan — Unlimited applies</span>
                </div>
              )}

              {applied ? (
                <>
                  <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
                  <div className="cd-success-box">
                    <span>🎉</span>
                    <span className="cd-success-text">Application submitted!</span>
                  </div>
                  <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
                </>
              ) : (
                <button
                  className="cd-apply-btn"
                  onClick={() => {
                    if (!isSubscribed && bits < 10) {
                      showToast("Bits khatam! Upgrade karo 🪙", "error");
                      setTimeout(() => router.push("/upgrade"), 1500);
                      return;
                    }
                    setShowModal(true);
                  }}
                  disabled={campaign.status === "completed"}
                >
                  {campaign.status === "completed"
                    ? "Campaign Closed"
                    : !isSubscribed && bits < 10
                      ? "🪙 Bits khatam — Upgrade karo"
                      : `Apply Now → ${!isSubscribed ? "(10 🪙)" : ""}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* APPLY MODAL */}
      {showModal && (
        <div className="cd-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="cd-modal">
            <h2 className="cd-modal-title">Apply to Campaign</h2>
            <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>

            <div className="cd-modal-preview">
              <div className="cd-modal-campaign-name">{campaign.title}</div>
              <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} • {campaign.city || "—"}</div>
            </div>

            {/* BID AMOUNT */}
            <label className="cd-modal-label">Your Bid Amount (₹)</label>
            <div style={{position:"relative",marginBottom:"16px"}}>
              <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:"16px",fontWeight:"600"}}>₹</span>
              <input
                type="number"
                className="cd-textarea"
                style={{paddingLeft:"32px",height:"48px",resize:"none"}}
                placeholder={`Campaign budget: ₹${(campaign.budget||0).toLocaleString()}`}
                value={bidAmount}
                min="1"
                onChange={(e) => { setBidAmount(e.target.value); setProposalError(""); }}
              />
            </div>
            {bidAmount && Number(bidAmount) > 0 && (
              <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"10px",padding:"10px 14px",marginBottom:"16px",fontSize:"13px",color:"#16a34a",fontWeight:"600"}}>
                💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
              </div>
            )}

            <label className="cd-modal-label">Your Proposal</label>
            <textarea
              className="cd-textarea"
              rows={6}
              placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring to this campaign..."
              value={proposal}
              onChange={(e) => { setProposal(e.target.value); setProposalError(""); }}
            />
            <div className="cd-char">{proposal.length} characters</div>
            {proposalError && <p className="cd-err">{proposalError}</p>}

            <div className="cd-modal-btns">
              <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="cd-submit" onClick={handleApply} disabled={applying}>
                {applying ? "Submitting..." : "Submit Application →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CampaignDetail() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0"}}>
        <div style={{width:"36px",height:"36px",border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <CampaignDetailInner />
    </Suspense>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function CampaignDetail() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const campaignId = searchParams.get("id") || "";

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [applying, setApplying] = useState(false);
//   const [applied, setApplied] = useState(false);
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");
//   const [showModal, setShowModal] = useState(false);
//   const [proposal, setProposal] = useState("");
//   const [bidAmount, setBidAmount] = useState("");
//   const [proposalError, setProposalError] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);

//     // Check already applied
//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (appliedList.includes(searchParams?.get('id') || '')) setApplied(true);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/campaigns/${campaignId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CAMPAIGN DETAIL:", data);
//       const c = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) {
//       setProposalError("Please enter your bid amount");
//       return;
//     }
//     if (proposal.trim().length < 20) {
//       setProposalError("✅ Write at least 20 characters.");
//       return;
//     }
//     setProposalError("");
//     try {
//       setApplying(true);
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ influencerId, proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       console.log("APPLY:", data);
//       if (!res.ok) { alert(data.message || "Apply failed"); return; }

//       // Permanently save applied state
//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setApplied(true);
//       setShowModal(false);
//     } catch (err) {
//       alert("Network error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0"}}>
//       <div style={{width:"36px",height:"36px",border:"3px solid #e0e0e0",borderTopColor:"#111",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0",flexDirection:"column",gap:"16px"}}>
//       <div style={{fontSize:"48px"}}>🔍</div>
//       <h2 style={{fontFamily:"Syne,sans-serif",color:"#111"}}>Campaign not found</h2>
//       <button onClick={() => router.back()} style={{padding:"10px 24px",background:"#111",color:"#fff",border:"none",borderRadius:"10px",cursor:"pointer"}}>Go Back</button>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .cd{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;transition:all 0.2s;display:flex;align-items:center;justify-content:center}
//         .cd-back:hover{background:#f4f4f4;border-color:#ddd}
//         .cd-bar-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:900px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         @media(max-width:480px){.cd-wrap{padding:12px;gap:12px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:20px} @media(max-width:480px){.cd-card{padding:16px;border-radius:14px}}
//         .cd-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:22px;font-weight:800;color:#111;line-height:1.3;margin-bottom:14px}
//         @media(max-width:480px){.cd-title{font-size:20px}}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px} @media(max-width:480px){.cd-metas{gap:8px}}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-sep{height:1px;background:#f0f0f0;margin:16px 0}
//         /* SIDEBAR */
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-family:'Plus Jakarta Sans',sans-serif;font-size:28px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover{background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0;cursor:default!important;transform:none!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         /* MODAL */
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn 0.2s}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;animation:up 0.25s ease}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @media(max-width:480px){.cd-modal{padding:16px;border-radius:16px;margin:0 4px}} .cd-modal{max-height:90vh;overflow-y:auto}
//         .cd-modal-title{font-family:'Plus Jakarta Sans',sans-serif;font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:7px}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color 0.2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#111;background:#fff}
//         .cd-textarea::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;transition:all 0.2s}
//         .cd-cancel:hover{color:#555;background:#eee}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:all 0.2s}
//         .cd-submit:hover{background:#4338ca}
//         .cd-submit:disabled{opacity:0.4;cursor:not-allowed}
//       `}</style>

//       <div className="cd">
//         {/* TOP BAR */}
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.back()}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           {/* LEFT */}
//           <div className="cd-left">

//             {/* Title + Status */}
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${
//                   campaign.status === "completed" ? "cd-badge-completed"
//                   : campaign.status === "ongoing" ? "cd-badge-ongoing"
//                   : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>

//               <div className="cd-metas">
//                 {campaign.city && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>

//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{marginBottom: campaign.roles?.length ? "16px" : "0"}}>
//                     {campaign.categories.map((cat: string, i: number) => (
//                       <span key={i} className="cd-tag">{cat}</span>
//                     ))}
//                   </div>
//                 </>
//               )}

//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{marginTop:"14px"}}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => (
//                       <span key={i} className="cd-tag cd-tag-role">{r}</span>
//                     ))}
//                   </div>
//                 </>
//               )}
//             </div>

//             {/* Description */}
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           {/* RIGHT SIDEBAR */}
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

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box">
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : (
//                 <button
//                   className="cd-apply-btn"
//                   onClick={() => setShowModal(true)}
//                   disabled={campaign.status === "completed"}
//                 >
//                   {campaign.status === "completed" ? "Campaign Closed" : "Apply Now →"}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* APPLY MODAL */}
//       {showModal && (
//         <div className="cd-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>

//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} • {campaign.city || "—"}</div>
//             </div>

//             {/* BID AMOUNT */}
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{position:"relative",marginBottom:"16px"}}>
//               <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:"16px",fontWeight:"600"}}>₹</span>
//               <input
//                 type="number"
//                 className="cd-textarea"
//                 style={{paddingLeft:"32px",height:"48px",resize:"none"}}
//                 placeholder={`Campaign budget: ₹${(campaign.budget||0).toLocaleString()}`}
//                 value={bidAmount}
//                 min="1"
//                 onChange={(e) => { setBidAmount(e.target.value); setProposalError(""); }}
//               />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"10px",padding:"10px 14px",marginBottom:"16px",fontSize:"13px",color:"#16a34a",fontWeight:"600"}}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}

//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea
//               className="cd-textarea"
//               rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring to this campaign..."
//               value={proposal}
//               onChange={(e) => { setProposal(e.target.value); setProposalError(""); }}
//             />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}

//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : "Submit Application →"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function CampaignDetail() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const campaignId = searchParams.get("id") || "";

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [applying, setApplying] = useState(false);
//   const [applied, setApplied] = useState(false);
//   const [token, setToken] = useState("");
//   const [influencerId, setInfluencerId] = useState("");
//   const [showModal, setShowModal] = useState(false);
//   const [proposal, setProposal] = useState("");
//   const [bidAmount, setBidAmount] = useState("");
//   const [proposalError, setProposalError] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed.user?.id || parsed._id || parsed.id || parsed.influencerId;
//     setInfluencerId(id);

//     // Check already applied
//     const appliedList = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//     if (appliedList.includes(searchParams?.get('id') || '')) setApplied(true);
//   }, []);

//   useEffect(() => {
//     if (!token || !campaignId) return;
//     fetchCampaign();
//   }, [token, campaignId]);

//   const fetchCampaign = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/campaigns/${campaignId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CAMPAIGN DETAIL:", data);
//       const c = data.campaign || data.data || data;
//       setCampaign(c);
//       if (c?.hasApplied || c?.applied) setApplied(true);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleApply = async () => {
//     if (!bidAmount || Number(bidAmount) <= 0) {
//       setProposalError("Please enter your bid amount");
//       return;
//     }
//     if (proposal.trim().length < 20) {
//       setProposalError("Kam se kam 20 characters likhein");
//       return;
//     }
//     setProposalError("");
//     try {
//       setApplying(true);
//       const res = await fetch(`${API}/campaigns/${campaignId}/apply`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ influencerId, proposal, bidAmount: Number(bidAmount) }),
//       });
//       const data = await res.json();
//       console.log("APPLY:", data);
//       if (!res.ok) { alert(data.message || "Apply failed"); return; }

//       // Permanently save applied state
//       const list = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
//       list.push(campaignId);
//       localStorage.setItem("appliedCampaigns", JSON.stringify(list));

//       setApplied(true);
//       setShowModal(false);
//     } catch (err) {
//       alert("Network error");
//     } finally {
//       setApplying(false);
//     }
//   };

//   if (loading) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0"}}>
//       <div style={{width:"36px",height:"36px",border:"3px solid #e0e0e0",borderTopColor:"#111",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!campaign) return (
//     <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f5f0",flexDirection:"column",gap:"16px"}}>
//       <div style={{fontSize:"48px"}}>🔍</div>
//       <h2 style={{fontFamily:"Syne,sans-serif",color:"#111"}}>Campaign not found</h2>
//       <button onClick={() => router.back()} style={{padding:"10px 24px",background:"#111",color:"#fff",border:"none",borderRadius:"10px",cursor:"pointer"}}>Go Back</button>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .cd{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh}
//         .cd-bar{background:#fff;border-bottom:1px solid #ebebeb;padding:14px 24px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
//         .cd-back{background:none;border:1.5px solid #ebebeb;border-radius:8px;width:36px;height:36px;cursor:pointer;font-size:16px;color:#555;transition:all 0.2s;display:flex;align-items:center;justify-content:center}
//         .cd-back:hover{background:#f4f4f4;border-color:#ddd}
//         .cd-bar-title{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;color:#111}
//         .cd-wrap{max-width:1080px;margin:0 auto;padding:28px 24px;display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
//         @media(max-width:768px){.cd-wrap{grid-template-columns:1fr;padding:16px}}
//         .cd-left{display:flex;flex-direction:column;gap:16px}
//         .cd-card{background:#fff;border-radius:18px;border:1.5px solid #ebebeb;padding:24px}
//         .cd-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#111;line-height:1.25;margin-bottom:14px}
//         @media(max-width:480px){.cd-title{font-size:20px}}
//         .cd-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:16px}
//         .cd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700}
//         .cd-badge-open{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .cd-badge-ongoing{background:#fefce8;color:#ca8a04;border:1px solid #fde68a}
//         .cd-badge-completed{background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0}
//         .cd-metas{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:18px}
//         .cd-meta{display:flex;align-items:center;gap:5px;font-size:13px;color:#888}
//         .cd-sec-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:10px;display:block}
//         .cd-tags{display:flex;flex-wrap:wrap;gap:7px}
//         .cd-tag{padding:5px 13px;border-radius:100px;background:#f5f5f0;border:1px solid #e8e8e8;font-size:12px;color:#555}
//         .cd-tag-role{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
//         .cd-desc{color:#555;font-size:15px;line-height:1.8;white-space:pre-wrap}
//         .cd-sep{height:1px;background:#f0f0f0;margin:16px 0}
//         /* SIDEBAR */
//         .cd-side{display:flex;flex-direction:column;gap:16px;position:sticky;top:80px}
//         @media(max-width:768px){.cd-side{position:static}}
//         .cd-budget-label{font-size:12px;color:#aaa;margin-bottom:4px}
//         .cd-budget-num{font-family:'Syne',sans-serif;font-size:34px;font-weight:800;color:#111;margin-bottom:16px}
//         .cd-info-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f5f5f5}
//         .cd-info-row:last-of-type{border-bottom:none}
//         .cd-info-label{font-size:13px;color:#aaa}
//         .cd-info-val{font-size:13px;font-weight:600;color:#111}
//         .cd-apply-btn{width:100%;padding:15px;border-radius:12px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:#4f46e5;color:#fff;margin-top:16px}
//         .cd-apply-btn:hover{background:#4338ca;transform:translateY(-1px)}
//         .cd-apply-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}
//         .cd-applied-btn{background:#f0fdf4!important;color:#16a34a!important;border:1.5px solid #bbf7d0;cursor:default!important;transform:none!important}
//         .cd-success-box{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px;margin-top:12px}
//         .cd-success-text{font-size:13px;color:#16a34a;font-weight:600}
//         .cd-applied-note{font-size:12px;color:#aaa;text-align:center;margin-top:8px;line-height:1.5}
//         /* MODAL */
//         .cd-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:16px;animation:fadeIn 0.2s}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .cd-modal{background:#fff;border-radius:22px;padding:28px;width:100%;max-width:500px;animation:up 0.25s ease}
//         @keyframes up{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         @media(max-width:480px){.cd-modal{padding:20px;border-radius:18px}}
//         .cd-modal-title{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
//         .cd-modal-sub{font-size:13px;color:#aaa;margin-bottom:20px}
//         .cd-modal-preview{background:#f5f5f0;border-radius:10px;padding:12px 14px;margin-bottom:18px}
//         .cd-modal-campaign-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#111;margin-bottom:3px}
//         .cd-modal-campaign-meta{font-size:13px;color:#777}
//         .cd-modal-label{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:7px}
//         .cd-textarea{width:100%;padding:13px 15px;border-radius:12px;border:1.5px solid #ebebeb;background:#fafafa;font-size:14px;font-family:'DM Sans',sans-serif;color:#111;outline:none;resize:none;transition:border-color 0.2s;line-height:1.6}
//         .cd-textarea:focus{border-color:#111;background:#fff}
//         .cd-textarea::placeholder{color:#c0c0c0}
//         .cd-char{font-size:11px;color:#ccc;text-align:right;margin-top:4px}
//         .cd-err{font-size:12px;color:#ef4444;margin-top:5px}
//         .cd-modal-btns{display:flex;gap:10px;margin-top:18px}
//         .cd-cancel{flex:1;padding:13px;border-radius:11px;font-size:14px;color:#999;background:#f4f4f4;border:none;cursor:pointer;transition:all 0.2s}
//         .cd-cancel:hover{color:#555;background:#eee}
//         .cd-submit{flex:2;padding:13px;border-radius:11px;font-size:14px;font-weight:700;color:#fff;background:#4f46e5;border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.2s}
//         .cd-submit:hover{background:#4338ca}
//         .cd-submit:disabled{opacity:0.4;cursor:not-allowed}
//       `}</style>

//       <div className="cd">
//         {/* TOP BAR */}
//         <div className="cd-bar">
//           <button className="cd-back" onClick={() => router.back()}>←</button>
//           <span className="cd-bar-title">Campaign Details</span>
//         </div>

//         <div className="cd-wrap">
//           {/* LEFT */}
//           <div className="cd-left">

//             {/* Title + Status */}
//             <div className="cd-card">
//               <div className="cd-title-row">
//                 <h1 className="cd-title">{campaign.title || "Untitled"}</h1>
//                 <span className={`cd-badge ${
//                   campaign.status === "completed" ? "cd-badge-completed"
//                   : campaign.status === "ongoing" ? "cd-badge-ongoing"
//                   : "cd-badge-open"}`}>
//                   {(campaign.status || "open").charAt(0).toUpperCase() + (campaign.status || "open").slice(1)}
//                 </span>
//               </div>

//               <div className="cd-metas">
//                 {campaign.city && <span className="cd-meta">📍 {campaign.city.charAt(0).toUpperCase() + campaign.city.slice(1)}</span>}
//                 {campaign.budget && <span className="cd-meta">💰 ₹{campaign.budget.toLocaleString()}</span>}
//                 {campaign.applicationsCount !== undefined && <span className="cd-meta">👥 {campaign.applicationsCount} applicants</span>}
//               </div>

//               {campaign.categories?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label">Categories</span>
//                   <div className="cd-tags" style={{marginBottom: campaign.roles?.length ? "16px" : "0"}}>
//                     {campaign.categories.map((cat: string, i: number) => (
//                       <span key={i} className="cd-tag">{cat}</span>
//                     ))}
//                   </div>
//                 </>
//               )}

//               {campaign.roles?.length > 0 && (
//                 <>
//                   <span className="cd-sec-label" style={{marginTop:"14px"}}>Looking For</span>
//                   <div className="cd-tags">
//                     {campaign.roles.map((r: string, i: number) => (
//                       <span key={i} className="cd-tag cd-tag-role">{r}</span>
//                     ))}
//                   </div>
//                 </>
//               )}
//             </div>

//             {/* Description */}
//             {campaign.description && (
//               <div className="cd-card">
//                 <span className="cd-sec-label">About This Campaign</span>
//                 <p className="cd-desc">{campaign.description}</p>
//               </div>
//             )}
//           </div>

//           {/* RIGHT SIDEBAR */}
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

//               {applied ? (
//                 <>
//                   <button className="cd-apply-btn cd-applied-btn" disabled>✓ Already Applied</button>
//                   <div className="cd-success-box">
//                     <span>🎉</span>
//                     <span className="cd-success-text">Application submitted!</span>
//                   </div>
//                   <p className="cd-applied-note">Brand will review your profile and contact you soon.</p>
//                 </>
//               ) : (
//                 <button
//                   className="cd-apply-btn"
//                   onClick={() => setShowModal(true)}
//                   disabled={campaign.status === "completed"}
//                 >
//                   {campaign.status === "completed" ? "Campaign Closed" : "Apply Now →"}
//                 </button>
//               )}
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* APPLY MODAL */}
//       {showModal && (
//         <div className="cd-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
//           <div className="cd-modal">
//             <h2 className="cd-modal-title">Apply to Campaign</h2>
//             <p className="cd-modal-sub">Tell the brand why you're the perfect fit</p>

//             <div className="cd-modal-preview">
//               <div className="cd-modal-campaign-name">{campaign.title}</div>
//               <div className="cd-modal-campaign-meta">₹{(campaign.budget || 0).toLocaleString()} • {campaign.city || "—"}</div>
//             </div>

//             {/* BID AMOUNT */}
//             <label className="cd-modal-label">Your Bid Amount (₹)</label>
//             <div style={{position:"relative",marginBottom:"16px"}}>
//               <span style={{position:"absolute",left:"14px",top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:"16px",fontWeight:"600"}}>₹</span>
//               <input
//                 type="number"
//                 className="cd-textarea"
//                 style={{paddingLeft:"32px",height:"48px",resize:"none"}}
//                 placeholder={`Campaign budget: ₹${(campaign.budget||0).toLocaleString()}`}
//                 value={bidAmount}
//                 min="1"
//                 onChange={(e) => { setBidAmount(e.target.value); setProposalError(""); }}
//               />
//             </div>
//             {bidAmount && Number(bidAmount) > 0 && (
//               <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:"10px",padding:"10px 14px",marginBottom:"16px",fontSize:"13px",color:"#16a34a",fontWeight:"600"}}>
//                 💰 You will receive ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString()} (after 10% platform fee)
//               </div>
//             )}

//             <label className="cd-modal-label">Your Proposal</label>
//             <textarea
//               className="cd-textarea"
//               rows={6}
//               placeholder="Describe why you're the best fit. Share your experience, audience, and what value you'll bring to this campaign..."
//               value={proposal}
//               onChange={(e) => { setProposal(e.target.value); setProposalError(""); }}
//             />
//             <div className="cd-char">{proposal.length} characters</div>
//             {proposalError && <p className="cd-err">{proposalError}</p>}

//             <div className="cd-modal-btns">
//               <button className="cd-cancel" onClick={() => setShowModal(false)}>Cancel</button>
//               <button className="cd-submit" onClick={handleApply} disabled={applying}>
//                 {applying ? "Submitting..." : "Submit Application →"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }