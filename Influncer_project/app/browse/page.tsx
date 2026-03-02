"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";
const FREE_LIMIT = 4; // Free plan mein sirf 4 creators dikhenge

// Connection states:
// "none"     → Connect button dikhao
// "pending"  → "Request Sent" dikhao (brand ne bheja, creator ne accept nahi kiya)
// "accepted" → "Connected ✓" + 💬 Chat icon dikhao
// "rejected" → "Connect" button fir se (optional)

interface Creator {
  _id: string;
  name?: string;
  bio?: string;
  profileImage?: string;
  city?: string;
  location?: string;
  categories?: string | string[];
  followers?: number | string;
}

type ConnectStatus = "none" | "pending" | "accepted" | "rejected";

export default function BrowsePage() {
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  const [connecting, setConnecting] = useState<string | null>(null);

  // { creatorId: "pending" | "accepted" | "rejected" }
  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});

  const [filterNiche, setFilterNiche] = useState<string>("");
  const [filterCity, setFilterCity] = useState<string>("");
  const [niches, setNiches] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);

  useEffect(() => {
    const user = localStorage.getItem("cb_user");
    if (!user) { router.push("/login"); return; }
    const parsed = JSON.parse(user);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
    const t: string = parsed.token || localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    setToken(t);
    const id = parsed.user?._id || parsed._id || parsed.id || "";
    setMyId(id);

    // Load saved connect statuses
    const saved: Record<string, ConnectStatus> = JSON.parse(
      localStorage.getItem("connectStatus") || "{}"
    );
    setConnectStatus(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchCreators();
    // Poll for accepted/rejected every 15 seconds
    const interval = setInterval(() => checkAcceptedConnections(), 15000);
    return () => clearInterval(interval);
  }, [token]);

  // ✅ Check if any pending requests got accepted by checking conversations
  const checkAcceptedConnections = async () => {
    try {
      const res = await fetch(`${API}/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (text.startsWith("<!")) return;
      const data = JSON.parse(text);
      const convs = data.data || data.conversations || [];

      const saved: Record<string, ConnectStatus> = JSON.parse(
        localStorage.getItem("connectStatus") || "{}"
      );

      let changed = false;
      convs.forEach((c: any) => {
        const participants: any[] = c.participants || [];
        participants.forEach((p: any) => {
          const pid = p._id || p.id || p;
          if (pid && pid !== myId && saved[pid] === "pending") {
            saved[pid] = "accepted";
            changed = true;
          }
        });
      });

      if (changed) {
        setConnectStatus({ ...saved });
        localStorage.setItem("connectStatus", JSON.stringify(saved));
      }
    } catch { /* silent */ }
  };

  const fetchProfile = async (userId: string): Promise<Creator | null> => {
    try {
      const r = await fetch(`${API}/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t = await r.text();
      if (!t.startsWith("<!")) {
        const d = JSON.parse(t);
        const p = d.profile || d.data || d;
        if (p && (p.name || p._id)) return { _id: userId, ...p };
      }
    } catch { /* try next */ }
    try {
      const r2 = await fetch(`${API}/profile/user/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const t2 = await r2.text();
      if (!t2.startsWith("<!")) {
        const d2 = JSON.parse(t2);
        const p = d2.profile || d2.data || d2;
        if (p && (p.name || p._id)) return { _id: userId, ...p };
      }
    } catch { /* skip */ }
    return null;
  };

  const fetchCreators = async (): Promise<void> => {
    try {
      setLoading(true);
      const creatorIds = new Set<string>();

      // Source 1: Brand campaigns applications
      try {
        const campRes = await fetch(`${API}/campaigns/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const campText = await campRes.text();
        if (!campText.startsWith("<!")) {
          const campData = JSON.parse(campText);
          const campaigns = campData.data || campData.campaigns || [];
          for (const camp of campaigns) {
            try {
              const appRes = await fetch(`${API}/campaigns/${camp._id}/applications`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const appText = await appRes.text();
              if (appText.startsWith("<!")) continue;
              const appData = JSON.parse(appText);
              const apps = appData.data || appData.applications || appData.applicants || (Array.isArray(appData) ? appData : []);
              apps.forEach((a: any) => {
                const id = a.influencer?._id || a.influencerId || a.userId || a.user?._id || a._id;
                if (id) creatorIds.add(id);
              });
            } catch { continue; }
          }
        }
      } catch { /* skip */ }

      // Source 2: Notifications
      try {
        const nr = await fetch(`${API}/notification`, { headers: { Authorization: `Bearer ${token}` } });
        const nt = await nr.text();
        if (!nt.startsWith("<!")) {
          const nd = JSON.parse(nt);
          (nd.data || nd.notifications || []).forEach((n: any) => {
            const id = n.from?._id || n.fromId || n.senderId || n.applicantId;
            if (id) creatorIds.add(id);
          });
        }
      } catch { /* skip */ }

      // Source 3: Existing conversations
      try {
        const cr = await fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
        const ct = await cr.text();
        if (!ct.startsWith("<!")) {
          const cd = JSON.parse(ct);
          (cd.data || cd.conversations || []).forEach((c: any) => {
            (c.participants || []).forEach((p: any) => {
              const id = p._id || p.id || p;
              if (id && typeof id === "string" && id !== myId) creatorIds.add(id);
            });
          });
        }
      } catch { /* skip */ }

      // Fetch profiles
      const profiles: Creator[] = [];
      for (const id of Array.from(creatorIds)) {
        const profile = await fetchProfile(id);
        if (profile) {
          const role = (profile as any).role?.toLowerCase();
          if (!role || role === "influencer" || role === "creator") {
            profiles.push(profile);
          }
        }
      }

      setCreators(profiles);

      // Check which pending ones are now accepted
      await checkAcceptedConnections();

      // Filters
      const nicheSet = new Set<string>();
      const citySet = new Set<string>();
      profiles.forEach((c: Creator) => {
        const cats = c.categories || [];
        const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
        arr.forEach((cat: string) => { if (cat?.trim()) nicheSet.add(cat.toLowerCase().trim()); });
        const city = c.city || c.location || "";
        if (city?.trim()) citySet.add(city.toLowerCase().trim());
      });
      try {
        const [cr2, mr] = await Promise.all([
          fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const cd2 = await cr2.json();
        const md = await mr.json();
        (cd2.data || []).forEach((c: string) => citySet.add(c.toLowerCase().trim()));
        (md.data || []).forEach((c: string) => nicheSet.add(c.toLowerCase().trim()));
      } catch { /* optional */ }
      setNiches([...nicheSet].filter(Boolean));
      setCities([...citySet].filter(Boolean));

    } catch (err) {
      console.error("fetchCreators error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (creatorId: string): Promise<void> => {
    const status = connectStatus[creatorId] || "none";
    if (status === "accepted") {
      router.push(`/messages?with=${creatorId}`);
      return;
    }
    if (status === "pending") return;
    setConnecting(creatorId);

    try {
      // ✅ Step 1: Creator ko notification bhejo — /api/notification/create use karo
      // Backend model mein "new_message" type available hai
      const notifRes = await fetch(`${API}/notification/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user: creatorId,           // creator ki ID — usse notification jayegi
          message: `A brand wants to connect with you! Check your messages.`,
          type: "new_message",       // backend enum mein yahi available hai
          link: "/messages",
        }),
      });
      const notifText = await notifRes.text();
      console.log("Notification sent:", notifRes.status, notifText);

      // ✅ Step 2: Conversation bhi create karo taaki creator messages mein dekh sake
      let campaignId = "";
      try {
        const campRes = await fetch(`${API}/campaigns/my`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const campText = await campRes.text();
        if (!campText.startsWith("<!")) {
          const campData = JSON.parse(campText);
          const camps = campData.data || campData.campaigns || [];
          if (camps.length > 0) campaignId = camps[0]._id;
        }
      } catch { /* skip */ }

      const convBody: any = { participantId: creatorId };
      if (campaignId) convBody.campaignId = campaignId;

      const convRes = await fetch(`${API}/conversations/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(convBody),
      });
      const convText = await convRes.text();
      console.log("Conversation:", convRes.status, convText);

      // ✅ Step 3: Status update karo
      if (notifRes.ok || convRes.ok) {
        const updated = { ...connectStatus, [creatorId]: "accepted" as ConnectStatus };
        setConnectStatus(updated);
        localStorage.setItem("connectStatus", JSON.stringify(updated));
      } else {
        const updated = { ...connectStatus, [creatorId]: "pending" as ConnectStatus };
        setConnectStatus(updated);
        localStorage.setItem("connectStatus", JSON.stringify(updated));
      }
    } catch (err) {
      console.error("Connect error:", err);
    } finally {
      setConnecting(null);
    }
  };

  const filtered: Creator[] = creators.filter((c: Creator) => {
    const cats = c.categories || [];
    const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
    const nicheMatch = filterNiche ? arr.some((cat: string) => cat?.toLowerCase() === filterNiche) : true;
    const city = (c.city || c.location || "").toLowerCase();
    const cityMatch = filterCity ? city === filterCity : true;
    return nicheMatch && cityMatch;
  });

  const getName = (c: Creator): string => (c as any).name || "Creator";
  const getBio = (c: Creator): string => (c as any).bio || "";
  const getImage = (c: Creator): string | null => (c as any).profileImage || null;
  const getCats = (c: Creator): string[] => {
    const cats = c.categories || [];
    return (Array.isArray(cats) ? cats : [cats as string]).filter(Boolean);
  };
  const getCity = (c: Creator): string => c.city || c.location || "";
  const cap = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  const catEmoji: Record<string, string> = {
    fashion:"👗", beauty:"💄", fitness:"💪", food:"🍕", travel:"✈️",
    tech:"💻", lifestyle:"🌟", gaming:"🎮", music:"🎵", sports:"⚽",
    education:"📚", comedy:"😂", dance:"💃", photography:"📷", art:"🎨",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .browse { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

        .browse-header { padding: 36px 40px 0; }
        @media(max-width:600px){ .browse-header{ padding: 24px 16px 0; } }
        .browse-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin-bottom: 4px; }
        .browse-sub { font-size: 14px; color: #999; }

        .browse-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; align-items: center; }
        @media(max-width:600px){ .browse-filters{ padding: 16px; } }
        .browse-select { padding: 9px 32px 9px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center; font-size: 13px; font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; outline: none; cursor: pointer; appearance: none; transition: all 0.2s; }
        .browse-select.active { border-color: #4f46e5; background-color: #4f46e5; color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); }
        .browse-clear { padding: 9px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; color: #999; cursor: pointer; transition: all 0.2s; }
        .browse-clear:hover { border-color: #ef4444; color: #ef4444; }
        .browse-count { font-size: 13px; color: #999; margin-left: auto; }
        .browse-count span { font-weight: 700; color: #4f46e5; }

        .browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; padding: 0 40px 48px; }
        @media(max-width:600px){ .browse-grid{ grid-template-columns: 1fr; padding: 0 16px 32px; gap: 14px; } }

        .cc { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; overflow: hidden; transition: all 0.22s; position: relative; }
        .cc:hover { border-color: #c7d2fe; box-shadow: 0 8px 32px rgba(79,70,229,0.1); transform: translateY(-3px); }

        .cc-top { background: linear-gradient(135deg,#eef2ff,#f5f3ff); padding: 28px 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .cc-av { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); object-fit: cover; display: block; margin-bottom: 12px; }
        .cc-av-ph { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; font-weight: 800; margin-bottom: 12px; }
        .cc-name { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 3px; }
        .cc-city { font-size: 12px; color: #9ca3af; }
        .cc-cats { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
        .cc-cat { padding: 3px 9px; border-radius: 100px; background: rgba(79,70,229,0.08); color: #4f46e5; font-size: 11px; font-weight: 600; }

        .cc-body { padding: 16px 20px 20px; }
        .cc-bio { font-size: 13px; color: #64748b; line-height: 1.65; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 40px; }
        .cc-stats { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
        .cc-stat { background: #f8fafc; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #64748b; font-weight: 500; }

        .cc-actions { display: flex; gap: 8px; }

        /* Connect button states */
        .cc-btn { flex: 1; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
        .cc-btn-connect { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
        .cc-btn-connect:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
        .cc-btn-connect:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .cc-btn-pending { background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a !important; box-shadow: none; cursor: default; }
        .cc-btn-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0 !important; box-shadow: none; }

        /* Chat icon — only shows when accepted */
        .cc-btn-chat { width: 42px; height: 42px; border-radius: 11px; border: 1.5px solid #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; animation: popIn 0.3s ease; }
        .cc-btn-chat:hover { background: #4f46e5; color: #fff; transform: scale(1.05); }
        @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .cc-badge-accepted { position: absolute; top: 12px; right: 12px; background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; border: 1px solid #bbf7d0; }
        .cc-badge-pending { position: absolute; top: 12px; right: 12px; background: #fffbeb; color: #d97706; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; border: 1px solid #fde68a; }

        .browse-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
        .browse-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .browse-loading-text { font-size: 14px; color: #999; }
        .browse-empty { display: flex; flex-direction: column; align-items: center; padding: 80px 40px; text-align: center; }
        .browse-empty-icon { font-size: 48px; margin-bottom: 16px; }
        .browse-empty-title { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
        .browse-empty-sub { font-size: 14px; color: #aaa; max-width: 320px; line-height: 1.6; }

        /* Blurred cards */
        .cc-blurred { filter: blur(6px); user-select: none; pointer-events: none; opacity: 0.7; }
        .cc-blurred .cc-actions { pointer-events: all; }
        .cc-lock { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 28px; z-index: 2; filter: none !important; pointer-events: none; }
        .cc-btn-upgrade { flex: 1; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: "Plus Jakarta Sans", sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff; box-shadow: 0 2px 10px rgba(245,158,11,0.35); transition: all 0.2s; filter: none !important; pointer-events: all !important; }
        .cc-btn-upgrade:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,158,11,0.45); }

        /* Upgrade wall */
        .upgrade-wall { position: relative; margin: -120px 40px 48px; z-index: 10; background: linear-gradient(to bottom, transparent, #f5f5f0 60px); padding-top: 60px; }
        @media(max-width:600px){ .upgrade-wall{ margin: -100px 16px 32px; } }
        .upgrade-wall-inner { background: #fff; border-radius: 24px; border: 2px solid #e0e7ff; box-shadow: 0 8px 40px rgba(79,70,229,0.12); padding: 36px 28px; text-align: center; }
        .upgrade-wall-icon { font-size: 44px; margin-bottom: 14px; }
        .upgrade-wall-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 10px; }
        .upgrade-wall-sub { font-size: 14px; color: #666; line-height: 1.65; max-width: 340px; margin: 0 auto 22px; }
        .upgrade-wall-btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; border: none; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; font-family: "Plus Jakarta Sans", sans-serif; box-shadow: 0 4px 20px rgba(79,70,229,0.35); transition: all 0.2s; }
        .upgrade-wall-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(79,70,229,0.45); }
        .upgrade-wall-hint { font-size: 12px; color: #bbb; margin-top: 10px; }
      `}</style>

      <div className="browse">
        <div className="browse-header">
          <h1 className="browse-title">Browse Creators</h1>
          <p className="browse-sub">Connect with creators for your brand campaigns</p>
        </div>

        <div className="browse-filters">
          <select className={`browse-select ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
            <option value="">🎯 All Categories</option>
            {niches.map((n, i) => <option key={i} value={n}>{catEmoji[n] || "✨"} {cap(n)}</option>)}
          </select>
          <select className={`browse-select ${filterCity ? "active" : ""}`} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
            <option value="">🏙 All Cities</option>
            {cities.map((c, i) => <option key={i} value={c}>{cap(c)}</option>)}
          </select>
          {(filterNiche || filterCity) && (
            <button className="browse-clear" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>
          )}
          {!loading && <span className="browse-count"><span>{filtered.length}</span> creators found</span>}
        </div>

        {loading ? (
          <div className="browse-loading">
            <div className="browse-spinner" />
            <p className="browse-loading-text">Finding creators...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="browse-empty">
            <div className="browse-empty-icon">👥</div>
            <h3 className="browse-empty-title">
              {creators.length === 0 ? "No creators found yet" : "No matches"}
            </h3>
            <p className="browse-empty-sub">
              {creators.length === 0
                ? "Creators appear here once they apply to your campaigns. Post more campaigns to attract creators!"
                : "Try clearing filters to see all creators"}
            </p>
            {creators.length === 0 && (
              <button
                onClick={() => router.push("/campaigns/post")}
                style={{
                  marginTop: "20px", padding: "12px 24px",
                  background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontSize: "14px", fontWeight: 700, cursor: "pointer",
                  fontFamily: "Plus Jakarta Sans, sans-serif",
                  boxShadow: "0 2px 10px rgba(79,70,229,0.3)"
                }}
              >
                📢 Post a Campaign
              </button>
            )}
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <div className="browse-grid">
              {filtered.map((creator: Creator, index: number) => {
                const id = creator._id;
                const status: ConnectStatus = connectStatus[id] || "none";
                const isConnecting = connecting === id;
                const img = getImage(creator);
                const name = getName(creator);
                const bio = getBio(creator);
                const city = getCity(creator);
                const cats = getCats(creator);
                const isBlurred = index >= FREE_LIMIT;

                return (
                  <div key={id} className={`cc ${isBlurred ? "cc-blurred" : ""}`}
                    onClick={isBlurred ? () => router.push("/upgrade") : undefined}
                    style={isBlurred ? { cursor: "pointer" } : {}}>

                    {/* Status badge - sirf visible cards pe */}
                    {!isBlurred && status === "accepted" && <div className="cc-badge-accepted">✓ Connected</div>}
                    {!isBlurred && status === "pending" && <div className="cc-badge-pending">⏳ Pending</div>}

                    {/* Lock icon on blurred cards */}
                    {isBlurred && (
                      <div className="cc-lock">🔒</div>
                    )}

                    <div className="cc-top">
                      {img
                        ? <img src={img} alt={name} className="cc-av" />
                        : <div className="cc-av-ph">{name.charAt(0).toUpperCase()}</div>
                      }
                      <div className="cc-name">{isBlurred ? "Creator ••••" : name}</div>
                      {city && <div className="cc-city">{isBlurred ? "📍 ••••••" : `📍 ${cap(city)}`}</div>}
                      {cats.length > 0 && (
                        <div className="cc-cats">
                          {cats.slice(0, 3).map((cat: string, i: number) => (
                            <span key={i} className="cc-cat">{catEmoji[cat.toLowerCase()] || "✨"} {isBlurred ? "••••" : cap(cat)}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="cc-body">
                      <p className="cc-bio">{isBlurred ? "Upgrade to view this creator's profile and connect with them..." : (bio || "Creator available for brand collaborations.")}</p>
                      <div className="cc-stats">
                        {city && <span className="cc-stat">{isBlurred ? "📍 ••••" : `📍 ${cap(city)}`}</span>}
                        {cats[0] && <span className="cc-stat">{catEmoji[cats[0]?.toLowerCase()] || "✨"} {isBlurred ? "••••" : cap(cats[0])}</span>}
                      </div>

                      <div className="cc-actions">
                        {isBlurred ? (
                          <button className="cc-btn cc-btn-upgrade" onClick={() => router.push("/upgrade")}>
                            🔓 Unlock — Upgrade Plan
                          </button>
                        ) : status === "accepted" ? (
                          <>
                            <button className="cc-btn cc-btn-accepted" disabled>✓ Connected</button>
                            <button className="cc-btn-chat" onClick={() => router.push(`/messages?with=${id}`)} title="Open Chat">
                              💬
                            </button>
                          </>
                        ) : status === "pending" ? (
                          <button className="cc-btn cc-btn-pending" disabled>⏳ Connecting...</button>
                        ) : (
                          <button className="cc-btn cc-btn-connect" onClick={() => handleConnect(id)} disabled={isConnecting}>
                            {isConnecting ? "Connecting..." : "🤝 Connect"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Upgrade wall — filtered mein 4 se zyada creators hain to dikhao */}
            {filtered.length > FREE_LIMIT && (
              <div className="upgrade-wall">
                <div className="upgrade-wall-inner">
                  <div className="upgrade-wall-icon">🚀</div>
                  <h3 className="upgrade-wall-title">
                    {filtered.length - FREE_LIMIT} more creators available
                  </h3>
                  <p className="upgrade-wall-sub">
                    Upgrade to Pro to unlock all creators, connect without limits & get priority visibility
                  </p>
                  <button className="upgrade-wall-btn" onClick={() => router.push("/upgrade")}>
                    ✦ Upgrade to Pro
                  </button>
                  <p className="upgrade-wall-hint">Starting ₹999/month · Cancel anytime</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";
// const FREE_LIMIT = 4; // Free plan mein sirf 4 creators dikhenge

// // Connection states:
// // "none"     → Connect button dikhao
// // "pending"  → "Request Sent" dikhao (brand ne bheja, creator ne accept nahi kiya)
// // "accepted" → "Connected ✓" + 💬 Chat icon dikhao
// // "rejected" → "Connect" button fir se (optional)

// interface Creator {
//   _id: string;
//   name?: string;
//   bio?: string;
//   profileImage?: string;
//   city?: string;
//   location?: string;
//   categories?: string | string[];
//   followers?: number | string;
// }

// type ConnectStatus = "none" | "pending" | "accepted" | "rejected";

// export default function BrowsePage() {
//   const router = useRouter();
//   const [creators, setCreators] = useState<Creator[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [token, setToken] = useState<string>("");
//   const [myId, setMyId] = useState<string>("");
//   const [connecting, setConnecting] = useState<string | null>(null);

//   // { creatorId: "pending" | "accepted" | "rejected" }
//   const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});

//   const [filterNiche, setFilterNiche] = useState<string>("");
//   const [filterCity, setFilterCity] = useState<string>("");
//   const [niches, setNiches] = useState<string[]>([]);
//   const [cities, setCities] = useState<string[]>([]);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const id = parsed.user?._id || parsed._id || parsed.id || "";
//     setMyId(id);

//     // Load saved connect statuses
//     const saved: Record<string, ConnectStatus> = JSON.parse(
//       localStorage.getItem("connectStatus") || "{}"
//     );
//     setConnectStatus(saved);
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchCreators();
//     // Poll for accepted/rejected every 15 seconds
//     const interval = setInterval(() => checkAcceptedConnections(), 15000);
//     return () => clearInterval(interval);
//   }, [token]);

//   // ✅ Check if any pending requests got accepted by checking conversations
//   const checkAcceptedConnections = async () => {
//     try {
//       const res = await fetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const text = await res.text();
//       if (text.startsWith("<!")) return;
//       const data = JSON.parse(text);
//       const convs = data.data || data.conversations || [];

//       const saved: Record<string, ConnectStatus> = JSON.parse(
//         localStorage.getItem("connectStatus") || "{}"
//       );

//       let changed = false;
//       convs.forEach((c: any) => {
//         const participants: any[] = c.participants || [];
//         participants.forEach((p: any) => {
//           const pid = p._id || p.id || p;
//           if (pid && pid !== myId && saved[pid] === "pending") {
//             saved[pid] = "accepted";
//             changed = true;
//           }
//         });
//       });

//       if (changed) {
//         setConnectStatus({ ...saved });
//         localStorage.setItem("connectStatus", JSON.stringify(saved));
//       }
//     } catch { /* silent */ }
//   };

//   const fetchProfile = async (userId: string): Promise<Creator | null> => {
//     try {
//       const r = await fetch(`${API}/profile/${userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const t = await r.text();
//       if (!t.startsWith("<!")) {
//         const d = JSON.parse(t);
//         const p = d.profile || d.data || d;
//         if (p && (p.name || p._id)) return { _id: userId, ...p };
//       }
//     } catch { /* try next */ }
//     try {
//       const r2 = await fetch(`${API}/profile/user/${userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const t2 = await r2.text();
//       if (!t2.startsWith("<!")) {
//         const d2 = JSON.parse(t2);
//         const p = d2.profile || d2.data || d2;
//         if (p && (p.name || p._id)) return { _id: userId, ...p };
//       }
//     } catch { /* skip */ }
//     return null;
//   };

//   const fetchCreators = async (): Promise<void> => {
//     try {
//       setLoading(true);
//       const creatorIds = new Set<string>();

//       // Source 1: Brand campaigns applications
//       try {
//         const campRes = await fetch(`${API}/campaigns/my`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const campText = await campRes.text();
//         if (!campText.startsWith("<!")) {
//           const campData = JSON.parse(campText);
//           const campaigns = campData.data || campData.campaigns || [];
//           for (const camp of campaigns) {
//             try {
//               const appRes = await fetch(`${API}/campaigns/${camp._id}/applications`, {
//                 headers: { Authorization: `Bearer ${token}` },
//               });
//               const appText = await appRes.text();
//               if (appText.startsWith("<!")) continue;
//               const appData = JSON.parse(appText);
//               const apps = appData.data || appData.applications || appData.applicants || (Array.isArray(appData) ? appData : []);
//               apps.forEach((a: any) => {
//                 const id = a.influencer?._id || a.influencerId || a.userId || a.user?._id || a._id;
//                 if (id) creatorIds.add(id);
//               });
//             } catch { continue; }
//           }
//         }
//       } catch { /* skip */ }

//       // Source 2: Notifications
//       try {
//         const nr = await fetch(`${API}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//         const nt = await nr.text();
//         if (!nt.startsWith("<!")) {
//           const nd = JSON.parse(nt);
//           (nd.data || nd.notifications || []).forEach((n: any) => {
//             const id = n.from?._id || n.fromId || n.senderId || n.applicantId;
//             if (id) creatorIds.add(id);
//           });
//         }
//       } catch { /* skip */ }

//       // Source 3: Existing conversations
//       try {
//         const cr = await fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//         const ct = await cr.text();
//         if (!ct.startsWith("<!")) {
//           const cd = JSON.parse(ct);
//           (cd.data || cd.conversations || []).forEach((c: any) => {
//             (c.participants || []).forEach((p: any) => {
//               const id = p._id || p.id || p;
//               if (id && typeof id === "string" && id !== myId) creatorIds.add(id);
//             });
//           });
//         }
//       } catch { /* skip */ }

//       // Fetch profiles
//       const profiles: Creator[] = [];
//       for (const id of Array.from(creatorIds)) {
//         const profile = await fetchProfile(id);
//         if (profile) {
//           const role = (profile as any).role?.toLowerCase();
//           if (!role || role === "influencer" || role === "creator") {
//             profiles.push(profile);
//           }
//         }
//       }

//       setCreators(profiles);

//       // Check which pending ones are now accepted
//       await checkAcceptedConnections();

//       // Filters
//       const nicheSet = new Set<string>();
//       const citySet = new Set<string>();
//       profiles.forEach((c: Creator) => {
//         const cats = c.categories || [];
//         const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
//         arr.forEach((cat: string) => { if (cat?.trim()) nicheSet.add(cat.toLowerCase().trim()); });
//         const city = c.city || c.location || "";
//         if (city?.trim()) citySet.add(city.toLowerCase().trim());
//       });
//       try {
//         const [cr2, mr] = await Promise.all([
//           fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//           fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//         ]);
//         const cd2 = await cr2.json();
//         const md = await mr.json();
//         (cd2.data || []).forEach((c: string) => citySet.add(c.toLowerCase().trim()));
//         (md.data || []).forEach((c: string) => nicheSet.add(c.toLowerCase().trim()));
//       } catch { /* optional */ }
//       setNiches([...nicheSet].filter(Boolean));
//       setCities([...citySet].filter(Boolean));

//     } catch (err) {
//       console.error("fetchCreators error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleConnect = async (creatorId: string): Promise<void> => {
//     const status = connectStatus[creatorId] || "none";
//     if (status === "accepted") {
//       router.push(`/messages?with=${creatorId}`);
//       return;
//     }
//     if (status === "pending") return;
//     setConnecting(creatorId);

//     try {
//       // ✅ Step 1: Creator ko notification bhejo — /api/notification/create use karo
//       // Backend model mein "new_message" type available hai
//       const notifRes = await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user: creatorId,           // creator ki ID — usse notification jayegi
//           message: `A brand wants to connect with you! Check your messages.`,
//           type: "new_message",       // backend enum mein yahi available hai
//           link: "/messages",
//         }),
//       });
//       const notifText = await notifRes.text();
//       console.log("Notification sent:", notifRes.status, notifText);

//       // ✅ Step 2: Conversation bhi create karo taaki creator messages mein dekh sake
//       let campaignId = "";
//       try {
//         const campRes = await fetch(`${API}/campaigns/my`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const campText = await campRes.text();
//         if (!campText.startsWith("<!")) {
//           const campData = JSON.parse(campText);
//           const camps = campData.data || campData.campaigns || [];
//           if (camps.length > 0) campaignId = camps[0]._id;
//         }
//       } catch { /* skip */ }

//       const convBody: any = { participantId: creatorId };
//       if (campaignId) convBody.campaignId = campaignId;

//       const convRes = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify(convBody),
//       });
//       const convText = await convRes.text();
//       console.log("Conversation:", convRes.status, convText);

//       // ✅ Step 3: Status update karo
//       if (notifRes.ok || convRes.ok) {
//         const updated = { ...connectStatus, [creatorId]: "accepted" as ConnectStatus };
//         setConnectStatus(updated);
//         localStorage.setItem("connectStatus", JSON.stringify(updated));
//       } else {
//         const updated = { ...connectStatus, [creatorId]: "pending" as ConnectStatus };
//         setConnectStatus(updated);
//         localStorage.setItem("connectStatus", JSON.stringify(updated));
//       }
//     } catch (err) {
//       console.error("Connect error:", err);
//     } finally {
//       setConnecting(null);
//     }
//   };

//   const filtered: Creator[] = creators.filter((c: Creator) => {
//     const cats = c.categories || [];
//     const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
//     const nicheMatch = filterNiche ? arr.some((cat: string) => cat?.toLowerCase() === filterNiche) : true;
//     const city = (c.city || c.location || "").toLowerCase();
//     const cityMatch = filterCity ? city === filterCity : true;
//     return nicheMatch && cityMatch;
//   });

//   const getName = (c: Creator): string => (c as any).name || "Creator";
//   const getBio = (c: Creator): string => (c as any).bio || "";
//   const getImage = (c: Creator): string | null => (c as any).profileImage || null;
//   const getCats = (c: Creator): string[] => {
//     const cats = c.categories || [];
//     return (Array.isArray(cats) ? cats : [cats as string]).filter(Boolean);
//   };
//   const getCity = (c: Creator): string => c.city || c.location || "";
//   const cap = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

//   const catEmoji: Record<string, string> = {
//     fashion:"👗", beauty:"💄", fitness:"💪", food:"🍕", travel:"✈️",
//     tech:"💻", lifestyle:"🌟", gaming:"🎮", music:"🎵", sports:"⚽",
//     education:"📚", comedy:"😂", dance:"💃", photography:"📷", art:"🎨",
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         .browse { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

//         .browse-header { padding: 36px 40px 0; }
//         @media(max-width:600px){ .browse-header{ padding: 24px 16px 0; } }
//         .browse-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin-bottom: 4px; }
//         .browse-sub { font-size: 14px; color: #999; }

//         .browse-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; align-items: center; }
//         @media(max-width:600px){ .browse-filters{ padding: 16px; } }
//         .browse-select { padding: 9px 32px 9px 14px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center; font-size: 13px; font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; outline: none; cursor: pointer; appearance: none; transition: all 0.2s; }
//         .browse-select.active { border-color: #4f46e5; background-color: #4f46e5; color: #fff; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); }
//         .browse-clear { padding: 9px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; color: #999; cursor: pointer; transition: all 0.2s; }
//         .browse-clear:hover { border-color: #ef4444; color: #ef4444; }
//         .browse-count { font-size: 13px; color: #999; margin-left: auto; }
//         .browse-count span { font-weight: 700; color: #4f46e5; }

//         .browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; padding: 0 40px 48px; }
//         @media(max-width:600px){ .browse-grid{ grid-template-columns: 1fr; padding: 0 16px 32px; gap: 14px; } }

//         .cc { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; overflow: hidden; transition: all 0.22s; position: relative; }
//         .cc:hover { border-color: #c7d2fe; box-shadow: 0 8px 32px rgba(79,70,229,0.1); transform: translateY(-3px); }

//         .cc-top { background: linear-gradient(135deg,#eef2ff,#f5f3ff); padding: 28px 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
//         .cc-av { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); object-fit: cover; display: block; margin-bottom: 12px; }
//         .cc-av-ph { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; font-weight: 800; margin-bottom: 12px; }
//         .cc-name { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 3px; }
//         .cc-city { font-size: 12px; color: #9ca3af; }
//         .cc-cats { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
//         .cc-cat { padding: 3px 9px; border-radius: 100px; background: rgba(79,70,229,0.08); color: #4f46e5; font-size: 11px; font-weight: 600; }

//         .cc-body { padding: 16px 20px 20px; }
//         .cc-bio { font-size: 13px; color: #64748b; line-height: 1.65; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 40px; }
//         .cc-stats { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
//         .cc-stat { background: #f8fafc; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #64748b; font-weight: 500; }

//         .cc-actions { display: flex; gap: 8px; }

//         /* Connect button states */
//         .cc-btn { flex: 1; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; }
//         .cc-btn-connect { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .cc-btn-connect:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .cc-btn-connect:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
//         .cc-btn-pending { background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a !important; box-shadow: none; cursor: default; }
//         .cc-btn-accepted { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0 !important; box-shadow: none; }

//         /* Chat icon — only shows when accepted */
//         .cc-btn-chat { width: 42px; height: 42px; border-radius: 11px; border: 1.5px solid #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; animation: popIn 0.3s ease; }
//         .cc-btn-chat:hover { background: #4f46e5; color: #fff; transform: scale(1.05); }
//         @keyframes popIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

//         .cc-badge-accepted { position: absolute; top: 12px; right: 12px; background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; border: 1px solid #bbf7d0; }
//         .cc-badge-pending { position: absolute; top: 12px; right: 12px; background: #fffbeb; color: #d97706; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; border: 1px solid #fde68a; }

//         .browse-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
//         .browse-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .browse-loading-text { font-size: 14px; color: #999; }
//         .browse-empty { display: flex; flex-direction: column; align-items: center; padding: 80px 40px; text-align: center; }
//         .browse-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .browse-empty-title { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
//         .browse-empty-sub { font-size: 14px; color: #aaa; max-width: 320px; line-height: 1.6; }

//         /* Blurred cards */
//         .cc-blurred { filter: blur(6px); user-select: none; pointer-events: none; opacity: 0.7; }
//         .cc-blurred .cc-actions { pointer-events: all; }
//         .cc-lock { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 28px; z-index: 2; filter: none !important; pointer-events: none; }
//         .cc-btn-upgrade { flex: 1; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: "Plus Jakarta Sans", sans-serif; border: none; cursor: pointer; background: linear-gradient(135deg,#f59e0b,#d97706); color: #fff; box-shadow: 0 2px 10px rgba(245,158,11,0.35); transition: all 0.2s; filter: none !important; pointer-events: all !important; }
//         .cc-btn-upgrade:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(245,158,11,0.45); }

//         /* Upgrade wall */
//         .upgrade-wall { position: relative; margin: -120px 40px 48px; z-index: 10; background: linear-gradient(to bottom, transparent, #f5f5f0 60px); padding-top: 60px; }
//         @media(max-width:600px){ .upgrade-wall{ margin: -100px 16px 32px; } }
//         .upgrade-wall-inner { background: #fff; border-radius: 24px; border: 2px solid #e0e7ff; box-shadow: 0 8px 40px rgba(79,70,229,0.12); padding: 36px 28px; text-align: center; }
//         .upgrade-wall-icon { font-size: 44px; margin-bottom: 14px; }
//         .upgrade-wall-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 10px; }
//         .upgrade-wall-sub { font-size: 14px; color: #666; line-height: 1.65; max-width: 340px; margin: 0 auto 22px; }
//         .upgrade-wall-btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; border: none; border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer; font-family: "Plus Jakarta Sans", sans-serif; box-shadow: 0 4px 20px rgba(79,70,229,0.35); transition: all 0.2s; }
//         .upgrade-wall-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 28px rgba(79,70,229,0.45); }
//         .upgrade-wall-hint { font-size: 12px; color: #bbb; margin-top: 10px; }
//       `}</style>

//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Connect with creators for your brand campaigns</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`browse-select ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All categories</option>
//             {niches.map((n, i) => <option key={i} value={n}>{catEmoji[n] || "✨"} {cap(n)}</option>)}
//           </select>
//           <select className={`browse-select ${filterCity ? "active" : ""}`} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
//             <option value="">🏙 All Cities</option>
//             {cities.map((c, i) => <option key={i} value={c}>{cap(c)}</option>)}
//           </select>
//           {(filterNiche || filterCity) && (
//             <button className="browse-clear" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>
//           )}
//           {!loading && <span className="browse-count"><span>{filtered.length}</span> creators found</span>}
//         </div>

//         {loading ? (
//           <div className="browse-loading">
//             <div className="browse-spinner" />
//             <p className="browse-loading-text">Finding creators...</p>
//           </div>
//         ) : filtered.length === 0 ? (
//           <div className="browse-empty">
//             <div className="browse-empty-icon">👥</div>
//             <h3 className="browse-empty-title">
//               {creators.length === 0 ? "No creators found yet" : "No matches"}
//             </h3>
//             <p className="browse-empty-sub">
//               {creators.length === 0
//                 ? "Creators appear here once they apply to your campaigns. Post more campaigns to attract creators!"
//                 : "Try clearing filters to see all creators"}
//             </p>
//             {creators.length === 0 && (
//               <button
//                 onClick={() => router.push("/campaigns/post")}
//                 style={{
//                   marginTop: "20px", padding: "12px 24px",
//                   background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
//                   color: "#fff", border: "none", borderRadius: "12px",
//                   fontSize: "14px", fontWeight: 700, cursor: "pointer",
//                   fontFamily: "Plus Jakarta Sans, sans-serif",
//                   boxShadow: "0 2px 10px rgba(79,70,229,0.3)"
//                 }}
//               >
//                 📢 Post a Campaign
//               </button>
//             )}
//           </div>
//         ) : (
//           <div style={{ position: "relative" }}>
//             <div className="browse-grid">
//               {filtered.map((creator: Creator, index: number) => {
//                 const id = creator._id;
//                 const status: ConnectStatus = connectStatus[id] || "none";
//                 const isConnecting = connecting === id;
//                 const img = getImage(creator);
//                 const name = getName(creator);
//                 const bio = getBio(creator);
//                 const city = getCity(creator);
//                 const cats = getCats(creator);
//                 const isBlurred = index >= FREE_LIMIT;

//                 return (
//                   <div key={id} className={`cc ${isBlurred ? "cc-blurred" : ""}`}
//                     onClick={isBlurred ? () => router.push("/upgrade") : undefined}
//                     style={isBlurred ? { cursor: "pointer" } : {}}>

//                     {/* Status badge - sirf visible cards pe */}
//                     {!isBlurred && status === "accepted" && <div className="cc-badge-accepted">✓ Connected</div>}
//                     {!isBlurred && status === "pending" && <div className="cc-badge-pending">⏳ Pending</div>}

//                     {/* Lock icon on blurred cards */}
//                     {isBlurred && (
//                       <div className="cc-lock">🔒</div>
//                     )}

//                     <div className="cc-top">
//                       {img
//                         ? <img src={img} alt={name} className="cc-av" />
//                         : <div className="cc-av-ph">{name.charAt(0).toUpperCase()}</div>
//                       }
//                       <div className="cc-name">{isBlurred ? "Creator ••••" : name}</div>
//                       {city && <div className="cc-city">{isBlurred ? "📍 ••••••" : `📍 ${cap(city)}`}</div>}
//                       {cats.length > 0 && (
//                         <div className="cc-cats">
//                           {cats.slice(0, 3).map((cat: string, i: number) => (
//                             <span key={i} className="cc-cat">{catEmoji[cat.toLowerCase()] || "✨"} {isBlurred ? "••••" : cap(cat)}</span>
//                           ))}
//                         </div>
//                       )}
//                     </div>

//                     <div className="cc-body">
//                       <p className="cc-bio">{isBlurred ? "Upgrade to view this creator's profile and connect with them..." : (bio || "Creator available for brand collaborations.")}</p>
//                       <div className="cc-stats">
//                         {city && <span className="cc-stat">{isBlurred ? "📍 ••••" : `📍 ${cap(city)}`}</span>}
//                         {cats[0] && <span className="cc-stat">{catEmoji[cats[0]?.toLowerCase()] || "✨"} {isBlurred ? "••••" : cap(cats[0])}</span>}
//                       </div>

//                       <div className="cc-actions">
//                         {isBlurred ? (
//                           <button className="cc-btn cc-btn-upgrade" onClick={() => router.push("/upgrade")}>
//                             🔓 Unlock — Upgrade Plan
//                           </button>
//                         ) : status === "accepted" ? (
//                           <>
//                             <button className="cc-btn cc-btn-accepted" disabled>✓ Connected</button>
//                             <button className="cc-btn-chat" onClick={() => router.push(`/messages?with=${id}`)} title="Open Chat">
//                               💬
//                             </button>
//                           </>
//                         ) : status === "pending" ? (
//                           <button className="cc-btn cc-btn-pending" disabled>⏳ Connecting...</button>
//                         ) : (
//                           <button className="cc-btn cc-btn-connect" onClick={() => handleConnect(id)} disabled={isConnecting}>
//                             {isConnecting ? "Connecting..." : "🤝 Connect"}
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>

//             {/* Upgrade wall — filtered mein 4 se zyada creators hain to dikhao */}
//             {filtered.length > FREE_LIMIT && (
//               <div className="upgrade-wall">
//                 <div className="upgrade-wall-inner">
//                   <div className="upgrade-wall-icon">🚀</div>
//                   <h3 className="upgrade-wall-title">
//                     {filtered.length - FREE_LIMIT} more creators available
//                   </h3>
//                   <p className="upgrade-wall-sub">
//                     Upgrade to Pro to unlock all creators, connect without limits & get priority visibility
//                   </p>
//                   <button className="upgrade-wall-btn" onClick={() => router.push("/upgrade")}>
//                     ✦ Upgrade to Pro
//                   </button>
//                   <p className="upgrade-wall-hint">Starting ₹999/month · Cancel anytime</p>
//                 </div>
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// interface Creator {
//   _id: string;
//   name?: string;
//   bio?: string;
//   profileImage?: string;
//   city?: string;
//   location?: string;
//   categories?: string | string[];
//   followers?: number | string;
// }

// export default function BrowsePage() {
//   const router = useRouter();
//   const [creators, setCreators] = useState<Creator[]>([]);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [token, setToken] = useState<string>("");
//   const [connecting, setConnecting] = useState<string | null>(null);
//   const [connected, setConnected] = useState<string[]>([]);
//   const [filterNiche, setFilterNiche] = useState<string>("");
//   const [filterCity, setFilterCity] = useState<string>("");
//   const [niches, setNiches] = useState<string[]>([]);
//   const [cities, setCities] = useState<string[]>([]);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const saved: string[] = JSON.parse(localStorage.getItem("connectedCreators") || "[]");
//     setConnected(saved);
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchCreators();
//   }, [token]);

//   const fetchProfile = async (userId: string): Promise<Creator | null> => {
//     // Try both profile endpoints that we know work
//     try {
//       const r1 = await fetch(`${API}/profile/${userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const t1 = await r1.text();
//       if (!t1.startsWith("<!")) {
//         const d1 = JSON.parse(t1);
//         const p = d1.profile || d1.data || d1;
//         if (p && (p.name || p._id)) return { _id: userId, ...p };
//       }
//     } catch { /* try next */ }
//     try {
//       const r2 = await fetch(`${API}/profile/user/${userId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const t2 = await r2.text();
//       if (!t2.startsWith("<!")) {
//         const d2 = JSON.parse(t2);
//         const p = d2.profile || d2.data || d2;
//         if (p && (p.name || p._id)) return { _id: userId, ...p };
//       }
//     } catch { /* skip */ }
//     return null;
//   };

//   const fetchCreators = async (): Promise<void> => {
//     try {
//       setLoading(true);
//       const creatorIds = new Set<string>();

//       // ✅ Source 1: Brand ke campaigns ki applications se creator IDs nikalo
//       try {
//         const campRes = await fetch(`${API}/campaigns/my`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const campText = await campRes.text();
//         if (!campText.startsWith("<!")) {
//           const campData = JSON.parse(campText);
//           const campaigns = campData.data || campData.campaigns || (Array.isArray(campData) ? campData : []);
//           console.log("Brand campaigns:", campaigns.length);

//           for (const camp of campaigns) {
//             try {
//               const appRes = await fetch(`${API}/campaigns/${camp._id}/applications`, {
//                 headers: { Authorization: `Bearer ${token}` },
//               });
//               const appText = await appRes.text();
//               if (appText.startsWith("<!")) continue;
//               const appData = JSON.parse(appText);
//               const apps = appData.data || appData.applications || appData.applicants || (Array.isArray(appData) ? appData : []);
//               apps.forEach((a: any) => {
//                 const id = a.influencer?._id || a.influencerId || a.userId || a.user?._id || a._id;
//                 if (id) creatorIds.add(id);
//               });
//             } catch { continue; }
//           }
//         }
//       } catch { /* skip */ }

//       // ✅ Source 2: Notifications se creator IDs nikalo
//       try {
//         const notifRes = await fetch(`${API}/notification`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const notifText = await notifRes.text();
//         if (!notifText.startsWith("<!")) {
//           const notifData = JSON.parse(notifText);
//           const notifs = notifData.notifications || notifData.data || [];
//           notifs.forEach((n: any) => {
//             const id = n.from?._id || n.fromId || n.senderId || n.applicantId;
//             if (id) creatorIds.add(id);
//           });
//         }
//       } catch { /* skip */ }

//       // ✅ Source 3: Conversations se creator IDs nikalo
//       try {
//         const convRes = await fetch(`${API}/conversations/my`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         const convText = await convRes.text();
//         if (!convText.startsWith("<!")) {
//           const convData = JSON.parse(convText);
//           const convs = convData.data || convData.conversations || [];
//           convs.forEach((c: any) => {
//             const participants = c.participants || [];
//             participants.forEach((p: any) => {
//               const id = p._id || p.id || p;
//               if (id && typeof id === "string") creatorIds.add(id);
//             });
//           });
//         }
//       } catch { /* skip */ }

//       console.log("Unique creator IDs found:", creatorIds.size, [...creatorIds]);

//       // ✅ Har creator ka profile fetch karo
//       const profiles: Creator[] = [];
//       for (const id of Array.from(creatorIds)) {
//         const profile = await fetchProfile(id);
//         if (profile) {
//           // Sirf influencer role wale dikhao
//           const role = (profile as any).role?.toLowerCase();
//           if (!role || role === "influencer" || role === "creator") {
//             profiles.push(profile);
//           }
//         }
//       }

//       console.log("✅ Creators with profiles:", profiles.length);
//       setCreators(profiles);

//       // Extract filters
//       const nicheSet = new Set<string>();
//       const citySet = new Set<string>();
//       profiles.forEach((c: Creator) => {
//         const cats = c.categories || [];
//         const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
//         arr.forEach((cat: string) => { if (cat?.trim()) nicheSet.add(cat.toLowerCase().trim()); });
//         const city = c.city || c.location || "";
//         if (city?.trim()) citySet.add(city.toLowerCase().trim());
//       });

//       // Also load from meta API
//       try {
//         const [cr, mr] = await Promise.all([
//           fetch(`${API}/meta/cities`, { headers: { Authorization: `Bearer ${token}` } }),
//           fetch(`${API}/meta/categories`, { headers: { Authorization: `Bearer ${token}` } }),
//         ]);
//         const cd = await cr.json();
//         const md = await mr.json();
//         (cd.data || []).forEach((c: string) => citySet.add(c.toLowerCase().trim()));
//         (md.data || []).forEach((c: string) => nicheSet.add(c.toLowerCase().trim()));
//       } catch { /* optional */ }

//       setNiches([...nicheSet].filter(Boolean));
//       setCities([...citySet].filter(Boolean));

//     } catch (err) {
//       console.error("fetchCreators error:", err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleConnect = async (creatorId: string): Promise<void> => {
//     if (connected.includes(creatorId)) {
//       router.push(`/messages?with=${creatorId}`);
//       return;
//     }
//     setConnecting(creatorId);
//     try {
//       const res = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ participantId: creatorId }),
//       });
//       const data = await res.json();
//       console.log("Connect:", data);
//       const updated = [...connected, creatorId];
//       setConnected(updated);
//       localStorage.setItem("connectedCreators", JSON.stringify(updated));
//     } catch (err) {
//       console.error("Connect error:", err);
//     } finally {
//       setConnecting(null);
//     }
//   };

//   const filtered: Creator[] = creators.filter((c: Creator) => {
//     const cats = c.categories || [];
//     const arr: string[] = Array.isArray(cats) ? cats : [cats as string];
//     const nicheMatch = filterNiche ? arr.some((cat: string) => cat?.toLowerCase() === filterNiche) : true;
//     const city = (c.city || c.location || "").toLowerCase();
//     const cityMatch = filterCity ? city === filterCity : true;
//     return nicheMatch && cityMatch;
//   });

//   const getName = (c: Creator): string => (c as any).name || (c as any).companyName || "Creator";
//   const getBio = (c: Creator): string => (c as any).bio || "";
//   const getImage = (c: Creator): string | null => (c as any).profileImage || (c as any).avatar || null;
//   const getCats = (c: Creator): string[] => {
//     const cats = c.categories || [];
//     return (Array.isArray(cats) ? cats : [cats as string]).filter(Boolean);
//   };
//   const getCity = (c: Creator): string => c.city || c.location || "";
//   const cap = (s: string): string => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

//   const catEmoji: Record<string, string> = {
//     fashion:"👗", beauty:"💄", fitness:"💪", food:"🍕", travel:"✈️",
//     tech:"💻", lifestyle:"🌟", gaming:"🎮", music:"🎵", sports:"⚽",
//     education:"📚", comedy:"😂", dance:"💃", photography:"📷", art:"🎨",
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         .browse { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

//         .browse-header { padding: 36px 40px 0; }
//         @media(max-width:600px){ .browse-header{ padding: 24px 16px 0; } }
//         .browse-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin-bottom: 4px; }
//         .browse-sub { font-size: 14px; color: #999; }

//         .browse-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; align-items: center; }
//         @media(max-width:600px){ .browse-filters{ padding: 16px; } }

//         .browse-select {
//           padding: 9px 32px 9px 14px; border-radius: 100px;
//           border: 1.5px solid #e8e8e8;
//           background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center;
//           font-size: 13px; font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif;
//           color: #555; outline: none; cursor: pointer; appearance: none; transition: all 0.2s;
//         }
//         .browse-select.active { border-color: #4f46e5; background-color: #4f46e5; color: #fff;
//           background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
//         }
//         .browse-clear { padding: 9px 16px; border-radius: 100px; border: 1.5px solid #e8e8e8; background: #fafafa; font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif; color: #999; cursor: pointer; transition: all 0.2s; }
//         .browse-clear:hover { border-color: #ef4444; color: #ef4444; }
//         .browse-count { font-size: 13px; color: #999; margin-left: auto; }
//         .browse-count span { font-weight: 700; color: #4f46e5; }

//         .browse-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; padding: 0 40px 48px; }
//         @media(max-width:600px){ .browse-grid{ grid-template-columns: 1fr; padding: 0 16px 32px; gap: 14px; } }

//         .cc { background: #fff; border-radius: 20px; border: 1.5px solid #ebebeb; overflow: hidden; transition: all 0.22s; position: relative; }
//         .cc:hover { border-color: #c7d2fe; box-shadow: 0 8px 32px rgba(79,70,229,0.1); transform: translateY(-3px); }

//         .cc-top { background: linear-gradient(135deg,#eef2ff,#f5f3ff); padding: 28px 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
//         .cc-av { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); object-fit: cover; display: block; margin-bottom: 12px; }
//         .cc-av-ph { width: 76px; height: 76px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.15); background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; font-weight: 800; margin-bottom: 12px; }
//         .cc-name { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 3px; }
//         .cc-city { font-size: 12px; color: #9ca3af; }
//         .cc-cats { display: flex; gap: 5px; flex-wrap: wrap; justify-content: center; margin-top: 8px; }
//         .cc-cat { padding: 3px 9px; border-radius: 100px; background: rgba(79,70,229,0.08); color: #4f46e5; font-size: 11px; font-weight: 600; }

//         .cc-body { padding: 16px 20px 20px; }
//         .cc-bio { font-size: 13px; color: #64748b; line-height: 1.65; margin-bottom: 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 40px; }
//         .cc-stats { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
//         .cc-stat { background: #f8fafc; border-radius: 8px; padding: 5px 10px; font-size: 12px; color: #64748b; font-weight: 500; }

//         .cc-actions { display: flex; gap: 8px; }
//         .cc-btn-connect { flex: 1; padding: 11px; border-radius: 11px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .cc-btn-connect:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .cc-btn-connect:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
//         .cc-btn-connect.sent { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; box-shadow: none; }
//         .cc-btn-chat { width: 42px; height: 42px; border-radius: 11px; border: 1.5px solid #c7d2fe; background: #eef2ff; color: #4f46e5; font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
//         .cc-btn-chat:hover { background: #e0e7ff; transform: scale(1.05); }

//         .cc-badge { position: absolute; top: 12px; right: 12px; background: #dcfce7; color: #16a34a; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 100px; border: 1px solid #bbf7d0; }

//         .browse-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px; gap: 16px; }
//         .browse-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .browse-loading-text { font-size: 14px; color: #999; }

//         .browse-empty { display: flex; flex-direction: column; align-items: center; padding: 80px 40px; text-align: center; }
//         .browse-empty-icon { font-size: 48px; margin-bottom: 16px; }
//         .browse-empty-title { font-size: 20px; font-weight: 700; color: #111; margin-bottom: 8px; }
//         .browse-empty-sub { font-size: 14px; color: #aaa; max-width: 320px; line-height: 1.6; }
//       `}</style>

//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Find the perfect creator for your brand campaign</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`browse-select ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All Niches</option>
//             {niches.map((n, i) => <option key={i} value={n}>{catEmoji[n] || "✨"} {cap(n)}</option>)}
//           </select>
//           <select className={`browse-select ${filterCity ? "active" : ""}`} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
//             <option value="">🏙 All Cities</option>
//             {cities.map((c, i) => <option key={i} value={c}>{cap(c)}</option>)}
//           </select>
//           {(filterNiche || filterCity) && (
//             <button className="browse-clear" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>
//           )}
//           {!loading && <span className="browse-count"><span>{filtered.length}</span> creators found</span>}
//         </div>

//         {loading ? (
//           <div className="browse-loading">
//             <div className="browse-spinner" />
//             <p className="browse-loading-text">Finding creators...</p>
//           </div>
//         ) : filtered.length === 0 ? (
//           <div className="browse-empty">
//             <div className="browse-empty-icon">👥</div>
//             <h3 className="browse-empty-title">
//               {creators.length === 0 ? "No creators yet" : "No matches found"}
//             </h3>
//             <p className="browse-empty-sub">
//               {creators.length === 0
//                 ? "Creators will appear here once they sign up and set up their profile. Share your campaigns to attract creators!"
//                 : "Try clearing filters to see all creators"}
//             </p>
//           </div>
//         ) : (
//           <div className="browse-grid">
//             {filtered.map((creator: Creator) => {
//               const id = creator._id;
//               const isConnected = connected.includes(id);
//               const isConnecting = connecting === id;
//               const img = getImage(creator);
//               const name = getName(creator);
//               const bio = getBio(creator);
//               const city = getCity(creator);
//               const cats = getCats(creator);

//               return (
//                 <div key={id} className="cc">
//                   {isConnected && <div className="cc-badge">✓ Connected</div>}
//                   <div className="cc-top">
//                     {img
//                       ? <img src={img} alt={name} className="cc-av" />
//                       : <div className="cc-av-ph">{name.charAt(0).toUpperCase()}</div>
//                     }
//                     <div className="cc-name">{name}</div>
//                     {city && <div className="cc-city">📍 {cap(city)}</div>}
//                     {cats.length > 0 && (
//                       <div className="cc-cats">
//                         {cats.slice(0, 3).map((cat: string, i: number) => (
//                           <span key={i} className="cc-cat">{catEmoji[cat.toLowerCase()] || "✨"} {cap(cat)}</span>
//                         ))}
//                       </div>
//                     )}
//                   </div>
//                   <div className="cc-body">
//                     <p className="cc-bio">{bio || "Creator available for brand collaborations."}</p>
//                     <div className="cc-stats">
//                       {city && <span className="cc-stat">📍 {cap(city)}</span>}
//                       {cats[0] && <span className="cc-stat">{catEmoji[cats[0].toLowerCase()] || "✨"} {cap(cats[0])}</span>}
//                     </div>
//                     <div className="cc-actions">
//                       {isConnected ? (
//                         <>
//                           <button className="cc-btn-connect sent" disabled>✓ Connected</button>
//                           <button className="cc-btn-chat" onClick={() => router.push(`/messages?with=${id}`)}>💬</button>
//                         </>
//                       ) : (
//                         <button className="cc-btn-connect" onClick={() => handleConnect(id)} disabled={isConnecting}>
//                           {isConnecting ? "Connecting..." : "🤝 Connect"}
//                         </button>
//                       )}
//                     </div>
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