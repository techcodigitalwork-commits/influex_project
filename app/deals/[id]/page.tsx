"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

function CreateDealPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

  const [form, setForm] = useState({
    campaignId: "",
    creatorId: "",
    creatorName: "",
    title: "",
    amount: "",
    description: "",
    deadline: "",
    deliverables: [""],
  });

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/deals"); return; }
    setToken(parsed.token);
    fetchCampaigns(parsed.token).then(() => {
      // Prefill from URL params after campaigns load
      const campId    = searchParams?.get("campaignId") || "";
      const creatorId = searchParams?.get("creatorId")  || "";
      if (campId) {
        setForm(f => ({ ...f, campaignId: campId }));
        fetchApplications(campId, parsed.token).then(() => {
          if (creatorId) setForm(f => ({ ...f, creatorId }));
        });
      } else if (creatorId) {
        setForm(f => ({ ...f, creatorId }));
      }
    });
  }, []);

  const fetchCampaigns = async (t: string) => {
    try {
      const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      const list = data.data || data.campaigns || [];
      setCampaigns(list);
      // If campId in URL, auto-set title
      const campId = searchParams?.get("campaignId") || "";
      if (campId) {
        const camp = list.find((c: any) => c._id === campId);
        if (camp) setForm(f => ({ ...f, campaignId: campId, title: f.title || `Deal for ${camp.title}` }));
      }
    } catch {}
  };

  const fetchApplications = async (campaignId: string, t?: string) => {
    setLoadingApps(true);
    try {
      const res = await fetch(`${API}/campaigns/${campaignId}/applications`, { headers: { Authorization: `Bearer ${t||token}` } });
      const data = await res.json();
      setApplications(data.applications || data.data || []);
    } catch { setApplications([]); }
    finally { setLoadingApps(false); }
  };

  const handleCampaignChange = (campaignId: string) => {
    const camp = campaigns.find(c => c._id === campaignId);
    setForm(f => ({ ...f, campaignId, title: camp ? `Deal for ${camp.title}` : "", creatorId: "", creatorName: "" }));
    if (campaignId) fetchApplications(campaignId);
    else setApplications([]);
  };

  const handleCreatorChange = (creatorId: string) => {
    const app = applications.find(a => (a.influencer?._id || a._id) === creatorId);
    const name = app?.influencer?.name || app?.name || "";
    setForm(f => ({ ...f, creatorId, creatorName: name }));
  };

  const addDeliverable = () => setForm(f => ({ ...f, deliverables: [...f.deliverables, ""] }));
  const updateDeliverable = (i: number, val: string) => setForm(f => {
    const d = [...f.deliverables]; d[i] = val; return { ...f, deliverables: d };
  });
  const removeDeliverable = (i: number) => setForm(f => ({
    ...f, deliverables: f.deliverables.filter((_, idx) => idx !== i)
  }));

  const handleSubmit = async () => {
    if (!form.campaignId) { showToast("Please select a Campaign", "error"); return; }
    if (!form.creatorId)  { showToast("Please select a Creator", "error"); return; }
    if (!form.amount)     { showToast("Please enter the Deal Amount", "error"); return; }
    if (!form.title)      { showToast("Please enter a Deal Title", "error"); return; }
    setSubmitting(true);
    try {
      // POST /api/deal/create
      const res = await fetch(`${API}/deal/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId:   form.campaignId,
          influencerId: form.creatorId,          // schema uses influencerId
          amount:       Number(form.amount),
          title:        form.title,
          description:  form.description,
          deadline:     form.deadline,
          deliverables: form.deliverables.filter(Boolean).join("\n"),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create deal");
      showToast("Deal created! Redirecting...", "success");
      const newId = data.deal?._id || data.data?._id || data._id || null;
      setTimeout(() => {
        if (newId) router.push(`/deals/${newId}`);
        else router.push("/deals");
      }, 900);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .dc { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
        .dc-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; }
        .dc-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
        .dc-back:hover { background: #ebebeb; }
        .dc-title { font-size: 20px; font-weight: 800; color: #111; }
        .dc-body { max-width: 640px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 20px; }
        .dc-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
        .dc-section-title { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .dc-field { margin-bottom: 16px; }
        .dc-field:last-child { margin-bottom: 0; }
        .dc-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
        .dc-label span { color: #ef4444; }
        .dc-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.2s; color: #111; background: #fff; }
        .dc-input:focus { border-color: #4f46e5; }
        .dc-select { -webkit-appearance: auto; appearance: auto;  width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; cursor: pointer; color: #111; background: #fff; }
        .dc-select:focus { border-color: #4f46e5; }
        .dc-textarea { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; resize: vertical; min-height: 90px; color: #111; }
        .dc-textarea:focus { border-color: #4f46e5; }
        .dc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media(max-width:480px){ .dc-grid2{ grid-template-columns: 1fr; } }
        .dc-deliverable-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .dc-deliverable-row .dc-input { margin: 0; }
        .dc-del-btn { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #fecaca; background: #fff5f5; color: #ef4444; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dc-add-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px dashed #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; margin-top: 4px; }
        .dc-submit { width: 100%; padding: 14px; border-radius: 14px; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .dc-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(79,70,229,0.4); }
        .dc-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .dc-amount-prefix { position: relative; }
        .dc-amount-prefix .dc-input { padding-left: 28px; }
        .dc-amount-prefix::before { content: "₹"; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #888; font-weight: 700; pointer-events: none; }
        .dc-creator-card { background: linear-gradient(135deg,#eef2ff,#f5f3ff); border: 1.5px solid #c7d2fe; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .dc-creator-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .dc-creator-name { font-size: 14px; font-weight: 700; color: #111; }
        .dc-creator-sub { font-size: 12px; color: #9ca3af; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 9999; animation: toastIn 0.3s ease; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.12); font-family: 'Plus Jakarta Sans', sans-serif; }
        .toast.success { background: #111; color: #fff; }
        .toast.error   { background: #ef4444; color: #fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="dc">
        <div className="dc-header">
          <a href="/deals" className="dc-back">← Back</a>
          <div className="dc-title">Create Deal</div>
        </div>

        <div className="dc-body">

          {/* Campaign & Creator */}
          <div className="dc-card">
            <div className="dc-section-title">🎯 Campaign & Creator</div>
            <div className="dc-field">
              <label className="dc-label">Campaign <span>*</span></label>
              <select className="dc-select" style={{color: form.campaignId ? "#111" : "#9ca3af"}} value={form.campaignId} onChange={e => handleCampaignChange(e.target.value)}>
                <option value="">Select campaign...</option>
                {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            {(form.campaignId || applications.length > 0) && (
              <div className="dc-field">
                <label className="dc-label">Creator <span>*</span></label>
                {loadingApps ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading creators...</div> :
                  applications.length === 0 ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>No applications for this campaign</div> :
                  <select className="dc-select" style={{color: form.creatorId ? "#111" : "#9ca3af"}} value={form.creatorId} onChange={e => handleCreatorChange(e.target.value)}>
                    <option value="">Select creator...</option>
                    {applications.map(a => {
                      const id = a.influencer?._id || a._id;
                      const name = a.influencer?.name || a.name || "Creator";
                      return <option key={id} value={id}>{name}</option>;
                    })}
                  </select>
                }
                {form.creatorName && (
                  <div className="dc-creator-card">
                    <div className="dc-creator-av">{form.creatorName.charAt(0).toUpperCase()}</div>
                    <div>
                      <div className="dc-creator-name">{form.creatorName}</div>
                      <div className="dc-creator-sub">Selected creator</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Deal Details */}
          <div className="dc-card">
            <div className="dc-section-title">📋 Deal Details</div>
            <div className="dc-field">
              <label className="dc-label">Deal Title <span>*</span></label>
              <input className="dc-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Instagram Reel for Summer Campaign" />
            </div>
            <div className="dc-field">
              <label className="dc-label">Description</label>
              <textarea className="dc-textarea" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Describe what you expect from the creator..." />
            </div>
            <div className="dc-grid2">
              <div className="dc-field">
                <label className="dc-label">Amount <span>*</span></label>
                <div className="dc-amount-prefix">
                  <input className="dc-input" type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="5000" />
                </div>
              </div>
              <div className="dc-field">
                <label className="dc-label">Deadline</label>
                <input className="dc-input" type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="dc-card">
            <div className="dc-section-title">✅ Deliverables</div>
            {form.deliverables.map((d, i) => (
              <div key={i} className="dc-deliverable-row">
                <input className="dc-input" value={d} onChange={e => updateDeliverable(i, e.target.value)} placeholder={`Deliverable ${i+1} — e.g. 1 Instagram Reel`} />
                {form.deliverables.length > 1 && (
                  <button className="dc-del-btn" onClick={() => removeDeliverable(i)}>✕</button>
                )}
              </div>
            ))}
            <button className="dc-add-btn" onClick={addDeliverable}>+ Add Deliverable</button>
          </div>

          {/* Escrow Info */}
          <div className="dc-card" style={{background:"linear-gradient(135deg,#eef2ff,#f5f3ff)",border:"1.5px solid #c7d2fe"}}>
            <div className="dc-section-title" style={{color:"#7c3aed"}}>🔒 Escrow Payment</div>
            <p style={{fontSize:14,color:"#555",lineHeight:1.7}}>
              After creating the deal, you'll be asked to <strong>deposit the amount into escrow</strong>. 
              The money is held safely and released to the creator only after you <strong>approve their work</strong>.
            </p>
            <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
              {["💰 You deposit","🔒 Held in escrow","✅ Creator works","🎯 You approve","💸 Creator gets paid"].map((s,i) => (
                <div key={i} style={{background:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#4f46e5",border:"1px solid #c7d2fe"}}>{s}</div>
              ))}
            </div>
          </div>

          <button className="dc-submit" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Creating Deal..." : "🤝 Create Deal & Proceed to Deposit →"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function CreateDealPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <CreateDealPageInner />
    </Suspense>
  );
}

// "use client";

// import { useEffect, useState } from "react";
// import { useParams, useRouter, useSearchParams } from "next/navigation";
// import Script from "next/script";

// const API          = "http://54.252.201.93:5000/api";
// const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";

// export default function DealDetailPage() {
//   const { id }          = useParams();
//   const searchParams    = useSearchParams();
//   const router          = useRouter();
//   const [deal, setDeal] = useState<any>(null);
//   const [loading, setLoading]       = useState(true);
//   const [token, setToken]           = useState("");
//   const [role, setRole]             = useState("");
//   const [userName, setUserName]     = useState("");
//   const [userEmail, setUserEmail]   = useState("");
//   const [actionLoading, setActionLoading] = useState("");
//   const [toast, setToast]           = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
//   const [submitNote, setSubmitNote] = useState("");
//   const [submitFile, setSubmitFile] = useState("");
//   const [showSubmitForm, setShowSubmitForm] = useState(false);

//   const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
//     setToast({msg,type}); setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     setToken(parsed.token);
//     setRole(parsed.role?.toLowerCase() || "");
//     setUserName(parsed.name || "");
//     setUserEmail(parsed.email || "");
//     fetchDeal(parsed.token);
//     if (searchParams.get("action") === "deposit") setTimeout(() => handleDeposit(parsed.token), 800);
//   }, [id]);

//   const fetchDeal = async (t: string) => {
//     try {
//       const res = await fetch(`${API}/deal/${id}`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       setDeal(data.deal || data.data || data);
//     } catch {}
//     finally { setLoading(false); }
//   };

//   const handleDeposit = async (t?: string) => {
//     const tk = t || token;
//     if (!deal && !t) return;
//     setActionLoading("deposit");
//     try {
//       const res = await fetch(`${API}/deal/${id}/escrow/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ amount: deal?.amount }),
//       });
//       const data = await res.json();
//       if (!data.success || !data.order?.id) throw new Error(data.message || "Failed to create payment");

//       const options = {
//         key: RAZORPAY_KEY,
//         order_id: data.order.id,
//         amount: data.order.amount,
//         currency: "INR",
//         name: "Influex Escrow",
//         description: `Deal: ${deal?.title || ""}`,
//         theme: { color: "#4f46e5" },
//         prefill: { name: userName, email: userEmail },
//         handler: async (response: any) => {
//           try {
//             await fetch(`${API}/deal/${id}/escrow/verify`, {
//               method: "POST",
//               headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
//               body: JSON.stringify(response),
//             });
//             showToast("💰 Escrow deposited successfully!", "success");
//             fetchDeal(tk);
//           } catch { showToast("Verification failed", "error"); }
//           setActionLoading("");
//         },
//         modal: { ondismiss: () => { showToast("Payment cancelled", "warn"); setActionLoading(""); } },
//       };
//       const rzp = new (window as any).Razorpay(options);
//       rzp.open();
//     } catch (err: any) {
//       showToast(err.message || "Payment failed", "error");
//       setActionLoading("");
//     }
//   };

//   const handleApprove = async () => {
//     setActionLoading("approve");
//     try {
//       const res = await fetch(`${API}/deal/${id}/approve`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       showToast("✅ Work approved! Payment released to creator.", "success");
//       fetchDeal(token);
//     } catch (err: any) { showToast(err.message || "Failed", "error"); }
//     finally { setActionLoading(""); }
//   };

//   const handleSubmitDeliverable = async () => {
//     if (!submitNote && !submitFile) { showToast("Add a note or link", "error"); return; }
//     setActionLoading("submit");
//     try {
//       const res = await fetch(`${API}/deal/${id}/deliverable`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ note: submitNote, fileUrl: submitFile }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       showToast("✅ Work submitted! Waiting for brand approval.", "success");
//       setShowSubmitForm(false);
//       setSubmitNote(""); setSubmitFile("");
//       fetchDeal(token);
//     } catch (err: any) { showToast(err.message || "Failed", "error"); }
//     finally { setActionLoading(""); }
//   };

//   const steps = ["Deal Created", "Escrow Deposited", "Work Submitted", "Brand Approved", "💰 Payment Released"];
//   const getStep = () => {
//     if (!deal) return 0;
//     if (deal.status === "completed") return 4;
//     if (deal.deliverableSubmitted && deal.status === "active") return 3;
//     if (deal.escrowDeposited) return 2;
//     if (deal.status === "pending") return 1;
//     return 0;
//   };

//   if (loading) return (
//     <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
//       <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!deal) return (
//     <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
//       <div style={{textAlign:"center"}}>
//         <div style={{fontSize:48,marginBottom:16}}>🤝</div>
//         <div style={{fontSize:18,fontWeight:700,color:"#111"}}>Deal not found</div>
//       </div>
//     </div>
//   );

//   const currentStep = getStep();

//   return (
//     <>
//       <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
//         @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
//         .dd { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
//         .dd-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; justify-content: space-between; flex-wrap: wrap; }
//         .dd-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
//         .dd-title { font-size: 18px; font-weight: 800; color: #111; }
//         .dd-status { padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 700; }
//         .dd-body { max-width: 680px; margin: 24px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 16px; }

//         /* PROGRESS */
//         .dd-progress { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
//         .dd-progress-title { font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 20px; }
//         .dd-steps { display: flex; align-items: center; gap: 0; position: relative; }
//         .dd-step { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
//         .dd-step-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; border: 2px solid #e0e0e0; background: #fff; color: #aaa; z-index: 1; transition: all 0.3s; }
//         .dd-step-circle.done { background: linear-gradient(135deg,#4f46e5,#7c3aed); border-color: #4f46e5; color: #fff; }
//         .dd-step-circle.current { background: #fff; border-color: #4f46e5; color: #4f46e5; box-shadow: 0 0 0 4px #eef2ff; }
//         .dd-step-label { font-size: 10px; font-weight: 600; color: #aaa; margin-top: 6px; text-align: center; white-space: nowrap; }
//         .dd-step-label.done { color: #4f46e5; }
//         .dd-step-line { position: absolute; top: 18px; left: 50%; right: -50%; height: 2px; background: #e0e0e0; z-index: 0; }
//         .dd-step-line.done { background: linear-gradient(90deg,#4f46e5,#7c3aed); }

//         /* INFO CARD */
//         .dd-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
//         .dd-card-title { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; }
//         .dd-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
//         .dd-row:last-child { border-bottom: none; }
//         .dd-row-label { color: #888; font-weight: 500; }
//         .dd-row-val   { font-weight: 700; color: #111; }
//         .dd-amount-big { font-size: 32px; font-weight: 800; color: #4f46e5; text-align: center; padding: 16px 0 8px; }
//         .dd-amount-lbl { font-size: 12px; color: #aaa; text-align: center; margin-bottom: 16px; }
//         .dd-escrow-status { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; margin-bottom: 16px; }
//         .dd-escrow-safe   { background: #f0fdf4; color: #16a34a; border: 1.5px solid #86efac; }
//         .dd-escrow-pending{ background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a; }

//         /* DELIVERABLES */
//         .dd-deliverable { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
//         .dd-deliverable:last-child { border-bottom: none; }
//         .dd-del-icon { width: 24px; height: 24px; border-radius: 6px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; font-weight: 700; }
//         .dd-del-text { font-size: 13px; color: #444; line-height: 1.5; flex: 1; }

//         /* SUBMIT FORM */
//         .dd-submit-form { background: #f8f9ff; border: 1.5px solid #c7d2fe; border-radius: 14px; padding: 18px; margin-top: 12px; }
//         .dd-sf-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
//         .dd-sf-input  { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; margin-bottom: 10px; }
//         .dd-sf-input:focus { border-color: #4f46e5; }
//         .dd-sf-textarea { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; resize: vertical; min-height: 80px; margin-bottom: 10px; }

//         /* ACTIONS */
//         .dd-action-btn { width: 100%; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .dd-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
//         .dd-btn-deposit { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
//         .dd-btn-deposit:hover:not(:disabled) { transform: translateY(-1px); }
//         .dd-btn-approve { background: linear-gradient(135deg,#16a34a,#22c55e); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
//         .dd-btn-approve:hover:not(:disabled) { transform: translateY(-1px); }
//         .dd-btn-submit  { background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; box-shadow: 0 4px 16px rgba(245,158,11,0.25); }
//         .dd-btn-submit:hover:not(:disabled) { transform: translateY(-1px); }
//         .dd-btn-secondary { background: #f5f5f3; color: #555; margin-top: 8px; }
//         .dd-btn-secondary:hover { background: #ebebeb; }

//         .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 9999; animation: toastIn 0.3s ease; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.12); font-family: 'Plus Jakarta Sans', sans-serif; }
//         .toast.success { background: #111; color: #fff; }
//         .toast.error   { background: #ef4444; color: #fff; }
//         .toast.warn    { background: #f59e0b; color: #fff; }
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="dd">
//         <div className="dd-header">
//           <div style={{display:"flex",alignItems:"center",gap:12}}>
//             <a href="/deals" className="dd-back">← Back</a>
//             <div className="dd-title">{deal.title || "Deal"}</div>
//           </div>
//           <div className="dd-status" style={{
//             background: deal.status === "completed" ? "#f0fdf4" : deal.status === "active" ? "#eef2ff" : "#fffbeb",
//             color:      deal.status === "completed" ? "#16a34a" : deal.status === "active" ? "#4f46e5" : "#d97706",
//             border:     `1.5px solid ${deal.status === "completed" ? "#86efac" : deal.status === "active" ? "#c7d2fe" : "#fde68a"}`,
//           }}>{deal.status || "pending"}</div>
//         </div>

//         <div className="dd-body">

//           {/* PROGRESS STEPS */}
//           <div className="dd-progress">
//             <div className="dd-progress-title">Deal Progress</div>
//             <div className="dd-steps">
//               {steps.map((step, i) => (
//                 <div key={i} className="dd-step">
//                   {i < steps.length - 1 && (
//                     <div className={`dd-step-line ${i < currentStep ? "done" : ""}`} />
//                   )}
//                   <div className={`dd-step-circle ${i < currentStep ? "done" : i === currentStep ? "current" : ""}`}>
//                     {i < currentStep ? "✓" : i + 1}
//                   </div>
//                   <div className={`dd-step-label ${i <= currentStep ? "done" : ""}`}
//                     style={{fontSize: i === 4 ? "11px" : undefined}}>
//                     {step}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* DEAL INFO */}
//           <div className="dd-card">
//             <div className="dd-card-title">📋 Deal Info</div>
//             <div className="dd-row"><span className="dd-row-label">Campaign</span><span className="dd-row-val">{deal.campaignTitle || deal.campaign?.title || "—"}</span></div>
//             <div className="dd-row"><span className="dd-row-label">Brand</span><span className="dd-row-val">{deal.brandName || deal.brand?.name || "—"}</span></div>
//             <div className="dd-row"><span className="dd-row-label">Creator</span><span className="dd-row-val">{deal.creatorName || deal.creator?.name || deal.influencer?.name || "—"}</span></div>
//             <div className="dd-row"><span className="dd-row-label">Deadline</span><span className="dd-row-val">{deal.deadline ? new Date(deal.deadline).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"}) : "—"}</span></div>
//             <div className="dd-row"><span className="dd-row-label">Created</span><span className="dd-row-val">{new Date(deal.createdAt).toLocaleDateString("en-IN", {day:"numeric",month:"long"})}</span></div>
//             {deal.description && (
//               <div style={{marginTop:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:10,fontSize:14,color:"#555",lineHeight:1.65}}>
//                 {deal.description}
//               </div>
//             )}
//           </div>

//           {/* ESCROW */}
//           <div className="dd-card">
//             <div className="dd-card-title">💰 Escrow Payment</div>
//             <div className="dd-amount-big">₹{(deal.amount || 0).toLocaleString()}</div>
//             <div className="dd-amount-lbl">Deal Amount</div>
//             <div className={`dd-escrow-status ${deal.escrowDeposited ? "dd-escrow-safe" : "dd-escrow-pending"}`}>
//               {deal.escrowDeposited ? "🔒 Amount safely held in escrow" : "⏳ Awaiting escrow deposit"}
//             </div>
//             {role === "brand" && !deal.escrowDeposited && deal.status !== "completed" && (
//               <button className="dd-action-btn dd-btn-deposit" disabled={actionLoading === "deposit"} onClick={() => handleDeposit()}>
//                 {actionLoading === "deposit" ? "Opening payment..." : "💰 Deposit ₹" + (deal.amount || 0).toLocaleString() + " to Escrow"}
//               </button>
//             )}
//             {role === "brand" && deal.escrowDeposited && deal.deliverableSubmitted && deal.status !== "completed" && (
//               <>
//                 <div style={{fontSize:13,color:"#555",marginBottom:12,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,border:"1px solid #bbf7d0"}}>
//                   🎯 Creator has submitted their work. Review and approve to release payment.
//                 </div>
//                 <button className="dd-action-btn dd-btn-approve" disabled={actionLoading === "approve"} onClick={handleApprove}>
//                   {actionLoading === "approve" ? "Approving..." : "✅ Approve Work & Release Payment"}
//                 </button>
//               </>
//             )}
//             {deal.status === "completed" && (
//               <div style={{textAlign:"center",padding:"12px",background:"#f0fdf4",borderRadius:12,color:"#16a34a",fontWeight:700,fontSize:14,border:"1.5px solid #86efac"}}>
//                 🎉 Payment released! Deal completed successfully.
//               </div>
//             )}
//           </div>

//           {/* DELIVERABLES */}
//           {deal.deliverables?.length > 0 && (
//             <div className="dd-card">
//               <div className="dd-card-title">✅ Deliverables</div>
//               {deal.deliverables.map((d: string, i: number) => (
//                 <div key={i} className="dd-deliverable">
//                   <div className="dd-del-icon">{i+1}</div>
//                   <div className="dd-del-text">{d}</div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* CREATOR — SUBMIT WORK */}
//           {(role === "influencer" || role === "creator") && deal.escrowDeposited && deal.status !== "completed" && (
//             <div className="dd-card">
//               <div className="dd-card-title">📤 Submit Your Work</div>
//               {deal.deliverableSubmitted ? (
//                 <div style={{textAlign:"center",padding:"16px",background:"#f0fdf4",borderRadius:12,color:"#16a34a",fontWeight:700,fontSize:14,border:"1.5px solid #86efac"}}>
//                   ✅ Work submitted! Waiting for brand approval.
//                 </div>
//               ) : (
//                 <>
//                   {!showSubmitForm ? (
//                     <button className="dd-action-btn dd-btn-submit" onClick={() => setShowSubmitForm(true)}>
//                       📤 Submit Completed Work
//                     </button>
//                   ) : (
//                     <div className="dd-submit-form">
//                       <label className="dd-sf-label">Work Link / Drive URL</label>
//                       <input className="dd-sf-input" value={submitFile} onChange={e => setSubmitFile(e.target.value)} placeholder="https://drive.google.com/..." />
//                       <label className="dd-sf-label">Notes for Brand</label>
//                       <textarea className="dd-sf-textarea" value={submitNote} onChange={e => setSubmitNote(e.target.value)} placeholder="Describe what you've done..." />
//                       <button className="dd-action-btn dd-btn-submit" disabled={actionLoading === "submit"} onClick={handleSubmitDeliverable}>
//                         {actionLoading === "submit" ? "Submitting..." : "✅ Submit Work"}
//                       </button>
//                       <button className="dd-action-btn dd-btn-secondary" onClick={() => setShowSubmitForm(false)}>Cancel</button>
//                     </div>
//                   )}
//                 </>
//               )}
//             </div>
//           )}

//           {/* SUBMITTED WORK — visible to brand */}
//           {role === "brand" && deal.deliverableSubmitted && deal.submittedWork && (
//             <div className="dd-card" style={{border:"1.5px solid #c7d2fe",background:"#eef2ff"}}>
//               <div className="dd-card-title" style={{color:"#4f46e5"}}>📩 Creator's Submission</div>
//               {deal.submittedWork.note && (
//                 <div style={{fontSize:14,color:"#444",lineHeight:1.65,marginBottom:12,padding:"10px 14px",background:"#fff",borderRadius:10}}>
//                   {deal.submittedWork.note}
//                 </div>
//               )}
//               {deal.submittedWork.fileUrl && (
//                 <a href={deal.submittedWork.fileUrl} target="_blank" rel="noreferrer"
//                   style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff",borderRadius:10,color:"#4f46e5",fontWeight:600,fontSize:13,textDecoration:"none",border:"1px solid #c7d2fe"}}>
//                   📎 View Submitted Work →
//                 </a>
//               )}
//             </div>
//           )}

//         </div>
//       </div>
//     </>
//   );
// }