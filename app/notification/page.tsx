"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const API = "https://api.collabzy.in/api";

const FOLLOWER_LABELS: Record<string, string> = {
  "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
  "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
};

const formatFollowers = (f: any): string => {
  if (!f && f !== 0) return "—";
  const key = String(f);
  if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
  const num = Number(f);
  if (!isNaN(num) && num >= 1000) return Math.floor(num / 1000) + "K";
  return String(f);
};

const safeFetch = async (url: string, options: RequestInit = {}) => {
  try {
    const res  = await fetch(url, options);
    const text = await res.text();
    if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
    const data = JSON.parse(text);
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
};

const extractMongoId = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === "string" && val.length > 0 && !/\s/.test(val)) return val;
  if (typeof val === "object") {
    const id = val._id || val.id;
    if (typeof id === "string") return id;
    if (typeof id === "object") return extractMongoId(id);
  }
  return null;
};

const syncDecisionToLocalStorage = (appId: string, decision: "accepted" | "rejected") => {
  try {
    const existing = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
    existing[appId] = decision;
    localStorage.setItem("decidedApplications", JSON.stringify(existing));
  } catch {}
};

// ─── Module-level profile cache (persists across re-renders, cleared on logout) ──
const profileCache: Record<string, any> = {};

export default function NotificationsPage() {
  const router = useRouter();

  const [user, setUser]                       = useState<any>(null);
  const [userRole, setUserRole]               = useState<string>("");
  const [notifications, setNotifications]     = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading]   = useState<string>("");
  const [actionLoading, setActionLoading]     = useState("");
  const [creatorNames, setCreatorNames]       = useState<Record<string, string>>({});
  const [inviteLoading, setInviteLoading]     = useState<string>("");

  // ─── Fetch ONCE on mount, no intervals, no polling ───────────────────────
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const stored = localStorage.getItem("cb_user");
    if (!stored) { router.push("/login"); return; }

    const parsed = JSON.parse(stored);
    setUser(parsed);
    setUserRole((parsed.role || parsed.user?.role || "").toLowerCase());
    fetchNotifications(parsed);
  }, []);

  // ─── Profile fetcher — uses module-level cache ────────────────────────────
  const fetchProfile = async (userId: string, token: string): Promise<any | null> => {
    if (!userId) return null;
    if (profileCache[userId]) return profileCache[userId];
    const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (ok && data) {
      const p = data.profile || data.data || (data._id ? data : null);
      if (p) { profileCache[userId] = p; return p; }
    }
    return null;
  };

  // ─── Main fetch — ONE call, then batch profile lookups ────────────────────
  const fetchNotifications = async (parsedUser: any) => {
    const token = parsedUser.token;
    try {
      setLoading(true); 

      const { data } = await safeFetch(`${API}/notification?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const list          = data?.data || data?.notifications || [];
      const savedStatuses = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
      const savedInvite   = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");

      // Filter & deduplicate
      const filtered = list.filter((n: any) => n.type !== "new_message");
      const seen     = new Map<string, any>();
      for (const n of filtered) {
        const key      = n.applicationId || n._id;
        const existing = seen.get(key);
        if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) seen.set(key, n);
      }
      const deduped = Array.from(seen.values());
      const merged  = deduped.map((n: any) => ({
        ...n,
        applicationStatus: n.applicationStatus || savedStatuses[n._id] || "",
        _inviteStatus: savedInvite[n._id] || "",
      }));
      setNotifications(merged);

      // ── Mark all unread as read in one go (fire-and-forget) ──────────────
      const unreadIds = merged.filter((n: any) => !n.read).map((n: any) => n._id);
      if (unreadIds.length > 0) {
        // Optimistically mark all read in local state + localStorage
        localStorage.setItem("notif_all_read", "true");
        window.dispatchEvent(new StorageEvent("storage", { key: "notif_all_read", newValue: "true" }));
        // Fire PATCHes in background — don't await, don't block UI
        unreadIds.forEach(id => {
          safeFetch(`${API}/notification/read/${id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        });
      }

      // ── Batch fetch sender profiles — only unique senderIds,  Name ke liye comment code hatha pdega use cache ────
      const senderIds = Array.from(
        new Set(merged.map((n: any) => extractMongoId(n.sender)).filter(Boolean))
      ) as string[];

      if (senderIds.length > 0) {
        // Fetch only uncached ones
        // const uncached = senderIds.filter(id => !profileCache[id]);
        // await Promise.all(
        //   uncached.map(id => fetchProfile(id, token)) // fills profileCache
        // );
        // Now build names map from cache
        // Names directly from notification data — no extra API calls

        // const names: Record<string, string> = {};
        // for (const n of merged) {
        //   const sid = extractMongoId(n.sender);
        //   if (sid && profileCache[sid]) {
        //     names[n._id] = profileCache[sid].name || profileCache[sid].companyName || "";
        //   }
        // }
        // setCreatorNames(names);

        // No profile fetching on load — names from notification data only
const names: Record<string, string> = {};
for (const n of merged) {
  const name =
    n.senderName ||
    n.sender?.name ||
    n.sender?.companyName ||
    n.data?.senderName ||
    "";
  if (name) names[n._id] = name;
}
setCreatorNames(names);


   


      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── markRead: only patch if actually unread, no loop ────────────────────
  const markRead = async (notifId: string) => {
    const notif = notifications.find(n => n._id === notifId);
    if (!notif || notif.read) return;
    // Optimistic update
    setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
    try {
      await safeFetch(`${API}/notification/read/${notifId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch {}
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
    if (unreadIds.length === 0) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    localStorage.setItem("notif_all_read", "true");
    window.dispatchEvent(new StorageEvent("storage", { key: "notif_all_read", newValue: "true" }));
    // Fire-and-forget in background
    unreadIds.forEach(id =>
      safeFetch(`${API}/notification/read/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${user.token}` },
      }).catch(() => {})
    );
  };

  const sendNotif = async (creatorId: string, type: string, message: string, appId: string) => {
    try {
      await safeFetch(`${API}/notification/craete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ userId: creatorId, sender: user.id, message, type, applicationId: appId, link: "/notification" }),
      });
    } catch {}
  };

  const blurName = (name: string, showFull = false) => {
    if (!name) return <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>Xxxxxxx</span>;
    const parts = name.trim().split(" ");
    if (parts.length === 1 || showFull) return <span>{name}</span>;
    return (
      <span>
        {parts[0]}{" "}
        <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>{parts.slice(1).join(" ")}</span>
      </span>
    );
  };

  const getCampaignId = (n: any): string | null => {
    if (extractMongoId(n?.campaignId)) return extractMongoId(n?.campaignId);
    if (extractMongoId(n?.data?.campaignId)) return extractMongoId(n?.data?.campaignId);
    const parts   = (n?.link || "").split("/").filter(Boolean);
    const validId = parts.find((p: string) => /^[a-f0-9]{24}$/i.test(p));
    return validId || null;
  };

  const saveStatusLocally = (notifId: string, status: string) => {
    try {
      const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
      existing[notifId] = status;
      localStorage.setItem("cb_notif_status", JSON.stringify(existing));
    } catch {}
  };

  // ─── getApplicationId: tries notif data first, avoids extra fetch if possible ──
  const getApplicationId = async (applicationId: string, notifId: string): Promise<string> => {
    if (applicationId && /^[a-f0-9]{24}$/i.test(applicationId)) return applicationId;
    const n = notifications.find(x => x._id === notifId);
    if (!n) return applicationId || "";
    // Try applicationId from notif fields before hitting API
    const fromNotif = extractMongoId(n.applicationId) || extractMongoId(n.data?.applicationId);
    if (fromNotif && /^[a-f0-9]{24}$/i.test(fromNotif)) return fromNotif;
    const campId = getCampaignId(n);
    if (!campId) return applicationId || "";
    const { ok, data } = await safeFetch(`${API}/campaigns/${campId}/applications`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    if (!ok || !data) return applicationId || "";
    const apps     = data.applications || data.data || [];
    const senderId = extractMongoId(n.sender);
    const app      = apps.find((a: any) =>
      extractMongoId(a.influencerId) === senderId || extractMongoId(a.influencer) === senderId
    ) || apps[apps.length - 1];
    return app?._id || applicationId || "";
  };

  const acceptCreator = async (applicationId: string, notifId: string) => {
    try {
      setActionLoading(notifId + "_accept");
      const realAppId = await getApplicationId(applicationId, notifId);
      if (!realAppId) { alert("Application not found"); return; }
      const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ decision: "accepted" }),
      });
      if (!result.ok) {
        const errMsg = result.data?.message || "Accept failed";
        if (!errMsg.toLowerCase().includes("already")) throw new Error(errMsg);
      }
      syncDecisionToLocalStorage(realAppId, "accepted");
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted", applicationId: realAppId } : n));
      if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
      saveStatusLocally(notifId, "accepted");
      try {
        const n         = notifications.find(x => x._id === notifId);
        const creatorId = extractMongoId(n?.sender);
        const campId    = getCampaignId(n) || "";
        if (creatorId) {
          await sendNotif(creatorId, "application_accepted", "🎉 Your application has been accepted!", realAppId);
          const r = await safeFetch(`${API}/conversations/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
            body: JSON.stringify({ participantId: creatorId, campaignId: campId }),
          });
          const convId = r.data?.data?._id || r.data?.conversation?._id || r.data?._id || "";
          if (convId) {
            await safeFetch(`${API}/conversations/send/${convId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
              body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
            });
          }
        }
      } catch {}
    } catch (err: any) {
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Accept failed" } : n));
    } finally {
      setActionLoading("");
    }
  };

  const rejectCreator = async (applicationId: string, notifId: string) => {
    try {
      setActionLoading(notifId + "_reject");
      const realAppId = await getApplicationId(applicationId, notifId);
      if (!realAppId) { alert("Application not found"); return; }
      const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ decision: "rejected" }),
      });
      if (!result.ok) throw new Error(result.data?.message || "Reject failed");
      syncDecisionToLocalStorage(realAppId, "rejected");
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected", applicationId: realAppId } : n));
      if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
      saveStatusLocally(notifId, "rejected");
      try {
        const n         = notifications.find(x => x._id === notifId);
        const creatorId = extractMongoId(n?.sender);
        if (creatorId) await sendNotif(creatorId, "application_rejected", "Your application was not selected this time. Keep applying! 💪", realAppId);
      } catch {}
    } catch (err: any) {
      setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Reject failed" } : n));
    } finally {
      setActionLoading("");
    }
  };

  const handleInviteResponse = async (n: any, action: "accepted" | "rejected") => {
    const inviteId = extractMongoId(n.data?.inviteId) || extractMongoId(n.inviteId) || "";
    if (!inviteId) { alert("Invite ID not found. Please refresh."); return; }
    setInviteLoading(n._id + "_" + action);
    try {
      const { ok, data } = await safeFetch(`${API}/invite/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ inviteId, action }),
      });
      if (!ok) { alert(data?.message || "Failed to respond"); return; }
      const saved = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");
      saved[n._id] = action;
      localStorage.setItem("cb_invite_status", JSON.stringify(saved));
      setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, _inviteStatus: action, read: true } : x));
      if (action === "accepted" && data?.conversation?._id) router.push("/messages");
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setInviteLoading("");
    }
  };

  // ─── View creator profile — uses cache first ──────────────────────────────
  const viewCreatorProfile = async (n: any) => {
    try {
      setProfileLoading(n._id);
      const senderId = extractMongoId(n.sender);
      if (senderId) {
        const profile = await fetchProfile(senderId, user.token);
        if (profile) {
          setCreatorNames(prev => ({ ...prev, [n._id]: profile.name || prev[n._id] }));
          setSelectedProfile({
            ...profile,
            notifId: n._id,
            status: n.applicationStatus,
            campaignId: getCampaignId(n),
            link: n.link,
          });
          return;
        }
      }
      setSelectedProfile({
        name: "Creator", profileImage: null, bio: "", followers: "",
        categories: [], platform: "", notifId: n._id,
        status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link, _noProfile: true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setProfileLoading("");
    }
  };

  const goToMessage = (profile: any) => {
    const creatorUserId = extractMongoId(profile.user) || extractMongoId(profile) || profile._id || "";
    const campId        = profile.campaignId || getCampaignId({ link: profile.link }) || "";
    router.push(`/messages?userId=${creatorUserId}&campaignId=${campId}`);
  };

  const timeAgo = (date: string) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const isBrandApplyNotif       = (n: any) => ["new_application", "campaign_apply", "application"].includes(n.type);
  const isInfluencerStatusNotif = (n: any) => ["application_accepted", "application_rejected", "application_status", "campaign_update"].includes(n.type);

  const getStatus = (n: any) => {
    const s = n.applicationStatus || n.application?.status || "";
    if (s) return s.toLowerCase();
    if (n.type === "campaign_update")      return "rejected";
    if (n.type === "application_rejected") return "rejected";
    if (n.type === "application_accepted") return "accepted";
    return "";
  };

  if (!user) return null;
  const isBrand = userRole === "brand";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
        .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; }
        .np-title { font-size: 22px; font-weight: 800; color: #111; }
        .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
        .np-mark-all-btn { margin-left: auto; background: none; border: none; font-size: 12px; font-weight: 600; color: #4f46e5; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px 8px; border-radius: 8px; }
        .np-mark-all-btn:hover { background: #eef2ff; }
        .np-body { max-width: 680px; margin: 28px auto; padding: 0 20px; display: flex; flex-direction: column; gap: 12px; }
        @media(max-width:600px){.np-body{padding:0 12px;margin:16px auto}.np-header{padding:16px 20px}}
        .np-card { background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; padding: 18px 20px; transition: all 0.2s; cursor: pointer; }
        .np-card.unread { border-color: #c7d2fe; background: #fafbff; }
        .np-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .np-card-top { display: flex; gap: 12px; }
        .np-dot { width: 8px; height: 8px; border-radius: 50%; background: #4f46e5; margin-top: 6px; flex-shrink: 0; }
        .np-dot.read { background: #e0e0e0; }
        .np-type { font-size: 11px; font-weight: 700; color: #aaa; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
        .np-msg { font-size: 14px; color: #333; line-height: 1.5; margin-bottom: 4px; }
        .np-time { font-size: 11px; color: #bbb; }
        .np-creator-strip { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding: 12px 14px; background: #fafafa; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.2s; }
        .np-creator-strip:hover { background: #eff6ff; border-color: #bfdbfe; }
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
        .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 100px; font-size: 13px; font-weight: 700; margin-top: 12px; }
        .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
        .np-status-pending { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; }
        .np-msg-btn { margin-top: 10px; padding: 10px 18px; background: #4f46e5; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
        .np-msg-btn:hover { background: #4338ca; }
        .np-invite-card { margin-top: 14px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); border-radius: 14px; padding: 16px; border: 1.5px solid #c7d2fe; }
        .np-invite-title { font-size: 14px; font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
        .np-invite-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
        .np-invite-actions { display: flex; gap: 8px; }
        .np-invite-accept { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; transition: all 0.2s; }
        .np-invite-accept:hover:not(:disabled) { transform: translateY(-1px); }
        .np-invite-accept:disabled { opacity: 0.6; cursor: not-allowed; }
        .np-invite-reject { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #fecaca; cursor: pointer; background: #fff5f5; color: #dc2626; transition: all 0.2s; }
        .np-invite-reject:hover:not(:disabled) { background: #fee2e2; }
        .np-invite-reject:disabled { opacity: 0.6; cursor: not-allowed; }
        .np-empty { text-align: center; padding: 80px 20px; }
        .np-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .np-empty-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 6px; }
        .np-empty-sub { color: #aaa; font-size: 14px; }
        .pm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999; display: flex; align-items: center; justify-content: center; padding: 16px; animation: fadeIn 0.2s; }
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .pm-modal { background: #fff; border-radius: 22px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; animation: slideUp 0.25s ease; }
        @keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
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
        .pm-stat-num { font-size: 17px; font-weight: 800; color: #4f46e5; }
        .pm-stat-label { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
        .pm-label { font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .pm-bio { font-size: 14px; color: #555; line-height: 1.7; }
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
        @keyframes spin{to{transform:rotate(360deg)}}
        .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
      `}</style>

      <div className="np">
        <div className="np-header">
          <span className="np-title">Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <>
              <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
              <button className="np-mark-all-btn" onClick={markAllRead}>Mark all read</button>
            </>
          )}
        </div>

        <div className="np-body">
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
          ) : notifications.length === 0 ? (
            <div className="np-empty">
              <div className="np-empty-icon">🔔</div>
              <div className="np-empty-title">No notifications yet</div>
              <div className="np-empty-sub">Your notifications will appear here</div>
            </div>
          ) : (
            notifications.map((n) => {
              const status             = getStatus(n);
              const isAccepted         = status === "accepted";
              const isRejected         = status === "rejected";
              const isPending          = !isAccepted && !isRejected;
              const showBrandActions   = isBrand && isBrandApplyNotif(n);
              // const showInviteActions  = !isBrand && n.type === "invite";
              const showInviteActions = !isBrand && (
  n.type === "invite" ||
  n.type?.toLowerCase().includes("invite")
);
              const inviteStatus       = n._inviteStatus || "";
              const inviteAccepted     = inviteStatus === "accepted";
              const inviteRejected     = inviteStatus === "rejected";
              const showInfluencerStatus = !isBrand && !showInviteActions && (isInfluencerStatusNotif(n) || n.applicationStatus);

              return (
                <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}
                  onClick={() => markRead(n._id)}>
                  <div className="np-card-top">
                    <div className={`np-dot ${n.read ? "read" : ""}`} />
                    <div style={{ flex: 1 }}>
                      <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
                      <div className="np-msg">{n.message}</div>
                      <div className="np-time">{timeAgo(n.createdAt)}</div>
                      {n._error && (
                        <div style={{ marginTop:8, padding:"8px 12px", background:"#fff5f5", border:"1px solid #fecaca", borderRadius:8, fontSize:12, color:"#dc2626", fontWeight:600 }}>
                          ⚠️ {n._error}
                        </div>
                      )}

                      {showBrandActions && (
                        <>
                          <div className="np-creator-strip"
                            onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
                            <div className="np-avatar">👤</div>
                            <div style={{ flex: 1 }}>
                              <div className="np-creator-name">{blurName(creatorNames[n._id] || "Creator", isAccepted)}</div>
                              <div className="np-creator-sub">View Profile →</div>
                            </div>
                            {profileLoading === n._id
                              ? <div style={{ width:"16px", height:"16px", border:"2px solid #e0e0e0", borderTopColor:"#4f46e5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                              : <span className="np-view">View →</span>}
                          </div>
                          <div className="np-actions">
                            {isPending ? (
                              <>
                                <button className="np-btn np-btn-accept"
                                  disabled={actionLoading === n._id + "_accept"}
                                  onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
                                  {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
                                </button>
                                <button className="np-btn np-btn-reject"
                                  disabled={actionLoading === n._id + "_reject"}
                                  onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
                                  {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
                                </button>
                              </>
                            ) : isAccepted ? (
                              <>
                                <div className="np-status np-status-accepted">✓ Accepted</div>
                                <button className="np-btn np-btn-msg"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const creatorId = extractMongoId(n.sender);
                                    const campId    = getCampaignId(n) || "";
                                    router.push(creatorId ? `/messages?userId=${creatorId}&campaignId=${campId}` : "/messages");
                                  }}>
                                  💬 Message Creator
                                </button>
                              </>
                            ) : (
                              <div className="np-status np-status-rejected">✗ Rejected</div>
                            )}
                          </div>
                        </>
                      )}

                      {showInviteActions && (
                        <div className="np-invite-card" onClick={e => e.stopPropagation()}>
                          <div className="np-invite-title">🤝 Brand wants to connect!</div>
                          <div className="np-invite-sub">Accept to start chatting and collaborate on their campaign.</div>
                          {!inviteAccepted && !inviteRejected ? (
                            <div className="np-invite-actions">
                              <button className="np-invite-accept"
                                disabled={inviteLoading === n._id + "_accepted"}
                                onClick={() => handleInviteResponse(n, "accepted")}>
                                {inviteLoading === n._id + "_accepted" ? "Accepting..." : "✓ Accept"}
                              </button>
                              <button className="np-invite-reject"
                                disabled={inviteLoading === n._id + "_rejected"}
                                onClick={() => handleInviteResponse(n, "rejected")}>
                                {inviteLoading === n._id + "_rejected" ? "..." : "✗ Decline"}
                              </button>
                            </div>
                          ) : inviteAccepted ? (
                            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                              <div style={{ fontSize:13, fontWeight:600, color:"#4f46e5", marginBottom:2 }}>
                                🏢 {creatorNames[n._id] || "Brand"}
                              </div>
                              <div className="np-status np-status-accepted">✅ Connected! Chat is open.</div>
                              <button className="np-msg-btn" onClick={() => router.push("/messages")}>💬 Go to Messages</button>
                            </div>
                          ) : (
                            <div className="np-status np-status-rejected">✗ Declined</div>
                          )}
                        </div>
                      )}

                      {showInfluencerStatus && (
                        <div style={{ marginTop:"10px" }}>
                          <div style={{ fontSize:12, color:"#888", marginBottom:6, display:"flex", alignItems:"center", gap:6 }}>
                            <span>🏢</span>
                            <span style={{ fontWeight:600, color:"#555" }}>{creatorNames[n._id] || "Brand"}</span>
                            <span style={{ color:"#bbb" }}>reviewed your application</span>
                          </div>
                          {isAccepted ? (
                            <>
                              <div className="np-status np-status-accepted">✅ Application Accepted!</div>
                              <button className="np-msg-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const brandId = extractMongoId(n.sender);
                                  const campId  = getCampaignId(n) || "";
                                  router.push(brandId ? `/messages?userId=${brandId}&campaignId=${campId}` : "/messages");
                                }}>
                                💬 Chat with Brand
                              </button>
                            </>
                          ) : isRejected ? (
                            <div className="np-status np-status-rejected">❌ Application Not Selected</div>
                          ) : (
                            <div className="np-status np-status-pending">⏳ Application Under Review</div>
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

      {selectedProfile && isBrand && (
        <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
          <div className="pm-modal">
            <div className="pm-top">
              <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
              <div className="pm-avatar-big">
                {selectedProfile.profileImage
                  ? <img src={selectedProfile.profileImage} alt="avatar" />
                  : (selectedProfile.name || "C").charAt(0).toUpperCase()}
              </div>
              <div className="pm-name">{(() => {
                const name  = selectedProfile.name || "Creator";
                const parts = name.trim().split(" ");
                if (parts.length === 1 || selectedProfile.status === "accepted") return <span>{name}</span>;
                return <span>{parts[0]} <span style={{ filter:"blur(4px)", userSelect:"none" }}>{parts.slice(1).join(" ")}</span></span>;
              })()}</div>
              {selectedProfile.location && <div className="pm-location">📍 {selectedProfile.location}</div>}
              <div className="pm-tags">
                {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
                  .filter(Boolean).map((cat: string, i: number) => <span key={i} className="pm-tag">{cat}</span>)}
              </div>

                {selectedProfile.subCategories &&
  (Array.isArray(selectedProfile.subCategories) 
    ? selectedProfile.subCategories 
    : [selectedProfile.subCategories]
  ).filter(Boolean).length > 0 && (
  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:6 }}>
    {(Array.isArray(selectedProfile.subCategories) 
      ? selectedProfile.subCategories 
      : [selectedProfile.subCategories]
    ).filter(Boolean).map((sub: string, i: number) => (
      <span key={i} className="pm-tag" style={{ background:"rgba(187,247,208,0.25)", color:"#86efac", border:"1px solid rgba(187,247,208,0.4)" }}>
        {sub}
      </span>
    ))}
  </div>
)}

            </div>
            <div className="pm-body">
              <div className="pm-stats">
                <div className="pm-stat"><div className="pm-stat-num">{formatFollowers(selectedProfile.followers)}</div><div className="pm-stat-label">Followers</div></div>
                <div className="pm-stat"><div className="pm-stat-num">{Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}</div><div className="pm-stat-label">Niches</div></div>
                <div className="pm-stat"><div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div><div className="pm-stat-label">Platform</div></div>
              </div>
              {selectedProfile.bio && <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>}
            </div>
            {selectedProfile.status === "accepted" && <div className="pm-banner pm-banner-accepted">✅ You have accepted this creator!</div>}
            {selectedProfile.status === "rejected" && <div className="pm-banner pm-banner-rejected">❌ You have rejected this creator</div>}
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
                <button className="pm-btn pm-btn-accept" style={{ flex:"none", width:"100%" }}
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

// import { useEffect, useState ,useRef} from "react";
// import { useRouter } from "next/navigation";

// const API = "https://api.collabzy.in/api";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
//   "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
// };

// const formatFollowers = (f: any): string => {
//   if (!f && f !== 0) return "—";
//   const key = String(f);
//   if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//   const num = Number(f);
//   if (!isNaN(num) && num >= 1000) return Math.floor(num / 1000) + "K";
//   return String(f);
// };

// const safeFetch = async (url: string, options: RequestInit = {}) => {
//   try {
//     const res  = await fetch(url, options);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// const extractMongoId = (val: any): string | null => {
//   if (!val) return null;
//   if (typeof val === "string" && val.length > 0 && !/\s/.test(val)) return val;
//   if (typeof val === "object") {
//     const id = val._id || val.id;
//     if (typeof id === "string") return id;
//     if (typeof id === "object") return extractMongoId(id);
//   }
//   return null;
// };

// // ✅ Sync accepted/rejected status to Campaign Applications localStorage
// // So when brand goes to Campaign Applications page, it already shows correct status
// const syncDecisionToLocalStorage = (appId: string, decision: "accepted" | "rejected") => {
//   try {
//     const existing = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     existing[appId] = decision;
//     localStorage.setItem("decidedApplications", JSON.stringify(existing));
//   } catch { /* silent */ }
// };

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser]                   = useState<any>(null);
//   const [userRole, setUserRole]           = useState<string>("");
//   const profileCache                      = useState<Record<string, any>>({})[0];
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading]             = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading]   = useState<string>("");
//   const [actionLoading, setActionLoading]     = useState("");
//   const [creatorNames, setCreatorNames]       = useState<Record<string, string>>({});
//   const [inviteLoading, setInviteLoading]     = useState<string>("");

//   // useEffect(() => {
//   //   if (typeof window === "undefined") return;
//   //   const stored = localStorage.getItem("cb_user");
//   //   if (!stored) { router.push("/login"); return; }
//   //   const parsed = JSON.parse(stored);
//   //   setUser(parsed);
//   //   const role = parsed.role || parsed.user?.role || "";
//   //   setUserRole(role.toLowerCase());
//   //   fetchNotifications(parsed.token);

//   //   const handleVisibility = () => {
//   //     if (document.visibilityState === "visible") {
//   //       const u = localStorage.getItem("cb_user");
//   //       if (u) fetchNotifications(JSON.parse(u).token);
//   //     }
//   //   };
//   //   document.addEventListener("visibilitychange", handleVisibility);
//   //   return () => document.removeEventListener("visibilitychange", handleVisibility);
//   // }, []);

// //   useEffect(() => {
// //   if (typeof window === "undefined") return;

// //   const stored = localStorage.getItem("cb_user");
// //   if (!stored) {
// //     router.push("/login");
// //     return;
// //   }

// //   const parsed = JSON.parse(stored);
// //   setUser(parsed);

// //   const role = parsed.role || parsed.user?.role || "";
// //   setUserRole(role.toLowerCase());

// //   // ✅ ONLY ONE API CALL
// //   fetchNotifications(parsed.token);

// // }, []);

// const hasFetched = useRef(false);

// useEffect(() => {
//   if (hasFetched.current) return; // already fetched
//   hasFetched.current = true;

//   const stored = localStorage.getItem("cb_user");
//   if (!stored) { router.push("/login"); return; }

//   const parsed = JSON.parse(stored);
//   setUser(parsed);

//   const role = parsed.role || parsed.user?.role || "";
//   setUserRole(role.toLowerCase());

//   fetchNotifications(parsed.token);

// }, []);


//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const { data } = await safeFetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const list          = data?.data || data?.notifications || [];
//       const savedStatuses = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const savedInvite   = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");

//       const filtered = list.filter((n: any) => n.type !== "new_message");

//       const seen = new Map<string, any>();
//       for (const n of filtered) {
//         const key      = n.applicationId || n._id;
//         const existing = seen.get(key);
//         if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
//           seen.set(key, n);
//         }
//       }
//       const deduped = Array.from(seen.values());

//       const merged = deduped.map((n: any) => ({
//         ...n,
//         applicationStatus: n.applicationStatus || savedStatuses[n._id] || "",
//         _inviteStatus: savedInvite[n._id] || "",
//       }));
//       setNotifications(merged);

//       const needNames = merged.filter((n: any) =>
//         (n.read === false ||
//           ["application_accepted","application_rejected","campaign_update","invite"].includes(n.type))
//         && !creatorNames[n._id]
//       );
//       if (needNames.length > 0) {
//         const names: Record<string, string> = {};
//         const senderMap: Record<string, string[]> = {};
//         for (const n of needNames) {
//           const sid = extractMongoId(n.sender);
//           if (!sid) continue;
//           if (!senderMap[sid]) senderMap[sid] = [];
//           senderMap[sid].push(n._id);
//         }
//         await Promise.all(Object.entries(senderMap).map(async ([senderId, notifIds]) => {
//           if (profileCache[senderId]) {
//             notifIds.forEach(id => { names[id] = profileCache[senderId]?.name || profileCache[senderId]?.companyName || ""; });
//             return;
//           }
//           const { ok, data: pd } = await safeFetch(`${API}/profile/user/${senderId}`, {
//             headers: { Authorization: `Bearer ${token}` },
//           });
//           if (ok && pd) {
//             const p = pd.profile || pd.data || (pd._id ? pd : null);
//             if (p) {
//               profileCache[senderId] = p;
//               notifIds.forEach(id => { names[id] = p.name || p.companyName || ""; });
//             }
//           }
//         }));
//         setCreatorNames(prev => ({ ...prev, ...names }));
//       }
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const sendNotif = async (creatorId: string, type: string, message: string, appId: string) => {
//     try {
//       await safeFetch(`${API}/notification/initiate`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ userId: creatorId, sender: user.id, message, type, applicationId: appId, link: "/notification" }),
//       });
//     } catch { }
//   };

//   const blurName = (name: string, showFull = false) => {
//     if (!name) return <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>Xxxxxxx</span>;
//     const parts = name.trim().split(" ");
//     if (parts.length === 1 || showFull) return <span>{name}</span>;
//     const firstName = parts[0];
//     const lastName  = parts.slice(1).join(" ");
//     return (
//       <span>
//         {firstName}{" "}
//         <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>{lastName}</span>
//       </span>
//     );
//   };

//   const markRead = async (notifId: string) => {
//     const notif = notifications.find(n => n._id === notifId);
//     if (notif?.read) return;
//     try {
//       await safeFetch(`${API}/notification/read/${notifId}`, {
//         method: "PATCH",
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       if (!localRead.includes(notifId)) { localRead.push(notifId); localStorage.setItem("readNotifIds", JSON.stringify(localRead)); }
//       setNotifications(prev => {
//         const updated    = prev.map(n => n._id === notifId ? { ...n, read: true } : n);
//         const unreadLeft = updated.filter(n => !n.read).length;
//         window.dispatchEvent(new StorageEvent("storage", { key: "notif_unread_count", newValue: String(unreadLeft) }));
//         if (unreadLeft === 0) localStorage.setItem("notif_all_read", "true");
//         return updated;
//       });
//     } catch {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
//     }
//   };

//   const markAllRead = async () => {
//     const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
//     if (unreadIds.length === 0) return;
//     setNotifications(prev => prev.map(n => ({ ...n, read: true })));
//     localStorage.setItem("notif_all_read", "true");
//     window.dispatchEvent(new StorageEvent("storage", { key: "notif_all_read", newValue: "true" }));
//     await Promise.all(unreadIds.map(id =>
//       safeFetch(`${API}/notification/read/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${user.token}` } }).catch(() => {})
//     ));
//   };

//   const getCampaignId = (n: any): string | null => {
//     if (extractMongoId(n?.campaignId)) return extractMongoId(n?.campaignId);
//     if (extractMongoId(n?.data?.campaignId)) return extractMongoId(n?.data?.campaignId);
//     const parts   = (n?.link || "").split("/").filter(Boolean);
//     const validId = parts.find((p: string) => /^[a-f0-9]{24}$/i.test(p));
//     return validId || null;
//   };

//   const fetchProfile = async (userId: string) => {
//     if (!userId || typeof userId !== "string") return null;
//     if (profileCache[userId]) return profileCache[userId];
//     const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//       headers: { Authorization: `Bearer ${user?.token}` },
//     });
//     if (ok && data) {
//       const p = data.profile || data.data || (data._id ? data : null);
//       if (p) { profileCache[userId] = p; return p; }
//     }
//     return null;
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(n._id);
//       const senderId = extractMongoId(n.sender);
//       if (senderId) {
//         const profile = await fetchProfile(senderId);
//         if (profile) {
//           setCreatorNames(prev => ({ ...prev, [n._id]: profile.name || prev[n._id] }));
//           setSelectedProfile({ ...profile, notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link });
//           return;
//         }
//       }
//       const campaignId = getCampaignId(n);
//       if (campaignId) {
//         const { ok, data: appData } = await safeFetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         if (ok && appData) {
//           const apps = appData.applications || appData.data || [];
//           const app  = apps.find((a: any) => extractMongoId(a.influencerId) === senderId) || apps[apps.length - 1];
//           if (app) {
//             const creatorId = extractMongoId(app.influencerId) || extractMongoId(app.influencer);
//             if (creatorId) {
//               const profile = await fetchProfile(creatorId);
//               if (profile) {
//                 setSelectedProfile({ ...profile, applicationId: extractMongoId(app._id) || app._id, notifId: n._id, status: n.applicationStatus || app.status, campaignId, link: n.link });
//                 return;
//               }
//             }
//           }
//         }
//       }
//       setSelectedProfile({ name: "Creator", profileImage: null, bio: "", followers: "", categories: [], platform: "", notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link, _noProfile: true });
//     } catch (err) { console.error(err); }
//     finally { setProfileLoading(""); }
//   };

//   const saveStatusLocally = (notifId: string, status: string) => {
//     try {
//       const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       existing[notifId] = status;
//       localStorage.setItem("cb_notif_status", JSON.stringify(existing));
//     } catch { }
//   };

//   const getApplicationId = async (applicationId: string, notifId: string): Promise<string> => {
//     if (applicationId && /^[a-f0-9]{24}$/i.test(applicationId)) return applicationId;
//     const n = notifications.find(x => x._id === notifId);
//     if (!n) return applicationId || "";
//     const campId = getCampaignId(n);
//     if (!campId) return applicationId || "";
//     const { ok, data } = await safeFetch(`${API}/campaigns/${campId}/applications`, { headers: { Authorization: `Bearer ${user.token}` } });
//     if (!ok || !data) return applicationId || "";
//     const apps     = data.applications || data.data || [];
//     const senderId = extractMongoId(n.sender);
//     const app      = apps.find((a: any) => extractMongoId(a.influencerId) === senderId || extractMongoId(a.influencer) === senderId) || apps[apps.length - 1];
//     return app?._id || applicationId || "";
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       if (!result.ok) {
//         const errMsg = result.data?.message || "Accept failed";
//         if (!errMsg.toLowerCase().includes("already")) throw new Error(errMsg);
//       }

//       // ✅ SYNC TO CAMPAIGN APPLICATIONS PAGE
//       syncDecisionToLocalStorage(realAppId, "accepted");

//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//       saveStatusLocally(notifId, "accepted");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         const campId    = getCampaignId(n) || "";
//         if (creatorId) {
//           await sendNotif(creatorId, "application_accepted", "🎉 Your application has been accepted!", realAppId);
//           const r = await safeFetch(`${API}/conversations/create`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//             body: JSON.stringify({ participantId: creatorId, campaignId: campId }),
//           });
//           const convId = r.data?.data?._id || r.data?.conversation?._id || r.data?._id || "";
//           if (convId) {
//             await safeFetch(`${API}/conversations/send/${convId}`, {
//               method: "POST",
//               headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//               body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
//             });
//           }
//         }
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Accept failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       if (!result.ok) throw new Error(result.data?.message || "Reject failed");

//       // ✅ SYNC TO CAMPAIGN APPLICATIONS PAGE
//       syncDecisionToLocalStorage(realAppId, "rejected");

//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//       saveStatusLocally(notifId, "rejected");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         if (creatorId) await sendNotif(creatorId, "application_rejected", "Your application was not selected this time. Keep applying! 💪", realAppId);
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Reject failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   const handleInviteResponse = async (n: any, action: "accepted" | "rejected") => {
//     const inviteId = extractMongoId(n.data?.inviteId) || extractMongoId(n.inviteId) || "";
//     if (!inviteId) { alert("Invite ID not found. Please refresh."); return; }
//     setInviteLoading(n._id + "_" + action);
//     try {
//       const { ok, data } = await safeFetch(`${API}/invite/respond`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ inviteId, action }),
//       });
//       if (!ok) { alert(data?.message || "Failed to respond"); return; }
//       const saved = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");
//       saved[n._id] = action;
//       localStorage.setItem("cb_invite_status", JSON.stringify(saved));
//       setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, _inviteStatus: action, read: true } : x));
//       markRead(n._id);
//       if (action === "accepted" && data?.conversation?._id) router.push("/messages");
//     } catch (err) { console.error(err); alert("Something went wrong."); }
//     finally { setInviteLoading(""); }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = extractMongoId(profile.user) || extractMongoId(profile) || profile._id || "";
//     const campId        = profile.campaignId || getCampaignId({ link: profile.link }) || "";
//     router.push(`/messages?userId=${creatorUserId}&campaignId=${campId}`);
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

//   const isBrandApplyNotif       = (n: any) => ["new_application", "campaign_apply", "application"].includes(n.type);
//   const isInfluencerStatusNotif = (n: any) => ["application_accepted", "application_rejected", "application_status", "campaign_update"].includes(n.type);

//   const getStatus = (n: any) => {
//     const s = n.applicationStatus || n.application?.status || "";
//     if (s) return s.toLowerCase();
//     if (n.type === "campaign_update")      return "rejected";
//     if (n.type === "application_rejected") return "rejected";
//     if (n.type === "application_accepted") return "accepted";
//     return "";
//   };

//   if (!user) return null;
//   const isBrand = userRole === "brand";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-mark-all-btn { margin-left: auto; background: none; border: none; font-size: 12px; font-weight: 600; color: #4f46e5; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px 8px; border-radius: 8px; }
//         .np-mark-all-btn:hover { background: #eef2ff; }
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
//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 100px; font-size: 13px; font-weight: 700; margin-top: 12px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-status-pending { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; }
//         .np-msg-btn { margin-top: 10px; padding: 10px 18px; background: #4f46e5; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
//         .np-msg-btn:hover { background: #4338ca; }
//         .np-invite-card { margin-top: 14px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); border-radius: 14px; padding: 16px; border: 1.5px solid #c7d2fe; }
//         .np-invite-title { font-size: 14px; font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
//         .np-invite-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
//         .np-invite-actions { display: flex; gap: 8px; }
//         .np-invite-accept { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; transition: all 0.2s; }
//         .np-invite-accept:hover:not(:disabled) { transform: translateY(-1px); }
//         .np-invite-accept:disabled { opacity: 0.6; cursor: not-allowed; }
//         .np-invite-reject { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #fecaca; cursor: pointer; background: #fff5f5; color: #dc2626; transition: all 0.2s; }
//         .np-invite-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-invite-reject:disabled { opacity: 0.6; cursor: not-allowed; }
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
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <span className="np-title">Notifications</span>
//           {notifications.filter(n => !n.read).length > 0 && (
//             <>
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//               <button className="np-mark-all-btn" onClick={markAllRead}>Mark all read</button>
//             </>
//           )}
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">Your notifications will appear here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const status      = getStatus(n);
//               const isAccepted  = status === "accepted";
//               const isRejected  = status === "rejected";
//               const isPending   = !isAccepted && !isRejected;
//               const showBrandActions     = isBrand && isBrandApplyNotif(n);
//               const showInviteActions    = !isBrand && n.type === "invite";
//               const inviteStatus         = n._inviteStatus || "";
//               const inviteAccepted       = inviteStatus === "accepted";
//               const inviteRejected       = inviteStatus === "rejected";
//               const showInfluencerStatus = !isBrand && !showInviteActions && (isInfluencerStatusNotif(n) || n.applicationStatus);

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}
//                   onClick={() => markRead(n._id)}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>
//                       {n._error && (
//                         <div style={{marginTop:8,padding:"8px 12px",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:"#dc2626",fontWeight:600}}>
//                           ⚠️ {n._error}
//                         </div>
//                       )}

//                       {showBrandActions && (
//                         <>
//                           <div className="np-creator-strip"
//                             onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                             <div className="np-avatar">👤</div>
//                             <div style={{ flex: 1 }}>
//                               <div className="np-creator-name">{blurName(creatorNames[n._id] || "Creator", isAccepted)}</div>
//                               <div className="np-creator-sub">View Profile →</div>
//                             </div>
//                             {profileLoading === n._id
//                               ? <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                               : <span className="np-view">View →</span>}
//                           </div>
//                           <div className="np-actions">
//                             {isPending ? (
//                               <>
//                                 <button className="np-btn np-btn-accept"
//                                   disabled={actionLoading === n._id + "_accept"}
//                                   onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                                 </button>
//                                 <button className="np-btn np-btn-reject"
//                                   disabled={actionLoading === n._id + "_reject"}
//                                   onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                                 </button>
//                               </>
//                             ) : isAccepted ? (
//                               <>
//                                 <div className="np-status np-status-accepted">✓ Accepted</div>
//                                 <button className="np-btn np-btn-msg"
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     const creatorId = extractMongoId(n.sender);
//                                     const campId    = getCampaignId(n) || "";
//                                     router.push(creatorId ? `/messages?userId=${creatorId}&campaignId=${campId}` : "/messages");
//                                   }}>
//                                   💬 Message Creator
//                                 </button>
//                               </>
//                             ) : (
//                               <div className="np-status np-status-rejected">✗ Rejected</div>
//                             )}
//                           </div>
//                         </>
//                       )}

//                       {showInviteActions && (
//                         <div className="np-invite-card" onClick={e => e.stopPropagation()}>
//                           <div className="np-invite-title">🤝 Brand wants to connect!</div>
//                           <div className="np-invite-sub">Accept to start chatting and collaborate on their campaign.</div>
//                           {!inviteAccepted && !inviteRejected ? (
//                             <div className="np-invite-actions">
//                               <button className="np-invite-accept"
//                                 disabled={inviteLoading === n._id + "_accepted"}
//                                 onClick={() => handleInviteResponse(n, "accepted")}>
//                                 {inviteLoading === n._id + "_accepted" ? "Accepting..." : "✓ Accept"}
//                               </button>
//                               <button className="np-invite-reject"
//                                 disabled={inviteLoading === n._id + "_rejected"}
//                                 onClick={() => handleInviteResponse(n, "rejected")}>
//                                 {inviteLoading === n._id + "_rejected" ? "..." : "✗ Decline"}
//                               </button>
//                             </div>
//                           ) : inviteAccepted ? (
//                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//                               <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginBottom: 2 }}>
//                                 🏢 {creatorNames[n._id] || "Brand"}
//                               </div>
//                               <div className="np-status np-status-accepted">✅ Connected! Chat is open.</div>
//                               <button className="np-msg-btn" onClick={() => router.push("/messages")}>💬 Go to Messages</button>
//                             </div>
//                           ) : (
//                             <div className="np-status np-status-rejected">✗ Declined</div>
//                           )}
//                         </div>
//                       )}

//                       {showInfluencerStatus && (
//                         <div style={{ marginTop: "10px" }}>
//                           <div style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
//                             <span>🏢</span>
//                             <span style={{ fontWeight: 600, color: "#555" }}>{creatorNames[n._id] || "Brand"}</span>
//                             <span style={{ color: "#bbb" }}>reviewed your application</span>
//                           </div>
//                           {isAccepted ? (
//                             <>
//                               <div className="np-status np-status-accepted">✅ Application Accepted!</div>
//                               <button className="np-msg-btn"
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   const brandId = extractMongoId(n.sender);
//                                   const campId  = getCampaignId(n) || "";
//                                   router.push(brandId ? `/messages?userId=${brandId}&campaignId=${campId}` : "/messages");
//                                 }}>
//                                 💬 Chat with Brand
//                               </button>
//                             </>
//                           ) : isRejected ? (
//                             <div className="np-status np-status-rejected">❌ Application Not Selected</div>
//                           ) : (
//                             <div className="np-status np-status-pending">⏳ Application Under Review</div>
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

//       {selectedProfile && isBrand && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{(() => {
//                 const name  = selectedProfile.name || "Creator";
//                 const parts = name.trim().split(" ");
//                 if (parts.length === 1 || selectedProfile.status === "accepted") return <span>{name}</span>;
//                 return <span>{parts[0]} <span style={{filter:"blur(4px)",userSelect:"none"}}>{parts.slice(1).join(" ")}</span></span>;
//               })()}</div>
//               {selectedProfile.location && <div className="pm-location">📍 {selectedProfile.location}</div>}
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                   .filter(Boolean).map((cat: string, i: number) => <span key={i} className="pm-tag">{cat}</span>)}
//               </div>
//             </div>
//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat"><div className="pm-stat-num">{formatFollowers(selectedProfile.followers)}</div><div className="pm-stat-label">Followers</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}</div><div className="pm-stat-label">Niches</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div><div className="pm-stat-label">Platform</div></div>
//               </div>
//               {selectedProfile.bio && <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>}
//             </div>
//             {selectedProfile.status === "accepted" && <div className="pm-banner pm-banner-accepted">✅ You have accepted this creator!</div>}
//             {selectedProfile.status === "rejected" && <div className="pm-banner pm-banner-rejected">❌ You have rejected this creator</div>}
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
//                 <button className="pm-btn pm-btn-accept" style={{flex:"none",width:"100%"}}
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

// import { useEffect, useState ,useRef} from "react";
// import { useRouter } from "next/navigation";

// const API = "https://api.collabzy.in/api";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
//   "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
// };

// const formatFollowers = (f: any): string => {
//   if (!f && f !== 0) return "—";
//   const key = String(f);
//   if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//   const num = Number(f);
//   if (!isNaN(num) && num >= 1000) return Math.floor(num / 1000) + "K";
//   return String(f);
// };

// const safeFetch = async (url: string, options: RequestInit = {}) => {
//   try {
//     const res  = await fetch(url, options);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// const extractMongoId = (val: any): string | null => {
//   if (!val) return null;
//   if (typeof val === "string" && val.length > 0 && !/\s/.test(val)) return val;
//   if (typeof val === "object") {
//     const id = val._id || val.id;
//     if (typeof id === "string") return id;
//     if (typeof id === "object") return extractMongoId(id);
//   }
//   return null;
// };

// // ✅ Sync accepted/rejected status to Campaign Applications localStorage
// // So when brand goes to Campaign Applications page, it already shows correct status
// const syncDecisionToLocalStorage = (appId: string, decision: "accepted" | "rejected") => {
//   try {
//     const existing = JSON.parse(localStorage.getItem("decidedApplications") || "{}");
//     existing[appId] = decision;
//     localStorage.setItem("decidedApplications", JSON.stringify(existing));
//   } catch { /* silent */ }
// };

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser]                   = useState<any>(null);
//   const [userRole, setUserRole]           = useState<string>("");
//   const profileCache                      = useState<Record<string, any>>({})[0];
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading]             = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading]   = useState<string>("");
//   const [actionLoading, setActionLoading]     = useState("");
//   const [creatorNames, setCreatorNames]       = useState<Record<string, string>>({});
//   const [inviteLoading, setInviteLoading]     = useState<string>("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const role = parsed.role || parsed.user?.role || "";
//     setUserRole(role.toLowerCase());
//     fetchNotifications(parsed.token);

//     const handleVisibility = () => {
//       if (document.visibilityState === "visible") {
//         const u = localStorage.getItem("cb_user");
//         if (u) fetchNotifications(JSON.parse(u).token);
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const { data } = await safeFetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const list          = data?.data || data?.notifications || [];
//       const savedStatuses = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const savedInvite   = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");

//       const filtered = list.filter((n: any) => n.type !== "new_message");

//       const seen = new Map<string, any>();
//       for (const n of filtered) {
//         const key      = n.applicationId || n._id;
//         const existing = seen.get(key);
//         if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
//           seen.set(key, n);
//         }
//       }
//       const deduped = Array.from(seen.values());

//       const merged = deduped.map((n: any) => ({
//         ...n,
//         applicationStatus: n.applicationStatus || savedStatuses[n._id] || "",
//         _inviteStatus: savedInvite[n._id] || "",
//       }));
//       setNotifications(merged);

//       const needNames = merged.filter((n: any) =>
//         (n.read === false ||
//           ["application_accepted","application_rejected","campaign_update","invite"].includes(n.type))
//         && !creatorNames[n._id]
//       );
//       if (needNames.length > 0) {
//         const names: Record<string, string> = {};
//         const senderMap: Record<string, string[]> = {};
//         for (const n of needNames) {
//           const sid = extractMongoId(n.sender);
//           if (!sid) continue;
//           if (!senderMap[sid]) senderMap[sid] = [];
//           senderMap[sid].push(n._id);
//         }
//         await Promise.all(Object.entries(senderMap).map(async ([senderId, notifIds]) => {
//           if (profileCache[senderId]) {
//             notifIds.forEach(id => { names[id] = profileCache[senderId]?.name || profileCache[senderId]?.companyName || ""; });
//             return;
//           }
//           const { ok, data: pd } = await safeFetch(`${API}/profile/user/${senderId}`, {
//             headers: { Authorization: `Bearer ${token}` },
//           });
//           if (ok && pd) {
//             const p = pd.profile || pd.data || (pd._id ? pd : null);
//             if (p) {
//               profileCache[senderId] = p;
//               notifIds.forEach(id => { names[id] = p.name || p.companyName || ""; });
//             }
//           }
//         }));
//         setCreatorNames(prev => ({ ...prev, ...names }));
//       }
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const sendNotif = async (creatorId: string, type: string, message: string, appId: string) => {
//     try {
//       await safeFetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ userId: creatorId, sender: user.id, message, type, applicationId: appId, link: "/notification" }),
//       });
//     } catch { }
//   };

//   const blurName = (name: string, showFull = false) => {
//     if (!name) return <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>Xxxxxxx</span>;
//     const parts = name.trim().split(" ");
//     if (parts.length === 1 || showFull) return <span>{name}</span>;
//     const firstName = parts[0];
//     const lastName  = parts.slice(1).join(" ");
//     return (
//       <span>
//         {firstName}{" "}
//         <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>{lastName}</span>
//       </span>
//     );
//   };

//   const markRead = async (notifId: string) => {
//     const notif = notifications.find(n => n._id === notifId);
//     if (notif?.read) return;
//     try {
//       await safeFetch(`${API}/notification/read/${notifId}`, {
//         method: "PATCH",
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       if (!localRead.includes(notifId)) { localRead.push(notifId); localStorage.setItem("readNotifIds", JSON.stringify(localRead)); }
//       setNotifications(prev => {
//         const updated    = prev.map(n => n._id === notifId ? { ...n, read: true } : n);
//         const unreadLeft = updated.filter(n => !n.read).length;
//         window.dispatchEvent(new StorageEvent("storage", { key: "notif_unread_count", newValue: String(unreadLeft) }));
//         if (unreadLeft === 0) localStorage.setItem("notif_all_read", "true");
//         return updated;
//       });
//     } catch {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
//     }
//   };

//   const markAllRead = async () => {
//     const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
//     if (unreadIds.length === 0) return;
//     setNotifications(prev => prev.map(n => ({ ...n, read: true })));
//     localStorage.setItem("notif_all_read", "true");
//     window.dispatchEvent(new StorageEvent("storage", { key: "notif_all_read", newValue: "true" }));
//     await Promise.all(unreadIds.map(id =>
//       safeFetch(`${API}/notification/read/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${user.token}` } }).catch(() => {})
//     ));
//   };

//   const getCampaignId = (n: any): string | null => {
//     if (extractMongoId(n?.campaignId)) return extractMongoId(n?.campaignId);
//     if (extractMongoId(n?.data?.campaignId)) return extractMongoId(n?.data?.campaignId);
//     const parts   = (n?.link || "").split("/").filter(Boolean);
//     const validId = parts.find((p: string) => /^[a-f0-9]{24}$/i.test(p));
//     return validId || null;
//   };

//   const fetchProfile = async (userId: string) => {
//     if (!userId || typeof userId !== "string") return null;
//     if (profileCache[userId]) return profileCache[userId];
//     const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//       headers: { Authorization: `Bearer ${user?.token}` },
//     });
//     if (ok && data) {
//       const p = data.profile || data.data || (data._id ? data : null);
//       if (p) { profileCache[userId] = p; return p; }
//     }
//     return null;
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(n._id);
//       const senderId = extractMongoId(n.sender);
//       if (senderId) {
//         const profile = await fetchProfile(senderId);
//         if (profile) {
//           setCreatorNames(prev => ({ ...prev, [n._id]: profile.name || prev[n._id] }));
//           setSelectedProfile({ ...profile, notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link });
//           return;
//         }
//       }
//       const campaignId = getCampaignId(n);
//       if (campaignId) {
//         const { ok, data: appData } = await safeFetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         if (ok && appData) {
//           const apps = appData.applications || appData.data || [];
//           const app  = apps.find((a: any) => extractMongoId(a.influencerId) === senderId) || apps[apps.length - 1];
//           if (app) {
//             const creatorId = extractMongoId(app.influencerId) || extractMongoId(app.influencer);
//             if (creatorId) {
//               const profile = await fetchProfile(creatorId);
//               if (profile) {
//                 setSelectedProfile({ ...profile, applicationId: extractMongoId(app._id) || app._id, notifId: n._id, status: n.applicationStatus || app.status, campaignId, link: n.link });
//                 return;
//               }
//             }
//           }
//         }
//       }
//       setSelectedProfile({ name: "Creator", profileImage: null, bio: "", followers: "", categories: [], platform: "", notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link, _noProfile: true });
//     } catch (err) { console.error(err); }
//     finally { setProfileLoading(""); }
//   };

//   const saveStatusLocally = (notifId: string, status: string) => {
//     try {
//       const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       existing[notifId] = status;
//       localStorage.setItem("cb_notif_status", JSON.stringify(existing));
//     } catch { }
//   };

//   const getApplicationId = async (applicationId: string, notifId: string): Promise<string> => {
//     if (applicationId && /^[a-f0-9]{24}$/i.test(applicationId)) return applicationId;
//     const n = notifications.find(x => x._id === notifId);
//     if (!n) return applicationId || "";
//     const campId = getCampaignId(n);
//     if (!campId) return applicationId || "";
//     const { ok, data } = await safeFetch(`${API}/campaigns/${campId}/applications`, { headers: { Authorization: `Bearer ${user.token}` } });
//     if (!ok || !data) return applicationId || "";
//     const apps     = data.applications || data.data || [];
//     const senderId = extractMongoId(n.sender);
//     const app      = apps.find((a: any) => extractMongoId(a.influencerId) === senderId || extractMongoId(a.influencer) === senderId) || apps[apps.length - 1];
//     return app?._id || applicationId || "";
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       if (!result.ok) {
//         const errMsg = result.data?.message || "Accept failed";
//         if (!errMsg.toLowerCase().includes("already")) throw new Error(errMsg);
//       }

//       // ✅ SYNC TO CAMPAIGN APPLICATIONS PAGE
//       syncDecisionToLocalStorage(realAppId, "accepted");

//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//       saveStatusLocally(notifId, "accepted");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         const campId    = getCampaignId(n) || "";
//         if (creatorId) {
//           await sendNotif(creatorId, "application_accepted", "🎉 Your application has been accepted!", realAppId);
//           const r = await safeFetch(`${API}/conversations/create`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//             body: JSON.stringify({ participantId: creatorId, campaignId: campId }),
//           });
//           const convId = r.data?.data?._id || r.data?.conversation?._id || r.data?._id || "";
//           if (convId) {
//             await safeFetch(`${API}/conversations/send/${convId}`, {
//               method: "POST",
//               headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//               body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
//             });
//           }
//         }
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Accept failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       if (!result.ok) throw new Error(result.data?.message || "Reject failed");

//       // ✅ SYNC TO CAMPAIGN APPLICATIONS PAGE
//       syncDecisionToLocalStorage(realAppId, "rejected");

//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//       saveStatusLocally(notifId, "rejected");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         if (creatorId) await sendNotif(creatorId, "application_rejected", "Your application was not selected this time. Keep applying! 💪", realAppId);
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Reject failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   const handleInviteResponse = async (n: any, action: "accepted" | "rejected") => {
//     const inviteId = extractMongoId(n.data?.inviteId) || extractMongoId(n.inviteId) || "";
//     if (!inviteId) { alert("Invite ID not found. Please refresh."); return; }
//     setInviteLoading(n._id + "_" + action);
//     try {
//       const { ok, data } = await safeFetch(`${API}/invite/respond`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ inviteId, action }),
//       });
//       if (!ok) { alert(data?.message || "Failed to respond"); return; }
//       const saved = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");
//       saved[n._id] = action;
//       localStorage.setItem("cb_invite_status", JSON.stringify(saved));
//       setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, _inviteStatus: action, read: true } : x));
//       markRead(n._id);
//       if (action === "accepted" && data?.conversation?._id) router.push("/messages");
//     } catch (err) { console.error(err); alert("Something went wrong."); }
//     finally { setInviteLoading(""); }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = extractMongoId(profile.user) || extractMongoId(profile) || profile._id || "";
//     const campId        = profile.campaignId || getCampaignId({ link: profile.link }) || "";
//     router.push(`/messages?userId=${creatorUserId}&campaignId=${campId}`);
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

//   const isBrandApplyNotif       = (n: any) => ["new_application", "campaign_apply", "application"].includes(n.type);
//   const isInfluencerStatusNotif = (n: any) => ["application_accepted", "application_rejected", "application_status", "campaign_update"].includes(n.type);

//   const getStatus = (n: any) => {
//     const s = n.applicationStatus || n.application?.status || "";
//     if (s) return s.toLowerCase();
//     if (n.type === "campaign_update")      return "rejected";
//     if (n.type === "application_rejected") return "rejected";
//     if (n.type === "application_accepted") return "accepted";
//     return "";
//   };

//   if (!user) return null;
//   const isBrand = userRole === "brand";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-mark-all-btn { margin-left: auto; background: none; border: none; font-size: 12px; font-weight: 600; color: #4f46e5; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px 8px; border-radius: 8px; }
//         .np-mark-all-btn:hover { background: #eef2ff; }
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
//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 100px; font-size: 13px; font-weight: 700; margin-top: 12px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-status-pending { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; }
//         .np-msg-btn { margin-top: 10px; padding: 10px 18px; background: #4f46e5; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
//         .np-msg-btn:hover { background: #4338ca; }
//         .np-invite-card { margin-top: 14px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); border-radius: 14px; padding: 16px; border: 1.5px solid #c7d2fe; }
//         .np-invite-title { font-size: 14px; font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
//         .np-invite-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
//         .np-invite-actions { display: flex; gap: 8px; }
//         .np-invite-accept { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; transition: all 0.2s; }
//         .np-invite-accept:hover:not(:disabled) { transform: translateY(-1px); }
//         .np-invite-accept:disabled { opacity: 0.6; cursor: not-allowed; }
//         .np-invite-reject { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #fecaca; cursor: pointer; background: #fff5f5; color: #dc2626; transition: all 0.2s; }
//         .np-invite-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-invite-reject:disabled { opacity: 0.6; cursor: not-allowed; }
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
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <span className="np-title">Notifications</span>
//           {notifications.filter(n => !n.read).length > 0 && (
//             <>
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//               <button className="np-mark-all-btn" onClick={markAllRead}>Mark all read</button>
//             </>
//           )}
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">Your notifications will appear here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const status      = getStatus(n);
//               const isAccepted  = status === "accepted";
//               const isRejected  = status === "rejected";
//               const isPending   = !isAccepted && !isRejected;
//               const showBrandActions     = isBrand && isBrandApplyNotif(n);
//               const showInviteActions    = !isBrand && n.type === "invite";
//               const inviteStatus         = n._inviteStatus || "";
//               const inviteAccepted       = inviteStatus === "accepted";
//               const inviteRejected       = inviteStatus === "rejected";
//               const showInfluencerStatus = !isBrand && !showInviteActions && (isInfluencerStatusNotif(n) || n.applicationStatus);

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}
//                   onClick={() => markRead(n._id)}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>
//                       {n._error && (
//                         <div style={{marginTop:8,padding:"8px 12px",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:"#dc2626",fontWeight:600}}>
//                           ⚠️ {n._error}
//                         </div>
//                       )}

//                       {showBrandActions && (
//                         <>
//                           <div className="np-creator-strip"
//                             onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                             <div className="np-avatar">👤</div>
//                             <div style={{ flex: 1 }}>
//                               <div className="np-creator-name">{blurName(creatorNames[n._id] || "Creator", isAccepted)}</div>
//                               <div className="np-creator-sub">View Profile →</div>
//                             </div>
//                             {profileLoading === n._id
//                               ? <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                               : <span className="np-view">View →</span>}
//                           </div>
//                           <div className="np-actions">
//                             {isPending ? (
//                               <>
//                                 <button className="np-btn np-btn-accept"
//                                   disabled={actionLoading === n._id + "_accept"}
//                                   onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                                 </button>
//                                 <button className="np-btn np-btn-reject"
//                                   disabled={actionLoading === n._id + "_reject"}
//                                   onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                                 </button>
//                               </>
//                             ) : isAccepted ? (
//                               <>
//                                 <div className="np-status np-status-accepted">✓ Accepted</div>
//                                 <button className="np-btn np-btn-msg"
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     const creatorId = extractMongoId(n.sender);
//                                     const campId    = getCampaignId(n) || "";
//                                     router.push(creatorId ? `/messages?userId=${creatorId}&campaignId=${campId}` : "/messages");
//                                   }}>
//                                   💬 Message Creator
//                                 </button>
//                               </>
//                             ) : (
//                               <div className="np-status np-status-rejected">✗ Rejected</div>
//                             )}
//                           </div>
//                         </>
//                       )}

//                       {showInviteActions && (
//                         <div className="np-invite-card" onClick={e => e.stopPropagation()}>
//                           <div className="np-invite-title">🤝 Brand wants to connect!</div>
//                           <div className="np-invite-sub">Accept to start chatting and collaborate on their campaign.</div>
//                           {!inviteAccepted && !inviteRejected ? (
//                             <div className="np-invite-actions">
//                               <button className="np-invite-accept"
//                                 disabled={inviteLoading === n._id + "_accepted"}
//                                 onClick={() => handleInviteResponse(n, "accepted")}>
//                                 {inviteLoading === n._id + "_accepted" ? "Accepting..." : "✓ Accept"}
//                               </button>
//                               <button className="np-invite-reject"
//                                 disabled={inviteLoading === n._id + "_rejected"}
//                                 onClick={() => handleInviteResponse(n, "rejected")}>
//                                 {inviteLoading === n._id + "_rejected" ? "..." : "✗ Decline"}
//                               </button>
//                             </div>
//                           ) : inviteAccepted ? (
//                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//                               <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginBottom: 2 }}>
//                                 🏢 {creatorNames[n._id] || "Brand"}
//                               </div>
//                               <div className="np-status np-status-accepted">✅ Connected! Chat is open.</div>
//                               <button className="np-msg-btn" onClick={() => router.push("/messages")}>💬 Go to Messages</button>
//                             </div>
//                           ) : (
//                             <div className="np-status np-status-rejected">✗ Declined</div>
//                           )}
//                         </div>
//                       )}

//                       {showInfluencerStatus && (
//                         <div style={{ marginTop: "10px" }}>
//                           <div style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
//                             <span>🏢</span>
//                             <span style={{ fontWeight: 600, color: "#555" }}>{creatorNames[n._id] || "Brand"}</span>
//                             <span style={{ color: "#bbb" }}>reviewed your application</span>
//                           </div>
//                           {isAccepted ? (
//                             <>
//                               <div className="np-status np-status-accepted">✅ Application Accepted!</div>
//                               <button className="np-msg-btn"
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   const brandId = extractMongoId(n.sender);
//                                   const campId  = getCampaignId(n) || "";
//                                   router.push(brandId ? `/messages?userId=${brandId}&campaignId=${campId}` : "/messages");
//                                 }}>
//                                 💬 Chat with Brand
//                               </button>
//                             </>
//                           ) : isRejected ? (
//                             <div className="np-status np-status-rejected">❌ Application Not Selected</div>
//                           ) : (
//                             <div className="np-status np-status-pending">⏳ Application Under Review</div>
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

//       {selectedProfile && isBrand && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{(() => {
//                 const name  = selectedProfile.name || "Creator";
//                 const parts = name.trim().split(" ");
//                 if (parts.length === 1 || selectedProfile.status === "accepted") return <span>{name}</span>;
//                 return <span>{parts[0]} <span style={{filter:"blur(4px)",userSelect:"none"}}>{parts.slice(1).join(" ")}</span></span>;
//               })()}</div>
//               {selectedProfile.location && <div className="pm-location">📍 {selectedProfile.location}</div>}
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                   .filter(Boolean).map((cat: string, i: number) => <span key={i} className="pm-tag">{cat}</span>)}
//               </div>
//             </div>
//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat"><div className="pm-stat-num">{formatFollowers(selectedProfile.followers)}</div><div className="pm-stat-label">Followers</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}</div><div className="pm-stat-label">Niches</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div><div className="pm-stat-label">Platform</div></div>
//               </div>
//               {selectedProfile.bio && <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>}
//             </div>
//             {selectedProfile.status === "accepted" && <div className="pm-banner pm-banner-accepted">✅ You have accepted this creator!</div>}
//             {selectedProfile.status === "rejected" && <div className="pm-banner pm-banner-rejected">❌ You have rejected this creator</div>}
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
//                 <button className="pm-btn pm-btn-accept" style={{flex:"none",width:"100%"}}
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

// const API = "http://api.collabzy.in/api";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
//   "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
// };

// const formatFollowers = (f: any): string => {
//   if (!f && f !== 0) return "—";
//   const key = String(f);
//   if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//   const num = Number(f);
//   if (!isNaN(num) && num >= 1000) return Math.floor(num / 1000) + "K";
//   return String(f);
// };

// const safeFetch = async (url: string, options: RequestInit = {}) => {
//   try {
//     const res  = await fetch(url, options);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// const extractMongoId = (val: any): string | null => {
//   if (!val) return null;
//   if (typeof val === "string" && val.length > 0 && !/\s/.test(val)) return val;
//   if (typeof val === "object") {
//     const id = val._id || val.id;
//     if (typeof id === "string") return id;
//     if (typeof id === "object") return extractMongoId(id);
//   }
//   return null;
// };

// export default function NotificationsPage() {
//   const router = useRouter();
//   const [user, setUser]                   = useState<any>(null);
//   const [userRole, setUserRole]           = useState<string>("");
//   const profileCache                      = useState<Record<string, any>>({})[0];
//   const [notifications, setNotifications] = useState<any[]>([]);
//   const [loading, setLoading]             = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading]   = useState<string>("");
//   const [actionLoading, setActionLoading]     = useState("");
//   const [creatorNames, setCreatorNames]       = useState<Record<string, string>>({});
//   const [inviteLoading, setInviteLoading]     = useState<string>("");

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     setUser(parsed);
//     const role = parsed.role || parsed.user?.role || "";
//     setUserRole(role.toLowerCase());
//     fetchNotifications(parsed.token);

//     const handleVisibility = () => {
//       if (document.visibilityState === "visible") {
//         const u = localStorage.getItem("cb_user");
//         if (u) fetchNotifications(JSON.parse(u).token);
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, []);

//   const fetchNotifications = async (token: string) => {
//     try {
//       setLoading(true);
//       const { data } = await safeFetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const list          = data?.data || data?.notifications || [];
//       const savedStatuses = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const savedInvite   = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");

//       const filtered = list.filter((n: any) => n.type !== "new_message");

//       const seen = new Map<string, any>();
//       for (const n of filtered) {
//         const key      = n.applicationId || n._id;
//         const existing = seen.get(key);
//         if (!existing || new Date(n.createdAt) > new Date(existing.createdAt)) {
//           seen.set(key, n);
//         }
//       }
//       const deduped = Array.from(seen.values());

//       const merged = deduped.map((n: any) => ({
//         ...n,
//         applicationStatus: n.applicationStatus || savedStatuses[n._id] || "",
//         _inviteStatus: savedInvite[n._id] || "",
//       }));
//       setNotifications(merged);

//       // Fetch sender names
//       const needNames = merged.filter((n: any) =>
//         (n.read === false ||
//           ["application_accepted","application_rejected","campaign_update","invite"].includes(n.type))
//         && !creatorNames[n._id]
//       );
//       if (needNames.length > 0) {
//         const names: Record<string, string> = {};
//         const senderMap: Record<string, string[]> = {};
//         for (const n of needNames) {
//           const sid = extractMongoId(n.sender);
//           if (!sid) continue;
//           if (!senderMap[sid]) senderMap[sid] = [];
//           senderMap[sid].push(n._id);
//         }
//         await Promise.all(Object.entries(senderMap).map(async ([senderId, notifIds]) => {
//           if (profileCache[senderId]) {
//             notifIds.forEach(id => { names[id] = profileCache[senderId]?.name || profileCache[senderId]?.companyName || ""; });
//             return;
//           }
//           const { ok, data: pd } = await safeFetch(`${API}/profile/user/${senderId}`, {
//             headers: { Authorization: `Bearer ${token}` },
//           });
//           if (ok && pd) {
//             const p = pd.profile || pd.data || (pd._id ? pd : null);
//             if (p) {
//               profileCache[senderId] = p;
//               notifIds.forEach(id => { names[id] = p.name || p.companyName || ""; });
//             }
//           }
//         }));
//         setCreatorNames(prev => ({ ...prev, ...names }));
//       }
//     } catch (err) { console.error(err); }
//     finally { setLoading(false); }
//   };

//   const sendNotif = async (creatorId: string, type: string, message: string, appId: string) => {
//     try {
//       await safeFetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ userId: creatorId, sender: user.id, message, type, applicationId: appId, link: "/notification" }),
//       });
//     } catch { }
//   };

//   const blurName = (name: string, showFull = false) => {
//     if (!name) return <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>Xxxxxxx</span>;
//     const parts = name.trim().split(" ");
//     if (parts.length === 1 || showFull) return <span>{name}</span>;
//     const firstName = parts[0];
//     const lastName  = parts.slice(1).join(" ");
//     return (
//       <span>
//         {firstName}{" "}
//         <span style={{ filter: "blur(4px)", userSelect: "none", color: "#999" }}>{lastName}</span>
//       </span>
//     );
//   };

//   const markRead = async (notifId: string) => {
//     const notif = notifications.find(n => n._id === notifId);
//     if (notif?.read) return;
//     try {
//       await safeFetch(`${API}/notification/read/${notifId}`, {
//         method: "PATCH",
//         headers: { Authorization: `Bearer ${user.token}` },
//       });
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       if (!localRead.includes(notifId)) { localRead.push(notifId); localStorage.setItem("readNotifIds", JSON.stringify(localRead)); }
//       setNotifications(prev => {
//         const updated    = prev.map(n => n._id === notifId ? { ...n, read: true } : n);
//         const unreadLeft = updated.filter(n => !n.read).length;
//         window.dispatchEvent(new StorageEvent("storage", { key: "notif_unread_count", newValue: String(unreadLeft) }));
//         if (unreadLeft === 0) localStorage.setItem("notif_all_read", "true");
//         return updated;
//       });
//     } catch {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, read: true } : n));
//     }
//   };

//   const markAllRead = async () => {
//     const unreadIds = notifications.filter(n => !n.read).map(n => n._id);
//     if (unreadIds.length === 0) return;
//     setNotifications(prev => prev.map(n => ({ ...n, read: true })));
//     localStorage.setItem("notif_all_read", "true");
//     window.dispatchEvent(new StorageEvent("storage", { key: "notif_all_read", newValue: "true" }));
//     await Promise.all(unreadIds.map(id =>
//       safeFetch(`${API}/notification/read/${id}`, { method: "PATCH", headers: { Authorization: `Bearer ${user.token}` } }).catch(() => {})
//     ));
//   };

//   const getCampaignId = (n: any): string | null => {
//     if (extractMongoId(n?.campaignId)) return extractMongoId(n?.campaignId);
//     if (extractMongoId(n?.data?.campaignId)) return extractMongoId(n?.data?.campaignId);
//     const parts   = (n?.link || "").split("/").filter(Boolean);
//     const validId = parts.find((p: string) => /^[a-f0-9]{24}$/i.test(p));
//     return validId || null;
//   };

//   const fetchProfile = async (userId: string) => {
//     if (!userId || typeof userId !== "string") return null;
//     if (profileCache[userId]) return profileCache[userId];
//     const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//       headers: { Authorization: `Bearer ${user?.token}` },
//     });
//     if (ok && data) {
//       const p = data.profile || data.data || (data._id ? data : null);
//       if (p) { profileCache[userId] = p; return p; }
//     }
//     return null;
//   };

//   const viewCreatorProfile = async (n: any) => {
//     try {
//       setProfileLoading(n._id);
//       const senderId = extractMongoId(n.sender);
//       if (senderId) {
//         const profile = await fetchProfile(senderId);
//         if (profile) {
//           setCreatorNames(prev => ({ ...prev, [n._id]: profile.name || prev[n._id] }));
//           setSelectedProfile({ ...profile, notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link });
//           return;
//         }
//       }
//       const campaignId = getCampaignId(n);
//       if (campaignId) {
//         const { ok, data: appData } = await safeFetch(`${API}/campaigns/${campaignId}/applications`, {
//           headers: { Authorization: `Bearer ${user.token}` },
//         });
//         if (ok && appData) {
//           const apps = appData.applications || appData.data || [];
//           const app  = apps.find((a: any) => extractMongoId(a.influencerId) === senderId) || apps[apps.length - 1];
//           if (app) {
//             const creatorId = extractMongoId(app.influencerId) || extractMongoId(app.influencer);
//             if (creatorId) {
//               const profile = await fetchProfile(creatorId);
//               if (profile) {
//                 setSelectedProfile({ ...profile, applicationId: extractMongoId(app._id) || app._id, notifId: n._id, status: n.applicationStatus || app.status, campaignId, link: n.link });
//                 return;
//               }
//             }
//           }
//         }
//       }
//       setSelectedProfile({ name: "Creator", profileImage: null, bio: "", followers: "", categories: [], platform: "", notifId: n._id, status: n.applicationStatus, campaignId: getCampaignId(n), link: n.link, _noProfile: true });
//     } catch (err) { console.error(err); }
//     finally { setProfileLoading(""); }
//   };

//   const saveStatusLocally = (notifId: string, status: string) => {
//     try {
//       const existing = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       existing[notifId] = status;
//       localStorage.setItem("cb_notif_status", JSON.stringify(existing));
//     } catch { }
//   };

//   const getApplicationId = async (applicationId: string, notifId: string): Promise<string> => {
//     if (applicationId && /^[a-f0-9]{24}$/i.test(applicationId)) return applicationId;
//     const n = notifications.find(x => x._id === notifId);
//     if (!n) return applicationId || "";
//     const campId = getCampaignId(n);
//     if (!campId) return applicationId || "";
//     const { ok, data } = await safeFetch(`${API}/campaigns/${campId}/applications`, { headers: { Authorization: `Bearer ${user.token}` } });
//     if (!ok || !data) return applicationId || "";
//     const apps     = data.applications || data.data || [];
//     const senderId = extractMongoId(n.sender);
//     const app      = apps.find((a: any) => extractMongoId(a.influencerId) === senderId || extractMongoId(a.influencer) === senderId) || apps[apps.length - 1];
//     return app?._id || applicationId || "";
//   };

//   const acceptCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_accept");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "accepted" }),
//       });
//       if (!result.ok) {
//         const errMsg = result.data?.message || "Accept failed";
//         if (!errMsg.toLowerCase().includes("already")) throw new Error(errMsg);
//       }
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "accepted", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "accepted" }));
//       saveStatusLocally(notifId, "accepted");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         const campId    = getCampaignId(n) || "";
//         if (creatorId) {
//           await sendNotif(creatorId, "application_accepted", "🎉 Your application has been accepted!", realAppId);
//           const r = await safeFetch(`${API}/conversations/create`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//             body: JSON.stringify({ participantId: creatorId, campaignId: campId }),
//           });
//           const convId = r.data?.data?._id || r.data?.conversation?._id || r.data?._id || "";
//           if (convId) {
//             await safeFetch(`${API}/conversations/send/${convId}`, {
//               method: "POST",
//               headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//               body: JSON.stringify({ text: "🎉 Congratulations! Your application has been accepted. Let's discuss the next steps!" }),
//             });
//           }
//         }
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Accept failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   const rejectCreator = async (applicationId: string, notifId: string) => {
//     try {
//       setActionLoading(notifId + "_reject");
//       const realAppId = await getApplicationId(applicationId, notifId);
//       if (!realAppId) { alert("Application not found"); return; }
//       const result = await safeFetch(`${API}/application/${realAppId}/decision`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ decision: "rejected" }),
//       });
//       if (!result.ok) throw new Error(result.data?.message || "Reject failed");
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, applicationStatus: "rejected", applicationId: realAppId } : n));
//       if (selectedProfile?.notifId === notifId) setSelectedProfile((p: any) => ({ ...p, status: "rejected" }));
//       saveStatusLocally(notifId, "rejected");
//       markRead(notifId);
//       try {
//         const n         = notifications.find(x => x._id === notifId);
//         const creatorId = extractMongoId(n?.sender);
//         if (creatorId) await sendNotif(creatorId, "application_rejected", "Your application was not selected this time. Keep applying! 💪", realAppId);
//       } catch { }
//     } catch (err: any) {
//       setNotifications(prev => prev.map(n => n._id === notifId ? { ...n, _error: err.message || "Reject failed" } : n));
//     } finally { setActionLoading(""); }
//   };

