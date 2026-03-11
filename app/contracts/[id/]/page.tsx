"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

function ContractDetailInner() {
  const { id }       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const [contract, setContract]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [token, setToken]           = useState("");
  const [role, setRole]             = useState("");
  const [userName, setUserName]     = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [showSignModal, setShowSignModal] = useState(false);
  const [signName, setSignName]     = useState("");
  const [toast, setToast] = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);

  const showToast = (msg:string, type:"success"|"error"|"warn"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    setToken(p.token);
    setRole(p.role?.toLowerCase() || "");
    setUserName(p.name || "");
    setSignName(p.name || "");
    fetchContract(p.token);
    if (searchParams.get("action") === "sign") setTimeout(()=>setShowSignModal(true), 600);
  }, [id]);

  const fetchContract = async (t:string) => {
    try {
      // GET /api/contract/:id
      const res  = await fetch(`${API}/contract/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load contract");
      const c = data.contract || data.data || data;
      setContract(c);
    } catch {}
    finally { setLoading(false); }
  };

  const handleSign = async () => {
    if (!signName.trim()) { showToast("Enter your name to sign", "error"); return; }
    setActionLoading("sign");
    try {
      // POST /api/contract/sign
      const res = await fetch(`${API}/contract/sign`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contractId: id, signedName: signName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("✅ Contract signed successfully!", "success");
      setShowSignModal(false);
      fetchContract(token);
    } catch (err:any) { showToast(err.message || "Failed to sign", "error"); }
    finally { setActionLoading(""); }
  };

  const handleSend = async () => {
    setActionLoading("send");
    try {
      const res = await fetch(`${API}/contract/${id}/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("📤 Contract sent to creator!", "success");
      fetchContract(token);
    } catch (err:any) { showToast(err.message || "Failed", "error"); }
    finally { setActionLoading(""); }
  };

  const handleReject = async () => {
    setActionLoading("reject");
    try {
      const res = await fetch(`${API}/contract/${id}/reject`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("Contract rejected", "warn");
      fetchContract(token);
    } catch (err:any) { showToast(err.message || "Failed", "error"); }
    finally { setActionLoading(""); }
  };

  if (loading) return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Schema fields: brandId (User obj), influencerId (User obj), deliverables (string), timeline, amount, status
  const getBrandName     = () => contract.brandId?.name || contract.brandId?.username || contract.brandName || "Brand";
  const getCreatorName   = () => contract.influencerId?.name || contract.influencerId?.username || contract.creatorName || "Creator";
  const getBrandAvatar   = () => contract.brandId?.profileImage || contract.brandId?.avatar || "";
  const getCreatorAvatar = () => contract.influencerId?.profileImage || contract.influencerId?.avatar || "";
  const getDeliverables = () => {
    const d = contract.deliverables || "";
    if (typeof d === "string") return d.split("\n").filter(Boolean);
    if (Array.isArray(d)) return d;
    return [];
  };

  if (!contract) return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>📄</div><div style={{fontSize:18,fontWeight:700}}>Contract not found</div></div>
    </div>
  );

  const isSigned = contract.status === "signed";
  const brandSigned  = contract.brandSigned || isSigned;
  const creatorSigned= contract.creatorSigned || isSigned;
  const canCreatorSign = (role==="influencer"||role==="creator") && contract.status==="pending" && !contract.creatorSigned;
  const canBrandSend   = role==="brand" && contract.status==="pending";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .cd { font-family:'Plus Jakarta Sans',sans-serif; background:#f7f7f5; min-height:100vh; padding-bottom:48px; }
        .cd-header { background:#fff; border-bottom:1px solid #efefef; padding:20px 32px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .cd-back { background:#f5f5f3; border:none; border-radius:10px; padding:8px 14px; font-size:13px; font-weight:600; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; color:#555; text-decoration:none; }
        .cd-title { font-size:18px; font-weight:800; color:#111; }
        .cd-status { padding:6px 14px; border-radius:100px; font-size:12px; font-weight:700; }
        .cd-body { max-width:700px; margin:24px auto; padding:0 20px; }

        /* CONTRACT DOC */
        .cd-doc { background:#fff; border-radius:18px; border:1.5px solid #efefef; overflow:hidden; margin-bottom:16px; }
        .cd-doc-header { background:linear-gradient(135deg,#1e1b4b,#4f46e5); padding:28px 32px; }
        .cd-doc-logo   { font-size:24px; font-weight:800; color:#fff; margin-bottom:4px; }
        .cd-doc-badge  { display:inline-block; padding:3px 12px; background:rgba(255,255,255,0.15); border-radius:100px; font-size:11px; color:rgba(255,255,255,0.9); font-weight:600; }
        .cd-doc-body   { padding:28px 32px; }
        .cd-doc-title  { font-size:22px; font-weight:800; color:#111; margin-bottom:20px; }
        .cd-doc-section { font-size:11px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:8px; margin-top:20px; }
        .cd-doc-parties { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; }
        @media(max-width:480px){ .cd-doc-parties{grid-template-columns:1fr;} }
        .cd-party { background:#f9f9f8; border-radius:12px; padding:14px 16px; border:1.5px solid #ebebeb; }
        .cd-party-lbl  { font-size:10px; color:#bbb; text-transform:uppercase; letter-spacing:0.07em; font-weight:600; margin-bottom:6px; }
        .cd-party-name { font-size:16px; font-weight:800; color:#111; margin-bottom:6px; }
        .cd-party-sig  { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:100px; font-size:11px; font-weight:700; }
        .cd-party-sig.signed  { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
        .cd-party-sig.pending { background:#fffbeb; color:#d97706; border:1px solid #fde68a; }
        .cd-meta-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f5f5f5; font-size:14px; }
        .cd-meta-row:last-child { border-bottom:none; }
        .cd-meta-lbl { color:#888; font-weight:500; }
        .cd-meta-val { font-weight:700; color:#111; }
        .cd-deliverable { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-bottom:1px solid #f5f5f5; }
        .cd-deliverable:last-child { border-bottom:none; }
        .cd-del-num { width:24px; height:24px; border-radius:6px; background:#eef2ff; color:#4f46e5; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
        .cd-terms { font-size:13px; color:#555; line-height:1.8; white-space:pre-line; background:#f9f9f8; border-radius:12px; padding:16px; border:1px solid #f0f0f0; max-height:300px; overflow-y:auto; }

        /* SIGNATURE AREA */
        .cd-sig-area { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:28px; padding-top:20px; border-top:2px dashed #e0e0e0; }
        @media(max-width:480px){ .cd-sig-area{grid-template-columns:1fr;} }
        .cd-sig-box { }
        .cd-sig-line { border-bottom:2px solid #111; min-height:48px; margin-bottom:8px; padding-bottom:4px; display:flex; align-items:flex-end; }
        .cd-sig-text { font-family:'Brush Script MT',cursive; font-size:26px; color:#111; }
        .cd-sig-lbl  { font-size:11px; color:#aaa; }
        .cd-sig-date { font-size:12px; color:#888; margin-top:4px; }

        /* ACTIONS */
        .cd-actions { background:#fff; border-radius:18px; border:1.5px solid #efefef; padding:20px 24px; margin-bottom:16px; }
        .cd-action-title { font-size:13px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.07em; margin-bottom:14px; }
        .cd-btn-row { display:flex; gap:10px; flex-wrap:wrap; }
        .cd-btn { flex:1; min-width:120px; padding:13px; border-radius:12px; font-size:14px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; }
        .cd-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .cd-btn-sign   { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; box-shadow:0 4px 14px rgba(34,197,94,0.25); }
        .cd-btn-sign:hover:not(:disabled)   { transform:translateY(-1px); }
        .cd-btn-send   { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 4px 14px rgba(79,70,229,0.25); }
        .cd-btn-send:hover:not(:disabled)   { transform:translateY(-1px); }
        .cd-btn-reject { background:#fff5f5; color:#dc2626; border:1.5px solid #fecaca; }
        .cd-btn-reject:hover:not(:disabled) { background:#fee2e2; }

        /* SIGN MODAL */
        .sm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.2s; }
        .sm-box { background:#fff; border-radius:24px; max-width:420px; width:100%; padding:32px; animation:slideUp 0.25s ease; }
        .sm-title { font-size:22px; font-weight:800; color:#111; margin-bottom:6px; }
        .sm-sub   { font-size:14px; color:#777; margin-bottom:24px; line-height:1.6; }
        .sm-label { font-size:12px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:6px; display:block; }
        .sm-input { width:100%; padding:12px 14px; border-radius:10px; border:1.5px solid #ebebeb; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; outline:none; margin-bottom:12px; }
        .sm-input:focus { border-color:#4f46e5; }
        .sm-preview { background:#f9f9f8; border-radius:12px; padding:14px 16px; margin-bottom:20px; }
        .sm-preview-lbl  { font-size:11px; color:#aaa; text-transform:uppercase; letter-spacing:0.06em; font-weight:600; margin-bottom:8px; }
        .sm-sig-preview  { font-family:'Brush Script MT',cursive; font-size:32px; color:#111; border-bottom:2px solid #111; padding-bottom:6px; min-height:48px; }
        .sm-legal { font-size:12px; color:#aaa; line-height:1.6; margin-bottom:20px; padding:10px 14px; background:#fafafa; border-radius:8px; }
        .sm-actions { display:flex; gap:10px; }
        .sm-btn-cancel { flex:1; padding:13px; border-radius:12px; background:#f5f5f3; color:#555; font-size:14px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; }
        .sm-btn-sign   { flex:1; padding:13px; border-radius:12px; background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; font-size:14px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; }
        .sm-btn-sign:disabled { opacity:0.6; cursor:not-allowed; }

        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:99999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#111; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
        .toast.warn    { background:#f59e0b; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* SIGN MODAL */}
      {showSignModal && (
        <div className="sm-overlay" onClick={e=>e.target===e.currentTarget&&setShowSignModal(false)}>
          <div className="sm-box">
            <div className="sm-title">✍️ Sign Contract</div>
            <div className="sm-sub">By signing, you agree to all terms and conditions in this contract.</div>
            <label className="sm-label">Your Full Name</label>
            <input className="sm-input" value={signName} onChange={e=>setSignName(e.target.value)} placeholder="Type your name to sign" />
            <div className="sm-preview">
              <div className="sm-preview-lbl">Signature Preview</div>
              <div className="sm-sig-preview">{signName || " "}</div>
            </div>
            <div className="sm-legal">
              🔒 This digital signature is legally binding. By clicking "Sign Contract" you confirm that you have read and agree to the terms.
            </div>
            <div className="sm-actions">
              <button className="sm-btn-cancel" onClick={()=>setShowSignModal(false)}>Cancel</button>
              <button className="sm-btn-sign" disabled={actionLoading==="sign"} onClick={handleSign}>
                {actionLoading==="sign" ? "Signing..." : "✅ Sign Contract"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cd">
        <div className="cd-header">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <a href="/contracts" className="cd-back">← Back</a>
            <div className="cd-title">{contract.title || "Contract"}</div>
          </div>
          <div className="cd-status" style={{
            background: isSigned?"#f0fdf4":contract.status==="pending"?"#fffbeb":contract.status==="rejected"?"#fff5f5":"#f5f5f5",
            color:      isSigned?"#16a34a":contract.status==="pending"?"#d97706":contract.status==="rejected"?"#dc2626":"#888",
            border:     `1.5px solid ${isSigned?"#86efac":contract.status==="pending"?"#fde68a":contract.status==="rejected"?"#fecaca":"#e0e0e0"}`,
          }}>
            {isSigned?"✅ Signed":contract.status==="pending"?"⏳ Awaiting Signature":contract.status==="rejected"?"❌ Rejected":"📝 Draft"}
          </div>
        </div>

        <div className="cd-body">

          {/* ACTIONS */}
          {(canCreatorSign || canBrandSend) && (
            <div className="cd-actions">
              <div className="cd-action-title">
                {canCreatorSign ? "✍️ Your signature is required" : "📤 Ready to send"}
              </div>
              <div className="cd-btn-row">
                {canCreatorSign && (
                  <>
                    <button className="cd-btn cd-btn-sign" onClick={()=>setShowSignModal(true)}>✍️ Sign Contract</button>
                    <button className="cd-btn cd-btn-reject" disabled={actionLoading==="reject"} onClick={handleReject}>✗ Reject</button>
                  </>
                )}
                {canBrandSend && (
                  <button className="cd-btn cd-btn-send" disabled={actionLoading==="send"} onClick={handleSend}>
                    {actionLoading==="send" ? "Sending..." : "📤 Send to Creator"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* CONTRACT DOCUMENT */}
          <div className="cd-doc">
            <div className="cd-doc-header">
              <div className="cd-doc-logo">Influex</div>
              <div className="cd-doc-badge">OFFICIAL AGREEMENT</div>
            </div>
            <div className="cd-doc-body">
              <div className="cd-doc-title">{contract.title}</div>

              {/* PARTIES */}
              <div className="cd-doc-section">Parties</div>
              <div className="cd-doc-parties">
                <div className="cd-party">
                  <div className="cd-party-lbl">Brand (Party A)</div>
                  <div className="cd-party-name">{contract.brandName || contract.brand?.name || "Brand"}</div>
                  <div className={`cd-party-sig ${brandSigned?"signed":"pending"}`}>{brandSigned?"✓ Signed":"⏳ Pending"}</div>
                  {contract.brandSignedAt && <div style={{fontSize:11,color:"#aaa",marginTop:4}}>{new Date(contract.brandSignedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>}
                </div>
                <div className="cd-party">
                  <div className="cd-party-lbl">Creator (Party B)</div>
                  <div className="cd-party-name">{contract.creatorName || contract.creator?.name || "Creator"}</div>
                  <div className={`cd-party-sig ${creatorSigned?"signed":"pending"}`}>{creatorSigned?"✓ Signed":"⏳ Pending"}</div>
                  {contract.creatorSignedAt && <div style={{fontSize:11,color:"#aaa",marginTop:4}}>{new Date(contract.creatorSignedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</div>}
                </div>
              </div>

              {/* DETAILS */}
              <div className="cd-doc-section">Contract Details</div>
              <div className="cd-meta-row"><span className="cd-meta-lbl">Amount</span><span className="cd-meta-val" style={{color:"#4f46e5"}}>₹{(contract.amount||0).toLocaleString()}</span></div>
              {contract.deadline && <div className="cd-meta-row"><span className="cd-meta-lbl">Deadline</span><span className="cd-meta-val">{new Date(contract.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"})}</span></div>}
              {contract.campaignTitle && <div className="cd-meta-row"><span className="cd-meta-lbl">Campaign</span><span className="cd-meta-val">{contract.campaignTitle}</span></div>}

              {/* DELIVERABLES */}
              {contract.deliverables?.length > 0 && (
                <>
                  <div className="cd-doc-section">Deliverables</div>
                  {contract.deliverables.map((d:string,i:number)=>(
                    <div key={i} className="cd-deliverable">
                      <div className="cd-del-num">{i+1}</div>
                      <div style={{fontSize:14,color:"#444",lineHeight:1.5}}>{d}</div>
                    </div>
                  ))}
                </>
              )}

              {/* TERMS */}
              {contract.terms && (
                <>
                  <div className="cd-doc-section" style={{marginTop:20}}>Terms & Conditions</div>
                  <div className="cd-terms">{contract.terms}</div>
                </>
              )}

              {/* SIGNATURES */}
              <div className="cd-sig-area">
                <div className="cd-sig-box">
                  <div className="cd-sig-line">
                    {brandSigned && <div className="cd-sig-text">{contract.brandSignedName || contract.brandName || "Brand"}</div>}
                  </div>
                  <div className="cd-sig-lbl">Brand Signature</div>
                  {brandSigned && contract.brandSignedAt && <div className="cd-sig-date">{new Date(contract.brandSignedAt).toLocaleDateString()}</div>}
                </div>
                <div className="cd-sig-box">
                  <div className="cd-sig-line">
                    {creatorSigned && <div className="cd-sig-text">{contract.creatorSignedName || contract.creatorName || "Creator"}</div>}
                  </div>
                  <div className="cd-sig-lbl">Creator Signature</div>
                  {creatorSigned && contract.creatorSignedAt && <div className="cd-sig-date">{new Date(contract.creatorSignedAt).toLocaleDateString()}</div>}
                </div>
              </div>

              {isSigned && (
                <div style={{marginTop:20,textAlign:"center",padding:"12px 20px",background:"linear-gradient(135deg,#f0fdf4,#dcfce7)",border:"1.5px solid #86efac",borderRadius:12,color:"#15803d",fontWeight:700,fontSize:14}}>
                  🎉 This contract has been fully executed and is legally binding.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

export default function ContractDetailPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <ContractDetailInner />
    </Suspense>
  );
}
