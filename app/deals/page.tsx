"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = "http://54.252.201.93:5000/api";

export default function DealsPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [role, setRole]                 = useState("");
  const [token, setToken]               = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [actioning, setActioning]       = useState<string|null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    const t = parsed.token || "";
    setToken(t);
    setRole(parsed.role?.toLowerCase() || "");
    fetchDeals(t);
  }, []);

  const fetchDeals = async (t: string) => {
    try {
      // GET /api/deal/my — fetch all my deals
      const res  = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const list = data.deals || data.data || [];
      list.sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
      setDeals(list);
    } catch { setDeals([]); }
    finally { setLoading(false); }
  };

  // GET /api/deal/campaign/:campaignId — deals for specific campaign
  const fetchCampaignDeals = async (campaignId: string) => {
    if (!campaignId) { fetchDeals(token); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API}/deal/campaign/${campaignId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      const list = data.deals || data.data || [];
      list.sort((a: any, b: any) => new Date(b.createdAt||0).getTime() - new Date(a.createdAt||0).getTime());
      setDeals(list);
    } catch { setDeals([]); }
    finally { setLoading(false); }
  };

  // POST /deal/deposit
  const handleDeposit = async (deal: any) => {
    setActioning(deal._id + "_deposit");
    try {
      const res = await fetch(`${API}/payment/deposit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal._id }),  // backend reads amount from deal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      // Razorpay flow
      if (data.order?.id) {
        const rzp = new (window as any).Razorpay({
          key: "rzp_test_SL7M2uHDyhrU4A",
          order_id: data.order.id,
          amount: data.order.amount,
          currency: "INR",
          name: "Influex Escrow",
          description: `Deal: ${deal.title || ""}`,
          theme: { color: "#4f46e5" },
          handler: async (response: any) => {
            try {
              await fetch(`${API}/payment/verify`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  dealId: deal._id,
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
              });
              alert("💰 Escrow funded! Deal is now active.");
              fetchDeals(token);
            } catch { alert("Payment verification failed"); }
          },
          modal: { ondismiss: () => setActioning(null) },
        });
        rzp.open();
      } else {
        alert("💰 Payment deposited!");
        fetchDeals(token);
      }
    } catch (err: any) { alert(err.message || "Deposit failed"); }
    finally { setActioning(null); }
  };

  // POST /deal/approve
  const handleApprove = async (dealId: string) => {
    if (!confirm("Approve work and release payment to creator?")) return;
    setActioning(dealId + "_approve");
    try {
      // POST /payment/approve-deliverable
      const res = await fetch(`${API}/payment/approve-deliverable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ dealId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      alert("✅ Work approved! Payment auto-released to creator.");
      fetchDeals(token);
    } catch (err: any) { alert(err.message || "Approve failed"); }
    finally { setActioning(null); }
  };

  const statusColor: Record<string, string> = {
    pending:   "#f59e0b",
    active:    "#4f46e5",
    completed: "#16a34a",
    cancelled: "#ef4444",
    disputed:  "#dc2626",
  };

  const statusBg: Record<string, string> = {
    pending:   "#fffbeb",
    active:    "#eef2ff",
    completed: "#f0fdf4",
    cancelled: "#fff5f5",
    disputed:  "#fff1f1",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }

        .dl { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }

        .dl-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .dl-header{ padding: 14px 16px; } }
        .dl-title { font-size: 22px; font-weight: 800; color: #111; }
        .dl-sub   { font-size: 13px; color: #aaa; margin-top: 2px; }
        .dl-create-btn { padding: 10px 20px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
        .dl-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

        /* FLOW BANNER */
        .dl-flow { display: flex; align-items: center; gap: 0; padding: 20px 32px 0; flex-wrap: wrap; overflow-x: auto; }
        @media(max-width:600px){ .dl-flow{ padding: 14px 16px 0; } }
        .dl-flow-step { display: flex; align-items: center; gap: 8px; background: #fff; border: 1.5px solid #efefef; border-radius: 10px; padding: 8px 14px; font-size: 12px; font-weight: 600; color: #555; white-space: nowrap; }
        .dl-flow-step.active { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
        .dl-flow-arrow { color: #ccc; font-size: 14px; margin: 0 4px; flex-shrink: 0; }

        /* STATS */
        .dl-stats { display: flex; gap: 12px; padding: 16px 32px 0; flex-wrap: wrap; }
        @media(max-width:600px){ .dl-stats{ padding: 12px 16px 0; gap: 10px; } }
        .dl-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .dl-stat-val { font-size: 20px; font-weight: 800; color: #111; }
        .dl-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

        /* GRID */
        .dl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 20px 32px 40px; }
        @media(max-width:768px){ .dl-grid{ grid-template-columns: 1fr; padding: 14px 16px 28px; gap: 12px; } }

        /* CARD */
        .dl-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 22px; transition: all 0.22s; cursor: pointer; animation: fadeUp 0.3s ease both; }
        .dl-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
        .dl-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
        .dl-card-title { font-size: 15px; font-weight: 700; color: #111; }
        .dl-card-sub { font-size: 12px; color: #aaa; margin-top: 3px; }
        .dl-status { padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .dl-amount-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding: 12px 14px; background: #f9f9f8; border-radius: 10px; border: 1px solid #f0f0f0; }
        .dl-amount { font-size: 22px; font-weight: 800; color: #4f46e5; }
        .dl-amount-lbl { font-size: 11px; color: #aaa; font-weight: 500; }
        .dl-escrow-bar { height: 6px; background: #f0f0f0; border-radius: 100px; margin-bottom: 14px; overflow: hidden; }
        .dl-escrow-fill { height: 100%; border-radius: 100px; background: linear-gradient(90deg,#4f46e5,#7c3aed); transition: width 0.5s ease; }
        .dl-escrow-labels { display: flex; justify-content: space-between; font-size: 11px; color: #aaa; margin-bottom: 14px; margin-top: -10px; }
        .dl-parties { display: flex; gap: 8px; margin-bottom: 14px; }
        .dl-party { flex: 1; background: #f9f9f8; border-radius: 10px; padding: 8px 10px; border: 1px solid #f0f0f0; font-size: 12px; }
        .dl-party-lbl { color: #bbb; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 3px; }
        .dl-party-val { font-weight: 700; color: #111; }
        .dl-actions { display: flex; gap: 8px; }
        .dl-btn { flex: 1; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .dl-btn-view   { background: #eef2ff; color: #4f46e5; }
        .dl-btn-view:hover { background: #e0e7ff; }
        .dl-btn-deposit { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.25); }
        .dl-btn-deposit:hover { transform: translateY(-1px); }
        .dl-btn-approve { background: linear-gradient(135deg,#16a34a,#22c55e); color: #fff; }
        .dl-btn-approve:hover { transform: translateY(-1px); }

        .dl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
        .dl-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .dl-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
        .dl-empty-sub   { color: #aaa; font-size: 14px; margin: 0 0 24px; line-height: 1.6; max-width: 280px; }

        .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 60px auto; display: block; }
      `}</style>

      <div className="dl">
        <div className="dl-header">
          <div>
            <div className="dl-title">Deals</div>
            <div className="dl-sub">{deals.length} deal{deals.length !== 1 ? "s" : ""} total</div>
          </div>
          {role === "brand" && <Link href="/deals/create" className="dl-create-btn">+ Create Deal</Link>}
        </div>

        {/* FLOW */}
        {/* CAMPAIGN FILTER — GET /deal/campaign/:id */}
        {role === "brand" && (
          <div style={{padding:"12px 32px",background:"#fff",borderBottom:"1px solid #efefef",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:13,fontWeight:600,color:"#888"}}>Filter by Campaign:</span>
            <input
              style={{padding:"7px 12px",borderRadius:10,border:"1.5px solid #e0e0e0",fontSize:13,fontFamily:"inherit",outline:"none",minWidth:220,color:"#111"}}
              placeholder="Paste Campaign ID to filter..."
              value={campaignFilter}
              onChange={e => {
                setCampaignFilter(e.target.value);
                if (e.target.value.length > 10) fetchCampaignDeals(e.target.value.trim());
                else if (!e.target.value) fetchDeals(token);
              }}
            />
            {campaignFilter && (
              <button onClick={() => { setCampaignFilter(""); fetchDeals(token); }}
                style={{padding:"7px 12px",borderRadius:10,border:"1.5px solid #e0e0e0",background:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",color:"#ef4444"}}>
                ✕ Clear
              </button>
            )}
          </div>
        )}

        <div className="dl-flow">
          {["Campaign", "Apply", "Shortlist", "Deal", "Deposit", "Work", "Approve", "💰 Released"].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center" }}>
              <div className={`dl-flow-step ${i === 3 ? "active" : ""}`}>{step}</div>
              {i < 7 && <div className="dl-flow-arrow">→</div>}
            </div>
          ))}
        </div>

        {/* STATS */}
        {deals.length > 0 && (
          <div className="dl-stats">
            <div className="dl-stat"><span style={{fontSize:18}}>🤝</span><div><div className="dl-stat-val">{deals.length}</div><div className="dl-stat-lbl">Total</div></div></div>
            <div className="dl-stat"><span style={{fontSize:18}}>⏳</span><div><div className="dl-stat-val">{deals.filter(d=>d.status==="pending").length}</div><div className="dl-stat-lbl">Pending</div></div></div>
            <div className="dl-stat"><span style={{fontSize:18}}>⚡</span><div><div className="dl-stat-val">{deals.filter(d=>d.status==="active").length}</div><div className="dl-stat-lbl">Active</div></div></div>
            <div className="dl-stat"><span style={{fontSize:18}}>✅</span><div><div className="dl-stat-val">{deals.filter(d=>d.status==="completed").length}</div><div className="dl-stat-lbl">Done</div></div></div>
            <div className="dl-stat"><span style={{fontSize:18}}>💰</span><div><div className="dl-stat-val">₹{deals.reduce((s,d)=>s+(d.amount||0),0).toLocaleString()}</div><div className="dl-stat-lbl">Total Value</div></div></div>
          </div>
        )}

        {loading ? <div className="spinner" /> :
          deals.length === 0 ? (
            <div className="dl-empty">
              <div className="dl-empty-icon">🤝</div>
              <h3 className="dl-empty-title">No deals yet</h3>
              <p className="dl-empty-sub">{role === "brand" ? "Create a deal to start working with a creator" : "Deals from brands will appear here"}</p>
              {role === "brand" && <Link href="/deals/create" className="dl-create-btn">+ Create Deal</Link>}
            </div>
          ) : (
            <div className="dl-grid">
              {deals.map((deal, idx) => {
                const escrowPct = deal.escrowDeposited ? (deal.status === "completed" ? 100 : 60) : 0;
                return (
                  <div key={deal._id} className="dl-card" style={{ animationDelay: `${idx * 0.06}s` }}
                    onClick={() => router.push(`/deals/${deal._id}`)}>
                    <div className="dl-card-top">
                      <div>
                        <div className="dl-card-title">{deal.title || deal.campaignTitle || "Deal"}</div>
                        <div className="dl-card-sub">#{deal._id?.slice(-6)}</div>
                      </div>
                      <div className="dl-status" style={{
                        background: statusBg[deal.status] || "#f5f5f5",
                        color: statusColor[deal.status] || "#555",
                        border: `1px solid ${statusColor[deal.status] || "#ddd"}22`
                      }}>{deal.status || "pending"}</div>
                    </div>

                    <div className="dl-amount-row">
                      <div>
                        <div className="dl-amount-lbl">Deal Amount</div>
                        <div className="dl-amount">₹{(deal.amount || 0).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="dl-amount-lbl">Escrow</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: deal.escrowDeposited ? "#16a34a" : "#f59e0b" }}>
                          {deal.escrowDeposited ? "✓ Deposited" : "⏳ Pending"}
                        </div>
                      </div>
                    </div>

                    {/* Escrow progress bar */}
                    <div className="dl-escrow-bar">
                      <div className="dl-escrow-fill" style={{ width: `${escrowPct}%` }} />
                    </div>
                    <div className="dl-escrow-labels">
                      <span>Deal Created</span>
                      <span>Work Done</span>
                      <span>💰 Released</span>
                    </div>

                    <div className="dl-parties">
                      <div className="dl-party">
                        <div className="dl-party-lbl">Brand</div>
                        <div className="dl-party-val">{deal.brandName || deal.brand?.name || "Brand"}</div>
                      </div>
                      <div className="dl-party">
                        <div className="dl-party-lbl">Creator</div>
                        <div className="dl-party-val">{deal.creatorName || deal.creator?.name || deal.influencer?.name || "Creator"}</div>
                      </div>
                    </div>

                    <div className="dl-actions" onClick={e => e.stopPropagation()}>
                      <Link href={`/deals/${deal._id}`} className="dl-btn dl-btn-view">👁 View</Link>
                      {role === "brand" && !deal.escrowDeposited && deal.status !== "completed" && (
                        <button className="dl-btn dl-btn-deposit"
                          disabled={actioning === deal._id + "_deposit"}
                          onClick={() => handleDeposit(deal)}>
                          {actioning === deal._id + "_deposit" ? "Processing..." : "💰 Deposit"}
                        </button>
                      )}
                      {role === "brand" && deal.deliverableSubmitted && deal.status !== "completed" && (
                        <button className="dl-btn dl-btn-approve"
                          disabled={actioning === deal._id + "_approve"}
                          onClick={() => handleApprove(deal._id)}>
                          {actioning === deal._id + "_approve" ? "Approving..." : "✓ Approve"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </>
  );
}