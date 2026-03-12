"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const API          = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";

function DealDetailPageInner() {
  const { id }          = useParams();
  const searchParams    = useSearchParams();
  const router          = useRouter();
  const [deal, setDeal]   = useState<any>(null);
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [token, setToken]           = useState("");
  const [role, setRole]             = useState("");
  const [userName, setUserName]     = useState("");
  const [userEmail, setUserEmail]   = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [toast, setToast]           = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitFile, setSubmitFile] = useState("");
  const [showSubmitForm, setShowSubmitForm] = useState(false);

  const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
    setToast({msg,type}); setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Pre-load Razorpay script immediately on page mount
    if (typeof window !== "undefined" && !(window as any).Razorpay) {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      document.head.appendChild(s);
    }
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setToken(parsed.token);
    setRole(parsed.role?.toLowerCase() || "");
    setUserName(parsed.name || "");
    setUserEmail(parsed.email || "");
    fetchDeal(parsed.token);
    if (searchParams.get("action") === "deposit") setTimeout(() => handleDeposit(parsed.token), 800);
  }, [id]);

  const fetchDeal = async (t: string) => {
    try {
      // GET /api/deal/:id
      const res = await fetch(`${API}/deal/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const d = data.deal || data.data || data;
      setDeal(d);
      // Escrow info may come nested in deal response
      if (d.escrow) setEscrow(d.escrow);
      else if (data.escrow) setEscrow(data.escrow);
    } catch {}
    finally { setLoading(false); }
  };

  const handleDeposit = async (t?: string) => {
    const tk = t || token;
    if (!deal && !t) return;
    setActionLoading("deposit");
    try {
      // STEP 1: POST /api/payment/deposit → creates Razorpay order
      // Body: { dealId }  — backend calculates amount + commission from deal
      const res  = await fetch(`${API}/payment/deposit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create payment order");
      if (!data.order?.id) throw new Error("Invalid order from server");

      // STEP 2: Open Razorpay checkout
      const options = {
        key: RAZORPAY_KEY,
        order_id: data.order.id,
        amount:   data.order.amount,   // in paise
        currency: data.order.currency || "INR",
        name:     "Influex Escrow",
        description: `Deal: ${deal?.title || id}`,
        theme: { color: "#4f46e5" },
        prefill: { name: userName, email: userEmail },
        handler: async (response: any) => {
          try {
            // STEP 3: POST /api/payment/verify → verifies signature + funds escrow
            // Schema: orderId (Razorpay), paymentId, status → "funded"
            const vRes = await fetch(`${API}/payment/verify`, {
              method: "POST",
              headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                dealId:              id,
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
              }),
            });
            const vData = await vRes.json();
            if (!vRes.ok) throw new Error(vData.message || "Payment verification failed");
            showToast("💰 Escrow funded successfully! Deal is now active.", "success");
            fetchDeal(tk);
          } catch (e: any) {
            showToast(e.message || "Payment verification failed", "error");
          }
          setActionLoading("");
        },
        modal: { ondismiss: () => { showToast("Payment cancelled", "warn"); setActionLoading(""); } },
      };

      // Load Razorpay script and wait for it to be ready
      await new Promise<void>((resolve, reject) => {
        if ((window as any).Razorpay) { resolve(); return; }
        // Remove any existing failed script
        const existing = document.querySelector('script[src*="razorpay"]');
        if (existing) existing.remove();
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.async = true;
        s.onload = () => {
          // Small delay to ensure Razorpay constructor is registered
          setTimeout(resolve, 300);
        };
        s.onerror = () => reject(new Error("Razorpay script failed to load"));
        document.head.appendChild(s);
      });

      if (!(window as any).Razorpay) {
        throw new Error("Razorpay failed to initialize. Please refresh and try again.");
      }
      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      showToast(err.message || "Payment failed", "error");
      setActionLoading("");
    }
  };

  // POST /api/payment/approve-deliverable → approves work + releases escrow (status: released)
  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      const res  = await fetch(`${API}/payment/approve-deliverable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve");
      showToast("✅ Work approved! Escrow released to creator.", "success");
      fetchDeal(token);
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setActionLoading(""); }
  };

  const handleSubmitDeliverable = async () => {
    if (!submitNote && !submitFile) { showToast("Add a note or link", "error"); return; }
    setActionLoading("submit");
    try {
      // POST /deal/approve-deliverable is for brand — creator submits work separately
      const res = await fetch(`${API}/deal/${id}/deliverable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: id, note: submitNote, fileUrl: submitFile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast("✅ Work submitted! Waiting for brand approval.", "success");
      setShowSubmitForm(false);
      setSubmitNote(""); setSubmitFile("");
      fetchDeal(token);
    } catch (err: any) { showToast(err.message || "Failed", "error"); }
    finally { setActionLoading(""); }
  };

  const steps = ["Deal Created", "Escrow Deposited", "Work Submitted", "Brand Approved", "💰 Payment Released"];
  const getStep = () => {
    if (!deal) return 0;
    if (deal.status === "completed") return 4;
    if (deal.deliverableSubmitted && deal.status === "active") return 3;
    if (deal.escrowDeposited) return 2;
    if (deal.status === "pending") return 1;
    return 0;
  };

  // Helpers for populated fields
  const getBrandName   = () => deal?.brandId?.name || deal?.brandId?.username || deal?.brandName || "Brand";
  const getCreatorName = () => deal?.influencerId?.name || deal?.influencerId?.username || deal?.creatorName || "Creator";
  const getBrandAvatar   = () => deal?.brandId?.profileImage || deal?.brandId?.avatar || "";
  const getCreatorAvatar = () => deal?.influencerId?.profileImage || deal?.influencerId?.avatar || "";
  const getDeliverables  = () => {
    const d = deal?.deliverables || "";
    if (typeof d === "string") return d.split("\n").filter(Boolean);
    if (Array.isArray(d)) return d;
    return [];
  };

  if (loading) return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!deal) return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:16}}>🤝</div>
        <div style={{fontSize:18,fontWeight:700,color:"#111"}}>Deal not found</div>
      </div>
    </div>
  );

  const currentStep = getStep();

  return (
    <>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        .dd { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
        .dd-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; align-items: center; gap: 14px; justify-content: space-between; flex-wrap: wrap; }
        .dd-back { background: #f5f5f3; border: none; border-radius: 10px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; text-decoration: none; }
        .dd-title { font-size: 18px; font-weight: 800; color: #111; }
        .dd-status { padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 700; }
        .dd-body { max-width: 680px; margin: 24px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 16px; }

        /* PROGRESS */
        .dd-progress { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
        .dd-progress-title { font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 20px; }
        .dd-steps { display: flex; align-items: center; gap: 0; position: relative; }
        .dd-step { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
        .dd-step-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; border: 2px solid #e0e0e0; background: #fff; color: #aaa; z-index: 1; transition: all 0.3s; }
        .dd-step-circle.done { background: linear-gradient(135deg,#4f46e5,#7c3aed); border-color: #4f46e5; color: #fff; }
        .dd-step-circle.current { background: #fff; border-color: #4f46e5; color: #4f46e5; box-shadow: 0 0 0 4px #eef2ff; }
        .dd-step-label { font-size: 10px; font-weight: 600; color: #aaa; margin-top: 6px; text-align: center; white-space: nowrap; }
        .dd-step-label.done { color: #4f46e5; }
        .dd-step-line { position: absolute; top: 18px; left: 50%; right: -50%; height: 2px; background: #e0e0e0; z-index: 0; }
        .dd-step-line.done { background: linear-gradient(90deg,#4f46e5,#7c3aed); }

        /* INFO CARD */
        .dd-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 24px; }
        .dd-card-title { font-size: 13px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 16px; }
        .dd-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
        .dd-row:last-child { border-bottom: none; }
        .dd-row-label { color: #888; font-weight: 500; }
        .dd-row-val   { font-weight: 700; color: #111; }
        .dd-amount-big { font-size: 32px; font-weight: 800; color: #4f46e5; text-align: center; padding: 16px 0 8px; }
        .dd-amount-lbl { font-size: 12px; color: #aaa; text-align: center; margin-bottom: 16px; }
        .dd-escrow-status { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; margin-bottom: 16px; }
        .dd-escrow-safe   { background: #f0fdf4; color: #16a34a; border: 1.5px solid #86efac; }
        .dd-escrow-pending{ background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a; }

        /* DELIVERABLES */
        .dd-deliverable { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
        .dd-deliverable:last-child { border-bottom: none; }
        .dd-del-icon { width: 24px; height: 24px; border-radius: 6px; background: #eef2ff; color: #4f46e5; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; font-weight: 700; }
        .dd-del-text { font-size: 13px; color: #444; line-height: 1.5; flex: 1; }

        /* SUBMIT FORM */
        .dd-submit-form { background: #f8f9ff; border: 1.5px solid #c7d2fe; border-radius: 14px; padding: 18px; margin-top: 12px; }
        .dd-sf-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; display: block; }
        .dd-sf-input  { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; margin-bottom: 10px; }
        .dd-sf-input:focus { border-color: #4f46e5; }
        .dd-sf-textarea { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1.5px solid #e0e7ff; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; resize: vertical; min-height: 80px; margin-bottom: 10px; }

        /* ACTIONS */
        .dd-action-btn { width: 100%; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .dd-action-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .dd-btn-deposit { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .dd-btn-deposit:hover:not(:disabled) { transform: translateY(-1px); }
        .dd-btn-approve { background: linear-gradient(135deg,#16a34a,#22c55e); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
        .dd-btn-approve:hover:not(:disabled) { transform: translateY(-1px); }
        .dd-btn-release { background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; box-shadow: 0 4px 16px rgba(245,158,11,0.25); }
        .dd-btn-release:hover:not(:disabled) { transform: translateY(-1px); }
        .dd-btn-submit  { background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; box-shadow: 0 4px 16px rgba(245,158,11,0.25); }
        .dd-btn-submit:hover:not(:disabled) { transform: translateY(-1px); }
        .dd-btn-secondary { background: #f5f5f3; color: #555; margin-top: 8px; }
        .dd-btn-secondary:hover { background: #ebebeb; }
        .dd-btn-contract  { background: #f0f9ff; color: #0369a1; border: 1.5px solid #bae6fd; margin-top: 8px; }
        .dd-btn-contract:hover { background: #e0f2fe; }

        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; z-index: 9999; animation: toastIn 0.3s ease; white-space: nowrap; box-shadow: 0 4px 20px rgba(0,0,0,0.12); font-family: 'Plus Jakarta Sans', sans-serif; }
        .toast.success { background: #111; color: #fff; }
        .toast.error   { background: #ef4444; color: #fff; }
        .toast.warn    { background: #f59e0b; color: #fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="dd">
        <div className="dd-header">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <a href="/deals" className="dd-back">← Back</a>
            <div className="dd-title">{deal.title || "Deal"}</div>
          </div>
          <div className="dd-status" style={{
            background: deal.status === "completed" ? "#f0fdf4" : deal.status === "active" ? "#eef2ff" : "#fffbeb",
            color:      deal.status === "completed" ? "#16a34a" : deal.status === "active" ? "#4f46e5" : "#d97706",
            border:     `1.5px solid ${deal.status === "completed" ? "#86efac" : deal.status === "active" ? "#c7d2fe" : "#fde68a"}`,
          }}>{deal.status || "pending"}</div>
        </div>

        <div className="dd-body">

          {/* PROGRESS STEPS */}
          <div className="dd-progress">
            <div className="dd-progress-title">Deal Progress</div>
            <div className="dd-steps">
              {steps.map((step, i) => (
                <div key={i} className="dd-step">
                  {i < steps.length - 1 && (
                    <div className={`dd-step-line ${i < currentStep ? "done" : ""}`} />
                  )}
                  <div className={`dd-step-circle ${i < currentStep ? "done" : i === currentStep ? "current" : ""}`}>
                    {i < currentStep ? "✓" : i + 1}
                  </div>
                  <div className={`dd-step-label ${i <= currentStep ? "done" : ""}`}
                    style={{fontSize: i === 4 ? "11px" : undefined}}>
                    {step}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DEAL INFO */}
          <div className="dd-card">
            <div className="dd-card-title">📋 Deal Info</div>
            <div className="dd-row"><span className="dd-row-label">Campaign</span><span className="dd-row-val">{deal.campaignTitle || deal.campaign?.title || "—"}</span></div>
            <div className="dd-row"><span className="dd-row-label">Brand</span><span className="dd-row-val">{deal.brandId?.name || deal.brandId?.username || deal.brandName || deal.brand?.name || "—"}</span></div>
            <div className="dd-row"><span className="dd-row-label">Creator</span><span className="dd-row-val">{deal.influencerId?.name || deal.influencerId?.username || deal.creatorName || deal.creator?.name || "—"}</span></div>
            <div className="dd-row"><span className="dd-row-label">Deadline</span><span className="dd-row-val">{deal.deadline ? new Date(deal.deadline).toLocaleDateString("en-IN", {day:"numeric",month:"long",year:"numeric"}) : "—"}</span></div>
            <div className="dd-row"><span className="dd-row-label">Created</span><span className="dd-row-val">{new Date(deal.createdAt).toLocaleDateString("en-IN", {day:"numeric",month:"long"})}</span></div>
            {deal.description && (
              <div style={{marginTop:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:10,fontSize:14,color:"#555",lineHeight:1.65}}>
                {deal.description}
              </div>
            )}
          </div>

          {/* ESCROW */}
          <div className="dd-card">
            <div className="dd-card-title">💰 Escrow Payment</div>
            <div className="dd-amount-big">₹{(deal.amount || 0).toLocaleString()}</div>
            <div className="dd-amount-lbl">Deal Amount</div>
            <div className={`dd-escrow-status ${(escrow?.status === "funded" || deal?.escrowDeposited) ? "dd-escrow-safe" : "dd-escrow-pending"}`}>
              {(escrow?.status === "funded" || deal?.escrowDeposited) ? `🔒 ₹${Number(escrow?.creatorAmount || deal?.amount || 0).toLocaleString("en-IN")} held in escrow (Creator gets ₹${Number(escrow?.creatorAmount || 0).toLocaleString("en-IN")}, Platform fee: ₹${Number(escrow?.commission || 0).toLocaleString("en-IN")})` : "⏳ Awaiting escrow deposit"}
            </div>
            {role === "brand" && escrow?.status !== "funded" && !deal?.escrowDeposited && deal?.status !== "completed" && (
              <button className="dd-action-btn dd-btn-deposit" disabled={actionLoading === "deposit"} onClick={() => handleDeposit()}>
                {actionLoading === "deposit" ? "Opening payment..." : "💰 Deposit ₹" + (deal.amount || 0).toLocaleString() + " to Escrow"}
              </button>
            )}
            {role === "brand" && (escrow?.status === "funded" || deal?.escrowDeposited) && deal?.deliverableSubmitted && deal?.status !== "completed" && (
              <>
                <div style={{fontSize:13,color:"#555",marginBottom:12,padding:"10px 14px",background:"#f0fdf4",borderRadius:10,border:"1px solid #bbf7d0"}}>
                  🎯 Creator has submitted their work. Review and approve to release payment.
                </div>
                <button className="dd-action-btn dd-btn-approve" disabled={actionLoading === "approve"} onClick={handleApprove}>
                  {actionLoading === "approve" ? "Approving..." : "✅ Approve Work & Release Payment"}
                </button>
              </>
            )}
            {deal.status === "completed" && (
              <div style={{textAlign:"center",padding:"12px",background:"#f0fdf4",borderRadius:12,color:"#16a34a",fontWeight:700,fontSize:14,border:"1.5px solid #86efac"}}>
                🎉 Payment released! Deal completed successfully.
              </div>
            )}
            {role === "brand" && (
              <a href={`/contracts/create?dealId=${deal._id}&campaignId=${deal.campaignId||""}&creatorId=${deal.creatorId||deal.creator?._id||""}`}
                className="dd-action-btn dd-btn-contract"
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,textDecoration:"none",marginTop:10}}>
                📄 Create Contract for this Deal
              </a>
            )}
          </div>

          {/* DELIVERABLES */}
          {deal.deliverables?.length > 0 && (
            <div className="dd-card">
              <div className="dd-card-title">✅ Deliverables</div>
              {deal.deliverables.map((d: string, i: number) => (
                <div key={i} className="dd-deliverable">
                  <div className="dd-del-icon">{i+1}</div>
                  <div className="dd-del-text">{d}</div>
                </div>
              ))}
            </div>
          )}

          {/* CREATOR — SUBMIT WORK */}
          {(role === "influencer" || role === "creator") && (escrow?.status === "funded" || deal?.escrowDeposited) && deal?.status !== "completed" && (
            <div className="dd-card">
              <div className="dd-card-title">📤 Submit Your Work</div>
              {deal.deliverableSubmitted ? (
                <div style={{textAlign:"center",padding:"16px",background:"#f0fdf4",borderRadius:12,color:"#16a34a",fontWeight:700,fontSize:14,border:"1.5px solid #86efac"}}>
                  ✅ Work submitted! Waiting for brand approval.
                </div>
              ) : (
                <>
                  {!showSubmitForm ? (
                    <button className="dd-action-btn dd-btn-submit" onClick={() => setShowSubmitForm(true)}>
                      📤 Submit Completed Work
                    </button>
                  ) : (
                    <div className="dd-submit-form">
                      <label className="dd-sf-label">Work Link / Drive URL</label>
                      <input className="dd-sf-input" value={submitFile} onChange={e => setSubmitFile(e.target.value)} placeholder="https://drive.google.com/..." />
                      <label className="dd-sf-label">Notes for Brand</label>
                      <textarea className="dd-sf-textarea" value={submitNote} onChange={e => setSubmitNote(e.target.value)} placeholder="Describe what you've done..." />
                      <button className="dd-action-btn dd-btn-submit" disabled={actionLoading === "submit"} onClick={handleSubmitDeliverable}>
                        {actionLoading === "submit" ? "Submitting..." : "✅ Submit Work"}
                      </button>
                      <button className="dd-action-btn dd-btn-secondary" onClick={() => setShowSubmitForm(false)}>Cancel</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SUBMITTED WORK — visible to brand */}
          {role === "brand" && deal.deliverableSubmitted && deal.submittedWork && (
            <div className="dd-card" style={{border:"1.5px solid #c7d2fe",background:"#eef2ff"}}>
              <div className="dd-card-title" style={{color:"#4f46e5"}}>📩 Creator's Submission</div>
              {deal.submittedWork.note && (
                <div style={{fontSize:14,color:"#444",lineHeight:1.65,marginBottom:12,padding:"10px 14px",background:"#fff",borderRadius:10}}>
                  {deal.submittedWork.note}
                </div>
              )}
              {deal.submittedWork.fileUrl && (
                <a href={deal.submittedWork.fileUrl} target="_blank" rel="noreferrer"
                  style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"#fff",borderRadius:10,color:"#4f46e5",fontWeight:600,fontSize:13,textDecoration:"none",border:"1px solid #c7d2fe"}}>
                  📎 View Submitted Work →
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}

export default function DealDetailPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <DealDetailPageInner />
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