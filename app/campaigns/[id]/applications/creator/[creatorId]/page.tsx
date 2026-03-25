"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = "https://api.collabzy.in/api";

export default function CreatorProfilePage() {
  const params    = useParams();
  const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
  const creatorIdx = pathParts.indexOf("creator");
  const id        = ((creatorIdx !== -1 ? pathParts[creatorIdx + 1] : "") || (params?.creatorId as string) || "") as string;
  const router    = useRouter();

  const [appId, setAppId]           = useState<string>("");
  const [profile, setProfile]       = useState<any>(null);
  const [app, setApp]               = useState<any>(null);
  const [campaign, setCampaign]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [token, setToken]           = useState("");
  const [isBrand, setIsBrand]       = useState(false);
  const [isDealDone, setIsDealDone] = useState(false);
  const [decision, setDecision]     = useState<"accepted" | "rejected" | "">("");
  const [acting, setActing]         = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: "success" | "error" } | null>(null);
  // ✅ Portfolio state
  const [portfolio, setPortfolio]   = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [activeMedia, setActiveMedia] = useState<any>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setToken(parsed.token);
    setIsBrand(parsed.role === "brand");

    const urlParams    = new URLSearchParams(window.location.search);
    const qAppId       = urlParams.get("appId") || "";
    const campFromPath = pathParts.length > 2 ? pathParts[pathParts.indexOf("campaigns") + 1] : "";
    const qCampaignId  = urlParams.get("campaignId") || campFromPath || (params?.id as string) || "";
    setAppId(qAppId);

    const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
    if (qAppId && saved[qAppId]) setDecision(saved[qAppId]);

    fetchAll(parsed.token, qAppId, qCampaignId);
  }, [id]);

  const fetchAll = async (tok: string, qAppId: string, qCampaignId: string) => {
    try {
      setLoading(true);

      const res  = await fetch(`${API}/profile/user/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
      const data = await res.json();
      setProfile(data?.profile || data?.data || (data?._id ? data : null));

      if (qCampaignId) {
        try {
          const cr = await fetch(`${API}/campaigns/${qCampaignId}`, { headers: { Authorization: `Bearer ${tok}` } });
          if (cr.ok) { const cd = await cr.json(); setCampaign(cd?.campaign || cd?.data || cd); }
        } catch { }
      }

      if (qCampaignId) {
        try {
          const ar  = await fetch(`${API}/campaigns/${qCampaignId}/applications`, { headers: { Authorization: `Bearer ${tok}` } });
          if (ar.ok) {
            const ad   = await ar.json();
            const apps = ad?.applications || ad?.data || [];
            const found = qAppId
              ? apps.find((a: any) => a._id === qAppId)
              : apps.find((a: any) => (a?.influencerId?._id || a?.influencer?._id || a?.userId) === id);
            if (found) setApp(found);
          }
        } catch { }
      }

      try {
        const dr = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${tok}` } });
        if (dr.ok) {
          const dd    = await dr.json();
          const deals: any[] = dd?.data || dd?.deals || [];
          const done = deals.some((deal: any) => {
            const ps   = (deal.paymentStatus || deal.status || "").toLowerCase();
            const isDone = ["released", "completed", "done"].includes(ps);
            if (!isDone) return false;
            const infId = typeof deal.influencerId === "object"
              ? (deal.influencerId?._id || deal.influencerId?.id || "")
              : (deal.influencerId || "");
            return String(infId) === String(id) ||
                   deal.applicationId === qAppId ||
                   String(deal.applicationId) === qAppId;
          });
          setIsDealDone(done);
        }
      } catch { }

      // ✅ Fetch creator portfolio
      try {
        setPortfolioLoading(true);
        // const pr = await fetch(`${API}/portfolio/user/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
        const pr = await fetch(`${API}/posts?userId=${id}`, {
  headers: { Authorization: `Bearer ${tok}` }
});
        if (pr.ok) {
          // const pd = await pr.json();
//           const items = pd?.portfolio || pd?.data || [];
//           // setPortfolio(Array.isArray(items) ? items : []);

//           const normalized = (items || []).map((item: any) => {
//           const isVideo = item.urls?.length > 0;

//   return {
//     type: isVideo ? "reel" : "post",
//     url: isVideo
//       ? item.urls[0]
//       : item.images?.[0] || item.media?.[0] || "",
//     caption: item.caption || "",
//   };
// });

// setPortfolio(normalized);
const pd = await pr.json();
console.log("PORTFOLIO DATA 👉", pd);

// ✅ FIXED data extraction
const items =
  pd?.portfolio ||
  pd?.data?.posts ||
  pd?.data ||
  [];

// ✅ FIXED normalization (multiple media support)
const normalized = (items || []).flatMap((item: any) => {
  const videos = item.urls || [];
  const images = item.images || item.media || [];

  return [
    ...videos.map((v: string) => ({
      type: "reel",
      url: v,
      caption: item.caption || "",
    })),
    ...images.map((img: string) => ({
      type: "post",
      url: img,
      caption: item.caption || "",
    })),
  ];
});

setPortfolio(normalized);
        }
      } catch { } finally {
        setPortfolioLoading(false);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (dec: "accepted" | "rejected") => {
    const currentAppId = appId || new URLSearchParams(window.location.search).get("appId") || "";
    if (!currentAppId) { showToast("Application ID missing", "error"); return; }
    try {
      setActing(true);
      await fetch(`${API}/application/${currentAppId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: dec }),
      });
      await fetch(`${API}/notification/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user:    String(id),
          message: dec === "accepted" ? "Your application has been accepted! 🎉" : "Your application was not selected this time. Keep applying! 💪",
          type:    "application_accepted",
          link:    dec === "accepted" ? "/campaigns" : "/discovery",
          applicationId: appId,
        }),
      });
      if (dec === "accepted") {
        try {
          const convRes  = await fetch(`${API}/conversations/start`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ participantId: id }) });
          const convData = await convRes.json();
          const convId   = convData?.conversation?._id || convData?._id;
          if (convId) {
            await fetch(`${API}/conversations/send/${convId}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }) });
          }
        } catch { }
      }
      setDecision(dec);
      const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
      saved[currentAppId] = dec;
      localStorage.setItem("decidedApplications", JSON.stringify(saved));
      showToast(dec === "accepted" ? "Application accepted ✓" : "Application rejected", dec === "accepted" ? "success" : "error");
    } catch {
      showToast("Action failed. Try again.", "error");
    } finally {
      setActing(false);
    }
  };

  const FOLLOWER_LABELS: Record<string, string> = {
    "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
    "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
  };
  const followers = () => {
    const f = profile?.followers;
    if (!f && f !== 0) return "N/A";
    const key = String(f);
    if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
    const n = Number(f);
    if (!isNaN(n) && n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(f);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>👤</div>
      <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Profile not found</h2>
      <button onClick={() => router.back()} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
    </div>
  );

  const bidAmount  = app?.bidAmount || app?.bid || campaign?.budget || 0;
  const proposal   = app?.proposal || app?.note || app?.message || app?.coverLetter || "";
  const categories = Array.isArray(profile?.categories) ? profile.categories.join(", ") : profile?.categories || "N/A";
  const phone      = profile?.phone || "";
  const platform   = profile?.instagram || profile?.platform || "";
  const fullName   = profile?.name || "Creator";
  const nameParts  = fullName.trim().split(" ");
  const firstName  = nameParts[0] || "";
  const lastName   = nameParts.slice(1).join(" ");

  const reels = portfolio.filter(p => p.type === "reel");
  const posts = portfolio.filter(p => p.type === "post");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }
        .cp-wrap  { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .cp-bar   { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
        .cp-back  { background: none; border: 1.5px solid #ebebeb; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; color: #555; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cp-back:hover { background: #f4f4f4; }
        .cp-bar-title { font-size: 15px; font-weight: 700; color: #111; }
        .cp-hero  { position: relative; background: linear-gradient(135deg, #e0e0ff 0%, #f0e0ff 100%); border-radius: 0 0 28px 28px; overflow: hidden; height: 260px; margin-bottom: -60px; }
        .cp-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
        .cp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%); }
        .cp-avatar-wrap { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: 12px; }
        .cp-avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; }
        .cp-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
        .cp-card  { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 22px; margin-bottom: 14px; animation: fadeUp 0.35s ease both; }
        .cp-name  { font-size: 26px; font-weight: 800; color: #111; text-align: center; margin-bottom: 5px; }
        .cp-loc   { font-size: 13px; color: #aaa; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 18px; }
        .cp-sec-label { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; display: block; }
        .cp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cp-item  { background: #f9f9f8; border-radius: 12px; padding: 12px 14px; border: 1px solid #f0f0f0; }
        .cp-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
        .cp-item-val   { font-size: 14px; font-weight: 700; color: #111; }
        .cp-bio   { font-size: 14px; color: #555; line-height: 1.75; }
        .cp-bid-box { background: linear-gradient(135deg, #eef2ff, #ede9fe); border: 1.5px solid #c7d2fe; border-radius: 16px; padding: 18px 20px; }
        .cp-bid-amount { font-size: 32px; font-weight: 800; color: #4f46e5; }
        .cp-bid-fee { font-size: 12px; color: #818cf8; margin-top: 2px; }
        .cp-proposal { font-size: 14px; color: #444; line-height: 1.8; background: #f9f9f8; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; }
        .cp-actions { display: flex; gap: 10px; }
        .cp-btn { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .cp-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
        .cp-btn-accept:hover:not(:disabled) { transform: translateY(-1px); }
        .cp-btn-reject { background: #fee2e2; color: #b91c1c; }
        .cp-btn-reject:hover:not(:disabled) { background: #fecaca; }
        .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .cp-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
        .cp-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
        .cp-btn-done { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; cursor: default; }
        .cp-btn-msg { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.2); transition: all 0.2s; }
        .cp-btn-msg:hover { transform: translateY(-1px); }
        .cp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .cp-toast.success { background: #111; color: #fff; }
        .cp-toast.error   { background: #ef4444; color: #fff; }

        /* ✅ Portfolio styles */
        .pf-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pf-grid-reels { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .pf-thumb { border-radius: 12px; overflow: hidden; position: relative; cursor: pointer; transition: transform 0.2s; background: #f0f0f0; }
        .pf-thumb:hover { transform: scale(1.02); }
        .pf-thumb img { width: 100%; aspect-ratio: 1/1; object-fit: cover; display: block; }
        .pf-thumb video { width: 100%; aspect-ratio: 9/16; object-fit: cover; display: block; }
        .pf-thumb-reel img { aspect-ratio: 9/16; }
        .pf-badge { position: absolute; top: 6px; left: 6px; padding: 2px 7px; border-radius: 6px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
        .pf-badge-reel { background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #fff; }
        .pf-badge-post { background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; }
        .pf-caption { font-size: 11px; color: #666; padding: 6px 8px; background: #fff; line-height: 1.4; }
        .pf-empty { text-align: center; padding: 28px 16px; color: #bbb; font-size: 13px; }
        .pf-sub-label { font-size: 11px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .07em; margin: 0 0 8px; }

        /* Modal */
        .pf-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.92); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn .2s ease; }
        .pf-modal-close { position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,.15); border: none; color: #fff; width: 36px; height: 36px; border-radius: 50%; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .pf-modal-img { max-width: 90vw; max-height: 85vh; border-radius: 14px; object-fit: contain; }
        .pf-modal-video { max-width: 90vw; max-height: 85vh; border-radius: 14px; }
        .pf-modal-caption { color: rgba(255,255,255,.7); font-size: 13px; text-align: center; margin-top: 12px; max-width: 400px; }

        @media(max-width:500px) { .cp-grid { grid-template-columns: 1fr; } .cp-bid-amount { font-size: 26px; } .cp-name { font-size: 22px; } .pf-grid { grid-template-columns: repeat(3,1fr); } }
      `}</style>

      {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

      {/* Media Modal */}
      {activeMedia && (
        <div className="pf-modal-overlay" onClick={() => setActiveMedia(null)}>
          <button className="pf-modal-close" onClick={() => setActiveMedia(null)}>✕</button>
          {activeMedia.type === "reel" ? (
            <video className="pf-modal-video" src={activeMedia.url} controls autoPlay playsInline onClick={e => e.stopPropagation()} />
          ) : (
            <img className="pf-modal-img" src={activeMedia.url} alt={activeMedia.caption || "post"} onClick={e => e.stopPropagation()} />
          )}
          {activeMedia.caption && <div className="pf-modal-caption">{activeMedia.caption}</div>}
        </div>
      )}

      <div className="cp-bar">
        <button className="cp-back" onClick={() => router.back()}>←</button>
        <span className="cp-bar-title">Creator Profile</span>
      </div>

      <div className="cp-hero">
        {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : null}
        <div className="cp-hero-overlay" />
      </div>

      <div className="cp-wrap">
        <div className="cp-card" style={{ marginTop: 0, paddingTop: 28 }}>
          <div className="cp-avatar-wrap">
            <div className="cp-avatar">
              {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : "👤"}
            </div>
          </div>
          <div className="cp-name">
            {isDealDone ? fullName : (
              <>{firstName}{lastName && <> <span style={{filter:"blur(6px)",userSelect:"none",display:"inline-block"}}>{lastName}</span></>}</>
            )}
          </div>
          <div className="cp-loc">📍 {profile?.location || profile?.city || "N/A"}</div>
          <span className="cp-sec-label">Profile Details</span>
          <div className="cp-grid">
            <div className="cp-item"><div className="cp-item-label">Followers</div><div className="cp-item-val">{followers()}</div></div>
            <div className="cp-item"><div className="cp-item-label">Category</div><div className="cp-item-val" style={{ fontSize: 13 }}>{categories}</div></div>
          </div>
        </div>

        {/* Contact info */}
        <div className="cp-card">
          <span className="cp-sec-label">Contact Details</span>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
              <span style={{fontSize:18,flexShrink:0}}>📞</span>
              {isDealDone
                ? <span style={{fontSize:14,fontWeight:700,color:"#111"}}>{phone || "Not provided"}</span>
                : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>+91 XXXXXXXXXX</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
              <span style={{fontSize:18,flexShrink:0}}>📸</span>
              {isDealDone
                ? (platform
                    ? <a href={platform.startsWith("http") ? platform : `https://instagram.com/${platform.replace("@","")}`} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:700,color:"#4f46e5",textDecoration:"none"}}>
                        {platform.includes("instagram.com/") ? "@"+platform.split("instagram.com/")[1]?.replace("/","") : platform.startsWith("@") ? platform : "@"+platform}
                      </a>
                    : <span style={{fontSize:14,color:"#aaa"}}>Not provided</span>)
                : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>instagram.com/XXXXXX</span>}
            </div>
            {isDealDone
              ? <div style={{textAlign:"center",fontSize:12,color:"#16a34a",fontWeight:700,padding:"6px 0"}}>✅ Deal completed — full contact details visible</div>
              : <div style={{textAlign:"center",fontSize:12,color:"#f59e0b",fontWeight:600,padding:"6px 0",background:"#fefce8",borderRadius:8}}>🔒 Complete the deal to reveal phone & Instagram</div>}
          </div>
        </div>

        {profile?.bio && (
          <div className="cp-card">
            <span className="cp-sec-label">About</span>
            <p className="cp-bio">{profile.bio}</p>
          </div>
        )}

        {/* ✅ PORTFOLIO SECTION */}
        <div className="cp-card" style={{border:"1.5px solid #e8e5ff",background:"linear-gradient(135deg,#fafbff,#f8f5ff)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🎬</div>
            <div>
              <div style={{fontSize:14,fontWeight:700,color:"#111"}}>Portfolio</div>
              <div style={{fontSize:11,color:"#aaa"}}>Creator's reels & posts</div>
            </div>
          </div>

          {portfolioLoading ? (
            <div style={{textAlign:"center",padding:24}}>
              <div style={{width:24,height:24,border:"2.5px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto"}}/>
            </div>
          ) : portfolio.length === 0 ? (
            <div className="pf-empty">
              <div style={{fontSize:32,marginBottom:8}}>📭</div>
              <div style={{fontWeight:600,color:"#888",marginBottom:4}}>No portfolio uploaded yet</div>
              <div style={{fontSize:12}}>This creator hasn't added any reels or posts</div>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {/* Reels */}
              {reels.length > 0 && (
                <div>
                  <div className="pf-sub-label">🎬 Reels ({reels.length})</div>
                  <div className="pf-grid-reels">
                    {reels.map((item, i) => (
                      <div key={i} className="pf-thumb pf-thumb-reel" onClick={() => setActiveMedia(item)}>
                        <span className="pf-badge pf-badge-reel">Reel</span>
                        {item.url?.includes(".mp4") || item.url?.includes("video") ? (
                          <video src={item.url} muted playsInline style={{width:"100%",aspectRatio:"9/16",objectFit:"cover",display:"block"}} />
                        ) : (
                          <img src={item.thumbnail || item.url} alt={item.caption || "reel"} style={{width:"100%",aspectRatio:"9/16",objectFit:"cover",display:"block"}} />
                        )}
                        {item.caption && <div className="pf-caption">{item.caption.length > 40 ? item.caption.slice(0,40)+"..." : item.caption}</div>}
                        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.15)"}}>
                          <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,0.9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>▶</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts */}
              {posts.length > 0 && (
                <div>
                  <div className="pf-sub-label">📸 Posts ({posts.length})</div>
                  <div className="pf-grid">
                    {posts.map((item, i) => (
                      <div key={i} className="pf-thumb" onClick={() => setActiveMedia(item)}>
                        <span className="pf-badge pf-badge-post">Post</span>
                        <img src={item.url} alt={item.caption || "post"} style={{width:"100%",aspectRatio:"1/1",objectFit:"cover",display:"block"}} />
                        {item.caption && <div className="pf-caption">{item.caption.length > 30 ? item.caption.slice(0,30)+"..." : item.caption}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {bidAmount > 0 && (
          <div className="cp-card">
            <span className="cp-sec-label">Bid Amount</span>
            <div className="cp-bid-box">
              <div className="cp-bid-amount">₹{Number(bidAmount).toLocaleString("en-IN")}</div>
              <div className="cp-bid-fee">Creator receives ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString("en-IN")} after 10% platform fee</div>
            </div>
          </div>
        )}

        {proposal && (
          <div className="cp-card">
            <span className="cp-sec-label">{app?.proposal || app?.note ? "📝 Proposal" : "👤 About Creator"}</span>
            <p className="cp-proposal">{proposal}</p>
          </div>
        )}

        {isBrand && (
          <div className="cp-card">
            <div className="cp-actions">
              {isDealDone ? (
                <>
                  <div className="cp-btn cp-btn-done" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>✅ Deal Done</div>
                  <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
                </>
              ) : decision === "accepted" ? (
                <>
                  <div className="cp-btn cp-btn-accepted" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700}}>✓ Accepted</div>
                  <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
                </>
              ) : decision === "rejected" ? (
                <div className="cp-btn cp-btn-rejected" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700}}>✗ Rejected</div>
              ) : (
                <>
                  <button className="cp-btn cp-btn-accept" disabled={acting} onClick={() => handleDecision("accepted")}>{acting ? "..." : "✓ Accept"}</button>
                  <button className="cp-btn cp-btn-reject" disabled={acting} onClick={() => handleDecision("rejected")}>{acting ? "..." : "✗ Reject"}</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useParams, useRouter } from "next/navigation";

// const API = "https://api.collabzy.in/api";

// export default function CreatorProfilePage() {
//   const params    = useParams();
//   const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
//   const creatorIdx = pathParts.indexOf("creator");
//   const id        = ((creatorIdx !== -1 ? pathParts[creatorIdx + 1] : "") || (params?.creatorId as string) || "") as string;
//   const router    = useRouter();

//   const [appId, setAppId]             = useState<string>("");
//   const [profile, setProfile]         = useState<any>(null);
//   const [app, setApp]                 = useState<any>(null);
//   const [campaign, setCampaign]       = useState<any>(null);
//   const [loading, setLoading]         = useState(true);
//   const [token, setToken]             = useState("");
//   const [isBrand, setIsBrand]         = useState(false);
//   const [isDealDone, setIsDealDone]   = useState(false);
//   const [decision, setDecision]       = useState<"accepted" | "rejected" | "">("");
//   const [acting, setActing]           = useState(false);
//   const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     setToken(parsed.token);
//     setIsBrand(parsed.role === "brand");

//     const urlParams    = new URLSearchParams(window.location.search);
//     const qAppId       = urlParams.get("appId") || "";
//     const campFromPath = pathParts.length > 2 ? pathParts[pathParts.indexOf("campaigns") + 1] : "";
//     const qCampaignId  = urlParams.get("campaignId") || campFromPath || (params?.id as string) || "";
//     setAppId(qAppId);

//     const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     if (qAppId && saved[qAppId]) setDecision(saved[qAppId]);

//     fetchAll(parsed.token, qAppId, qCampaignId);
//   }, [id]);

//   const fetchAll = async (tok: string, qAppId: string, qCampaignId: string) => {
//     try {
//       setLoading(true);

//       // Fetch profile
//       const res  = await fetch(`${API}/profile/user/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
//       const data = await res.json();
//       setProfile(data?.profile || data?.data || (data?._id ? data : null));

//       // Fetch campaign
//       if (qCampaignId) {
//         try {
//           const cr = await fetch(`${API}/campaigns/${qCampaignId}`, { headers: { Authorization: `Bearer ${tok}` } });
//           if (cr.ok) { const cd = await cr.json(); setCampaign(cd?.campaign || cd?.data || cd); }
//         } catch { /* silent */ }
//       }

//       // Fetch application
//       if (qCampaignId) {
//         try {
//           const ar    = await fetch(`${API}/campaigns/${qCampaignId}/applications`, { headers: { Authorization: `Bearer ${tok}` } });
//           if (ar.ok) {
//             const ad   = await ar.json();
//             const apps = ad?.applications || ad?.data || [];
//             const found = qAppId
//               ? apps.find((a: any) => a._id === qAppId)
//               : apps.find((a: any) => (a?.influencerId?._id || a?.influencer?._id || a?.userId) === id);
//             if (found) setApp(found);
//           }
//         } catch { /* silent */ }
//       }

//       // ✅ Check deal done — /deal/my + paymentStatus: "released"
//       try {
//         const dr = await fetch(`${API}/deal/my`, { headers: { Authorization: `Bearer ${tok}` } });
//         if (dr.ok) {
//           const dd    = await dr.json();
//           const deals: any[] = dd?.data || dd?.deals || [];
//           const done = deals.some((deal: any) => {
//             const ps = (deal.paymentStatus || deal.status || "").toLowerCase();
//             const isDone = ["released", "completed", "done"].includes(ps);
//             if (!isDone) return false;
//             // Match by influencerId (this creator's userId)
//             const infId = typeof deal.influencerId === "object"
//               ? (deal.influencerId?._id || deal.influencerId?.id || "")
//               : (deal.influencerId || "");
//             return String(infId) === String(id) ||
//                    deal.applicationId === qAppId ||
//                    String(deal.applicationId) === qAppId;
//           });
//           setIsDealDone(done);
//         }
//       } catch { /* silent */ }

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDecision = async (dec: "accepted" | "rejected") => {
//     const currentAppId = appId || new URLSearchParams(window.location.search).get("appId") || "";
//     if (!currentAppId) { showToast("Application ID missing", "error"); return; }
//     try {
//       setActing(true);
//       await fetch(`${API}/application/${currentAppId}/decision`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ decision: dec }),
//       });
//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user:    String(id),
//           message: dec === "accepted" ? "Your application has been accepted! 🎉" : "Your application was not selected this time. Keep applying! 💪",
//           type:    "application_accepted",
//           link:    dec === "accepted" ? "/campaigns" : "/discovery",
//           applicationId: appId,
//         }),
//       });
//       if (dec === "accepted") {
//         try {
//           const convRes  = await fetch(`${API}/conversations/start`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ participantId: id }) });
//           const convData = await convRes.json();
//           const convId   = convData?.conversation?._id || convData?._id;
//           if (convId) {
//             await fetch(`${API}/conversations/send/${convId}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }) });
//           }
//         } catch { /* silent */ }
//       }
//       setDecision(dec);
//       const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       saved[currentAppId] = dec;
//       localStorage.setItem("decidedApplications", JSON.stringify(saved));
//       showToast(dec === "accepted" ? "Application accepted ✓" : "Application rejected", dec === "accepted" ? "success" : "error");
//     } catch {
//       showToast("Action failed. Try again.", "error");
//     } finally {
//       setActing(false);
//     }
//   };

//   // const followers = () => {
//   //   const f = profile?.followers;
//   //   if (!f && f !== 0) return "N/A";
//   //   const n = Number(f);
//   //   if (!isNaN(n) && n >= 1000) return (n / 1000).toFixed(1) + "K";
//   //   return String(f);
//   // };
//   const FOLLOWER_LABELS: Record<string, string> = {
//     "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
//     "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
//   };
//   const followers = () => {
//     const f = profile?.followers;
//     if (!f && f !== 0) return "N/A";
//     const key = String(f);
//     if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//     const n = Number(f);
//     if (!isNaN(n) && n >= 1000) return (n / 1000).toFixed(1) + "K";
//     return String(f);
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!profile) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>👤</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Profile not found</h2>
//       <button onClick={() => router.back()} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const bidAmount  = app?.bidAmount || app?.bid || campaign?.budget || 0;
//   const proposal   = app?.proposal || app?.note || app?.message || app?.coverLetter || "";
//   const categories = Array.isArray(profile?.categories) ? profile.categories.join(", ") : profile?.categories || "N/A";
//   const phone      = profile?.phone || "";
//   const platform   = profile?.instagram || profile?.platform || "";
//   const fullName   = profile?.name || "Creator";
//   const nameParts  = fullName.trim().split(" ");
//   const firstName  = nameParts[0] || "";
//   const lastName   = nameParts.slice(1).join(" ");

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }
//         .cp-wrap  { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .cp-bar   { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
//         .cp-back  { background: none; border: 1.5px solid #ebebeb; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; color: #555; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
//         .cp-back:hover { background: #f4f4f4; }
//         .cp-bar-title { font-size: 15px; font-weight: 700; color: #111; }
//         .cp-hero  { position: relative; background: linear-gradient(135deg, #e0e0ff 0%, #f0e0ff 100%); border-radius: 0 0 28px 28px; overflow: hidden; height: 260px; margin-bottom: -60px; }
//         .cp-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
//         .cp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%); }
//         .cp-avatar-wrap { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: 12px; }
//         .cp-avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; }
//         .cp-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
//         .cp-card  { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 22px; margin-bottom: 14px; animation: fadeUp 0.35s ease both; }
//         .cp-name  { font-size: 26px; font-weight: 800; color: #111; text-align: center; margin-bottom: 5px; }
//         .cp-loc   { font-size: 13px; color: #aaa; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 18px; }
//         .cp-sec-label { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; display: block; }
//         .cp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
//         .cp-item  { background: #f9f9f8; border-radius: 12px; padding: 12px 14px; border: 1px solid #f0f0f0; }
//         .cp-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .cp-item-val   { font-size: 14px; font-weight: 700; color: #111; }
//         .cp-bio   { font-size: 14px; color: #555; line-height: 1.75; }
//         .cp-bid-box { background: linear-gradient(135deg, #eef2ff, #ede9fe); border: 1.5px solid #c7d2fe; border-radius: 16px; padding: 18px 20px; }
//         .cp-bid-amount { font-size: 32px; font-weight: 800; color: #4f46e5; }
//         .cp-bid-fee { font-size: 12px; color: #818cf8; margin-top: 2px; }
//         .cp-proposal { font-size: 14px; color: #444; line-height: 1.8; background: #f9f9f8; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; }
//         .cp-actions { display: flex; gap: 10px; }
//         .cp-btn { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .cp-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
//         .cp-btn-accept:hover:not(:disabled) { transform: translateY(-1px); }
//         .cp-btn-reject { background: #fee2e2; color: #b91c1c; }
//         .cp-btn-reject:hover:not(:disabled) { background: #fecaca; }
//         .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
//         .cp-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
//         .cp-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
//         .cp-btn-done { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; cursor: default; }
//         .cp-btn-msg { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.2); transition: all 0.2s; }
//         .cp-btn-msg:hover { transform: translateY(-1px); }
//         .cp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .cp-toast.success { background: #111; color: #fff; }
//         .cp-toast.error   { background: #ef4444; color: #fff; }
//         @media(max-width:500px) { .cp-grid { grid-template-columns: 1fr; } .cp-bid-amount { font-size: 26px; } .cp-name { font-size: 22px; } }
//       `}</style>

//       {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cp-bar">
//         <button className="cp-back" onClick={() => router.back()}>←</button>
//         <span className="cp-bar-title">Creator Profile</span>
//       </div>

//       <div className="cp-hero">
//         {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : null}
//         <div className="cp-hero-overlay" />
//       </div>

//       <div className="cp-wrap">
//         <div className="cp-card" style={{ marginTop: 0, paddingTop: 28 }}>
//           <div className="cp-avatar-wrap">
//             <div className="cp-avatar">
//               {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : "👤"}
//             </div>
//           </div>
//           <div className="cp-name">
//             {/* ✅ Full name when deal done */}
//             {isDealDone ? fullName : (
//               <>{firstName}{lastName && <> <span style={{filter:"blur(6px)",userSelect:"none",display:"inline-block"}}>{lastName}</span></>}</>
//             )}
//           </div>
//           <div className="cp-loc">📍 {profile?.location || profile?.city || "N/A"}</div>
//           <span className="cp-sec-label">Profile Details</span>
//           <div className="cp-grid">
//             <div className="cp-item"><div className="cp-item-label">Followers</div><div className="cp-item-val">{followers()}</div></div>
//             <div className="cp-item"><div className="cp-item-label">Category</div><div className="cp-item-val" style={{ fontSize: 13 }}>{categories}</div></div>
//           </div>
//         </div>

//         {/* Contact info */}
//         <div className="cp-card">
//           <span className="cp-sec-label">Contact Details</span>
//           <div style={{display:"flex",flexDirection:"column",gap:10}}>
//             <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
//               <span style={{fontSize:18,flexShrink:0}}>📞</span>
//               {isDealDone
//                 ? <span style={{fontSize:14,fontWeight:700,color:"#111"}}>{phone || "Not provided"}</span>
//                 : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>+91 XXXXXXXXXX</span>}
//             </div>
//             <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
//               <span style={{fontSize:18,flexShrink:0}}>📸</span>
//               {isDealDone
//                 ? (platform
//                     ? <a href={platform.startsWith("http") ? platform : `https://instagram.com/${platform.replace("@","")}`} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:700,color:"#4f46e5",textDecoration:"none"}}>
//                         {platform.includes("instagram.com/") ? "@"+platform.split("instagram.com/")[1]?.replace("/","") : platform.startsWith("@") ? platform : "@"+platform}
//                       </a>
//                     : <span style={{fontSize:14,color:"#aaa"}}>Not provided</span>)
//                 : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>instagram.com/XXXXXX</span>}
//             </div>
//             {isDealDone
//               ? <div style={{textAlign:"center",fontSize:12,color:"#16a34a",fontWeight:700,padding:"6px 0"}}>✅ Deal completed — full contact details visible</div>
//               : <div style={{textAlign:"center",fontSize:12,color:"#f59e0b",fontWeight:600,padding:"6px 0",background:"#fefce8",borderRadius:8}}>🔒 Complete the deal to reveal phone & Instagram</div>}
//           </div>
//         </div>

//         {profile?.bio && (
//           <div className="cp-card">
//             <span className="cp-sec-label">About</span>
//             <p className="cp-bio">{profile.bio}</p>
//           </div>
//         )}

//         {bidAmount > 0 && (
//           <div className="cp-card">
//             <span className="cp-sec-label">Bid Amount</span>
//             <div className="cp-bid-box">
//               <div className="cp-bid-amount">₹{Number(bidAmount).toLocaleString("en-IN")}</div>
//               <div className="cp-bid-fee">Creator receives ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString("en-IN")} after 10% platform fee</div>
//             </div>
//           </div>
//         )}

//         {proposal && (
//           <div className="cp-card">
//             <span className="cp-sec-label">{app?.proposal || app?.note ? "📝 Proposal" : "👤 About Creator"}</span>
//             <p className="cp-proposal">{proposal}</p>
//           </div>
//         )}

//         {isBrand && (
//           <div className="cp-card">
//             <div className="cp-actions">
//               {/* ✅ Deal done — show "Deal Done" instead of Accept/Reject */}
//               {isDealDone ? (
//                 <>
//                   <div className="cp-btn cp-btn-done" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
//                     ✅ Deal Done
//                   </div>
//                   <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
//                 </>
//               ) : decision === "accepted" ? (
//                 <>
//                   <div className="cp-btn cp-btn-accepted" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700}}>✓ Accepted</div>
//                   <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
//                 </>
//               ) : decision === "rejected" ? (
//                 <div className="cp-btn cp-btn-rejected" style={{flex:1,padding:14,borderRadius:14,textAlign:"center",fontSize:15,fontWeight:700}}>✗ Rejected</div>
//               ) : (
//                 <>
//                   <button className="cp-btn cp-btn-accept" disabled={acting} onClick={() => handleDecision("accepted")}>{acting ? "..." : "✓ Accept"}</button>
//                   <button className="cp-btn cp-btn-reject" disabled={acting} onClick={() => handleDecision("rejected")}>{acting ? "..." : "✗ Reject"}</button>
//                 </>
//               )}
//             </div>
//           </div>
//         )}
//       </div>
//     </>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import { useParams, useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function CreatorProfilePage() {
//   const params    = useParams();
//   const pathParts = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
//   const creatorIdx = pathParts.indexOf("creator");
//   const id        = ((creatorIdx !== -1 ? pathParts[creatorIdx + 1] : "") || (params?.creatorId as string) || "") as string;
//   const router    = useRouter();

//   const [appId, setAppId]             = useState<string>("");
//   const [profile, setProfile]         = useState<any>(null);
//   const [app, setApp]                 = useState<any>(null);
//   const [campaign, setCampaign]       = useState<any>(null);
//   const [loading, setLoading]         = useState(true);
//   const [token, setToken]             = useState("");
//   const [isBrand, setIsBrand]         = useState(false);
//   const [isDealDone, setIsDealDone]   = useState(false);
//   const [decision, setDecision]       = useState<"accepted" | "rejected" | "">("");
//   const [acting, setActing]           = useState(false);
//   const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     setToken(parsed.token);
//     setIsBrand(parsed.role === "brand");

//     const urlParams    = new URLSearchParams(window.location.search);
//     const qAppId       = urlParams.get("appId") || "";
//     const campFromPath = pathParts.length > 2 ? pathParts[pathParts.indexOf("campaigns") + 1] : "";
//     const qCampaignId  = urlParams.get("campaignId") || campFromPath || (params?.id as string) || "";
//     setAppId(qAppId);

//     const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     if (qAppId && saved[qAppId]) setDecision(saved[qAppId]);

//     fetchAll(parsed.token, qAppId, qCampaignId);
//   }, [id]);

//   const fetchAll = async (tok: string, qAppId: string, qCampaignId: string) => {
//     try {
//       setLoading(true);

//       // Fetch profile
//       const res  = await fetch(`${API}/profile/user/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
//       const data = await res.json();
//       setProfile(data?.profile || data?.data || (data?._id ? data : null));

//       // Fetch campaign
//       if (qCampaignId) {
//         try {
//           const cr = await fetch(`${API}/campaigns/${qCampaignId}`, { headers: { Authorization: `Bearer ${tok}` } });
//           if (cr.ok) { const cd = await cr.json(); setCampaign(cd?.campaign || cd?.data || cd); }
//         } catch { /* silent */ }
//       }

//       // Fetch application
//       if (qCampaignId) {
//         try {
//           const ar    = await fetch(`${API}/campaigns/${qCampaignId}/applications`, { headers: { Authorization: `Bearer ${tok}` } });
//           if (ar.ok) {
//             const ad   = await ar.json();
//             const apps = ad?.applications || ad?.data || [];
//             const found = qAppId
//               ? apps.find((a: any) => a._id === qAppId)
//               : apps.find((a: any) => (a?.influencerId?._id || a?.influencer?._id || a?.userId) === id);
//             if (found) setApp(found);
//           }
//         } catch { /* silent */ }
//       }

//       // Check if deal is done for this application
//       if (qAppId) {
//         try {
//           const dr    = await fetch(`${API}/deals`, { headers: { Authorization: `Bearer ${tok}` } });
//           if (dr.ok) {
//             const dd    = await dr.json();
//             const deals = dd?.deals || dd?.data || [];
//             const done  = deals.some((deal: any) => {
//               const status = (deal.status || "").toLowerCase();
//               return (
//                 (status === "completed" || status === "done" || status === "finished") &&
//                 (deal.applicationId === qAppId || String(deal.applicationId) === qAppId)
//               );
//             });
//             setIsDealDone(done);
//           }
//         } catch { /* silent */ }
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDecision = async (dec: "accepted" | "rejected") => {
//     const currentAppId = appId || new URLSearchParams(window.location.search).get("appId") || "";
//     if (!currentAppId) { showToast("Application ID missing", "error"); return; }
//     try {
//       setActing(true);
//       await fetch(`${API}/application/${currentAppId}/decision`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ decision: dec }),
//       });
//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user:    String(id),
//           message: dec === "accepted" ? "Your application has been accepted! 🎉" : "Your application was not selected this time. Keep applying! 💪",
//           type:    "application_accepted",
//           link:    dec === "accepted" ? "/campaigns" : "/discovery",
//           applicationId: appId,
//         }),
//       });
//       if (dec === "accepted") {
//         try {
//           const convRes  = await fetch(`${API}/conversations/start`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ participantId: id }) });
//           const convData = await convRes.json();
//           const convId   = convData?.conversation?._id || convData?._id;
//           if (convId) {
//             await fetch(`${API}/conversations/send/${convId}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }) });
//           }
//         } catch { /* silent */ }
//       }
//       setDecision(dec);
//       const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       saved[currentAppId] = dec;
//       localStorage.setItem("decidedApplications", JSON.stringify(saved));
//       showToast(dec === "accepted" ? "Application accepted ✓" : "Application rejected", dec === "accepted" ? "success" : "error");
//     } catch {
//       showToast("Action failed. Try again.", "error");
//     } finally {
//       setActing(false);
//     }
//   };

//   const followers = () => {
//     const f = profile?.followers;
//     if (!f && f !== 0) return "N/A";
//     const n = Number(f);
//     if (!isNaN(n) && n >= 1000) return (n / 1000).toFixed(1) + "K";
//     return String(f);
//   };

//   if (loading) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
//       <div style={{ width: 36, height: 36, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!profile) return (
//     <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 48 }}>👤</div>
//       <h2 style={{ fontFamily: "Plus Jakarta Sans,sans-serif", color: "#111" }}>Profile not found</h2>
//       <button onClick={() => router.back()} style={{ padding: "10px 24px", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const bidAmount  = app?.bidAmount || app?.bid || campaign?.budget || 0;
//   const proposal   = app?.proposal || app?.note || app?.message || app?.coverLetter || "";
//   const categories = Array.isArray(profile?.categories) ? profile.categories.join(", ") : profile?.categories || "N/A";
//   const phone      = profile?.phone || "";
//   const platform   = profile?.instagram || profile?.platform || "";
//   const fullName   = profile?.name || "Creator";
//   const nameParts  = fullName.trim().split(" ");
//   const firstName  = nameParts[0] || "";
//   const lastName   = nameParts.slice(1).join(" ");

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }
//         .cp-wrap  { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .cp-bar   { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
//         .cp-back  { background: none; border: 1.5px solid #ebebeb; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; color: #555; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
//         .cp-back:hover { background: #f4f4f4; }
//         .cp-bar-title { font-size: 15px; font-weight: 700; color: #111; }
//         .cp-hero  { position: relative; background: linear-gradient(135deg, #e0e0ff 0%, #f0e0ff 100%); border-radius: 0 0 28px 28px; overflow: hidden; height: 260px; margin-bottom: -60px; }
//         .cp-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
//         .cp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%); }
//         .cp-avatar-wrap { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: 12px; }
//         .cp-avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; }
//         .cp-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
//         .cp-card  { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 22px; margin-bottom: 14px; animation: fadeUp 0.35s ease both; }
//         .cp-name  { font-size: 26px; font-weight: 800; color: #111; text-align: center; margin-bottom: 5px; }
//         .cp-loc   { font-size: 13px; color: #aaa; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 18px; }
//         .cp-sec-label { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; display: block; }
//         .cp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
//         .cp-item  { background: #f9f9f8; border-radius: 12px; padding: 12px 14px; border: 1px solid #f0f0f0; }
//         .cp-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .cp-item-val   { font-size: 14px; font-weight: 700; color: #111; }
//         .cp-bio   { font-size: 14px; color: #555; line-height: 1.75; }
//         .cp-bid-box { background: linear-gradient(135deg, #eef2ff, #ede9fe); border: 1.5px solid #c7d2fe; border-radius: 16px; padding: 18px 20px; }
//         .cp-bid-amount { font-size: 32px; font-weight: 800; color: #4f46e5; }
//         .cp-bid-fee { font-size: 12px; color: #818cf8; margin-top: 2px; }
//         .cp-proposal { font-size: 14px; color: #444; line-height: 1.8; background: #f9f9f8; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; }

//         /* Deal done — contact revealed */
//         .cp-contact-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 14px; padding: 16px 18px; margin-bottom: 14px; }
//         .cp-contact-title { font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
//         .cp-contact-row { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #111; font-weight: 600; padding: 6px 0; border-bottom: 1px solid #dcfce7; }
//         .cp-contact-row:last-child { border-bottom: none; padding-bottom: 0; }
//         .cp-contact-row a { color: #4f46e5; text-decoration: none; }
//         .cp-contact-row a:hover { text-decoration: underline; }

//         /* Deal pending — contact locked */
//         .cp-contact-locked { background: #fefce8; border: 1.5px solid #fde68a; border-radius: 14px; padding: 14px 18px; margin-bottom: 14px; display: flex; align-items: flex-start; gap: 10px; }
//         .cp-contact-locked-text { font-size: 13px; color: #92400e; font-weight: 500; line-height: 1.5; }
//         .cp-contact-locked-text strong { font-weight: 700; }

//         .cp-actions { display: flex; gap: 10px; }
//         .cp-btn { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .cp-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
//         .cp-btn-accept:hover:not(:disabled) { transform: translateY(-1px); }
//         .cp-btn-reject { background: #fee2e2; color: #b91c1c; }
//         .cp-btn-reject:hover:not(:disabled) { background: #fecaca; }
//         .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
//         .cp-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
//         .cp-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
//         .cp-btn-msg { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.2); transition: all 0.2s; }
//         .cp-btn-msg:hover { transform: translateY(-1px); }
//         .cp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .cp-toast.success { background: #111; color: #fff; }
//         .cp-toast.error   { background: #ef4444; color: #fff; }
//         @media(max-width:500px) { .cp-grid { grid-template-columns: 1fr; } .cp-bid-amount { font-size: 26px; } .cp-name { font-size: 22px; } }
//       `}</style>

//       {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cp-bar">
//         <button className="cp-back" onClick={() => router.back()}>←</button>
//         <span className="cp-bar-title">Creator Profile</span>
//       </div>

//       <div className="cp-hero">
//         {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : null}
//         <div className="cp-hero-overlay" />
//       </div>

//       <div className="cp-wrap">

//         {/* Avatar + basic info */}
//         <div className="cp-card" style={{ marginTop: 0, paddingTop: 28 }}>
//           <div className="cp-avatar-wrap">
//             <div className="cp-avatar">
//               {profile?.profileImage ? <img src={profile.profileImage} alt={profile?.name} /> : "👤"}
//             </div>
//           </div>
//           <div className="cp-name">
//             {isDealDone ? fullName : (
//               <>{firstName}{lastName && <> <span style={{filter:"blur(6px)",userSelect:"none",display:"inline-block"}}>{lastName}</span></>}</>
//             )}
//           </div>
//           <div className="cp-loc">📍 {profile?.location || profile?.city || "N/A"}</div>
//           <span className="cp-sec-label">Profile Details</span>
//           <div className="cp-grid">
//             <div className="cp-item">
//               <div className="cp-item-label">Followers</div>
//               <div className="cp-item-val">{followers()}</div>
//             </div>
//             <div className="cp-item">
//               <div className="cp-item-label">Category</div>
//               <div className="cp-item-val" style={{ fontSize: 13 }}>{categories}</div>
//             </div>
//           </div>
//         </div>

//         {/* Contact info */}
//         <div className="cp-card">
//           <span className="cp-sec-label">Contact Details</span>
//           <div style={{display:"flex",flexDirection:"column",gap:10}}>
//             {/* Phone */}
//             <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
//               <span style={{fontSize:18,flexShrink:0}}>📞</span>
//               {isDealDone
//                 ? <span style={{fontSize:14,fontWeight:700,color:"#111"}}>{phone || "Not provided"}</span>
//                 : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>+91 XXXXXXXXXX</span>
//               }
//             </div>
//             {/* Instagram */}
//             <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#f9f9f8",borderRadius:12,border:"1px solid #f0f0f0"}}>
//               <span style={{fontSize:18,flexShrink:0}}>📸</span>
//               {isDealDone
//                 ? (platform
//                     ? <a href={platform.startsWith("http") ? platform : `https://instagram.com/${platform.replace("@","")}`} target="_blank" rel="noreferrer" style={{fontSize:14,fontWeight:700,color:"#4f46e5",textDecoration:"none"}}>
//                         {platform.includes("instagram.com/") ? "@"+platform.split("instagram.com/")[1]?.replace("/","") : platform.startsWith("@") ? platform : "@"+platform}
//                       </a>
//                     : <span style={{fontSize:14,color:"#aaa"}}>Not provided</span>)
//                 : <span style={{fontSize:14,fontWeight:600,color:"#bbb",letterSpacing:"0.05em"}}>instagram.com/XXXXXX</span>
//               }
//             </div>
//             {/* Status note */}
//             {isDealDone
//               ? <div style={{textAlign:"center",fontSize:12,color:"#16a34a",fontWeight:700,padding:"6px 0"}}>✅ Deal completed — full contact details visible</div>
//               : <div style={{textAlign:"center",fontSize:12,color:"#f59e0b",fontWeight:600,padding:"6px 0",background:"#fefce8",borderRadius:8}}>🔒 Complete the deal to reveal phone & Instagram</div>
//             }
//           </div>
//         </div>

//         {/* Bio */}
//         {profile?.bio && (
//           <div className="cp-card">
//             <span className="cp-sec-label">About</span>
//             <p className="cp-bio">{profile.bio}</p>
//           </div>
//         )}

//         {/* Bid */}
//         {bidAmount > 0 && (
//           <div className="cp-card">
//             <span className="cp-sec-label">Bid Amount</span>
//             <div className="cp-bid-box">
//               <div className="cp-bid-amount">₹{Number(bidAmount).toLocaleString("en-IN")}</div>
//               <div className="cp-bid-fee">Creator receives ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString("en-IN")} after 10% platform fee</div>
//             </div>
//           </div>
//         )}

//         {/* Proposal */}
//         {proposal && (
//           <div className="cp-card">
//             <span className="cp-sec-label">{app?.proposal || app?.note ? "📝 Proposal" : "👤 About Creator"}</span>
//             <p className="cp-proposal">{proposal}</p>
//           </div>
//         )}

//         {/* Action buttons */}
//         {isBrand && (
//           <div className="cp-card">
//             <div className="cp-actions">
//               {decision === "accepted" ? (
//                 <>
//                   <div className="cp-btn cp-btn-accepted" style={{ flex: 1, padding: 14, borderRadius: 14, textAlign: "center", fontSize: 15, fontWeight: 700 }}>✓ Accepted</div>
//                   <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
//                 </>
//               ) : decision === "rejected" ? (
//                 <div className="cp-btn cp-btn-rejected" style={{ flex: 1, padding: 14, borderRadius: 14, textAlign: "center", fontSize: 15, fontWeight: 700 }}>✗ Rejected</div>
//               ) : (
//                 <>
//                   <button className="cp-btn cp-btn-accept" disabled={acting} onClick={() => handleDecision("accepted")}>{acting ? "..." : "✓ Accept"}</button>
//                   <button className="cp-btn cp-btn-reject" disabled={acting} onClick={() => handleDecision("rejected")}>{acting ? "..." : "✗ Reject"}</button>
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//       </div>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import { useParams, useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function CreatorProfilePage() {
//   const params     = useParams();
//   // Extract creatorId from URL: /campaigns/[campaignId]/applications/creator/[creatorId]
//   const pathParts  = typeof window !== "undefined" ? window.location.pathname.split("/") : [];
//   const creatorIdx = pathParts.indexOf("creator");
//   const id         = ((creatorIdx !== -1 ? pathParts[creatorIdx + 1] : "") || (params?.creatorId as string) || "") as string;
//   const router     = useRouter();
//   const [appId, setAppId] = useState<string>("");

//   const [profile,   setProfile]   = useState<any>(null);
//   const [app,       setApp]       = useState<any>(null);   // application data (bid, proposal)
//   const [campaign,  setCampaign]  = useState<any>(null);  // campaign data (budget)
//   const [loading,   setLoading]   = useState(true);
//   const [token,     setToken]     = useState("");
//   const [isBrand,   setIsBrand]   = useState(false);
//   const [isSubscribed, setIsSubscribed] = useState(false);
//   const [decision,  setDecision]  = useState<"accepted"|"rejected"|"">("");
//   const [acting,    setActing]    = useState(false);
//   const [toast,     setToast]     = useState<{msg:string;type:"success"|"error"}|null>(null);

//   const showToast = (msg: string, type: "success"|"error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     setToken(parsed.token);
//     setIsBrand(parsed.role === "brand");
//     setIsSubscribed(parsed.isSubscribed ?? false);

//     // Get appId and campaignId from query string
//     const urlParams = new URLSearchParams(window.location.search);
//     const qAppId = urlParams.get("appId") || "";
//     // campaignId: query param se, ya URL path se (campaigns/[id]/applications...)
//     const campFromPath = pathParts.length > 2 ? pathParts[pathParts.indexOf("campaigns") + 1] : "";
//     const qCampaignId = urlParams.get("campaignId") || campFromPath || (params?.id as string) || "";
//     setAppId(qAppId);

//     // Check if already decided
//     const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     if (qAppId && saved[qAppId]) setDecision(saved[qAppId]);

//     fetchProfile(parsed.token, qAppId, qCampaignId);
//   }, [id]);

//   const fetchProfile = async (tok: string, appId: string|null, campaignId: string|null) => {
//     try {
//       setLoading(true);
//       console.log("🔍 path:", window.location.pathname, "| creatorId:", id, "| campaignId:", campaignId, "| appId:", appId);
//       // Fetch profile
//       const res  = await fetch(`${API}/profile/user/${id}`, {
//         headers: { Authorization: `Bearer ${tok}` },
//       });
//       const data = await res.json();
//       const p = data?.profile || data?.data || (data?._id ? data : null);
//       setProfile(p);

//       // ✅ Fetch campaign data (budget)
//       if (campaignId) {
//         try {
//           const campRes = await fetch(`${API}/campaigns/${campaignId}`, {
//             headers: { Authorization: `Bearer ${tok}` },
//           });
//           if (campRes.ok) {
//             const cd = await campRes.json();
//             setCampaign(cd?.campaign || cd?.data || cd);
//           }
//         } catch { /* silent */ }
//       }

//       // ✅ Fetch application from campaign applications list
//       if (campaignId) {
//         try {
//           const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//             headers: { Authorization: `Bearer ${tok}` },
//           });
//           if (appRes.ok) {
//             const appData = await appRes.json();
//             const apps = appData?.applications || appData?.data || [];
//             // Match by appId or by influencerId
//             const found = appId
//               ? apps.find((a: any) => a._id === appId)
//               : apps.find((a: any) =>
//                   (a?.influencerId?._id || a?.influencer?._id || a?.userId) === id
//                 );
//             if (found) {
//               console.log("✅ App found:", found);
//               setApp(found);
//             } else {
//               console.log("❌ App not found. appId:", appId, "apps:", apps.map((a:any) => a._id));
//             }
//           }
//         } catch (e) { console.error("App fetch error:", e); }
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleDecision = async (dec: "accepted"|"rejected") => {
//     const currentAppId = appId || new URLSearchParams(window.location.search).get("appId") || "";
//     if (!currentAppId) { showToast("Application ID missing", "error"); return; }

//     try {
//       setActing(true);
//       const res = await fetch(`${API}/application/${currentAppId}/decision`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ decision: dec }),
//       });

//       // Send notification to creator
//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user: String(id),
//           message: dec === "accepted"
//             ? `Your application has been accepted! 🎉`
//             : `Your application was not selected this time. Keep applying! 💪`,
//           type: "application_accepted",
//           status: dec === "rejected" ? "rejected" : undefined,
//           link: dec === "accepted" ? `/campaigns` : `/discovery`,
//           applicationId: appId,
//         }),
//       });

//       // If accepted — send chat message
//       if (dec === "accepted") {
//         try {
//           const convRes = await fetch(`${API}/conversations/start`, {
//             method: "POST",
//             headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//             body: JSON.stringify({ participantId: id }),
//           });
//           const convData = await convRes.json();
//           const convId = convData?.conversation?._id || convData?._id;
//           if (convId) {
//             await fetch(`${API}/conversations/send/${convId}`, {
//               method: "POST",
//               headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//               body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
//             });
//           }
//         } catch { /* silent */ }
//       }

//       setDecision(dec);
//       const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       saved[currentAppId] = dec;
//       localStorage.setItem("decidedApplications", JSON.stringify(saved));
//       showToast(dec === "accepted" ? "Application accepted ✓" : "Application rejected", dec === "accepted" ? "success" : "error");
//     } catch (err) {
//       showToast("Action failed. Try again.", "error");
//     } finally {
//       setActing(false);
//     }
//   };

//   const followers = () => {
//     const f = profile?.followers;
//     if (!f && f !== 0) return "N/A";
//     const n = Number(f);
//     if (!isNaN(n) && n >= 1000) return (n/1000).toFixed(1) + "K";
//     return String(f);
//   };

//   if (loading) return (
//     <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", flexDirection:"column", gap:16 }}>
//       <div style={{ width:36, height:36, border:"3px solid #e0e0e0", borderTopColor:"#4f46e5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
//       <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//     </div>
//   );

//   if (!profile) return (
//     <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", flexDirection:"column", gap:16 }}>
//       <div style={{ fontSize:48 }}>👤</div>
//       <h2 style={{ fontFamily:"Plus Jakarta Sans,sans-serif", color:"#111" }}>Profile not found</h2>
//       <button onClick={() => router.back()} style={{ padding:"10px 24px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontFamily:"Plus Jakarta Sans,sans-serif" }}>Go Back</button>
//     </div>
//   );

//   const bidAmount = app?.bidAmount || app?.bid || campaign?.budget || campaign?.maxBudget || 0;
//   const proposal  = app?.proposal  || app?.note || app?.message || app?.coverLetter || profile?.bio || "";
//   const categories = Array.isArray(profile?.categories) ? profile.categories.join(", ") : profile?.categories || "N/A";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }

//         .cp-wrap  { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-family: 'Plus Jakarta Sans', sans-serif; }

//         /* TOP BAR */
//         .cp-bar   { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
//         .cp-back  { background: none; border: 1.5px solid #ebebeb; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; color: #555; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
//         .cp-back:hover { background: #f4f4f4; }
//         .cp-bar-title { font-size: 15px; font-weight: 700; color: #111; }

//         /* HERO */
//         .cp-hero  { position: relative; background: linear-gradient(135deg, #e0e0ff 0%, #f0e0ff 100%); border-radius: 0 0 28px 28px; overflow: hidden; height: 260px; margin-bottom: -60px; }
//         .cp-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
//         .cp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%); }

//         /* AVATAR */
//         .cp-avatar-wrap { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: 12px; }
//         .cp-avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; }
//         .cp-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }

//         /* CARD */
//         .cp-card  { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 22px; margin-bottom: 14px; animation: fadeUp 0.35s ease both; }
//         .cp-card:nth-child(2) { animation-delay: 0.05s; }
//         .cp-card:nth-child(3) { animation-delay: 0.10s; }
//         .cp-card:nth-child(4) { animation-delay: 0.15s; }

//         .cp-name  { font-size: 26px; font-weight: 800; color: #111; text-align: center; margin-bottom: 5px; }
//         .cp-loc   { font-size: 13px; color: #aaa; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 18px; }

//         .cp-sec-label { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; display: block; }
//         .cp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
//         .cp-item  { background: #f9f9f8; border-radius: 12px; padding: 12px 14px; border: 1px solid #f0f0f0; }
//         .cp-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
//         .cp-item-val   { font-size: 14px; font-weight: 700; color: #111; }
//         .cp-item-val.locked { color: #aaa; font-size: 13px; }
//         .cp-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
//         .cp-item.highlight .cp-item-label { color: #6366f1; }
//         .cp-item.highlight .cp-item-val   { color: #4f46e5; }

//         .cp-bio   { font-size: 14px; color: #555; line-height: 1.75; }

//         /* BID */
//         .cp-bid-box { background: linear-gradient(135deg, #eef2ff, #ede9fe); border: 1.5px solid #c7d2fe; border-radius: 16px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
//         .cp-bid-label { font-size: 12px; color: "#6366f1"; font-weight: 600; margin-bottom: 4px; }
//         .cp-bid-amount { font-size: 32px; font-weight: 800; color: #4f46e5; }
//         .cp-bid-fee { font-size: 12px; color: #818cf8; margin-top: 2px; }

//         /* PROPOSAL */
//         .cp-proposal { font-size: 14px; color: #444; line-height: 1.8; background: #f9f9f8; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; }

//         /* SUBSCRIBE BANNER */
//         .cp-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
//         .cp-lock-text   { font-size: 13px; color: #92400e; font-weight: 500; flex: 1; }
//         .cp-upgrade-btn { padding: 9px 18px; background: #f59e0b; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; white-space: nowrap; }

//         /* DECISION BUTTONS */
//         .cp-actions { display: flex; gap: 10px; }
//         .cp-btn { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .cp-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
//         .cp-btn-accept:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.35); }
//         .cp-btn-reject { background: #fee2e2; color: #b91c1c; }
//         .cp-btn-reject:hover:not(:disabled) { background: #fecaca; }
//         .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
//         .cp-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
//         .cp-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
//         .cp-btn-msg { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.2); transition: all 0.2s; }
//         .cp-btn-msg:hover { transform: translateY(-1px); }

//         .cp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .cp-toast.success { background: #111; color: #fff; }
//         .cp-toast.error   { background: #ef4444; color: #fff; }

//         @media(max-width:500px) {
//           .cp-grid { grid-template-columns: 1fr; }
//           .cp-bid-amount { font-size: 26px; }
//           .cp-name { font-size: 22px; }
//         }
//       `}</style>

//       {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* TOP BAR */}
//       <div className="cp-bar">
//         <button className="cp-back" onClick={() => router.back()}>←</button>
//         <span className="cp-bar-title">Creator Profile</span>
//       </div>

//       {/* HERO IMAGE */}
//       <div className="cp-hero">
//         {profile?.profileImage
//           ? <img src={profile.profileImage} alt={profile?.name} />
//           : null}
//         <div className="cp-hero-overlay" />
//       </div>

//       <div className="cp-wrap">

//         {/* AVATAR + NAME */}
//         <div className="cp-card" style={{ marginTop: 0, paddingTop: 28 }}>
//           <div className="cp-avatar-wrap">
//             <div className="cp-avatar">
//               {profile?.profileImage
//                 ? <img src={profile.profileImage} alt={profile?.name} />
//                 : "👤"}
//             </div>
//           </div>
//           <div className="cp-name">{profile?.name || "Creator"}</div>
//           <div className="cp-loc">📍 {profile?.location || profile?.city || "N/A"}</div>

//           {/* PROFILE STATS */}
//           <span className="cp-sec-label">Profile Details</span>
//           <div className="cp-grid">
//             <div className="cp-item">
//               <div className="cp-item-label">Followers</div>
//               <div className="cp-item-val">{followers()}</div>
//             </div>
//             <div className="cp-item">
//               <div className="cp-item-label">Category</div>
//               <div className="cp-item-val" style={{ fontSize: 13 }}>{categories}</div>
//             </div>
//             <div className="cp-item">
//               <div className="cp-item-label">📞 Phone</div>
//               <div className={`cp-item-val ${!isSubscribed ? "locked" : ""}`}>
//                 {isSubscribed
//                   ? (profile?.phone || "N/A")
//                   : "🔒 Subscribe"}
//               </div>
//             </div>
//             <div className="cp-item">
//               <div className="cp-item-label">🔗 Instagram</div>
//               <div className={`cp-item-val ${!isSubscribed ? "locked" : ""}`}>
//                 {isSubscribed
//                   ? (() => {
//                       const raw = profile?.instagram || profile?.platform || "";
//                       if (!raw) return <span style={{color:"#999"}}>N/A</span>;
//                       // Extract username from URL or use as-is
//                       const username = raw.includes("instagram.com/")
//                         ? "@" + raw.split("instagram.com/")[1]?.split("?")[0]?.replace("/","")
//                         : raw.startsWith("@") ? raw : "@" + raw;
//                       return <a href={raw.startsWith("http") ? raw : `https://instagram.com/${raw.replace("@","")}`} target="_blank" rel="noreferrer" style={{ color:"#4f46e5", textDecoration:"none", fontSize:13, fontWeight:600 }}>{username}</a>;
//                     })()
//                   : <span style={{ filter:"blur(5px)", userSelect:"none", fontSize:12 }}>@instagram_hidden</span>
//                 }
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* SUBSCRIBE BANNER */}
//         {!isSubscribed && (
//           <div className="cp-lock-banner" style={{ marginBottom: 14 }}>
//             <span style={{ fontSize: 22 }}>🔒</span>
//             <span className="cp-lock-text">Subscribe to unlock phone & Instagram details</span>
//             <button className="cp-upgrade-btn" onClick={() => router.push("/upgrade")}>Upgrade →</button>
//           </div>
//         )}

//         {/* BIO */}
//         {profile?.bio && (
//           <div className="cp-card">
//             <span className="cp-sec-label">About</span>
//             <p className="cp-bio">{profile.bio}</p>
//           </div>
//         )}

//         {/* BID AMOUNT */}
//         {(bidAmount > 0 || campaign?.budget) && (
//           <div className="cp-card">
//             <span className="cp-sec-label">Bid Amount</span>
//             <div className="cp-bid-box">
//               <div>
//                 <div className="cp-bid-label">💰 Creator's Bid</div>
//                 <div className="cp-bid-amount">₹{Number(bidAmount).toLocaleString("en-IN")}</div>
//                 <div className="cp-bid-fee">Creator receives ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString("en-IN")} after 10% platform fee</div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* PROPOSAL / BIO */}
//         {proposal && (
//           <div className="cp-card">
//             <span className="cp-sec-label">{app?.proposal || app?.note ? "📝 Proposal" : "👤 About Creator"}</span>
//             <p className="cp-proposal">{proposal}</p>
//           </div>
//         )}

//         {/* ACTION BUTTONS - brand only */}
//         {isBrand && (
//           <div className="cp-card">
//             <div className="cp-actions">
//               {decision === "accepted" ? (
//                 <>
//                   <div className="cp-btn cp-btn-accepted" style={{ flex:1, padding:14, borderRadius:14, textAlign:"center", fontSize:15, fontWeight:700 }}>✓ Accepted</div>
//                   <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
//                 </>
//               ) : decision === "rejected" ? (
//                 <div className="cp-btn cp-btn-rejected" style={{ flex:1, padding:14, borderRadius:14, textAlign:"center", fontSize:15, fontWeight:700 }}>✗ Rejected</div>
//               ) : (
//                 <>
//                   <button className="cp-btn cp-btn-accept" disabled={acting} onClick={() => handleDecision("accepted")}>
//                     {acting ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="cp-btn cp-btn-reject" disabled={acting} onClick={() => handleDecision("rejected")}>
//                     {acting ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//       </div>
//     </>
//   );
// }