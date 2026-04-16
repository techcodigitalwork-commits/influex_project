"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const API_BASE = "https://api.collabzy.in/api";

export default function CampaignApplications() {
  const { id } = useParams();
  const router  = useRouter();

  const [applications, setApplications]   = useState<any[]>([]);
  const [campaign, setCampaign]           = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [decidedApps, setDecidedApps]     = useState<Record<string, "accepted" | "rejected">>({});
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [modalProfile, setModalProfile]   = useState<any>(null);
  const [dealDoneIds, setDealDoneIds]     = useState<Set<string>>(new Set());

  const fetchedRef = useRef(false); // ← ADD

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!id) return;                // ← ADD
    if (fetchedRef.current) return; // ← ADD
    fetchedRef.current = true;      // ← ADD

    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    const { token } = parsed;
    const saved = localStorage.getItem("decidedApplications");
    if (saved) setDecidedApps(JSON.parse(saved));
    fetchData(token);
  }, [id]);

  const fetchData = async (token: string) => {
    try {
      const [campRes, appRes] = await Promise.all([
        fetch(`${API_BASE}/campaigns/${id}`,              { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const campData = await campRes.json();
      const appData  = await appRes.json();
      setCampaign(campData?.data || campData?.campaign || campData);
      const apps    = appData?.applications || appData?.data || [];
      const appList = Array.isArray(apps) ? apps : [];

      // Fetch full influencer profile
      const enriched = await Promise.all(
        appList.map(async (app: any) => {
          const userId = app?.influencerId?._id || app?.influencer?._id || app?.userId;
          if (!userId) return app;
          try {
            const pRes  = await fetch(`${API_BASE}/profile/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
            const pData = await pRes.json();
            const p     = pData?.profile || pData?.data || pData;
            return {
              ...app,
              influencer: {
                _id:          p?._id,
                user:         userId,
                name:         p?.name         || app?.influencerId?.email?.split("@")[0] || "Creator",
                email:        app?.influencerId?.email || "",
                profileImage: p?.profileImage || null,
                location:     p?.location     || p?.city || "",
                followers:    p?.followers    || null,
                categories:   p?.categories   || [],
                subCategories: p?.subCategories || [],
                phone:        p?.phone        || "",
                platform:     p?.platform     || p?.instagram || "",
                bio:          p?.bio          || "",
              },
            };
          } catch { return app; }
        })
      );

      setApplications(enriched);

      // Server status sync
      const serverStatuses: Record<string, "accepted" | "rejected"> = {};
      enriched.forEach((app: any) => {
        const s = (app.status || "").toLowerCase();
        if (s === "accepted" || s === "rejected") {
          serverStatuses[app._id] = s as "accepted" | "rejected";
        }
      });
      setDecidedApps(prev => {
        const merged = { ...prev, ...serverStatuses };
        localStorage.setItem("decidedApplications", JSON.stringify(merged));
        return merged;
      });

      // ← REMOVED: /api/deals fetch (route does not exist — was causing 404)
      // dealDoneIds will stay empty Set until deals API is built

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendNotif = async (token: string, creatorUserId: string, type: string, message: string, appId: string) => {
    try {
      await fetch(`${API_BASE}/notification/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user: creatorUserId, sender: JSON.parse(localStorage.getItem("cb_user") || "{}").id, message, type, applicationId: appId, link: "/notifications" }),
      });
    } catch { /* silent */ }
  };

  const handleAccept = async (app: any) => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) return;
    const { token } = JSON.parse(raw);
    const appId         = app._id;
    const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
    try {
      await fetch(`${API_BASE}/application/${appId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accepted" }),
      });
      if (creatorUserId) {
        await sendNotif(token, creatorUserId, "application_accepted",
          `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`, appId);
        try {
          const convRes  = await fetch(`${API_BASE}/conversations/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ participantId: creatorUserId }),
          });
          const convData = await convRes.json();
          const convId   = convData?.conversation?._id || convData?._id;
          if (convId) {
            await fetch(`${API_BASE}/conversations/send/${convId}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
            });
          }
        } catch { /* silent */ }
      }
      const updated = { ...decidedApps, [appId]: "accepted" as const };
      setDecidedApps(updated);
      localStorage.setItem("decidedApplications", JSON.stringify(updated));
      showToast("Application accepted ✓", "success");
    } catch {
      const updated = { ...decidedApps, [appId]: "accepted" as const };
      setDecidedApps(updated);
      localStorage.setItem("decidedApplications", JSON.stringify(updated));
      showToast("Accepted (saved locally)", "success");
    }
  };

  const handleReject = async (app: any) => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) return;
    const { token }     = JSON.parse(raw);
    const appId         = app._id;
    const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
    try {
      await fetch(`${API_BASE}/application/${appId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "rejected" }),
      });
      if (creatorUserId) {
        await sendNotif(token, creatorUserId, "application_rejected",
          `Your application for "${campaign?.title || "a campaign"}" was not selected this time. Keep applying! 💪`, appId);
      }
    } catch (err) { console.error("Reject error:", err); }
    const updated = { ...decidedApps, [appId]: "rejected" as const };
    setDecidedApps(updated);
    localStorage.setItem("decidedApplications", JSON.stringify(updated));
    showToast("Application rejected", "error");
  };

  const getName       = (a: any) => a?.influencer?.name || a?.influencerId?.email?.split("@")[0] || "Creator";
  const getImage      = (a: any) => a?.influencer?.profileImage || null;
  const getLocation   = (a: any) => a?.influencer?.location || "";
  // const getCategories = (a: any) => { const c = a?.influencer?.categories || []; return Array.isArray(c) ? c.join(", ") : c || ""; };
  const getCategories = (a: any) => {
  const main = a?.influencer?.categories || [];
  const sub  = a?.influencer?.subCategories || [];

  const mainStr = Array.isArray(main) ? main.join(", ") : main || "";
  const subStr  = Array.isArray(sub) ? sub.join(", ") : sub || "";

  if (mainStr && subStr) return `${mainStr} • ${subStr}`;
  return mainStr || subStr || "";
};
  const getFollowers  = (a: any) => {
    const f = a?.influencer?.followers;
    if (!f && f !== 0) return null;
    const num = Number(f);
    if (!isNaN(num) && num >= 1000) return (num / 1000).toFixed(1) + "K";
    return String(f);
  };
  const getPlatform  = (a: any) => a?.influencer?.platform || "";
  const getPhone     = (a: any) => a?.influencer?.phone || "";

  const splitName = (name: string) => {
    if (!name) return { first: "", last: "" };
    const parts = name.trim().split(" ");
    if (parts.length === 1) return { first: parts[0], last: "" };
    return { first: parts[0], last: parts.slice(1).join(" ") };
  };

  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#999", fontSize: 14, fontFamily: "Plus Jakarta Sans, sans-serif" }}>Loading applications...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes slideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
        @keyframes toastIn { from { opacity:0;transform:translateX(-50%) translateY(8px); } to { opacity:1;transform:translateX(-50%) translateY(0); } }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .ap { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
        .ap-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .ap-header{ padding: 14px 16px; } }
        .ap-header-left h1 { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 3px; }
        .ap-header-left p  { font-size: 13px; color: #aaa; margin: 0; }
        .ap-back-btn { padding: 9px 18px; background: #f5f5f3; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: #555; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; }
        .ap-back-btn:hover { background: #ebebeb; }
        .ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 20px 32px 0; }
        @media(max-width:768px){ .ap-grid{ grid-template-columns: 1fr; padding: 14px 16px 0; gap: 12px; } }
        .ap-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; overflow: hidden; transition: all 0.2s; position: relative; }
        .ap-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
        .ap-card.accepted { border-color: #86efac; }
        .ap-card.rejected { border-color: #fca5a5; opacity: 0.7; }
        .ap-ribbon { position: absolute; top: 14px; right: 14px; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; z-index: 2; }
        .ap-ribbon.accepted { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
        .ap-ribbon.rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
        .ap-ribbon.pending  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .ap-card-top { padding: 14px 16px 10px; display: flex; align-items: center; gap: 12px; }
        .ap-avatar { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4f46e5; }
        .ap-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
        .ap-name-wrap { flex: 1; min-width: 0; }
        .ap-name { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 3px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
        .ap-location { font-size: 12px; color: #aaa; margin: 0; display: flex; align-items: center; gap: 4px; }
        .ap-card-info { padding: 0 16px 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .ap-info-item { background: #f9f9f8; border-radius: 8px; padding: 7px 10px; border: 1px solid #f0f0f0; }
        .ap-info-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
        .ap-info-val { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ap-note { margin: 0 16px 10px; background: #f9f9f8; border-radius: 8px; padding: 7px 10px; border: 1px solid #f0f0f0; }
        .ap-note-label { font-size: 9px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
        .ap-note-text { font-size: 12px; color: #666; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ap-actions { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 6px; }
        .ap-actions-row { display: flex; gap: 8px; }
        .ap-btn { flex: 1; padding: 10px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
        .ap-btn-view   { background: #f5f5f3; color: #555; }
        .ap-btn-view:hover   { background: #ebebeb; }
        .ap-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 2px 8px rgba(34,197,94,0.25); }
        .ap-btn-accept:hover { box-shadow: 0 4px 14px rgba(34,197,94,0.35); transform: translateY(-1px); }
        .ap-btn-reject { background: #fee2e2; color: #b91c1c; }
        .ap-btn-reject:hover { background: #fecaca; }
        .ap-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
        .ap-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
        .ap-btn-deal     { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.2); }
        .ap-btn-deal:hover { transform: translateY(-1px); }
        .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
        @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
        .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
        .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }
        .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
        .mo-box { background: #fff; border-radius: 24px; max-width: 580px; width: 100%; max-height: 92vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
        .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .mo-close:hover { background: #ebebeb; }
        .mo-img { width: 100%; height: 220px; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 72px; overflow: hidden; }
        .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; object-position: center 10%; }
        .mo-body { padding: 20px 24px 28px; }
        .mo-name { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; }
        .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
        .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
        .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
        .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
        .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
        .mo-actions { display: flex; gap: 10px; margin-top: 6px; }
        .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .ap-toast.success { background: #111; color: #fff; }
        .ap-toast.error   { background: #ef4444; color: #fff; }
      `}</style>

      {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

      {/* PROFILE MODAL */}
      {modalProfile && (() => {
        const app      = modalProfile;
        const name     = getName(app);
        const img      = getImage(app);
        const decision = decidedApps[app._id];
        const phone    = getPhone(app);
        const platform = getPlatform(app);
        const note     = app?.note || app?.message || app?.coverLetter || "";

        return (
          <div className="mo-overlay" onClick={() => setModalProfile(null)}>
            <div className="mo-box" onClick={e => e.stopPropagation()}>
              <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>
              <div className="mo-img">{img ? <img src={img} alt={name} /> : "👤"}</div>
              <div className="mo-body">
                <div className="mo-name">
                  {(() => {
                    const { first, last } = splitName(name);
                    return <>{first}{last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}</>;
                  })()}
                </div>
                <div className="mo-loc">📍 {getLocation(app) || "N/A"}</div>
                <div className="mo-section">Profile Details</div>
                <div className="mo-grid">
                  <div className="mo-item">
                    <div className="mo-item-label">Followers</div>
                    <div className="mo-item-val">{getFollowers(app) || "N/A"}</div>
                  </div>
                  {/* <div className="mo-item">
                    <div className="mo-item-label">Category</div>
                    <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "N/A"}</div>
                  </div> */}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="mo-item" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                    <span>📞</span>
                    <span style={{ fontSize: 13, color: "#aaa", letterSpacing: "0.04em" }}>+91 XXXXXXXXXX</span>
                  </div>
                  <div className="mo-item" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span>📸</span>
                    <span style={{ fontSize: 13, color: "#aaa", letterSpacing: "0.04em" }}>instagram.com/XXXXXX</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600, marginTop: 8, textAlign: "center" }}>🔒 Complete the deal to unlock contact details</div>
                </div>
                {(app?.bidAmount || app?.bid || app?.amount) && (
                  <>
                    <div className="mo-section">Bid Amount</div>
                    <div className="mo-item" style={{ marginBottom: 16 }}>
                      <div className="mo-item-val" style={{ fontWeight: 800, color: "#4f46e5", fontSize: 20 }}>
                        ₹{Number(app?.bidAmount || app?.bid || app?.amount).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </>
                )}
                {note && (
                  <>
                    <div className="mo-section">Proposal</div>
                    <div className="mo-item" style={{ marginBottom: 16 }}>
                      <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note}</div>
                    </div>
                  </>
                )}
                <div className="mo-actions">
                  {decision === "accepted" ? (
                    <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
                  ) : decision === "rejected" ? (
                    <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
                  ) : (
                    <>
                      <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>✓ Accept</button>
                      <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>✗ Reject</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="ap">
        <div className="ap-header">
          <div className="ap-header-left">
            <h1>Applications</h1>
            <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
        </div>

        {applications.length === 0 ? (
          <div className="ap-empty">
            <div className="ap-empty-icon">📭</div>
            <h3 className="ap-empty-title">No applications yet</h3>
            <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
          </div>
        ) : (
          <div className="ap-grid">
            {applications.map(app => {
              const name       = getName(app);
              const img        = getImage(app);
              const location   = getLocation(app);
              const categories = getCategories(app);
              const followers  = getFollowers(app);
              const note       = app?.note || app?.proposal || app?.message || app?.coverLetter || "";
              const decision   = decidedApps[app._id];
              const initials   = name.slice(0, 2).toUpperCase();

                const mainCategories = Array.isArray(app?.influencer?.categories)
    ? app.influencer.categories.join(", ")
    : app?.influencer?.categories || "";

  const subCategories = Array.isArray(app?.influencer?.subCategories)
    ? app.influencer.subCategories.join(", ")
    : app?.influencer?.subCategories || "";

              return (
                <div key={app._id} className={`ap-card ${decision || ""}`}>
                  <div className={`ap-ribbon ${decision || "pending"}`}>
                    {decision === "accepted" ? "✓ Accepted" : decision === "rejected" ? "✗ Rejected" : "⏳ Pending"}
                  </div>

                  <div className="ap-card-top">
                    <div className="ap-avatar">
                      {img ? <img src={img} alt={name} /> : initials}
                    </div>
                    <div className="ap-name-wrap">
                      <div className="ap-name">
                        {(() => {
                          const { first, last } = splitName(name);
                          return <>{first}{last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}</>;
                        })()}
                      </div>
                      <div className="ap-location">📍 {location || "N/A"}</div>
                    </div>
                  </div>

                  <div className="ap-card-info">
                    <div className="ap-info-item">
                      <div className="ap-info-label">Followers</div>
                      <div className="ap-info-val">{followers || "N/A"}</div>
                    </div>
                    {/* <div className="ap-info-item">
                      <div className="ap-info-label">Category</div>
                      <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "N/A"}</div>
                    </div> */}
                    <div className="ap-info-item">
  <div className="ap-info-label">Category</div>
  <div className="ap-info-val">{mainCategories || "N/A"}</div>
</div>

<div className="ap-info-item">
  <div className="ap-info-label">Sub Category</div>
  <div className="ap-info-val">{subCategories || "N/A"}</div>
</div>
                  </div>

                  {/* Contact — always masked (unlock via deals feature later) */}
                  <div style={{ margin: "0 16px 10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f9f9f8", borderRadius: 8, border: "1px solid #f0f0f0", marginBottom: 6 }}>
                      <span style={{ fontSize: 13 }}>📞</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa", letterSpacing: "0.04em" }}>+91 XXXXXXXXXX</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f9f9f8", borderRadius: 8, border: "1px solid #f0f0f0" }}>
                      <span style={{ fontSize: 13 }}>📸</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#aaa", letterSpacing: "0.04em" }}>instagram.com/XXXXXX</span>
                    </div>
                  </div>

                  {app?.bidAmount > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 16px 8px", padding: "6px 12px", background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
                      <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>💰 Bid:</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5" }}>₹{Number(app.bidAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {note && (
                    <div className="ap-note">
                      <div className="ap-note-label">Proposal</div>
                      <div className="ap-note-text">{note.length > 120 ? note.slice(0, 120) + "..." : note}</div>
                    </div>
                  )}

                  <div className="ap-actions">
                    <div className="ap-actions-row">
                      <button className="ap-btn ap-btn-view" onClick={() => {
                        const creatorId = app?.influencerId?._id || app?.influencer?._id || app?.influencer?.user || app?.userId;
                        router.push(`/campaigns/${id}/applications/creator/${creatorId}?appId=${app._id}&campaignId=${id}`);
                      }}>
                        👤 View Profile
                      </button>
                      {decision === "accepted" ? (
                        <div className="ap-btn ap-btn-accepted">✓ Accepted</div>
                      ) : decision === "rejected" ? (
                        <div className="ap-btn ap-btn-rejected">✗ Rejected</div>
                      ) : (
                        <>
                          <button className="ap-btn ap-btn-accept" onClick={() => handleAccept(app)}>✓ Accept</button>
                          <button className="ap-btn ap-btn-reject" onClick={() => handleReject(app)}>✗ Reject</button>
                        </>
                      )}
                    </div>
                    {decision === "accepted" && (
                      <div className="ap-actions-row">
                        <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id || app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}



// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "https://api.collabzy.in/api";

// export default function CampaignApplications() {
//   const { id } = useParams();
//   const router  = useRouter();

//   const [applications, setApplications]   = useState<any[]>([]);
//   const [campaign, setCampaign]           = useState<any>(null);
//   const [loading, setLoading]             = useState(true);
//   const [decidedApps, setDecidedApps]     = useState<Record<string, "accepted" | "rejected">>({});
//   const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const [modalProfile, setModalProfile]   = useState<any>(null);
//   // dealDoneIds: set of applicationIds where deal is completed
//   const [dealDoneIds, setDealDoneIds]     = useState<Set<string>>(new Set());

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     const { token } = parsed;
//     const saved = localStorage.getItem("decidedApplications");
//     if (saved) setDecidedApps(JSON.parse(saved));
//     fetchData(token);
//   }, [id]);

//   const fetchData = async (token: string) => {
//     try {
//       const [campRes, appRes] = await Promise.all([
//         fetch(`${API_BASE}/campaigns/${id}`,              { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const campData = await campRes.json();
//       const appData  = await appRes.json();
//       setCampaign(campData?.data || campData?.campaign || campData);
//       const apps    = appData?.applications || appData?.data || [];
//       const appList = Array.isArray(apps) ? apps : [];

//       // Fetch full influencer profile
//       const enriched = await Promise.all(
//         appList.map(async (app: any) => {
//           const userId = app?.influencerId?._id || app?.influencer?._id || app?.userId;
//           if (!userId) return app;
//           try {
//             const pRes  = await fetch(`${API_BASE}/profile/user/${userId}`, { headers: { Authorization: `Bearer ${token}` } });
//             const pData = await pRes.json();
//             const p     = pData?.profile || pData?.data || pData;
//             return {
//               ...app,
//               influencer: {
//                 _id:          p?._id,
//                 user:         userId,
//                 name:         p?.name         || app?.influencerId?.email?.split("@")[0] || "Creator",
//                 email:        app?.influencerId?.email || "",
//                 profileImage: p?.profileImage || null,
//                 location:     p?.location     || p?.city || "",
//                 followers:    p?.followers    || null,
//                 categories:   p?.categories   || [],
//                 phone:        p?.phone        || "",
//                 platform:     p?.platform     || p?.instagram || "",
//                 bio:          p?.bio          || "",
//               },
//             };
//           } catch { return app; }
//         })
//       );

//       setApplications(enriched);

//       // ✅ SERVER STATUS SYNC — notification se accept/reject karo to yahan bhi reflect ho
//       const serverStatuses: Record<string, "accepted" | "rejected"> = {};
//       enriched.forEach((app: any) => {
//         const s = (app.status || "").toLowerCase();
//         if (s === "accepted" || s === "rejected") {
//           serverStatuses[app._id] = s as "accepted" | "rejected";
//         }
//       });
//       setDecidedApps(prev => {
//         const merged = { ...prev, ...serverStatuses };
//         localStorage.setItem("decidedApplications", JSON.stringify(merged));
//         return merged;
//       });

//       // Fetch deals to know which are completed
//       try {
//         const dealsRes  = await fetch(`${API_BASE}/deal/my `, { headers: { Authorization: `Bearer ${token}` } });
//         const dealsData = await dealsRes.json();
//         const deals: any[] = dealsData?.deals || dealsData?.data || [];
//         const doneSet = new Set<string>();
//         deals.forEach((deal: any) => {
//           const status = (deal.status || "").toLowerCase();
//           if (status === "completed" || status === "done" || status === "finished") {
//             // match by applicationId or campaignId+creatorId
//             if (deal.applicationId) doneSet.add(String(deal.applicationId));
//           }
//         });
//         setDealDoneIds(doneSet);
//       } catch { /* silent — deals API may not exist yet */ }

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const sendNotif = async (token: string, creatorUserId: string, type: string, message: string, appId: string) => {
//     try {
//       await fetch(`${API_BASE}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ user: creatorUserId, sender: JSON.parse(localStorage.getItem("cb_user") || "{}").id, message, type, applicationId: appId, link: "/notifications" }),
//       });
//     } catch { /* silent */ }
//   };

//   const handleAccept = async (app: any) => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;
//     const { token } = JSON.parse(raw);
//     const appId         = app._id;
//     const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
//     try {
//       await fetch(`${API_BASE}/application/${appId}/decision`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       if (creatorUserId) {
//         await sendNotif(token, creatorUserId, "application_accepted",
//           `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`, appId);
//         try {
//           const convRes  = await fetch(`${API_BASE}/conversations/start`, {
//             method: "POST",
//             headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//             body: JSON.stringify({ participantId: creatorUserId }),
//           });
//           const convData = await convRes.json();
//           const convId   = convData?.conversation?._id || convData?._id;
//           if (convId) {
//             await fetch(`${API_BASE}/conversations/send/${convId}`, {
//               method: "POST",
//               headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//               body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
//             });
//           }
//         } catch { /* silent */ }
//       }
//       const updated = { ...decidedApps, [appId]: "accepted" as const };
//       setDecidedApps(updated);
//       localStorage.setItem("decidedApplications", JSON.stringify(updated));
//       showToast("Application accepted ✓", "success");
//     } catch {
//       const updated = { ...decidedApps, [appId]: "accepted" as const };
//       setDecidedApps(updated);
//       localStorage.setItem("decidedApplications", JSON.stringify(updated));
//       showToast("Accepted (saved locally)", "success");
//     }
//   };

//   const handleReject = async (app: any) => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;
//     const { token }     = JSON.parse(raw);
//     const appId         = app._id;
//     const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
//     try {
//       await fetch(`${API_BASE}/application/${appId}/decision`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       if (creatorUserId) {
//         await sendNotif(token, creatorUserId, "application_rejected",
//           `Your application for "${campaign?.title || "a campaign"}" was not selected this time. Keep applying! 💪`, appId);
//       }
//     } catch (err) { console.error("Reject error:", err); }
//     const updated = { ...decidedApps, [appId]: "rejected" as const };
//     setDecidedApps(updated);
//     localStorage.setItem("decidedApplications", JSON.stringify(updated));
//     showToast("Application rejected", "error");
//   };

//   const getName       = (a: any) => a?.influencer?.name || a?.influencerId?.email?.split("@")[0] || "Creator";
//   const getImage      = (a: any) => a?.influencer?.profileImage || null;
//   const getLocation   = (a: any) => a?.influencer?.location || "";
//   const getCategories = (a: any) => { const c = a?.influencer?.categories || []; return Array.isArray(c) ? c.join(", ") : c || ""; };
//   const getFollowers  = (a: any) => {
//     const f = a?.influencer?.followers;
//     if (!f && f !== 0) return null;
//     const num = Number(f);
//     if (!isNaN(num) && num >= 1000) return (num / 1000).toFixed(1) + "K";
//     return String(f);
//   };
//   const getPlatform  = (a: any) => a?.influencer?.platform || "";
//   const getPhone     = (a: any) => a?.influencer?.phone || "";

//   // First name visible, last name blurred — full name shown when deal is done
//   const splitName = (name: string) => {
//     if (!name) return { first: "", last: "" };
//     const parts = name.trim().split(" ");
//     if (parts.length === 1) return { first: parts[0], last: "" };
//     return { first: parts[0], last: parts.slice(1).join(" ") };
//   };

//   const maskPhone    = () => "+91 XXXXXXXXXX";
//   const maskInstagram = (url: string) => {
//     if (!url) return "instagram.com/XXXXXX";
//     try {
//       const u = new URL(url);
//       return "instagram.com/XXXXXX";
//     } catch { return "instagram.com/XXXXXX"; }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ textAlign: "center" }}>
//         <div style={{ width: 32, height: 32, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
//         <p style={{ color: "#999", fontSize: 14, fontFamily: "Plus Jakarta Sans, sans-serif" }}>Loading applications...</p>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
//         @keyframes slideUp { from { transform:translateY(20px);opacity:0; } to { transform:translateY(0);opacity:1; } }
//         @keyframes toastIn { from { opacity:0;transform:translateX(-50%) translateY(8px); } to { opacity:1;transform:translateX(-50%) translateY(0); } }
//         body { font-family: 'Plus Jakarta Sans', sans-serif; }
//         .ap { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; padding-bottom: 48px; }
//         .ap-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
//         @media(max-width:600px){ .ap-header{ padding: 14px 16px; } }
//         .ap-header-left h1 { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 3px; }
//         .ap-header-left p  { font-size: 13px; color: #aaa; margin: 0; }
//         .ap-back-btn { padding: 9px 18px; background: #f5f5f3; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: #555; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; }
//         .ap-back-btn:hover { background: #ebebeb; }
//         .ap-stats { display: flex; gap: 12px; padding: 20px 32px 0; flex-wrap: wrap; }
//         @media(max-width:600px){ .ap-stats{ padding: 14px 16px 0; } }
//         .ap-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
//         .ap-stat-val { font-size: 20px; font-weight: 800; color: #111; }
//         .ap-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }
//         .ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 20px 32px 0; }
//         @media(max-width:768px){ .ap-grid{ grid-template-columns: 1fr; padding: 14px 16px 0; gap: 12px; } }
//         .ap-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; overflow: hidden; transition: all 0.2s; position: relative; }
//         .ap-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .ap-card.accepted { border-color: #86efac; }
//         .ap-card.rejected { border-color: #fca5a5; opacity: 0.7; }
//         .ap-ribbon { position: absolute; top: 14px; right: 14px; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; z-index: 2; }
//         .ap-ribbon.accepted { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
//         .ap-ribbon.rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
//         .ap-ribbon.pending  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
//         .ap-card-top { padding: 14px 16px 10px; display: flex; align-items: center; gap: 12px; }
//         .ap-avatar { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4f46e5; }
//         .ap-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
//         .ap-name-wrap { flex: 1; min-width: 0; }
//         .ap-name { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 3px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
//         .ap-location { font-size: 12px; color: #aaa; margin: 0; display: flex; align-items: center; gap: 4px; }
//         .ap-card-info { padding: 0 16px 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
//         .ap-info-item { background: #f9f9f8; border-radius: 8px; padding: 7px 10px; border: 1px solid #f0f0f0; }
//         .ap-info-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
//         .ap-info-val { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .ap-note { margin: 0 16px 10px; background: #f9f9f8; border-radius: 8px; padding: 7px 10px; border: 1px solid #f0f0f0; }
//         .ap-note-label { font-size: 9px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
//         .ap-note-text { font-size: 12px; color: #666; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
//         .ap-actions { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 6px; }
//         .ap-actions-row { display: flex; gap: 8px; }
//         .ap-btn { flex: 1; padding: 10px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 5px; white-space: nowrap; }
//         .ap-btn-view   { background: #f5f5f3; color: #555; }
//         .ap-btn-view:hover   { background: #ebebeb; }
//         .ap-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 2px 8px rgba(34,197,94,0.25); }
//         .ap-btn-accept:hover { box-shadow: 0 4px 14px rgba(34,197,94,0.35); transform: translateY(-1px); }
//         .ap-btn-reject { background: #fee2e2; color: #b91c1c; }
//         .ap-btn-reject:hover { background: #fecaca; }
//         .ap-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
//         .ap-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
//         .ap-btn-deal     { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.2); }
//         .ap-btn-deal:hover { transform: translateY(-1px); }
//         .ap-btn-contract { background: #f0f9ff; color: #0369a1; border: 1.5px solid #bae6fd; }
//         .ap-btn-contract:hover { background: #e0f2fe; }

//         /* Deal done contact reveal */
//         .ap-contact-revealed { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 10px; padding: 10px 14px; margin: 0 16px 10px; }
//         .ap-contact-revealed-title { font-size: 10px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .ap-contact-row { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #111; font-weight: 600; margin-bottom: 3px; }
//         .ap-contact-row:last-child { margin-bottom: 0; }

//         /* Hidden contact note */
//         .ap-contact-hidden { background: #f8f8f8; border: 1px dashed #e0e0e0; border-radius: 8px; padding: 8px 12px; margin: 0 16px 10px; font-size: 11px; color: #bbb; text-align: center; }

//         .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
//         .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
//         .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
//         .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }

//         /* Modal */
//         .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
//         .mo-box { background: #fff; border-radius: 24px; max-width: 580px; width: 100%; max-height: 92vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
//         .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
//         .mo-close:hover { background: #ebebeb; }
//         .mo-img { width: 100%; height: 220px; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 72px; overflow: hidden; }
//         .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; object-position: center 10%; }
//         .mo-body { padding: 20px 24px 28px; }
//         .mo-name { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; }
//         .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
//         .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
//         .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
//         .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
//         .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
//         .mo-actions { display: flex; gap: 10px; margin-top: 6px; }

//         /* Modal deal done contact */
//         .mo-contact-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
//         .mo-contact-title { font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 8px; }
//         .mo-contact-row { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #111; font-weight: 600; margin-bottom: 5px; }
//         .mo-contact-row:last-child { margin-bottom: 0; }
//         .mo-contact-row a { color: #4f46e5; text-decoration: none; font-size: 13px; }
//         .mo-contact-row a:hover { text-decoration: underline; }

//         /* Modal deal pending note */
//         .mo-deal-note { background: #fef9ec; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #92400e; font-weight: 500; }

//         .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .ap-toast.success { background: #111; color: #fff; }
//         .ap-toast.error   { background: #ef4444; color: #fff; }
//       `}</style>

//       {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* PROFILE MODAL */}
//       {modalProfile && (() => {
//         const app         = modalProfile;
//         const name        = getName(app);
//         const img         = getImage(app);
//         const decision    = decidedApps[app._id];
//         const phone       = getPhone(app);
//         const platform    = getPlatform(app);
//         const note        = app?.note || app?.message || app?.coverLetter || "";
//         const isDealDone  = dealDoneIds.has(app._id);

//         return (
//           <div className="mo-overlay" onClick={() => setModalProfile(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>
//               <div className="mo-img">{img ? <img src={img} alt={name} /> : "👤"}</div>
//               <div className="mo-body">
//                 <div className="mo-name">
//                   {(() => {
//                     const { first, last } = splitName(name);
//                     if (isDealDone) return <span>{name}</span>;
//                     return <>{first}{last && <> <span style={{filter:"blur(6px)",userSelect:"none",display:"inline-block"}}>{last}</span></>}</>;
//                   })()}
//                 </div>
//                 <div className="mo-loc">📍 {getLocation(app) || "N/A"}</div>

//                 <div className="mo-section">Profile Details</div>
//                 <div className="mo-grid">
//                   <div className="mo-item">
//                     <div className="mo-item-label">Followers</div>
//                     <div className="mo-item-val">{getFollowers(app) || "N/A"}</div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">Category</div>
//                     <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "N/A"}</div>
//                   </div>
//                 </div>

//                 {/* Contact rows in modal */}
//                 <div style={{marginBottom:16}}>
//                   <div className="mo-item" style={{marginBottom:8,display:"flex",alignItems:"center",gap:10}}>
//                     <span>📞</span>
//                     {isDealDone
//                       ? <span style={{fontSize:14,fontWeight:700,color:"#111"}}>{phone || "Not provided"}</span>
//                       : <span style={{fontSize:13,color:"#aaa",letterSpacing:"0.04em"}}>+91 XXXXXXXXXX</span>
//                     }
//                   </div>
//                   <div className="mo-item" style={{display:"flex",alignItems:"center",gap:10}}>
//                     <span>📸</span>
//                     {isDealDone
//                       ? (platform
//                           ? <a href={platform} target="_blank" rel="noreferrer" style={{fontSize:13,color:"#4f46e5",textDecoration:"none",fontWeight:600}}>{platform}</a>
//                           : <span style={{fontSize:13,color:"#aaa"}}>Not provided</span>)
//                       : <span style={{fontSize:13,color:"#aaa",letterSpacing:"0.04em"}}>instagram.com/XXXXXX</span>
//                     }
//                   </div>
//                   {!isDealDone && <div style={{fontSize:11,color:"#f59e0b",fontWeight:600,marginTop:8,textAlign:"center"}}>🔒 Complete the deal to unlock contact details</div>}
//                   {isDealDone  && <div style={{fontSize:11,color:"#16a34a",fontWeight:600,marginTop:8,textAlign:"center"}}>✅ Deal completed — contact unlocked</div>}
//                 </div>

//                 {(app?.bidAmount || app?.bid || app?.amount) && (
//                   <>
//                     <div className="mo-section">Bid Amount</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 800, color: "#4f46e5", fontSize: 20 }}>
//                         ₹{Number(app?.bidAmount || app?.bid || app?.amount).toLocaleString("en-IN")}
//                       </div>
//                     </div>
//                   </>
//                 )}

//                 {note && (
//                   <>
//                     <div className="mo-section">Proposal</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note}</div>
//                     </div>
//                   </>
//                 )}

//                 <div className="mo-actions">
//                   {decision === "accepted" ? (
//                     <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
//                   ) : decision === "rejected" ? (
//                     <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
//                   ) : (
//                     <>
//                       <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>✓ Accept</button>
//                       <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>✗ Reject</button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="ap">
//         <div className="ap-header">
//           <div className="ap-header-left">
//             <h1>Applications</h1>
//             <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
//           </div>
//           <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
//         </div>

//         {/* {applications.length > 0 && (
//           <div className="ap-stats">
//             <div className="ap-stat"><span style={{ fontSize: 20 }}>👥</span><div><div className="ap-stat-val">{applications.length}</div><div className="ap-stat-lbl">Total</div></div></div>
//             <div className="ap-stat"><span style={{ fontSize: 20 }}>✅</span><div><div className="ap-stat-val">{Object.values(decidedApps).filter(v => v === "accepted").length}</div><div className="ap-stat-lbl">Accepted</div></div></div>
//             <div className="ap-stat"><span style={{ fontSize: 20 }}>⏳</span><div><div className="ap-stat-val">{applications.filter(a => !decidedApps[a._id]).length}</div><div className="ap-stat-lbl">Pending</div></div></div>
//             <div className="ap-stat"><span style={{ fontSize: 20 }}>🤝</span><div><div className="ap-stat-val">{dealDoneIds.size}</div><div className="ap-stat-lbl">Deals Done</div></div></div>
//           </div>
//         )} */}

//         {applications.length === 0 ? (
//           <div className="ap-empty">
//             <div className="ap-empty-icon">📭</div>
//             <h3 className="ap-empty-title">No applications yet</h3>
//             <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
//           </div>
//         ) : (
//           <div className="ap-grid">
//             {applications.map(app => {
//               const name       = getName(app);
//               const img        = getImage(app);
//               const location   = getLocation(app);
//               const categories = getCategories(app);
//               const followers  = getFollowers(app);
//               const phone      = getPhone(app);
//               const platform   = getPlatform(app);
//               const note       = app?.note || app?.proposal || app?.message || app?.coverLetter || "";
//               const decision   = decidedApps[app._id];
//               const initials   = name.slice(0, 2).toUpperCase();
//               const isDealDone = dealDoneIds.has(app._id);

//               return (
//                 <div key={app._id} className={`ap-card ${decision || ""}`}>
//                   <div className={`ap-ribbon ${decision || "pending"}`}>
//                     {decision === "accepted" ? "✓ Accepted" : decision === "rejected" ? "✗ Rejected" : "⏳ Pending"}
//                   </div>

//                   <div className="ap-card-top">
//                     <div className="ap-avatar">
//                       {img ? <img src={img} alt={name} /> : initials}
//                     </div>
//                     <div className="ap-name-wrap">
//                       <div className="ap-name">
//                         {(() => {
//                           const { first, last } = splitName(name);
//                           if (isDealDone) return <span>{name}</span>;
//                           return <>{first}{last && <> <span style={{filter:"blur(5px)",userSelect:"none",display:"inline-block"}}>{last}</span></>}</>;
//                         })()}
//                       </div>
//                       <div className="ap-location">📍 {location || "N/A"}</div>
//                     </div>
//                   </div>

//                   <div className="ap-card-info">
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Followers</div>
//                       <div className="ap-info-val">{followers || "N/A"}</div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Category</div>
//                       <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "N/A"}</div>
//                     </div>
//                   </div>

//                   {/* Contact section */}
//                   <div style={{margin:"0 16px 10px"}}>
//                     {/* Phone */}
//                     <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#f9f9f8",borderRadius:8,border:"1px solid #f0f0f0",marginBottom:6}}>
//                       <span style={{fontSize:13}}>📞</span>
//                       {isDealDone
//                         ? <span style={{fontSize:13,fontWeight:700,color:"#111"}}>{phone || "Not provided"}</span>
//                         : <span style={{fontSize:13,fontWeight:600,color:"#aaa",letterSpacing:"0.04em"}}>+91 XXXXXXXXXX</span>
//                       }
//                     </div>
//                     {/* Instagram */}
//                     <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#f9f9f8",borderRadius:8,border:"1px solid #f0f0f0"}}>
//                       <span style={{fontSize:13}}>📸</span>
//                       {isDealDone
//                         ? (platform
//                             ? <a href={platform} target="_blank" rel="noreferrer" style={{fontSize:12,fontWeight:700,color:"#4f46e5",textDecoration:"none"}}>{platform}</a>
//                             : <span style={{fontSize:13,color:"#aaa"}}>Not provided</span>)
//                         : <span style={{fontSize:13,fontWeight:600,color:"#aaa",letterSpacing:"0.04em"}}>instagram.com/XXXXXX</span>
//                       }
//                     </div>
//                     {isDealDone && <div style={{fontSize:10,color:"#16a34a",fontWeight:700,marginTop:5,textAlign:"center"}}>✅ Deal completed — contact unlocked</div>}
//                   </div>

//                   {app?.bidAmount > 0 && (
//                     <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 16px 8px", padding: "6px 12px", background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
//                       <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>💰 Bid:</span>
//                       <span style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5" }}>₹{Number(app.bidAmount).toLocaleString("en-IN")}</span>
//                     </div>
//                   )}

//                   {note && (
//                     <div className="ap-note">
//                       <div className="ap-note-label">Proposal</div>
//                       <div className="ap-note-text">{note.length > 120 ? note.slice(0, 120) + "..." : note}</div>
//                     </div>
//                   )}

//                   <div className="ap-actions">
//                     <div className="ap-actions-row">
//                       <button className="ap-btn ap-btn-view" onClick={() => {
//                         const creatorId = app?.influencerId?._id || app?.influencer?._id || app?.influencer?.user || app?.userId;
//                         router.push(`/campaigns/${id}/applications/creator/${creatorId}?appId=${app._id}&campaignId=${id}`);
//                       }}>
//                         👤 View Profile
//                       </button>
//                       {decision === "accepted" ? (
//                         <div className="ap-btn ap-btn-accepted">✓ Accepted</div>
//                       ) : decision === "rejected" ? (
//                         <div className="ap-btn ap-btn-rejected">✗ Rejected</div>
//                       ) : (
//                         <>
//                           <button className="ap-btn ap-btn-accept" onClick={() => handleAccept(app)}>✓ Accept</button>
//                           <button className="ap-btn ap-btn-reject" onClick={() => handleReject(app)}>✗ Reject</button>
//                         </>
//                       )}
//                     </div>
//                     {decision === "accepted" && (
//                       <div className="ap-actions-row">
//                         <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id || app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
//                         {/* <a href={`/contracts/create?campaignId=${id}&creatorId=${app.influencer?._id || app._id}`} className="ap-btn ap-btn-contract">📄 Contract</a> */}
//                       </div>
//                     )}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }



