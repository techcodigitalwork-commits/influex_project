"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "https://api.collabzy.in/api";

export default function MyApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [token, setToken]               = useState("");
  const [filter, setFilter]             = useState("all"); // all | pending | accepted | rejected

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    if (p.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
    setToken(p.token);
    fetchApplications(p.token);
  }, []);

  const fetchApplications = async (t: string) => {
    try {
      const res  = await fetch(`${API}/application/my`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      const list: any[] = data.applications || data.data || [];
      // Sort newest first, filter out null campaignId
      const valid = list.filter((a: any) => a.campaignId && typeof a.campaignId === "object");
      valid.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setApplications(valid);
    } catch { setApplications([]); }
    finally { setLoading(false); }
  };

  const filtered = filter === "all"
    ? applications
    : applications.filter(a => (a.status || "pending") === filter);

  const statusMeta = (s: string) => {
    switch(s) {
      case "accepted": return { bg: "#f0fdf4", color: "#16a34a", border: "#86efac", label: "✅ Accepted" };
      case "rejected": return { bg: "#fff5f5", color: "#dc2626", border: "#fecaca", label: "❌ Rejected" };
      default:         return { bg: "#fffbeb", color: "#d97706", border: "#fde68a", label: "⏳ Pending" };
    }
  };

  const fmtDate = (d: any) => {
    if (!d) return "";
    try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  const counts = {
    all:      applications.length,
    pending:  applications.filter(a => !a.status || a.status === "pending").length,
    accepted: applications.filter(a => a.status === "accepted").length,
    rejected: applications.filter(a => a.status === "rejected").length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .ma{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh;padding-bottom:48px}

        /* HEADER */
        .ma-header{background:#fff;border-bottom:1px solid #efefef;padding:24px 32px}
        @media(max-width:600px){.ma-header{padding:16px}}
        .ma-title{font-size:24px;font-weight:800;color:#111;margin-bottom:4px}
        .ma-sub{font-size:13px;color:#aaa}

        /* STATS ROW */
        .ma-stats{display:flex;gap:12px;padding:20px 32px 0;flex-wrap:wrap}
        @media(max-width:600px){.ma-stats{padding:14px 16px 0;gap:8px}}
        .ma-stat{background:#fff;border:1.5px solid #efefef;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .2s}
        .ma-stat:hover{border-color:#c7d2fe;transform:translateY(-1px)}
        .ma-stat.active{border-color:#4f46e5;background:#eef2ff}
        .ma-stat-val{font-size:22px;font-weight:800;color:#111}
        .ma-stat-lbl{font-size:12px;color:#aaa;font-weight:500}
        .ma-stat.active .ma-stat-val{color:#4f46e5}
        .ma-stat.active .ma-stat-lbl{color:#6366f1}

        /* FILTER PILLS */
        .ma-filters{display:flex;gap:8px;padding:16px 32px;flex-wrap:wrap}
        @media(max-width:600px){.ma-filters{padding:12px 16px}}
        .ma-pill{padding:8px 16px;border-radius:100px;font-size:13px;font-weight:600;border:1.5px solid #e8e8e8;background:#fff;color:#888;cursor:pointer;transition:all .2s;font-family:inherit}
        .ma-pill:hover{border-color:#4f46e5;color:#4f46e5}
        .ma-pill.active{background:#4f46e5;color:#fff;border-color:#4f46e5}

        /* LIST */
        .ma-list{padding:0 32px 32px;display:flex;flex-direction:column;gap:14px}
        @media(max-width:600px){.ma-list{padding:0 16px 24px}}

        /* CARD */
        .ma-card{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:20px;transition:all .2s;animation:fadeUp .3s ease both;cursor:pointer}
        .ma-card:hover{border-color:#c7d2fe;box-shadow:0 6px 24px rgba(79,70,229,.08);transform:translateY(-1px)}
        .ma-card-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px}
        .ma-card-icon{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#eef2ff,#f5f3ff);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
        .ma-card-title{font-size:16px;font-weight:700;color:#111;margin-bottom:3px}
        .ma-card-sub{font-size:12px;color:#aaa}
        .ma-status{padding:5px 14px;border-radius:100px;font-size:12px;font-weight:700;flex-shrink:0;white-space:nowrap}
        .ma-info-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px}
        .ma-info-chip{display:flex;align-items:center;gap:5px;padding:5px 12px;background:#f9f9f8;border-radius:8px;font-size:12px;color:#555;font-weight:500;border:1px solid #f0f0f0}
        .ma-proposal{font-size:13px;color:#666;line-height:1.6;background:#f9f9f8;border-radius:10px;padding:12px 14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .ma-view-btn{margin-top:12px;width:100%;padding:10px;border-radius:10px;background:#eef2ff;color:#4f46e5;font-size:13px;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:all .2s}
        .ma-view-btn:hover{background:#e0e7ff}
        .ma-accepted-banner{display:flex;align-items:center;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;margin-top:10px;font-size:13px;color:#16a34a;font-weight:600}
        .ma-rejected-banner{display:flex;align-items:center;gap:8px;background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;margin-top:10px;font-size:13px;color:#dc2626;font-weight:600}

        /* EMPTY */
        .ma-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;margin:20px 32px;background:#fff;border-radius:18px;border:1.5px dashed #e0e0e0}
        @media(max-width:600px){.ma-empty{margin:16px}}
        .ma-empty-icon{font-size:48px;margin-bottom:16px}
        .ma-empty-title{font-size:18px;font-weight:800;color:#111;margin-bottom:8px}
        .ma-empty-sub{font-size:14px;color:#aaa;line-height:1.6;max-width:260px;margin-bottom:20px}
        .ma-discover-btn{padding:12px 24px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border-radius:12px;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;transition:all .2s}
        .ma-discover-btn:hover{transform:translateY(-1px)}
        .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin .8s linear infinite;margin:80px auto;display:block}
      `}</style>

      <div className="ma">
        {/* HEADER */}
        <div className="ma-header">
          <div className="ma-title">📩 My Applications</div>
          <div className="ma-sub">Track all campaigns you've applied to</div>
        </div>

        {/* STATS */}
        {!loading && (
          <div className="ma-stats">
            <div className={`ma-stat ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div><div className="ma-stat-val">{counts.all}</div><div className="ma-stat-lbl">Total</div></div>
            </div>
            <div className={`ma-stat ${filter === "pending" ? "active" : ""}`} onClick={() => setFilter("pending")}>
              <span style={{ fontSize: 20 }}>⏳</span>
              <div><div className="ma-stat-val">{counts.pending}</div><div className="ma-stat-lbl">Pending</div></div>
            </div>
            <div className={`ma-stat ${filter === "accepted" ? "active" : ""}`} onClick={() => setFilter("accepted")}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div><div className="ma-stat-val">{counts.accepted}</div><div className="ma-stat-lbl">Accepted</div></div>
            </div>
            <div className={`ma-stat ${filter === "rejected" ? "active" : ""}`} onClick={() => setFilter("rejected")}>
              <span style={{ fontSize: 20 }}>❌</span>
              <div><div className="ma-stat-val">{counts.rejected}</div><div className="ma-stat-lbl">Rejected</div></div>
            </div>
          </div>
        )}

        {/* FILTER PILLS */}
        {!loading && applications.length > 0 && (
          <div className="ma-filters">
            {(["all", "pending", "accepted", "rejected"] as const).map(f => (
              <button key={f} className={`ma-pill ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "pending" ? "⏳ Pending" : f === "accepted" ? "✅ Accepted" : "❌ Rejected"}
                {" "}({counts[f]})
              </button>
            ))}
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="spinner" />
        ) : filtered.length === 0 ? (
          <div className="ma-empty">
            <div className="ma-empty-icon">{filter === "all" ? "📩" : filter === "accepted" ? "✅" : filter === "rejected" ? "❌" : "⏳"}</div>
            <div className="ma-empty-title">
              {filter === "all" ? "No applications yet" : `No ${filter} applications`}
            </div>
            <p className="ma-empty-sub">
              {filter === "all"
                ? "Start applying to campaigns to track them here"
                : `You have no ${filter} applications right now`}
            </p>
            {filter === "all" && (
              <button className="ma-discover-btn" onClick={() => router.push("/discovery")}>
                🔍 Discover Campaigns
              </button>
            )}
          </div>
        ) : (
          <div className="ma-list">
            {filtered.map((app, idx) => {
              const camp = app.campaignId;
              const sm   = statusMeta(app.status || "pending");
              return (
                <div
                  key={app._id}
                  className="ma-card"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                  onClick={() => router.push(`/apply?id=${camp._id}`)}
                >
                  <div className="ma-card-top">
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
                      <div className="ma-card-icon">🎯</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="ma-card-title">{camp.title || "Campaign"}</div>
                        <div className="ma-card-sub">Applied {fmtDate(app.createdAt)}</div>
                      </div>
                    </div>
                    <div className="ma-status" style={{ background: sm.bg, color: sm.color, border: `1px solid ${sm.border}` }}>
                      {sm.label}
                    </div>
                  </div>

                  {/* Campaign info chips */}
                  <div className="ma-info-row">
                    {camp.budget && <span className="ma-info-chip">💰 ₹{Number(camp.budget).toLocaleString("en-IN")}</span>}
                    {camp.city   && <span className="ma-info-chip">📍 {camp.city.charAt(0).toUpperCase() + camp.city.slice(1)}</span>}
                    {app.bidAmount > 0 && <span className="ma-info-chip">🎯 Bid: ₹{Number(app.bidAmount).toLocaleString("en-IN")}</span>}
                    {camp.categories?.length > 0 && (
                      <span className="ma-info-chip">🏷 {camp.categories.slice(0, 2).join(", ")}</span>
                    )}
                    <span className="ma-info-chip" style={{ background: camp.status === "ongoing" ? "#eef2ff" : "#f9f9f8", color: camp.status === "ongoing" ? "#4f46e5" : "#555" }}>
                      {camp.status === "ongoing" ? "⚡ Ongoing" : camp.status === "completed" ? "✅ Completed" : "🟢 Open"}
                    </span>
                  </div>

                  {/* Proposal preview */}
                  {app.proposal && (
                    <div className="ma-proposal">"{app.proposal}"</div>
                  )}

                  {/* Status banner */}
                  {app.status === "accepted" && (
                    <div className="ma-accepted-banner">
                      🎉 Congratulations! Brand accepted your application. Check Deals for next steps.
                    </div>
                  )}
                  {app.status === "rejected" && (
                    <div className="ma-rejected-banner">
                      Brand reviewed but didn't select you this time. Keep applying!
                    </div>
                  )}

                  <button className="ma-view-btn" onClick={e => { e.stopPropagation(); router.push(`/apply?id=${camp._id}`); }}>
                    👁 View Campaign →
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}