//   // ✅ Invite respond
//   const handleInviteResponse = async (n: any, action: "accepted" | "rejected") => {
//     const inviteId = extractMongoId(n.data?.inviteId) || extractMongoId(n.inviteId) || "";
//     if (!inviteId) { alert("Invite ID not found. Please refresh."); return; }
//     setInviteLoading(n._id + "_" + action);
//     try {
//       const { ok, data } = await safeFetch(`${API}/invite/respond`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
//         body: JSON.stringify({ inviteId, action }),
//       });
//       if (!ok) { alert(data?.message || "Failed to respond"); return; }
//       const saved = JSON.parse(localStorage.getItem("cb_invite_status") || "{}");
//       saved[n._id] = action;
//       localStorage.setItem("cb_invite_status", JSON.stringify(saved));
//       setNotifications(prev => prev.map(x => x._id === n._id ? { ...x, _inviteStatus: action, read: true } : x));
//       markRead(n._id);
//       if (action === "accepted" && data?.conversation?._id) router.push("/messages");
//     } catch (err) { console.error(err); alert("Something went wrong."); }
//     finally { setInviteLoading(""); }
//   };

//   const goToMessage = (profile: any) => {
//     const creatorUserId = extractMongoId(profile.user) || extractMongoId(profile) || profile._id || "";
//     const campId        = profile.campaignId || getCampaignId({ link: profile.link }) || "";
//     router.push(`/messages?userId=${creatorUserId}&campaignId=${campId}`);
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

//   const isBrandApplyNotif       = (n: any) => ["new_application", "campaign_apply", "application"].includes(n.type);
//   const isInfluencerStatusNotif = (n: any) => ["application_accepted", "application_rejected", "application_status", "campaign_update"].includes(n.type);

//   const getStatus = (n: any) => {
//     const s = n.applicationStatus || n.application?.status || "";
//     if (s) return s.toLowerCase();
//     if (n.type === "campaign_update")      return "rejected";
//     if (n.type === "application_rejected") return "rejected";
//     if (n.type === "application_accepted") return "accepted";
//     return "";
//   };

//   if (!user) return null;
//   const isBrand = userRole === "brand";

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; }
//         .np { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; padding-bottom: 60px; }
//         .np-header { background: #fff; border-bottom: 1px solid #ebebeb; padding: 24px 32px; display: flex; align-items: center; }
//         .np-title { font-size: 22px; font-weight: 800; color: #111; }
//         .np-badge { background: #4f46e5; color: #fff; border-radius: 100px; font-size: 11px; font-weight: 700; padding: 3px 10px; margin-left: 8px; }
//         .np-mark-all-btn { margin-left: auto; background: none; border: none; font-size: 12px; font-weight: 600; color: #4f46e5; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; padding: 4px 8px; border-radius: 8px; }
//         .np-mark-all-btn:hover { background: #eef2ff; }
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
//         .np-status { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 100px; font-size: 13px; font-weight: 700; margin-top: 12px; }
//         .np-status-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
//         .np-status-rejected { background: #fff5f5; color: #dc2626; border: 1.5px solid #fecaca; }
//         .np-status-pending { background: #fefce8; color: #ca8a04; border: 1.5px solid #fde68a; }
//         .np-msg-btn { margin-top: 10px; padding: 10px 18px; background: #4f46e5; color: #fff; border: none; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; }
//         .np-msg-btn:hover { background: #4338ca; }
//         .np-invite-card { margin-top: 14px; background: linear-gradient(135deg,#eef2ff,#f5f3ff); border-radius: 14px; padding: 16px; border: 1.5px solid #c7d2fe; }
//         .np-invite-title { font-size: 14px; font-weight: 700; color: #4f46e5; margin-bottom: 4px; }
//         .np-invite-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; line-height: 1.5; }
//         .np-invite-actions { display: flex; gap: 8px; }
//         .np-invite-accept { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; transition: all 0.2s; }
//         .np-invite-accept:hover:not(:disabled) { transform: translateY(-1px); }
//         .np-invite-accept:disabled { opacity: 0.6; cursor: not-allowed; }
//         .np-invite-reject { flex: 1; padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #fecaca; cursor: pointer; background: #fff5f5; color: #dc2626; transition: all 0.2s; }
//         .np-invite-reject:hover:not(:disabled) { background: #fee2e2; }
//         .np-invite-reject:disabled { opacity: 0.6; cursor: not-allowed; }
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
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .spinner{width:28px;height:28px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto}
//       `}</style>

//       <div className="np">
//         <div className="np-header">
//           <span className="np-title">Notifications</span>
//           {notifications.filter(n => !n.read).length > 0 && (
//             <>
//               <span className="np-badge">{notifications.filter(n => !n.read).length}</span>
//               <button className="np-mark-all-btn" onClick={markAllRead}>Mark all read</button>
//             </>
//           )}
//         </div>

//         <div className="np-body">
//           {loading ? (
//             <div style={{ padding: "60px", textAlign: "center" }}><div className="spinner" /></div>
//           ) : notifications.length === 0 ? (
//             <div className="np-empty">
//               <div className="np-empty-icon">🔔</div>
//               <div className="np-empty-title">No notifications yet</div>
//               <div className="np-empty-sub">Your notifications will appear here</div>
//             </div>
//           ) : (
//             notifications.map((n) => {
//               const status      = getStatus(n);
//               const isAccepted  = status === "accepted";
//               const isRejected  = status === "rejected";
//               const isPending   = !isAccepted && !isRejected;

//               const showBrandActions     = isBrand && isBrandApplyNotif(n);
//               // ✅ Invite for influencer
//               const showInviteActions    = !isBrand && n.type === "invite";
//               const inviteStatus         = n._inviteStatus || "";
//               const inviteAccepted       = inviteStatus === "accepted";
//               const inviteRejected       = inviteStatus === "rejected";
//               const showInfluencerStatus = !isBrand && !showInviteActions && (isInfluencerStatusNotif(n) || n.applicationStatus);

