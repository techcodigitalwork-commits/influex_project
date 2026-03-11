"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

const DEFAULT_TERMS = `1. SCOPE OF WORK
The Creator agrees to produce the deliverables as specified in this contract.

2. PAYMENT
The Brand agrees to pay the agreed amount upon successful completion and approval of deliverables.

3. TIMELINE
All deliverables must be submitted by the agreed deadline.

4. CONTENT RIGHTS
The Brand receives a non-exclusive license to use the content for marketing purposes.

5. CONFIDENTIALITY
Both parties agree to keep the terms of this agreement confidential.

6. REVISIONS
Creator agrees to provide up to 2 revisions of submitted content.`;

function CreateContractPageInner() {
  const router = useRouter();
  const [token, setToken]       = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps]   = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

  const [form, setForm] = useState({
    campaignId: "", creatorId: "", creatorName: "",
    title: "", amount: "", deadline: "",
    deliverables: [""],
    terms: DEFAULT_TERMS,
    sendImmediately: false,
  });

  const showToast = (msg:string, type:"success"|"error"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  const searchParams = useSearchParams();

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    if (p.role?.toLowerCase() !== "brand") { router.push("/contracts"); return; }
    setToken(p.token);
    fetchCampaigns(p.token);
    // Auto-fill from URL params
    const campId    = searchParams.get("campaignId") || "";
    const creatorId = searchParams.get("creatorId")  || "";
    const dealId    = searchParams.get("dealId")     || "";
    if (campId) {
      setForm(f => ({...f, campaignId: campId}));
      fetchApplications(campId, p.token);
    }
    if (creatorId) setForm(f => ({...f, creatorId}));
    const dealId = searchParams.get("dealId") || "";
    if (dealId) setForm(f => ({...f, dealId}));
  }, []);

  const fetchCampaigns = async (t:string) => {
    try {
      const res = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setCampaigns(data.data || data.campaigns || []);
    } catch {}
  };

  const fetchApplications = async (campaignId:string, t?:string) => {
    setLoadingApps(true);
    try {
      const res = await fetch(`${API}/campaigns/${campaignId}/applications`, { headers: { Authorization: `Bearer ${t||token}` } });
      const data = await res.json();
      setApplications(data.applications || data.data || []);
    } catch { setApplications([]); }
    finally { setLoadingApps(false); }
  };

  const handleCampaignChange = (cid:string) => {
    const camp = campaigns.find(c=>c._id===cid);
    setForm(f=>({...f, campaignId:cid, title: camp?`Contract — ${camp.title}`:"", creatorId:"", creatorName:""}));
    if (cid) fetchApplications(cid);
    else setApplications([]);
  };

  const handleCreatorChange = (cid:string) => {
    const app = applications.find(a=>(a.influencer?._id||a._id)===cid);
    setForm(f=>({...f, creatorId:cid, creatorName: app?.influencer?.name||app?.name||""}));
  };

  const addDeliverable    = () => setForm(f=>({...f, deliverables:[...f.deliverables,""]}));
  const updateDeliverable = (i:number,v:string) => setForm(f=>{ const d=[...f.deliverables]; d[i]=v; return{...f,deliverables:d}; });
  const removeDeliverable = (i:number) => setForm(f=>({...f, deliverables:f.deliverables.filter((_,idx)=>idx!==i)}));

  const handleSubmit = async () => {
    if (!form.campaignId || !form.creatorId || !form.title) {
      showToast("Fill all required fields", "error"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/contract/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: form.dealId || undefined,
          influencerId: form.creatorId,
          deliverables: form.deliverables.filter(Boolean).join("\n"),
          timeline: form.deadline || "",
          amount: Number(form.amount) || 0,
          // extra fields for display (backend may or may not store these)
          title: form.title,
          campaignId: form.campaignId,
          terms: form.terms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      showToast(form.sendImmediately ? "Contract sent to creator! ✓" : "Contract saved as draft ✓", "success");
      setTimeout(() => router.push("/contracts"), 1500);
    } catch (err:any) { showToast(err.message || "Something went wrong", "error"); }
    finally { setSubmitting(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .cc { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
        .cc-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; }
        .cc-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
        .cc-back:hover { background: #ebebeb; }
        .cc-title { font-size: 20px; font-weight: 800; color: #111; }
        .cc-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 20px; }
        .cc-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
        .cc-section { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .cc-field { margin-bottom: 16px; }
        .cc-field:last-child { margin-bottom: 0; }
        .cc-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
        .cc-label span { color: #ef4444; }
        .cc-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.2s; color: #111; background: #fff; }
        .cc-input:focus { border-color: #4f46e5; }
        .cc-select { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; cursor: pointer; color: #111; background: #fff; }
        .cc-textarea { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; resize: vertical; color: #111; line-height: 1.7; }
        .cc-textarea:focus { border-color: #4f46e5; }
        .cc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media(max-width:480px){ .cc-grid2{ grid-template-columns: 1fr; } }
        .cc-del-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
        .cc-del-rm { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #fecaca; background: #fff5f5; color: #ef4444; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cc-add { padding: 8px 14px; border-radius: 8px; border: 1.5px dashed #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; margin-top: 4px; }
        .cc-preview { background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 14px; padding: 20px 22px; }
        .cc-preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #e8e8e8; }
        .cc-preview-logo { font-size: 22px; font-weight: 800; color: #4f46e5; }
        .cc-preview-badge { padding: 4px 12px; background: #eef2ff; color: #4f46e5; border-radius: 100px; font-size: 11px; font-weight: 700; border: 1px solid #c7d2fe; }
        .cc-preview-title { font-size: 18px; font-weight: 800; color: #111; margin-bottom: 14px; }
        .cc-preview-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .cc-preview-party { background: #fff; border-radius: 10px; padding: 10px 14px; border: 1px solid #ebebeb; }
        .cc-preview-party-lbl { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
        .cc-preview-party-val { font-size: 14px; font-weight: 700; color: #111; }
        .cc-preview-terms { font-size: 12px; color: #666; line-height: 1.8; white-space: pre-line; max-height: 200px; overflow-y: auto; }
        .cc-preview-sig-area { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #e0e0e0; }
        .cc-preview-sig { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 6px; min-height: 40px; }
        .cc-preview-sig-lbl { font-size: 11px; color: #aaa; }
        .cc-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #f9f9f8; border-radius: 12px; border: 1.5px solid #ebebeb; cursor: pointer; }
        .cc-toggle-label { font-size: 14px; font-weight: 600; color: #111; }
        .cc-toggle-sub { font-size: 12px; color: #aaa; margin-top: 2px; }
        .cc-toggle { width: 44px; height: 24px; border-radius: 100px; background: #e0e0e0; position: relative; transition: background 0.2s; flex-shrink: 0; }
        .cc-toggle.on { background: #4f46e5; }
        .cc-toggle-knob { width: 20px; height: 20px; border-radius: 50%; background: #fff; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .cc-toggle.on .cc-toggle-knob { transform: translateX(20px); }
        .cc-actions { display: flex; gap: 10px; }
        .cc-btn-draft { flex:1; padding:14px; border-radius:14px; background:#f5f5f3; color:#555; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .cc-btn-draft:hover { background: #ebebeb; }
        .cc-btn-send { flex:1; padding:14px; border-radius:14px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.3); }
        .cc-btn-send:hover:not(:disabled) { transform:translateY(-1px); }
        .cc-btn-send:disabled { opacity:0.6; cursor:not-allowed; }
        .cc-creator-card { background: linear-gradient(135deg,#eef2ff,#f5f3ff); border: 1.5px solid #c7d2fe; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; margin-top: 10px; }
        .cc-creator-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0; }
        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:9999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#111; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cc">
        <div className="cc-header">
          <a href="/contracts" className="cc-back">← Back</a>
          <div className="cc-title">Create Contract</div>
        </div>

        <div className="cc-body">

          {/* Campaign & Creator */}
          <div className="cc-card">
            <div className="cc-section">🎯 Campaign & Creator</div>
            <div className="cc-field">
              <label className="cc-label">Campaign <span>*</span></label>
              <select className="cc-select" value={form.campaignId} onChange={e=>handleCampaignChange(e.target.value)}>
                <option value="">Select campaign...</option>
                {campaigns.map(c=><option key={c._id} value={c._id}>{c.title}</option>)}
              </select>
            </div>
            {form.campaignId && (
              <div className="cc-field">
                <label className="cc-label">Creator <span>*</span></label>
                {loadingApps
                  ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading...</div>
                  : applications.length === 0
                    ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>No applications found</div>
                    : <select className="cc-select" value={form.creatorId} onChange={e=>handleCreatorChange(e.target.value)}>
                        <option value="">Select creator...</option>
                        {applications.map(a => {
                          const id = a.influencer?._id || a._id;
                          const name = a.influencer?.name || a.name || "Creator";
                          return <option key={id} value={id}>{name}</option>;
                        })}
                      </select>
                }
                {form.creatorName && (
                  <div className="cc-creator-card">
                    <div className="cc-creator-av">{form.creatorName.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#111"}}>{form.creatorName}</div>
                      <div style={{fontSize:12,color:"#9ca3af"}}>Selected creator</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contract Details */}
          <div className="cc-card">
            <div className="cc-section">📋 Contract Details</div>
            <div className="cc-field">
              <label className="cc-label">Contract Title <span>*</span></label>
              <input className="cc-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Instagram Collaboration Contract" />
            </div>
            <div className="cc-grid2">
              <div className="cc-field">
                <label className="cc-label">Amount (₹)</label>
                <input className="cc-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="5000" />
              </div>
              <div className="cc-field">
                <label className="cc-label">Deadline</label>
                <input className="cc-input" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Deliverables */}
          <div className="cc-card">
            <div className="cc-section">✅ Deliverables</div>
            {form.deliverables.map((d,i)=>(
              <div key={i} className="cc-del-row">
                <input className="cc-input" value={d} onChange={e=>updateDeliverable(i,e.target.value)} placeholder={`Deliverable ${i+1}`} style={{margin:0}} />
                {form.deliverables.length > 1 && <button className="cc-del-rm" onClick={()=>removeDeliverable(i)}>✕</button>}
              </div>
            ))}
            <button className="cc-add" onClick={addDeliverable}>+ Add Deliverable</button>
          </div>

          {/* Terms */}
          <div className="cc-card">
            <div className="cc-section">📜 Terms & Conditions</div>
            <textarea className="cc-textarea" rows={12} value={form.terms}
              onChange={e=>setForm(f=>({...f,terms:e.target.value}))} />
          </div>

          {/* Contract Preview */}
          <div className="cc-card">
            <div className="cc-section">👁 Contract Preview</div>
            <div className="cc-preview">
              <div className="cc-preview-header">
                <div className="cc-preview-logo">Influex</div>
                <div className="cc-preview-badge">AGREEMENT</div>
              </div>
              <div className="cc-preview-title">{form.title || "Contract Title"}</div>
              <div className="cc-preview-parties">
                <div className="cc-preview-party">
                  <div className="cc-preview-party-lbl">Brand (Party A)</div>
                  <div className="cc-preview-party-val">Your Brand</div>
                </div>
                <div className="cc-preview-party">
                  <div className="cc-preview-party-lbl">Creator (Party B)</div>
                  <div className="cc-preview-party-val">{form.creatorName || "—"}</div>
                </div>
              </div>
              {form.amount && <div style={{fontSize:14,fontWeight:700,color:"#4f46e5",marginBottom:12}}>Amount: ₹{Number(form.amount).toLocaleString()}</div>}
              {form.deliverables.filter(Boolean).length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Deliverables</div>
                  {form.deliverables.filter(Boolean).map((d,i)=>(
                    <div key={i} style={{fontSize:13,color:"#444",padding:"4px 0",borderBottom:"1px solid #f0f0f0",display:"flex",gap:8}}>
                      <span style={{color:"#4f46e5",fontWeight:700}}>{i+1}.</span> {d}
                    </div>
                  ))}
                </div>
              )}
              <div className="cc-preview-terms">{form.terms}</div>
              <div className="cc-preview-sig-area">
                <div>
                  <div className="cc-preview-sig" />
                  <div className="cc-preview-sig-lbl">Brand Signature</div>
                </div>
                <div>
                  <div className="cc-preview-sig" />
                  <div className="cc-preview-sig-lbl">Creator Signature</div>
                </div>
              </div>
            </div>
          </div>

          {/* Send toggle */}
          <div className="cc-toggle-row" onClick={()=>setForm(f=>({...f,sendImmediately:!f.sendImmediately}))}>
            <div>
              <div className="cc-toggle-label">Send immediately to creator</div>
              <div className="cc-toggle-sub">Creator will get notified and can sign right away</div>
            </div>
            <div className={`cc-toggle ${form.sendImmediately?"on":""}`}>
              <div className="cc-toggle-knob" />
            </div>
          </div>

          {/* Actions */}
          <div className="cc-actions">
            <button className="cc-btn-draft" disabled={submitting} onClick={()=>{setForm(f=>({...f,sendImmediately:false}));handleSubmit();}}>
              💾 Save Draft
            </button>
            <button className="cc-btn-send" disabled={submitting} onClick={()=>{setForm(f=>({...f,sendImmediately:true}));setTimeout(handleSubmit,50);}}>
              {submitting ? "Sending..." : "📤 Send to Creator →"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}

export default function CreateContractPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <CreateContractPageInner />
    </Suspense>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// const DEFAULT_TERMS = `1. SCOPE OF WORK
// The Creator agrees to produce the deliverables as specified in this contract.

// 2. PAYMENT
// The Brand agrees to pay the agreed amount upon successful completion and approval of deliverables.

// 3. TIMELINE
// All deliverables must be submitted by the agreed deadline.

// 4. CONTENT RIGHTS
// The Brand receives a non-exclusive license to use the content for marketing purposes.

// 5. CONFIDENTIALITY
// Both parties agree to keep the terms of this agreement confidential.

// 6. REVISIONS
// Creator agrees to provide up to 2 revisions of submitted content.`;

// export default function CreateContractPage() {
//   const router = useRouter();
//   const [token, setToken]       = useState("");
//   const [campaigns, setCampaigns] = useState<any[]>([]);
//   const [applications, setApplications] = useState<any[]>([]);
//   const [loadingApps, setLoadingApps]   = useState(false);
//   const [submitting, setSubmitting]     = useState(false);
//   const [toast, setToast] = useState<{msg:string;type:"success"|"error"}|null>(null);

//   const [form, setForm] = useState({
//     campaignId: "", creatorId: "", creatorName: "",
//     title: "", amount: "", deadline: "",
//     deliverables: [""],
//     terms: DEFAULT_TERMS,
//     sendImmediately: false,
//   });

//   const showToast = (msg:string, type:"success"|"error"="success") => {
//     setToast({msg,type}); setTimeout(()=>setToast(null),4000);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const p = JSON.parse(raw);
//     if (p.role?.toLowerCase() !== "brand") { router.push("/contracts"); return; }
//     setToken(p.token);
//     fetchCampaigns(p.token);
//   }, []);

//   const fetchCampaigns = async (t:string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       setCampaigns(data.data || data.campaigns || []);
//     } catch {}
//   };

//   const fetchApplications = async (campaignId:string) => {
//     setLoadingApps(true);
//     try {
//       const res = await fetch(`${API}/campaigns/${campaignId}/applications`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       setApplications(data.applications || data.data || []);
//     } catch { setApplications([]); }
//     finally { setLoadingApps(false); }
//   };

//   const handleCampaignChange = (cid:string) => {
//     const camp = campaigns.find(c=>c._id===cid);
//     setForm(f=>({...f, campaignId:cid, title: camp?`Contract — ${camp.title}`:"", creatorId:"", creatorName:""}));
//     if (cid) fetchApplications(cid);
//     else setApplications([]);
//   };

//   const handleCreatorChange = (cid:string) => {
//     const app = applications.find(a=>(a.influencer?._id||a._id)===cid);
//     setForm(f=>({...f, creatorId:cid, creatorName: app?.influencer?.name||app?.name||""}));
//   };

//   const addDeliverable    = () => setForm(f=>({...f, deliverables:[...f.deliverables,""]}));
//   const updateDeliverable = (i:number,v:string) => setForm(f=>{ const d=[...f.deliverables]; d[i]=v; return{...f,deliverables:d}; });
//   const removeDeliverable = (i:number) => setForm(f=>({...f, deliverables:f.deliverables.filter((_,idx)=>idx!==i)}));

//   const handleSubmit = async () => {
//     if (!form.campaignId || !form.creatorId || !form.title) {
//       showToast("Fill all required fields", "error"); return;
//     }
//     setSubmitting(true);
//     try {
//       const res = await fetch(`${API}/contract/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           campaignId: form.campaignId,
//           creatorId: form.creatorId,
//           title: form.title,
//           amount: Number(form.amount) || 0,
//           deadline: form.deadline,
//           deliverables: form.deliverables.filter(Boolean),
//           terms: form.terms,
//           sendImmediately: form.sendImmediately,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed");
//       showToast(form.sendImmediately ? "Contract sent to creator! ✓" : "Contract saved as draft ✓", "success");
//       setTimeout(() => router.push("/contracts"), 1500);
//     } catch (err:any) { showToast(err.message || "Something went wrong", "error"); }
//     finally { setSubmitting(false); }
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
//         .cc { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
//         .cc-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; }
//         .cc-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
//         .cc-back:hover { background: #ebebeb; }
//         .cc-title { font-size: 20px; font-weight: 800; color: #111; }
//         .cc-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 20px; }
//         .cc-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
//         .cc-section { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
//         .cc-field { margin-bottom: 16px; }
//         .cc-field:last-child { margin-bottom: 0; }
//         .cc-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
//         .cc-label span { color: #ef4444; }
//         .cc-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border-color 0.2s; color: #111; background: #fff; }
//         .cc-input:focus { border-color: #4f46e5; }
//         .cc-select { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; cursor: pointer; color: #111; background: #fff; }
//         .cc-textarea { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1.5px solid #ebebeb; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; resize: vertical; color: #111; line-height: 1.7; }
//         .cc-textarea:focus { border-color: #4f46e5; }
//         .cc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
//         @media(max-width:480px){ .cc-grid2{ grid-template-columns: 1fr; } }
//         .cc-del-row { display: flex; gap: 8px; margin-bottom: 8px; align-items: center; }
//         .cc-del-rm { width: 34px; height: 34px; border-radius: 8px; border: 1.5px solid #fecaca; background: #fff5f5; color: #ef4444; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
//         .cc-add { padding: 8px 14px; border-radius: 8px; border: 1.5px dashed #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; width: 100%; margin-top: 4px; }
//         .cc-preview { background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 14px; padding: 20px 22px; }
//         .cc-preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #e8e8e8; }
//         .cc-preview-logo { font-size: 22px; font-weight: 800; color: #4f46e5; }
//         .cc-preview-badge { padding: 4px 12px; background: #eef2ff; color: #4f46e5; border-radius: 100px; font-size: 11px; font-weight: 700; border: 1px solid #c7d2fe; }
//         .cc-preview-title { font-size: 18px; font-weight: 800; color: #111; margin-bottom: 14px; }
//         .cc-preview-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
//         .cc-preview-party { background: #fff; border-radius: 10px; padding: 10px 14px; border: 1px solid #ebebeb; }
//         .cc-preview-party-lbl { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .cc-preview-party-val { font-size: 14px; font-weight: 700; color: #111; }
//         .cc-preview-terms { font-size: 12px; color: #666; line-height: 1.8; white-space: pre-line; max-height: 200px; overflow-y: auto; }
//         .cc-preview-sig-area { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 20px; padding-top: 16px; border-top: 1px dashed #e0e0e0; }
//         .cc-preview-sig { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 6px; min-height: 40px; }
//         .cc-preview-sig-lbl { font-size: 11px; color: #aaa; }
//         .cc-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #f9f9f8; border-radius: 12px; border: 1.5px solid #ebebeb; cursor: pointer; }
//         .cc-toggle-label { font-size: 14px; font-weight: 600; color: #111; }
//         .cc-toggle-sub { font-size: 12px; color: #aaa; margin-top: 2px; }
//         .cc-toggle { width: 44px; height: 24px; border-radius: 100px; background: #e0e0e0; position: relative; transition: background 0.2s; flex-shrink: 0; }
//         .cc-toggle.on { background: #4f46e5; }
//         .cc-toggle-knob { width: 20px; height: 20px; border-radius: 50%; background: #fff; position: absolute; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
//         .cc-toggle.on .cc-toggle-knob { transform: translateX(20px); }
//         .cc-actions { display: flex; gap: 10px; }
//         .cc-btn-draft { flex:1; padding:14px; border-radius:14px; background:#f5f5f3; color:#555; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
//         .cc-btn-draft:hover { background: #ebebeb; }
//         .cc-btn-send { flex:1; padding:14px; border-radius:14px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.3); }
//         .cc-btn-send:hover:not(:disabled) { transform:translateY(-1px); }
//         .cc-btn-send:disabled { opacity:0.6; cursor:not-allowed; }
//         .cc-creator-card { background: linear-gradient(135deg,#eef2ff,#f5f3ff); border: 1.5px solid #c7d2fe; border-radius: 12px; padding: 12px 14px; display: flex; align-items: center; gap: 10px; margin-top: 10px; }
//         .cc-creator-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 14px; font-weight: 800; flex-shrink: 0; }
//         .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:9999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
//         .toast.success { background:#111; color:#fff; }
//         .toast.error   { background:#ef4444; color:#fff; }
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cc">
//         <div className="cc-header">
//           <a href="/contracts" className="cc-back">← Back</a>
//           <div className="cc-title">Create Contract</div>
//         </div>

//         <div className="cc-body">

//           {/* Campaign & Creator */}
//           <div className="cc-card">
//             <div className="cc-section">🎯 Campaign & Creator</div>
//             <div className="cc-field">
//               <label className="cc-label">Campaign <span>*</span></label>
//               <select className="cc-select" value={form.campaignId} onChange={e=>handleCampaignChange(e.target.value)}>
//                 <option value="">Select campaign...</option>
//                 {campaigns.map(c=><option key={c._id} value={c._id}>{c.title}</option>)}
//               </select>
//             </div>
//             {form.campaignId && (
//               <div className="cc-field">
//                 <label className="cc-label">Creator <span>*</span></label>
//                 {loadingApps
//                   ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading...</div>
//                   : applications.length === 0
//                     ? <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>No applications found</div>
//                     : <select className="cc-select" value={form.creatorId} onChange={e=>handleCreatorChange(e.target.value)}>
//                         <option value="">Select creator...</option>
//                         {applications.map(a => {
//                           const id = a.influencer?._id || a._id;
//                           const name = a.influencer?.name || a.name || "Creator";
//                           return <option key={id} value={id}>{name}</option>;
//                         })}
//                       </select>
//                 }
//                 {form.creatorName && (
//                   <div className="cc-creator-card">
//                     <div className="cc-creator-av">{form.creatorName.charAt(0).toUpperCase()}</div>
//                     <div>
//                       <div style={{fontSize:14,fontWeight:700,color:"#111"}}>{form.creatorName}</div>
//                       <div style={{fontSize:12,color:"#9ca3af"}}>Selected creator</div>
//                     </div>
//                   </div>
//                 )}
//               </div>
//             )}
//           </div>

//           {/* Contract Details */}
//           <div className="cc-card">
//             <div className="cc-section">📋 Contract Details</div>
//             <div className="cc-field">
//               <label className="cc-label">Contract Title <span>*</span></label>
//               <input className="cc-input" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Instagram Collaboration Contract" />
//             </div>
//             <div className="cc-grid2">
//               <div className="cc-field">
//                 <label className="cc-label">Amount (₹)</label>
//                 <input className="cc-input" type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="5000" />
//               </div>
//               <div className="cc-field">
//                 <label className="cc-label">Deadline</label>
//                 <input className="cc-input" type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} />
//               </div>
//             </div>
//           </div>

//           {/* Deliverables */}
//           <div className="cc-card">
//             <div className="cc-section">✅ Deliverables</div>
//             {form.deliverables.map((d,i)=>(
//               <div key={i} className="cc-del-row">
//                 <input className="cc-input" value={d} onChange={e=>updateDeliverable(i,e.target.value)} placeholder={`Deliverable ${i+1}`} style={{margin:0}} />
//                 {form.deliverables.length > 1 && <button className="cc-del-rm" onClick={()=>removeDeliverable(i)}>✕</button>}
//               </div>
//             ))}
//             <button className="cc-add" onClick={addDeliverable}>+ Add Deliverable</button>
//           </div>

//           {/* Terms */}
//           <div className="cc-card">
//             <div className="cc-section">📜 Terms & Conditions</div>
//             <textarea className="cc-textarea" rows={12} value={form.terms}
//               onChange={e=>setForm(f=>({...f,terms:e.target.value}))} />
//           </div>

//           {/* Contract Preview */}
//           <div className="cc-card">
//             <div className="cc-section">👁 Contract Preview</div>
//             <div className="cc-preview">
//               <div className="cc-preview-header">
//                 <div className="cc-preview-logo">Influex</div>
//                 <div className="cc-preview-badge">AGREEMENT</div>
//               </div>
//               <div className="cc-preview-title">{form.title || "Contract Title"}</div>
//               <div className="cc-preview-parties">
//                 <div className="cc-preview-party">
//                   <div className="cc-preview-party-lbl">Brand (Party A)</div>
//                   <div className="cc-preview-party-val">Your Brand</div>
//                 </div>
//                 <div className="cc-preview-party">
//                   <div className="cc-preview-party-lbl">Creator (Party B)</div>
//                   <div className="cc-preview-party-val">{form.creatorName || "—"}</div>
//                 </div>
//               </div>
//               {form.amount && <div style={{fontSize:14,fontWeight:700,color:"#4f46e5",marginBottom:12}}>Amount: ₹{Number(form.amount).toLocaleString()}</div>}
//               {form.deliverables.filter(Boolean).length > 0 && (
//                 <div style={{marginBottom:12}}>
//                   <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Deliverables</div>
//                   {form.deliverables.filter(Boolean).map((d,i)=>(
//                     <div key={i} style={{fontSize:13,color:"#444",padding:"4px 0",borderBottom:"1px solid #f0f0f0",display:"flex",gap:8}}>
//                       <span style={{color:"#4f46e5",fontWeight:700}}>{i+1}.</span> {d}
//                     </div>
//                   ))}
//                 </div>
//               )}
//               <div className="cc-preview-terms">{form.terms}</div>
//               <div className="cc-preview-sig-area">
//                 <div>
//                   <div className="cc-preview-sig" />
//                   <div className="cc-preview-sig-lbl">Brand Signature</div>
//                 </div>
//                 <div>
//                   <div className="cc-preview-sig" />
//                   <div className="cc-preview-sig-lbl">Creator Signature</div>
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Send toggle */}
//           <div className="cc-toggle-row" onClick={()=>setForm(f=>({...f,sendImmediately:!f.sendImmediately}))}>
//             <div>
//               <div className="cc-toggle-label">Send immediately to creator</div>
//               <div className="cc-toggle-sub">Creator will get notified and can sign right away</div>
//             </div>
//             <div className={`cc-toggle ${form.sendImmediately?"on":""}`}>
//               <div className="cc-toggle-knob" />
//             </div>
//           </div>

//           {/* Actions */}
//           <div className="cc-actions">
//             <button className="cc-btn-draft" disabled={submitting} onClick={()=>{setForm(f=>({...f,sendImmediately:false}));handleSubmit();}}>
//               💾 Save Draft
//             </button>
//             <button className="cc-btn-send" disabled={submitting} onClick={()=>{setForm(f=>({...f,sendImmediately:true}));setTimeout(handleSubmit,50);}}>
//               {submitting ? "Sending..." : "📤 Send to Creator →"}
//             </button>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }