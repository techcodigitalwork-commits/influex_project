"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = "http://54.252.201.93:5000/api";

export default function ContractsPage() {
  const router = useRouter();
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [role, setRole]           = useState("");
  const [token, setToken]         = useState("");

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setToken(parsed.token);
    setRole(parsed.role?.toLowerCase() || "");
    fetchContracts(parsed.token);
  }, []);

  const fetchContracts = async (t: string) => {
    try {
      const res = await fetch(`${API}/contract/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setContracts(data.contracts || data.data || []);
    } catch { setContracts([]); }
    finally { setLoading(false); }
  };

  const statusMeta: Record<string, {bg:string;color:string;label:string}> = {
    draft:    { bg:"#f5f5f5",  color:"#888",    label:"Draft" },
    sent:     { bg:"#fffbeb",  color:"#d97706", label:"Awaiting Signature" },
    signed:   { bg:"#f0fdf4",  color:"#16a34a", label:"Signed ✓" },
    rejected: { bg:"#fff5f5",  color:"#dc2626", label:"Rejected" },
    expired:  { bg:"#f5f5f5",  color:"#aaa",    label:"Expired" },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        .ct { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }
        .ct-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
        @media(max-width:600px){ .ct-header{ padding: 14px 16px; } }
        .ct-title { font-size: 22px; font-weight: 800; color: #111; }
        .ct-sub   { font-size: 13px; color: #aaa; margin-top: 2px; }
        .ct-create-btn { padding: 10px 20px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); font-family: 'Plus Jakarta Sans', sans-serif; }
        .ct-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
        .ct-stats { display: flex; gap: 12px; padding: 16px 32px 0; flex-wrap: wrap; }
        @media(max-width:600px){ .ct-stats{ padding: 12px 16px 0; gap:10px; } }
        .ct-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .ct-stat-val { font-size: 20px; font-weight: 800; color: #111; }
        .ct-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }
        .ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; padding: 20px 32px 40px; }
        @media(max-width:768px){ .ct-grid{ grid-template-columns:1fr; padding: 14px 16px 28px; gap:12px; } }
        .ct-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 22px; transition: all 0.22s; animation: fadeUp 0.3s ease both; position: relative; overflow: hidden; cursor: pointer; }
        .ct-card::before { content:""; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,#4f46e5,#7c3aed); opacity:0; transition:opacity 0.2s; }
        .ct-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
        .ct-card:hover::before { opacity:1; }
        .ct-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
        .ct-card-icon { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .ct-card-title { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
        .ct-card-sub   { font-size: 12px; color: #aaa; }
        .ct-status-badge { padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; flex-shrink: 0; }
        .ct-parties { display: flex; gap: 8px; margin-bottom: 14px; }
        .ct-party { flex:1; background:#f9f9f8; border-radius:10px; padding:9px 12px; border:1px solid #f0f0f0; }
        .ct-party-lbl { font-size:10px; color:#c0c0c0; text-transform:uppercase; letter-spacing:0.07em; font-weight:600; margin-bottom:3px; }
        .ct-party-val { font-size:13px; font-weight:700; color:#111; }
        .ct-party-sig { font-size:11px; color:#16a34a; margin-top:2px; font-weight:600; }
        .ct-party-sig.pending { color:#f59e0b; }
        .ct-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
        .ct-meta-chip { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: #f9f9f8; border-radius: 8px; font-size: 12px; color: #666; font-weight: 500; border: 1px solid #f0f0f0; }
        .ct-actions { display: flex; gap: 8px; }
        .ct-btn { flex:1; padding:10px; border-radius:10px; font-size:12px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:4px; }
        .ct-btn-view   { background:#eef2ff; color:#4f46e5; }
        .ct-btn-view:hover { background:#e0e7ff; }
        .ct-btn-sign   { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; box-shadow:0 2px 8px rgba(34,197,94,0.25); }
        .ct-btn-sign:hover { transform:translateY(-1px); }
        .ct-btn-send   { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; }
        .ct-btn-send:hover { transform:translateY(-1px); }
        .ct-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:70px 24px; text-align:center; margin:20px 32px; background:#fff; border-radius:18px; border:1.5px dashed #e0e0e0; }
        .ct-empty-icon  { font-size:48px; margin-bottom:16px; }
        .ct-empty-title { font-size:20px; font-weight:800; color:#111; margin:0 0 8px; }
        .ct-empty-sub   { color:#aaa; font-size:14px; margin:0 0 24px; max-width:280px; line-height:1.6; }
        .spinner { width:28px; height:28px; border:3px solid #e0e0e0; border-top-color:#4f46e5; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; display:block; }
      `}</style>

      <div className="ct">
        <div className="ct-header">
          <div>
            <div className="ct-title">Contracts</div>
            <div className="ct-sub">{contracts.length} contract{contracts.length !== 1 ? "s" : ""} total</div>
          </div>
          {role === "brand" && <Link href="/contracts/create" className="ct-create-btn">+ Create Contract</Link>}
        </div>

        {contracts.length > 0 && (
          <div className="ct-stats">
            <div className="ct-stat"><span style={{fontSize:18}}>📄</span><div><div className="ct-stat-val">{contracts.length}</div><div className="ct-stat-lbl">Total</div></div></div>
            <div className="ct-stat"><span style={{fontSize:18}}>✅</span><div><div className="ct-stat-val">{contracts.filter(c=>c.status==="signed").length}</div><div className="ct-stat-lbl">Signed</div></div></div>
            <div className="ct-stat"><span style={{fontSize:18}}>⏳</span><div><div className="ct-stat-val">{contracts.filter(c=>c.status==="pending").length}</div><div className="ct-stat-lbl">Pending</div></div></div>
            <div className="ct-stat"><span style={{fontSize:18}}>📝</span><div><div className="ct-stat-val">{contracts.filter(c=>c.status==="pending").length}</div><div className="ct-stat-lbl">Pending</div></div></div>
          </div>
        )}

        {loading ? <div className="spinner" /> :
          contracts.length === 0 ? (
            <div className="ct-empty">
              <div className="ct-empty-icon">📄</div>
              <h3 className="ct-empty-title">No contracts yet</h3>
              <p className="ct-empty-sub">{role === "brand" ? "Create a contract and send it to a creator for signing" : "Contracts from brands will appear here for your signature"}</p>
              {role === "brand" && <Link href="/contracts/create" className="ct-create-btn">+ Create Contract</Link>}
            </div>
          ) : (
            <div className="ct-grid">
              {contracts.map((c, idx) => {
                const sm = statusMeta[c.status] || statusMeta.draft;
                const brandSigned   = c.brandSigned || c.status === "signed";
                const creatorSigned = c.creatorSigned || c.status === "signed";
                const needsMySign   = (role === "influencer" || role === "creator") && c.status === "pending" && !c.creatorSigned;
                return (
                  <div key={c._id} className="ct-card" style={{animationDelay:`${idx*0.06}s`}}
                    onClick={() => router.push(`/contracts/${c._id}`)}>
                    <div className="ct-card-top">
                      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                        <div className="ct-card-icon">📄</div>
                        <div>
                          <div className="ct-card-title">{c.title || "Contract"}</div>
                          <div className="ct-card-sub">#{c._id?.slice(-6)} · {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : ""}</div>
                        </div>
                      </div>
                      <div className="ct-status-badge" style={{background:sm.bg,color:sm.color,border:`1px solid ${sm.color}33`}}>{sm.label}</div>
                    </div>

                    <div className="ct-parties">
                      <div className="ct-party">
                        <div className="ct-party-lbl">Brand</div>
                        <div className="ct-party-val">{c.brandName || c.brand?.name || "Brand"}</div>
                        <div className={`ct-party-sig ${brandSigned ? "" : "pending"}`}>{brandSigned ? "✓ Signed" : "⏳ Pending"}</div>
                      </div>
                      <div className="ct-party">
                        <div className="ct-party-lbl">Creator</div>
                        <div className="ct-party-val">{c.creatorName || c.creator?.name || "Creator"}</div>
                        <div className={`ct-party-sig ${creatorSigned ? "" : "pending"}`}>{creatorSigned ? "✓ Signed" : "⏳ Pending"}</div>
                      </div>
                    </div>

                    <div className="ct-meta">
                      {c.amount && <span className="ct-meta-chip">💰 ₹{Number(c.amount).toLocaleString()}</span>}
                      {c.deadline && <span className="ct-meta-chip">📅 {new Date(c.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>}
                      {c.campaignTitle && <span className="ct-meta-chip">📋 {c.campaignTitle}</span>}
                    </div>

                    <div className="ct-actions" onClick={e=>e.stopPropagation()}>
                      <Link href={`/contracts/${c._id}`} className="ct-btn ct-btn-view">👁 View</Link>
                      {needsMySign && <Link href={`/contracts/${c._id}?action=sign`} className="ct-btn ct-btn-sign">✍ Sign Now</Link>}
                      {role === "brand" && c.status === "pending" && <Link href={`/contracts/${c._id}?action=send`} className="ct-btn ct-btn-send">📤 Send</Link>}
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