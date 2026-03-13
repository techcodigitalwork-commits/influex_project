"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

interface Creator {
  _id: string;
  name?: string;
  bio?: string;
  profileImage?: string;
  city?: string;
  location?: string;
  categories?: string | string[];
  followers?: number | string;
  platform?: string;
  createdAt?: string;
}

type ConnectStatus = "none" | "pending" | "accepted";

export default function BrowsePage() {
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [myId, setMyId] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const [filterNiche, setFilterNiche] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [niches, setNiches] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [modalCreator, setModalCreator] = useState<Creator | null>(null);

  // ── NEW: Unlock state ──
  const [unlockedEmails, setUnlockedEmails] = useState<Record<string, string>>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("cb_user");
    if (!user) { router.push("/login"); return; }
    const parsed = JSON.parse(user);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
    const t: string = parsed.token || localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    setToken(t);
    setMyId(parsed.user?._id || parsed._id || parsed.id || "");
    setConnectStatus(JSON.parse(localStorage.getItem("connectStatus_" + (parsed.user?._id || parsed._id || parsed.id || "")) || "{}"));
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAllCreators();
    const interval = setInterval(checkAcceptedConnections, 8000);
    return () => clearInterval(interval);
  }, [token]);

  const checkAcceptedConnections = async () => {
    try {
      const saved: Record<string, ConnectStatus> = JSON.parse(
        localStorage.getItem("connectStatus_" + myId) || "{}"
      );
      const pendingIds = Object.keys(saved).filter((k) => saved[k] === "pending");
      if (pendingIds.length === 0) return;

      const res = await fetch(`${API}/conversations/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (text.startsWith("<!") || !res.ok) return;

      const data = JSON.parse(text);
      const convs: any[] = data.data || data.conversations || [];
      let changed = false;

      convs.forEach((conv: any) => {
        const isAccepted = conv.status === "accepted" || conv.isAccepted === true || conv.accepted === true;
        (conv.participants || []).forEach((p: any) => {
          const pid = typeof p === "object" ? (p._id || p.id) : p;
          if (pid && pid !== myId && saved[pid] === "pending" && isAccepted) {
            saved[pid] = "accepted";
            changed = true;
          }
        });
      });

      if (!changed) {
        convs.forEach((conv: any) => {
          const hasMessages =
            (conv.lastMessage && conv.lastMessage !== "") ||
            (conv.messageCount && conv.messageCount > 0) ||
            (conv.messages && conv.messages.length > 0);
          (conv.participants || []).forEach((p: any) => {
            const pid = typeof p === "object" ? (p._id || p.id) : p;
            if (pid && pid !== myId && saved[pid] === "pending" && hasMessages) {
              saved[pid] = "accepted";
              changed = true;
            }
          });
        });
      }

      if (changed) {
        setConnectStatus({ ...saved });
        localStorage.setItem("connectStatus_" + myId, JSON.stringify(saved));
      }
    } catch { /* silent */ }
  };

  const fetchAllCreators = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/profile/influencers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
      const data = JSON.parse(text);
      const list: Creator[] = (data.data || []).map((c: any) => {
        const { phone, ...rest } = c;
        return rest;
      });
      setCreators(list);
      const ns = new Set<string>(), cs = new Set<string>();
      list.forEach((c) => {
        const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
        arr.forEach((x) => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
        const ct = (c.city || c.location || "").trim();
        if (ct) cs.add(ct.toLowerCase().trim());
      });
      setNiches([...ns].filter(Boolean));
      setCities([...cs].filter(Boolean));
      await checkAcceptedConnections();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (creatorProfileId: string) => {
    const status = connectStatus[creatorProfileId] || "none";
    if (status === "pending" || status === "accepted") return;

    setConnecting(creatorProfileId);
    try {
      const creator = creators.find(c => c._id === creatorProfileId);
      const creatorUserId = (creator as any)?.user || creatorProfileId;

      let campaignId = "";
      try {
        const cr = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
        const ct = await cr.text();
        if (!ct.startsWith("<!")) {
          const camps = JSON.parse(ct).data || JSON.parse(ct).campaigns || [];
          if (camps[0]) campaignId = camps[0]._id;
        }
      } catch { /* skip */ }

      if (!campaignId) {
        const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
        setConnectStatus(updated);
        localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
        return;
      }

      const convRes = await fetch(`${API}/conversations/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ participantId: creatorUserId, campaignId }),
      });
      let convId = "";
      try {
        const convData = JSON.parse(await convRes.text());
        convId = convData.data?._id || convData._id || "";
      } catch { /* skip */ }

      await fetch(`${API}/notification/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          user: creatorUserId,
          message: "A brand wants to connect with you! Check your messages.",
          type: "new_message",
          link: convId ? `/chat/${convId}` : "/messages",
        }),
      });

      const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
      setConnectStatus(updated);
      localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
    } catch (e) {
      console.error("Connect error:", e);
    } finally {
      setConnecting(null);
    }
  };

  // ── NEW: Unlock contact handler ──
  const handleUnlock = async (creatorProfileId: string, creatorUserId: string) => {
    if (unlockedEmails[creatorProfileId] || unlocking === creatorProfileId) return;
    setUnlocking(creatorProfileId);
    try {
      const res = await fetch(`${API}/contact/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ influencerId: creatorUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Failed to unlock contact");
        return;
      }
      setUnlockedEmails(prev => ({ ...prev, [creatorProfileId]: data.email }));
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setUnlocking(null);
    }
  };

  // ── Helper functions ──
  const gName      = (c: Creator) => c.name || "Creator";
  const gBio       = (c: Creator) => c.bio || "";
  const gImg       = (c: Creator) => c.profileImage || null;
  const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
  const gCity      = (c: Creator) => c.city || c.location || "";
  const gFollowers = (c: Creator) => {
    const f = c.followers;
    if (!f || f === "0" || f === 0) return "";
    const n = Number(f);
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return String(n);
  };
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
  const em: Record<string, string> = {
    fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
    tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
    education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
  };

  const blurNameHalf = (name: string): { visible: string; blurred: string } => {
    if (!name) return { visible: "", blurred: "" };
    const half = Math.ceil(name.length / 2);
    return { visible: name.slice(0, half), blurred: name.slice(half) };
  };

  const filtered = creators.filter((c) => {
    const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
    const nm = filterNiche ? arr.some((x) => x?.toLowerCase() === filterNiche) : true;
    const cm = filterCity ? (c.city || c.location || "").toLowerCase() === filterCity : true;
    return nm && cm;
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .browse{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}

        .browse-header{padding:36px 40px 0}
        @media(max-width:600px){.browse-header{padding:24px 16px 0}}
        .browse-title{font-size:30px;font-weight:800;color:#4f46e5;margin-bottom:4px}
        .browse-sub{font-size:14px;color:#999}

        .browse-filters{display:flex;gap:10px;padding:20px 40px;flex-wrap:wrap;align-items:center}
        @media(max-width:600px){.browse-filters{padding:16px}}
        .bsel{padding:9px 32px 9px 14px;border-radius:100px;border:1.5px solid #e8e8e8;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center;font-size:13px;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;color:#555;outline:none;cursor:pointer;appearance:none;transition:all 0.2s}
        .bsel.active{border-color:#4f46e5;background-color:#4f46e5;color:#fff;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E")}
        .bclr{padding:9px 16px;border-radius:100px;border:1.5px solid #e8e8e8;background:#fafafa;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#999;cursor:pointer}
        .bclr:hover{border-color:#ef4444;color:#ef4444}
        .bcnt{font-size:13px;color:#999;margin-left:auto}
        .bcnt span{font-weight:700;color:#4f46e5}

        .bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;padding:0 40px 48px}
        @media(max-width:600px){.bgrid{grid-template-columns:1fr;padding:0 16px 32px;gap:14px}}

        .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
        .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}

        .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
        .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
        .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
        .cc-name{font-size:16px;font-weight:800;color:#111;margin-bottom:3px}
        .cc-city{font-size:12px;color:#9ca3af}
        .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
        .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}

        .cc-body{padding:16px 20px 20px}
        .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
        .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
        .cc-stat-blur{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500;filter:blur(4px);user-select:none}

        .cc-acts{display:flex;gap:8px}
        .cbtn-connect{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
        .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
        .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .cbtn-pending{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #fde68a;cursor:default;background:#fffbeb;color:#d97706}
        .cbtn-profile{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #ddd6fe;cursor:pointer;background:#f5f3ff;color:#7c3aed;transition:all 0.2s}
        .cbtn-profile:hover{background:#ede9fe}
        .cbtn-chat{width:42px;height:42px;border-radius:11px;border:1.5px solid #c7d2fe;background:#eef2ff;color:#4f46e5;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}
        .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
        .cbtn-invite{width:42px;height:42px;border-radius:11px;border:1.5px solid #fde68a;background:#fffbeb;color:#d97706;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;text-decoration:none}
        .cbtn-invite:hover{background:#f59e0b;color:#fff;transform:scale(1.05)}
        .cbtn-unlock{width:42px;height:42px;border-radius:11px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#16a34a;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif}
        .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
        .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

        .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
        .cc-badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
        .cc-badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

        .cc-name-blur{font-size:16px;font-weight:800;color:#111;margin-bottom:3px}
        .cc-blur-text{filter:blur(5px);user-select:none;pointer-events:none}
        .cc-lock{font-size:11px;color:#9ca3af;margin-top:6px;display:flex;align-items:center;gap:4px;justify-content:center}

        .bload{display:flex;align-items:center;justify-content:center;padding:80px}
        .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
        .bempty-ico{font-size:48px;margin-bottom:16px}
        .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
        .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

        /* ── MODAL ── */
        .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
        @keyframes mfi{from{opacity:0}to{opacity:1}}
        .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
        @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
        .mo-banner{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0}
        .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
        .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
        .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
        .mo-body{padding:0 24px 28px;text-align:center}
        .mo-name{font-size:22px;font-weight:800;color:#111;margin-bottom:6px}
        .mo-tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:14px}
        .mo-tag{padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600}
        .mo-tag-cat{background:#fef3c7;color:#d97706}
        .mo-tag-city{background:#f0fdf4;color:#16a34a}
        .mo-bio{font-size:14px;color:#555;line-height:1.7;text-align:left;background:#f8fafc;border-radius:12px;padding:14px 16px;margin-bottom:18px}
        .mo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
        .mo-stat{background:#f8fafc;border-radius:12px;padding:12px 8px;text-align:center;border:1px solid #ebebeb}
        .mo-sval{font-size:18px;font-weight:800;color:#111}
        .mo-slbl{font-size:10px;color:#aaa;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
        .mo-info{text-align:left;margin-bottom:20px}
        .mo-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#444}
        .mo-row:last-child{border-bottom:none}
        .mo-acts{display:flex;gap:10px}
        .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .mo-chat{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
        .mo-chat:hover{transform:translateY(-1px)}
        .mo-cls{background:#f4f4f4;color:#666}
        .mo-cls:hover{background:#eee}
        .mo-connect{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
        .mo-connect:hover:not(:disabled){transform:translateY(-1px)}
        .mo-connect:disabled{opacity:0.6;cursor:not-allowed}
        .mo-pending-btn{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}

        .mo-lock-banner{background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:14px;padding:14px 16px;margin-bottom:18px;text-align:center}
        .mo-lock-title{font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:4px}
        .mo-lock-sub{font-size:12px;color:#9ca3af;line-height:1.5}

        .mo-blur{filter:blur(6px);user-select:none;pointer-events:none;display:inline-block}
        .mo-hidden-link{filter:blur(6px);user-select:none;pointer-events:none;font-size:13px;color:#4f46e5}

        /* Unlock email row in modal */
        .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
        .mo-unlock-row:hover{background:#f0fdf4}
        .mo-email-value{color:#16a34a;font-weight:600;word-break:break-all}
      `}</style>

      {/* ── MODAL ── */}
      {modalCreator && (() => {
        const id = modalCreator._id;
        const status = connectStatus[id] || "none";
        const isAccepted = status === "accepted";
        const isPending  = status === "pending";
        const isConn = connecting === id;
        const creatorUserId = (modalCreator as any).user || id;
        const emailUnlocked = unlockedEmails[id];
        const isUnlocking = unlocking === id;

        return (
          <div className="mo" onClick={() => setModalCreator(null)}>
            <div className="mo-box" onClick={e => e.stopPropagation()}>
              <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
              <div className="mo-banner" />
              <div className="mo-avwrap">
                {gImg(modalCreator)
                  ? <img src={gImg(modalCreator)!} alt={gName(modalCreator)} className="mo-av" />
                  : <div className="mo-avph">{gName(modalCreator).charAt(0).toUpperCase()}</div>
                }
              </div>
              <div className="mo-body">

                <div className="mo-name">
                  {isAccepted ? gName(modalCreator) : (
                    <>
                      {blurNameHalf(gName(modalCreator)).visible}
                      <span style={{filter:"blur(6px)",userSelect:"none"}}>{blurNameHalf(gName(modalCreator)).blurred}</span>
                    </>
                  )}
                </div>

                <div className="mo-tags">
                  {gCats(modalCreator)[0] && (
                    <span className="mo-tag mo-tag-cat">{em[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>
                  )}
                  {gCity(modalCreator) && (
                    <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>
                  )}
                </div>

                {gBio(modalCreator) && (
                  <div className="mo-bio">{gBio(modalCreator)}</div>
                )}

                <div className="mo-stats">
                  <div className="mo-stat">
                    <div className="mo-sval">{gFollowers(modalCreator) || "—"}</div>
                    <div className="mo-slbl">Followers</div>
                  </div>
                  <div className="mo-stat">
                    <div className="mo-sval">{gCats(modalCreator).length || "—"}</div>
                    <div className="mo-slbl">Niches</div>
                  </div>
                  <div className="mo-stat">
                    <div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div>
                    <div className="mo-slbl">City</div>
                  </div>
                </div>

                <div className="mo-info">
                  {gCity(modalCreator) && (
                    <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>
                  )}
                  {gCats(modalCreator).length > 0 && (
                    <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>
                  )}
                  {(modalCreator as any).phone && (
                    <div className="mo-row">
                      <span>📞</span>
                      {isAccepted
                        ? <span>{(modalCreator as any).phone}</span>
                        : <span>{String((modalCreator as any).phone).slice(0, 3)}XXXXXXX</span>
                      }
                    </div>
                  )}
                  {modalCreator.platform && (
                    <div className="mo-row">
                      <span>🔗</span>
                      {isAccepted
                        ? <a href={modalCreator.platform} target="_blank" rel="noreferrer"
                            style={{ color: "#4f46e5", textDecoration: "none", wordBreak: "break-all" }}>
                            {modalCreator.platform}
                          </a>
                        : <span style={{filter:"blur(6px)",userSelect:"none",fontSize:"13px",color:"#4f46e5"}}>instagram.com/hidden</span>
                      }
                    </div>
                  )}

                  {/* ── Email unlock row ── */}
                  {emailUnlocked ? (
                    <div className="mo-row">
                      <span>📧</span>
                      <span className="mo-email-value">{emailUnlocked}</span>
                    </div>
                  ) : (
                    <div
                      className="mo-row mo-unlock-row"
                      onClick={() => handleUnlock(id, creatorUserId)}
                    >
                      <span>📧</span>
                      <span style={{color:"#7c3aed",fontWeight:600}}>
                        {isUnlocking ? "⏳ Unlocking..." : "🔓 Unlock Email (50 bits)"}
                      </span>
                    </div>
                  )}

                  {modalCreator.createdAt && (
                    <div className="mo-row">
                      <span>📅</span>
                      <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
                    </div>
                  )}
                </div>

                {!isAccepted && (
                  <div className="mo-lock-banner">
                    <div className="mo-lock-title">🔒 Connect to unlock full profile</div>
                    <div className="mo-lock-sub">
                      Full name, follower count & Instagram link will be visible once the creator accepts your request.
                    </div>
                  </div>
                )}

                <div className="mo-acts">
                  {isAccepted ? (
                    <>
                      <button
                        className="mo-btn mo-chat"
                        onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}
                      >
                        💬 Open Chat
                      </button>
                      <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  ) : isPending ? (
                    <>
                      <button className="mo-btn mo-pending-btn" disabled>⏳ Request Sent</button>
                      <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="mo-btn mo-connect"
                        disabled={isConn}
                        onClick={() => handleConnect(id)}
                      >
                        {isConn ? "Sending..." : "🤝 Send Connect Request"}
                      </button>
                      <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  )}
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      <div className="browse">
        <div className="browse-header">
          <h1 className="browse-title">Browse Creators</h1>
          <p className="browse-sub">Connect with creators for your brand campaigns</p>
        </div>

        <div className="browse-filters">
          <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
            <option value="">🎯 All Niches</option>
            {niches.map((n, i) => <option key={i} value={n}>{em[n] || "✨"} {cap(n)}</option>)}
          </select>
          <select className={`bsel ${filterCity ? "active" : ""}`} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
            <option value="">🏙 All Cities</option>
            {cities.map((c, i) => <option key={i} value={c}>{cap(c)}</option>)}
          </select>
          {(filterNiche || filterCity) && (
            <button className="bclr" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>
          )}
          {!loading && <span className="bcnt"><span>{filtered.length}</span> creators found</span>}
        </div>

        {loading ? (
          <div className="bload"><div className="bspin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bempty">
            <div className="bempty-ico">👥</div>
            <h3 className="bempty-title">{creators.length === 0 ? "No creators yet" : "No matches"}</h3>
            <p className="bempty-sub">
              {creators.length === 0
                ? "Creators will appear here once they register."
                : "Try clearing filters to see all creators"}
            </p>
          </div>
        ) : (
          <div className="bgrid">
            {filtered.map((creator) => {
              const id = creator._id;
              const status = connectStatus[id] || "none";
              const isConn = connecting === id;
              const img = gImg(creator);
              const name = gName(creator);
              const isAccepted = status === "accepted";
              const isPending  = status === "pending";
              const creatorUserId = (creator as any).user || id;
              const emailUnlocked = unlockedEmails[id];
              const isUnlocking = unlocking === id;

              return (
                <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
                  {isAccepted && <div className="cc-badge cc-badge-ok">✓ Connected</div>}
                  {isPending  && <div className="cc-badge cc-badge-pend">⏳ Pending</div>}

                  <div className="cc-top">
                    {img
                      ? <img src={img} alt={name} className="cc-av" />
                      : <div className="cc-avph">{name.charAt(0).toUpperCase()}</div>
                    }
                    <div className="cc-name">
                      {isAccepted ? name : (
                        <>
                          {blurNameHalf(name).visible}
                          <span style={{filter:"blur(5px)",userSelect:"none"}}>{blurNameHalf(name).blurred}</span>
                        </>
                      )}
                    </div>
                    {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
                    {gCats(creator).length > 0 && (
                      <div className="cc-cats">
                        {gCats(creator).slice(0, 3).map((c, idx) => (
                          <span key={idx} className="cc-cat">{em[c.toLowerCase()] || "✨"} {cap(c)}</span>
                        ))}
                      </div>
                    )}
                    {!isAccepted && <div className="cc-lock">🔒 Connect to unlock full profile</div>}
                  </div>

                  <div className="cc-body">
                    <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>

                    <div className="cc-stats">
                      {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
                      {gCity(creator) && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
                      {gCats(creator)[0] && <span className="cc-stat">{em[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
                    </div>

                    <div className="cc-acts" onClick={e => e.stopPropagation()}>
                      {isAccepted ? (
                        <>
                          <button className="cbtn-profile" onClick={() => setModalCreator(creator)}>
                            👤 View Profile
                          </button>
                          <button
                            className="cbtn-chat"
                            onClick={() => router.push(`/messages?with=${id}`)}
                            title="Open Chat"
                          >
                            💬
                          </button>
                          <a href="/invite" className="cbtn-invite" title="Invite to Campaign">📨</a>

                          {/* ── Unlock Email button ── */}
                          {emailUnlocked ? (
                            <button
                              className="cbtn-unlock"
                              title={`Email: ${emailUnlocked}`}
                              style={{fontSize:"11px",cursor:"default"}}
                              disabled
                            >
                              📧
                            </button>
                          ) : (
                            <button
                              className="cbtn-unlock"
                              title="Unlock Email (50 bits)"
                              disabled={isUnlocking}
                              onClick={() => handleUnlock(id, creatorUserId)}
                            >
                              {isUnlocking ? "⏳" : "🔓"}
                            </button>
                          )}
                        </>
                      ) : isPending ? (
                        <button className="cbtn-pending" disabled>
                          ⏳ Request Sent — Awaiting Acceptance
                        </button>
                      ) : (
                        <button
                          className="cbtn-connect"
                          onClick={() => setModalCreator(creator)}
                          disabled={isConn}
                        >
                          {isConn ? "Sending..." : "🤝 Connect"}
                        </button>
                      )}
                    </div>
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
//   platform?: string;
//   createdAt?: string;
// }

// type ConnectStatus = "none" | "pending" | "accepted";

// export default function BrowsePage() {
//   const router = useRouter();
//   const [creators, setCreators] = useState<Creator[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [token, setToken] = useState("");
//   const [myId, setMyId] = useState("");
//   const [connecting, setConnecting] = useState<string | null>(null);
//   const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
//   const [filterNiche, setFilterNiche] = useState("");
//   const [filterCity, setFilterCity] = useState("");
//   const [niches, setNiches] = useState<string[]>([]);
//   const [cities, setCities] = useState<string[]>([]);
//   // Modal state — opens on card click always
//   const [modalCreator, setModalCreator] = useState<Creator | null>(null);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (!user) { router.push("/login"); return; }
//     const parsed = JSON.parse(user);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     setMyId(parsed.user?._id || parsed._id || parsed.id || "");
//     setConnectStatus(JSON.parse(localStorage.getItem("connectStatus_" + (parsed.user?._id || parsed._id || parsed.id || "")) || "{}"));
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchAllCreators();
//     const interval = setInterval(checkAcceptedConnections, 8000);
//     return () => clearInterval(interval);
//   }, [token]);

//   const checkAcceptedConnections = async () => {
//     try {
//       const saved: Record<string, ConnectStatus> = JSON.parse(
//         localStorage.getItem("connectStatus_" + myId) || "{}"
//       );
//       const pendingIds = Object.keys(saved).filter((k) => saved[k] === "pending");
//       if (pendingIds.length === 0) return;

//       const res = await fetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;

//       const data = JSON.parse(text);
//       const convs: any[] = data.data || data.conversations || [];
//       let changed = false;

//       convs.forEach((conv: any) => {
//         const isAccepted = conv.status === "accepted" || conv.isAccepted === true || conv.accepted === true;
//         (conv.participants || []).forEach((p: any) => {
//           const pid = typeof p === "object" ? (p._id || p.id) : p;
//           if (pid && pid !== myId && saved[pid] === "pending" && isAccepted) {
//             saved[pid] = "accepted";
//             changed = true;
//           }
//         });
//       });

//       if (!changed) {
//         convs.forEach((conv: any) => {
//           const hasMessages =
//             (conv.lastMessage && conv.lastMessage !== "") ||
//             (conv.messageCount && conv.messageCount > 0) ||
//             (conv.messages && conv.messages.length > 0);
//           (conv.participants || []).forEach((p: any) => {
//             const pid = typeof p === "object" ? (p._id || p.id) : p;
//             if (pid && pid !== myId && saved[pid] === "pending" && hasMessages) {
//               saved[pid] = "accepted";
//               changed = true;
//             }
//           });
//         });
//       }

//       if (changed) {
//         setConnectStatus({ ...saved });
//         localStorage.setItem("connectStatus_" + myId, JSON.stringify(saved));
//       }
//     } catch { /* silent */ }
//   };

//   const fetchAllCreators = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`${API}/profile/influencers`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const data = JSON.parse(text);
//       const list: Creator[] = (data.data || []).map((c: any) => {
//         const { phone, ...rest } = c;
//         return rest;
//       });
//       setCreators(list);
//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach((c) => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach((x) => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//       await checkAcceptedConnections();
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleConnect = async (creatorProfileId: string) => {
//     const status = connectStatus[creatorProfileId] || "none";
//     if (status === "pending" || status === "accepted") return;

//     setConnecting(creatorProfileId);
//     try {
//       const creator = creators.find(c => c._id === creatorProfileId);
//       const creatorUserId = (creator as any)?.user || creatorProfileId;

//       let campaignId = "";
//       try {
//         const cr = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
//         const ct = await cr.text();
//         if (!ct.startsWith("<!")) {
//           const camps = JSON.parse(ct).data || JSON.parse(ct).campaigns || [];
//           if (camps[0]) campaignId = camps[0]._id;
//         }
//       } catch { /* skip */ }

//       if (!campaignId) {
//         const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
//         setConnectStatus(updated);
//         localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
//         return;
//       }

//       const convRes = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ participantId: creatorUserId, campaignId }),
//       });
//       let convId = "";
//       try {
//         const convData = JSON.parse(await convRes.text());
//         convId = convData.data?._id || convData._id || "";
//       } catch { /* skip */ }

//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({
//           user: creatorUserId,
//           message: "A brand wants to connect with you! Check your messages.",
//           type: "new_message",
//           link: convId ? `/chat/${convId}` : "/messages",
//         }),
//       });

//       const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
//       setConnectStatus(updated);
//       localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
//     } catch (e) {
//       console.error("Connect error:", e);
//     } finally {
//       setConnecting(null);
//     }
//   };

//   // ── Helper functions ──
//   const gName     = (c: Creator) => c.name || "Creator";
//   const gBio      = (c: Creator) => c.bio || "";
//   const gImg      = (c: Creator) => c.profileImage || null;
//   const gCats     = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity     = (c: Creator) => c.city || c.location || "";
//   const gFollowers = (c: Creator) => {
//     const f = c.followers;
//     if (!f || f === "0" || f === 0) return "";
//     const n = Number(f);
//     if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
//     if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
//     return String(n);
//   };
//   const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
//   const em: Record<string, string> = {
//     fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
//     tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
//     education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
//   };

//   // ── Blur helpers ──
//   // Name: show first half visible, second half blurred via CSS
//   const blurNameHalf = (name: string): { visible: string; blurred: string } => {
//     if (!name) return { visible: "", blurred: "" };
//     const half = Math.ceil(name.length / 2);
//     return { visible: name.slice(0, half), blurred: name.slice(half) };
//   };

//   const filtered = creators.filter((c) => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm = filterNiche ? arr.some((x) => x?.toLowerCase() === filterNiche) : true;
//     const cm = filterCity ? (c.city || c.location || "").toLowerCase() === filterCity : true;
//     return nm && cm;
//   });

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
//         .browse{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;min-height:100vh}

//         .browse-header{padding:36px 40px 0}
//         @media(max-width:600px){.browse-header{padding:24px 16px 0}}
//         .browse-title{font-size:30px;font-weight:800;color:#4f46e5;margin-bottom:4px}
//         .browse-sub{font-size:14px;color:#999}

//         .browse-filters{display:flex;gap:10px;padding:20px 40px;flex-wrap:wrap;align-items:center}
//         @media(max-width:600px){.browse-filters{padding:16px}}
//         .bsel{padding:9px 32px 9px 14px;border-radius:100px;border:1.5px solid #e8e8e8;background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E") no-repeat right 12px center;font-size:13px;font-weight:500;font-family:'Plus Jakarta Sans',sans-serif;color:#555;outline:none;cursor:pointer;appearance:none;transition:all 0.2s}
//         .bsel.active{border-color:#4f46e5;background-color:#4f46e5;color:#fff;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E")}
//         .bclr{padding:9px 16px;border-radius:100px;border:1.5px solid #e8e8e8;background:#fafafa;font-size:13px;font-family:'Plus Jakarta Sans',sans-serif;color:#999;cursor:pointer}
//         .bclr:hover{border-color:#ef4444;color:#ef4444}
//         .bcnt{font-size:13px;color:#999;margin-left:auto}
//         .bcnt span{font-weight:700;color:#4f46e5}

//         .bgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;padding:0 40px 48px}
//         @media(max-width:600px){.bgrid{grid-template-columns:1fr;padding:0 16px 32px;gap:14px}}

//         /* Creator Card */
//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}

//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-name{font-size:16px;font-weight:800;color:#111;margin-bottom:3px}
//         .cc-city{font-size:12px;color:#9ca3af}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}

//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         /* Blurred stat */
//         .cc-stat-blur{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500;filter:blur(4px);user-select:none}

//         .cc-acts{display:flex;gap:8px}
//         .cbtn-connect{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #fde68a;cursor:default;background:#fffbeb;color:#d97706}
//         .cbtn-profile{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #ddd6fe;cursor:pointer;background:#f5f3ff;color:#7c3aed;transition:all 0.2s}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border-radius:11px;border:1.5px solid #c7d2fe;background:#eef2ff;color:#4f46e5;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-invite{width:42px;height:42px;border-radius:11px;border:1.5px solid #fde68a;background:#fffbeb;color:#d97706;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;text-decoration:none}
//         .cbtn-invite:hover{background:#f59e0b;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border-radius:11px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#16a34a;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;text-decoration:none}
//         .cbtn-unlock:hover{background:#16a34a;color:#fff;transform:scale(1.05)}

//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .cc-badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .cc-badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         /* Blur overlay on card for non-accepted */
//         .cc-name-blur{font-size:16px;font-weight:800;color:#111;margin-bottom:3px}
//         .cc-blur-text{filter:blur(5px);user-select:none;pointer-events:none}

//         /* Lock icon on card */
//         .cc-lock{font-size:11px;color:#9ca3af;margin-top:6px;display:flex;align-items:center;gap:4px;justify-content:center}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* ── MODAL ── */
//         .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
//         @keyframes mfi{from{opacity:0}to{opacity:1}}
//         .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
//         @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
//         .mo-banner{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0}
//         .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
//         .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-body{padding:0 24px 28px;text-align:center}
//         .mo-name{font-size:22px;font-weight:800;color:#111;margin-bottom:6px}
//         .mo-tags{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:14px}
//         .mo-tag{padding:4px 12px;border-radius:100px;font-size:12px;font-weight:600}
//         .mo-tag-cat{background:#fef3c7;color:#d97706}
//         .mo-tag-city{background:#f0fdf4;color:#16a34a}
//         .mo-bio{font-size:14px;color:#555;line-height:1.7;text-align:left;background:#f8fafc;border-radius:12px;padding:14px 16px;margin-bottom:18px}
//         .mo-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
//         .mo-stat{background:#f8fafc;border-radius:12px;padding:12px 8px;text-align:center;border:1px solid #ebebeb}
//         .mo-sval{font-size:18px;font-weight:800;color:#111}
//         .mo-slbl{font-size:10px;color:#aaa;font-weight:500;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .mo-info{text-align:left;margin-bottom:20px}
//         .mo-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:14px;color:#444}
//         .mo-row:last-child{border-bottom:none}
//         .mo-acts{display:flex;gap:10px}
//         .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .mo-chat{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .mo-chat:hover{transform:translateY(-1px)}
//         .mo-cls{background:#f4f4f4;color:#666}
//         .mo-cls:hover{background:#eee}
//         .mo-connect{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .mo-connect:hover:not(:disabled){transform:translateY(-1px)}
//         .mo-connect:disabled{opacity:0.6;cursor:not-allowed}
//         .mo-pending-btn{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}

//         /* Lock banner in modal */
//         .mo-lock-banner{background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:14px;padding:14px 16px;margin-bottom:18px;text-align:center}
//         .mo-lock-title{font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:4px}
//         .mo-lock-sub{font-size:12px;color:#9ca3af;line-height:1.5}

//         /* Blurred info in modal */
//         .mo-blur{filter:blur(6px);user-select:none;pointer-events:none;display:inline-block}
//         .mo-hidden-link{filter:blur(6px);user-select:none;pointer-events:none;font-size:13px;color:#4f46e5}
//       `}</style>

//       {/* ── MODAL ── */}
//       {modalCreator && (() => {
//         const id = modalCreator._id;
//         const status = connectStatus[id] || "none";
//         const isAccepted = status === "accepted";
//         const isPending  = status === "pending";
//         const isConn = connecting === id;

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner" />
//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={gName(modalCreator)} className="mo-av" />
//                   : <div className="mo-avph">{gName(modalCreator).charAt(0).toUpperCase()}</div>
//                 }
//               </div>
//               <div className="mo-body">

//                 <div className="mo-name">
//                   {isAccepted ? gName(modalCreator) : (
//                     <>
//                       {blurNameHalf(gName(modalCreator)).visible}
//                       <span style={{filter:"blur(6px)",userSelect:"none"}}>{blurNameHalf(gName(modalCreator)).blurred}</span>
//                     </>
//                   )}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && (
//                     <span className="mo-tag mo-tag-cat">{em[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>
//                   )}
//                   {gCity(modalCreator) && (
//                     <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>
//                   )}
//                 </div>

//                 {/* Bio */}
//                 {gBio(modalCreator) && (
//                   <div className="mo-bio">{gBio(modalCreator)}</div>
//                 )}

//                 {/* Stats */}
//                 <div className="mo-stats">
//                   <div className="mo-stat">
//                     <div className="mo-sval">{gFollowers(modalCreator) || "—"}</div>
//                     <div className="mo-slbl">Followers</div>
//                   </div>
//                   <div className="mo-stat">
//                     <div className="mo-sval">{gCats(modalCreator).length || "—"}</div>
//                     <div className="mo-slbl">Niches</div>
//                   </div>
//                   <div className="mo-stat">
//                     <div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div>
//                     <div className="mo-slbl">City</div>
//                   </div>
//                 </div>

//                 {/* Info rows */}
//                 <div className="mo-info">
//                   {gCity(modalCreator) && (
//                     <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>
//                   )}
//                   {gCats(modalCreator).length > 0 && (
//                     <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>
//                   )}
//                   {/* Phone — 3 digits + XXXX, hidden until accepted */}
//                   {(modalCreator as any).phone && (
//                     <div className="mo-row">
//                       <span>📞</span>
//                       {isAccepted
//                         ? <span>{(modalCreator as any).phone}</span>
//                         : <span>{String((modalCreator as any).phone).slice(0, 3)}XXXXXXX</span>
//                       }
//                     </div>
//                   )}
//                   {/* Instagram / platform — hidden until accepted */}
//                   {modalCreator.platform && (
//                     <div className="mo-row">
//                       <span>🔗</span>
//                       {isAccepted
//                         ? <a href={modalCreator.platform} target="_blank" rel="noreferrer"
//                             style={{ color: "#4f46e5", textDecoration: "none", wordBreak: "break-all" }}>
//                             {modalCreator.platform}
//                           </a>
//                         : <span style={{filter:"blur(6px)",userSelect:"none",fontSize:"13px",color:"#4f46e5"}}>instagram.com/hidden</span>
//                       }
//                     </div>
//                   )}
//                   {modalCreator.createdAt && (
//                     <div className="mo-row">
//                       <span>📅</span>
//                       <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
//                     </div>
//                   )}
//                 </div>

//                 {/* Lock banner — only if not accepted */}
//                 {!isAccepted && (
//                   <div className="mo-lock-banner">
//                     <div className="mo-lock-title">🔒 Connect to unlock full profile</div>
//                     <div className="mo-lock-sub">
//                       Full name, follower count & Instagram link will be visible once the creator accepts your request.
//                     </div>
//                   </div>
//                 )}

//                 {/* Action buttons */}
//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button
//                         className="mo-btn mo-chat"
//                         onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}
//                       >
//                         💬 Open Chat
//                       </button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn mo-pending-btn" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button
//                         className="mo-btn mo-connect"
//                         disabled={isConn}
//                         onClick={() => handleConnect(id)}
//                       >
//                         {isConn ? "Sending..." : "🤝 Send Connect Request"}
//                       </button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   )}
//                 </div>

//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Connect with creators for your brand campaigns</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All Niches</option>
//             {niches.map((n, i) => <option key={i} value={n}>{em[n] || "✨"} {cap(n)}</option>)}
//           </select>
//           <select className={`bsel ${filterCity ? "active" : ""}`} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
//             <option value="">🏙 All Cities</option>
//             {cities.map((c, i) => <option key={i} value={c}>{cap(c)}</option>)}
//           </select>
//           {(filterNiche || filterCity) && (
//             <button className="bclr" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>
//           )}
//           {!loading && <span className="bcnt"><span>{filtered.length}</span> creators found</span>}
//         </div>

//         {loading ? (
//           <div className="bload"><div className="bspin" /></div>
//         ) : filtered.length === 0 ? (
//           <div className="bempty">
//             <div className="bempty-ico">👥</div>
//             <h3 className="bempty-title">{creators.length === 0 ? "No creators yet" : "No matches"}</h3>
//             <p className="bempty-sub">
//               {creators.length === 0
//                 ? "Creators will appear here once they register."
//                 : "Try clearing filters to see all creators"}
//             </p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map((creator) => {
//               const id = creator._id;
//               const status = connectStatus[id] || "none";
//               const isConn = connecting === id;
//               const img = gImg(creator);
//               const name = gName(creator);
//               const isAccepted = status === "accepted";
//               const isPending  = status === "pending";

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {/* Status badge */}
//                   {isAccepted && <div className="cc-badge cc-badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge cc-badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {img
//                       ? <img src={img} alt={name} className="cc-av" />
//                       : <div className="cc-avph">{name.charAt(0).toUpperCase()}</div>
//                     }
//                     <div className="cc-name">
//                       {isAccepted ? name : (
//                         <>
//                           {blurNameHalf(name).visible}
//                           <span style={{filter:"blur(5px)",userSelect:"none"}}>{blurNameHalf(name).blurred}</span>
//                         </>
//                       )}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{em[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     {!isAccepted && <div className="cc-lock">🔒 Connect to unlock full profile</div>}
//                   </div>

//                   <div className="cc-body">
//                     <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>

//                     <div className="cc-stats">
//                       {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
//                       {gCity(creator) && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
//                       {gCats(creator)[0] && <span className="cc-stat">{em[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
//                     </div>

//                     <div className="cc-acts" onClick={e => e.stopPropagation()}>
//                       {isAccepted ? (
//                         <>
//                           <button className="cbtn-profile" onClick={() => setModalCreator(creator)}>
//                             👤 View Profile
//                           </button>
//                           <button
//                             className="cbtn-chat"
//                             onClick={() => router.push(`/messages?with=${id}`)}
//                             title="Open Chat"
//                           >
//                             💬
//                           </button>
//                           <a href="/invite" className="cbtn-invite" title="Invite to Campaign">📨</a>
//                           <a href="/contact" className="cbtn-unlock" title="Unlock Contact">🔓</a>
//                         </>
//                       ) : isPending ? (
//                         <button className="cbtn-pending" disabled>
//                           ⏳ Request Sent — Awaiting Acceptance
//                         </button>
//                       ) : (
//                         <button
//                           className="cbtn-connect"
//                           onClick={() => setModalCreator(creator)}
//                           disabled={isConn}
//                         >
//                           {isConn ? "Sending..." : "🤝 Connect"}
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



