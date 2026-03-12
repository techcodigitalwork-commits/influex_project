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
  const searchParams = useSearchParams();

  const [token, setToken]             = useState("");
  const [campaigns, setCampaigns]     = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [toast, setToast]             = useState<{msg:string;type:"success"|"error"}|null>(null);

  const [form, setForm] = useState({
    campaignId: "", influencerId: "", creatorName: "", dealId: "",
    title: "", amount: "", deadline: "",
    deliverables: [""],
    terms: DEFAULT_TERMS,
  });

  const showToast = (msg:string, type:"success"|"error"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    if (p.role?.toLowerCase() !== "brand") { router.push("/contracts"); return; }
    setToken(p.token);
    fetchCampaigns(p.token);

    const campId    = searchParams.get("campaignId") || "";
    const creatorId = searchParams.get("creatorId")  || "";
    const dealId    = searchParams.get("dealId")     || "";

    if (campId || creatorId || dealId) {
      setForm(f => ({
        ...f,
        campaignId:  campId    || f.campaignId,
        influencerId:creatorId || f.influencerId,
        dealId:      dealId    || f.dealId,
      }));
      if (campId) fetchApplications(campId, p.token);
    }
  }, []);

  const fetchCampaigns = async (t:string) => {
    try {
      const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setCampaigns(data.data || data.campaigns || []);
    } catch {}
  };

  const fetchApplications = async (campaignId:string, t?:string) => {
    if (!campaignId) return;
    setLoadingApps(true);
    try {
      const res  = await fetch(`${API}/campaigns/${campaignId}/applications`, {
        headers: { Authorization: `Bearer ${t || token}` }
      });
      const data = await res.json();
      const raw  = Array.isArray(data) ? data
        : Array.isArray(data.applications) ? data.applications
        : Array.isArray(data.data) ? data.data : [];
      setApplications(raw);
    } catch { setApplications([]); }
    finally { setLoadingApps(false); }
  };

  const handleCampaignChange = (cid:string) => {
    const camp = campaigns.find(c => c._id === cid);
    setForm(f => ({...f, campaignId:cid, title: camp ? `Contract — ${camp.title}` : "", influencerId:"", creatorName:""}));
    if (cid) fetchApplications(cid);
    else setApplications([]);
  };

  const handleCreatorChange = (cid:string) => {
    const app  = applications.find(a => (a.influencer?._id || a._id) === cid);
    const name = app?.influencer?.name || app?.name || "";
    setForm(f => ({...f, influencerId:cid, creatorName:name}));
  };

  const addDeliverable    = () => setForm(f => ({...f, deliverables:[...f.deliverables,""]}));
  const updateDeliverable = (i:number, v:string) => setForm(f => { const d=[...f.deliverables]; d[i]=v; return{...f,deliverables:d}; });
  const removeDeliverable = (i:number) => setForm(f => ({...f, deliverables:f.deliverables.filter((_,idx)=>idx!==i)}));

  // FIX: accept sendImmediately as direct param — no stale closure issue
  const handleSubmit = async (sendNow: boolean) => {
    if (!form.campaignId)   { showToast("Select a campaign", "error"); return; }
    if (!form.influencerId) { showToast("Select a creator", "error"); return; }
    if (!form.title)        { showToast("Enter contract title", "error"); return; }

    setSubmitting(true);
    try {
      // STEP 1: Create contract
      const res  = await fetch(`${API}/contract/create`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({
          dealId:       form.dealId || undefined,
          influencerId: form.influencerId,
          deliverables: form.deliverables.filter(Boolean).join("\n"),
          timeline:     form.deadline || "",
          amount:       Number(form.amount) || 0,
          title:        form.title,
          campaignId:   form.campaignId,
          terms:        form.terms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create contract");

      const newId = data.contract?._id || data.data?._id || data._id || null;

      // STEP 2: If sendNow, send to creator
      if (sendNow && newId) {
        try {
          await fetch(`${API}/contract/${newId}/send`, {
            method:  "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
        } catch {} // non-fatal — contract created, just send failed
      }

      showToast(sendNow ? "✅ Contract sent to creator!" : "💾 Contract saved as draft!", "success");

      // STEP 3: Redirect to contract detail or list
      setTimeout(() => {
        if (newId) router.push(`/contracts/${newId}`);
        else router.push("/contracts");
      }, 900);

    } catch(err:any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .cc{font-family:'Plus Jakarta Sans',sans-serif;background:#f7f7f5;min-height:100vh;padding-bottom:48px}
        .cc-header{background:#fff;border-bottom:1px solid #efefef;padding:20px 32px;display:flex;align-items:center;gap:14px}
        .cc-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:#555;text-decoration:none}
        .cc-back:hover{background:#ebebeb}
        .cc-title{font-size:20px;font-weight:800;color:#111}
        .cc-body{max-width:680px;margin:28px auto;padding:0 20px;display:flex;flex-direction:column;gap:20px}
        .cc-card{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:24px}
        .cc-section{font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.07em;margin-bottom:16px;display:flex;align-items:center;gap:8px}
        .cc-field{margin-bottom:16px}
        .cc-field:last-child{margin-bottom:0}
        .cc-label{font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;display:block}
        .cc-label span{color:#ef4444}
        .cc-input{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #ebebeb;font-size:14px;font-family:inherit;outline:none;transition:border-color .2s;color:#111;background:#fff}
        .cc-input:focus{border-color:#4f46e5}
        .cc-select{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #ebebeb;font-size:14px;font-family:inherit;outline:none;cursor:pointer;color:#111;background:#fff}
        .cc-textarea{width:100%;padding:11px 14px;border-radius:10px;border:1.5px solid #ebebeb;font-size:13px;font-family:inherit;outline:none;resize:vertical;color:#111;line-height:1.7}
        .cc-textarea:focus{border-color:#4f46e5}
        .cc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:480px){.cc-grid2{grid-template-columns:1fr}}
        .cc-del-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}
        .cc-del-rm{width:34px;height:34px;border-radius:8px;border:1.5px solid #fecaca;background:#fff5f5;color:#ef4444;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cc-add{padding:8px 14px;border-radius:8px;border:1.5px dashed #c7d2fe;background:#eef2ff;color:#4f46e5;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;width:100%;margin-top:4px}
        .cc-preview{background:#fafafa;border:1.5px solid #e8e8e8;border-radius:14px;padding:20px 22px}
        .cc-preview-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid #e8e8e8}
        .cc-preview-logo{font-size:22px;font-weight:800;color:#4f46e5}
        .cc-preview-badge{padding:4px 12px;background:#eef2ff;color:#4f46e5;border-radius:100px;font-size:11px;font-weight:700;border:1px solid #c7d2fe}
        .cc-preview-title{font-size:18px;font-weight:800;color:#111;margin-bottom:14px}
        .cc-preview-parties{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
        .cc-preview-party{background:#fff;border-radius:10px;padding:10px 14px;border:1px solid #ebebeb}
        .cc-preview-party-lbl{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:.07em;font-weight:600;margin-bottom:4px}
        .cc-preview-party-val{font-size:14px;font-weight:700;color:#111}
        .cc-preview-terms{font-size:12px;color:#666;line-height:1.8;white-space:pre-line;max-height:200px;overflow-y:auto}
        .cc-preview-sig-area{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px;padding-top:16px;border-top:1px dashed #e0e0e0}
        .cc-preview-sig{border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:6px;min-height:40px}
        .cc-preview-sig-lbl{font-size:11px;color:#aaa}
        .cc-creator-card{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1.5px solid #c7d2fe;border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;margin-top:10px}
        .cc-creator-av{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800;flex-shrink:0}
        .cc-actions{display:flex;gap:10px}
        .cc-btn-draft{flex:1;padding:14px;border-radius:14px;background:#f5f5f3;color:#555;font-size:15px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s}
        .cc-btn-draft:hover:not(:disabled){background:#ebebeb}
        .cc-btn-draft:disabled{opacity:.6;cursor:not-allowed}
        .cc-btn-send{flex:1;padding:14px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s;box-shadow:0 4px 16px rgba(79,70,229,.3)}
        .cc-btn-send:hover:not(:disabled){transform:translateY(-1px)}
        .cc-btn-send:disabled{opacity:.6;cursor:not-allowed}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
        .toast.success{background:#111;color:#fff}
        .toast.error{background:#ef4444;color:#fff}
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
                {loadingApps ? (
                  <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>Loading creators...</div>
                ) : applications.length === 0 ? (
                  <div style={{fontSize:13,color:"#aaa",padding:"10px 0"}}>⚠️ No applications found for this campaign</div>
                ) : (
                  <select className="cc-select" value={form.influencerId} onChange={e=>handleCreatorChange(e.target.value)}>
                    <option value="">Select creator...</option>
                    {applications.map(a => {
                      const aid  = a.influencer?._id || a._id;
                      const name = a.influencer?.name || a.name || "Creator";
                      return <option key={aid} value={aid}>{name}</option>;
                    })}
                  </select>
                )}
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
                <input className="cc-input" value={d} onChange={e=>updateDeliverable(i,e.target.value)} placeholder={`Deliverable ${i+1}`} style={{margin:0}}/>
                {form.deliverables.length > 1 && <button className="cc-del-rm" onClick={()=>removeDeliverable(i)}>✕</button>}
              </div>
            ))}
            <button className="cc-add" onClick={addDeliverable}>+ Add Deliverable</button>
          </div>

          {/* Terms */}
          <div className="cc-card">
            <div className="cc-section">📜 Terms & Conditions</div>
            <textarea className="cc-textarea" rows={12} value={form.terms} onChange={e=>setForm(f=>({...f,terms:e.target.value}))}/>
          </div>

          {/* Preview */}
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
                  <div style={{fontSize:11,fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Deliverables</div>
                  {form.deliverables.filter(Boolean).map((d,i)=>(
                    <div key={i} style={{fontSize:13,color:"#444",padding:"4px 0",borderBottom:"1px solid #f0f0f0",display:"flex",gap:8}}>
                      <span style={{color:"#4f46e5",fontWeight:700}}>{i+1}.</span> {d}
                    </div>
                  ))}
                </div>
              )}
              <div className="cc-preview-terms">{form.terms}</div>
              <div className="cc-preview-sig-area">
                <div><div className="cc-preview-sig"/><div className="cc-preview-sig-lbl">Brand Signature</div></div>
                <div><div className="cc-preview-sig"/><div className="cc-preview-sig-lbl">Creator Signature</div></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="cc-actions">
            <button className="cc-btn-draft" disabled={submitting} onClick={() => handleSubmit(false)}>
              {submitting ? "Saving..." : "💾 Save Draft"}
            </button>
            <button className="cc-btn-send" disabled={submitting} onClick={() => handleSubmit(true)}>
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
// import Link from "next/link";

// const API = "http://54.252.201.93:5000/api";

// export default function ContractsPage() {
//   const router = useRouter();
//   const [contracts, setContracts] = useState<any[]>([]);
//   const [loading, setLoading]     = useState(true);
//   const [role, setRole]           = useState("");
//   const [token, setToken]         = useState("");

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     setToken(parsed.token);
//     setRole(parsed.role?.toLowerCase() || "");
//     fetchContracts(parsed.token);
//   }, []);

//   const fetchContracts = async (t: string) => {
//     try {
//       // GET /api/contract/my  — returns brand's contracts
//       const res  = await fetch(`${API}/contract/my`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed");
//       const list = data.contracts || data.data || data || [];
//       // Sort: newest first
//       list.sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
//       setContracts(list);
//     } catch { setContracts([]); }
//     finally { setLoading(false); }
//   };

//   // Schema status enum: "pending" | "signed"
//   const getPartyName = (party: any): string => {
//     if (!party) return "—";
//     if (typeof party === "string") return "—";
//     return party.name || party.username || party.email?.split("@")[0] || "—";
//   };
//   const getPartyAvatar = (party: any): string => {
//     if (!party || typeof party === "string") return "";
//     return party.profileImage || party.avatar || party.photo || "";
//   };

//   const [sending, setSending] = useState<string|null>(null);

//   const handleSend = async (contractId: string) => {
//     setSending(contractId);
//     try {
//       const res = await fetch(`${API}/contract/${contractId}/send`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed to send");
//       // Update local state
//       setContracts(prev => prev.map(c => c._id === contractId ? {...c, status:"pending"} : c));
//       alert("Contract sent to creator successfully!");
//     } catch (err: any) {
//       alert(err.message || "Failed to send contract");
//     } finally { setSending(null); }
//   };

//   // Schema: only "pending" | "signed" — no "draft" status
//   const statusMeta: Record<string, {bg:string;color:string;label:string}> = {
//     draft:    { bg:"#fffbeb",  color:"#d97706", label:"Pending" },
//     sent:     { bg:"#fffbeb",  color:"#d97706", label:"Awaiting Signature" },
//     signed:   { bg:"#f0fdf4",  color:"#16a34a", label:"Signed ✓" },
//     rejected: { bg:"#fff5f5",  color:"#dc2626", label:"Rejected" },
//     expired:  { bg:"#f5f5f5",  color:"#aaa",    label:"Expired" },
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
//         .ct { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }
//         .ct-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
//         @media(max-width:600px){ .ct-header{ padding: 14px 16px; } }
//         .ct-title { font-size: 22px; font-weight: 800; color: #111; }
//         .ct-sub   { font-size: 13px; color: #aaa; margin-top: 2px; }
//         .ct-create-btn { padding: 10px 20px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); font-family: 'Plus Jakarta Sans', sans-serif; }
//         .ct-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .ct-stats { display: flex; gap: 12px; padding: 16px 32px 0; flex-wrap: wrap; }
//         @media(max-width:600px){ .ct-stats{ padding: 12px 16px 0; gap:10px; } }
//         .ct-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
//         .ct-stat-val { font-size: 20px; font-weight: 800; color: #111; }
//         .ct-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }
//         .ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 20px 32px 40px; }
//         @media(max-width:768px){ .ct-grid{ grid-template-columns:1fr; padding: 14px 16px 28px; gap:12px; } }
//         .ct-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 22px; transition: all 0.22s; animation: fadeUp 0.3s ease both; position: relative; overflow: hidden; cursor: pointer; }
//         .ct-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#4f46e5,#7c3aed); opacity:0; transition:opacity 0.2s; }
//         .ct-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .ct-card:hover::before { opacity:1; }
//         .ct-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
//         .ct-card-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
//         .ct-card-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
//         .ct-card-sub   { font-size: 12px; color: #aaa; }
//         .ct-status-badge { padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
//         .ct-parties { display: flex; gap: 8px; margin-bottom: 14px; }
//         .ct-party { flex:1; background:#f9f9f8; border-radius:10px; padding:9px 12px; border:1px solid #f0f0f0; }
//         .ct-party-lbl { font-size:10px; color:#c0c0c0; text-transform:uppercase; letter-spacing:0.07em; font-weight:600; margin-bottom:3px; }
//         .ct-party-val { font-size:13px; font-weight:700; color:#111; }
//         .ct-party-sig { font-size:11px; color:#16a34a; margin-top:2px; font-weight:600; }
//         .ct-party-sig.pending { color:#f59e0b; }
//         .ct-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
//         .ct-meta-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f9f9f8; border-radius: 8px; font-size: 12px; color: #666; font-weight: 500; border: 1px solid #f0f0f0; }
//         .ct-actions { display: flex; gap: 8px; }
//         .ct-btn { flex:1; padding:10px; border-radius:10px; font-size:12px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:4px; }
//         .ct-btn-view   { background:#eef2ff; color:#4f46e5; }
//         .ct-btn-view:hover { background:#e0e7ff; }
//         .ct-btn-sign   { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; box-shadow:0 2px 8px rgba(34,197,94,0.25); }
//         .ct-btn-sign:hover { transform:translateY(-1px); }
//         .ct-btn-send   { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; }
//         .ct-btn-send:hover { transform:translateY(-1px); }
//         .ct-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:70px 24px; text-align:center; margin:20px 32px; background:#fff; border-radius:18px; border:1.5px dashed #e0e0e0; }
//         .ct-empty-icon  { font-size:48px; margin-bottom:16px; }
//         .ct-empty-title { font-size:20px; font-weight:800; color:#111; margin:0 0 8px; }
//         .ct-empty-sub   { color:#aaa; font-size:14px; margin:0 0 24px; max-width:280px; line-height:1.6; }
//         .spinner { width:28px; height:28px; border:3px solid #e0e0e0; border-top-color:#4f46e5; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; display:block; }
//       `}</style>

//       <div className="ct">
//         <div className="ct-header">
//           <div>
//             <div className="ct-title">Contracts</div>
//             <div className="ct-sub">{contracts.length} contract{contracts.length !== 1 ? "s" : ""} total</div>
//           </div>
//           {role === "brand" && <Link href="/contracts/create" className="ct-create-btn">+ Create Contract</Link>}
//         </div>

//         {contracts.length > 0 && (
//           <div className="ct-stats">
//             <div className="ct-stat"><span style={{fontSize:18}}>📄</span><div><div className="ct-stat-val">{contracts.length}</div><div className="ct-stat-lbl">Total</div></div></div>
//             <div className="ct-stat"><span style={{fontSize:18}}>✅</span><div><div className="ct-stat-val">{contracts.filter(c=>c.status==="signed").length}</div><div className="ct-stat-lbl">Signed</div></div></div>
//             <div className="ct-stat"><span style={{fontSize:18}}>⏳</span><div><div className="ct-stat-val">{contracts.filter(c=>c.status==="pending").length}</div><div className="ct-stat-lbl">Pending</div></div></div>
//             <div className="ct-stat"><span style={{fontSize:18}}>💰</span><div><div className="ct-stat-val">₹{contracts.reduce((s:number,c:any)=>s+Number(c.amount||0),0).toLocaleString("en-IN")}</div><div className="ct-stat-lbl">Total Value</div></div></div>
//           </div>
//         )}

//         {loading ? <div className="spinner" /> :
//           contracts.length === 0 ? (
//             <div className="ct-empty">
//               <div className="ct-empty-icon">📄</div>
//               <h3 className="ct-empty-title">No contracts yet</h3>
//               <p className="ct-empty-sub">{role === "brand" ? "Create a contract and send it to a creator for signing" : "Contracts from brands will appear here for your signature"}</p>
//               {role === "brand" && <Link href="/contracts/create" className="ct-create-btn">+ Create Contract</Link>}
//             </div>
//           ) : (
//             <div className="ct-grid">
//               {contracts.map((c, idx) => {
//                 const sm = statusMeta[c.status] || statusMeta.draft;
//                 const brandSigned   = c.brandSigned || c.status === "signed";
//                 const creatorSigned = c.creatorSigned || c.status === "signed";
//                 const needsMySign   = (role === "influencer" || role === "creator") && c.status === "pending" && !c.creatorSigned;
//                 return (
//                   <div key={c._id} className="ct-card" style={{animationDelay:`${idx*0.06}s`}}
//                     onClick={() => router.push(`/contracts/${c._id}`)}>
//                     <div className="ct-card-top">
//                       <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
//                         <div className="ct-card-icon">📄</div>
//                         <div>
//                           <div className="ct-card-title">{c.title || "Contract"}</div>
//                           <div className="ct-card-sub">#{c._id?.slice(-6)} · {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : ""}</div>
//                         </div>
//                       </div>
//                       <div className="ct-status-badge" style={{background:sm.bg,color:sm.color,border:`1px solid ${sm.color}33`}}>{sm.label}</div>
//                     </div>

//                     <div className="ct-parties">
//                       <div className="ct-party">
//                         <div className="ct-party-lbl">Brand</div>
//                         <div className="ct-party-val">{getPartyName(c.brandId) !== "—" ? getPartyName(c.brandId) : (c.brandName || "Brand")}</div>
//                         <div className={`ct-party-sig ${brandSigned ? "" : "pending"}`}>{brandSigned ? "✓ Signed" : "⏳ Pending"}</div>
//                       </div>
//                       <div className="ct-party">
//                         <div className="ct-party-lbl">Creator</div>
//                         <div className="ct-party-val">{getPartyName(c.influencerId) !== "—" ? getPartyName(c.influencerId) : (c.creatorName || "Creator")}</div>
//                         <div className={`ct-party-sig ${creatorSigned ? "" : "pending"}`}>{creatorSigned ? "✓ Signed" : "⏳ Pending"}</div>
//                       </div>
//                     </div>

//                     <div className="ct-meta">
//                       {c.amount && <span className="ct-meta-chip">💰 ₹{Number(c.amount).toLocaleString()}</span>}
//                       {(c.timeline||c.deadline) && <span className="ct-meta-chip">📅 {c.timeline || new Date(c.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>}
//                       {c.campaignTitle && <span className="ct-meta-chip">📋 {c.campaignTitle}</span>}
//                     </div>

//                     <div className="ct-actions" onClick={e=>e.stopPropagation()}>
//                       <Link href={`/contracts/${c._id}`} className="ct-btn ct-btn-view">👁 View</Link>
//                       {needsMySign && (
//                         <Link href={`/contracts/${c._id}?action=sign`} className="ct-btn ct-btn-sign">✍ Sign Now</Link>
//                       )}
//                       {role === "brand" && c.status === "pending" && (
//                         <button className="ct-btn ct-btn-send"
//                           disabled={sending === c._id}
//                           onClick={() => handleSend(c._id)}>
//                           {sending === c._id ? "Sending..." : "📤 Send"}
//                         </button>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )
//         }
//       </div>
//     </>
//   );
// }