//               return (
//                 <div key={n._id} className={`np-card ${!n.read ? "unread" : ""}`}
//                   onClick={() => markRead(n._id)}>
//                   <div className="np-card-top">
//                     <div className={`np-dot ${n.read ? "read" : ""}`} />
//                     <div style={{ flex: 1 }}>
//                       <div className="np-type">{n.type?.replace(/_/g, " ")}</div>
//                       <div className="np-msg">{n.message}</div>
//                       <div className="np-time">{timeAgo(n.createdAt)}</div>
//                       {n._error && (
//                         <div style={{marginTop:8,padding:"8px 12px",background:"#fff5f5",border:"1px solid #fecaca",borderRadius:8,fontSize:12,color:"#dc2626",fontWeight:600}}>
//                           ⚠️ {n._error}
//                         </div>
//                       )}

//                       {/* ── BRAND: Accept/Reject ── */}
//                       {showBrandActions && (
//                         <>
//                           <div className="np-creator-strip"
//                             onClick={(e) => { e.stopPropagation(); viewCreatorProfile(n); }}>
//                             <div className="np-avatar">👤</div>
//                             <div style={{ flex: 1 }}>
//                               <div className="np-creator-name">{blurName(creatorNames[n._id] || "Creator", isAccepted)}</div>
//                               <div className="np-creator-sub">View Profile →</div>
//                             </div>
//                             {profileLoading === n._id
//                               ? <div style={{ width: "16px", height: "16px", border: "2px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
//                               : <span className="np-view">View →</span>}
//                           </div>
//                           <div className="np-actions">
//                             {isPending ? (
//                               <>
//                                 <button className="np-btn np-btn-accept"
//                                   disabled={actionLoading === n._id + "_accept"}
//                                   onClick={(e) => { e.stopPropagation(); acceptCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_accept" ? "..." : "✓ Accept"}
//                                 </button>
//                                 <button className="np-btn np-btn-reject"
//                                   disabled={actionLoading === n._id + "_reject"}
//                                   onClick={(e) => { e.stopPropagation(); rejectCreator(n.applicationId, n._id); }}>
//                                   {actionLoading === n._id + "_reject" ? "..." : "✗ Reject"}
//                                 </button>
//                               </>
//                             ) : isAccepted ? (
//                               <>
//                                 <div className="np-status np-status-accepted">✓ Accepted</div>
//                                 <button className="np-btn np-btn-msg"
//                                   onClick={(e) => {
//                                     e.stopPropagation();
//                                     const creatorId = extractMongoId(n.sender);
//                                     const campId    = getCampaignId(n) || "";
//                                     router.push(creatorId ? `/messages?userId=${creatorId}&campaignId=${campId}` : "/messages");
//                                   }}>
//                                   💬 Message Creator
//                                 </button>
//                               </>
//                             ) : (
//                               <div className="np-status np-status-rejected">✗ Rejected</div>
//                             )}
//                           </div>
//                         </>
//                       )}

