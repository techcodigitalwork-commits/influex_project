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
    // Always load all creators
    fetchApplications("", t);
  };

  const fetchApplications = async (campaignId: string, t?: string) => {
    setLoadingApps(true);
    try {
      const res = await fetch(`${API}/campaigns/${campaignId}/application`, { headers: { Authorization: `Bearer ${t||token}` } });
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
    const app = applications.find(a => a._id === creatorId);
    const name = app?.name || "";
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
    if (!form.campaignId) { showToast("⬆️ Please select a Campaign above", "error"); document.querySelector('.dc-select')?.scrollIntoView({behavior:'smooth',block:'center'}); return; }
    if (!form.creatorId)  { showToast("⬆️ Please select a Creator above", "error"); return; }
    if (!form.amount)     { showToast("⬆️ Please enter the Deal Amount", "error"); return; }
    if (!form.title)      { showToast("⬆️ Please enter a Deal Title", "error"); return; }
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
            {(
              <div className="dc-field">
                <label className="dc-label">Creator <span>*</span></label>
                {loadingApps ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading creators...</div> :
                  applications.length === 0 ? <div style={{fontSize:13,color:"#f59e0b",padding:"10px 0"}}>⚠️ No applications yet for this campaign — creators need to apply first.</div> :
                  <select className="dc-select" style={{color: form.creatorId ? "#111" : "#9ca3af"}} value={form.creatorId} onChange={e => handleCreatorChange(e.target.value)}>
                    <option value="">Select creator...</option>
                    {applications.map((a, i) => {
                      const cid  = a._id;
                      const name = a.name || `Creator ${i+1}`;
                      const sub  = a.followers ? ` · ${Number(a.followers).toLocaleString("en-IN")} followers` : "";
                      return <option key={cid || i} value={cid}>{name}{sub}</option>;
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
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function CreateDealPage() {
//   const router = useRouter();
//   const [token, setToken] = useState("");
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [applications, setApplications] = useState<any[]>([]);
//   const [loadingApps, setLoadingApps] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

//   const [form, setForm] = useState({
//     campaignId: "",
//     creatorId: "",
//     creatorName: "",
//     title: "",
//     amount: "",
//     description: "",
//     deadline: "",
//     deliverables: [""],
//   });

//   const showToast = (msg: string, type: "success"|"error" = "success") => {
//     setToast({msg, type});
//     setTimeout(() => setToast(null), 4000);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/deals"); return; }
//     setToken(parsed.token);
//     fetchCampaigns(parsed.token);
//   }, []);

//   const fetchCampaigns = async (t: string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       setCampaigns(data.data || data.campaigns || []);
//     } catch {}
//   };

//   const fetchApplications = async (campaignId: string) => {
//     setLoadingApps(true);
//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/applications`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       setApplications(data.applications || data.data || []);
//     } catch { setApplications([]); }
//     finally { setLoadingApps(false); }
//   };

//   const handleCampaignChange = (campaignId: string) => {
//     const camp = campaigns.find(c => c._id === campaignId);
//     setForm(f => ({ ...f, campaignId, title: camp ? `Deal for ${camp.title}` : "", creatorId: "", creatorName: "" }));
//     if (campaignId) fetchApplications(campaignId);
//     else setApplications([]);
//   };

//   const handleCreatorChange = (creatorId: string) => {
//     const app = applications.find(a => (a.influencer?._id || a._id) === creatorId);
//     const name = app?.influencer?.name || app?.name || "";
//     setForm(f => ({ ...f, creatorId, creatorName: name }));
//   };

//   const addDeliverable = () => setForm(f => ({ ...f, deliverables: [...f.deliverables, ""] }));
//   const updateDeliverable = (i: number, val: string) => setForm(f => {
//     const d = [...f.deliverables]; d[i] = val; return { ...f, deliverables: d };
//   });
//   const removeDeliverable = (i: number) => setForm(f => ({
//     ...f, deliverables: f.deliverables.filter((_, idx) => idx !== i)
//   }));

//   const handleSubmit = async () => {
//     if (!form.campaignId || !form.creatorId || !form.amount || !form.title) {
//       showToast("Please fill all required fields", "error"); return;
//     }
//     setSubmitting(true);
//     try {
//       const res = await fetch(`${API}/deal/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           campaignId: form.campaignId,
//           creatorId: form.creatorId,
//           title: form.title,
//           amount: Number(form.amount),
//           description: form.description,
//           deadline: form.deadline,
//           deliverables: form.deliverables.filter(Boolean),
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed");
//       showToast("Deal created! ✓", "success");
//       setTimeout(() => router.push("/deals"), 1500);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     } finally { setSubmitting(false); }
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
//         body { font-family: 'Plus Jakarta Sans', sans-serif; }
//         .dc { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
//         .dc-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; }
//         .dc-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
//         .dc-back:hover { background: #ebebeb; }
//         .dc-title { font-size: 20px; font-weight: 800; color: #111; }
//         .dc-body { max-width: 640px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 20px; }
//         .dc-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
//         .dc-section-title { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
//         .dc-field { margin-bottom: 16px; }
//         .dc-field:last-child { margin-bottom: 0; }
//         .dc-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
//         .dc-label span { color: #ef4444; }
//         .dc-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.2s; color: #111; background: #fff; }
//         .dc-input:focus { border-color: #4f46e5; }
//         .dc-select { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; cursor: pointer; color: #111; background: #fff; }
//         .dc-select:focus { border-color: #4f46e5; }
//         .dc-textarea { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; resize: vertical; min-height: 90px; color: #111; }
//         .dc-textarea:focus { border-color: #4f46e5; }
//         .dc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
//         @media(max-width:480px){ .dc-grid2{ grid-template-columns: 1fr; } }
//         .dc-deliverable-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
//         .dc-deliverable-row .dc-input { margin: 0; }
//         .dc-del-btn { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #fecaca; background: #fff5f5; color: #ef4444; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
//         .dc-add-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px dashed #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; margin-top: 4px; }
//         .dc-submit { width: 100%; padding: 14px; border-radius: 14px; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
//         .dc-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(79,70,229,0.4); }
//         .dc-submit:disabled { opacity: 0.6; cursor: not-allowed; }
//         .dc-amount-prefix { position: relative; }
//         .dc-amount-prefix .dc-input { padding-left: 28px; }
//         .dc-amount-prefix::before { content: "₹"; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: #888; font-weight: 700; pointer-events: none; }
//         .dc-creator-card { background: linear-gradient(135deg,#eef2ff,#f5f3ff); border: 1.5px solid #c7d2fe; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; margin-top: 10px; }
//         .dc-creator-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0; }
//         .dc-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .dc-creator-sub { font-size: 12px; color: #9ca3af; }
//         .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 9999; animation: toastIn 0.3s ease; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.12); font-family: 'Plus Jakarta Sans', sans-serif; }
//         .toast.success { background: #111; color: #fff; }
//         .toast.error   { background: #ef4444; color: #fff; }
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="dc">
//         <div className="dc-header">
//           <a href="/deals" className="dc-back">← Back</a>
//           <div className="dc-title">Create Deal</div>
//         </div>

//         <div className="dc-body">

//           {/* Campaign & Creator */}
//           <div className="dc-card">
//             <div className="dc-section-title">🎯 Campaign & Creator</div>
//             <div className="dc-field">
//               <label className="dc-label">Campaign <span>*</span></label>
//               <select className="dc-select" value={form.campaignId} onChange={e => handleCampaignChange(e.target.value)}>
//                 <option value="">Select campaign...</option>
//                 {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
//               </select>
//             </div>
//             {form.campaignId && (
//               <div className="dc-field">
//                 <label className="dc-label">Creator <span>*</span></label>
//                 {loadingApps ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading creators...</div> :
//                   applications.length === 0 ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>No applications for this campaign</div> :
//                   <select className="dc-select" value={form.creatorId} onChange={e => handleCreatorChange(e.target.value)}>
//                     <option value="">Select creator...</option>
//                     {applications.map(a => {
//                       const id = a.influencer?._id || a._id;
//                       const name = a.influencer?.name || a.name || "Creator";
//                       return <option key={id} value={id}>{name}</option>;
//                     })}
//                   </select>
//                 }
//                 {form.creatorName && (
//                   <div className="dc-creator-card">
//                     <div className="dc-creator-av">{form.creatorName.charAt(0).toUpperCase()}</div>
//                     <div>
//                       <div className="dc-creator-name">{form.creatorName}</div>
//                       <div className="dc-creator-sub">Selected creator</div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Deal Details */}
//           <div className="dc-card">
//             <div className="dc-section-title">📋 Deal Details</div>
//             <div className="dc-field">
//               <label className="dc-label">Deal Title <span>*</span></label>
//               <input className="dc-input" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Instagram Reel for Summer Campaign" />
//             </div>
//             <div className="dc-field">
//               <label className="dc-label">Description</label>
//               <textarea className="dc-textarea" value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Describe what you expect from the creator..." />
//             </div>
//             <div className="dc-grid2">
//               <div className="dc-field">
//                 <label className="dc-label">Amount <span>*</span></label>
//                 <div className="dc-amount-prefix">
//                   <input className="dc-input" type="number" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} placeholder="5000" />
//                 </div>
//               </div>
//               <div className="dc-field">
//                 <label className="dc-label">Deadline</label>
//                 <input className="dc-input" type="date" value={form.deadline} onChange={e => setForm(f => ({...f, deadline: e.target.value}))} />
//               </div>
//             </div>
//           </div>

//           {/* Deliverables */}
//           <div className="dc-card">
//             <div className="dc-section-title">✅ Deliverables</div>
//             {form.deliverables.map((d, i) => (
//               <div key={i} className="dc-deliverable-row">
//                 <input className="dc-input" value={d} onChange={e => updateDeliverable(i, e.target.value)} placeholder={`Deliverable ${i+1} — e.g. 1 Instagram Reel`} />
//                 {form.deliverables.length > 1 && (
//                   <button className="dc-del-btn" onClick={() => removeDeliverable(i)}>✕</button>
//                 )}
//               </div>
//             ))}
//             <button className="dc-add-btn" onClick={addDeliverable}>+ Add Deliverable</button>
//           </div>

//           {/* Escrow Info */}
//           <div className="dc-card" style={{background:"linear-gradient(135deg,#eef2ff,#f5f3ff)",border:"1.5px solid #c7d2fe"}}>
//             <div className="dc-section-title" style={{color:"#7c3aed"}}>🔒 Escrow Payment</div>
//             <p style={{fontSize:14,color:"#555",lineHeight:1.7}}>
//               After creating the deal, you'll be asked to <strong>deposit the amount into escrow</strong>. 
//               The money is held safely and released to the creator only after you <strong>approve their work</strong>.
//             </p>
//             <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
//               {["💰 You deposit","🔒 Held in escrow","✅ Creator works","🎯 You approve","💸 Creator gets paid"].map((s,i) => (
//                 <div key={i} style={{background:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#4f46e5",border:"1px solid #c7d2fe"}}>{s}</div>
//               ))}
//             </div>
//           </div>

//           <button className="dc-submit" disabled={submitting} onClick={handleSubmit}>
//             {submitting ? "Creating Deal..." : "🤝 Create Deal & Proceed to Deposit →"}
//           </button>
//         </div>
//       </div>
//     </>
//   );
// }