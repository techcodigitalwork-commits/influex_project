"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";

const API          = "http://54.252.201.93:5000/api";
const RAZORPAY_KEY = "rzp_test_SL7M2uHDyhrU4A";

// EXACT FLOW:
// 1. Deal Created     → deal.status = "pending"
// 2. Deposit          → POST /payment/deposit → Razorpay order
// 3. Razorpay Checkout
// 4. verifyPayment    → POST /payment/verify
// 5. Escrow Funded    → deal.status = "active", escrow.status = "funded"
// 6. Creator Submits  → POST /deal/:id/submit
// 7. Brand Approves   → POST /payment/approve-deliverable
// 8. Escrow Released  → deal.status = "completed", escrow.status = "released"

function DealDetailPageInner() {
  const { id }   = useParams();
  const router   = useRouter();

  const [deal,          setDeal]          = useState<any>(null);
  const [escrow,        setEscrow]        = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [token,         setToken]         = useState("");
  const [role,          setRole]          = useState("");
  const [userName,      setUserName]      = useState("");
  const [userEmail,     setUserEmail]     = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [toast,         setToast]         = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
  const [submitNote,    setSubmitNote]    = useState("");
  const [submitFile,    setSubmitFile]    = useState("");
  const [showSubmit,    setShowSubmit]    = useState(false);

  const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
    setToast({msg,type}); setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).Razorpay) {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      document.head.appendChild(s);
    }
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    setToken(u.token);
    setRole((u.role || u.user?.role || "").toLowerCase());
    setUserName(u.name || u.user?.name || "");
    setUserEmail(u.email || u.user?.email || "");
    fetchDeal(u.token);
  }, [id]);

  const fetchDeal = async (t: string) => {
    try {
      const res  = await fetch(`${API}/deal/${id}`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const d = data.deal || data.data || data;
      setDeal(d);
      const esc = d.escrow || data.escrow || null;
      if (esc) setEscrow(esc);
      // Debug: log deal to see structure
      console.log("DEAL DATA:", JSON.stringify(d, null, 2));
    } catch(e:any) {
      showToast(e.message || "Failed to load deal", "error");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 → 3 → 4 → 5
  const handleDeposit = async (t?: string) => {
    const tk = t || token;
    if (!deal) return;
    setActionLoading("deposit");
    try {
      const dealAmount    = Number(deal.amount || 0);
      const commission    = Math.round(dealAmount * 0.10);
      const creatorAmount = dealAmount - commission;
      // influencerId could be: populated object {_id,name} OR plain ObjectId string
      const rawInf = deal.influencerId;
      const influencerId = (typeof rawInf === "object" && rawInf !== null)
        ? (rawInf._id || rawInf.id || String(rawInf))
        : String(rawInf || "");

      const res  = await fetch(`${API}/payment/deposit`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ dealId: id, amount: dealAmount, commission, creatorAmount, influencerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create order");
      if (!data.order?.id) throw new Error("No order returned from server");

      // Ensure Razorpay ready
      if (!(window as any).Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const ex = document.querySelector('script[src*="razorpay"]');
          if (ex) ex.remove();
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.async = true;
          s.onload  = () => setTimeout(resolve, 500);
          s.onerror = () => reject(new Error("Razorpay failed to load"));
          document.head.appendChild(s);
        });
      }
      if (!(window as any).Razorpay) throw new Error("Razorpay not available. Refresh and try again.");

      const rzp = new (window as any).Razorpay({
        key:         RAZORPAY_KEY,
        order_id:    data.order.id,
        amount:      data.order.amount,
        currency:    data.order.currency || "INR",
        name:        "Influex Escrow",
        description: `Deal: ${deal.title || id}`,
        theme:       { color: "#4f46e5" },
        prefill:     { name: userName, email: userEmail },
        handler: async (response: any) => {
          try {
            // STEP 4: verify
            const vRes = await fetch(`${API}/payment/verify`, {
              method:  "POST",
              headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
              body:    JSON.stringify({
                dealId:              id,
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                influencerId:        (typeof deal?.influencerId === "object" && deal?.influencerId !== null)
                                       ? (deal.influencerId._id || deal.influencerId.id || String(deal.influencerId))
                                       : String(deal?.influencerId || ""),
                amount:              Number(deal?.amount || 0),
              }),
            });
            const vData = await vRes.json();
            if (!vRes.ok) throw new Error(vData.message || "Verification failed");
            // STEP 5: Escrow funded — update local state immediately
            setEscrow(vData.escrow || { status: "funded" });
            setDeal((prev: any) => ({ ...prev, status: "active" }));
            showToast("✅ Escrow funded! Deal is now active.", "success");
            await fetchDeal(tk);
          } catch(e:any) {
            showToast(e.message || "Verification failed", "error");
          } finally {
            setActionLoading("");
          }
        },
        modal: { ondismiss: () => setActionLoading("") },
      });
      rzp.open();

    } catch(e:any) {
      showToast(e.message || "Payment failed", "error");
      setActionLoading("");
    }
  };

  // STEP 6: Creator submits work
  const handleSubmitWork = async () => {
    if (!submitNote && !submitFile) { showToast("Add a note or link", "error"); return; }
    setActionLoading("submit");
    try {
      let res = await fetch(`${API}/deal/${id}/submit`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ note: submitNote, fileUrl: submitFile }),
      });
      if (res.status === 404) {
        res = await fetch(`${API}/deal/${id}/deliverable`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body:    JSON.stringify({ dealId: id, note: submitNote, fileUrl: submitFile }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Submit failed");
      showToast("📤 Work submitted! Waiting for approval.", "success");
      setShowSubmit(false); setSubmitNote(""); setSubmitFile("");
      await fetchDeal(token);
    } catch(e:any) {
      showToast(e.message || "Submit failed", "error");
    } finally {
      setActionLoading("");
    }
  };

  // STEP 7: Brand approves → STEP 8: Escrow released
  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      // Backend needs deliverableId — get it from deal's deliverable
      const deliverableId = deal?.deliverableId?._id || deal?.deliverableId
                         || deal?.submittedWork?._id  || deal?.submittedWork;

      if (!deliverableId) {
        throw new Error("No deliverable found for this deal");
      }

      const res  = await fetch(`${API}/payment/approve-deliverable`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ deliverableId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");
      showToast("🎉 Approved! Payment released to creator.", "success");
      await fetchDeal(token);
    } catch(e:any) {
      showToast(e.message || "Approval failed", "error");
    } finally {
      setActionLoading("");
    }
  };

  // ── FLOW STATE FLAGS ─────────────────────────────────────
  const isEscrowFunded  = escrow?.status === "funded"   || deal?.status === "active"    || deal?.status === "completed";
  const isWorkSubmitted = !!(deal?.deliverableSubmitted || deal?.workSubmitted);
  const isCompleted     = deal?.status === "completed"  || escrow?.status === "released";
  const isBrand         = role === "brand";
  const isCreator       = role === "influencer" || role === "creator";

  // Step index 0-4
  const getStep = (): number => {
    if (!deal) return 0;
    if (isCompleted)     return 4;
    if (isWorkSubmitted) return 3;
    if (isEscrowFunded)  return 2;
    if (deal.status === "pending") return 1;
    return 0;
  };

  const STEPS = [
    { label: "Deal\nCreated",    icon: "🤝" },
    { label: "Escrow\nFunded",   icon: "💰" },
    { label: "Work\nSubmitted",  icon: "📤" },
    { label: "Brand\nApproved",  icon: "✅" },
    { label: "Payment\nReleased",icon: "🚀" },
  ];

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
      <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if (!deal) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5",fontFamily:"Plus Jakarta Sans,sans-serif"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🤝</div><div style={{fontWeight:700,color:"#111"}}>Deal not found</div></div>
    </div>
  );

  const step = getStep();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        body{font-family:'Plus Jakarta Sans',sans-serif}
        .dd{background:#f7f7f5;min-height:100vh;padding-bottom:60px}
        .dd-hdr{background:#fff;border-bottom:1px solid #efefef;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .dd-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#555;text-decoration:none;font-family:inherit}
        .dd-title{font-size:17px;font-weight:800;color:#111}
        .dd-badge{padding:5px 12px;border-radius:100px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
        .dd-body{max-width:640px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:14px;animation:fadeIn .3s ease}
        .dd-card{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px}
        .dd-card-title{font-size:12px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}
        .dd-row{display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f5f5f5;font-size:14px}
        .dd-row:last-child{border-bottom:none}
        .dd-lbl{color:#888;font-weight:500}
        .dd-val{font-weight:700;color:#111}

        /* FLOW */
        .flow{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px 16px}
        .flow-hdr{font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:20px}
        .flow-row{display:flex;align-items:flex-start}
        .flow-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
        .flow-line{position:absolute;top:16px;left:50%;right:-50%;height:2px;background:#e8e8e8;z-index:0;transition:background .4s}
        .flow-line.on{background:linear-gradient(90deg,#4f46e5,#7c3aed)}
        .flow-dot{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;border:2px solid #e8e8e8;background:#fff;color:#bbb;z-index:1;position:relative;transition:all .3s}
        .flow-dot.done{background:linear-gradient(135deg,#4f46e5,#7c3aed);border-color:#4f46e5;color:#fff}
        .flow-dot.cur{background:#fff;border-color:#4f46e5;color:#4f46e5;box-shadow:0 0 0 4px #eef2ff}
        .flow-lbl{font-size:9px;font-weight:600;color:#bbb;margin-top:5px;text-align:center;line-height:1.3;white-space:pre-line}
        .flow-lbl.done{color:#4f46e5}
        .flow-lbl.cur{color:#4f46e5;font-weight:800}

        /* ESCROW */
        .esc-amt{font-size:36px;font-weight:800;color:#4f46e5;text-align:center;padding:12px 0 4px}
        .esc-lbl{font-size:12px;color:#aaa;text-align:center;margin-bottom:14px}
        .esc-status{display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 18px;border-radius:12px;font-size:13px;font-weight:700;margin-bottom:12px}
        .esc-funded{background:#f0fdf4;color:#16a34a;border:1.5px solid #86efac}
        .esc-pending{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a}
        .esc-released{background:#eef2ff;color:#4f46e5;border:1.5px solid #c7d2fe}

        /* BUTTONS */
        .btn{width:100%;padding:14px;border-radius:14px;font-size:14px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px}
        .btn:disabled{opacity:.55;cursor:not-allowed;transform:none!important}
        .btn-deposit{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 4px 16px rgba(79,70,229,.28)}
        .btn-deposit:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,.36)}
        .btn-approve{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;box-shadow:0 4px 16px rgba(34,197,94,.25)}
        .btn-approve:hover:not(:disabled){transform:translateY(-1px)}
        .btn-submit{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;box-shadow:0 4px 16px rgba(245,158,11,.25)}
        .btn-submit:hover:not(:disabled){transform:translateY(-1px)}
        .btn-ghost{background:#f5f5f3;color:#555}
        .btn-contract{background:#f0f9ff;color:#0369a1;border:1.5px solid #bae6fd!important;text-decoration:none}

        /* SUBMIT FORM */
        .sf{background:#f8f9ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:16px;margin-top:10px}
        .sf-lbl{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px;display:block}
        .sf-input{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;margin-bottom:10px}
        .sf-input:focus{border-color:#4f46e5}
        .sf-ta{width:100%;padding:10px 12px;border-radius:10px;border:1.5px solid #e0e7ff;font-size:13px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:80px;margin-bottom:10px}

        .info{padding:11px 14px;border-radius:10px;font-size:13px;font-weight:600;margin-top:8px}
        .info-green{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
        .info-blue{background:#eef2ff;color:#4f46e5;border:1px solid #c7d2fe}
        .info-orange{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}

        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
        .toast.success{background:#111;color:#fff}
        .toast.error{background:#ef4444;color:#fff}
        .toast.warn{background:#f59e0b;color:#fff}
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="dd">
        {/* HEADER */}
        <div className="dd-hdr">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <a href="/deals" className="dd-back">← Back</a>
            <div className="dd-title">{deal.title || "Deal"}</div>
          </div>
          <div className="dd-badge" style={{
            background: isCompleted ? "#f0fdf4" : isEscrowFunded ? "#eef2ff" : "#fffbeb",
            color:      isCompleted ? "#16a34a" : isEscrowFunded ? "#4f46e5" : "#d97706",
            border:     `1.5px solid ${isCompleted ? "#86efac" : isEscrowFunded ? "#c7d2fe" : "#fde68a"}`,
          }}>{deal.status || "pending"}</div>
        </div>

        <div className="dd-body">

          {/* FLOW STEPS */}
          <div className="flow">
            <div className="flow-hdr">Deal Progress</div>
            <div className="flow-row">
              {STEPS.map((s, i) => (
                <div key={i} className="flow-step">
                  {i < STEPS.length - 1 && <div className={`flow-line ${i < step ? "on" : ""}`}/>}
                  <div className={`flow-dot ${i < step ? "done" : i === step ? "cur" : ""}`}>
                    {i < step ? "✓" : s.icon}
                  </div>
                  <div className={`flow-lbl ${i < step ? "done" : i === step ? "cur" : ""}`}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DEAL INFO */}
          <div className="dd-card">
            <div className="dd-card-title">📋 Deal Info</div>
            <div className="dd-row"><span className="dd-lbl">Campaign</span><span className="dd-val">{deal.campaignTitle || deal.campaign?.title || deal.campaignId?.title || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Brand</span><span className="dd-val">{deal.brandId?.name || deal.brandId?.username || deal.brandName || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Creator</span><span className="dd-val">{deal.influencerId?.name || deal.influencerId?.username || deal.creatorName || "—"}</span></div>
            <div className="dd-row"><span className="dd-lbl">Deadline</span><span className="dd-val">{deal.deadline ? new Date(deal.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"long",year:"numeric"}) : "—"}</span></div>
            {deal.description && (
              <div style={{marginTop:10,padding:"10px 12px",background:"#f9f9f8",borderRadius:10,fontSize:13,color:"#555",lineHeight:1.6}}>
                {deal.description}
              </div>
            )}
          </div>

          {/* ESCROW / PAYMENT */}
          <div className="dd-card">
            <div className="dd-card-title">💰 Escrow Payment</div>
            <div className="esc-amt">₹{Number(deal.amount||0).toLocaleString("en-IN")}</div>
            <div className="esc-lbl">Deal Amount</div>

            {isCompleted ? (
              <div className="esc-status esc-released">🚀 Payment released to creator!</div>
            ) : isEscrowFunded ? (
              <div className="esc-status esc-funded">
                🔒 Funds held in escrow
                {escrow?.creatorAmount ? ` — Creator: ₹${Number(escrow.creatorAmount).toLocaleString("en-IN")}, Fee: ₹${Number(escrow.commission||0).toLocaleString("en-IN")}` : ""}
              </div>
            ) : (
              <div className="esc-status esc-pending">⏳ Awaiting escrow deposit</div>
            )}

            {/* STEP 2: Brand deposits */}
            {isBrand && !isEscrowFunded && !isCompleted && (
              <button className="btn btn-deposit" disabled={actionLoading==="deposit"} onClick={() => handleDeposit()}>
                {actionLoading==="deposit" ? "⏳ Opening payment..." : `💰 Deposit ₹${Number(deal.amount||0).toLocaleString("en-IN")} to Escrow`}
              </button>
            )}

            {/* Brand waiting for submission */}
            {isBrand && isEscrowFunded && !isWorkSubmitted && !isCompleted && (
              <div className="info info-orange">⏳ Waiting for creator to submit work...</div>
            )}

            {/* STEP 7: Brand approves */}
            {isBrand && isEscrowFunded && isWorkSubmitted && !isCompleted && (
              <>
                <div className="info info-blue">🎯 Creator submitted work. Approve to release payment.</div>
                <button className="btn btn-approve" disabled={actionLoading==="approve"} onClick={handleApprove}>
                  {actionLoading==="approve" ? "⏳ Releasing..." : "✅ Approve Work & Release Payment"}
                </button>
              </>
            )}

            {isCompleted && (
              <div className="info info-green" style={{textAlign:"center",marginTop:8}}>🎉 Deal completed successfully!</div>
            )}

            {isBrand && (
              <a
                href={`/contracts/create?dealId=${deal._id}&campaignId=${deal.campaignId?._id||deal.campaignId||""}&creatorId=${deal.influencerId?._id||deal.influencerId||""}`}
                className="btn btn-contract"
                style={{marginTop:10}}
              >📄 Create Contract for this Deal</a>
            )}
          </div>

          {/* DELIVERABLES */}
          {deal.deliverables?.length > 0 && (
            <div className="dd-card">
              <div className="dd-card-title">✅ Deliverables</div>
              {(Array.isArray(deal.deliverables) ? deal.deliverables : [deal.deliverables]).map((d:string, i:number) => (
                <div key={i} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:"1px solid #f5f5f5",fontSize:14,color:"#444",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,background:"#eef2ff",color:"#4f46e5",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,flexShrink:0}}>{i+1}</div>
                  <div style={{flex:1,lineHeight:1.5}}>{d}</div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 6: Creator submits work */}
          {isCreator && isEscrowFunded && !isCompleted && (
            <div className="dd-card">
              <div className="dd-card-title">📤 Submit Your Work</div>
              {isWorkSubmitted ? (
                <div className="info info-green">✅ Work submitted! Waiting for brand approval.</div>
              ) : !showSubmit ? (
                <button className="btn btn-submit" onClick={() => setShowSubmit(true)}>📤 Submit Completed Work</button>
              ) : (
                <div className="sf">
                  <label className="sf-lbl">Work Link / Drive URL</label>
                  <input className="sf-input" value={submitFile} onChange={e=>setSubmitFile(e.target.value)} placeholder="https://drive.google.com/..."/>
                  <label className="sf-lbl">Notes for Brand</label>
                  <textarea className="sf-ta" value={submitNote} onChange={e=>setSubmitNote(e.target.value)} placeholder="Describe what you've completed..."/>
                  <button className="btn btn-submit" disabled={actionLoading==="submit"} onClick={handleSubmitWork}>
                    {actionLoading==="submit" ? "⏳ Submitting..." : "✅ Submit Work"}
                  </button>
                  <button className="btn btn-ghost" style={{marginTop:6}} onClick={()=>setShowSubmit(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}

          {/* Brand: view submitted work */}
          {isBrand && isWorkSubmitted && deal.submittedWork && (
            <div className="dd-card" style={{border:"1.5px solid #c7d2fe",background:"#f8f9ff"}}>
              <div className="dd-card-title">📩 Creator's Submission</div>
              {deal.submittedWork.note && (
                <div style={{fontSize:13,color:"#444",lineHeight:1.65,marginBottom:10,padding:"10px 12px",background:"#fff",borderRadius:10}}>
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
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f7f7f5"}}>
        <div style={{width:32,height:32,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
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