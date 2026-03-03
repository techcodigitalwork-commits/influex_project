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
      const notifs = data.data || data.notifications || [];
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

  const acceptCreator = async (applicationId: string, notifId: string) => {
    try {
      setActionLoading(notifId + "_accept");
      const res = await fetch(`${API}/application/${applicationId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ decision: "accepted" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      saveDecidedStatus(applicationId, "accepted");
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted" } : n));
      if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
    } catch (err: any) {
      alert(err.message || "Accept failed");
    } finally {
      setActionLoading("");
    }
  };

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

  const acceptConnect = async (n: any) => {
    try {
      setActionLoading(n._id + "_accept");
      const senderId = n.from?._id || n.fromId || n.senderId || n.from;
      const campaignId = n.campaignId || null;
      if (senderId) {
        await fetch(`${API}/conversations/create`, {
          method: "POST",
          headers: { Authorization: `Bearer ${user.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ participantId: senderId, campaignId }),
        });
      }
      saveConnectDecision(n._id, "accepted");
      setNotifications(prev => prev.map(notif => notif._id === n._id ? { ...notif, connectStatus: "accepted" } : notif));
    } catch (err) {
      console.error("Accept connect error:", err);
    } finally {
      setActionLoading("");
    }
  };

  const declineConnect = (n: any) => {
    saveConnectDecision(n._id, "rejected");
    setNotifications(prev => prev.map(notif => notif._id === n._id ? { ...notif, connectStatus: "rejected" } : notif));
  };

  const goToMessage = (profile: any) => {
    const creatorUserId = profile.user?._id || profile.user || profile._id;
    router.push(`/messages?userId=${creatorUserId}&name=${encodeURIComponent(profile.name || "Creator")}&campaignId=${profile.campaignId}`);
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

  const isApplyNotif = (n: any) =>
    n.type === "campaign_apply" || n.type === "new_application" || n.type === "application";

  const isConnectNotif = (n: any) =>
    n.type === "connect_request" || n.type === "connection_request" || n.type === "connect" ||
    (n.type === "new_message" && n.message?.toLowerCase().includes("connect"));

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
        .np-result-banner { margin-top: 12px; padding: 13px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
        .np-result-accepted { background: linear-gradient(135deg,#f0fdf4,#dcfce7); color: #15803d; border: 1.5px solid #86efac; }
        .np-result-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
        .np-empty { text-align: center; padding: 80px 20px; }
        .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .np-empty-sub { color: #aaa; font-size: 14px; }
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
              const isApply = isApplyNotif(n);
              const isConnect = isConnectNotif(n);
              const isDecision = isAppDecisionNotif(n);
              const status = getStatus(n);
              const isAccepted = status === "accepted";
              const isRejected = status === "rejected";
              const isPending = !isAccepted && !isRejected;
              const connectSt = n.connectStatus || "pending";

              return (
                <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}>
                  <div className="np-card-top">
                    <div className={`np-dot ${n.read ? "read" : ""}`} />
                    <div style={{ flex: 1 }}>
                      <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
                      <div className="np-msg">{n.message}</div>
                      <div className="np-time">{timeAgo(n.createdAt)}</div>

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

                      {isConnect && (
                        <div className="np-connect-card">
                          <div className="np-connect-brand">
                            <div className="np-connect-brand-av">
                              {n.fromImage ? <img src={n.fromImage} alt="brand" /> : (n.fromName || "B").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="np-connect-brand-name">{n.fromName || n.from?.name || "A Brand"}</div>
                              <div className="np-connect-brand-sub">wants to connect with you 🤝</div>
                            </div>
                          </div>
                          {connectSt === "accepted" ? (
                            <div className="np-connect-actions">
                              <div className="np-decision-banner np-decision-accepted" style={{ flex: 1, margin: 0 }}>✓ Connected!</div>
                              <button className="np-btn np-btn-msg" style={{ whiteSpace: "nowrap" }}
                                onClick={() => { const sid = n.from?._id || n.fromId || n.senderId || n.from; if (sid) router.push(`/messages?with=${sid}`); }}>
                                💬 Chat
                              </button>
                            </div>
                          ) : connectSt === "rejected" ? (
                            <div className="np-connect-actions">
                              <div className="np-decision-banner np-decision-rejected" style={{ flex: 1, margin: 0 }}>✗ Request Declined</div>
                            </div>
                          ) : (
                            <div className="np-connect-actions">
                              <button className="np-btn np-btn-accept" style={{ flex: 1 }}
                                disabled={actionLoading === n._id + "_accept"}
                                onClick={() => acceptConnect(n)}>
                                {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
                              </button>
                              <button className="np-btn np-btn-reject" style={{ flex: 1 }} onClick={() => declineConnect(n)}>
                                ✗ Decline
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {isDecision && (
                        <div className={`np-result-banner ${n.type?.includes("accept") || n.type === "accepted" ? "np-result-accepted" : "np-result-rejected"}`}>
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
                {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
                  .filter(Boolean).map((cat: string, i: number) => (
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