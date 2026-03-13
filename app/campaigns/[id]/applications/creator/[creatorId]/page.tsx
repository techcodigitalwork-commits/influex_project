"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function CreatorProfilePage() {
  const params     = useParams();
  const id         = params?.creatorId as string;  // influencer user ID
  const campaignId = params?.id as string;          // campaign ID from URL
  const router     = useRouter();
  const [appId, setAppId] = useState<string>("");

  const [profile,   setProfile]   = useState<any>(null);
  const [app,       setApp]       = useState<any>(null);   // application data (bid, proposal)
  const [loading,   setLoading]   = useState(true);
  const [token,     setToken]     = useState("");
  const [isBrand,   setIsBrand]   = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [decision,  setDecision]  = useState<"accepted"|"rejected"|"">("");
  const [acting,    setActing]    = useState(false);
  const [toast,     setToast]     = useState<{msg:string;type:"success"|"error"}|null>(null);

  const showToast = (msg: string, type: "success"|"error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    setToken(parsed.token);
    setIsBrand(parsed.role === "brand");
    setIsSubscribed(parsed.isSubscribed ?? false);

    // Get appId from query string
    const urlParams = new URLSearchParams(window.location.search);
    const qAppId = urlParams.get("appId") || "";
    setAppId(qAppId);

    // Check if already decided
    const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
    if (qAppId && saved[qAppId]) setDecision(saved[qAppId]);

    fetchProfile(parsed.token, qAppId, campaignId);
  }, [id]);

  const fetchProfile = async (tok: string, appId: string|null, campaignId: string|null) => {
    try {
      setLoading(true);
      // Fetch profile
      const res  = await fetch(`${API}/profile/user/${id}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      const p = data?.profile || data?.data || (data?._id ? data : null);
      setProfile(p);

      // Fetch application data if appId given
      if (appId) {
        const appRes = await fetch(`${API}/application/${appId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          setApp(appData?.application || appData?.data || appData);
        }
      } else if (campaignId) {
        // Try to find application by campaignId
        const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          const apps = appData?.applications || appData?.data || [];
          const found = apps.find((a: any) =>
            (a?.influencerId?._id || a?.influencer?._id) === id
          );
          if (found) setApp(found);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (dec: "accepted"|"rejected") => {
    const currentAppId = appId || new URLSearchParams(window.location.search).get("appId") || "";
    if (!currentAppId) { showToast("Application ID missing", "error"); return; }

    try {
      setActing(true);
      const res = await fetch(`${API}/application/${currentAppId}/decision`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ decision: dec }),
      });

      // Send notification to creator
      await fetch(`${API}/notification/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user: String(id),
          message: dec === "accepted"
            ? `Your application has been accepted! 🎉`
            : `Your application was not selected this time. Keep applying! 💪`,
          type: "application_accepted",
          status: dec === "rejected" ? "rejected" : undefined,
          link: dec === "accepted" ? `/campaigns` : `/discovery`,
          applicationId: appId,
        }),
      });

      // If accepted — send chat message
      if (dec === "accepted") {
        try {
          const convRes = await fetch(`${API}/conversations/start`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ participantId: id }),
          });
          const convData = await convRes.json();
          const convId = convData?.conversation?._id || convData?._id;
          if (convId) {
            await fetch(`${API}/conversations/send/${convId}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
            });
          }
        } catch { /* silent */ }
      }

      setDecision(dec);
      const saved = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
      saved[currentAppId] = dec;
      localStorage.setItem("decidedApplications", JSON.stringify(saved));
      showToast(dec === "accepted" ? "Application accepted ✓" : "Application rejected", dec === "accepted" ? "success" : "error");
    } catch (err) {
      showToast("Action failed. Try again.", "error");
    } finally {
      setActing(false);
    }
  };

  const followers = () => {
    const f = profile?.followers;
    if (!f && f !== 0) return "N/A";
    const n = Number(f);
    if (!isNaN(n) && n >= 1000) return (n/1000).toFixed(1) + "K";
    return String(f);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", flexDirection:"column", gap:16 }}>
      <div style={{ width:36, height:36, border:"3px solid #e0e0e0", borderTopColor:"#4f46e5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!profile) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", flexDirection:"column", gap:16 }}>
      <div style={{ fontSize:48 }}>👤</div>
      <h2 style={{ fontFamily:"Plus Jakarta Sans,sans-serif", color:"#111" }}>Profile not found</h2>
      <button onClick={() => router.back()} style={{ padding:"10px 24px", background:"#4f46e5", color:"#fff", border:"none", borderRadius:10, cursor:"pointer", fontFamily:"Plus Jakarta Sans,sans-serif" }}>Go Back</button>
    </div>
  );

  const bidAmount = app?.bidAmount || app?.bid || 0;
  const proposal  = app?.proposal  || app?.note || app?.message || app?.coverLetter || "";
  const categories = Array.isArray(profile?.categories) ? profile.categories.join(", ") : profile?.categories || "N/A";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }

        .cp-wrap  { max-width: 720px; margin: 0 auto; padding: 0 20px 60px; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* TOP BAR */
        .cp-bar   { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
        .cp-back  { background: none; border: 1.5px solid #ebebeb; border-radius: 8px; width: 36px; height: 36px; cursor: pointer; font-size: 18px; color: #555; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .cp-back:hover { background: #f4f4f4; }
        .cp-bar-title { font-size: 15px; font-weight: 700; color: #111; }

        /* HERO */
        .cp-hero  { position: relative; background: linear-gradient(135deg, #e0e0ff 0%, #f0e0ff 100%); border-radius: 0 0 28px 28px; overflow: hidden; height: 260px; margin-bottom: -60px; }
        .cp-hero img { width: 100%; height: 100%; object-fit: cover; object-position: center 15%; }
        .cp-hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.35) 100%); }

        /* AVATAR */
        .cp-avatar-wrap { display: flex; justify-content: center; position: relative; z-index: 2; margin-bottom: 12px; }
        .cp-avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: linear-gradient(135deg,#e0e0ff,#f0e0ff); display: flex; align-items: center; justify-content: center; font-size: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.12); overflow: hidden; }
        .cp-avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top; }

        /* CARD */
        .cp-card  { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; padding: 22px; margin-bottom: 14px; animation: fadeUp 0.35s ease both; }
        .cp-card:nth-child(2) { animation-delay: 0.05s; }
        .cp-card:nth-child(3) { animation-delay: 0.10s; }
        .cp-card:nth-child(4) { animation-delay: 0.15s; }

        .cp-name  { font-size: 26px; font-weight: 800; color: #111; text-align: center; margin-bottom: 5px; }
        .cp-loc   { font-size: 13px; color: #aaa; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 18px; }

        .cp-sec-label { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; display: block; }
        .cp-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .cp-item  { background: #f9f9f8; border-radius: 12px; padding: 12px 14px; border: 1px solid #f0f0f0; }
        .cp-item-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 4px; }
        .cp-item-val   { font-size: 14px; font-weight: 700; color: #111; }
        .cp-item-val.locked { color: #aaa; font-size: 13px; }
        .cp-item.highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
        .cp-item.highlight .cp-item-label { color: #6366f1; }
        .cp-item.highlight .cp-item-val   { color: #4f46e5; }

        .cp-bio   { font-size: 14px; color: #555; line-height: 1.75; }

        /* BID */
        .cp-bid-box { background: linear-gradient(135deg, #eef2ff, #ede9fe); border: 1.5px solid #c7d2fe; border-radius: 16px; padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .cp-bid-label { font-size: 12px; color: "#6366f1"; font-weight: 600; margin-bottom: 4px; }
        .cp-bid-amount { font-size: 32px; font-weight: 800; color: #4f46e5; }
        .cp-bid-fee { font-size: 12px; color: #818cf8; margin-top: 2px; }

        /* PROPOSAL */
        .cp-proposal { font-size: 14px; color: #444; line-height: 1.8; background: #f9f9f8; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0; }

        /* SUBSCRIBE BANNER */
        .cp-lock-banner { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 14px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .cp-lock-text   { font-size: 13px; color: #92400e; font-weight: 500; flex: 1; }
        .cp-upgrade-btn { padding: 9px 18px; background: #f59e0b; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; white-space: nowrap; }

        /* DECISION BUTTONS */
        .cp-actions { display: flex; gap: 10px; }
        .cp-btn { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .cp-btn-accept { background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; box-shadow: 0 4px 16px rgba(34,197,94,0.25); }
        .cp-btn-accept:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(34,197,94,0.35); }
        .cp-btn-reject { background: #fee2e2; color: #b91c1c; }
        .cp-btn-reject:hover:not(:disabled) { background: #fecaca; }
        .cp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .cp-btn-accepted { background: #dcfce7; color: #15803d; cursor: default; }
        .cp-btn-rejected { background: #fee2e2; color: #b91c1c; cursor: default; }
        .cp-btn-msg { flex: 1; padding: 14px; border-radius: 14px; font-size: 15px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.2); transition: all 0.2s; }
        .cp-btn-msg:hover { transform: translateY(-1px); }

        .cp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .cp-toast.success { background: #111; color: #fff; }
        .cp-toast.error   { background: #ef4444; color: #fff; }

        @media(max-width:500px) {
          .cp-grid { grid-template-columns: 1fr; }
          .cp-bid-amount { font-size: 26px; }
          .cp-name { font-size: 22px; }
        }
      `}</style>

      {toast && <div className={`cp-toast ${toast.type}`}>{toast.msg}</div>}

      {/* TOP BAR */}
      <div className="cp-bar">
        <button className="cp-back" onClick={() => router.back()}>←</button>
        <span className="cp-bar-title">Creator Profile</span>
      </div>

      {/* HERO IMAGE */}
      <div className="cp-hero">
        {profile?.profileImage
          ? <img src={profile.profileImage} alt={profile?.name} />
          : null}
        <div className="cp-hero-overlay" />
      </div>

      <div className="cp-wrap">

        {/* AVATAR + NAME */}
        <div className="cp-card" style={{ marginTop: 0, paddingTop: 28 }}>
          <div className="cp-avatar-wrap">
            <div className="cp-avatar">
              {profile?.profileImage
                ? <img src={profile.profileImage} alt={profile?.name} />
                : "👤"}
            </div>
          </div>
          <div className="cp-name">{profile?.name || "Creator"}</div>
          <div className="cp-loc">📍 {profile?.location || profile?.city || "N/A"}</div>

          {/* PROFILE STATS */}
          <span className="cp-sec-label">Profile Details</span>
          <div className="cp-grid">
            <div className="cp-item">
              <div className="cp-item-label">Followers</div>
              <div className="cp-item-val">{followers()}</div>
            </div>
            <div className="cp-item">
              <div className="cp-item-label">Category</div>
              <div className="cp-item-val" style={{ fontSize: 13 }}>{categories}</div>
            </div>
            <div className="cp-item">
              <div className="cp-item-label">📞 Phone</div>
              <div className={`cp-item-val ${!isSubscribed ? "locked" : ""}`}>
                {isSubscribed
                  ? (profile?.phone || "N/A")
                  : "🔒 Subscribe"}
              </div>
            </div>
            <div className="cp-item">
              <div className="cp-item-label">🔗 Instagram</div>
              <div className={`cp-item-val ${!isSubscribed ? "locked" : ""}`}>
                {isSubscribed
                  ? (profile?.platform || profile?.instagram
                      ? <a href={profile?.platform || profile?.instagram} target="_blank" rel="noreferrer" style={{ color:"#4f46e5", textDecoration:"none", fontSize:12 }}>{profile?.platform || profile?.instagram}</a>
                      : "N/A")
                  : <span style={{ filter:"blur(5px)", userSelect:"none", fontSize:12 }}>instagram.com/hidden</span>
                }
              </div>
            </div>
          </div>
        </div>

        {/* SUBSCRIBE BANNER */}
        {!isSubscribed && (
          <div className="cp-lock-banner" style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>🔒</span>
            <span className="cp-lock-text">Subscribe to unlock phone & Instagram details</span>
            <button className="cp-upgrade-btn" onClick={() => router.push("/upgrade")}>Upgrade →</button>
          </div>
        )}

        {/* BIO */}
        {profile?.bio && (
          <div className="cp-card">
            <span className="cp-sec-label">About</span>
            <p className="cp-bio">{profile.bio}</p>
          </div>
        )}

        {/* BID AMOUNT */}
        {bidAmount > 0 && (
          <div className="cp-card">
            <span className="cp-sec-label">Bid Amount</span>
            <div className="cp-bid-box">
              <div>
                <div className="cp-bid-label">💰 Creator's Bid</div>
                <div className="cp-bid-amount">₹{Number(bidAmount).toLocaleString("en-IN")}</div>
                <div className="cp-bid-fee">Creator receives ₹{Math.round(Number(bidAmount) * 0.9).toLocaleString("en-IN")} after 10% platform fee</div>
              </div>
            </div>
          </div>
        )}

        {/* PROPOSAL */}
        {proposal && (
          <div className="cp-card">
            <span className="cp-sec-label">Proposal</span>
            <p className="cp-proposal">{proposal}</p>
          </div>
        )}

        {/* ACTION BUTTONS - brand only */}
        {isBrand && (
          <div className="cp-card">
            <div className="cp-actions">
              {decision === "accepted" ? (
                <>
                  <div className="cp-btn cp-btn-accepted" style={{ flex:1, padding:14, borderRadius:14, textAlign:"center", fontSize:15, fontWeight:700 }}>✓ Accepted</div>
                  <button className="cp-btn-msg" onClick={() => router.push(`/messages?userId=${id}`)}>💬 Message</button>
                </>
              ) : decision === "rejected" ? (
                <div className="cp-btn cp-btn-rejected" style={{ flex:1, padding:14, borderRadius:14, textAlign:"center", fontSize:15, fontWeight:700 }}>✗ Rejected</div>
              ) : (
                <>
                  <button className="cp-btn cp-btn-accept" disabled={acting} onClick={() => handleDecision("accepted")}>
                    {acting ? "..." : "✓ Accept"}
                  </button>
                  <button className="cp-btn cp-btn-reject" disabled={acting} onClick={() => handleDecision("rejected")}>
                    {acting ? "..." : "✗ Reject"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}