//                       {/* ── INFLUENCER: Invite Accept/Reject ── */}
//                       {showInviteActions && (
//                         <div className="np-invite-card" onClick={e => e.stopPropagation()}>
//                           <div className="np-invite-title">🤝 Brand wants to connect!</div>
//                           <div className="np-invite-sub">Accept to start chatting and collaborate on their campaign.</div>
//                           {!inviteAccepted && !inviteRejected ? (
//                             <div className="np-invite-actions">
//                               <button className="np-invite-accept"
//                                 disabled={inviteLoading === n._id + "_accepted"}
//                                 onClick={() => handleInviteResponse(n, "accepted")}>
//                                 {inviteLoading === n._id + "_accepted" ? "Accepting..." : "✓ Accept"}
//                               </button>
//                               <button className="np-invite-reject"
//                                 disabled={inviteLoading === n._id + "_rejected"}
//                                 onClick={() => handleInviteResponse(n, "rejected")}>
//                                 {inviteLoading === n._id + "_rejected" ? "..." : "✗ Decline"}
//                               </button>
//                             </div>
//                           ) : inviteAccepted ? (
//                             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
//                               <div style={{ fontSize: 13, fontWeight: 600, color: "#4f46e5", marginBottom: 2 }}>
//                                 🏢 {creatorNames[n._id] || "Brand"}
//                               </div>
//                               <div className="np-status np-status-accepted">✅ Connected! Chat is open.</div>
//                               <button className="np-msg-btn" onClick={() => router.push("/messages")}>💬 Go to Messages</button>
//                             </div>
//                           ) : (
//                             <div className="np-status np-status-rejected">✗ Declined</div>
//                           )}
//                         </div>
//                       )}

//                       {/* ── INFLUENCER: Application Status ── */}
//                       {showInfluencerStatus && (
//                         <div style={{ marginTop: "10px" }}>
//                           <div style={{ fontSize: 12, color: "#888", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
//                             <span>🏢</span>
//                             <span style={{ fontWeight: 600, color: "#555" }}>{creatorNames[n._id] || "Brand"}</span>
//                             <span style={{ color: "#bbb" }}>reviewed your application</span>
//                           </div>
//                           {isAccepted ? (
//                             <>
//                               <div className="np-status np-status-accepted">✅ Application Accepted!</div>
//                               <button className="np-msg-btn"
//                                 onClick={(e) => {
//                                   e.stopPropagation();
//                                   const brandId = extractMongoId(n.sender);
//                                   const campId  = getCampaignId(n) || "";
//                                   router.push(brandId ? `/messages?userId=${brandId}&campaignId=${campId}` : "/messages");
//                                 }}>
//                                 💬 Chat with Brand
//                               </button>
//                             </>
//                           ) : isRejected ? (
//                             <div className="np-status np-status-rejected">❌ Application Not Selected</div>
//                           ) : (
//                             <div className="np-status np-status-pending">⏳ Application Under Review</div>
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

//       {/* Profile Modal — sirf brand ke liye */}
//       {selectedProfile && isBrand && (
//         <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="pm-modal">
//             <div className="pm-top">
//               <button className="pm-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="pm-avatar-big">
//                 {selectedProfile.profileImage
//                   ? <img src={selectedProfile.profileImage} alt="avatar" />
//                   : (selectedProfile.name || "C").charAt(0).toUpperCase()}
//               </div>
//               <div className="pm-name">{(() => {
//                 const name  = selectedProfile.name || "Creator";
//                 const parts = name.trim().split(" ");
//                 if (parts.length === 1 || selectedProfile.status === "accepted") return <span>{name}</span>;
//                 return <span>{parts[0]} <span style={{filter:"blur(4px)",userSelect:"none"}}>{parts.slice(1).join(" ")}</span></span>;
//               })()}</div>
//               {selectedProfile.location && <div className="pm-location">📍 {selectedProfile.location}</div>}
//               <div className="pm-tags">
//                 {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                   .filter(Boolean).map((cat: string, i: number) => <span key={i} className="pm-tag">{cat}</span>)}
//               </div>
//             </div>
//             <div className="pm-body">
//               <div className="pm-stats">
//                 <div className="pm-stat"><div className="pm-stat-num">{formatFollowers(selectedProfile.followers)}</div><div className="pm-stat-label">Followers</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{Array.isArray(selectedProfile.categories) ? selectedProfile.categories.length : selectedProfile.categories ? 1 : 0}</div><div className="pm-stat-label">Niches</div></div>
//                 <div className="pm-stat"><div className="pm-stat-num">{selectedProfile.platform ? "✓" : "—"}</div><div className="pm-stat-label">Platform</div></div>
//               </div>
//               {selectedProfile.bio && <div><div className="pm-label">About</div><div className="pm-bio">{selectedProfile.bio}</div></div>}
//             </div>
//             {selectedProfile.status === "accepted" && <div className="pm-banner pm-banner-accepted">✅ You have accepted this creator!</div>}
//             {selectedProfile.status === "rejected" && <div className="pm-banner pm-banner-rejected">❌ You have rejected this creator</div>}
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
//                 <button className="pm-btn pm-btn-accept" style={{flex:"none",width:"100%"}}
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


