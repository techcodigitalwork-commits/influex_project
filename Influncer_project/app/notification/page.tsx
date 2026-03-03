"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cb_user");
    if (!stored) { router.push("/login"); return; }
    const parsed = JSON.parse(stored);
    setUser(parsed);
    fetchNotifications(parsed.token);
  }, []);

  const fetchNotifications = async (token: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/notification`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log("NOTIFICATIONS:", data);
      const notifs = data.data || data.notifications || [];

      // localStorage se decided status merge karo
      const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
      const connectDecided = JSON.parse(localStorage.getItem("connectDecisions") || "{}");

      const merged = notifs.map((n: any) => ({
        ...n,
        applicationStatus: decided[n.applicationId] || n.applicationStatus || n.status,
        connectStatus: connectDecided[n._id] || n.connectStatus,
      }));
      setNotifications(merged);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const viewCreatorProfile = async (n: any) => {
    try {
      setProfileLoading(true);
      let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

      if (!creatorId && n.applicationId && n.link) {
        const campaignId = n.link.split("/").pop();
        const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const appData = await appRes.json();
        const apps = appData.applications || appData.data || [];
        const matched = apps.find((a: any) => a._id === n.applicationId);
        creatorId = matched?.influencerId?._id || matched?.influencerId;
      }

      if (!creatorId) { alert("Creator profile not available"); return; }

      let profile: any = null;
      const r1 = await fetch(`${API}/profile/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
      if (r1.ok) {
        const d1 = await r1.json();
        profile = d1.profile || d1.data || d1;
      } else {
        const r2 = await fetch(`${API}/profile/user/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
        const d2 = await r2.json();
        profile = d2.profile || d2.data || d2;
      }

      setSelectedProfile({
        ...profile,
        applicationId: n.applicationId,
        notifId: n._id,
        status: n.applicationStatus || n.status,
        campaignId: n.link?.split("/").pop(),
      });
    } catch (err) {
      console.error(err);
      alert("Could not load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const saveDecidedStatus = (applicationId: string, status: string) => {
    const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
    decided[applicationId] = status;
    localStorage.setItem("decidedApplications", JSON.stringify(decided));
  };

  const saveConnectDecision = (notifId: string, status: string) => {
    const d = JSON.parse(localStorage.getItem("connectDecisions") || "{}");
    d[notifId] = status;
    localStorage.setItem("connectDecisions", JSON.stringify(d));
  };

  // ── Brand: Accept/Reject campaign application ──
const acceptConnect = async (n: any) => {
  try {
    setActionLoading(n._id + "_accept");

    const senderId = n.from?._id || n.fromId || n.senderId || n.from;
    const campaignId = n.campaignId || null;

    if (senderId) {
      await fetch(`${API}/conversations/create`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          participantId: senderId,
          campaignId,
        }),
      });
    }

    saveConnectDecision(n._id, "accepted");
    setNotifications(prev =>
      prev.map(notif =>
        notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
      )
    );
  } catch (err) {
    console.error("Accept connect error:", err);
  } finally {
    setActionLoading("");
  }
};
  // const acceptCreator = async (applicationId: string, notifId: string) => {
  //   try {
  //     setActionLoading(notifId + "_accept");
  //     const res = await fetch(`${API}/application/${applicationId}/decision`, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
  //       body: JSON.stringify({ decision: "accepted" }),
  //     });
  //     const data = await res.json();
  //     if (!res.ok) throw new Error(data.message);
  //     saveDecidedStatus(applicationId, "accepted");
  //     setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
  //     if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
  //   } catch (err: any) {
  //     alert(err.message || "Accept failed");
  //   } finally {
  //     setActionLoading("");
  //   }
  // };

  const rejectCreator = async (applicationId: string, notifId: string) => {
    try {
      setActionLoading(notifId + "_reject");
      const res = await fetch(`${API}/application/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ decision: "rejected" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      saveDecidedStatus(applicationId, "rejected");
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
      if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
    } catch (err: any) {
      alert(err.message || "Reject failed");
    } finally {
      setActionLoading("");
    }
  };

  // ── Creator: Accept connect request from brand ──
  // const acceptConnect = async (n: any) => {
  //   try {
  //     setActionLoading(n._id + "_accept");
  //     const senderId = n.from?._id || n.fromId || n.senderId || n.from;
  //     if (senderId) {
  //       // Create conversation so both can chat
  //       const res = await fetch(`${API}/conversations/create`, {
  //         method: "POST",
  //         headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
  //         body: JSON.stringify({ participantId: senderId }),
  //       });
  //       const data = await res.json();
  //       console.log("Conversation created:", data);
  //     }
  //     saveConnectDecision(n._id, "accepted");
  //     setNotifications(prev => prev.map(notif =>
  //       notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
  //     ));
  //   } catch (err) {
  //     console.error("Accept connect error:", err);
  //     // Still mark accepted locally even if API fails
  //     saveConnectDecision(n._id, "accepted");
  //     setNotifications(prev => prev.map(notif =>
  //       notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
  //     ));
  //   } finally {
  //     setActionLoading("");
  //   }
  // };

  // ── Creator: Decline connect request ──
  const declineConnect = (n: any) => {
    saveConnectDecision(n._id, "rejected");
    setNotifications(prev => prev.map(notif =>
      notif._id === n._id ? { ...notif, connectStatus: "rejected" } : notif
    ));
  };

  const goToMessage = (profile: any) => {
    const creatorUserId = profile.user?._id || profile.user || profile._id;
    const campaignId = profile.campaignId;
    router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${campaignId}`);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // Notification type checkers
  const isApplyNotif = (n: any) =>
    n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

  const isConnectNotif = (n: any) =>
    n.type === "connect_request" || n.type === "connection_request" || n.type === "connect" ||
    // ✅ Brand ke /browse se bheja "new_message" jisme "connect" mention ho
    (n.type === "new_message" && n.message?.toLowerCase().includes("connect"));

  // Creator ko application accept/reject status dikhao
  const isAppDecisionNotif = (n: any) =>
    n.type === "application_accepted" || n.type === "application_rejected" ||
    n.type === "accepted" || n.type === "rejected";

  const getStatus = (n: any) => {
    const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
    return decided[n.applicationId] || n.applicationStatus || n.status || null;
  };

  if (!user) return null;

  const role = user?.role?.toLowerCase();
  const isCreator = role === "influencer" || role === "creator";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
        .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
        .np-title { font-size: 22px; font-weight: 800; color: #111; }
        .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
        .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
        @media(max-width:600px) { .np-body { padding: 0 12px; margin: 16px auto; } .np-header { padding: 16px 20px; } }

        .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; }
        .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
        .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

        .np-card-top { display: flex; gap: 12px; }
        .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
        .np-dot.read { background: #e0e0e0; }
        .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
        .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
        .np-time { font-size: 11px; color: #bbb; }

        .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
        .np-creator-strip:hover { background: #f0f0f0; border-color: #ddd; }
        .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
        .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
        .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
        .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }

        .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
        .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
        .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
        .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
        .np-btn-msg:hover:not(:disabled) { background: #4338ca; }

        .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
        .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }
        .np-status-pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

        /* Connect request card special styling */
        .np-connect-card { margin-top: 12px; border-radius: 14px; overflow: hidden; border: 1.5px solid #e0e7ff; }
        .np-connect-brand { background: linear-gradient(135deg, #eef2ff, #f5f3ff); padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
        .np-connect-brand-av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; overflow: hidden; }
        .np-connect-brand-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .np-connect-brand-name { font-size: 14px; font-weight: 800; color: #111; }
        .np-connect-brand-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
        .np-connect-actions { padding: 12px 16px; background: #fff; display: flex; gap: 8px; }

        .np-decision-banner { margin-top: 12px; padding: 11px 14px; border-radius: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .np-decision-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .np-decision-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

        /* Creator: application result notifications */
        .np-result-banner { margin-top: 12px; padding: 13px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .np-result-accepted { background: linear-gradient(135deg,#f0fdf4,#dcfce7); color: #15803d; border: 1.5px solid #86efac; }
        .np-result-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

        .np-empty { text-align: center; padding: 80px 20px; }
        .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .np-empty-sub { color: #aaa; font-size: 14px; }

        /* PROFILE MODAL */
        .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
        .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
        .pm-close:hover { background: rgba(255,255,255,0.25); }
        .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
        .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
        .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
        .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }
        .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
        .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
        .pm-stat-num { font-size: 17px; font-weight: 800; color: #111; }
        .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
        .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; transition: all 0.2s; }
        .pm-platform:hover { background: #f0f0f0; }
        .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
        .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
        .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }
        .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
        .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .pm-btn-accept { background: #4f46e5; color: #fff; }
        .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
        .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
        .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
        .pm-btn-msg { background: #4f46e5; color: #fff; width: 100%; }
        .pm-btn-msg:hover:not(:disabled) { background: #4338ca; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
      `}</style>

      <div className="np">
        <div className="np-header">
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="np-title">Notifications</span>
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
            )}
          </div>
        </div>

        <div className="np-body">
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <div className="spinner" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="np-empty">
              <div className="np-empty-icon">🔔</div>
              <div className="np-empty-title">No notifications yet</div>
              <div className="np-empty-sub">
                {isCreator
                  ? "When brands connect with you or respond to your applications, you'll see it here"
                  : "When creators apply to your campaigns, you'll see them here"}
              </div>
            </div>
          ) : (
            notifications.map((n) => {
              const isApply    = isApplyNotif(n);
              const isConnect  = isConnectNotif(n);
              const isDecision = isAppDecisionNotif(n);

              const status     = getStatus(n);
              const isAccepted = status === "accepted";
              const isRejected = status === "rejected";
              const isPending  = !isAccepted && !isRejected;

              const connectSt  = n.connectStatus || "pending";

              return (
                <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
                  <div className="np-card-top">
                    <div className={`np-dot ${n.read ? "read" : ""}`} />
                    <div style={{ flex: 1 }}>
                      <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
                      <div className="np-msg">{n.message}</div>
                      <div className="np-time">{timeAgo(n.createdAt)}</div>

                      {/* ── BRAND: Campaign application notification ── */}
                      {isApply && (
                        <div className="np-creator-strip" onClick={() => viewCreatorProfile(n)}>
                          <div className="np-avatar">👤</div>
                          <div style={{ flex: 1 }}>
                            <div className="np-creator-name">View Creator Profile</div>
                            <div className="np-creator-sub">Tap to see full profile</div>
                          </div>
                          {profileLoading ? (
                            <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                          ) : (
                            <span className="np-view">View →</span>
                          )}
                        </div>
                      )}
                      {isApply && !isPending && (
                        <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
                          {isAccepted ? "✓ Accepted" : "✗ Rejected"}
                        </div>
                      )}
                      {isApply && n.applicationId && isPending && (
                        <div className="np-actions">
                          <button className="np-btn np-btn-accept"
                            disabled={actionLoading === n._id + "_accept"}
                            onClick={() => acceptCreator(n.applicationId, n._id)}>
                            {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
                          </button>
                          <button className="np-btn np-btn-reject"
                            disabled={actionLoading === n._id + "_reject"}
                            onClick={() => rejectCreator(n.applicationId, n._id)}>
                            {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
                          </button>
                        </div>
                      )}
                      {isApply && n.applicationId && isAccepted && (
                        <div className="np-actions">
                          <button className="np-btn np-btn-msg" onClick={() => viewCreatorProfile(n)}>
                            💬 Message Creator
                          </button>
                        </div>
                      )}

                      {/* ── CREATOR: Connect request from brand ── */}
                      {isConnect && (
                        <div className="np-connect-card">
                          <div className="np-connect-brand">
                            <div className="np-connect-brand-av">
                              {n.fromImage
                                ? <img src={n.fromImage} alt="brand" />
                                : (n.fromName || "B").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="np-connect-brand-name">
                                {n.fromName || n.from?.name || "A Brand"}
                              </div>
                              <div className="np-connect-brand-sub">wants to connect with you 🤝</div>
                            </div>
                          </div>

                          {connectSt === "accepted" ? (
                            <div className="np-connect-actions">
                              <div className="np-decision-banner np-decision-accepted" style={{ flex: 1, margin: 0 }}>
                                ✓ Connected!
                              </div>
                              <button
                                className="np-btn np-btn-msg"
                                style={{ whiteSpace: "nowrap" }}
                                onClick={() => {
                                  const sid = n.from?._id || n.fromId || n.senderId || n.from;
                                  if (sid) router.push(`/messages?with=${sid}`);
                                }}
                              >
                                💬 Chat
                              </button>
                            </div>
                          ) : connectSt === "rejected" ? (
                            <div className="np-connect-actions">
                              <div className="np-decision-banner np-decision-rejected" style={{ flex: 1, margin: 0 }}>
                                ✗ Request Declined
                              </div>
                            </div>
                          ) : (
                            <div className="np-connect-actions">
                              <button
                                className="np-btn np-btn-accept"
                                style={{ flex: 1 }}
                                disabled={actionLoading === n._id + "_accept"}
                                onClick={() => acceptConnect(n)}
                              >
                                {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
                              </button>
                              <button
                                className="np-btn np-btn-reject"
                                style={{ flex: 1 }}
                                onClick={() => declineConnect(n)}
                              >
                                ✗ Decline
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── CREATOR: Application accepted/rejected by brand ── */}
                      {isDecision && (
                        <div className={`np-result-banner ${
                          n.type?.includes("accept") || n.type === "accepted"
                            ? "np-result-accepted"
                            : "np-result-rejected"
                        }`}>
                          {n.type?.includes("accept") || n.type === "accepted" ? (
                            <>🎉 Your application was accepted! <button className="np-btn np-btn-msg" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "12px", borderRadius: "8px" }} onClick={() => router.push("/messages")}>💬 Chat</button></>
                          ) : (
                            <>😔 Your application was not selected this time.</>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* PROFILE MODAL */}
      {selectedProfile && (
        <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
          <div className="pm-modal">
            <div className="pm-top">
              <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
              <div className="pm-avatar-big">
                {selectedProfile.profileImage
                  ? <img src={selectedProfile.profileImage} alt="avatar" />
                  : (selectedProfile.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="pm-name">{selectedProfile.name || "Creator"}</div>
              <div className="pm-location">{selectedProfile.location || selectedProfile.city || ""}</div>
              <div className="pm-tags">
                {(Array.isArray(selectedProfile.categories)
                  ? selectedProfile.categories
                  : [selectedProfile.categories]
                ).filter(Boolean).map((cat: string, i: number) => (
                  <span key={i} className="pm-tag">{cat}</span>
                ))}
              </div>
            </div>

            <div className="pm-body">
              <div className="pm-stats">
                <div className="pm-stat">
                  <div className="pm-stat-num">
                    {selectedProfile.followers
                      ? Number(selectedProfile.followers) >= 1000
                        ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
                        : selectedProfile.followers
                      : "—"}
                  </div>
                  <div className="pm-stat-label">Followers</div>
                </div>
                <div className="pm-stat">
                  <div className="pm-stat-num">
                    {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
                  </div>
                  <div className="pm-stat-label">Niches</div>
                </div>
                <div className="pm-stat">
                  <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
                  <div className="pm-stat-label">Platform</div>
                </div>
              </div>

              {selectedProfile.bio && (
                <div>
                  <div className="pm-label">About</div>
                  <div className="pm-bio">{selectedProfile.bio}</div>
                </div>
              )}

              {selectedProfile.platform && (
                <div>
                  <div className="pm-label">Platform</div>
                  <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
                    📸 {selectedProfile.platform}
                  </a>
                </div>
              )}
            </div>

            {selectedProfile.status === "accepted" && (
              <div className="pm-banner pm-banner-accepted">✅ You've accepted this creator!</div>
            )}
            {selectedProfile.status === "rejected" && (
              <div className="pm-banner pm-banner-rejected">❌ You've rejected this creator</div>
            )}

            <div className="pm-footer">
              {(!selectedProfile.status || selectedProfile.status === "pending") ? (
                <>
                  <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
                    onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
                    {actionLoading.includes("accept") ? "..." : "✓ Accept"}
                  </button>
                  <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
                    onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
                    {actionLoading.includes("reject") ? "..." : "✗ Reject"}
                  </button>
                </>
              ) : selectedProfile.status === "accepted" ? (
                <button className="pm-btn pm-btn-msg" style={{ flex: "none", width: "100%" }}
                  onClick={() => goToMessage(selectedProfile)}>
                  💬 Message Creator
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}




// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ✅ Safe JSON fetch — HTML response pe crash nahi karega
// const safeFetch = async (url: string, options: RequestInit = {}) => {
//   try {
//     const res = await fetch(url, options);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// // ✅ Kisi bhi format se MongoDB ObjectId string nikalo
// const extractMongoId = (val: any): string | null => {
//   if (!val) return null;
//   // Already a string ID
//   if (typeof val === "string" && val.length > 0 && !/\s/.test(val)) return val;
//   if (typeof val === "object") {
//     // Populated object — { _id: "...", name: "..." }
//     const id = val._id || val.id;
//     if (typeof id === "string") return id;
//     // Nested object
//     if (typeof id === "object") return extractMongoId(id);
//   }
//   return null;
// };

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const { data } = await safeFetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("NOTIFICATIONS:", data);
//       const list = data?.data || data?.notifications || [];

//       // ✅ localStorage se saved status merge karo — refresh ke baad bhi status rahega
//       const savedStatuses = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const merged = list.map((n: any) => ({
//         ...n,
//         applicationStatus: n.applicationStatus || savedStatuses[n._id] || "",
//       }));
//       setNotifications(merged);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const markRead = async (notifId: string) => {
//     try {
//       await safeFetch(`${API}/notification/read/${notifId}`, {
//         method: "PATCH",
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
//     } catch { }
//   };

//   const getCampaignId = (n: any): string | null => {
//     const id = extractMongoId(n.campaignId) || n.link?.split("/").filter(Boolean).pop() || null;
//     return id;
//   };

//   // ✅ Profile fetch — only /profile/user/:id (backend pe sirf yahi kaam karega)
//   // Agar 404 aata hai toh backend wale ko route add karna hai
//   const fetchProfile = async (userId: string) => {
//     const token = user?.token;
//     if (!userId || typeof userId !== "string") return null;

//     // Log kar taaki pata chale exact kya bhej rahe hain
//     console.log("FETCHING PROFILE FOR:", userId);

//     const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     if (ok && data) {
//       const p = data.profile || data.data || (data._id ? data : null);
//       if (p) return p;
//     }

//     // Fallback — baad mein backend route add ho toh yeh kaam karega
//     return null;
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);

//       // Debug: notification ka full structure dekho
//       console.log("NOTIFICATION DATA:", JSON.stringify(n, null, 2));

//       const senderId = extractMongoId(n.sender);
//       console.log("EXTRACTED SENDER ID:", senderId);

//       if (senderId) {
//         const profile = await fetchProfile(senderId);
//         if (profile) {
//           setSelectedProfile({
//             ...profile,
//             notifId: n._id,
//             status: n.applicationStatus,
//             campaignId: getCampaignId(n),
//           });
//           return;
//         }
//       }

//       // Fallback: campaign applications se try karo
//       const campaignId = getCampaignId(n);
//       if (campaignId) {
//         const { ok, data: appData } = await safeFetch(
//           `${API}/campaigns/${campaignId}/applications`,
//           { headers: { Authorization: `Bearer ${user.token}` } }
//         );
//         if (ok && appData) {
//           const apps = appData.applications || appData.data || [];
//           const app = apps[apps.length - 1];
//           if (app) {
//             const creatorId = extractMongoId(app.influencerId) || extractMongoId(app.influencer);
//             console.log("APP CREATOR ID:", creatorId);
//             if (creatorId) {
//               const profile = await fetchProfile(creatorId);
//               if (profile) {
//                 setSelectedProfile({
//                   ...profile,
//                   applicationId: extractMongoId(app._id) || app._id,
//                   notifId: n._id,
//                   status: n.applicationStatus || app.status,
//                   campaignId,
//                 });
//                 return;
//               }
//             }
//           }
//         }
//       }

//       // Final fallback — naam dikhao, profile nahi mila
//       setSelectedProfile({
//         name: n.sender?.name || "Creator",
//         profileImage: null, bio: "", followers: "", categories: [], platform: "",
//         notifId: n._id, status: n.applicationStatus, campaignId,
//         _noProfile: true,
//       });
//     } catch (err) {
//       console.error("viewCreatorProfile error:", err);
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   // ✅ Notification pe applicationStatus backend mein save karo
//   // Yeh ensure karta hai refresh ke baad bhi status rahe
//   // ✅ Backend mein /:id/status route nahi — localStorage mein save karo
//   // Refresh ke baad bhi status rahega
//   const saveStatusLocally = (notifId: string, status: string) => {
//     try {
//       const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       existing[notifId] = status;
//       localStorage.setItem("cb_notif_status", JSON.stringify(existing));
//     } catch { }
//   };

//   const getLocalStatus = (notifId: string): string => {
//     try {
//       const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       return existing[notifId] || "";
//     } catch { return ""; }
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     let appId = applicationId;
//     if (!appId) {
//       const n = notifications.find(x => x._id === notifId);
//       if (n) {
//         const campaignId = getCampaignId(n);
//         if (campaignId) {
//           const { ok, data } = await safeFetch(`${API}/campaigns/${campaignId}/applications`, {
//             headers: { Authorization: `Bearer ${user.token}` },
//           });
//           if (ok && data) {
//             const apps = data.applications || data.data || [];
//             appId = apps[apps.length - 1]?._id;
//           }
//         }
//       }
//     }
//     if (!appId) { alert("Application ID missing — cannot accept"); return; }
//     try {
//       setActionLoading(notifId + "_accept");
//       let ok = false, respData: any = null;
//       for (const url of [
//         `${API}/application/${appId}/decision`,
//         `${API}/applications/${appId}/accept`,
//         `${API}/applications/${appId}/status`,
//       ]) {
//         const result = await safeFetch(url, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//           body: JSON.stringify({ decision: "accepted", status: "accepted" }),
//         });
//         console.log("ACCEPT result:", url, result);
//         if (result.ok) { ok = true; respData = result.data; break; }
//       }
//       if (!ok) throw new Error(respData?.message || "Accept failed");

//       // ✅ 1. UI immediately update
//       setNotifications(prev => prev.map(n =>
//         n._id === notifId ? { ...n, applicationStatus: "accepted", applicationId: appId } : n
//       ));
//       if (selectedProfile?.notifId === notifId) {
//         setSelectedProfile((p: any) => ({ ...p, status: "accepted", applicationId: appId }));
//       }

//       // ✅ 2. localStorage mein save karo
//       saveStatusLocally(notifId, "accepted");
//       markRead(notifId);

//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally { setActionLoading(""); }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     let appId = applicationId;
//     if (!appId) {
//       const n = notifications.find(x => x._id === notifId);
//       if (n) {
//         const campaignId = getCampaignId(n);
//         if (campaignId) {
//           const { ok, data } = await safeFetch(`${API}/campaigns/${campaignId}/applications`, {
//             headers: { Authorization: `Bearer ${user.token}` },
//           });
//           if (ok && data) {
//             const apps = data.applications || data.data || [];
//             appId = apps[apps.length - 1]?._id;
//           }
//         }
//       }
//     }
//     if (!appId) { alert("Application ID missing — cannot reject"); return; }
//     try {
//       setActionLoading(notifId + "_reject");
//       let ok = false, respData: any = null;
//       for (const url of [
//         `${API}/application/${appId}/decision`,
//         `${API}/applications/${appId}/reject`,
//         `${API}/applications/${appId}/status`,
//       ]) {
//         const result = await safeFetch(url, {
//           method: "POST",
//           headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//           body: JSON.stringify({ decision: "rejected", status: "rejected" }),
//         });
//         console.log("REJECT result:", url, result);
//         if (result.ok) { ok = true; respData = result.data; break; }
//       }
//       if (!ok) throw new Error(respData?.message || "Reject failed");

//       setNotifications(prev => prev.map(n =>
//         n._id === notifId ? { ...n, applicationStatus: "rejected", applicationId: appId } : n
//       ));
//       if (selectedProfile?.notifId === notifId) {
//         setSelectedProfile((p: any) => ({ ...p, status: "rejected", applicationId: appId }));
//       }

//       // ✅ localStorage mein save karo
//       saveStatusLocally(notifId, "rejected");
//       markRead(notifId);

//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally { setActionLoading(""); }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = extractMongoId(profile.user) || extractMongoId(profile) || profile._id;
//     router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${profile.campaignId || ""}`);
//   };

//   const timeAgo = (date: string) => {
//     if (!date) return "";
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   const isApplyNotif = (n: any) =>
//     ["new_application", "campaign_apply", "application", "application_accepted"].includes(n.type);

//   // ✅ Status check — multiple field names handle karo
//   const getStatus = (n: any) => {
//     const s = n.applicationStatus || n.status || n.application?.status || "";
//     return s?.toLowerCase();
//   };

//   if (!user) return null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
//         @media(max-width:600px){.np-body{padding:0 12px;margin:16px auto}.np-header{padding:16px 20px}}
//         .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; cursor: pointer; }
//         .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
//         .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
//         .np-card-top { display: flex; gap: 12px; }
//         .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
//         .np-dot.read { background: #e0e0e0; }
//         .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
//         .np-time { font-size: 11px; color: #bbb; }
//         .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
//         .np-creator-strip:hover { background: #eff6ff; border-color: #bfdbfe; }
//         .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
//         .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }
//         .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
//         .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
//         .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
//         .np-btn-msg:hover:not(:disabled) { background: #4338ca; }
//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }
//         .np-empty { text-align: center; padding: 80px 20px; }
//         .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
//         .np-empty-sub { color: #aaa; font-size: 14px; }
//         .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
//         @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
//         .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
//         .pm-close:hover { background: rgba(255,255,255,0.25); }
//         .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
//         .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
//         .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
//         .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
//         .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }
//         .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
//         .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
//         .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
//         .pm-stat-num { font-size: 17px; font-weight: 800; color: #4f46e5; }
//         .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
//         .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; }
//         .pm-platform:hover { background: #f0f0f0; }
//         .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
//         .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
//         .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }
//         .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
//         .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pm-btn-accept { background: #4f46e5; color: #fff; }
//         .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
//         .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .pm-no-profile { background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 12px 16px; margin: 0 22px 16px; font-size: 13px; color: #92400e; }
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <span className="np-title">Notifications</span>
//           {notifications.filter(n => !n.read).length > 0 && (
//             <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//           )}
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">When creators apply to your campaigns, you will see them here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply = isApplyNotif(n);
//               const status = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending = !isAccepted && !isRejected;

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}
//                   onClick={() => !n.read && markRead(n._id)}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {isApply && (
//                         <div className="np-creator-strip"
//                           onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">
//                               {n.sender?.name || "View Creator Profile"}
//                             </div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading
//                             ? <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                             : <span className="np-view">View →</span>}
//                         </div>
//                       )}

//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}

//                       {isApply && (
//                         <div className="np-actions">
//                           {isPending ? (
//                             <>
//                               <button className="np-btn np-btn-accept"
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button className="np-btn np-btn-reject"
//                                 disabled={actionLoading === n._id + "_reject"}
//                                 onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
//                                 {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                               </button>
//                             </>
//                           ) : isAccepted ? (
//                             <button className="np-btn np-btn-msg"
//                               onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                               💬 Message Creator
//                             </button>
//                           ) : null}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               {selectedProfile.location && <div className="pm-location">📍 {selectedProfile.location}</div>}
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                   .filter(Boolean).map((cat: string, i: number) => (
//                     <span key={i} className="pm-tag">{cat}</span>
//                   ))}
//               </div>
//             </div>

//             {selectedProfile._noProfile && (
//               <div className="pm-no-profile">
//                 ⚠️ Full profile not available — backend needs <code>/api/profile/user/:id</code> route
//               </div>
//             )}

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>
//               {selectedProfile.bio && (
//                 <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>
//               )}
//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && (
//               <div className="pm-banner pm-banner-accepted">✅ You have accepted this creator!</div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-banner pm-banner-rejected">❌ You have rejected this creator</div>
//             )}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-accept" style={{ flex: "none", width: "100%" }}
//                   onClick={() => goToMessage(selectedProfile)}>
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       const notifs = data.data || data.notifications || [];

//       // localStorage se decided status merge karo
//       const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       const connectDecided = JSON.parse(localStorage.getItem("connectDecisions") || "{}");

//       const merged = notifs.map((n: any) => ({
//         ...n,
//         applicationStatus: decided[n.applicationId] || n.applicationStatus || n.status,
//         connectStatus: connectDecided[n._id] || n.connectStatus,
//       }));
//       setNotifications(merged);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);
//       let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

//       if (!creatorId && n.applicationId && n.link) {
//         const campaignId = n.link.split("/").pop();
//         const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const appData = await appRes.json();
//         const apps = appData.applications || appData.data || [];
//         const matched = apps.find((a: any) => a._id === n.applicationId);
//         creatorId = matched?.influencerId?._id || matched?.influencerId;
//       }

//       if (!creatorId) { alert("Creator profile not available"); return; }

//       let profile: any = null;
//       const r1 = await fetch(`${API}/profile/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
//       if (r1.ok) {
//         const d1 = await r1.json();
//         profile = d1.profile || d1.data || d1;
//       } else {
//         const r2 = await fetch(`${API}/profile/user/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
//         const d2 = await r2.json();
//         profile = d2.profile || d2.data || d2;
//       }

//       setSelectedProfile({
//         ...profile,
//         applicationId: n.applicationId,
//         notifId: n._id,
//         status: n.applicationStatus || n.status,
//         campaignId: n.link?.split("/").pop(),
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Could not load profile");
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   const saveDecidedStatus = (applicationId: string, status: string) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     decided[applicationId] = status;
//     localStorage.setItem("decidedApplications", JSON.stringify(decided));
//   };

//   const saveConnectDecision = (notifId: string, status: string) => {
//     const d = JSON.parse(localStorage.getItem("connectDecisions") || "{}");
//     d[notifId] = status;
//     localStorage.setItem("connectDecisions", JSON.stringify(d));
//   };

//   // ── Brand: Accept/Reject campaign application ──
//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       saveDecidedStatus(applicationId, "accepted");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       saveDecidedStatus(applicationId, "rejected");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   // ── Creator: Accept connect request from brand ──
//   const acceptConnect = async (n: any) => {
//     try {
//       setActionLoading(n._id + "_accept");
//       const senderId = n.from?._id || n.fromId || n.senderId || n.from;
//       if (senderId) {
//         // Create conversation so both can chat
//         const res = await fetch(`${API}/conversations/create`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({ participantId: senderId }),
//         });
//         const data = await res.json();
//         console.log("Conversation created:", data);
//       }
//       saveConnectDecision(n._id, "accepted");
//       setNotifications(prev => prev.map(notif =>
//         notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
//       ));
//     } catch (err) {
//       console.error("Accept connect error:", err);
//       // Still mark accepted locally even if API fails
//       saveConnectDecision(n._id, "accepted");
//       setNotifications(prev => prev.map(notif =>
//         notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
//       ));
//     } finally {
//       setActionLoading("");
//     }
//   };

//   // ── Creator: Decline connect request ──
//   const declineConnect = (n: any) => {
//     saveConnectDecision(n._id, "rejected");
//     setNotifications(prev => prev.map(notif =>
//       notif._id === n._id ? { ...notif, connectStatus: "rejected" } : notif
//     ));
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = profile.user?._id || profile.user || profile._id;
//     const campaignId = profile.campaignId;
//     router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${campaignId}`);
//   };

//   const timeAgo = (date: string) => {
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   // Notification type checkers
//   const isApplyNotif = (n: any) =>
//     n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

//   const isConnectNotif = (n: any) =>
//     n.type === "connect_request" || n.type === "connection_request" || n.type === "connect" ||
//     // ✅ Brand ke /browse se bheja "new_message" jisme "connect" mention ho
//     (n.type === "new_message" && n.message?.toLowerCase().includes("connect"));

//   // Creator ko application accept/reject status dikhao
//   const isAppDecisionNotif = (n: any) =>
//     n.type === "application_accepted" || n.type === "application_rejected" ||
//     n.type === "accepted" || n.type === "rejected";

//   const getStatus = (n: any) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     return decided[n.applicationId] || n.applicationStatus || n.status || null;
//   };

//   if (!user) return null;

//   const role = user?.role?.toLowerCase();
//   const isCreator = role === "influencer" || role === "creator";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
//         @media(max-width:600px) { .np-body { padding: 0 12px; margin: 16px auto; } .np-header { padding: 16px 20px; } }

//         .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; }
//         .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
//         .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

//         .np-card-top { display: flex; gap: 12px; }
//         .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
//         .np-dot.read { background: #e0e0e0; }
//         .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
//         .np-time { font-size: 11px; color: #bbb; }

//         .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
//         .np-creator-strip:hover { background: #f0f0f0; border-color: #ddd; }
//         .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
//         .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }

//         .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
//         .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
//         .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
//         .np-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }
//         .np-status-pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

//         /* Connect request card special styling */
//         .np-connect-card { margin-top: 12px; border-radius: 14px; overflow: hidden; border: 1.5px solid #e0e7ff; }
//         .np-connect-brand { background: linear-gradient(135deg, #eef2ff, #f5f3ff); padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
//         .np-connect-brand-av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; overflow: hidden; }
//         .np-connect-brand-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-connect-brand-name { font-size: 14px; font-weight: 800; color: #111; }
//         .np-connect-brand-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
//         .np-connect-actions { padding: 12px 16px; background: #fff; display: flex; gap: 8px; }

//         .np-decision-banner { margin-top: 12px; padding: 11px 14px; border-radius: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
//         .np-decision-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-decision-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

//         /* Creator: application result notifications */
//         .np-result-banner { margin-top: 12px; padding: 13px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
//         .np-result-accepted { background: linear-gradient(135deg,#f0fdf4,#dcfce7); color: #15803d; border: 1.5px solid #86efac; }
//         .np-result-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

//         .np-empty { text-align: center; padding: 80px 20px; }
//         .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
//         .np-empty-sub { color: #aaa; font-size: 14px; }

//         /* PROFILE MODAL */
//         .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
//         @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
//         .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
//         .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
//         .pm-close:hover { background: rgba(255,255,255,0.25); }
//         .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
//         .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
//         .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
//         .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
//         .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }
//         .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
//         .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
//         .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
//         .pm-stat-num { font-size: 17px; font-weight: 800; color: #111; }
//         .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
//         .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; transition: all 0.2s; }
//         .pm-platform:hover { background: #f0f0f0; }
//         .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
//         .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
//         .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }
//         .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
//         .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pm-btn-accept { background: #4f46e5; color: #fff; }
//         .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
//         .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .pm-btn-msg { background: #4f46e5; color: #fff; width: 100%; }
//         .pm-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <div style={{ display: "flex", alignItems: "center" }}>
//             <span className="np-title">Notifications</span>
//             {notifications.filter(n => !n.read).length > 0 && (
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//             )}
//           </div>
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}>
//               <div className="spinner" />
//             </div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">
//                 {isCreator
//                   ? "When brands connect with you or respond to your applications, you'll see it here"
//                   : "When creators apply to your campaigns, you'll see them here"}
//               </div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply    = isApplyNotif(n);
//               const isConnect  = isConnectNotif(n);
//               const isDecision = isAppDecisionNotif(n);

//               const status     = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending  = !isAccepted && !isRejected;

//               const connectSt  = n.connectStatus || "pending";

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {/* ── BRAND: Campaign application notification ── */}
//                       {isApply && (
//                         <div className="np-creator-strip" onClick={() => viewCreatorProfile(n)}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">View Creator Profile</div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading ? (
//                             <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                           ) : (
//                             <span className="np-view">View →</span>
//                           )}
//                         </div>
//                       )}
//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}
//                       {isApply && n.applicationId && isPending && (
//                         <div className="np-actions">
//                           <button className="np-btn np-btn-accept"
//                             disabled={actionLoading === n._id + "_accept"}
//                             onClick={() => acceptCreator(n.applicationId, n._id)}>
//                             {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                           </button>
//                           <button className="np-btn np-btn-reject"
//                             disabled={actionLoading === n._id + "_reject"}
//                             onClick={() => rejectCreator(n.applicationId, n._id)}>
//                             {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                           </button>
//                         </div>
//                       )}
//                       {isApply && n.applicationId && isAccepted && (
//                         <div className="np-actions">
//                           <button className="np-btn np-btn-msg" onClick={() => viewCreatorProfile(n)}>
//                             💬 Message Creator
//                           </button>
//                         </div>
//                       )}

//                       {/* ── CREATOR: Connect request from brand ── */}
//                       {isConnect && (
//                         <div className="np-connect-card">
//                           <div className="np-connect-brand">
//                             <div className="np-connect-brand-av">
//                               {n.fromImage
//                                 ? <img src={n.fromImage} alt="brand" />
//                                 : (n.fromName || "B").charAt(0).toUpperCase()}
//                             </div>
//                             <div>
//                               <div className="np-connect-brand-name">
//                                 {n.fromName || n.from?.name || "A Brand"}
//                               </div>
//                               <div className="np-connect-brand-sub">wants to connect with you 🤝</div>
//                             </div>
//                           </div>

//                           {connectSt === "accepted" ? (
//                             <div className="np-connect-actions">
//                               <div className="np-decision-banner np-decision-accepted" style={{ flex: 1, margin: 0 }}>
//                                 ✓ Connected!
//                               </div>
//                               <button
//                                 className="np-btn np-btn-msg"
//                                 style={{ whiteSpace: "nowrap" }}
//                                 onClick={() => {
//                                   const sid = n.from?._id || n.fromId || n.senderId || n.from;
//                                   if (sid) router.push(`/messages?with=${sid}`);
//                                 }}
//                               >
//                                 💬 Chat
//                               </button>
//                             </div>
//                           ) : connectSt === "rejected" ? (
//                             <div className="np-connect-actions">
//                               <div className="np-decision-banner np-decision-rejected" style={{ flex: 1, margin: 0 }}>
//                                 ✗ Request Declined
//                               </div>
//                             </div>
//                           ) : (
//                             <div className="np-connect-actions">
//                               <button
//                                 className="np-btn np-btn-accept"
//                                 style={{ flex: 1 }}
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={() => acceptConnect(n)}
//                               >
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button
//                                 className="np-btn np-btn-reject"
//                                 style={{ flex: 1 }}
//                                 onClick={() => declineConnect(n)}
//                               >
//                                 ✗ Decline
//                               </button>
//                             </div>
//                           )}
//                         </div>
//                       )}

//                       {/* ── CREATOR: Application accepted/rejected by brand ── */}
//                       {isDecision && (
//                         <div className={`np-result-banner ${
//                           n.type?.includes("accept") || n.type === "accepted"
//                             ? "np-result-accepted"
//                             : "np-result-rejected"
//                         }`}>
//                           {n.type?.includes("accept") || n.type === "accepted" ? (
//                             <>🎉 Your application was accepted! <button className="np-btn np-btn-msg" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "12px", borderRadius: "8px" }} onClick={() => router.push("/messages")}>💬 Chat</button></>
//                           ) : (
//                             <>😔 Your application was not selected this time.</>
//                           )}
//                         </div>
//                       )}

//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {/* PROFILE MODAL */}
//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               <div className="pm-location">{selectedProfile.location || selectedProfile.city || ""}</div>
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories)
//                   ? selectedProfile.categories
//                   : [selectedProfile.categories]
//                 ).filter(Boolean).map((cat: string, i: number) => (
//                   <span key={i} className="pm-tag">{cat}</span>
//                 ))}
//               </div>
//             </div>

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {selectedProfile.bio && (
//                 <div>
//                   <div className="pm-label">About</div>
//                   <div className="pm-bio">{selectedProfile.bio}</div>
//                 </div>
//               )}

//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && (
//               <div className="pm-banner pm-banner-accepted">✅ You've accepted this creator!</div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-banner pm-banner-rejected">❌ You've rejected this creator</div>
//             )}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-msg" style={{ flex: "none", width: "100%" }}
//                   onClick={() => goToMessage(selectedProfile)}>
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       const notifs = data.data || data.notifications || [];

//       // localStorage se decided status merge karo
//       const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       const connectDecided = JSON.parse(localStorage.getItem("connectDecisions") || "{}");

//       const merged = notifs.map((n: any) => ({
//         ...n,
//         applicationStatus: decided[n.applicationId] || n.applicationStatus || n.status,
//         connectStatus: connectDecided[n._id] || n.connectStatus,
//       }));
//       setNotifications(merged);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);
//       let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

//       if (!creatorId && n.applicationId && n.link) {
//         const campaignId = n.link.split("/").pop();
//         const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const appData = await appRes.json();
//         const apps = appData.applications || appData.data || [];
//         const matched = apps.find((a: any) => a._id === n.applicationId);
//         creatorId = matched?.influencerId?._id || matched?.influencerId;
//       }

//       if (!creatorId) { alert("Creator profile not available"); return; }

//       let profile: any = null;
//       const r1 = await fetch(`${API}/profile/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
//       if (r1.ok) {
//         const d1 = await r1.json();
//         profile = d1.profile || d1.data || d1;
//       } else {
//         const r2 = await fetch(`${API}/profile/user/${creatorId}`, { headers: { Authorization: `Bearer ${user.token}` } });
//         const d2 = await r2.json();
//         profile = d2.profile || d2.data || d2;
//       }

//       setSelectedProfile({
//         ...profile,
//         applicationId: n.applicationId,
//         notifId: n._id,
//         status: n.applicationStatus || n.status,
//         campaignId: n.link?.split("/").pop(),
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Could not load profile");
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   const saveDecidedStatus = (applicationId: string, status: string) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     decided[applicationId] = status;
//     localStorage.setItem("decidedApplications", JSON.stringify(decided));
//   };

//   const saveConnectDecision = (notifId: string, status: string) => {
//     const d = JSON.parse(localStorage.getItem("connectDecisions") || "{}");
//     d[notifId] = status;
//     localStorage.setItem("connectDecisions", JSON.stringify(d));
//   };

//   // ── Brand: Accept/Reject campaign application ──
//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       saveDecidedStatus(applicationId, "accepted");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       saveDecidedStatus(applicationId, "rejected");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   // ── Creator: Accept connect request from brand ──
//   const acceptConnect = async (n: any) => {
//     try {
//       setActionLoading(n._id + "_accept");
//       const senderId = n.from?._id || n.fromId || n.senderId || n.from;
//       if (senderId) {
//         // Create conversation so both can chat
//         const res = await fetch(`${API}/conversations/create`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({ participantId: senderId }),
//         });
//         const data = await res.json();
//         console.log("Conversation created:", data);
//       }
//       saveConnectDecision(n._id, "accepted");
//       setNotifications(prev => prev.map(notif =>
//         notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
//       ));
//     } catch (err) {
//       console.error("Accept connect error:", err);
//       // Still mark accepted locally even if API fails
//       saveConnectDecision(n._id, "accepted");
//       setNotifications(prev => prev.map(notif =>
//         notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif
//       ));
//     } finally {
//       setActionLoading("");
//     }
//   };

//   // ── Creator: Decline connect request ──
//   const declineConnect = (n: any) => {
//     saveConnectDecision(n._id, "rejected");
//     setNotifications(prev => prev.map(notif =>
//       notif._id === n._id ? { ...notif, connectStatus: "rejected" } : notif
//     ));
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = profile.user?._id || profile.user || profile._id;
//     const campaignId = profile.campaignId;
//     router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${campaignId}`);
//   };

//   const timeAgo = (date: string) => {
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   // Notification type checkers
//   const isApplyNotif = (n: any) =>
//     n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

//   const isConnectNotif = (n: any) =>
//     n.type === "connect_request" || n.type === "connection_request" || n.type === "connect";

//   // Creator ko application accept/reject status dikhao
//   const isAppDecisionNotif = (n: any) =>
//     n.type === "application_accepted" || n.type === "application_rejected" ||
//     n.type === "accepted" || n.type === "rejected";

//   const getStatus = (n: any) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     return decided[n.applicationId] || n.applicationStatus || n.status || null;
//   };

//   if (!user) return null;

//   const role = user?.role?.toLowerCase();
//   const isCreator = role === "influencer" || role === "creator";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
//         @media(max-width:600px) { .np-body { padding: 0 12px; margin: 16px auto; } .np-header { padding: 16px 20px; } }

//         .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; }
//         .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
//         .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

//         .np-card-top { display: flex; gap: 12px; }
//         .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
//         .np-dot.read { background: #e0e0e0; }
//         .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
//         .np-time { font-size: 11px; color: #bbb; }

//         .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
//         .np-creator-strip:hover { background: #f0f0f0; border-color: #ddd; }
//         .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
//         .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }

//         .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
//         .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
//         .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
//         .np-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }
//         .np-status-pending { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }

//         /* Connect request card special styling */
//         .np-connect-card { margin-top: 12px; border-radius: 14px; overflow: hidden; border: 1.5px solid #e0e7ff; }
//         .np-connect-brand { background: linear-gradient(135deg, #eef2ff, #f5f3ff); padding: 14px 16px; display: flex; align-items: center; gap: 12px; }
//         .np-connect-brand-av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; overflow: hidden; }
//         .np-connect-brand-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-connect-brand-name { font-size: 14px; font-weight: 800; color: #111; }
//         .np-connect-brand-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; }
//         .np-connect-actions { padding: 12px 16px; background: #fff; display: flex; gap: 8px; }

//         .np-decision-banner { margin-top: 12px; padding: 11px 14px; border-radius: 12px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
//         .np-decision-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-decision-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

//         /* Creator: application result notifications */
//         .np-result-banner { margin-top: 12px; padding: 13px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
//         .np-result-accepted { background: linear-gradient(135deg,#f0fdf4,#dcfce7); color: #15803d; border: 1.5px solid #86efac; }
//         .np-result-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }

//         .np-empty { text-align: center; padding: 80px 20px; }
//         .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
//         .np-empty-sub { color: #aaa; font-size: 14px; }

//         /* PROFILE MODAL */
//         .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
//         @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
//         .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
//         .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
//         .pm-close:hover { background: rgba(255,255,255,0.25); }
//         .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
//         .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
//         .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
//         .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
//         .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }
//         .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
//         .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
//         .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
//         .pm-stat-num { font-size: 17px; font-weight: 800; color: #111; }
//         .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
//         .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; transition: all 0.2s; }
//         .pm-platform:hover { background: #f0f0f0; }
//         .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
//         .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
//         .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }
//         .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
//         .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pm-btn-accept { background: #4f46e5; color: #fff; }
//         .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
//         .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .pm-btn-msg { background: #4f46e5; color: #fff; width: 100%; }
//         .pm-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <div style={{ display: "flex", alignItems: "center" }}>
//             <span className="np-title">Notifications</span>
//             {notifications.filter(n => !n.read).length > 0 && (
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//             )}
//           </div>
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}>
//               <div className="spinner" />
//             </div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">
//                 {isCreator
//                   ? "When brands connect with you or respond to your applications, you'll see it here"
//                   : "When creators apply to your campaigns, you'll see them here"}
//               </div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply    = isApplyNotif(n);
//               const isConnect  = isConnectNotif(n);
//               const isDecision = isAppDecisionNotif(n);

//               const status     = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending  = !isAccepted && !isRejected;

//               const connectSt  = n.connectStatus || "pending";

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {/* ── BRAND: Campaign application notification ── */}
//                       {isApply && (
//                         <div className="np-creator-strip" onClick={() => viewCreatorProfile(n)}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">View Creator Profile</div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading ? (
//                             <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                           ) : (
//                             <span className="np-view">View →</span>
//                           )}
//                         </div>
//                       )}
//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}
//                       {isApply && n.applicationId && isPending && (
//                         <div className="np-actions">
//                           <button className="np-btn np-btn-accept"
//                             disabled={actionLoading === n._id + "_accept"}
//                             onClick={() => acceptCreator(n.applicationId, n._id)}>
//                             {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                           </button>
//                           <button className="np-btn np-btn-reject"
//                             disabled={actionLoading === n._id + "_reject"}
//                             onClick={() => rejectCreator(n.applicationId, n._id)}>
//                             {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                           </button>
//                         </div>
//                       )}
//                       {isApply && n.applicationId && isAccepted && (
//                         <div className="np-actions">
//                           <button className="np-btn np-btn-msg" onClick={() => viewCreatorProfile(n)}>
//                             💬 Message Creator
//                           </button>
//                         </div>
//                       )}

//                       {/* ── CREATOR: Connect request from brand ── */}
//                       {isConnect && (
//                         <div className="np-connect-card">
//                           <div className="np-connect-brand">
//                             <div className="np-connect-brand-av">
//                               {n.fromImage
//                                 ? <img src={n.fromImage} alt="brand" />
//                                 : (n.fromName || "B").charAt(0).toUpperCase()}
//                             </div>
//                             <div>
//                               <div className="np-connect-brand-name">
//                                 {n.fromName || n.from?.name || "A Brand"}
//                               </div>
//                               <div className="np-connect-brand-sub">wants to connect with you 🤝</div>
//                             </div>
//                           </div>

//                           {connectSt === "accepted" ? (
//                             <div className="np-connect-actions">
//                               <div className="np-decision-banner np-decision-accepted" style={{ flex: 1, margin: 0 }}>
//                                 ✓ Connected!
//                               </div>
//                               <button
//                                 className="np-btn np-btn-msg"
//                                 style={{ whiteSpace: "nowrap" }}
//                                 onClick={() => {
//                                   const sid = n.from?._id || n.fromId || n.senderId || n.from;
//                                   if (sid) router.push(`/messages?with=${sid}`);
//                                 }}
//                               >
//                                 💬 Chat
//                               </button>
//                             </div>
//                           ) : connectSt === "rejected" ? (
//                             <div className="np-connect-actions">
//                               <div className="np-decision-banner np-decision-rejected" style={{ flex: 1, margin: 0 }}>
//                                 ✗ Request Declined
//                               </div>
//                             </div>
//                           ) : (
//                             <div className="np-connect-actions">
//                               <button
//                                 className="np-btn np-btn-accept"
//                                 style={{ flex: 1 }}
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={() => acceptConnect(n)}
//                               >
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button
//                                 className="np-btn np-btn-reject"
//                                 style={{ flex: 1 }}
//                                 onClick={() => declineConnect(n)}
//                               >
//                                 ✗ Decline
//                               </button>
//                             </div>
//                           )}
//                         </div>
//                       )}

//                       {/* ── CREATOR: Application accepted/rejected by brand ── */}
//                       {isDecision && (
//                         <div className={`np-result-banner ${
//                           n.type?.includes("accept") || n.type === "accepted"
//                             ? "np-result-accepted"
//                             : "np-result-rejected"
//                         }`}>
//                           {n.type?.includes("accept") || n.type === "accepted" ? (
//                             <>🎉 Your application was accepted! <button className="np-btn np-btn-msg" style={{ marginLeft: "auto", padding: "6px 14px", fontSize: "12px", borderRadius: "8px" }} onClick={() => router.push("/messages")}>💬 Chat</button></>
//                           ) : (
//                             <>😔 Your application was not selected this time.</>
//                           )}
//                         </div>
//                       )}

//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {/* PROFILE MODAL */}
//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               <div className="pm-location">{selectedProfile.location || selectedProfile.city || ""}</div>
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories)
//                   ? selectedProfile.categories
//                   : [selectedProfile.categories]
//                 ).filter(Boolean).map((cat: string, i: number) => (
//                   <span key={i} className="pm-tag">{cat}</span>
//                 ))}
//               </div>
//             </div>

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {selectedProfile.bio && (
//                 <div>
//                   <div className="pm-label">About</div>
//                   <div className="pm-bio">{selectedProfile.bio}</div>
//                 </div>
//               )}

//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && (
//               <div className="pm-banner pm-banner-accepted">✅ You've accepted this creator!</div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-banner pm-banner-rejected">❌ You've rejected this creator</div>
//             )}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-msg" style={{ flex: "none", width: "100%" }}
//                   onClick={() => goToMessage(selectedProfile)}>
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       const notifs = data.data || data.notifications || [];
//       // ✅ localStorage se decided status merge karo
//       const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//       const merged = notifs.map((n: any) => ({
//         ...n,
//         applicationStatus: decided[n.applicationId] || n.applicationStatus || n.status,
//       }));
//       setNotifications(merged);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);

//       let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

//       if (!creatorId && n.applicationId && n.link) {
//         const campaignId = n.link.split("/").pop();
//         const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const appData = await appRes.json();
//         const apps = appData.applications || appData.data || [];
//         const matched = apps.find((a: any) => a._id === n.applicationId);
//         creatorId = matched?.influencerId?._id || matched?.influencerId;
//         console.log("CREATOR ID:", creatorId);
//       }

//       if (!creatorId) {
//         alert("Creator profile not available");
//         return;
//       }

//       // Try /profile/:id first, then /profile/user/:id
//       let profile: any = null;
//       const r1 = await fetch(`${API}/profile/${creatorId}`, {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       if (r1.ok) {
//         const d1 = await r1.json();
//         profile = d1.profile || d1.data || d1;
//       } else {
//         const r2 = await fetch(`${API}/profile/user/${creatorId}`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const d2 = await r2.json();
//         profile = d2.profile || d2.data || d2;
//       }

//       console.log("CREATOR PROFILE:", profile);
//       setSelectedProfile({
//         ...profile,
//         applicationId: n.applicationId,
//         notifId: n._id,
//         status: n.applicationStatus || n.status,
//         campaignId: n.link?.split("/").pop(),
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Could not load profile");
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   // ✅ localStorage se decided applications load karo
//   const getDecidedStatus = (applicationId: string) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     return decided[applicationId] || null;
//   };

//   const saveDecidedStatus = (applicationId: string, status: string) => {
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     decided[applicationId] = status;
//     localStorage.setItem("decidedApplications", JSON.stringify(decided));
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       // ✅ Permanently save — reload pe bhi accepted dikhega
//       saveDecidedStatus(applicationId, "accepted");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       // ✅ Permanently save
//       saveDecidedStatus(applicationId, "rejected");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = profile.user?._id || profile.user || profile._id;
//     const campaignId = profile.campaignId;
//     router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${campaignId}`);
//   };

//   const timeAgo = (date: string) => {
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   const isApplyNotif = (n: any) =>
//     n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

//   const getStatus = (n: any) => {
//     // ✅ localStorage se pehle check karo — permanent storage
//     const decided = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     return decided[n.applicationId] || n.applicationStatus || n.status || null;
//   };

//   if (!user) return null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
//         @media(max-width:600px) { .np-body { padding: 0 12px; margin: 16px auto; } .np-header { padding: 16px 20px; } }

//         .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; }
//         .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
//         .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

//         .np-card-top { display: flex; gap: 12px; }
//         .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
//         .np-dot.read { background: #e0e0e0; }
//         .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
//         .np-time { font-size: 11px; color: #bbb; }

//         .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
//         .np-creator-strip:hover { background: #f0f0f0; border-color: #ddd; }
//         .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
//         .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }

//         .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
//         .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
//         .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
//         .np-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }

//         .np-empty { text-align: center; padding: 80px 20px; }
//         .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
//         .np-empty-sub { color: #aaa; font-size: 14px; }

//         /* PROFILE MODAL */
//         .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
//         @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

//         .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
//         .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
//         .pm-close:hover { background: rgba(255,255,255,0.25); }
//         .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
//         .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
//         .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
//         .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
//         .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }

//         .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
//         .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
//         .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
//         .pm-stat-num { font-size: 17px; font-weight: 800; color: #111; }
//         .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
//         .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; transition: all 0.2s; }
//         .pm-platform:hover { background: #f0f0f0; }

//         .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
//         .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
//         .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }

//         .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
//         .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pm-btn-accept { background: #4f46e5; color: #fff; }
//         .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
//         .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .pm-btn-msg { background: #4f46e5; color: #fff; width: 100%; }
//         .pm-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <div style={{ display: "flex", alignItems: "center" }}>
//             <span className="np-title">Notifications</span>
//             {notifications.filter(n => !n.read).length > 0 && (
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//             )}
//           </div>
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}>
//               <div className="spinner" />
//             </div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">When creators apply to your campaigns, you'll see them here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply = isApplyNotif(n);
//               const status = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending = !isAccepted && !isRejected;

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {/* Creator strip */}
//                       {isApply && (
//                         <div className="np-creator-strip" onClick={() => viewCreatorProfile(n)}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">View Creator Profile</div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading ? (
//                             <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                           ) : (
//                             <span className="np-view">View →</span>
//                           )}
//                         </div>
//                       )}

//                       {/* Status */}
//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}

//                       {/* Actions */}
//                       {isApply && n.applicationId && (
//                         <div className="np-actions">
//                           {isPending ? (
//                             <>
//                               <button className="np-btn np-btn-accept"
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={() => acceptCreator(n.applicationId, n._id)}>
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button className="np-btn np-btn-reject"
//                                 disabled={actionLoading === n._id + "_reject"}
//                                 onClick={() => rejectCreator(n.applicationId, n._id)}>
//                                 {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                               </button>
//                             </>
//                           ) : isAccepted ? (
//                             <button className="np-btn np-btn-msg" onClick={() => viewCreatorProfile(n)}>
//                               💬 Message Creator
//                             </button>
//                           ) : null}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {/* PROFILE MODAL */}
//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               <div className="pm-location">{selectedProfile.location || selectedProfile.city || ""}</div>
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories)
//                   ? selectedProfile.categories
//                   : [selectedProfile.categories]
//                 ).filter(Boolean).map((cat: string, i: number) => (
//                   <span key={i} className="pm-tag">{cat}</span>
//                 ))}
//               </div>
//             </div>

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {selectedProfile.bio && (
//                 <div>
//                   <div className="pm-label">About</div>
//                   <div className="pm-bio">{selectedProfile.bio}</div>
//                 </div>
//               )}

//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && (
//               <div className="pm-banner pm-banner-accepted">✅ You've accepted this creator!</div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-banner pm-banner-rejected">❌ You've rejected this creator</div>
//             )}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-msg" style={{ flex: "none", width: "100%" }}
//                   onClick={() => goToMessage(selectedProfile)}>
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       setNotifications(data.data || data.notifications || []);
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const markRead = async (notifId: string) => {
//     try {
//       await fetch(`${API}/notification/read/${notifId}`, { method: "PATCH", headers: { Authorization: `Bearer ${user.token}` } });
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
//     } catch { }
//   };

//   const getCampaignId = (n: any) => n.campaignId || n.link?.split("/").filter(Boolean).pop() || null;

//   const fetchProfile = async (userId: string) => {
//     for (const url of [`${API}/profile/user/${userId}`, `${API}/profile/${userId}`]) {
//       try {
//         const res = await fetch(url, { headers: { Authorization: `Bearer ${user.token}` } });
//         if (res.ok) {
//           const d = await res.json();
//           const p = d.profile || d.data || (d._id ? d : null);
//           if (p) return p;
//         }
//       } catch { continue; }
//     }
//     return null;
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);
//       const senderId = n.sender?._id || (typeof n.sender === "string" ? n.sender : null);
//       if (senderId) {
//         const profile = await fetchProfile(senderId);
//         if (profile) { setSelectedProfile({ ...profile, notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n) }); return; }
//       }
//       const campaignId = getCampaignId(n);
//       if (campaignId) {
//         try {
//           const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, { headers: { Authorization: `Bearer ${user.token}` } });
//           if (appRes.ok) {
//             const appData = await appRes.json();
//             const apps = appData.applications || appData.data || [];
//             const app = apps[apps.length - 1];
//             if (app) {
//               const creatorId = app.influencerId?._id || app.influencer?._id || (typeof app.influencerId === "string" ? app.influencerId : null);
//               if (creatorId) {
//                 const profile = await fetchProfile(creatorId);
//                 if (profile) { setSelectedProfile({ ...profile, applicationId: app._id, notifId: n._id, status: n.applicationStatus || app.status, campaignId }); return; }
//               }
//             }
//           }
//         } catch (e) { console.warn(e); }
//       }
//       setSelectedProfile({ name: n.sender?.name || "Creator", profileImage: null, bio: "", followers: "", categories: [], platform: "", notifId: n._id, status: n.applicationStatus, campaignId });
//     } catch (err) { console.error(err); alert("Could not load profile"); }
//     finally { setProfileLoading(false); }
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     if (!applicationId) { alert("Application ID missing"); return; }
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ decision: "accepted" }) });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//       markRead(notifId);
//     } catch (err: any) { alert(err.message || "Accept failed"); }
//     finally { setActionLoading(""); }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     if (!applicationId) { alert("Application ID missing"); return; }
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` }, body: JSON.stringify({ decision: "rejected" }) });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//       markRead(notifId);
//     } catch (err: any) { alert(err.message || "Reject failed"); }
//     finally { setActionLoading(""); }
//   };

//   const goToMessage = (profile: any) => {
//     const id = profile.user?._id || profile.user || profile._id;
//     router.push(`/messages?userId=${id}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${profile.campaignId || ""}`);
//   };

//   const timeAgo = (date: string) => {
//     if (!date) return "";
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   const isApplyNotif = (n: any) => ["new_application","campaign_apply","application","application_accepted"].includes(n.type);
//   const getStatus = (n: any) => n.applicationStatus || n.status;

//   if (!user) return null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box}
//         .np{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh;padding-bottom:60px}
//         .np-header{background:#fff;border-bottom:1px solid #ebebeb;padding:24px 32px;display:flex;align-items:center}
//         .np-title{font-size:22px;font-weight:800;color:#111}
//         .np-badge{background:#4f46e5;color:#fff;border-radius:100px;font-size:11px;font-weight:700;padding:3px 10px;margin-left:8px}
//         .np-body{max-width:680px;margin:28px auto;padding:0 20px;display:flex;flex-direction:column;gap:12px}
//         @media(max-width:600px){.np-body{padding:0 12px;margin:16px auto}.np-header{padding:16px 20px}}
//         .np-card{background:#fff;border-radius:16px;border:1.5px solid #ebebeb;padding:18px 20px;transition:all 0.2s;cursor:pointer}
//         .np-card.unread{border-color:#c7d2fe;background:#fafbff}
//         .np-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.06)}
//         .np-card-top{display:flex;gap:12px}
//         .np-dot{width:8px;height:8px;border-radius:50%;background:#4f46e5;margin-top:6px;flex-shrink:0}
//         .np-dot.read{background:#e0e0e0}
//         .np-type{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px}
//         .np-msg{font-size:14px;color:#333;line-height:1.5;margin-bottom:4px}
//         .np-time{font-size:11px;color:#bbb}
//         .np-creator-strip{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;background:#fafafa;border-radius:12px;border:1px solid #f0f0f0;cursor:pointer;transition:all 0.2s}
//         .np-creator-strip:hover{background:#eff6ff;border-color:#bfdbfe}
//         .np-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .np-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .np-creator-name{font-size:14px;font-weight:700;color:#111}
//         .np-creator-sub{font-size:12px;color:#aaa;margin-top:1px}
//         .np-view{font-size:12px;color:#4f46e5;font-weight:600;margin-left:auto}
//         .np-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
//         .np-btn{padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .np-btn:disabled{opacity:0.5;cursor:not-allowed}
//         .np-btn-accept{background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0}
//         .np-btn-accept:hover:not(:disabled){background:#dcfce7}
//         .np-btn-reject{background:#fff5f5;color:#dc2626;border:1.5px solid #fecaca}
//         .np-btn-reject:hover:not(:disabled){background:#fee2e2}
//         .np-btn-msg{background:#4f46e5;color:#fff;border:1.5px solid #4f46e5}
//         .np-btn-msg:hover:not(:disabled){background:#4338ca}
//         .np-status{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:100px;font-size:12px;font-weight:600;margin-top:10px}
//         .np-status-accepted{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .np-status-rejected{background:#fff5f5;color:#dc2626;border:1px solid #fecaca}
//         .np-empty{text-align:center;padding:80px 20px}
//         .np-empty-icon{font-size:48px;margin-bottom:16px}
//         .np-empty-title{font-size:18px;font-weight:700;color:#111;margin-bottom:6px}
//         .np-empty-sub{color:#aaa;font-size:14px}
//         .pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .pm-modal{background:#fff;border-radius:22px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;animation:slideUp 0.25s ease}
//         @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .pm-top{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);border-radius:22px 22px 0 0;padding:28px 24px 24px;position:relative}
//         .pm-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center}
//         .pm-close:hover{background:rgba(255,255,255,0.25)}
//         .pm-avatar-big{width:76px;height:76px;border-radius:50%;border:3px solid rgba(255,255,255,0.4);background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}
//         .pm-avatar-big img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .pm-name{font-size:20px;font-weight:800;color:#fff;margin:0 0 4px}
//         .pm-location{font-size:13px;color:rgba(255,255,255,0.65);margin:0 0 12px}
//         .pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .pm-tag{padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.15);font-size:11px;color:rgba(255,255,255,0.9)}
//         .pm-body{padding:22px;display:flex;flex-direction:column;gap:16px}
//         .pm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
//         .pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .pm-stat-num{font-size:17px;font-weight:800;color:#4f46e5}
//         .pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .pm-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
//         .pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .pm-platform{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500;transition:all 0.2s}
//         .pm-platform:hover{background:#f0f0f0}
//         .pm-banner{margin:0 22px 16px;padding:12px 16px;border-radius:12px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}
//         .pm-banner-accepted{background:#f0fdf4;border:1.5px solid #bbf7d0;color:#16a34a}
//         .pm-banner-rejected{background:#fff5f5;border:1.5px solid #fecaca;color:#dc2626}
//         .pm-footer{padding:0 22px 22px;display:flex;gap:10px}
//         .pm-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .pm-btn:disabled{opacity:0.4;cursor:not-allowed}
//         .pm-btn-accept{background:#4f46e5;color:#fff}
//         .pm-btn-accept:hover:not(:disabled){background:#4338ca}
//         .pm-btn-reject{background:#fff5f5;color:#dc2626;border:1.5px solid #fecaca}
//         .pm-btn-reject:hover:not(:disabled){background:#fee2e2}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <span className="np-title">Notifications</span>
//           {notifications.filter(n => !n.read).length > 0 && (
//             <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//           )}
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">When creators apply to your campaigns, you will see them here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply = isApplyNotif(n);
//               const status = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending = !isAccepted && !isRejected;

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`} onClick={() => !n.read && markRead(n._id)}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {isApply && (
//                         <div className="np-creator-strip" onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">{n.sender?.name || "View Creator Profile"}</div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading
//                             ? <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                             : <span className="np-view">View →</span>}
//                         </div>
//                       )}

//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "Accepted" : "Rejected"}
//                         </div>
//                       )}

//                       {isApply && (
//                         <div className="np-actions">
//                           {isPending ? (
//                             <>
//                               <button className="np-btn np-btn-accept" disabled={actionLoading === n._id + "_accept"}
//                                 onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
//                                 {actionLoading === n._id + "_accept" ? "..." : "Accept"}
//                               </button>
//                               <button className="np-btn np-btn-reject" disabled={actionLoading === n._id + "_reject"}
//                                 onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
//                                 {actionLoading === n._id + "_reject" ? "..." : "Reject"}
//                               </button>
//                             </>
//                           ) : isAccepted ? (
//                             <button className="np-btn np-btn-msg" onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                               Message Creator
//                             </button>
//                           ) : null}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>X</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               <div className="pm-location">{selectedProfile.location || ""}</div>
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                   .filter(Boolean).map((cat: string, i: number) => <span key={i} className="pm-tag">{cat}</span>)}
//               </div>
//             </div>

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers ? Number(selectedProfile.followers) >= 1000 ? Math.floor(Number(selectedProfile.followers) / 1000) + "K" : selectedProfile.followers : "---"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}</div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "OK" : "---"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>
//               {selectedProfile.bio && <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>}
//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && <div className="pm-banner pm-banner-accepted">You have accepted this creator!</div>}
//             {selectedProfile.status === "rejected" && <div className="pm-banner pm-banner-rejected">You have rejected this creator</div>}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading} onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading} onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-accept" style={{ flex: "none", width: "100%" }} onClick={() => goToMessage(selectedProfile)}>
//                   Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       setNotifications(data.data || data.notifications || []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);

//       let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

//       if (!creatorId && n.applicationId && n.link) {
//         const campaignId = n.link.split("/").pop();
//         const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const appData = await appRes.json();
//         const apps = appData.applications || appData.data || [];
//         const matched = apps.find((a: any) => a._id === n.applicationId);
//         creatorId = matched?.influencerId?._id || matched?.influencerId;
//         console.log("CREATOR ID:", creatorId);
//       }

//       if (!creatorId) {
//         alert("Creator profile not available");
//         return;
//       }

//       // Try /profile/:id first, then /profile/user/:id
//       let profile: any = null;
//       const r1 = await fetch(`${API}/profile/${creatorId}`, {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       if (r1.ok) {
//         const d1 = await r1.json();
//         profile = d1.profile || d1.data || d1;
//       } else {
//         const r2 = await fetch(`${API}/profile/user/${creatorId}`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const d2 = await r2.json();
//         profile = d2.profile || d2.data || d2;
//       }

//       console.log("CREATOR PROFILE:", profile);
//       setSelectedProfile({
//         ...profile,
//         applicationId: n.applicationId,
//         notifId: n._id,
//         status: n.applicationStatus || n.status,
//         campaignId: n.link?.split("/").pop(),
//       });
//     } catch (err) {
//       console.error(err);
//       alert("Could not load profile");
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message);
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected" } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = profile.user?._id || profile.user || profile._id;
//     const campaignId = profile.campaignId;
//     router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${campaignId}`);
//   };

//   const timeAgo = (date: string) => {
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   const isApplyNotif = (n: any) =>
//     n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

//   const getStatus = (n: any) => n.applicationStatus || n.status;

//   if (!user) return null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; justify-content: space-between; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
//         @media(max-width:600px) { .np-body { padding: 0 12px; margin: 16px auto; } .np-header { padding: 16px 20px; } }

//         .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; }
//         .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
//         .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }

//         .np-card-top { display: flex; gap: 12px; }
//         .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
//         .np-dot.read { background: #e0e0e0; }
//         .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
//         .np-time { font-size: 11px; color: #bbb; }

//         .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
//         .np-creator-strip:hover { background: #f0f0f0; border-color: #ddd; }
//         .np-avatar { width: 40px; height: 40px; border-radius: 50%; background: #e8e8e8; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: #666; flex-shrink: 0; overflow: hidden; }
//         .np-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .np-creator-name { font-size: 14px; font-weight: 700; color: #111; }
//         .np-creator-sub { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .np-view { font-size: 12px; color: #4f46e5; font-weight: 600; margin-left: auto; }

//         .np-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
//         .np-btn { padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .np-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .np-btn-accept { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-btn-accept:hover:not(:disabled) { background: #dcfce7; }
//         .np-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-btn-msg { background: #4f46e5; color: #fff; border: 1.5px solid #4f46e5; }
//         .np-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; margin-top: 10px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1px solid #fecaca; }

//         .np-empty { text-align: center; padding: 80px 20px; }
//         .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
//         .np-empty-sub { color: #aaa; font-size: 14px; }

//         /* PROFILE MODAL */
//         .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
//         @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

//         .pm-top { background: linear-gradient(135deg, #312e81 0%, #4f46e5 100%); border-radius: 22px 22px 0 0; padding: 28px 24px 24px; position: relative; }
//         .pm-close { position: absolute; top: 14px; right: 14px; background: rgba(255,255,255,0.15); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
//         .pm-close:hover { background: rgba(255,255,255,0.25); }
//         .pm-avatar-big { width: 76px; height: 76px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.4); background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 800; color: #fff; margin-bottom: 12px; overflow: hidden; }
//         .pm-avatar-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .pm-name { font-size: 20px; font-weight: 800; color: #fff; margin: 0 0 4px; }
//         .pm-location { font-size: 13px; color: rgba(255,255,255,0.65); margin: 0 0 12px; }
//         .pm-tags { display: flex; flex-wrap: wrap; gap: 6px; }
//         .pm-tag { padding: 3px 10px; border-radius: 100px; background: rgba(255,255,255,0.15); font-size: 11px; color: rgba(255,255,255,0.9); }

//         .pm-body { padding: 22px; display: flex; flex-direction: column; gap: 16px; }
//         .pm-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
//         .pm-stat { background: #fafafa; border-radius: 12px; padding: 12px; text-align: center; border: 1px solid #f0f0f0; }
//         .pm-stat-num { font-size: 17px; font-weight: 800; color: #111; }
//         .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
//         .pm-platform { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0; text-decoration: none; color: #111; font-size: 13px; font-weight: 500; transition: all 0.2s; }
//         .pm-platform:hover { background: #f0f0f0; }

//         .pm-banner { margin: 0 22px 16px; padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
//         .pm-banner-accepted { background: #f0fdf4; border: 1.5px solid #bbf7d0; color: #16a34a; }
//         .pm-banner-rejected { background: #fff5f5; border: 1.5px solid #fecaca; color: #dc2626; }

//         .pm-footer { padding: 0 22px 22px; display: flex; gap: 10px; }
//         .pm-btn { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .pm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pm-btn-accept { background: #4f46e5; color: #fff; }
//         .pm-btn-accept:hover:not(:disabled) { background: #4338ca; }
//         .pm-btn-reject { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .pm-btn-reject:hover:not(:disabled) { background: #fee2e2; }
//         .pm-btn-msg { background: #4f46e5; color: #fff; width: 100%; }
//         .pm-btn-msg:hover:not(:disabled) { background: #4338ca; }

//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto; }
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <div style={{ display: "flex", alignItems: "center" }}>
//             <span className="np-title">Notifications</span>
//             {notifications.filter(n => !n.read).length > 0 && (
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//             )}
//           </div>
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}>
//               <div className="spinner" />
//             </div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">When creators apply to your campaigns, you'll see them here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const isApply = isApplyNotif(n);
//               const status = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending = !isAccepted && !isRejected;

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>

//                       {/* Creator strip */}
//                       {isApply && (
//                         <div className="np-creator-strip" onClick={() => viewCreatorProfile(n)}>
//                           <div className="np-avatar">👤</div>
//                           <div style={{ flex: 1 }}>
//                             <div className="np-creator-name">View Creator Profile</div>
//                             <div className="np-creator-sub">Tap to see full profile</div>
//                           </div>
//                           {profileLoading ? (
//                             <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                           ) : (
//                             <span className="np-view">View →</span>
//                           )}
//                         </div>
//                       )}

//                       {/* Status */}
//                       {isApply && !isPending && (
//                         <div className={`np-status ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}

//                       {/* Actions */}
//                       {isApply && n.applicationId && (
//                         <div className="np-actions">
//                           {isPending ? (
//                             <>
//                               <button className="np-btn np-btn-accept"
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={() => acceptCreator(n.applicationId, n._id)}>
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button className="np-btn np-btn-reject"
//                                 disabled={actionLoading === n._id + "_reject"}
//                                 onClick={() => rejectCreator(n.applicationId, n._id)}>
//                                 {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                               </button>
//                             </>
//                           ) : isAccepted ? (
//                             <button className="np-btn np-btn-msg" onClick={() => viewCreatorProfile(n)}>
//                               💬 Message Creator
//                             </button>
//                           ) : null}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {/* PROFILE MODAL */}
//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{selectedProfile.name || "Creator"}</div>
//               <div className="pm-location">{selectedProfile.location || selectedProfile.city || ""}</div>
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories)
//                   ? selectedProfile.categories
//                   : [selectedProfile.categories]
//                 ).filter(Boolean).map((cat: string, i: number) => (
//                   <span key={i} className="pm-tag">{cat}</span>
//                 ))}
//               </div>
//             </div>

//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? Math.floor(Number(selectedProfile.followers) / 1000) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div>
//                   <div className="pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {selectedProfile.bio && (
//                 <div>
//                   <div className="pm-label">About</div>
//                   <div className="pm-bio">{selectedProfile.bio}</div>
//                 </div>
//               )}

//               {selectedProfile.platform && (
//                 <div>
//                   <div className="pm-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile.status === "accepted" && (
//               <div className="pm-banner pm-banner-accepted">✅ You've accepted this creator!</div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-banner pm-banner-rejected">❌ You've rejected this creator</div>
//             )}

//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button className="pm-btn pm-btn-accept" disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept"}
//                   </button>
//                   <button className="pm-btn pm-btn-reject" disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}>
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button className="pm-btn pm-btn-msg" style={{ flex: "none", width: "100%" }}
//                   onClick={() => goToMessage(selectedProfile)}>
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null); // Creator profile modal
//   const [profileLoading, setProfileLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState<string>(""); // which notif is loading

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const parsed = JSON.parse(storedUser);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("NOTIFICATIONS:", data);
//       // ✅ Backend {success:true, data:[...]} bhejta hai
//       setNotifications(data.data || data.notifications || []);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Creator profile fetch karo — notification mein se creatorId/influencerId lo
//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(true);

//       // ✅ Notification mein creatorId nahi — applicationId se application fetch karo
//       // phir application se influencerId/creatorId nikalo
//       let creatorId = n.creatorId || n.influencerId || n.applicantId || n.sender?._id || n.sender;

//       if (!creatorId && n.applicationId) {
//         // ✅ Campaign ID notification link se nikalo — /campaign/:id
//         const campaignId = n.link?.split("/").pop() || n.campaignId;
//         console.log("Fetching applications for campaign:", campaignId);

//         const appRes = await fetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const appData = await appRes.json();
//         console.log("APPLICATIONS DATA:", appData);

//         // applicationId se match karo
//         const apps = appData.applications || appData.data || [];
//         const matchedApp = apps.find((a: any) => a._id === n.applicationId);
//         console.log("MATCHED APP:", matchedApp);

//         // ✅ influencerId._id ya influencerId string
//         creatorId = matchedApp?.influencerId?._id || matchedApp?.influencerId;
//         console.log("CREATOR ID:", creatorId);
//       }

//       if (!creatorId) {
//         alert("Creator profile not available");
//         setProfileLoading(false);
//         return;
//       }
//     // Profile fetch karo
//     {
//       // ✅ Try /profile/:id — agar 404 aaye to /profile/user/:id
//       let profileData: any = null;
//       const r1 = await fetch(`${API}/profile/${creatorId}`, {
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       if (r1.ok) {
//         const d1 = await r1.json();
//         profileData = d1.profile || d1.data || d1;
//       } else {
//         const r2 = await fetch(`${API}/profile/user/${creatorId}`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         const d2 = await r2.json();
//         profileData = d2.profile || d2.data || d2;
//       }
//       console.log("CREATOR PROFILE:", profileData);
//       const profile = profileData;
//       setSelectedProfile({ ...profile, applicationId: n.applicationId, notifId: n._id, status: n.status || n.applicationStatus });
//     } catch (err) {
//       console.error(err);
//       alert("Could not load profile");
//     } finally {
//       setProfileLoading(false);
//     }
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       const data = await res.json();
//       console.log("ACCEPT:", data);
//       if (!res.ok) throw new Error(data.message);

//       // Update local state
//       setNotifications(prev => prev.map(n =>
//         n._id === notifId ? { ...n, applicationStatus: "accepted", status: "accepted" } : n
//       ));
//       if (selectedProfile?.notifId === notifId) {
//         setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//       }
//     } catch (err: any) {
//       alert(err.message || "Accept failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const res = await fetch(`${API}/application/${applicationId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       const data = await res.json();
//       console.log("REJECT:", data);
//       if (!res.ok) throw new Error(data.message);

//       setNotifications(prev => prev.map(n =>
//         n._id === notifId ? { ...n, applicationStatus: "rejected", status: "rejected" } : n
//       ));
//       if (selectedProfile?.notifId === notifId) {
//         setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//       }
//     } catch (err: any) {
//       alert(err.message || "Reject failed");
//     } finally {
//       setActionLoading("");
//     }
//   };

//   // ✅ Message page pe jaao with creator info
//   const goToMessage = (profile: any) => {
//     const creatorId = profile.user?._id || profile.user || profile._id;
//     router.push(`/messages?userId=${creatorId}&name=${encodeURIComponent(profile.name || "Creator")}`);
//   };

//   const isApplyNotif = (n: any) =>
//     n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

//   const getStatus = (n: any) => n.applicationStatus || n.status;

//   const timeAgo = (date: string) => {
//     const diff = Date.now() - new Date(date).getTime();
//     const mins = Math.floor(diff / 60000);
//     if (mins < 1) return "just now";
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     return `${Math.floor(hrs / 24)}d ago`;
//   };

//   if (!user) return null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
//         *{box-sizing:border-box}
//         .np{font-family:'DM Sans',sans-serif;background:#f5f5f0;min-height:100vh;padding:0 0 60px}
//         .np-header{background:#fff;border-bottom:1px solid #ebebeb;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}
//         .np-title{font-family:'Syne',sans-serif;font-size:24px;font-weight:800;color:#111;margin:0}
//         .np-count{background:#4f46e5;color:#fff;border-radius:100px;font-size:11px;font-weight:700;padding:3px 10px;margin-left:8px}
//         .np-body{max-width:720px;margin:28px auto;padding:0 20px;display:flex;flex-direction:column;gap:12px}
//         @media(max-width:600px){.np-body{padding:0 12px;margin:16px auto}}

//         /* NOTIFICATION CARD */
//         .np-card{background:#fff;border-radius:18px;border:1.5px solid #ebebeb;padding:20px;transition:all 0.2s;animation:fadeUp 0.3s ease both}
//         @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
//         .np-card.unread{border-color:#e0e7ff;background:linear-gradient(135deg,#fafbff 0%,#fff 100%)}
//         .np-card:hover{box-shadow:0 4px 20px rgba(0,0,0,0.06);transform:translateY(-1px)}

//         .np-card-top{display:flex;gap:14px;align-items:flex-start}
//         .np-dot{width:8px;height:8px;border-radius:50%;background:#6366f1;margin-top:6px;flex-shrink:0}
//         .np-dot.read{background:#e0e0e0}
//         .np-card-content{flex:1}
//         .np-type{font-size:11px;font-weight:700;color:#aaa;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:3px}
//         .np-msg{font-size:14px;color:#333;line-height:1.5;margin-bottom:4px}
//         .np-time{font-size:11px;color:#bbb}

//         /* PROFILE PREVIEW STRIP */
//         .np-creator-strip{display:flex;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;background:#fafafa;border-radius:12px;border:1px solid #f0f0f0;cursor:pointer;transition:all 0.2s}
//         .np-creator-strip:hover{background:#f5f5f0;border-color:#e0e0e0}
//         .np-creator-avatar{width:40px;height:40px;border-radius:50%;object-fit:cover;background:#e0e0e0;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
//         .np-creator-info{flex:1}
//         .np-creator-name{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:#111}
//         .np-creator-cat{font-size:12px;color:#888;margin-top:1px}
//         .np-view-btn{font-size:12px;color:#6366f1;font-weight:600}

//         /* ACTION BUTTONS */
//         .np-actions{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
//         .np-btn{padding:9px 18px;border-radius:10px;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .np-btn:disabled{opacity:0.5;cursor:not-allowed}
//         .np-btn-accept{background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0}
//         .np-btn-accept:hover:not(:disabled){background:#dcfce7}
//         .np-btn-reject{background:#fff5f5;color:#dc2626;border:1.5px solid #fecaca}
//         .np-btn-reject:hover:not(:disabled){background:#fee2e2}
//         .np-btn-msg{background:#4f46e5;color:#fff;border:1.5px solid #111}
//         .np-btn-msg:hover:not(:disabled){background:#4338ca}

//         .np-status-badge{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:100px;font-size:12px;font-weight:600;margin-top:10px}
//         .np-status-accepted{background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0}
//         .np-status-rejected{background:#fff5f5;color:#dc2626;border:1px solid #fecaca}

//         .np-empty{text-align:center;padding:80px 20px}
//         .np-empty-icon{font-size:48px;margin-bottom:16px}
//         .np-empty-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700;color:#111;margin:0 0 6px}
//         .np-empty-sub{color:#aaa;font-size:14px}

//         /* PROFILE MODAL */
//         .pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:999;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn 0.2s}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .pm-modal{background:#fff;border-radius:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;animation:slideUp 0.25s ease}
//         @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .pm-top{position:relative;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:24px 24px 0 0;padding:32px 24px 24px}
//         .pm-close{position:absolute;top:16px;right:16px;background:rgba(255,255,255,0.15);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:background 0.2s}
//         .pm-close:hover{background:rgba(255,255,255,0.25)}
//         .pm-avatar{width:80px;height:80px;border-radius:50%;border:3px solid rgba(255,255,255,0.3);object-fit:cover;margin-bottom:12px}
//         .pm-avatar-placeholder{width:80px;height:80px;border-radius:50%;border:3px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:12px}
//         .pm-name{font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:#fff;margin:0 0 4px}
//         .pm-role{font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 12px}
//         .pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .pm-tag{padding:4px 10px;border-radius:100px;background:rgba(255,255,255,0.12);font-size:11px;color:rgba(255,255,255,0.8);font-weight:500}

//         .pm-body{padding:24px}
//         .pm-section{margin-bottom:20px}
//         .pm-section-label{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px}
//         .pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .pm-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px}
//         .pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .pm-stat-num{font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:#111}
//         .pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .pm-platform{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500;transition:all 0.2s}
//         .pm-platform:hover{background:#f0f0f0}

//         .pm-footer{padding:0 24px 24px;display:flex;gap:10px;flex-wrap:wrap}
//         .pm-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;border:none;cursor:pointer;transition:all 0.2s;text-align:center;min-width:120px}
//         .pm-btn:disabled{opacity:0.5;cursor:not-allowed}
//         .pm-btn-accept{background:#4f46e5;color:#fff}
//         .pm-btn-accept:hover:not(:disabled){background:#4338ca}
//         .pm-btn-reject{background:#fff5f5;color:#dc2626;border:1.5px solid #fecaca}
//         .pm-btn-reject:hover:not(:disabled){background:#fee2e2}
//         .pm-btn-msg{background:#6366f1;color:#fff}
//         .pm-btn-msg:hover:not(:disabled){background:#4f46e5}
//         .pm-accepted-banner{margin:0 24px 16px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:8px}
//         .pm-rejected-banner{margin:0 24px 16px;background:#fff5f5;border:1.5px solid #fecaca;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:8px}
//         .pm-banner-text{font-size:13px;font-weight:600}
//         .pm-banner-accept-text{color:#16a34a}
//         .pm-banner-reject-text{color:#dc2626}
//       `}</style>

//       <div className="np">
//         {/* HEADER */}
//         <div className="np-header">
//           <div style={{display:"flex",alignItems:"center"}}>
//             <h1 className="np-title">Notifications</h1>
//             {notifications.filter(n => !n.read).length > 0 && (
//               <span className="np-count">{notifications.filter(n => !n.read).length} new</span>
//             )}
//           </div>
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{textAlign:"center",padding:"60px",color:"#aaa"}}>
//               <div style={{width:"32px",height:"32px",border:"3px solid #e0e0e0",borderTopColor:"#111",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 12px"}} />
//               <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//               <p style={{fontSize:"14px"}}>Loading notifications...</p>
//             </div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <h3 className="np-empty-title">No notifications yet</h3>
//               <p className="np-empty-sub">When creators apply to your campaigns, you'll see them here</p>
//             </div>
//           ) : (
//             notifications.map((n, idx) => {
//               const isApply = isApplyNotif(n);
//               const status = getStatus(n);
//               const isAccepted = status === "accepted";
//               const isRejected = status === "rejected";
//               const isPending = !isAccepted && !isRejected;

//               return (
//                 <div
//                   key={n._id}
//                   className={`np-card ${!n.read ? "unread" : ""}`}
//                   style={{animationDelay: `${idx * 0.05}s`}}
//                 >
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div className="np-card-content">
//                       <div className="np-type">
//                         {n.type?.replace(/_/g, " ") || "Notification"}
//                       </div>
//                       <p className="np-msg">{n.message}</p>
//                       <span className="np-time">{timeAgo(n.createdAt)}</span>

//                       {/* ✅ Creator profile strip — click karo profile dekho */}
//                       {isApply && (
//                         <div
//                           className="np-creator-strip"
//                           onClick={() => viewCreatorProfile(n)}
//                         >
//                           <div className="np-creator-avatar">
//                             {n.creatorImage ? (
//                               <img src={n.creatorImage} alt="creator" style={{width:"100%",height:"100%",borderRadius:"50%",objectFit:"cover"}} />
//                             ) : "👤"}
//                           </div>
//                           <div className="np-creator-info">
//                             <div className="np-creator-name">{n.creatorName || n.senderName || "View Creator"}</div>
//                             <div className="np-creator-cat">{n.categories || n.creatorCategory || "Tap to view full profile"}</div>
//                           </div>
//                           {profileLoading ? (
//                             <div style={{width:"16px",height:"16px",border:"2px solid #e0e0e0",borderTopColor:"#6366f1",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
//                           ) : (
//                             <span className="np-view-btn">View →</span>
//                           )}
//                         </div>
//                       )}

//                       {/* Status badge */}
//                       {isApply && !isPending && (
//                         <div className={`np-status-badge ${isAccepted ? "np-status-accepted" : "np-status-rejected"}`}>
//                           {isAccepted ? "✓ Accepted" : "✗ Rejected"}
//                         </div>
//                       )}

//                       {/* ✅ Accept / Reject / Message buttons */}
//                       {isApply && n.applicationId && (
//                         <div className="np-actions">
//                           {isPending ? (
//                             <>
//                               <button
//                                 className="np-btn np-btn-accept"
//                                 disabled={actionLoading === n._id + "_accept"}
//                                 onClick={() => acceptCreator(n.applicationId, n._id)}
//                               >
//                                 {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                               </button>
//                               <button
//                                 className="np-btn np-btn-reject"
//                                 disabled={actionLoading === n._id + "_reject"}
//                                 onClick={() => rejectCreator(n.applicationId, n._id)}
//                               >
//                                 {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                               </button>
//                             </>
//                           ) : isAccepted ? (
//                             <button
//                               className="np-btn np-btn-msg"
//                               onClick={() => viewCreatorProfile(n)}
//                             >
//                               💬 Message Creator
//                             </button>
//                           ) : null}
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </div>

//       {/* ✅ CREATOR PROFILE MODAL */}
//       {selectedProfile && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">

//             {/* Header — dark */}
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>

//               {selectedProfile.profileImage ? (
//                 <img src={selectedProfile.profileImage} alt="avatar" className="pm-avatar" />
//               ) : (
//                 <div className="pm-avatar-placeholder">👤</div>
//               )}

//               <h2 className="pm-name">{selectedProfile.name || "Creator"}</h2>
//               <p className="pm-role">{selectedProfile.location || selectedProfile.city || ""}</p>

//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories)
//                   ? selectedProfile.categories
//                   : [selectedProfile.categories]
//                 ).filter(Boolean).map((cat: string, i: number) => (
//                   <span key={i} className="pm-tag">{cat}</span>
//                 ))}
//                 {selectedProfile.platform && (
//                   <span className="pm-tag">📸 Instagram</span>
//                 )}
//               </div>
//             </div>

//             {/* Stats */}
//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.followers
//                       ? Number(selectedProfile.followers) >= 1000
//                         ? (Number(selectedProfile.followers) / 1000).toFixed(0) + "K"
//                         : selectedProfile.followers
//                       : "—"}
//                   </div>
//                   <div className="pm-stat-label">Followers</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}
//                   </div>
//                   <div className="pm-stat-label">Niches</div>
//                 </div>
//                 <div className="pm-stat">
//                   <div className="pm-stat-num">
//                     {selectedProfile.location ? "📍" : "—"}
//                   </div>
//                   <div className="pm-stat-label">{selectedProfile.location || "Location"}</div>
//                 </div>
//               </div>

//               {selectedProfile.bio && (
//                 <div className="pm-section">
//                   <div className="pm-section-label">About</div>
//                   <p className="pm-bio">{selectedProfile.bio}</p>
//                 </div>
//               )}

//               {selectedProfile.platform && (
//                 <div className="pm-section">
//                   <div className="pm-section-label">Platform</div>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" className="pm-platform">
//                     📸 {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//             </div>

//             {/* Status banner */}
//             {selectedProfile.status === "accepted" && (
//               <div className="pm-accepted-banner">
//                 <span>✅</span>
//                 <span className="pm-banner-text pm-banner-accept-text">You've accepted this creator!</span>
//               </div>
//             )}
//             {selectedProfile.status === "rejected" && (
//               <div className="pm-rejected-banner">
//                 <span>❌</span>
//                 <span className="pm-banner-text pm-banner-reject-text">You've rejected this creator</span>
//               </div>
//             )}

//             {/* Footer buttons */}
//             <div className="pm-footer">
//               {(!selectedProfile.status || selectedProfile.status === "pending") ? (
//                 <>
//                   <button
//                     className="pm-btn pm-btn-accept"
//                     disabled={!!actionLoading}
//                     onClick={() => acceptCreator(selectedProfile.applicationId, selectedProfile.notifId)}
//                   >
//                     {actionLoading.includes("accept") ? "..." : "✓ Accept Creator"}
//                   </button>
//                   <button
//                     className="pm-btn pm-btn-reject"
//                     disabled={!!actionLoading}
//                     onClick={() => rejectCreator(selectedProfile.applicationId, selectedProfile.notifId)}
//                   >
//                     {actionLoading.includes("reject") ? "..." : "✗ Reject"}
//                   </button>
//                 </>
//               ) : selectedProfile.status === "accepted" ? (
//                 <button
//                   className="pm-btn pm-btn-msg"
//                   style={{flex: "none", width: "100%"}}
//                   onClick={() => goToMessage(selectedProfile)}
//                 >
//                   💬 Message Creator
//                 </button>
//               ) : null}
//             </div>

//           </div>
//         </div>
//       )}
//     </>
//   );
// }
// right code"use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   // ✅ Load user
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     console.log("LOCAL USER 👉", storedUser);

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(storedUser);
//     console.log("PARSED USER 👉", parsed);

//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   // ✅ Fetch Notifications
//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);

//       console.log("FETCHING NOTIFICATIONS...");

//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();

//       console.log("NOTIFICATION RESPONSE 👉", data);

//       if (!res.ok) {
//         console.log("Notification error 👉", data);
//         return;
//       }

//       setNotifications(data.notifications || data.data || []);
//     } catch (err) {
//       console.log("FETCH ERROR 👉", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Accept Creator
//   const acceptCreator = async (applicationId: string) => {
//     try {
//       console.log("ACCEPT CLICK 👉", applicationId);

//       const res = await fetch(
//         `${API}/application/${applicationId}/decision`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${user.token}`,
//           },
//           body: JSON.stringify({ decision: "accepted" }),
//         }
//       );

//       const data = await res.json();
//       console.log("ACCEPT RESPONSE 👉", data);

//       if (!res.ok) throw new Error();

//       alert("Creator Accepted 🎉");
//       fetchNotifications(user.token);
//     } catch (err) {
//       console.log("ACCEPT ERROR 👉", err);
//       alert("Accept failed");
//     }
//   };

//   // ✅ Reject Creator
//   const rejectCreator = async (applicationId: string) => {
//     try {
//       console.log("REJECT CLICK 👉", applicationId);

//       const res = await fetch(
//         `${API}/application/${applicationId}/decision`,
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${user.token}`,
//           },
//           body: JSON.stringify({ decision: "rejected" }),
//         }
//       );

//       const data = await res.json();
//       console.log("REJECT RESPONSE 👉", data);

//       if (!res.ok) throw new Error();

//       alert("Creator Rejected ❌");
//       fetchNotifications(user.token);
//     } catch (err) {
//       console.log("REJECT ERROR 👉", err);
//       alert("Reject failed");
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-3xl mx-auto px-6 py-10">
//       <h1 className="text-3xl font-bold mb-8 text-slate-900">
//         Notifications
//       </h1>

//       {loading ? (
//         <p className="text-center text-slate-500">Loading...</p>
//       ) : notifications.length === 0 ? (
//         <p className="text-center text-slate-500">
//           No notifications found.
//         </p>
//       ) : (
//         <div className="space-y-4">
//           {notifications.map((n) => {
//             console.log("NOTIFICATION ITEM 👉", n);

//             return (
//               <div
//                 key={n._id}
//                 className={`p-6 rounded-3xl border transition-all hover:shadow-lg ${
//                   n.read
//                     ? "bg-white border-slate-200"
//                     : "bg-indigo-50 border-indigo-200"
//                 }`}
//               >
//                 <div className="flex justify-between items-start">
//                   <div>
//                     <h3 className="font-semibold text-slate-900 capitalize">
//                       {n.type?.replace("_", " ")}
//                     </h3>

//                     <p className="text-sm text-slate-600 mt-1">
//                       {n.message}
//                     </p>

//                     <p className="text-xs text-slate-400 mt-2">
//                       {new Date(n.createdAt).toLocaleString()}
//                     </p>
//                   </div>

//                   <div className="text-2xl">🔔</div>
//                 </div>

//                 {/* ✅ Accept / Reject Button */}
//                 {/* {n.type === "campaign_apply" && n.applicationId && ( */}
//                 {(n.type === "campaign_apply" || n.type === "new_application") && n.applicationId && (
//                   <div className="flex gap-3 mt-4">
//                     <button
//                       onClick={() =>
//                         acceptCreator(n.applicationId)
//                       }
//                       className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition"
//                     >
//                       Accept
//                     </button>

//                     <button
//                       onClick={() =>
//                         rejectCreator(n.applicationId)
//                       }
//                       className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition"
//                     >
//                       Reject
//                     </button>
//                   </div>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}
//     </div>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function NotificationsPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   // ✅ Load user
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsed = JSON.parse(storedUser);
//     setUser(parsed);
//     fetchNotifications(parsed.token);
//   }, []);

//   // ✅ Fetch Notifications
//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);

//       const res = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         console.log("Notification error 👉", data);
//         return;
//       }

//       setNotifications(data.notifications || data.data || []);
//     } catch (err) {
//       console.log(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Accept Creator
//   const acceptCreator = async (campaignId: string, creatorId: string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/accept`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${user.token}`,
//         },
//         body: JSON.stringify({ campaignId, creatorId }),
//       });

//       if (!res.ok) throw new Error();

//       alert("Creator Accepted 🎉");
//       fetchNotifications(user.token);
//     } catch {
//       alert("Accept failed");
//     }
//   };

//   // ✅ Reject Creator
//   const rejectCreator = async (campaignId: string, creatorId: string) => {
//     try {
//       const res = await fetch(`${API}/campaigns/reject`, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${user.token}`,
//         },
//         body: JSON.stringify({ campaignId, creatorId }),
//       });

//       if (!res.ok) throw new Error();

//       alert("Creator Rejected ❌");
//       fetchNotifications(user.token);
//     } catch {
//       alert("Reject failed");
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-3xl mx-auto px-6 py-10">
//       <h1 className="text-3xl font-bold mb-8 text-slate-900">
//         Notifications
//       </h1>

//       {loading ? (
//         <p className="text-center text-slate-500">Loading...</p>
//       ) : notifications.length === 0 ? (
//         <p className="text-center text-slate-500">
//           No notifications found.
//         </p>
//       ) : (
//         <div className="space-y-4">
//           {notifications.map((n) => (
//             <div
//               key={n._id}
//               className={`p-6 rounded-3xl border transition-all hover:shadow-lg ${
//                 n.read
//                   ? "bg-white border-slate-200"
//                   : "bg-indigo-50 border-indigo-200"
//               }`}
//             >
//               <div className="flex justify-between items-start">
//                 <div>
//                   <h3 className="font-semibold text-slate-900 capitalize">
//                     {n.type?.replace("_", " ")}
//                   </h3>

//                   <p className="text-sm text-slate-600 mt-1">
//                     {n.message}
//                   </p>

//                   <p className="text-xs text-slate-400 mt-2">
//                     {new Date(n.createdAt).toLocaleString()}
//                   </p>
//                 </div>

//                 <div className="text-2xl">
//                   🔔
//                 </div>
//               </div>

//               {/* ✅ Show Accept / Reject if campaign_apply */}
//               {n.type === "campaign_apply" && (
//                 <div className="flex gap-3 mt-4">
//                   <button
//                     onClick={() =>
//                       acceptCreator(n.campaignId, n.creatorId)
//                     }
//                     className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition"
//                   >
//                     Accept
//                   </button>

//                   <button
//                     onClick={() =>
//                       rejectCreator(n.campaignId, n.creatorId)
//                     }
//                     className="px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition"
//                   >
//                     Reject
//                   </button>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }