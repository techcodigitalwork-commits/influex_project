"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = "http://54.252.201.93:5000/api";

export default function CampaignApplications() {
  const { id } = useParams();
  const router = useRouter();

  const [applications, setApplications] = useState<any[]>([]);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [decidedApps, setDecidedApps] = useState<Record<string, "accepted" | "rejected">>({});
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [modalProfile, setModalProfile] = useState<any>(null);
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    const { token } = parsed;
    setIsSubscribed(parsed.isSubscribed ?? false);
    const saved = localStorage.getItem("decidedApplications");
    if (saved) setDecidedApps(JSON.parse(saved));
    fetchData(token);
  }, [id]);

  const fetchData = async (token: string) => {
    try {
      const [campRes, appRes] = await Promise.all([
        fetch(`${API_BASE}/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const campData = await campRes.json();
      const appData  = await appRes.json();
      setCampaign(campData?.data || campData?.campaign || campData);
      const apps = appData?.applications || appData?.data || [];
      const appList = Array.isArray(apps) ? apps : [];

      // Fetch full influencer profile using /api/profile/user/:userId
      const enriched = await Promise.all(
        appList.map(async (app: any) => {
          // application has influencerId._id which is the user ID
          const userId = app?.influencerId?._id || app?.influencer?._id || app?.userId;
          if (!userId) return app;
          try {
            const pRes = await fetch(`${API_BASE}/profile/user/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const pData = await pRes.json();
            const p = pData?.profile || pData?.data || pData;
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
                phone:        p?.phone        || "",
                platform:     p?.platform     || p?.instagram || "",
                bio:          p?.bio          || "",
              },
            };
          } catch {
            return app;
          }
        })
      );

      setApplications(enriched);
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
    const appId = app._id;
    const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
    try {
      await fetch(`${API_BASE}/application/${appId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "accepted" }),
      });
      // ✅ Frontend se notification bhejo with correct user ID
      if (creatorUserId) {
        await sendNotif(token, creatorUserId, "application_accepted",
          `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`, appId);
        // Auto message
        try {
          const convRes = await fetch(`${API_BASE}/conversations/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ participantId: creatorUserId }),
          });
          const convData = await convRes.json();
          const convId = convData?.conversation?._id || convData?._id;
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
    const { token } = JSON.parse(raw);
    const appId = app._id;
    const creatorUserId = app?.influencerId?._id || app?.influencer?.user || app?.influencer?._id || app?.userId;
    try {
      await fetch(`${API_BASE}/application/${appId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "rejected" }),
      });
      // ✅ Frontend se notification bhejo with correct user ID
      if (creatorUserId) {
        await sendNotif(token, creatorUserId, "application_rejected",
          `Your application for "${campaign?.title || "a campaign"}" was not selected this time. Keep applying! 💪`, appId);
      }
    } catch (err) {
      console.error("Reject error:", err);
    }
    const updated = { ...decidedApps, [appId]: "rejected" as const };
    setDecidedApps(updated);
    localStorage.setItem("decidedApplications", JSON.stringify(updated));
    showToast("Application rejected", "error");
  };

  // After enrichment, all data is in app.influencer
  const getName       = (a: any) => a?.influencer?.name || a?.influencerId?.email?.split("@")[0] || "Creator";
  const getImage      = (a: any) => a?.influencer?.profileImage || null;
  const getLocation   = (a: any) => a?.influencer?.location || "";
  const getCategories = (a: any) => {
    const c = a?.influencer?.categories || [];
    return Array.isArray(c) ? c.join(", ") : c || "";
  };
  const getFollowers  = (a: any) => {
    const f = a?.influencer?.followers;
    if (!f && f !== 0) return null;
    const num = Number(f);
    if (!isNaN(num) && num >= 1000) return (num / 1000).toFixed(1) + "K";
    return String(f);
  };
  const getPlatform   = (a: any) => a?.influencer?.platform || "";
  const getPhone      = (a: any) => a?.influencer?.phone || "";
  const getProfileId  = (a: any) => a?.influencer?._id || a?.influencerId?._id || a?.userId;

  const blurPhone     = (phone: string) => phone ? String(phone).slice(0, 3) + "XXXXXXX" : "";
  const blurNameHalf  = (name: string) => {
    const half = Math.ceil(name.length / 2);
    return { visible: name.slice(0, half), blurred: name.slice(half) };
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

        .ap-stats { display: flex; gap: 12px; padding: 20px 32px 0; flex-wrap: wrap; }
        @media(max-width:600px){ .ap-stats{ padding: 14px 16px 0; } }
        .ap-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .ap-stat-val { font-size: 20px; font-weight: 800; color: #111; }
        .ap-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

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
        .ap-info-val.locked { color: #aaa; font-size: 12px; display: flex; align-items: center; gap: 4px; }
        .ap-info-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
        .ap-info-item.highlight .ap-info-label { color: #6366f1; }
        .ap-info-item.highlight .ap-info-val { color: #4f46e5; }

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
        .ap-btn-contract { background: #f0f9ff; color: #0369a1; border: 1.5px solid #bae6fd; }
        .ap-btn-contract:hover { background: #e0f2fe; }

        .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
        @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
        .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
        .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }

        .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
        @media(max-width:600px){ .mo-overlay{ align-items: flex-end; padding: 0; } }
        .mo-box { background: #fff; border-radius: 24px; max-width: 580px; width: 100%; max-height: 92vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
        .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
        .mo-close:hover { background: #ebebeb; }
        .mo-img { width: 100%; height: 220px; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 72px; overflow: hidden; flex-shrink: 0; }
        .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; object-position: center 10%; }
        .mo-body { padding: 20px 24px 28px; }
        .mo-name { font-size: 24px; font-weight: 800; color: #111; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
        .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
        .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
        .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
        .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
        .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
        .mo-item-val.locked { color: #bbb; font-size: 12px; }
        .mo-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #92400e; font-weight: 500; }
        .mo-actions { display: flex; gap: 10px; margin-top: 6px; }

        .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .ap-toast.success { background: #111; color: #fff; }
        .ap-toast.error   { background: #ef4444; color: #fff; }
      `}</style>

      {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

      {/* PROFILE MODAL */}
      {modalProfile && (() => {
        const app = modalProfile;
        const name = getName(app);
        const img  = getImage(app);
        const isAccepted = decidedApps[app._id] === "accepted";
        const phone = getPhone(app);
        const platform = getPlatform(app);
        const note = app?.note || app?.message || app?.coverLetter || "";

        return (
          <div className="mo-overlay" onClick={() => setModalProfile(null)}>
            <div className="mo-box" onClick={(e) => e.stopPropagation()}>
              <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>

              <div className="mo-img">
                {img ? <img src={img} alt={name} /> : "👤"}
              </div>

              <div className="mo-body">
                <div className="mo-name">
                  {isAccepted ? name : (
                    <>
                      {blurNameHalf(name).visible}
                      <span style={{ filter: "blur(6px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
                    </>
                  )}
                </div>
                {/* ✅ Location: N/A instead of "Location not set" */}
                <div className="mo-loc">📍 {getLocation(app) || "N/A"}</div>

                {!isAccepted && (
                  <div className="mo-lock-banner">
                    🔒 Accept this application to unlock full contact details
                  </div>
                )}

                <div className="mo-section">Profile Details</div>
                <div className="mo-grid">
                  {/* ✅ Followers: N/A */}
                  <div className="mo-item">
                    <div className="mo-item-label">Followers</div>
                    <div className="mo-item-val">{getFollowers(app) || "N/A"}</div>
                  </div>
                  {/* ✅ Category: N/A */}
                  <div className="mo-item">
                    <div className="mo-item-label">Category</div>
                    <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "N/A"}</div>
                  </div>
                  <div className="mo-item">
                    <div className="mo-item-label">📞 Phone</div>
                    <div className={`mo-item-val ${!isSubscribed ? "locked" : ""}`}>
                      {isSubscribed ? (phone || "N/A") : "🔒 Subscribe to unlock"}
                    </div>
                  </div>
                  <div className="mo-item">
                    <div className="mo-item-label">🔗 Instagram</div>
                    <div className={`mo-item-val ${!isSubscribed ? "locked" : ""}`}>
                      {isSubscribed
                        ? (platform ? <a href={platform} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 12 }}>{platform}</a> : "N/A")
                        : <span style={{ filter: "blur(5px)", userSelect: "none", fontSize: 12 }}>instagram.com/hidden</span>
                      }
                    </div>
                  </div>
                </div>

                {/* ✅ Bid Amount */}
                {(app?.bidAmount || app?.bid || app?.amount) && (
                  <>
                    <div className="mo-section">Bid Amount</div>
                    <div className="mo-item" style={{ marginBottom: 16 }}>
                      <div className="mo-item-val" style={{ fontWeight: 800, color: "#4f46e5", fontSize: 20 }}>
                        ₹{Number(app?.bidAmount || app?.bid || app?.amount).toLocaleString("en-IN")}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                        Creator receives ₹{Math.round(Number(app?.bidAmount || app?.bid || app?.amount) * 0.9).toLocaleString("en-IN")} after platform fee
                      </div>
                    </div>
                  </>
                )}

                {/* ✅ Proposal / Note */}
                {(note || app?.proposal) && (
                  <>
                    <div className="mo-section">Proposal</div>
                    <div className="mo-item" style={{ marginBottom: 16 }}>
                      <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note || app?.proposal}</div>
                    </div>
                  </>
                )}

                <div className="mo-actions">
                  {decidedApps[app._id] === "accepted" ? (
                    <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
                  ) : decidedApps[app._id] === "rejected" ? (
                    <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
                  ) : (
                    <>
                      <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>
                        ✓ Accept
                      </button>
                      <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>
                        ✗ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="ap">
        {/* HEADER */}
        <div className="ap-header">
          <div className="ap-header-left">
            <h1>Applications</h1>
            <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
        </div>

        {/* STATS */}
        {applications.length > 0 && (
          <div className="ap-stats">
            <div className="ap-stat">
              <span style={{ fontSize: 20 }}>👥</span>
              <div><div className="ap-stat-val">{applications.length}</div><div className="ap-stat-lbl">Total</div></div>
            </div>
            <div className="ap-stat">
              <span style={{ fontSize: 20 }}>✅</span>
              <div><div className="ap-stat-val">{Object.values(decidedApps).filter(v => v === "accepted").length}</div><div className="ap-stat-lbl">Accepted</div></div>
            </div>
            <div className="ap-stat">
              <span style={{ fontSize: 20 }}>⏳</span>
              <div><div className="ap-stat-val">{applications.filter(a => !decidedApps[a._id]).length}</div><div className="ap-stat-lbl">Pending</div></div>
            </div>
          </div>
        )}

        {/* SUBSCRIPTION BANNER */}
        {!isSubscribed && (
          <div style={{ margin: "16px 32px 0", padding: "14px 20px", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1.5px solid #fde68a", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>🔒</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>Unlock Creator Contact Details</div>
                <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Subscribe to see phone numbers and Instagram handles</div>
              </div>
            </div>
            <a href="/upgrade" style={{ padding: "9px 20px", background: "#f59e0b", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
              Upgrade Now →
            </a>
          </div>
        )}

        {/* GRID */}
        {applications.length === 0 ? (
          <div className="ap-empty">
            <div className="ap-empty-icon">📭</div>
            <h3 className="ap-empty-title">No applications yet</h3>
            <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
          </div>
        ) : (
          <div className="ap-grid">
            {applications.map((app) => {
              const name       = getName(app);
              const img        = getImage(app);
              const location   = getLocation(app);
              const categories = getCategories(app);
              const followers  = getFollowers(app);
              const phone      = getPhone(app);
              const platform   = getPlatform(app);
              const note       = app?.note || app?.proposal || app?.message || app?.coverLetter || "";
              const bidAmt     = app?.bidAmount || app?.bid || app?.amount || 0;
              const decision   = decidedApps[app._id];
              const initials   = name.slice(0, 2).toUpperCase();

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
                        {decision === "accepted" ? name : (
                          <>
                            {blurNameHalf(name).visible}
                            <span style={{ filter: "blur(5px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
                          </>
                        )}
                      </div>
                      {/* ✅ Location on card: N/A */}
                      {<div className="ap-location">📍 {location || "N/A"}</div>}
                    </div>
                  </div>

                  <div className="ap-card-info">
                    {/* ✅ Followers on card: N/A */}
                    <div className="ap-info-item">
                      <div className="ap-info-label">Followers</div>
                      <div className="ap-info-val">{followers || "N/A"}</div>
                    </div>
                    {/* ✅ Category on card: N/A */}
                    <div className="ap-info-item">
                      <div className="ap-info-label">Category</div>
                      <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "N/A"}</div>
                    </div>
                    <div className="ap-info-item">
                      <div className="ap-info-label">📞 Phone</div>
                      <div className={`ap-info-val ${!isSubscribed ? "locked" : ""}`}>
                        {isSubscribed ? (phone || "N/A") : "🔒 Subscribe"}
                      </div>
                    </div>
                    <div className="ap-info-item">
                      <div className="ap-info-label">🔗 Instagram</div>
                      <div className={`ap-info-val ${!isSubscribed ? "locked" : ""}`}>
                        {isSubscribed
                          ? (platform || "N/A")
                          : <span style={{ filter: "blur(4px)", userSelect: "none", fontSize: 11 }}>instagram.com/hidden</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* ✅ Bid amount on card */}
                  {(app?.bidAmount > 0) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 16px 8px", padding: "6px 12px", background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe" }}>
                      <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>💰 Bid:</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5" }}>₹{Number(app.bidAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {/* ✅ Proposal snippet on card */}
                  {(note) && (
                    <div className="ap-note">
                      <div className="ap-note-label">Proposal</div>
                      <div className="ap-note-text">{note.length > 120 ? note.slice(0, 120) + "..." : note}</div>
                    </div>
                  )}

                  <div className="ap-actions">
                    {/* Row 1: View + Accept/Reject */}
                    <div className="ap-actions-row">
                      <button className="ap-btn ap-btn-view" onClick={() => {
                        const creatorId = app?.influencerId?._id || app?.influencer?._id || app?.influencer?.user || app?.userId;
                        console.log("creatorId:", creatorId, "appId:", app._id);
                        router.push(`/campaigns/${id}/applications/creator/${creatorId}?appId=${app._id}`);
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
                    {/* Row 2: Deal + Contract (only when accepted) */}
                    {decision === "accepted" && (
                      <div className="ap-actions-row">
                        <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
                        <a href={`/contracts/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-contract">📄 Contract</a>
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

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignApplications() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<any[]>([]);
//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [decidedApps, setDecidedApps] = useState<Record<string, "accepted" | "rejected">>({});
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const [modalProfile, setModalProfile] = useState<any>(null);
//   const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     const { token } = parsed;
//     setIsSubscribed(parsed.isSubscribed ?? false);
//     const saved = localStorage.getItem("decidedApplications");
//     if (saved) setDecidedApps(JSON.parse(saved));
//     fetchData(token);
//   }, [id]);

//   const fetchData = async (token: string) => {
//     try {
//       const [campRes, appRes] = await Promise.all([
//         fetch(`${API_BASE}/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const campData = await campRes.json();
//       const appData  = await appRes.json();
//       setCampaign(campData?.data || campData?.campaign || campData);
//       const apps = appData?.applications || appData?.data || [];
//       const appList = Array.isArray(apps) ? apps : [];

//       // Fetch full influencer profile using /api/profile/user/:userId
//       const enriched = await Promise.all(
//         appList.map(async (app: any) => {
//           // application has influencerId._id which is the user ID
//           const userId = app?.influencerId?._id || app?.influencer?._id || app?.userId;
//           if (!userId) return app;
//           try {
//             const pRes = await fetch(`${API_BASE}/profile/user/${userId}`, {
//               headers: { Authorization: `Bearer ${token}` },
//             });
//             const pData = await pRes.json();
//             const p = pData?.profile || pData?.data || pData;
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
//           } catch {
//             return app;
//           }
//         })
//       );

//       setApplications(enriched);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleAccept = async (app: any) => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;
//     const { token } = JSON.parse(raw);
//     const appId = app._id;
//     try {
//       await fetch(`${API_BASE}/campaigns/${id}/applications/${appId}/accept`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       });
//       const creatorUserId = app?.influencer?.user || app?.influencer?._id || app?.userId;
//       if (creatorUserId) {
//         await fetch(`${API_BASE}/notification/create`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             user: creatorUserId,
//             message: `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`,
//             type: "application_accepted",
//             link: `/campaigns`,
//             applicationId: appId,
//           }),
//         });
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
//     const appId = app._id;
//     const updated = { ...decidedApps, [appId]: "rejected" as const };
//     setDecidedApps(updated);
//     localStorage.setItem("decidedApplications", JSON.stringify(updated));
//     showToast("Application rejected", "error");
//   };

//   // After enrichment, all data is in app.influencer
//   const getName       = (a: any) => a?.influencer?.name || a?.influencerId?.email?.split("@")[0] || "Creator";
//   const getImage      = (a: any) => a?.influencer?.profileImage || null;
//   const getLocation   = (a: any) => a?.influencer?.location || "";
//   const getCategories = (a: any) => {
//     const c = a?.influencer?.categories || [];
//     return Array.isArray(c) ? c.join(", ") : c || "";
//   };
//   const getFollowers  = (a: any) => {
//     const f = a?.influencer?.followers;
//     if (!f && f !== 0) return null;
//     const num = Number(f);
//     if (!isNaN(num) && num >= 1000) return (num / 1000).toFixed(1) + "K";
//     return String(f);
//   };
//   const getPlatform   = (a: any) => a?.influencer?.platform || "";
//   const getPhone      = (a: any) => a?.influencer?.phone || "";
//   const getProfileId  = (a: any) => a?.influencer?._id || a?.influencerId?._id || a?.userId;

//   const blurPhone     = (phone: string) => phone ? String(phone).slice(0, 3) + "XXXXXXX" : "";
//   const blurNameHalf  = (name: string) => {
//     const half = Math.ceil(name.length / 2);
//     return { visible: name.slice(0, half), blurred: name.slice(half) };
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

//         .ap-card-top { padding: 20px 20px 16px; display: flex; align-items: center; gap: 14px; }
//         .ap-avatar { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4f46e5; }
//         .ap-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
//         .ap-name-wrap { flex: 1; min-width: 0; }
//         .ap-name { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 3px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
//         .ap-location { font-size: 12px; color: #aaa; margin: 0; display: flex; align-items: center; gap: 4px; }

//         .ap-card-info { padding: 0 20px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
//         .ap-info-item { background: #f9f9f8; border-radius: 10px; padding: 9px 12px; border: 1px solid #f0f0f0; }
//         .ap-info-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
//         .ap-info-val { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .ap-info-val.locked { color: #aaa; font-size: 12px; display: flex; align-items: center; gap: 4px; }
//         .ap-info-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
//         .ap-info-item.highlight .ap-info-label { color: #6366f1; }
//         .ap-info-item.highlight .ap-info-val { color: #4f46e5; }

//         .ap-note { margin: 0 20px 16px; background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .ap-note-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .ap-note-text { font-size: 13px; color: #555; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .ap-actions { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
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

//         .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
//         .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
//         .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
//         .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }

//         .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
//         .mo-box { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; max-height: 88vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
//         .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
//         .mo-close:hover { background: #ebebeb; }
//         .mo-img { width: 100%; height: 160px; object-fit: cover; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 52px; }
//         .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; }
//         .mo-body { padding: 22px 24px 28px; }
//         .mo-name { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
//         .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
//         .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
//         .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
//         .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
//         .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
//         .mo-item-val.locked { color: #bbb; font-size: 12px; }
//         .mo-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #92400e; font-weight: 500; }
//         .mo-actions { display: flex; gap: 10px; margin-top: 6px; }

//         .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .ap-toast.success { background: #111; color: #fff; }
//         .ap-toast.error   { background: #ef4444; color: #fff; }
//       `}</style>

//       {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* PROFILE MODAL */}
//       {modalProfile && (() => {
//         const app = modalProfile;
//         const name = getName(app);
//         const img  = getImage(app);
//         const isAccepted = decidedApps[app._id] === "accepted";
//         const phone = getPhone(app);
//         const platform = getPlatform(app);
//         const note = app?.note || app?.message || app?.coverLetter || "";

//         return (
//           <div className="mo-overlay" onClick={() => setModalProfile(null)}>
//             <div className="mo-box" onClick={(e) => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>

//               <div className="mo-img">
//                 {img ? <img src={img} alt={name} /> : "👤"}
//               </div>

//               <div className="mo-body">
//                 <div className="mo-name">
//                   {isAccepted ? name : (
//                     <>
//                       {blurNameHalf(name).visible}
//                       <span style={{ filter: "blur(6px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                     </>
//                   )}
//                 </div>
//                 {/* ✅ Location: N/A instead of "Location not set" */}
//                 <div className="mo-loc">📍 {getLocation(app) || "N/A"}</div>

//                 {!isAccepted && (
//                   <div className="mo-lock-banner">
//                     🔒 Accept this application to unlock full contact details
//                   </div>
//                 )}

//                 <div className="mo-section">Profile Details</div>
//                 <div className="mo-grid">
//                   {/* ✅ Followers: N/A */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">Followers</div>
//                     <div className="mo-item-val">{getFollowers(app) || "N/A"}</div>
//                   </div>
//                   {/* ✅ Category: N/A */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">Category</div>
//                     <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "N/A"}</div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">📞 Phone</div>
//                     <div className={`mo-item-val ${!isSubscribed ? "locked" : ""}`}>
//                       {isSubscribed ? (phone || "N/A") : "🔒 Subscribe to unlock"}
//                     </div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">🔗 Instagram</div>
//                     <div className={`mo-item-val ${!isSubscribed ? "locked" : ""}`}>
//                       {isSubscribed
//                         ? (platform ? <a href={platform} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 12 }}>{platform}</a> : "N/A")
//                         : <span style={{ filter: "blur(5px)", userSelect: "none", fontSize: 12 }}>instagram.com/hidden</span>
//                       }
//                     </div>
//                   </div>
//                 </div>

//                 {/* ✅ Bid Amount */}
//                 {(app?.bidAmount || app?.bid || app?.amount) && (
//                   <>
//                     <div className="mo-section">Bid Amount</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 800, color: "#4f46e5", fontSize: 20 }}>
//                         ₹{Number(app?.bidAmount || app?.bid || app?.amount).toLocaleString("en-IN")}
//                       </div>
//                       <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
//                         Creator receives ₹{Math.round(Number(app?.bidAmount || app?.bid || app?.amount) * 0.9).toLocaleString("en-IN")} after platform fee
//                       </div>
//                     </div>
//                   </>
//                 )}

//                 {/* ✅ Proposal / Note */}
//                 {(note || app?.proposal) && (
//                   <>
//                     <div className="mo-section">Proposal</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note || app?.proposal}</div>
//                     </div>
//                   </>
//                 )}

//                 <div className="mo-actions">
//                   {decidedApps[app._id] === "accepted" ? (
//                     <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
//                   ) : decidedApps[app._id] === "rejected" ? (
//                     <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
//                   ) : (
//                     <>
//                       <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>
//                         ✓ Accept
//                       </button>
//                       <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>
//                         ✗ Reject
//                       </button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="ap">
//         {/* HEADER */}
//         <div className="ap-header">
//           <div className="ap-header-left">
//             <h1>Applications</h1>
//             <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
//           </div>
//           <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
//         </div>

//         {/* STATS */}
//         {applications.length > 0 && (
//           <div className="ap-stats">
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>👥</span>
//               <div><div className="ap-stat-val">{applications.length}</div><div className="ap-stat-lbl">Total</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>✅</span>
//               <div><div className="ap-stat-val">{Object.values(decidedApps).filter(v => v === "accepted").length}</div><div className="ap-stat-lbl">Accepted</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>⏳</span>
//               <div><div className="ap-stat-val">{applications.filter(a => !decidedApps[a._id]).length}</div><div className="ap-stat-lbl">Pending</div></div>
//             </div>
//           </div>
//         )}

//         {/* SUBSCRIPTION BANNER */}
//         {!isSubscribed && (
//           <div style={{ margin: "16px 32px 0", padding: "14px 20px", background: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "1.5px solid #fde68a", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
//             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//               <span style={{ fontSize: 22 }}>🔒</span>
//               <div>
//                 <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e" }}>Unlock Creator Contact Details</div>
//                 <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Subscribe to see phone numbers and Instagram handles</div>
//               </div>
//             </div>
//             <a href="/upgrade" style={{ padding: "9px 20px", background: "#f59e0b", color: "#fff", borderRadius: 10, fontWeight: 700, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
//               Upgrade Now →
//             </a>
//           </div>
//         )}

//         {/* GRID */}
//         {applications.length === 0 ? (
//           <div className="ap-empty">
//             <div className="ap-empty-icon">📭</div>
//             <h3 className="ap-empty-title">No applications yet</h3>
//             <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
//           </div>
//         ) : (
//           <div className="ap-grid">
//             {applications.map((app) => {
//               const name       = getName(app);
//               const img        = getImage(app);
//               const location   = getLocation(app);
//               const categories = getCategories(app);
//               const followers  = getFollowers(app);
//               const phone      = getPhone(app);
//               const platform   = getPlatform(app);
//               const note       = app?.note || app?.proposal || app?.message || app?.coverLetter || "";
//               const bidAmt     = app?.bidAmount || app?.bid || app?.amount || 0;
//               const decision   = decidedApps[app._id];
//               const initials   = name.slice(0, 2).toUpperCase();

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
//                         {decision === "accepted" ? name : (
//                           <>
//                             {blurNameHalf(name).visible}
//                             <span style={{ filter: "blur(5px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                           </>
//                         )}
//                       </div>
//                       {/* ✅ Location on card: N/A */}
//                       {<div className="ap-location">📍 {location || "N/A"}</div>}
//                     </div>
//                   </div>

//                   <div className="ap-card-info">
//                     {/* ✅ Followers on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Followers</div>
//                       <div className="ap-info-val">{followers || "N/A"}</div>
//                     </div>
//                     {/* ✅ Category on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Category</div>
//                       <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "N/A"}</div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">📞 Phone</div>
//                       <div className={`ap-info-val ${!isSubscribed ? "locked" : ""}`}>
//                         {isSubscribed ? (phone || "N/A") : "🔒 Subscribe"}
//                       </div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">🔗 Instagram</div>
//                       <div className={`ap-info-val ${!isSubscribed ? "locked" : ""}`}>
//                         {isSubscribed
//                           ? (platform || "N/A")
//                           : <span style={{ filter: "blur(4px)", userSelect: "none", fontSize: 11 }}>instagram.com/hidden</span>
//                         }
//                       </div>
//                     </div>
//                   </div>

//                   {/* ✅ Bid amount on card */}
//                   {(app?.bidAmount > 0) && (
//                     <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 20px 10px", padding: "8px 14px", background: "#eef2ff", borderRadius: 10, border: "1px solid #c7d2fe" }}>
//                       <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>💰 Bid:</span>
//                       <span style={{ fontSize: 16, fontWeight: 800, color: "#4f46e5" }}>₹{Number(app.bidAmount).toLocaleString("en-IN")}</span>
//                     </div>
//                   )}

//                   {/* ✅ Proposal snippet on card */}
//                   {(note) && (
//                     <div className="ap-note">
//                       <div className="ap-note-label">Proposal</div>
//                       <div className="ap-note-text">{note.length > 120 ? note.slice(0, 120) + "..." : note}</div>
//                     </div>
//                   )}

//                   <div className="ap-actions">
//                     {/* Row 1: View + Accept/Reject */}
//                     <div className="ap-actions-row">
//                       <button className="ap-btn ap-btn-view" onClick={() => setModalProfile(app)}>
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
//                     {/* Row 2: Deal + Contract (only when accepted) */}
//                     {decision === "accepted" && (
//                       <div className="ap-actions-row">
//                         <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
//                         <a href={`/contracts/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-contract">📄 Contract</a>
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



// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignApplications() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<any[]>([]);
//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [decidedApps, setDecidedApps] = useState<Record<string, "accepted" | "rejected">>({});
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const [modalProfile, setModalProfile] = useState<any>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const { token } = JSON.parse(raw);
//     const saved = localStorage.getItem("decidedApplications");
//     if (saved) setDecidedApps(JSON.parse(saved));
//     fetchData(token);
//   }, [id]);

//   const fetchData = async (token: string) => {
//     try {
//       const [campRes, appRes] = await Promise.all([
//         fetch(`${API_BASE}/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const campData = await campRes.json();
//       const appData  = await appRes.json();
//       setCampaign(campData?.data || campData?.campaign || campData);
//       const apps = appData?.applications || appData?.data || [];
//       const appList = Array.isArray(apps) ? apps : [];

//       // Fetch full influencer profile using /api/profile/user/:userId
//       const enriched = await Promise.all(
//         appList.map(async (app: any) => {
//           // application has influencerId._id which is the user ID
//           const userId = app?.influencerId?._id || app?.influencer?._id || app?.userId;
//           if (!userId) return app;
//           try {
//             const pRes = await fetch(`${API_BASE}/profile/user/${userId}`, {
//               headers: { Authorization: `Bearer ${token}` },
//             });
//             const pData = await pRes.json();
//             const p = pData?.profile || pData?.data || pData;
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
//           } catch {
//             return app;
//           }
//         })
//       );

//       setApplications(enriched);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleAccept = async (app: any) => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;
//     const { token } = JSON.parse(raw);
//     const appId = app._id;
//     try {
//       await fetch(`${API_BASE}/campaigns/${id}/applications/${appId}/accept`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       });
//       const creatorUserId = app?.influencer?.user || app?.influencer?._id || app?.userId;
//       if (creatorUserId) {
//         await fetch(`${API_BASE}/notification/create`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             user: creatorUserId,
//             message: `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`,
//             type: "application_accepted",
//             link: `/campaigns`,
//             applicationId: appId,
//           }),
//         });
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
//     const appId = app._id;
//     const updated = { ...decidedApps, [appId]: "rejected" as const };
//     setDecidedApps(updated);
//     localStorage.setItem("decidedApplications", JSON.stringify(updated));
//     showToast("Application rejected", "error");
//   };

//   // After enrichment, all data is in app.influencer
//   const getName       = (a: any) => a?.influencer?.name || a?.influencerId?.email?.split("@")[0] || "Creator";
//   const getImage      = (a: any) => a?.influencer?.profileImage || null;
//   const getLocation   = (a: any) => a?.influencer?.location || "";
//   const getCategories = (a: any) => {
//     const c = a?.influencer?.categories || [];
//     return Array.isArray(c) ? c.join(", ") : c || "";
//   };
//   const getFollowers  = (a: any) => {
//     const f = a?.influencer?.followers;
//     if (!f && f !== 0) return null;
//     const num = Number(f);
//     if (!isNaN(num) && num >= 1000) return (num / 1000).toFixed(1) + "K";
//     return String(f);
//   };
//   const getPlatform   = (a: any) => a?.influencer?.platform || "";
//   const getPhone      = (a: any) => a?.influencer?.phone || "";
//   const getProfileId  = (a: any) => a?.influencer?._id || a?.influencerId?._id || a?.userId;

//   const blurPhone     = (phone: string) => phone ? String(phone).slice(0, 3) + "XXXXXXX" : "";
//   const blurNameHalf  = (name: string) => {
//     const half = Math.ceil(name.length / 2);
//     return { visible: name.slice(0, half), blurred: name.slice(half) };
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

//         .ap-card-top { padding: 20px 20px 16px; display: flex; align-items: center; gap: 14px; }
//         .ap-avatar { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4f46e5; }
//         .ap-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
//         .ap-name-wrap { flex: 1; min-width: 0; }
//         .ap-name { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 3px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
//         .ap-location { font-size: 12px; color: #aaa; margin: 0; display: flex; align-items: center; gap: 4px; }

//         .ap-card-info { padding: 0 20px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
//         .ap-info-item { background: #f9f9f8; border-radius: 10px; padding: 9px 12px; border: 1px solid #f0f0f0; }
//         .ap-info-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
//         .ap-info-val { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .ap-info-val.locked { color: #aaa; font-size: 12px; display: flex; align-items: center; gap: 4px; }
//         .ap-info-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
//         .ap-info-item.highlight .ap-info-label { color: #6366f1; }
//         .ap-info-item.highlight .ap-info-val { color: #4f46e5; }

//         .ap-note { margin: 0 20px 16px; background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .ap-note-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .ap-note-text { font-size: 13px; color: #555; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         .ap-actions { padding: 0 20px 20px; display: flex; flex-direction: column; gap: 8px; }
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

//         .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
//         .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
//         .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
//         .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }

//         .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
//         .mo-box { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; max-height: 88vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
//         .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
//         .mo-close:hover { background: #ebebeb; }
//         .mo-img { width: 100%; height: 160px; object-fit: cover; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 52px; }
//         .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; }
//         .mo-body { padding: 22px 24px 28px; }
//         .mo-name { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
//         .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
//         .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
//         .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
//         .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
//         .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
//         .mo-item-val.locked { color: #bbb; font-size: 12px; }
//         .mo-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #92400e; font-weight: 500; }
//         .mo-actions { display: flex; gap: 10px; margin-top: 6px; }

//         .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .ap-toast.success { background: #111; color: #fff; }
//         .ap-toast.error   { background: #ef4444; color: #fff; }
//       `}</style>

//       {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* PROFILE MODAL */}
//       {modalProfile && (() => {
//         const app = modalProfile;
//         const name = getName(app);
//         const img  = getImage(app);
//         const isAccepted = decidedApps[app._id] === "accepted";
//         const phone = getPhone(app);
//         const platform = getPlatform(app);
//         const note = app?.note || app?.message || app?.coverLetter || "";

//         return (
//           <div className="mo-overlay" onClick={() => setModalProfile(null)}>
//             <div className="mo-box" onClick={(e) => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>

//               <div className="mo-img">
//                 {img ? <img src={img} alt={name} /> : "👤"}
//               </div>

//               <div className="mo-body">
//                 <div className="mo-name">
//                   {isAccepted ? name : (
//                     <>
//                       {blurNameHalf(name).visible}
//                       <span style={{ filter: "blur(6px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                     </>
//                   )}
//                 </div>
//                 {/* ✅ Location: N/A instead of "Location not set" */}
//                 <div className="mo-loc">📍 {getLocation(app) || "N/A"}</div>

//                 {!isAccepted && (
//                   <div className="mo-lock-banner">
//                     🔒 Accept this application to unlock full contact details
//                   </div>
//                 )}

//                 <div className="mo-section">Profile Details</div>
//                 <div className="mo-grid">
//                   {/* ✅ Followers: N/A */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">Followers</div>
//                     <div className="mo-item-val">{getFollowers(app) || "N/A"}</div>
//                   </div>
//                   {/* ✅ Category: N/A */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">Category</div>
//                     <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "N/A"}</div>
//                   </div>
//                   {/* ✅ Phone: N/A instead of Not provided */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">📞 Phone</div>
//                     <div className={`mo-item-val ${!isAccepted ? "locked" : ""}`}>
//                       {isAccepted
//                         ? (phone || "N/A")
//                         : (phone ? blurPhone(phone) : "🔒 Hidden")}
//                     </div>
//                   </div>
//                   {/* ✅ Instagram: N/A instead of Not provided */}
//                   <div className="mo-item">
//                     <div className="mo-item-label">🔗 Instagram</div>
//                     <div className={`mo-item-val ${!isAccepted ? "locked" : ""}`}>
//                       {isAccepted
//                         ? (platform
//                             ? <a href={platform} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 12 }}>{platform}</a>
//                             : "N/A")
//                         : <span style={{ filter: "blur(5px)", userSelect: "none", fontSize: 12 }}>instagram.com/hidden</span>
//                       }
//                     </div>
//                   </div>
//                 </div>

//                 {note && (
//                   <>
//                     <div className="mo-section">Application Note</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note}</div>
//                     </div>
//                   </>
//                 )}

//                 <div className="mo-actions">
//                   {decidedApps[app._id] === "accepted" ? (
//                     <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
//                   ) : decidedApps[app._id] === "rejected" ? (
//                     <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
//                   ) : (
//                     <>
//                       <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>
//                         ✓ Accept
//                       </button>
//                       <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>
//                         ✗ Reject
//                       </button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="ap">
//         {/* HEADER */}
//         <div className="ap-header">
//           <div className="ap-header-left">
//             <h1>Applications</h1>
//             <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
//           </div>
//           <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
//         </div>

//         {/* STATS */}
//         {applications.length > 0 && (
//           <div className="ap-stats">
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>👥</span>
//               <div><div className="ap-stat-val">{applications.length}</div><div className="ap-stat-lbl">Total</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>✅</span>
//               <div><div className="ap-stat-val">{Object.values(decidedApps).filter(v => v === "accepted").length}</div><div className="ap-stat-lbl">Accepted</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>⏳</span>
//               <div><div className="ap-stat-val">{applications.filter(a => !decidedApps[a._id]).length}</div><div className="ap-stat-lbl">Pending</div></div>
//             </div>
//           </div>
//         )}

//         {/* GRID */}
//         {applications.length === 0 ? (
//           <div className="ap-empty">
//             <div className="ap-empty-icon">📭</div>
//             <h3 className="ap-empty-title">No applications yet</h3>
//             <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
//           </div>
//         ) : (
//           <div className="ap-grid">
//             {applications.map((app) => {
//               const name       = getName(app);
//               const img        = getImage(app);
//               const location   = getLocation(app);
//               const categories = getCategories(app);
//               const followers  = getFollowers(app);
//               const phone      = getPhone(app);
//               const platform   = getPlatform(app);
//               const note       = app?.note || app?.message || app?.coverLetter || "";
//               const decision   = decidedApps[app._id];
//               const initials   = name.slice(0, 2).toUpperCase();

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
//                         {decision === "accepted" ? name : (
//                           <>
//                             {blurNameHalf(name).visible}
//                             <span style={{ filter: "blur(5px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                           </>
//                         )}
//                       </div>
//                       {/* ✅ Location on card: N/A */}
//                       {<div className="ap-location">📍 {location || "N/A"}</div>}
//                     </div>
//                   </div>

//                   <div className="ap-card-info">
//                     {/* ✅ Followers on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Followers</div>
//                       <div className="ap-info-val">{followers || "N/A"}</div>
//                     </div>
//                     {/* ✅ Category on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Category</div>
//                       <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "N/A"}</div>
//                     </div>
//                     {/* ✅ Phone on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">📞 Phone</div>
//                       <div className={`ap-info-val ${decision !== "accepted" ? "locked" : ""}`}>
//                         {decision === "accepted"
//                           ? (phone || "N/A")
//                           : (phone ? blurPhone(phone) : "🔒 Hidden")}
//                       </div>
//                     </div>
//                     {/* ✅ Instagram on card: N/A */}
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">🔗 Instagram</div>
//                       <div className={`ap-info-val ${decision !== "accepted" ? "locked" : ""}`}>
//                         {decision === "accepted"
//                           ? (platform || "N/A")
//                           : <span style={{ filter: "blur(4px)", userSelect: "none", fontSize: 11 }}>instagram.com/hidden</span>
//                         }
//                       </div>
//                     </div>
//                   </div>

//                   {note && (
//                     <div className="ap-note">
//                       <div className="ap-note-label">Note</div>
//                       <div className="ap-note-text">{note}</div>
//                     </div>
//                   )}

//                   <div className="ap-actions">
//                     {/* Row 1: View + Accept/Reject */}
//                     <div className="ap-actions-row">
//                       <button className="ap-btn ap-btn-view" onClick={() => setModalProfile(app)}>
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
//                     {/* Row 2: Deal + Contract (only when accepted) */}
//                     {decision === "accepted" && (
//                       <div className="ap-actions-row">
//                         <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
//                         <a href={`/contracts/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-contract">📄 Contract</a>
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

// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignApplications() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<any[]>([]);
//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [decidedApps, setDecidedApps] = useState<Record<string, "accepted" | "rejected">>({});
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const [modalProfile, setModalProfile] = useState<any>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const { token } = JSON.parse(raw);

//     // Load saved decisions
//     const saved = localStorage.getItem("decidedApplications");
//     if (saved) setDecidedApps(JSON.parse(saved));

//     fetchData(token);
//   }, [id]);

//   const fetchData = async (token: string) => {
//     try {
//       const [campRes, appRes] = await Promise.all([
//         fetch(`${API_BASE}/campaigns/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
//         fetch(`${API_BASE}/campaigns/${id}/applications`, { headers: { Authorization: `Bearer ${token}` } }),
//       ]);
//       const campData = await campRes.json();
//       const appData  = await appRes.json();

//       setCampaign(campData?.data || campData?.campaign || campData);
//       const apps = appData?.applications || appData?.data || [];
//       setApplications(Array.isArray(apps) ? apps : []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleAccept = async (app: any) => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;
//     const { token } = JSON.parse(raw);
//     const appId = app._id;

//     try {
//       // Try accept endpoint
//       const res = await fetch(`${API_BASE}/campaigns/${id}/applications/${appId}/accept`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       });

//       // Also send notification to creator
//       const creatorUserId = app?.influencer?.user || app?.influencer?._id || app?.userId;
//       if (creatorUserId) {
//         await fetch(`${API_BASE}/notification/create`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             user: creatorUserId,
//             message: `Your application for "${campaign?.title || "a campaign"}" has been accepted! 🎉`,
//             type: "application_accepted",
//             link: `/campaigns`,
//             applicationId: appId,
//           }),
//         });
//       }

//       const updated = { ...decidedApps, [appId]: "accepted" as const };
//       setDecidedApps(updated);
//       localStorage.setItem("decidedApplications", JSON.stringify(updated));
//       showToast("Application accepted ✓", "success");
//     } catch {
//       // Save locally even if API fails
//       const updated = { ...decidedApps, [appId]: "accepted" as const };
//       setDecidedApps(updated);
//       localStorage.setItem("decidedApplications", JSON.stringify(updated));
//       showToast("Accepted (saved locally)", "success");
//     }
//   };

//   const handleReject = async (app: any) => {
//     const appId = app._id;
//     const updated = { ...decidedApps, [appId]: "rejected" as const };
//     setDecidedApps(updated);
//     localStorage.setItem("decidedApplications", JSON.stringify(updated));
//     showToast("Application rejected", "error");
//   };

//   // Helpers
//   const getName     = (a: any) => a?.influencer?.name || a?.name || "Creator";
//   const getImage    = (a: any) => a?.influencer?.profileImage || a?.profileImage || null;
//   const getLocation = (a: any) => a?.influencer?.location || a?.location || "";
//   const getCategories = (a: any) => {
//     const c = a?.influencer?.categories || a?.categories || [];
//     return Array.isArray(c) ? c.join(", ") : c || "";
//   };
//   const getFollowers = (a: any) => {
//     const f = a?.influencer?.followers || a?.followers;
//     if (!f) return null;
//     return String(f);
//   };
//   const getPlatform  = (a: any) => a?.influencer?.platform || a?.platform || "";
//   const getPhone     = (a: any) => a?.influencer?.phone || a?.phone || "";
//   const getProfileId = (a: any) => a?.influencer?._id || a?.influencerId || a?.userId;

//   // Blur helpers
//   const blurPhone = (phone: string) => phone ? String(phone).slice(0, 3) + "XXXXXXX" : "";
//   const blurNameHalf = (name: string) => {
//     const half = Math.ceil(name.length / 2);
//     return { visible: name.slice(0, half), blurred: name.slice(half) };
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

//         /* HEADER */
//         .ap-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
//         @media(max-width:600px){ .ap-header{ padding: 14px 16px; } }
//         .ap-header-left h1 { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 3px; }
//         .ap-header-left p  { font-size: 13px; color: #aaa; margin: 0; }
//         .ap-back-btn { padding: 9px 18px; background: #f5f5f3; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; color: #555; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: background 0.2s; }
//         .ap-back-btn:hover { background: #ebebeb; }

//         /* STATS */
//         .ap-stats { display: flex; gap: 12px; padding: 20px 32px 0; flex-wrap: wrap; }
//         @media(max-width:600px){ .ap-stats{ padding: 14px 16px 0; } }
//         .ap-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
//         .ap-stat-val { font-size: 20px; font-weight: 800; color: #111; }
//         .ap-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

//         /* GRID */
//         .ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 20px 32px 0; }
//         @media(max-width:768px){ .ap-grid{ grid-template-columns: 1fr; padding: 14px 16px 0; gap: 12px; } }

//         /* CARD */
//         .ap-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; overflow: hidden; transition: all 0.2s; position: relative; }
//         .ap-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .ap-card.accepted { border-color: #86efac; }
//         .ap-card.rejected { border-color: #fca5a5; opacity: 0.7; }

//         /* STATUS RIBBON */
//         .ap-ribbon { position: absolute; top: 14px; right: 14px; padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 700; z-index: 2; }
//         .ap-ribbon.accepted { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
//         .ap-ribbon.rejected { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
//         .ap-ribbon.pending  { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }

//         /* CARD TOP */
//         .ap-card-top { padding: 20px 20px 16px; display: flex; align-items: center; gap: 14px; }
//         .ap-avatar { width: 52px; height: 52px; border-radius: 14px; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #4f46e5; }
//         .ap-avatar img { width: 100%; height: 100%; border-radius: 14px; object-fit: cover; }
//         .ap-name-wrap { flex: 1; min-width: 0; }
//         .ap-name { font-size: 15px; font-weight: 700; color: #111; margin: 0 0 3px; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; }
//         .ap-location { font-size: 12px; color: #aaa; margin: 0; display: flex; align-items: center; gap: 4px; }

//         /* CARD INFO */
//         .ap-card-info { padding: 0 20px 16px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
//         .ap-info-item { background: #f9f9f8; border-radius: 10px; padding: 9px 12px; border: 1px solid #f0f0f0; }
//         .ap-info-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 2px; }
//         .ap-info-val { font-size: 13px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .ap-info-val.locked { color: #aaa; font-size: 12px; display: flex; align-items: center; gap: 4px; }
//         .ap-info-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
//         .ap-info-item.highlight .ap-info-label { color: #6366f1; }
//         .ap-info-item.highlight .ap-info-val { color: #4f46e5; }

//         /* NOTE */
//         .ap-note { margin: 0 20px 16px; background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .ap-note-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .ap-note-text { font-size: 13px; color: #555; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

//         /* ACTIONS */
//         .ap-actions { padding: 0 20px 20px; display: flex; gap: 8px; }
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

//         /* EMPTY */
//         .ap-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .ap-empty{ margin: 14px 12px; } }
//         .ap-empty-icon  { font-size: 48px; margin-bottom: 16px; }
//         .ap-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
//         .ap-empty-sub   { color: #aaa; font-size: 14px; margin: 0; line-height: 1.6; max-width: 260px; }

//         /* MODAL */
//         .mo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
//         .mo-box { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; max-height: 88vh; overflow-y: auto; position: relative; animation: slideUp 0.25s ease; }
//         .mo-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; z-index: 2; }
//         .mo-close:hover { background: #ebebeb; }
//         .mo-img { width: 100%; height: 160px; object-fit: cover; border-radius: 24px 24px 0 0; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 52px; }
//         .mo-img img { width: 100%; height: 100%; border-radius: 24px 24px 0 0; object-fit: cover; }
//         .mo-body { padding: 22px 24px 28px; }
//         .mo-name { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
//         .mo-loc  { font-size: 13px; color: #aaa; margin-bottom: 18px; display: flex; align-items: center; gap: 5px; }
//         .mo-section { font-size: 11px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-bottom: 10px; }
//         .mo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
//         .mo-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .mo-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
//         .mo-item-val   { font-size: 13px; font-weight: 700; color: #111; }
//         .mo-item-val.locked { color: #bbb; font-size: 12px; }
//         .mo-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: #92400e; font-weight: 500; }
//         .mo-actions { display: flex; gap: 10px; margin-top: 6px; }

//         /* TOAST */
//         .ap-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .ap-toast.success { background: #111; color: #fff; }
//         .ap-toast.error   { background: #ef4444; color: #fff; }
//       `}</style>

//       {toast && <div className={`ap-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* PROFILE MODAL */}
//       {modalProfile && (() => {
//         const app = modalProfile;
//         const name = getName(app);
//         const img  = getImage(app);
//         const isAccepted = decidedApps[app._id] === "accepted";
//         const phone = getPhone(app);
//         const platform = getPlatform(app);
//         const note = app?.note || app?.message || app?.coverLetter || "";

//         return (
//           <div className="mo-overlay" onClick={() => setModalProfile(null)}>
//             <div className="mo-box" onClick={(e) => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalProfile(null)}>✕</button>

//               {/* Cover image */}
//               <div className="mo-img">
//                 {img ? <img src={img} alt={name} /> : "👤"}
//               </div>

//               <div className="mo-body">
//                 {/* Name */}
//                 <div className="mo-name">
//                   {isAccepted ? name : (
//                     <>
//                       {blurNameHalf(name).visible}
//                       <span style={{ filter: "blur(6px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                     </>
//                   )}
//                 </div>
//                 <div className="mo-loc">📍 {getLocation(app) || "Location not set"}</div>

//                 {/* Lock banner if not accepted */}
//                 {!isAccepted && (
//                   <div className="mo-lock-banner">
//                     🔒 Accept this application to unlock full contact details
//                   </div>
//                 )}

//                 <div className="mo-section">Profile Details</div>
//                 <div className="mo-grid">
//                   <div className="mo-item">
//                     <div className="mo-item-label">Followers</div>
//                     <div className="mo-item-val">{getFollowers(app) || "—"}</div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">Category</div>
//                     <div className="mo-item-val" style={{ fontSize: 12 }}>{getCategories(app) || "—"}</div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">📞 Phone</div>
//                     <div className={`mo-item-val ${!isAccepted ? "locked" : ""}`}>
//                       {isAccepted
//                         ? (phone || "Not provided")
//                         : (phone ? blurPhone(phone) : "🔒 Hidden")}
//                     </div>
//                   </div>
//                   <div className="mo-item">
//                     <div className="mo-item-label">🔗 Instagram</div>
//                     <div className={`mo-item-val ${!isAccepted ? "locked" : ""}`}>
//                       {isAccepted
//                         ? (platform
//                             ? <a href={platform} target="_blank" rel="noreferrer" style={{ color: "#4f46e5", textDecoration: "none", fontSize: 12 }}>{platform}</a>
//                             : "Not provided")
//                         : <span style={{ filter: "blur(5px)", userSelect: "none", fontSize: 12 }}>instagram.com/hidden</span>
//                       }
//                     </div>
//                   </div>
//                 </div>

//                 {note && (
//                   <>
//                     <div className="mo-section">Application Note</div>
//                     <div className="mo-item" style={{ marginBottom: 16 }}>
//                       <div className="mo-item-val" style={{ fontWeight: 400, color: "#555", lineHeight: 1.6, fontSize: 13 }}>{note}</div>
//                     </div>
//                   </>
//                 )}

//                 {/* Actions */}
//                 <div className="mo-actions">
//                   {decidedApps[app._id] === "accepted" ? (
//                     <div className="ap-btn ap-btn-accepted" style={{ flex: 1 }}>✓ Accepted</div>
//                   ) : decidedApps[app._id] === "rejected" ? (
//                     <div className="ap-btn ap-btn-rejected" style={{ flex: 1 }}>✗ Rejected</div>
//                   ) : (
//                     <>
//                       <button className="ap-btn ap-btn-accept" style={{ flex: 1 }} onClick={() => { handleAccept(app); setModalProfile(null); }}>
//                         ✓ Accept
//                       </button>
//                       <button className="ap-btn ap-btn-reject" style={{ flex: 1 }} onClick={() => { handleReject(app); setModalProfile(null); }}>
//                         ✗ Reject
//                       </button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="ap">
//         {/* HEADER */}
//         <div className="ap-header">
//           <div className="ap-header-left">
//             <h1>Applications</h1>
//             <p>{campaign?.title || "Campaign"} · {applications.length} applicant{applications.length !== 1 ? "s" : ""}</p>
//           </div>
//           <Link href={`/campaigns/${id}`} className="ap-back-btn">← Back</Link>
//         </div>

//         {/* STATS */}
//         {applications.length > 0 && (
//           <div className="ap-stats">
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>👥</span>
//               <div><div className="ap-stat-val">{applications.length}</div><div className="ap-stat-lbl">Total</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>✅</span>
//               <div><div className="ap-stat-val">{Object.values(decidedApps).filter(v => v === "accepted").length}</div><div className="ap-stat-lbl">Accepted</div></div>
//             </div>
//             <div className="ap-stat">
//               <span style={{ fontSize: 20 }}>⏳</span>
//               <div><div className="ap-stat-val">{applications.filter(a => !decidedApps[a._id]).length}</div><div className="ap-stat-lbl">Pending</div></div>
//             </div>
//           </div>
//         )}

//         {/* GRID */}
//         {applications.length === 0 ? (
//           <div className="ap-empty">
//             <div className="ap-empty-icon">📭</div>
//             <h3 className="ap-empty-title">No applications yet</h3>
//             <p className="ap-empty-sub">Creators will appear here once they apply to your campaign</p>
//           </div>
//         ) : (
//           <div className="ap-grid">
//             {applications.map((app) => {
//               const name       = getName(app);
//               const img        = getImage(app);
//               const location   = getLocation(app);
//               const categories = getCategories(app);
//               const followers  = getFollowers(app);
//               const phone      = getPhone(app);
//               const platform   = getPlatform(app);
//               const note       = app?.note || app?.message || app?.coverLetter || "";
//               const decision   = decidedApps[app._id];
//               const initials   = name.slice(0, 2).toUpperCase();

//               return (
//                 <div key={app._id} className={`ap-card ${decision || ""}`}>

//                   {/* RIBBON */}
//                   <div className={`ap-ribbon ${decision || "pending"}`}>
//                     {decision === "accepted" ? "✓ Accepted" : decision === "rejected" ? "✗ Rejected" : "⏳ Pending"}
//                   </div>

//                   {/* TOP */}
//                   <div className="ap-card-top">
//                     <div className="ap-avatar">
//                       {img ? <img src={img} alt={name} /> : initials}
//                     </div>
//                     <div className="ap-name-wrap">
//                       <div className="ap-name">
//                         {decision === "accepted" ? name : (
//                           <>
//                             {blurNameHalf(name).visible}
//                             <span style={{ filter: "blur(5px)", userSelect: "none" }}>{blurNameHalf(name).blurred}</span>
//                           </>
//                         )}
//                       </div>
//                       {location && <div className="ap-location">📍 {location}</div>}
//                     </div>
//                   </div>

//                   {/* INFO */}
//                   <div className="ap-card-info">
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Followers</div>
//                       <div className="ap-info-val">{followers || "—"}</div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">Category</div>
//                       <div className="ap-info-val" style={{ fontSize: 12 }}>{categories || "—"}</div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">📞 Phone</div>
//                       <div className={`ap-info-val ${decision !== "accepted" ? "locked" : ""}`}>
//                         {decision === "accepted"
//                           ? (phone || "N/A")
//                           : (phone ? blurPhone(phone) : "🔒 Hidden")}
//                       </div>
//                     </div>
//                     <div className="ap-info-item">
//                       <div className="ap-info-label">🔗 Instagram</div>
//                       <div className={`ap-info-val ${decision !== "accepted" ? "locked" : ""}`}>
//                         {decision === "accepted"
//                           ? (platform || "N/A")
//                           : <span style={{ filter: "blur(4px)", userSelect: "none", fontSize: 11 }}>instagram.com/hidden</span>
//                         }
//                       </div>
//                     </div>
//                   </div>

//                   {/* NOTE */}
//                   {note && (
//                     <div className="ap-note">
//                       <div className="ap-note-label">Note</div>
//                       <div className="ap-note-text">{note}</div>
//                     </div>
//                   )}

//                   {/* ACTIONS */}
//                   <div className="ap-actions">
//                     <button className="ap-btn ap-btn-view" onClick={() => setModalProfile(app)}>
//                       👤 View Profile
//                     </button>
//                     {decision === "accepted" ? (
//                       <>
//                         <div className="ap-btn ap-btn-accepted">✓ Accepted</div>
//                         <a href={`/deals/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-deal">🤝 Deal</a>
//                         <a href={`/contracts/create?campaignId=${id}&creatorId=${app.influencer?._id||app._id}`} className="ap-btn ap-btn-contract">📄 Contract</a>
//                       </>
//                     ) : decision === "rejected" ? (
//                       <div className="ap-btn ap-btn-rejected">✗ Rejected</div>
//                     ) : (
//                       <>
//                         <button className="ap-btn ap-btn-accept" onClick={() => handleAccept(app)}>✓ Accept</button>
//                         <button className="ap-btn ap-btn-reject" onClick={() => handleReject(app)}>✗ Reject</button>
//                       </>
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



// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const API = "http://54.252.201.93:5000/api";

// interface Influencer {
//   _id: string;
//   title: string;
//   email: string;
// }

// interface Application {
//   _id: string;
//   influencerId: Influencer | string; // can be ID or populated object
//   status: string;
// }

// export default function ApplicationsPage() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<Application[]>([]);
//   const [loading, setLoading] = useState(true);

//   // ✅ Type Guard
//   function isInfluencerObject(
//     influencer: Application["influencerId"]
//   ): influencer is Influencer {
//     return typeof influencer === "object" && influencer !== null;
//   }

//   const fetchApps = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();
//       console.log("RAW APPLICATION RESPONSE:", data);

//       let appsArray: any[] = [];
//       if (Array.isArray(data)) appsArray = data;
//       else if (Array.isArray(data?.applications)) appsArray = data.applications;
//       else if (Array.isArray(data?.data)) appsArray = data.data;

//       const appsWithInfluencers = await Promise.all(
//         appsArray.map(async (app: Application) => {
//           if (typeof app.influencerId === "string") {
//             try {
//               const infRes = await fetch(
//                 `${API}/influencers/${app.influencerId}`,
//                 {
//                   headers: { Authorization: `Bearer ${token}` },
//                 }
//               );

//               if (infRes.ok) {
//                 const infData = await infRes.json();
//                 app.influencerId = {
//                   _id: infData._id,
//                   title: infData.title || "Unknown",
//                   email: infData.email || "No Email",
//                 };
//               } else {
//                 const influencerIdString = app.influencerId as string;

// app.influencerId = {
//   _id: influencerIdString,
//   title: "Unknown",
//   email: "No Email",
// };
//               }
//             } catch {
//               const influencerIdString = app.influencerId as string;

// app.influencerId = {
//   _id: influencerIdString,
//   title: "Unknown",
//   email: "No Email",
// };
//             }
//           }
//           return app;
//         })
//       );

//       setApplications(appsWithInfluencers);
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setApplications([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchApps();
//   }, [id]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Applications...
//       </div>
//     );
//   }

//   return (
//     <div className="p-10 bg-slate-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8">Applications</h1>

//       {applications.length > 0 ? (
//         applications.map((app) => (
//           <div
//             key={app._id}
//             className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
//           >
//             <div>
//               <h2 className="font-bold text-lg">
//                 {isInfluencerObject(app.influencerId)
//                   ? app.influencerId.title
//                   : "Unknown"}
//               </h2>

//               <p className="text-gray-500">
//                 {isInfluencerObject(app.influencerId)
//                   ? app.influencerId.email
//                   : "No Email"}
//               </p>

//               <span
//                 className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
//                   ${app.status === "PENDING" && "bg-gray-100 text-gray-600"}
//                   ${app.status === "ACCEPTED" && "bg-green-100 text-green-600"}
//                   ${app.status === "REJECTED" && "bg-red-100 text-red-600"}
//                 `}
//               >
//                 {app.status}
//               </span>
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="bg-white rounded-xl p-10 text-center shadow">
//           No applications yet.
//         </div>
//       )}
//     </div>
//   );
// }




// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const API = "http://54.252.201.93:5000/api";

// interface Application {
//   _id: string;
//   influencerId: {
//     _id: string;
//     title: string;
//     email: string;
//   } | string; // could be just ID if not populated
//   status: string;
// }

// export default function ApplicationsPage() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<Application[]>([]);
//   const [loading, setLoading] = useState(true);

//   const fetchApps = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();
//       console.log("RAW APPLICATION RESPONSE:", data);

//       // Ensure we have an array
//       let appsArray: any[] = [];
//       if (Array.isArray(data)) appsArray = data;
//       else if (Array.isArray(data?.applications)) appsArray = data.applications;
//       else if (Array.isArray(data?.data)) appsArray = data.data;

//       // Fetch influencer details if not populated
//       const appsWithInfluencers = await Promise.all(
//         appsArray.map(async (app: Application) => {
//           if (typeof app.influencerId === "string") {
//             // influencerId is just an ID, fetch details
//             try {
//               const infRes = await fetch(`${API}/influencers/${app.influencerId}`, {
//                 headers: { Authorization: `Bearer ${token}` },
//               });
//               if (infRes.ok) {
//                 const infData = await infRes.json();
//                 app.influencerId = {
//                   _id: infData._id,
//                   title: infData.title || "Unknown",
//                   email: infData.email || "No Email",
//                 };
//               } else {
//                 app.influencerId = { _id: app.influencerId, title: "Unknown", email: "No Email" };
//               }
//             } catch {
//               app.influencerId = { _id: app.influencerId, title: "Unknown", email: "No Email" };
//             }
//           }
//           return app;
//         })
//       );

//       setApplications(appsWithInfluencers);
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setApplications([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchApps();
//   }, [id]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Applications...
//       </div>
//     );
//   }

//   return (
//     <div className="p-10 bg-slate-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8">Applications</h1>

//       {applications.length > 0 ? (
//         applications.map((app) => (
//           <div
//             key={app._id}
//             className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
//           >
//             <div>
//               <h2 className="font-bold text-lg">
//                 {app.influencerId?.title || "Unknown"}
//               </h2>
//               <p className="text-gray-500">
//                 {app.influencerId?.email || "No Email"}
//               </p>

//               <span
//                 className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
//                   ${app.status === "PENDING" && "bg-gray-100 text-gray-600"}
//                   ${app.status === "ACCEPTED" && "bg-green-100 text-green-600"}
//                   ${app.status === "REJECTED" && "bg-red-100 text-red-600"}
//                 `}
//               >
//                 {app.status}
//               </span>
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="bg-white rounded-xl p-10 text-center shadow">
//           No applications yet.
//         </div>
//       )}
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const API = "http://54.252.201.93:5000/api";

// export default function ApplicationsPage() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   const fetchApps = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       console.log("APPLICATION RESPONSE:", data);

//       // ✅ SAFE ARRAY HANDLING
//       if (Array.isArray(data)) {
//         setApplications(data);
//       } else if (Array.isArray(data?.applications)) {
//         setApplications(data.applications);
//       } else if (Array.isArray(data?.data)) {
//         setApplications(data.data);
//       } else {
//         setApplications([]);
//       }

//     } catch (err) {
//       console.error("Fetch error:", err);
//       setApplications([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchApps();
//   }, [id]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Applications...
//       </div>
//     );
//   }

//   return (
//     <div className="p-10 bg-slate-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8">Applications</h1>

//       {Array.isArray(applications) && applications.length > 0 ? (
//         applications.map((app: any) => (
//           <div
//             key={app?._id}
//             className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
//           >
//             <div>
//               <h2 className="font-bold text-lg">
//                 {app?.influencerId?.name || "Unknown"}
//               </h2>
//               <p className="text-gray-500">
//                 {app?.influencerId?.email || "No Email"}
//               </p>

//               <span
//                 className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
//                   ${app?.status === "PENDING" && "bg-gray-100 text-gray-600"}
//                   ${app?.status === "ACCEPTED" && "bg-green-100 text-green-600"}
//                   ${app?.status === "REJECTED" && "bg-red-100 text-red-600"}
//                 `}
//               >
//                 {app?.status}
//               </span>
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="bg-white rounded-xl p-10 text-center shadow">
//           No applications yet.
//         </div>
//       )}
//     </div>
//   );
// }