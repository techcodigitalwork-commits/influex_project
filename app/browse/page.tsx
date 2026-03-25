"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const API = "https://api.collabzy.in/api";

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
  user?: string;
}

type ConnectStatus = "none" | "pending" | "accepted";

const splitName = (name: string) => {
  if (!name) return { first: "", last: "" };
  const parts = name.trim().split(" ");
  return parts.length === 1
    ? { first: parts[0], last: "" }
    : { first: parts[0], last: parts.slice(1).join(" ") };
};
const maskEmail = (firstName: string) => {
  if (!firstName) return "**********@***.com";
  return `${firstName.toLowerCase().slice(0, 2)}**********@***.com`;
};
const maskInstagram = (url: string) => {
  if (!url) return "instagram.com/****";
  try {
    const handle = new URL(url).pathname.split("/").filter(Boolean)[0] || "user";
    return `instagram.com/${handle.slice(0, 2)}${"*".repeat(Math.max(4, handle.length - 2))}`;
  } catch { return "instagram.com/****"; }
};
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const EMOJI: Record<string, string> = {
  fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
  tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
  education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
};

export default function BrowsePage() {
  const router = useRouter();

  const [creators, setCreators]           = useState<Creator[]>([]);
  const creatorsRef                       = useRef<Creator[]>([]);
  const [loading, setLoading]             = useState(true);
  const [token, setToken]                 = useState("");
  const [myId, setMyId]                   = useState("");
  const myIdRef                           = useRef<string>("");
  const campaignIdRef                     = useRef<string>("");
  const [connecting, setConnecting]       = useState<string | null>(null);
  const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
  const [filterNiche, setFilterNiche]     = useState("");
  const [filterCity, setFilterCity]       = useState("");
  const [niches, setNiches]               = useState<string[]>([]);
  const [cities, setCities]               = useState<string[]>([]);
  const [modalCreator, setModalCreator]   = useState<Creator | null>(null);
  const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
  const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
  const [unlocking, setUnlocking]         = useState<string | null>(null);
  // 🔥 No-campaign modal state
  const [showNoCampaignModal, setShowNoCampaignModal] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const parsed = JSON.parse(raw);
    if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
    const t: string = parsed.token || localStorage.getItem("token") || "";
    if (!t) { router.push("/login"); return; }
    setToken(t);
    const uid: string = parsed.id || parsed._id || parsed.user?._id || parsed.user?.id || "";
    setMyId(uid);
    myIdRef.current = uid;
    setConnectStatus(JSON.parse(localStorage.getItem(`connectStatus_${uid}`) || "{}"));
    setUnlockedEmails(JSON.parse(localStorage.getItem(`unlockedEmails_${uid}`) || "{}"));
    setUnlockedInstagrams(JSON.parse(localStorage.getItem(`unlockedIg_${uid}`) || "{}"));
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchCampaignId();
    fetchCreators();
    const iv = setInterval(pollAcceptedInvites, 10000);
    return () => clearInterval(iv);
  }, [token]);

  const fetchCampaignId = async () => {
    try {
      const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      if (text.startsWith("<!") || !res.ok) return;
      const data = JSON.parse(text);
      const camps: any[] = data.data || data.campaigns || [];
      if (camps[0]?._id) campaignIdRef.current = camps[0]._id;
    } catch (e) { console.error("fetchCampaignId:", e); }
  };

  const fetchCreators = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
      const list: Creator[] = (JSON.parse(text).data || []).map(({ phone, ...rest }: any) => rest);
      setCreators(list);
      creatorsRef.current = list;
      const ns = new Set<string>(), cs = new Set<string>();
      list.forEach(c => {
        const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
        arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
        const ct = (c.city || c.location || "").trim();
        if (ct) cs.add(ct.toLowerCase().trim());
      });
      setNiches([...ns].filter(Boolean));
      setCities([...cs].filter(Boolean));
    } catch (e) {
      console.error("fetchCreators:", e);
    } finally {
      setLoading(false);
    }
  };

  const saveStatus = (status: Record<string, ConnectStatus>) => {
    const sid = myIdRef.current || myId;
    localStorage.setItem(`connectStatus_${sid}`, JSON.stringify(status));
    setConnectStatus({ ...status });
  };

  const pollAcceptedInvites = async () => {
    try {
      const res  = await fetch(`${API}/notification`, { headers: { Authorization: `Bearer ${token}` } });
      const text = await res.text();
      if (text.startsWith("<!") || !res.ok) return;
      const notifs: any[] = JSON.parse(text).data || JSON.parse(text).notifications || [];
      const responses = notifs.filter((n: any) => n.type === "invite_response");
      if (!responses.length) return;
      const saved: Record<string, ConnectStatus> = JSON.parse(localStorage.getItem(`connectStatus_${myId}`) || "{}");
      let changed = false;
      const currentCreators = creatorsRef.current;
      responses.forEach((n: any) => {
        const influencerUserId: string = n.data?.influencerId || (typeof n.sender === "string" ? n.sender : n.sender?._id) || "";
        if (!influencerUserId) return;
        const isAccepted = n.message?.toLowerCase().includes("accepted");
        const newStatus: ConnectStatus = isAccepted ? "accepted" : "pending";
        const matchedCreator = currentCreators.find(c => {
          const u = (c as any).user;
          const uid = typeof u === "object" ? (u?._id || u?.id || "") : (u || "");
          return uid === influencerUserId;
        });
        const profileId = matchedCreator?._id;
        if (!profileId) return;
        if (saved[profileId] !== newStatus) { saved[profileId] = newStatus; changed = true; }
      });
      if (changed) saveStatus(saved);
    } catch { /* silent */ }
  };

  const handleConnect = async (profileId: string) => {
    const status = connectStatus[profileId] || "none";
    if (status === "pending" || status === "accepted") return;

    const creator = creators.find(c => c._id === profileId);
    if (!creator) return;

    const rawUser = (creator as any).user;
    const creatorUserId: string =
      typeof rawUser === "string" ? rawUser :
      typeof rawUser === "object" && rawUser?._id ? rawUser._id :
      profileId;

    if (!campaignIdRef.current) await fetchCampaignId();

    // 🔥 No campaign? Show modal instead of alert
    if (!campaignIdRef.current) {
      setShowNoCampaignModal(true);
      return;
    }

    setConnecting(profileId);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const res  = await fetch(`${API}/invite/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ influencerId: creatorUserId, campaignId: campaignIdRef.current }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const text = await res.text();
        const data = text.startsWith("{") ? JSON.parse(text) : {};
        if (!res.ok) { alert(data.message || "Failed to send invite."); return; }
      } catch (inviteErr: any) {
        clearTimeout(timeout);
        if (inviteErr?.name === "AbortError") { alert("Request timed out. Please try again."); }
        else { alert("Failed to send invite. Please try again."); }
        return;
      }
      saveStatus({ ...connectStatus, [profileId]: "pending" });
      setModalCreator(null);
    } catch (e) {
      console.error("handleConnect:", e);
      alert("Something went wrong. Please try again.");
    } finally {
      setConnecting(null);
    }
  };

  const doUnlock = async (profileId: string, userId: string) => {
    const res  = await fetch(`${API}/contact/unlock`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ influencerId: userId }),
    });
    const text = await res.text();
    const data = text.startsWith("{") ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(data.message || "Not enough tokens or unlock failed.");
    return data;
  };

  const handleUnlockEmail = async (profileId: string, userId: string) => {
    if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
    setUnlocking(`email_${profileId}`);
    try {
      const data = await doUnlock(profileId, userId);
      const email: string = data.email || "";
      const ig: string    = data.platform || data.instagram || "";
      if (email) {
        const ue = { ...unlockedEmails, [profileId]: email };
        setUnlockedEmails(ue);
        const freshUid = myIdRef.current || myId;
        localStorage.setItem(`unlockedEmails_${freshUid}`, JSON.stringify(ue));
      }
      if (ig) {
        const ui = { ...unlockedInstagrams, [profileId]: ig };
        setUnlockedInstagrams(ui);
        const freshUid = myIdRef.current || myId;
        localStorage.setItem(`unlockedIg_${freshUid}`, JSON.stringify(ui));
      }
      if (!email && !ig) { alert("Contact info not available for this creator."); return; }
      deductBitsLocally(50);
    } catch (e: any) { alert(e.message || "Something went wrong."); }
    finally { setUnlocking(null); }
  };

  const handleUnlockInstagram = async (profileId: string, userId: string) => {
    if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
    setUnlocking(`ig_${profileId}`);
    try {
      const data = await doUnlock(profileId, userId);
      const ig: string    = data.platform || data.instagram || "";
      const email: string = data.email || "";
      if (ig) {
        const ui = { ...unlockedInstagrams, [profileId]: ig };
        setUnlockedInstagrams(ui);
        const freshUid3 = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
        localStorage.setItem(`unlockedIg_${freshUid3}`, JSON.stringify(ui));
      }
      if (email && !unlockedEmails[profileId]) {
        const ue = { ...unlockedEmails, [profileId]: email };
        setUnlockedEmails(ue);
        const freshUid4 = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
        localStorage.setItem(`unlockedEmails_${freshUid4}`, JSON.stringify(ue));
      }
      if (!ig) { alert("Instagram not available for this creator."); return; }
      deductBitsLocally(50);
    } catch (e: any) { alert(e.message || "Something went wrong."); }
    finally { setUnlocking(null); }
  };

  const deductBitsLocally = (amount: number) => {
    const stored = localStorage.getItem("cb_user");
    if (!stored) return;
    const parsed = JSON.parse(stored);
    const newBits = Math.max(0, (parsed.bits ?? 0) - amount);
    localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: newBits }));
    window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(newBits) }));
  };

  const gName      = (c: Creator) => c.name || "Creator";
  const gBio       = (c: Creator) => c.bio  || "";
  const gImg       = (c: Creator) => c.profileImage || null;
  const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
  const gCity      = (c: Creator) => c.city || c.location || "";
  const FOLLOWER_LABELS: Record<string, string> = {
    "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
    "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
  };
  const gFollowers = (c: Creator) => {
    const f = c.followers;
    if (!f || f === "0" || f === 0) return "";
    const key = String(f);
    if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
    const n = Number(f);
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  const filtered = creators.filter(c => {
    const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
    const nm  = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
    const cm  = filterCity  ? (c.city || c.location || "").toLowerCase() === filterCity : true;
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
        .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
        .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
        .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
        .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
        .cc-body{padding:16px 20px 20px}
        .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
        .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
        .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
        .cc-acts{display:flex;gap:8px}

        .cbtn{border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none}
        .cbtn-connect{flex:1;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
        .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
        .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .cbtn-pending{flex:1;padding:11px;border:1.5px solid #fde68a!important;background:#fffbeb;color:#d97706;cursor:default}
        .cbtn-profile{flex:1;padding:11px;border:1.5px solid #ddd6fe!important;background:#f5f3ff;color:#7c3aed}
        .cbtn-profile:hover{background:#ede9fe}
        .cbtn-chat{width:42px;height:42px;border:1.5px solid #c7d2fe!important;background:#eef2ff;color:#4f46e5;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
        .cbtn-unlock{width:42px;height:42px;border:1.5px solid #bbf7d0!important;background:#f0fdf4;color:#16a34a;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
        .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

        .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
        .badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
        .badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

        .bload{display:flex;align-items:center;justify-content:center;padding:80px}
        .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
        .bempty-ico{font-size:48px;margin-bottom:16px}
        .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
        .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

        /* ── Creator Modal ── */
        .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;animation:mfi 0.2s ease}
        @keyframes mfi{from{opacity:0}to{opacity:1}}
        .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:92vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
        @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        @media(max-width:520px){
          .mo{padding:0;align-items:flex-end}
          .mo-box{border-radius:24px 24px 0 0;max-height:93vh;width:100%;max-width:100%}
          .mo-stats{grid-template-columns:repeat(3,1fr)!important;gap:6px!important}
          .mo-sval{font-size:14px!important}
          .mo-slbl{font-size:9px!important}
          .mo-body{padding:0 14px 28px!important}
          .mo-acts{flex-direction:column}
          .mo-btn{width:100%}
          .mo-row{font-size:12px}
          .mo-masked{font-size:11px}
          .mo-bio{font-size:13px}
        }
        .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
        .mo-banner-top{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0;flex-shrink:0}
        .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
        .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
        .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
        .mo-body{padding:0 24px 28px;text-align:center}
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
        .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
        .mo-unlock-row:hover{background:#f5f3ff}
        .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
        .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
        .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
        .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
        .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
        .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
        .mo-unlocked-ig:hover{text-decoration:underline}
        .mo-info-banner{border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center;background:#f0fdf4;border:1.5px solid #bbf7d0}
        .mo-info-banner.connected{background:#eef2ff;border-color:#c7d2fe}
        .mo-info-title{font-size:13px;font-weight:700;margin-bottom:2px}
        .mo-info-sub{font-size:11px;color:#6b7280;line-height:1.5}
        .mo-acts{display:flex;gap:10px}
        .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
        .mo-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
        .mo-btn.primary:hover:not(:disabled){transform:translateY(-1px)}
        .mo-btn.primary:disabled{opacity:0.6;cursor:not-allowed}
        .mo-btn.yellow{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}
        .mo-btn.gray{background:#f4f4f4;color:#666}
        .mo-btn.gray:hover{background:#eee}

        /* ── No Campaign Modal ── */
        .nc-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
        .nc-box{background:#fff;border-radius:24px;max-width:380px;width:100%;padding:36px 28px;text-align:center;animation:msu 0.25s ease;position:relative}
        .nc-close{position:absolute;top:14px;right:16px;background:#f4f4f4;border:none;width:30px;height:30px;border-radius:50%;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;color:#666}
        .nc-icon{font-size:52px;margin-bottom:18px;display:block}
        .nc-title{font-size:20px;font-weight:800;color:#111;margin-bottom:10px}
        .nc-sub{font-size:14px;color:#666;line-height:1.7;margin-bottom:8px}
        .nc-steps{background:#f8fafc;border-radius:14px;padding:16px;margin:16px 0 24px;text-align:left}
        .nc-step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:#374151;line-height:1.5}
        .nc-step:last-child{margin-bottom:0}
        .nc-step-num{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
        .nc-btn-primary{width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;cursor:pointer;margin-bottom:10px;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 4px 16px rgba(79,70,229,0.3);transition:all 0.2s}
        .nc-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,0.4)}
        .nc-btn-secondary{width:100%;padding:12px;border-radius:12px;background:#f4f4f4;color:#666;font-size:14px;font-weight:600;border:none;cursor:pointer;font-family:'Plus Jakarta Sans',sans-serif;transition:background 0.2s}
        .nc-btn-secondary:hover{background:#eee}
      `}</style>

      {/* ══ NO CAMPAIGN MODAL ══════════════════════════════════════ */}
      {showNoCampaignModal && (
        <div className="nc-overlay" onClick={() => setShowNoCampaignModal(false)}>
          <div className="nc-box" onClick={e => e.stopPropagation()}>
            <button className="nc-close" onClick={() => setShowNoCampaignModal(false)}>✕</button>
            <span className="nc-icon">🚀</span>
            <h2 className="nc-title">Create a Campaign First</h2>
            <p className="nc-sub">To send a free invite to a creator, you need an active campaign.</p>
            <div className="nc-steps">
              <div className="nc-step">
                <span className="nc-step-num">1</span>
                <span>Go to <strong>Campaigns</strong> and create your first campaign — it only takes 2 minutes.</span>
              </div>
              <div className="nc-step">
                <span className="nc-step-num">2</span>
                <span>Come back here and <strong>invite creators for free</strong> to apply to your campaign.</span>
              </div>
              <div className="nc-step">
                <span className="nc-step-num">3</span>
                <span>Once a creator accepts, <strong>chat opens automatically</strong> — no extra steps needed.</span>
              </div>
            </div>
            <button className="nc-btn-primary" onClick={() => { setShowNoCampaignModal(false); router.push("/campaigns/post"); }}>
              ➕ Create a Campaign Now
            </button>
            <button className="nc-btn-secondary" onClick={() => setShowNoCampaignModal(false)}>
              Maybe Later
            </button>
          </div>
        </div>
      )}

      {/* ══ CREATOR MODAL ══════════════════════════════════════════ */}
      {modalCreator && (() => {
        const id             = modalCreator._id;
        const status         = connectStatus[id] || "none";
        const isAccepted     = status === "accepted";
        const isPending      = status === "pending";
        const isConn         = connecting === id;
        const creatorUserId  = modalCreator.user || id;
        const emailUnlocked  = unlockedEmails[id];
        const igUnlocked     = unlockedInstagrams[id];
        const isUnlockEmail  = unlocking === `email_${id}`;
        const isUnlockIg     = unlocking === `ig_${id}`;
        const { first, last } = splitName(gName(modalCreator));

        return (
          <div className="mo" onClick={() => setModalCreator(null)}>
            <div className="mo-box" onClick={e => e.stopPropagation()}>
              <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
              <div className="mo-banner-top" />

              <div className="mo-avwrap">
                {gImg(modalCreator)
                  ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
                  : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>}
              </div>

              <div className="mo-body">
                <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
                  {first}
                  {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
                </div>

                <div className="mo-tags">
                  {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{EMOJI[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
                  {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
                </div>

                {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

                <div className="mo-stats">
                  <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
                  <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
                  <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
                </div>

                <div className="mo-info">
                  {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
                  {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

                  {emailUnlocked ? (
                    <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
                  ) : (
                    <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
                      <span>📧</span>
                      <span className="mo-masked">{maskEmail(first)}</span>
                      <div className="mo-unlock-action">
                        <span className="mo-unlock-lbl">{isUnlockEmail ? "⏳" : "🔓 Unlock"}</span>
                        {!isUnlockEmail && <span className="mo-unlock-cost">50 tokens</span>}
                      </div>
                    </div>
                  )}

                  {modalCreator.platform && (
                    igUnlocked ? (
                      <div className="mo-row"><span>📸</span><a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a></div>
                    ) : (
                      <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
                        <span>📸</span>
                        <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
                        <div className="mo-unlock-action">
                          <span className="mo-unlock-lbl">{isUnlockIg ? "⏳" : "🔓 Unlock"}</span>
                          {!isUnlockIg && <span className="mo-unlock-cost">50 tokens</span>}
                        </div>
                      </div>
                    )
                  )}

                  {modalCreator.createdAt && (
                    <div className="mo-row">
                      <span>📅</span>
                      <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
                    </div>
                  )}
                </div>

                {isAccepted ? (
                  <div className="mo-info-banner connected">
                    <div className="mo-info-title" style={{ color: "#4f46e5" }}>✅ You're Connected!</div>
                    <div className="mo-info-sub">Chat is open. Unlock email & Instagram for 50 tokens each.</div>
                  </div>
                ) : (
                  <div className="mo-info-banner">
                    <div className="mo-info-title" style={{ color: "#16a34a" }}>🤝 Connect is completely free!</div>
                    <div className="mo-info-sub">Send an invite. Once accepted, chat opens automatically. Unlock contacts for 50 tokens each.</div>
                  </div>
                )}

                <div className="mo-acts">
                  {isAccepted ? (
                    <>
                      <button className="mo-btn primary" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
                      <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  ) : isPending ? (
                    <>
                      <button className="mo-btn yellow" disabled>⏳ Request Sent</button>
                      <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  ) : (
                    <>
                      <button className="mo-btn primary" disabled={isConn} onClick={() => handleConnect(id)}>
                        {isConn ? "Sending..." : "🤝 Invite — Free"}
                      </button>
                      <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ PAGE ═══════════════════════════════════════════════════ */}
      <div className="browse">
        <div className="browse-header">
          <h1 className="browse-title">Browse Creators</h1>
          <p className="browse-sub">Connect with creators for your brand campaigns</p>
        </div>

        <div className="browse-filters">
          <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
            <option value="">🎯 All Niches</option>
            {niches.map((n, i) => <option key={i} value={n}>{EMOJI[n] || "✨"} {cap(n)}</option>)}
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
            <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators."}</p>
          </div>
        ) : (
          <div className="bgrid">
            {filtered.map(creator => {
              const id            = creator._id;
              const status        = connectStatus[id] || "none";
              const isConn        = connecting === id;
              const isAccepted    = status === "accepted";
              const isPending     = status === "pending";
              const creatorUserId = creator.user || id;
              const emailUnlocked = unlockedEmails[id];
              const isUnlockEmail = unlocking === `email_${id}`;
              const { first, last } = splitName(gName(creator));

              return (
                <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
                  {isAccepted && <div className="cc-badge badge-ok">✓ Connected</div>}
                  {isPending  && <div className="cc-badge badge-pend">⏳ Pending</div>}

                  <div className="cc-top">
                    {gImg(creator)
                      ? <img src={gImg(creator)!} alt={first} className="cc-av" />
                      : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>}
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
                      {first}
                      {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
                    </div>
                    {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
                    {gCats(creator).length > 0 && (
                      <div className="cc-cats">
                        {gCats(creator).slice(0, 3).map((c, idx) => (
                          <span key={idx} className="cc-cat">{EMOJI[c.toLowerCase()] || "✨"} {cap(c)}</span>
                        ))}
                      </div>
                    )}
                    <div className="cc-lock">🔒 Last name & contacts hidden</div>
                  </div>

                  <div className="cc-body">
                    <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>
                    <div className="cc-stats">
                      {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
                      {gCity(creator)       && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
                      {gCats(creator)[0]    && <span className="cc-stat">{EMOJI[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
                    </div>

                    <div className="cc-acts" onClick={e => e.stopPropagation()}>
                      {isAccepted ? (
                        <>
                          <button className="cbtn cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
                          <button className="cbtn cbtn-chat" title="Open Chat" onClick={() => router.push(`/messages?with=${id}`)}>💬</button>
                          {emailUnlocked
                            ? <button className="cbtn cbtn-unlock" disabled title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }}>📧</button>
                            : <button className="cbtn cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
                                {isUnlockEmail ? "⏳" : "🔓"}
                              </button>
                          }
                        </>
                      ) : isPending ? (
                        <button className="cbtn cbtn-pending" disabled>⏳ Awaiting Acceptance</button>
                      ) : (
                        <button className="cbtn cbtn-connect" disabled={isConn} onClick={() => setModalCreator(creator)}>
                          {isConn ? "Sending..." : "🤝 Connect — Free"}
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

// import { useEffect, useState, useRef } from "react";
// import { useRouter } from "next/navigation";

// // ── API Routes used ──────────────────────────────────────────────
// // GET  /api/profile/influencers              → fetch all creators
// // GET  /api/campaigns/my                     → get brand's campaignId (needed for invite)
// // POST /api/invite/send  { influencerId, campaignId }  → send invite
// // POST /api/contact/unlock { influencerId, type }      → unlock email / instagram
// const API = "https://api.collabzy.in/api";

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
//   user?: string;
// }

// type ConnectStatus = "none" | "pending" | "accepted";

// // ── Pure helpers ─────────────────────────────────────────────────
// const splitName = (name: string) => {
//   if (!name) return { first: "", last: "" };
//   const parts = name.trim().split(" ");
//   return parts.length === 1
//     ? { first: parts[0], last: "" }
//     : { first: parts[0], last: parts.slice(1).join(" ") };
// };
// const maskEmail = (firstName: string) => {
//   if (!firstName) return "**********@***.com";
//   return `${firstName.toLowerCase().slice(0, 2)}**********@***.com`;
// };
// const maskInstagram = (url: string) => {
//   if (!url) return "instagram.com/****";
//   try {
//     const handle = new URL(url).pathname.split("/").filter(Boolean)[0] || "user";
//     return `instagram.com/${handle.slice(0, 2)}${"*".repeat(Math.max(4, handle.length - 2))}`;
//   } catch { return "instagram.com/****"; }
// };
// const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
// const EMOJI: Record<string, string> = {
//   fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
//   tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
//   education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
// };

// // ─────────────────────────────────────────────────────────────────
// export default function BrowsePage() {
//   const router = useRouter();

//   const [creators, setCreators]           = useState<Creator[]>([]);
//   const creatorsRef                       = useRef<Creator[]>([]); // always latest creators
//   const [loading, setLoading]             = useState(true);
//   const [token, setToken]                 = useState("");
//   // const [myId, setMyId]                   = useState("");
//   const [myId, setMyId]                   = useState("");
// const myIdRef                           = useRef<string>("");
//   const campaignIdRef                     = useRef<string>(""); // cached campaignId
//   const [connecting, setConnecting]       = useState<string | null>(null);
//   const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
//   const [filterNiche, setFilterNiche]     = useState("");
//   const [filterCity, setFilterCity]       = useState("");
//   const [niches, setNiches]               = useState<string[]>([]);
//   const [cities, setCities]               = useState<string[]>([]);
//   const [modalCreator, setModalCreator]   = useState<Creator | null>(null);
//   const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
//   const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking]         = useState<string | null>(null);

//   // ── Init ─────────────────────────────────────────────────────
//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     // const uid: string = parsed.user?._id || parsed._id || parsed.id || "";
//     const uid: string = parsed.id || parsed._id || parsed.user?._id || parsed.user?.id || "";
//     // setMyId(uid);
//     setMyId(uid);
// myIdRef.current = uid; 
//     // Restore persisted connect status
//     setConnectStatus(JSON.parse(localStorage.getItem(`connectStatus_${uid}`) || "{}"));
//     // Restore unlocked contacts
//     setUnlockedEmails(JSON.parse(localStorage.getItem(`unlockedEmails_${uid}`) || "{}"));
//     setUnlockedInstagrams(JSON.parse(localStorage.getItem(`unlockedIg_${uid}`) || "{}"));
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchCampaignId();
//     fetchCreators();
//     // Poll every 10s — check invite_response notifications to update accepted status
//     const iv = setInterval(pollAcceptedInvites, 10000);
//     return () => clearInterval(iv);
//   }, [token]);

//   // ── GET /api/campaigns/my → cache first campaignId ───────────
//   const fetchCampaignId = async () => {
//     try {
//       const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const data = JSON.parse(text);
//       const camps: any[] = data.data || data.campaigns || [];
//       if (camps[0]?._id) campaignIdRef.current = camps[0]._id;
//     } catch (e) { console.error("fetchCampaignId:", e); }
//   };

//   // ── GET /api/profile/influencers ─────────────────────────────
//   const fetchCreators = async () => {
//     setLoading(true);
//     try {
//       const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const list: Creator[] = (JSON.parse(text).data || []).map(({ phone, ...rest }: any) => rest);
//       setCreators(list);
//       creatorsRef.current = list; // keep ref in sync

//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach(c => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//     } catch (e) {
//       console.error("fetchCreators:", e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Persist connect status ────────────────────────────────────
//   const saveStatus = (status: Record<string, ConnectStatus>) => {
//     // localStorage.setItem(`connectStatus_${myId}`, JSON.stringify(status));
//     const sid = myIdRef.current || myId;
// localStorage.setItem(`connectStatus_${sid}`, JSON.stringify(status));
//     setConnectStatus({ ...status });
//   };

//   // ── Poll GET /api/notification for invite_response ───────────
//   const pollAcceptedInvites = async () => {
//     try {
//       const res  = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const notifs: any[] = JSON.parse(text).data || JSON.parse(text).notifications || [];

//       const responses = notifs.filter((n: any) => n.type === "invite_response");
//       if (!responses.length) return;

//       const saved: Record<string, ConnectStatus> = JSON.parse(
//         localStorage.getItem(`connectStatus_${myId}`) || "{}"
//       );
//       let changed = false;

//       // Get latest creators from state — use ref to avoid stale closure
//       const currentCreators = creatorsRef.current;

//       responses.forEach((n: any) => {
//         const influencerUserId: string =
//           n.data?.influencerId ||
//           (typeof n.sender === "string" ? n.sender : n.sender?._id) || "";
//         if (!influencerUserId) return;

//         const isAccepted = n.message?.toLowerCase().includes("accepted");
//         const newStatus: ConnectStatus = isAccepted ? "accepted" : "pending";

//         // Match by user._id or user string
//         const matchedCreator = currentCreators.find(c => {
//           const u = (c as any).user;
//           const uid = typeof u === "object" ? (u?._id || u?.id || "") : (u || "");
//           return uid === influencerUserId;
//         });

//         const profileId = matchedCreator?._id;
//         if (!profileId) return;

//         if (saved[profileId] !== newStatus) {
//           saved[profileId] = newStatus;
//           changed = true;
//         }
//       });

//       if (changed) saveStatus(saved);
//     } catch { /* silent */ }
//   };

//   // ── POST /api/invite/send  { influencerId, campaignId } ───────
//   const handleConnect = async (profileId: string) => {
//     const status = connectStatus[profileId] || "none";
//     if (status === "pending" || status === "accepted") return;

//     const creator = creators.find(c => c._id === profileId);
//     if (!creator) return;

//     // creator.user = actual User._id linked to this profile
//     // If not present, fall back to profileId (might still work if backend handles both)
//     const rawUser = (creator as any).user;
//     const creatorUserId: string =
//       typeof rawUser === "string" ? rawUser :
//       typeof rawUser === "object" && rawUser?._id ? rawUser._id :
//       profileId;
//     console.log("[Connect] profileId:", profileId, "| creatorUserId:", creatorUserId, "| creator.user:", (creator as any).user);

//     if (!campaignIdRef.current) await fetchCampaignId();
//     if (!campaignIdRef.current) {
//       alert("No campaign found. Please create a campaign first.");
//       return;
//     }

//     setConnecting(profileId);
//     try {
//       // 1️⃣ Send invite — with timeout so it never hangs forever
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 10000);
//       let inviteOk = false;
//       try {
//         const res  = await fetch(`${API}/invite/send`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             influencerId: creatorUserId,
//             campaignId: campaignIdRef.current,
//           }),
//           signal: controller.signal,
//         });
//         clearTimeout(timeout);
//         const text = await res.text();
//         const data = text.startsWith("{") ? JSON.parse(text) : {};
//         if (!res.ok) {
//           alert(data.message || "Failed to send invite.");
//           return;
//         }
//         inviteOk = true;
//       } catch (inviteErr: any) {
//         clearTimeout(timeout);
//         if (inviteErr?.name === "AbortError") {
//           alert("Request timed out. Please try again.");
//         } else {
//           alert("Failed to send invite. Please try again.");
//         }
//         return;
//       }

//       // 2️⃣ Notification — backend sendInvite already creates it, no need here

//       // 3️⃣ Mark pending locally + close modal
//       saveStatus({ ...connectStatus, [profileId]: "pending" });
//       setModalCreator(null);
//     } catch (e) {
//       console.error("handleConnect:", e);
//       alert("Something went wrong. Please try again.");
//     } finally {
//       setConnecting(null);
//     }
//   };

//   // ── POST /api/contact/unlock { influencerId } ───────────────
//   // Backend returns { email, platform } together — no "type" field needed
//   // Each call deducts 50 bits, so we store both in one shot
//   const doUnlock = async (profileId: string, userId: string) => {
//     const res  = await fetch(`${API}/contact/unlock`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//       body: JSON.stringify({ influencerId: userId }),
//     });
//     const text = await res.text();
//     const data = text.startsWith("{") ? JSON.parse(text) : {};
//     if (!res.ok) throw new Error(data.message || "Not enough tokens or unlock failed.");
//     return data; // { email, platform }
//   };

//   const handleUnlockEmail = async (profileId: string, userId: string) => {
//     if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
//     setUnlocking(`email_${profileId}`);
//     try {
//       const data = await doUnlock(profileId, userId);
//       const email: string = data.email || "";
//       const ig: string    = data.platform || data.instagram || "";
//       if (email) {
//         const ue = { ...unlockedEmails, [profileId]: email };
//         setUnlockedEmails(ue);
//         // const freshUid = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
//         const freshUid = myIdRef.current || myId;
// localStorage.setItem(`unlockedEmails_${freshUid}`, JSON.stringify(ue));
//         // localStorage.setItem(`unlockedEmails_${myId}`, JSON.stringify(ue));
//       }
//       if (ig) {
//         const ui = { ...unlockedInstagrams, [profileId]: ig };
//         setUnlockedInstagrams(ui);
//         // const freshUid = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
//         const freshUid = myIdRef.current || myId;
// localStorage.setItem(`unlockedIg_${freshUid}`, JSON.stringify(ui));
//         // localStorage.setItem(`unlockedIg_${myId}`, JSON.stringify(ui));
//       }
//       if (!email && !ig) { alert("Contact info not available for this creator."); return; }
//       // ✅ Deduct 50 bits from localStorage + signal navbar to refresh
//       deductBitsLocally(50);
//     } catch (e: any) { alert(e.message || "Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   const handleUnlockInstagram = async (profileId: string, userId: string) => {
//     if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
//     setUnlocking(`ig_${profileId}`);
//     try {
//       const data = await doUnlock(profileId, userId);
//       const ig: string    = data.platform || data.instagram || "";
//       const email: string = data.email || "";
//       if (ig) {
//         const ui = { ...unlockedInstagrams, [profileId]: ig };
//         setUnlockedInstagrams(ui);
//         // localStorage.setItem(`unlockedIg_${myId}`, JSON.stringify(ui));
//         const freshUid3 = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
// localStorage.setItem(`unlockedIg_${freshUid3}`, JSON.stringify(ui));
//       }
//       if (email && !unlockedEmails[profileId]) {
//         const ue = { ...unlockedEmails, [profileId]: email };
//         setUnlockedEmails(ue);
//         // localStorage.setItem(`unlockedEmails_${myId}`, JSON.stringify(ue));
//         const freshUid4 = JSON.parse(localStorage.getItem("cb_user") || "{}").id || myId;
// localStorage.setItem(`unlockedEmails_${freshUid4}`, JSON.stringify(ue));
//       }
//       if (!ig) { alert("Instagram not available for this creator."); return; }
//       // ✅ Deduct 50 bits from localStorage + signal navbar to refresh
//       deductBitsLocally(50);
//     } catch (e: any) { alert(e.message || "Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Deduct bits locally + signal navbar ──────────────────────
//   const deductBitsLocally = (amount: number) => {
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const parsed = JSON.parse(stored);
//     const currentBits = parsed.bits ?? 0;
//     const newBits = Math.max(0, currentBits - amount);
//     const updated = { ...parsed, bits: newBits };
//     localStorage.setItem("cb_user", JSON.stringify(updated));
//     // Signal navbar to re-read bits
//     window.dispatchEvent(new StorageEvent("storage", { key: "cb_user_bits", newValue: String(newBits) }));
//   };

//   // ── Data helpers ──────────────────────────────────────────────
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio  || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
//   // const gFollowers = (c: Creator) => {
//   //   const f = c.followers;
//   //   if (!f || f === "0" || f === 0) return "";
//   //   const n = Number(f);
//   //   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
//   //   if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
//   //   return String(n);
//   // };
//   const FOLLOWER_LABELS: Record<string, string> = {
//   "1000":  "1K – 5K",
//   "5000":  "5K – 10K",
//   "10000": "10K – 20K",
//   "30000": "20K – 50K",
//   "50000": "50K – 75K",
//   "99000": "99K+",
// };
// const gFollowers = (c: Creator) => {
//   const f = c.followers;
//   if (!f || f === "0" || f === 0) return "";
//   const key = String(f);
//   if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//   const n = Number(f);
//   if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
//   if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
//   return String(n);
// };

//   const filtered = creators.filter(c => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm  = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
//     const cm  = filterCity  ? (c.city || c.location || "").toLowerCase() === filterCity : true;
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

//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}
//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
//         .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         .cc-acts{display:flex;gap:8px}

//         .cbtn{border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none}
//         .cbtn-connect{flex:1;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border:1.5px solid #fde68a!important;background:#fffbeb;color:#d97706;cursor:default}
//         .cbtn-profile{flex:1;padding:11px;border:1.5px solid #ddd6fe!important;background:#f5f3ff;color:#7c3aed}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border:1.5px solid #c7d2fe!important;background:#eef2ff;color:#4f46e5;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border:1.5px solid #bbf7d0!important;background:#f0fdf4;color:#16a34a;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* Modal */
//         .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
//         @keyframes mfi{from{opacity:0}to{opacity:1}}
//         .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
//         @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
//         .mo-banner-top{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0}
//         .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
//         .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-body{padding:0 24px 28px;text-align:center}
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
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f5f3ff}
//         .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
//         .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
//         .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
//         .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
//         .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
//         .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
//         .mo-unlocked-ig:hover{text-decoration:underline}
//         .mo-info-banner{border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center;background:#f0fdf4;border:1.5px solid #bbf7d0}
//         .mo-info-banner.connected{background:#eef2ff;border-color:#c7d2fe}
//         .mo-info-title{font-size:13px;font-weight:700;margin-bottom:2px}
//         .mo-info-sub{font-size:11px;color:#6b7280;line-height:1.5}
//         .mo-acts{display:flex;gap:10px}
//         .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .mo-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .mo-btn.primary:hover:not(:disabled){transform:translateY(-1px)}
//         .mo-btn.primary:disabled{opacity:0.6;cursor:not-allowed}
//         .mo-btn.yellow{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}
//         .mo-btn.gray{background:#f4f4f4;color:#666}
//         .mo-btn.gray:hover{background:#eee}
//       `}</style>

//       {/* ══ MODAL ══════════════════════════════════════════════════ */}
//       {modalCreator && (() => {
//         const id             = modalCreator._id;
//         const status         = connectStatus[id] || "none";
//         const isAccepted     = status === "accepted";
//         const isPending      = status === "pending";
//         const isConn         = connecting === id;
//         const creatorUserId  = modalCreator.user || id;
//         const emailUnlocked  = unlockedEmails[id];
//         const igUnlocked     = unlockedInstagrams[id];
//         const isUnlockEmail  = unlocking === `email_${id}`;
//         const isUnlockIg     = unlocking === `ig_${id}`;
//         const { first, last } = splitName(gName(modalCreator));

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner-top" />

//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
//                   : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>}
//               </div>

//               <div className="mo-body">
//                 <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
//                   {first}
//                   {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{EMOJI[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
//                   {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
//                 </div>

//                 {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

//                 <div className="mo-stats">
//                   <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
//                 </div>

//                 <div className="mo-info">
//                   {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
//                   {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

//                   {/* Email unlock */}
//                   {emailUnlocked ? (
//                     <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
//                   ) : (
//                     <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                       <span>📧</span>
//                       <span className="mo-masked">{maskEmail(first)}</span>
//                       <div className="mo-unlock-action">
//                         <span className="mo-unlock-lbl">{isUnlockEmail ? "⏳" : "🔓 Unlock"}</span>
//                         {!isUnlockEmail && <span className="mo-unlock-cost">50 tokens</span>}
//                       </div>
//                     </div>
//                   )}

//                   {/* Instagram unlock */}
//                   {modalCreator.platform && (
//                     igUnlocked ? (
//                       <div className="mo-row"><span>📸</span><a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a></div>
//                     ) : (
//                       <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
//                         <span>📸</span>
//                         <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
//                         <div className="mo-unlock-action">
//                           <span className="mo-unlock-lbl">{isUnlockIg ? "⏳" : "🔓 Unlock"}</span>
//                           {!isUnlockIg && <span className="mo-unlock-cost">50 tokens</span>}
//                         </div>
//                       </div>
//                     )
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row">
//                       <span>📅</span>
//                       <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
//                     </div>
//                   )}
//                 </div>

//                 {/* Info banner */}
//                 {isAccepted ? (
//                   <div className="mo-info-banner connected">
//                     <div className="mo-info-title" style={{ color: "#4f46e5" }}>✅ You're Connected!</div>
//                     <div className="mo-info-sub">Chat is open. Unlock email & Instagram for 50 tokens each.</div>
//                   </div>
//                 ) : (
//                   <div className="mo-info-banner">
//                     <div className="mo-info-title" style={{ color: "#16a34a" }}>🤝 Connect is completely free!</div>
//                     <div className="mo-info-sub">Send an invite. Once accepted, chat opens automatically. Unlock contacts for 50 tokens each.</div>
//                   </div>
//                 )}

//                 {/* CTA */}
//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button className="mo-btn primary" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn yellow" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button className="mo-btn primary" disabled={isConn} onClick={() => handleConnect(id)}>
//                         {isConn ? "Sending..." : "🤝 Invite — Free"}
//                       </button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       {/* ══ PAGE ═══════════════════════════════════════════════════ */}
//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Connect with creators for your brand campaigns</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All Niches</option>
//             {niches.map((n, i) => <option key={i} value={n}>{EMOJI[n] || "✨"} {cap(n)}</option>)}
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
//             <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators."}</p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map(creator => {
//               const id            = creator._id;
//               const status        = connectStatus[id] || "none";
//               const isConn        = connecting === id;
//               const isAccepted    = status === "accepted";
//               const isPending     = status === "pending";
//               const creatorUserId = creator.user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlockEmail = unlocking === `email_${id}`;
//               const { first, last } = splitName(gName(creator));

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {isAccepted && <div className="cc-badge badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {gImg(creator)
//                       ? <img src={gImg(creator)!} alt={first} className="cc-av" />
//                       : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>}
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
//                       {first}
//                       {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{EMOJI[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     <div className="cc-lock">🔒 Last name & contacts hidden</div>
//                   </div>

//                   <div className="cc-body">
//                     <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>
//                     <div className="cc-stats">
//                       {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
//                       {gCity(creator)       && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
//                       {gCats(creator)[0]    && <span className="cc-stat">{EMOJI[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
//                     </div>

//                     <div className="cc-acts" onClick={e => e.stopPropagation()}>
//                       {isAccepted ? (
//                         // ✅ Accepted: profile + chat + email unlock
//                         <>
//                           <button className="cbtn cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
//                           <button className="cbtn cbtn-chat" title="Open Chat" onClick={() => router.push(`/messages?with=${id}`)}>💬</button>
//                           {emailUnlocked
//                             ? <button className="cbtn cbtn-unlock" disabled title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }}>📧</button>
//                             : <button className="cbtn cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                                 {isUnlockEmail ? "⏳" : "🔓"}
//                               </button>
//                           }
//                         </>
//                       ) : isPending ? (
//                         // ⏳ Pending: no chat yet
//                         <button className="cbtn cbtn-pending" disabled>⏳ Awaiting Acceptance</button>
//                       ) : (
//                         // 🆕 None: open modal → connect
//                         <button className="cbtn cbtn-connect" disabled={isConn} onClick={() => setModalCreator(creator)}>
//                           {isConn ? "Sending..." : "🤝 Connect — Free"}
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


// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter } from "next/navigation";

// // ── API Routes used ──────────────────────────────────────────────
// // GET  /api/profile/influencers              → fetch all creators
// // GET  /api/campaigns/my                     → get brand's campaignId (needed for invite)
// // POST /api/invite/send  { influencerId, campaignId }  → send invite
// // POST /api/contact/unlock { influencerId, type }      → unlock email / instagram
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
//   user?: string;
// }

// type ConnectStatus = "none" | "pending" | "accepted";

// // ── Pure helpers ─────────────────────────────────────────────────
// const splitName = (name: string) => {
//   if (!name) return { first: "", last: "" };
//   const parts = name.trim().split(" ");
//   return parts.length === 1
//     ? { first: parts[0], last: "" }
//     : { first: parts[0], last: parts.slice(1).join(" ") };
// };
// const maskEmail = (firstName: string) => {
//   if (!firstName) return "**********@***.com";
//   return `${firstName.toLowerCase().slice(0, 2)}**********@***.com`;
// };
// const maskInstagram = (url: string) => {
//   if (!url) return "instagram.com/****";
//   try {
//     const handle = new URL(url).pathname.split("/").filter(Boolean)[0] || "user";
//     return `instagram.com/${handle.slice(0, 2)}${"*".repeat(Math.max(4, handle.length - 2))}`;
//   } catch { return "instagram.com/****"; }
// };
// const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
// const EMOJI: Record<string, string> = {
//   fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
//   tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
//   education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
// };

// // ─────────────────────────────────────────────────────────────────
// export default function BrowsePage() {
//   const router = useRouter();

//   const [creators, setCreators]           = useState<Creator[]>([]);
//   const creatorsRef                       = useRef<Creator[]>([]); // always latest creators
//   const [loading, setLoading]             = useState(true);
//   const [token, setToken]                 = useState("");
//   const [myId, setMyId]                   = useState("");
//   const campaignIdRef                     = useRef<string>(""); // cached campaignId
//   const [connecting, setConnecting]       = useState<string | null>(null);
//   const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
//   const [filterNiche, setFilterNiche]     = useState("");
//   const [filterCity, setFilterCity]       = useState("");
//   const [niches, setNiches]               = useState<string[]>([]);
//   const [cities, setCities]               = useState<string[]>([]);
//   const [modalCreator, setModalCreator]   = useState<Creator | null>(null);
//   const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
//   const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking]         = useState<string | null>(null);

//   // ── Init ─────────────────────────────────────────────────────
//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const uid: string = parsed.user?._id || parsed._id || parsed.id || "";
//     setMyId(uid);
//     // Restore persisted connect status
//     setConnectStatus(JSON.parse(localStorage.getItem(`connectStatus_${uid}`) || "{}"));
//     // Restore unlocked contacts
//     setUnlockedEmails(JSON.parse(localStorage.getItem(`unlockedEmails_${uid}`) || "{}"));
//     setUnlockedInstagrams(JSON.parse(localStorage.getItem(`unlockedIg_${uid}`) || "{}"));
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchCampaignId();
//     fetchCreators();
//     // Poll every 10s — check invite_response notifications to update accepted status
//     const iv = setInterval(pollAcceptedInvites, 10000);
//     return () => clearInterval(iv);
//   }, [token]);

//   // ── GET /api/campaigns/my → cache first campaignId ───────────
//   const fetchCampaignId = async () => {
//     try {
//       const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const data = JSON.parse(text);
//       const camps: any[] = data.data || data.campaigns || [];
//       if (camps[0]?._id) campaignIdRef.current = camps[0]._id;
//     } catch (e) { console.error("fetchCampaignId:", e); }
//   };

//   // ── GET /api/profile/influencers ─────────────────────────────
//   const fetchCreators = async () => {
//     setLoading(true);
//     try {
//       const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const list: Creator[] = (JSON.parse(text).data || []).map(({ phone, ...rest }: any) => rest);
//       setCreators(list);
//       creatorsRef.current = list; // keep ref in sync

//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach(c => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//     } catch (e) {
//       console.error("fetchCreators:", e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Persist connect status ────────────────────────────────────
//   const saveStatus = (status: Record<string, ConnectStatus>) => {
//     localStorage.setItem(`connectStatus_${myId}`, JSON.stringify(status));
//     setConnectStatus({ ...status });
//   };

//   // ── Poll GET /api/notification for invite_response ───────────
//   const pollAcceptedInvites = async () => {
//     try {
//       const res  = await fetch(`${API}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const notifs: any[] = JSON.parse(text).data || JSON.parse(text).notifications || [];

//       const responses = notifs.filter((n: any) => n.type === "invite_response");
//       if (!responses.length) return;

//       const saved: Record<string, ConnectStatus> = JSON.parse(
//         localStorage.getItem(`connectStatus_${myId}`) || "{}"
//       );
//       let changed = false;

//       // Get latest creators from state — use ref to avoid stale closure
//       const currentCreators = creatorsRef.current;

//       responses.forEach((n: any) => {
//         const influencerUserId: string =
//           n.data?.influencerId ||
//           (typeof n.sender === "string" ? n.sender : n.sender?._id) || "";
//         if (!influencerUserId) return;

//         const isAccepted = n.message?.toLowerCase().includes("accepted");
//         const newStatus: ConnectStatus = isAccepted ? "accepted" : "pending";

//         // Match by user._id or user string
//         const matchedCreator = currentCreators.find(c => {
//           const u = (c as any).user;
//           const uid = typeof u === "object" ? (u?._id || u?.id || "") : (u || "");
//           return uid === influencerUserId;
//         });

//         const profileId = matchedCreator?._id;
//         if (!profileId) return;

//         if (saved[profileId] !== newStatus) {
//           saved[profileId] = newStatus;
//           changed = true;
//         }
//       });

//       if (changed) saveStatus(saved);
//     } catch { /* silent */ }
//   };

//   // ── POST /api/invite/send  { influencerId, campaignId } ───────
//   const handleConnect = async (profileId: string) => {
//     const status = connectStatus[profileId] || "none";
//     if (status === "pending" || status === "accepted") return;

//     const creator = creators.find(c => c._id === profileId);
//     if (!creator) return;

//     // creator.user = actual User._id linked to this profile
//     // If not present, fall back to profileId (might still work if backend handles both)
//     const rawUser = (creator as any).user;
//     const creatorUserId: string =
//       typeof rawUser === "string" ? rawUser :
//       typeof rawUser === "object" && rawUser?._id ? rawUser._id :
//       profileId;
//     console.log("[Connect] profileId:", profileId, "| creatorUserId:", creatorUserId, "| creator.user:", (creator as any).user);

//     if (!campaignIdRef.current) await fetchCampaignId();
//     if (!campaignIdRef.current) {
//       alert("No campaign found. Please create a campaign first.");
//       return;
//     }

//     setConnecting(profileId);
//     try {
//       // 1️⃣ Send invite — with timeout so it never hangs forever
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 10000);
//       let inviteOk = false;
//       try {
//         const res  = await fetch(`${API}/invite/send`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             influencerId: creatorUserId,
//             campaignId: campaignIdRef.current,
//           }),
//           signal: controller.signal,
//         });
//         clearTimeout(timeout);
//         const text = await res.text();
//         const data = text.startsWith("{") ? JSON.parse(text) : {};
//         if (!res.ok) {
//           alert(data.message || "Failed to send invite.");
//           return;
//         }
//         inviteOk = true;
//       } catch (inviteErr: any) {
//         clearTimeout(timeout);
//         if (inviteErr?.name === "AbortError") {
//           alert("Request timed out. Please try again.");
//         } else {
//           alert("Failed to send invite. Please try again.");
//         }
//         return;
//       }

//       // 2️⃣ Notification — backend sendInvite already creates it, no need here

//       // 3️⃣ Mark pending locally + close modal
//       saveStatus({ ...connectStatus, [profileId]: "pending" });
//       setModalCreator(null);
//     } catch (e) {
//       console.error("handleConnect:", e);
//       alert("Something went wrong. Please try again.");
//     } finally {
//       setConnecting(null);
//     }
//   };

//   // ── POST /api/contact/unlock { influencerId, type:"email" } ──
//   const handleUnlockEmail = async (profileId: string, userId: string) => {
//     if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
//     setUnlocking(`email_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "email" }),
//       });
//       const text = await res.text();
//       const data = text.startsWith("{") ? JSON.parse(text) : {};
//       if (!res.ok) {
//         alert(data.message || "Failed to unlock email. Check your token balance.");
//         return;
//       }
//       const email: string = data.email || data.data?.email || data.contact?.email || "";
//       if (!email) { alert("Email not available for this creator."); return; }
//       const updated = { ...unlockedEmails, [profileId]: email };
//       setUnlockedEmails(updated);
//       localStorage.setItem(`unlockedEmails_${myId}`, JSON.stringify(updated));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── POST /api/contact/unlock { influencerId, type:"instagram" }
//   const handleUnlockInstagram = async (profileId: string, userId: string) => {
//     if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
//     setUnlocking(`ig_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "instagram" }),
//       });
//       const text = await res.text();
//       const data = text.startsWith("{") ? JSON.parse(text) : {};
//       if (!res.ok) {
//         alert(data.message || "Failed to unlock Instagram. Check your token balance.");
//         return;
//       }
//       const ig: string =
//         data.instagram       || data.platform        || data.url           ||
//         data.data?.instagram || data.data?.platform  ||
//         data.contact?.instagram || "";
//       if (!ig) { alert("Instagram not available for this creator."); return; }
//       const updated = { ...unlockedInstagrams, [profileId]: ig };
//       setUnlockedInstagrams(updated);
//       localStorage.setItem(`unlockedIg_${myId}`, JSON.stringify(updated));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Data helpers ──────────────────────────────────────────────
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio  || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
//   const gFollowers = (c: Creator) => {
//     const f = c.followers;
//     if (!f || f === "0" || f === 0) return "";
//     const n = Number(f);
//     if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
//     if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
//     return String(n);
//   };

//   const filtered = creators.filter(c => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm  = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
//     const cm  = filterCity  ? (c.city || c.location || "").toLowerCase() === filterCity : true;
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

//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}
//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
//         .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         .cc-acts{display:flex;gap:8px}

//         .cbtn{border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none}
//         .cbtn-connect{flex:1;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border:1.5px solid #fde68a!important;background:#fffbeb;color:#d97706;cursor:default}
//         .cbtn-profile{flex:1;padding:11px;border:1.5px solid #ddd6fe!important;background:#f5f3ff;color:#7c3aed}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border:1.5px solid #c7d2fe!important;background:#eef2ff;color:#4f46e5;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border:1.5px solid #bbf7d0!important;background:#f0fdf4;color:#16a34a;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* Modal */
//         .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
//         @keyframes mfi{from{opacity:0}to{opacity:1}}
//         .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
//         @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
//         .mo-banner-top{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0}
//         .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
//         .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-body{padding:0 24px 28px;text-align:center}
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
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f5f3ff}
//         .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
//         .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
//         .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
//         .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
//         .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
//         .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
//         .mo-unlocked-ig:hover{text-decoration:underline}
//         .mo-info-banner{border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center;background:#f0fdf4;border:1.5px solid #bbf7d0}
//         .mo-info-banner.connected{background:#eef2ff;border-color:#c7d2fe}
//         .mo-info-title{font-size:13px;font-weight:700;margin-bottom:2px}
//         .mo-info-sub{font-size:11px;color:#6b7280;line-height:1.5}
//         .mo-acts{display:flex;gap:10px}
//         .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .mo-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .mo-btn.primary:hover:not(:disabled){transform:translateY(-1px)}
//         .mo-btn.primary:disabled{opacity:0.6;cursor:not-allowed}
//         .mo-btn.yellow{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}
//         .mo-btn.gray{background:#f4f4f4;color:#666}
//         .mo-btn.gray:hover{background:#eee}
//       `}</style>

//       {/* ══ MODAL ══════════════════════════════════════════════════ */}
//       {modalCreator && (() => {
//         const id             = modalCreator._id;
//         const status         = connectStatus[id] || "none";
//         const isAccepted     = status === "accepted";
//         const isPending      = status === "pending";
//         const isConn         = connecting === id;
//         const creatorUserId  = modalCreator.user || id;
//         const emailUnlocked  = unlockedEmails[id];
//         const igUnlocked     = unlockedInstagrams[id];
//         const isUnlockEmail  = unlocking === `email_${id}`;
//         const isUnlockIg     = unlocking === `ig_${id}`;
//         const { first, last } = splitName(gName(modalCreator));

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner-top" />

//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
//                   : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>}
//               </div>

//               <div className="mo-body">
//                 <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
//                   {first}
//                   {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{EMOJI[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
//                   {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
//                 </div>

//                 {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

//                 <div className="mo-stats">
//                   <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
//                 </div>

//                 <div className="mo-info">
//                   {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
//                   {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

//                   {/* Email unlock */}
//                   {emailUnlocked ? (
//                     <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
//                   ) : (
//                     <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                       <span>📧</span>
//                       <span className="mo-masked">{maskEmail(first)}</span>
//                       <div className="mo-unlock-action">
//                         <span className="mo-unlock-lbl">{isUnlockEmail ? "⏳" : "🔓 Unlock"}</span>
//                         {!isUnlockEmail && <span className="mo-unlock-cost">50 tokens</span>}
//                       </div>
//                     </div>
//                   )}

//                   {/* Instagram unlock */}
//                   {modalCreator.platform && (
//                     igUnlocked ? (
//                       <div className="mo-row"><span>📸</span><a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a></div>
//                     ) : (
//                       <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
//                         <span>📸</span>
//                         <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
//                         <div className="mo-unlock-action">
//                           <span className="mo-unlock-lbl">{isUnlockIg ? "⏳" : "🔓 Unlock"}</span>
//                           {!isUnlockIg && <span className="mo-unlock-cost">50 tokens</span>}
//                         </div>
//                       </div>
//                     )
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row">
//                       <span>📅</span>
//                       <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
//                     </div>
//                   )}
//                 </div>

//                 {/* Info banner */}
//                 {isAccepted ? (
//                   <div className="mo-info-banner connected">
//                     <div className="mo-info-title" style={{ color: "#4f46e5" }}>✅ You're Connected!</div>
//                     <div className="mo-info-sub">Chat is open. Unlock email & Instagram for 50 tokens each.</div>
//                   </div>
//                 ) : (
//                   <div className="mo-info-banner">
//                     <div className="mo-info-title" style={{ color: "#16a34a" }}>🤝 Connect is completely free!</div>
//                     <div className="mo-info-sub">Send an invite. Once accepted, chat opens automatically. Unlock contacts for 50 tokens each.</div>
//                   </div>
//                 )}

//                 {/* CTA */}
//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button className="mo-btn primary" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn yellow" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button className="mo-btn primary" disabled={isConn} onClick={() => handleConnect(id)}>
//                         {isConn ? "Sending..." : "🤝 Connect — Free"}
//                       </button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       {/* ══ PAGE ═══════════════════════════════════════════════════ */}
//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Connect with creators for your brand campaigns</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All Niches</option>
//             {niches.map((n, i) => <option key={i} value={n}>{EMOJI[n] || "✨"} {cap(n)}</option>)}
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
//             <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators."}</p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map(creator => {
//               const id            = creator._id;
//               const status        = connectStatus[id] || "none";
//               const isConn        = connecting === id;
//               const isAccepted    = status === "accepted";
//               const isPending     = status === "pending";
//               const creatorUserId = creator.user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlockEmail = unlocking === `email_${id}`;
//               const { first, last } = splitName(gName(creator));

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {isAccepted && <div className="cc-badge badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {gImg(creator)
//                       ? <img src={gImg(creator)!} alt={first} className="cc-av" />
//                       : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>}
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
//                       {first}
//                       {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{EMOJI[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     <div className="cc-lock">🔒 Last name & contacts hidden</div>
//                   </div>

//                   <div className="cc-body">
//                     <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>
//                     <div className="cc-stats">
//                       {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
//                       {gCity(creator)       && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
//                       {gCats(creator)[0]    && <span className="cc-stat">{EMOJI[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
//                     </div>

//                     <div className="cc-acts" onClick={e => e.stopPropagation()}>
//                       {isAccepted ? (
//                         // ✅ Accepted: profile + chat + email unlock
//                         <>
//                           <button className="cbtn cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
//                           <button className="cbtn cbtn-chat" title="Open Chat" onClick={() => router.push(`/messages?with=${id}`)}>💬</button>
//                           {emailUnlocked
//                             ? <button className="cbtn cbtn-unlock" disabled title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }}>📧</button>
//                             : <button className="cbtn cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                                 {isUnlockEmail ? "⏳" : "🔓"}
//                               </button>
//                           }
//                         </>
//                       ) : isPending ? (
//                         // ⏳ Pending: no chat yet
//                         <button className="cbtn cbtn-pending" disabled>⏳ Awaiting Acceptance</button>
//                       ) : (
//                         // 🆕 None: open modal → connect
//                         <button className="cbtn cbtn-connect" disabled={isConn} onClick={() => setModalCreator(creator)}>
//                           {isConn ? "Sending..." : "🤝 Connect — Free"}
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



// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter } from "next/navigation";

// // ── API Routes used ──────────────────────────────────────────────
// // GET  /api/profile/influencers              → fetch all creators
// // GET  /api/campaigns/my                     → get brand's campaignId (needed for invite)
// // POST /api/invite/send  { influencerId, campaignId }  → send invite
// // POST /api/contact/unlock { influencerId, type }      → unlock email / instagram
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
//   user?: string;
// }

// type ConnectStatus = "none" | "pending" | "accepted";

// // ── Pure helpers ─────────────────────────────────────────────────
// const splitName = (name: string) => {
//   if (!name) return { first: "", last: "" };
//   const parts = name.trim().split(" ");
//   return parts.length === 1
//     ? { first: parts[0], last: "" }
//     : { first: parts[0], last: parts.slice(1).join(" ") };
// };
// const maskEmail = (firstName: string) => {
//   if (!firstName) return "**********@***.com";
//   return `${firstName.toLowerCase().slice(0, 2)}**********@***.com`;
// };
// const maskInstagram = (url: string) => {
//   if (!url) return "instagram.com/****";
//   try {
//     const handle = new URL(url).pathname.split("/").filter(Boolean)[0] || "user";
//     return `instagram.com/${handle.slice(0, 2)}${"*".repeat(Math.max(4, handle.length - 2))}`;
//   } catch { return "instagram.com/****"; }
// };
// const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
// const EMOJI: Record<string, string> = {
//   fashion: "👗", beauty: "💄", fitness: "💪", food: "🍕", travel: "✈️",
//   tech: "💻", lifestyle: "🌟", gaming: "🎮", music: "🎵", sports: "⚽",
//   education: "📚", comedy: "😂", dance: "💃", photography: "📷", art: "🎨",
// };

// // ─────────────────────────────────────────────────────────────────
// export default function BrowsePage() {
//   const router = useRouter();

//   const [creators, setCreators]           = useState<Creator[]>([]);
//   const [loading, setLoading]             = useState(true);
//   const [token, setToken]                 = useState("");
//   const [myId, setMyId]                   = useState("");
//   const campaignIdRef                     = useRef<string>(""); // cached campaignId
//   const [connecting, setConnecting]       = useState<string | null>(null);
//   const [connectStatus, setConnectStatus] = useState<Record<string, ConnectStatus>>({});
//   const [filterNiche, setFilterNiche]     = useState("");
//   const [filterCity, setFilterCity]       = useState("");
//   const [niches, setNiches]               = useState<string[]>([]);
//   const [cities, setCities]               = useState<string[]>([]);
//   const [modalCreator, setModalCreator]   = useState<Creator | null>(null);
//   const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
//   const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking]         = useState<string | null>(null);

//   // ── Init ─────────────────────────────────────────────────────
//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const parsed = JSON.parse(raw);
//     if (parsed.role?.toLowerCase() !== "brand") { router.push("/campaigns"); return; }
//     const t: string = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setToken(t);
//     const uid: string = parsed.user?._id || parsed._id || parsed.id || "";
//     setMyId(uid);
//     // Restore persisted connect status
//     setConnectStatus(JSON.parse(localStorage.getItem(`connectStatus_${uid}`) || "{}"));
//     // Restore unlocked contacts
//     setUnlockedEmails(JSON.parse(localStorage.getItem(`unlockedEmails_${uid}`) || "{}"));
//     setUnlockedInstagrams(JSON.parse(localStorage.getItem(`unlockedIg_${uid}`) || "{}"));
//   }, []);

//   useEffect(() => {
//     if (!token) return;
//     fetchCampaignId();   // fetch & cache campaignId first
//     fetchCreators();
//   }, [token]);

//   // ── GET /api/campaigns/my → cache first campaignId ───────────
//   const fetchCampaignId = async () => {
//     try {
//       const res  = await fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const data = JSON.parse(text);
//       const camps: any[] = data.data || data.campaigns || [];
//       if (camps[0]?._id) campaignIdRef.current = camps[0]._id;
//     } catch (e) { console.error("fetchCampaignId:", e); }
//   };

//   // ── GET /api/profile/influencers ─────────────────────────────
//   const fetchCreators = async () => {
//     setLoading(true);
//     try {
//       const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const list: Creator[] = (JSON.parse(text).data || []).map(({ phone, ...rest }: any) => rest);
//       setCreators(list);

//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach(c => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//     } catch (e) {
//       console.error("fetchCreators:", e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ── Persist connect status ────────────────────────────────────
//   const saveStatus = (status: Record<string, ConnectStatus>) => {
//     localStorage.setItem(`connectStatus_${myId}`, JSON.stringify(status));
//     setConnectStatus({ ...status });
//   };

//   // ── POST /api/invite/send  { influencerId, campaignId } ───────
//   const handleConnect = async (profileId: string) => {
//     const status = connectStatus[profileId] || "none";
//     if (status === "pending" || status === "accepted") return;

//     const creator = creators.find(c => c._id === profileId);
//     if (!creator) return;

//     // creator.user = actual User._id linked to this profile
//     // If not present, fall back to profileId (might still work if backend handles both)
//     const rawUser = (creator as any).user;
//     const creatorUserId: string =
//       typeof rawUser === "string" ? rawUser :
//       typeof rawUser === "object" && rawUser?._id ? rawUser._id :
//       profileId;
//     console.log("[Connect] profileId:", profileId, "| creatorUserId:", creatorUserId, "| creator.user:", (creator as any).user);

//     if (!campaignIdRef.current) await fetchCampaignId();
//     if (!campaignIdRef.current) {
//       alert("No campaign found. Please create a campaign first.");
//       return;
//     }

//     setConnecting(profileId);
//     try {
//       // 1️⃣ Send invite — with timeout so it never hangs forever
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 10000);
//       let inviteOk = false;
//       try {
//         const res  = await fetch(`${API}/invite/send`, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//           body: JSON.stringify({
//             influencerId: creatorUserId,
//             campaignId: campaignIdRef.current,
//           }),
//           signal: controller.signal,
//         });
//         clearTimeout(timeout);
//         const text = await res.text();
//         const data = text.startsWith("{") ? JSON.parse(text) : {};
//         if (!res.ok) {
//           alert(data.message || "Failed to send invite.");
//           return;
//         }
//         inviteOk = true;
//       } catch (inviteErr: any) {
//         clearTimeout(timeout);
//         if (inviteErr?.name === "AbortError") {
//           alert("Request timed out. Please try again.");
//         } else {
//           alert("Failed to send invite. Please try again.");
//         }
//         return;
//       }

//       // 2️⃣ Notification — backend sendInvite already creates it, no need here

//       // 3️⃣ Mark pending locally + close modal
//       saveStatus({ ...connectStatus, [profileId]: "pending" });
//       setModalCreator(null);
//     } catch (e) {
//       console.error("handleConnect:", e);
//       alert("Something went wrong. Please try again.");
//     } finally {
//       setConnecting(null);
//     }
//   };

//   // ── POST /api/contact/unlock { influencerId, type:"email" } ──
//   const handleUnlockEmail = async (profileId: string, userId: string) => {
//     if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
//     setUnlocking(`email_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "email" }),
//       });
//       const text = await res.text();
//       const data = text.startsWith("{") ? JSON.parse(text) : {};
//       if (!res.ok) {
//         alert(data.message || "Failed to unlock email. Check your token balance.");
//         return;
//       }
//       const email: string = data.email || data.data?.email || data.contact?.email || "";
//       if (!email) { alert("Email not available for this creator."); return; }
//       const updated = { ...unlockedEmails, [profileId]: email };
//       setUnlockedEmails(updated);
//       localStorage.setItem(`unlockedEmails_${myId}`, JSON.stringify(updated));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── POST /api/contact/unlock { influencerId, type:"instagram" }
//   const handleUnlockInstagram = async (profileId: string, userId: string) => {
//     if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
//     setUnlocking(`ig_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "instagram" }),
//       });
//       const text = await res.text();
//       const data = text.startsWith("{") ? JSON.parse(text) : {};
//       if (!res.ok) {
//         alert(data.message || "Failed to unlock Instagram. Check your token balance.");
//         return;
//       }
//       const ig: string =
//         data.instagram       || data.platform        || data.url           ||
//         data.data?.instagram || data.data?.platform  ||
//         data.contact?.instagram || "";
//       if (!ig) { alert("Instagram not available for this creator."); return; }
//       const updated = { ...unlockedInstagrams, [profileId]: ig };
//       setUnlockedInstagrams(updated);
//       localStorage.setItem(`unlockedIg_${myId}`, JSON.stringify(updated));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Data helpers ──────────────────────────────────────────────
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio  || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
//   const gFollowers = (c: Creator) => {
//     const f = c.followers;
//     if (!f || f === "0" || f === 0) return "";
//     const n = Number(f);
//     if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
//     if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
//     return String(n);
//   };

//   const filtered = creators.filter(c => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm  = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
//     const cm  = filterCity  ? (c.city || c.location || "").toLowerCase() === filterCity : true;
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

//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}
//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
//         .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         .cc-acts{display:flex;gap:8px}

//         .cbtn{border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:all 0.2s;border:none}
//         .cbtn-connect{flex:1;padding:11px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border:1.5px solid #fde68a!important;background:#fffbeb;color:#d97706;cursor:default}
//         .cbtn-profile{flex:1;padding:11px;border:1.5px solid #ddd6fe!important;background:#f5f3ff;color:#7c3aed}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border:1.5px solid #c7d2fe!important;background:#eef2ff;color:#4f46e5;font-size:18px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border:1.5px solid #bbf7d0!important;background:#f0fdf4;color:#16a34a;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* Modal */
//         .mo{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;animation:mfi 0.2s ease}
//         @keyframes mfi{from{opacity:0}to{opacity:1}}
//         .mo-box{background:#fff;border-radius:24px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;animation:msu 0.25s ease;position:relative}
//         @keyframes msu{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mo-close{position:absolute;top:14px;right:16px;background:rgba(255,255,255,0.9);border:none;width:32px;height:32px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;font-weight:700}
//         .mo-banner-top{background:linear-gradient(135deg,#4f46e5,#7c3aed);height:100px;border-radius:24px 24px 0 0}
//         .mo-avwrap{display:flex;justify-content:center;margin-top:-46px;margin-bottom:12px}
//         .mo-av{width:88px;height:88px;border-radius:50%;border:4px solid #fff;object-fit:cover;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-avph{width:88px;height:88px;border-radius:50%;border:4px solid #fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;font-weight:800;box-shadow:0 4px 16px rgba(0,0,0,0.12)}
//         .mo-body{padding:0 24px 28px;text-align:center}
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
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f5f3ff}
//         .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
//         .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
//         .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
//         .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
//         .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
//         .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
//         .mo-unlocked-ig:hover{text-decoration:underline}
//         .mo-info-banner{border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center;background:#f0fdf4;border:1.5px solid #bbf7d0}
//         .mo-info-banner.connected{background:#eef2ff;border-color:#c7d2fe}
//         .mo-info-title{font-size:13px;font-weight:700;margin-bottom:2px}
//         .mo-info-sub{font-size:11px;color:#6b7280;line-height:1.5}
//         .mo-acts{display:flex;gap:10px}
//         .mo-btn{flex:1;padding:13px;border-radius:12px;font-size:14px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s}
//         .mo-btn.primary{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .mo-btn.primary:hover:not(:disabled){transform:translateY(-1px)}
//         .mo-btn.primary:disabled{opacity:0.6;cursor:not-allowed}
//         .mo-btn.yellow{background:#fffbeb;color:#d97706;border:1.5px solid #fde68a;cursor:default}
//         .mo-btn.gray{background:#f4f4f4;color:#666}
//         .mo-btn.gray:hover{background:#eee}
//       `}</style>

//       {/* ══ MODAL ══════════════════════════════════════════════════ */}
//       {modalCreator && (() => {
//         const id             = modalCreator._id;
//         const status         = connectStatus[id] || "none";
//         const isAccepted     = status === "accepted";
//         const isPending      = status === "pending";
//         const isConn         = connecting === id;
//         const creatorUserId  = modalCreator.user || id;
//         const emailUnlocked  = unlockedEmails[id];
//         const igUnlocked     = unlockedInstagrams[id];
//         const isUnlockEmail  = unlocking === `email_${id}`;
//         const isUnlockIg     = unlocking === `ig_${id}`;
//         const { first, last } = splitName(gName(modalCreator));

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner-top" />

//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
//                   : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>}
//               </div>

//               <div className="mo-body">
//                 <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
//                   {first}
//                   {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{EMOJI[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
//                   {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
//                 </div>

//                 {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

//                 <div className="mo-stats">
//                   <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
//                 </div>

//                 <div className="mo-info">
//                   {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
//                   {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

//                   {/* Email unlock */}
//                   {emailUnlocked ? (
//                     <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
//                   ) : (
//                     <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                       <span>📧</span>
//                       <span className="mo-masked">{maskEmail(first)}</span>
//                       <div className="mo-unlock-action">
//                         <span className="mo-unlock-lbl">{isUnlockEmail ? "⏳" : "🔓 Unlock"}</span>
//                         {!isUnlockEmail && <span className="mo-unlock-cost">50 tokens</span>}
//                       </div>
//                     </div>
//                   )}

//                   {/* Instagram unlock */}
//                   {modalCreator.platform && (
//                     igUnlocked ? (
//                       <div className="mo-row"><span>📸</span><a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a></div>
//                     ) : (
//                       <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
//                         <span>📸</span>
//                         <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
//                         <div className="mo-unlock-action">
//                           <span className="mo-unlock-lbl">{isUnlockIg ? "⏳" : "🔓 Unlock"}</span>
//                           {!isUnlockIg && <span className="mo-unlock-cost">50 tokens</span>}
//                         </div>
//                       </div>
//                     )
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row">
//                       <span>📅</span>
//                       <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
//                     </div>
//                   )}
//                 </div>

//                 {/* Info banner */}
//                 {isAccepted ? (
//                   <div className="mo-info-banner connected">
//                     <div className="mo-info-title" style={{ color: "#4f46e5" }}>✅ You're Connected!</div>
//                     <div className="mo-info-sub">Chat is open. Unlock email & Instagram for 50 tokens each.</div>
//                   </div>
//                 ) : (
//                   <div className="mo-info-banner">
//                     <div className="mo-info-title" style={{ color: "#16a34a" }}>🤝 Connect is completely free!</div>
//                     <div className="mo-info-sub">Send an invite. Once accepted, chat opens automatically. Unlock contacts for 50 tokens each.</div>
//                   </div>
//                 )}

//                 {/* CTA */}
//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button className="mo-btn primary" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn yellow" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button className="mo-btn primary" disabled={isConn} onClick={() => handleConnect(id)}>
//                         {isConn ? "Sending..." : "🤝 Connect — Free"}
//                       </button>
//                       <button className="mo-btn gray" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </div>
//           </div>
//         );
//       })()}

//       {/* ══ PAGE ═══════════════════════════════════════════════════ */}
//       <div className="browse">
//         <div className="browse-header">
//           <h1 className="browse-title">Browse Creators</h1>
//           <p className="browse-sub">Connect with creators for your brand campaigns</p>
//         </div>

//         <div className="browse-filters">
//           <select className={`bsel ${filterNiche ? "active" : ""}`} value={filterNiche} onChange={e => setFilterNiche(e.target.value)}>
//             <option value="">🎯 All Niches</option>
//             {niches.map((n, i) => <option key={i} value={n}>{EMOJI[n] || "✨"} {cap(n)}</option>)}
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
//             <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators."}</p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map(creator => {
//               const id            = creator._id;
//               const status        = connectStatus[id] || "none";
//               const isConn        = connecting === id;
//               const isAccepted    = status === "accepted";
//               const isPending     = status === "pending";
//               const creatorUserId = creator.user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlockEmail = unlocking === `email_${id}`;
//               const { first, last } = splitName(gName(creator));

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {isAccepted && <div className="cc-badge badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {gImg(creator)
//                       ? <img src={gImg(creator)!} alt={first} className="cc-av" />
//                       : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>}
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
//                       {first}
//                       {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{EMOJI[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     <div className="cc-lock">🔒 Last name & contacts hidden</div>
//                   </div>

//                   <div className="cc-body">
//                     <p className="cc-bio">{gBio(creator) || "Creator available for brand collaborations."}</p>
//                     <div className="cc-stats">
//                       {gFollowers(creator) && <span className="cc-stat">👥 {gFollowers(creator)}</span>}
//                       {gCity(creator)       && <span className="cc-stat">📍 {cap(gCity(creator))}</span>}
//                       {gCats(creator)[0]    && <span className="cc-stat">{EMOJI[gCats(creator)[0]?.toLowerCase()] || "✨"} {cap(gCats(creator)[0])}</span>}
//                     </div>

//                     <div className="cc-acts" onClick={e => e.stopPropagation()}>
//                       {isAccepted ? (
//                         // ✅ Accepted: profile + chat + email unlock
//                         <>
//                           <button className="cbtn cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
//                           <button className="cbtn cbtn-chat" title="Open Chat" onClick={() => router.push(`/messages?with=${id}`)}>💬</button>
//                           {emailUnlocked
//                             ? <button className="cbtn cbtn-unlock" disabled title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }}>📧</button>
//                             : <button className="cbtn cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                                 {isUnlockEmail ? "⏳" : "🔓"}
//                               </button>
//                           }
//                         </>
//                       ) : isPending ? (
//                         // ⏳ Pending: no chat yet
//                         <button className="cbtn cbtn-pending" disabled>⏳ Awaiting Acceptance</button>
//                       ) : (
//                         // 🆕 None: open modal → connect
//                         <button className="cbtn cbtn-connect" disabled={isConn} onClick={() => setModalCreator(creator)}>
//                           {isConn ? "Sending..." : "🤝 Connect — Free"}
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

// // ── First name visible, last name blurred ────────────────────────
// const splitName = (name: string) => {
//   if (!name) return { first: "", last: "" };
//   const parts = name.trim().split(" ");
//   if (parts.length === 1) return { first: parts[0], last: "" };
//   return { first: parts[0], last: parts.slice(1).join(" ") };
// };

// // ── Email mask: uses creator first name initials as placeholder ──
// // e.g. "Rahul" → ra**********@***.com (actual email revealed only after unlock)
// const maskEmailFromName = (firstName: string) => {
//   if (!firstName) return "**********@***.com";
//   const prefix = firstName.toLowerCase().slice(0, 2);
//   return `${prefix}**********@***.com`;
// };

// // ── Instagram mask: in**@instagram.com style ─────────────────────
// const maskInstagram = (url: string) => {
//   if (!url) return "instagram.com/****";
//   try {
//     const u = new URL(url);
//     const handle = u.pathname.split("/").filter(Boolean)[0] || "user";
//     const visible = handle.slice(0, 2);
//     const stars = "*".repeat(Math.max(4, handle.length - 2));
//     return `instagram.com/${visible}${stars}`;
//   } catch {
//     return "instagram.com/****";
//   }
// };

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
//   const [modalCreator, setModalCreator] = useState<Creator | null>(null);

//   // Unlock state
//   const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
//   const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking]                   = useState<string | null>(null);

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
//       const saved: Record<string, ConnectStatus> = JSON.parse(localStorage.getItem("connectStatus_" + myId) || "{}");
//       const pendingIds = Object.keys(saved).filter(k => saved[k] === "pending");
//       if (!pendingIds.length) return;
//       const res = await fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const convs: any[] = JSON.parse(text).data || JSON.parse(text).conversations || [];
//       let changed = false;
//       const tryMark = (conv: any, condition: boolean) => {
//         (conv.participants || []).forEach((p: any) => {
//           const pid = typeof p === "object" ? (p._id || p.id) : p;
//           if (pid && pid !== myId && saved[pid] === "pending" && condition) { saved[pid] = "accepted"; changed = true; }
//         });
//       };
//       convs.forEach(conv => {
//         tryMark(conv, conv.status === "accepted" || conv.isAccepted === true || conv.accepted === true);
//       });
//       if (!changed) {
//         convs.forEach(conv => {
//           const hasMsg = (conv.lastMessage && conv.lastMessage !== "") || conv.messageCount > 0 || conv.messages?.length > 0;
//           tryMark(conv, hasMsg);
//         });
//       }
//       if (changed) { setConnectStatus({ ...saved }); localStorage.setItem("connectStatus_" + myId, JSON.stringify(saved)); }
//     } catch { /* silent */ }
//   };

//   const fetchAllCreators = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const data = JSON.parse(text);
//       const list: Creator[] = (data.data || []).map((c: any) => { const { phone, ...rest } = c; return rest; });
//       setCreators(list);
//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach(c => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//       await checkAcceptedConnections();
//     } catch (e) { console.error(e); }
//     finally { setLoading(false); }
//   };

//   // ── Connect — FREE ────────────────────────────────────────────
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
//       try { convId = JSON.parse(await convRes.text())?.data?._id || ""; } catch { /* skip */ }
//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ user: creatorUserId, message: "A brand wants to connect with you!", type: "new_message", link: convId ? `/chat/${convId}` : "/messages" }),
//       });
//       const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
//       setConnectStatus(updated);
//       localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
//     } catch (e) { console.error(e); }
//     finally { setConnecting(null); }
//   };

//   // ── Unlock Email — 50 tokens ──────────────────────────────────
//   const handleUnlockEmail = async (profileId: string, userId: string) => {
//     if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
//     setUnlocking(`email_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Failed to unlock email"); return; }
//       setUnlockedEmails(prev => ({ ...prev, [profileId]: data.email }));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Unlock Instagram — 50 tokens ─────────────────────────────
//   const handleUnlockInstagram = async (profileId: string, userId: string) => {
//     if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
//     setUnlocking(`ig_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "instagram" }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Failed to unlock Instagram"); return; }
//       setUnlockedInstagrams(prev => ({ ...prev, [profileId]: data.platform || data.instagram || data.url || "" }));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Helpers ───────────────────────────────────────────────────
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
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

//   const filtered = creators.filter(c => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
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

//         /* Cards */
//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}
//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
//         .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         .cc-acts{display:flex;gap:8px}
//         .cbtn-connect{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #fde68a;cursor:default;background:#fffbeb;color:#d97706}
//         .cbtn-profile{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #ddd6fe;cursor:pointer;background:#f5f3ff;color:#7c3aed;transition:all 0.2s}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border-radius:11px;border:1.5px solid #c7d2fe;background:#eef2ff;color:#4f46e5;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border-radius:11px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#16a34a;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}
//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .cc-badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .cc-badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* Modal */
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

//         /* Unlock rows */
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f5f3ff}
//         .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
//         .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
//         .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
//         .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
//         .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
//         .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
//         .mo-unlocked-ig:hover{text-decoration:underline}

//         .mo-free-banner{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center}
//         .mo-free-title{font-size:13px;font-weight:700;color:#16a34a;margin-bottom:2px}
//         .mo-free-sub{font-size:11px;color:#6b7280;line-height:1.5}
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
//       `}</style>

//       {/* ── MODAL ── */}
//       {modalCreator && (() => {
//         const id            = modalCreator._id;
//         const status        = connectStatus[id] || "none";
//         const isAccepted    = status === "accepted";
//         const isPending     = status === "pending";
//         const isConn        = connecting === id;
//         const creatorUserId = (modalCreator as any).user || id;
//         const emailUnlocked = unlockedEmails[id];
//         const igUnlocked    = unlockedInstagrams[id];
//         const isUnlockingEmail = unlocking === `email_${id}`;
//         const isUnlockingIg    = unlocking === `ig_${id}`;
//         const { first, last } = splitName(gName(modalCreator));

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner" />
//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
//                   : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>
//                 }
//               </div>
//               <div className="mo-body">

//                 {/* Name: first visible, last blurred */}
//                 <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
//                   {first}
//                   {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{em[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
//                   {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
//                 </div>

//                 {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

//                 <div className="mo-stats">
//                   <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
//                 </div>

//                 <div className="mo-info">
//                   {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
//                   {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

//                   {/* Email row */}
//                   {emailUnlocked ? (
//                     <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
//                   ) : (
//                     <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                       <span>📧</span>
//                       <span className="mo-masked">{maskEmailFromName(first)}</span>
//                       <div className="mo-unlock-action">
//                         <span className="mo-unlock-lbl">{isUnlockingEmail ? "⏳" : "🔓 Unlock"}</span>
//                         {!isUnlockingEmail && <span className="mo-unlock-cost">50 tokens</span>}
//                       </div>
//                     </div>
//                   )}

//                   {/* Instagram row */}
//                   {modalCreator.platform && (
//                     igUnlocked ? (
//                       <div className="mo-row">
//                         <span>📸</span>
//                         <a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a>
//                       </div>
//                     ) : (
//                       <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
//                         <span>📸</span>
//                         <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
//                         <div className="mo-unlock-action">
//                           <span className="mo-unlock-lbl">{isUnlockingIg ? "⏳" : "🔓 Unlock"}</span>
//                           {!isUnlockingIg && <span className="mo-unlock-cost">50 tokens</span>}
//                         </div>
//                       </div>
//                     )
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row"><span>📅</span><span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span></div>
//                   )}
//                 </div>

//                 {/* Banner */}
//                 <div className="mo-free-banner">
//                   <div className="mo-free-title">🤝 Connect is completely free!</div>
//                   <div className="mo-free-sub">Unlock email & Instagram for 50 tokens each.</div>
//                 </div>

//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button className="mo-btn mo-chat" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn mo-pending-btn" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button className="mo-btn mo-connect" disabled={isConn} onClick={() => handleConnect(id)}>
//                         {isConn ? "Sending..." : "🤝 Connect — Free"}
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
//           {(filterNiche || filterCity) && <button className="bclr" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>}
//           {!loading && <span className="bcnt"><span>{filtered.length}</span> creators found</span>}
//         </div>

//         {loading ? (
//           <div className="bload"><div className="bspin" /></div>
//         ) : filtered.length === 0 ? (
//           <div className="bempty">
//             <div className="bempty-ico">👥</div>
//             <h3 className="bempty-title">{creators.length === 0 ? "No creators yet" : "No matches"}</h3>
//             <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators"}</p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map(creator => {
//               const id            = creator._id;
//               const status        = connectStatus[id] || "none";
//               const isConn        = connecting === id;
//               const img           = gImg(creator);
//               const isAccepted    = status === "accepted";
//               const isPending     = status === "pending";
//               const creatorUserId = (creator as any).user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlockingEmail = unlocking === `email_${id}`;
//               const { first, last } = splitName(gName(creator));

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {isAccepted && <div className="cc-badge cc-badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge cc-badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {img
//                       ? <img src={img} alt={first} className="cc-av" />
//                       : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>
//                     }
//                     {/* First name visible, last name blurred */}
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
//                       {first}
//                       {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{em[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     <div className="cc-lock">🔒 Last name & contacts hidden</div>
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
//                           <button className="cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
//                           <button className="cbtn-chat" onClick={() => router.push(`/messages?with=${id}`)} title="Open Chat">💬</button>
//                           {emailUnlocked ? (
//                             <button className="cbtn-unlock" title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }} disabled>📧</button>
//                           ) : (
//                             <button className="cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockingEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                               {isUnlockingEmail ? "⏳" : "🔓"}
//                             </button>
//                           )}
//                         </>
//                       ) : isPending ? (
//                         <button className="cbtn-pending" disabled>⏳ Request Sent — Awaiting Acceptance</button>
//                       ) : (
//                         <button className="cbtn-connect" onClick={() => setModalCreator(creator)} disabled={isConn}>
//                           {isConn ? "Sending..." : "🤝 Connect — Free"}
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

// // ── First name visible, last name blurred ────────────────────────
// const splitName = (name: string) => {
//   if (!name) return { first: "", last: "" };
//   const parts = name.trim().split(" ");
//   if (parts.length === 1) return { first: parts[0], last: "" };
//   return { first: parts[0], last: parts.slice(1).join(" ") };
// };

// // ── Email mask: sh**********@gmail.com ───────────────────────────
// const maskEmail = (email: string) => {
//   if (!email) return "**@gmail.com";
//   const [local, domain] = email.split("@");
//   if (!domain) return email;
//   const visible = local.slice(0, 2);
//   const stars = "*".repeat(Math.max(6, local.length - 2));
//   return `${visible}${stars}@${domain}`;
// };

// // ── Instagram mask: in**@instagram.com style ─────────────────────
// const maskInstagram = (url: string) => {
//   if (!url) return "instagram.com/****";
//   try {
//     const u = new URL(url);
//     const handle = u.pathname.split("/").filter(Boolean)[0] || "user";
//     const visible = handle.slice(0, 2);
//     const stars = "*".repeat(Math.max(4, handle.length - 2));
//     return `instagram.com/${visible}${stars}`;
//   } catch {
//     return "instagram.com/****";
//   }
// };

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
//   const [modalCreator, setModalCreator] = useState<Creator | null>(null);

//   // Unlock state
//   const [unlockedEmails, setUnlockedEmails]         = useState<Record<string, string>>({});
//   const [unlockedInstagrams, setUnlockedInstagrams] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking]                   = useState<string | null>(null);

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
//       const saved: Record<string, ConnectStatus> = JSON.parse(localStorage.getItem("connectStatus_" + myId) || "{}");
//       const pendingIds = Object.keys(saved).filter(k => saved[k] === "pending");
//       if (!pendingIds.length) return;
//       const res = await fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) return;
//       const convs: any[] = JSON.parse(text).data || JSON.parse(text).conversations || [];
//       let changed = false;
//       const tryMark = (conv: any, condition: boolean) => {
//         (conv.participants || []).forEach((p: any) => {
//           const pid = typeof p === "object" ? (p._id || p.id) : p;
//           if (pid && pid !== myId && saved[pid] === "pending" && condition) { saved[pid] = "accepted"; changed = true; }
//         });
//       };
//       convs.forEach(conv => {
//         tryMark(conv, conv.status === "accepted" || conv.isAccepted === true || conv.accepted === true);
//       });
//       if (!changed) {
//         convs.forEach(conv => {
//           const hasMsg = (conv.lastMessage && conv.lastMessage !== "") || conv.messageCount > 0 || conv.messages?.length > 0;
//           tryMark(conv, hasMsg);
//         });
//       }
//       if (changed) { setConnectStatus({ ...saved }); localStorage.setItem("connectStatus_" + myId, JSON.stringify(saved)); }
//     } catch { /* silent */ }
//   };

//   const fetchAllCreators = async () => {
//     setLoading(true);
//     try {
//       const res = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${token}` } });
//       const text = await res.text();
//       if (text.startsWith("<!") || !res.ok) throw new Error("Failed");
//       const data = JSON.parse(text);
//       const list: Creator[] = (data.data || []).map((c: any) => { const { phone, ...rest } = c; return rest; });
//       setCreators(list);
//       const ns = new Set<string>(), cs = new Set<string>();
//       list.forEach(c => {
//         const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//         arr.forEach(x => { if (x?.trim()) ns.add(x.toLowerCase().trim()); });
//         const ct = (c.city || c.location || "").trim();
//         if (ct) cs.add(ct.toLowerCase().trim());
//       });
//       setNiches([...ns].filter(Boolean));
//       setCities([...cs].filter(Boolean));
//       await checkAcceptedConnections();
//     } catch (e) { console.error(e); }
//     finally { setLoading(false); }
//   };

//   // ── Connect — FREE ────────────────────────────────────────────
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
//       try { convId = JSON.parse(await convRes.text())?.data?._id || ""; } catch { /* skip */ }
//       await fetch(`${API}/notification/create`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ user: creatorUserId, message: "A brand wants to connect with you!", type: "new_message", link: convId ? `/chat/${convId}` : "/messages" }),
//       });
//       const updated = { ...connectStatus, [creatorProfileId]: "pending" as ConnectStatus };
//       setConnectStatus(updated);
//       localStorage.setItem("connectStatus_" + myId, JSON.stringify(updated));
//     } catch (e) { console.error(e); }
//     finally { setConnecting(null); }
//   };

//   // ── Unlock Email — 50 tokens ──────────────────────────────────
//   const handleUnlockEmail = async (profileId: string, userId: string) => {
//     if (unlockedEmails[profileId] || unlocking === `email_${profileId}`) return;
//     setUnlocking(`email_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Failed to unlock email"); return; }
//       setUnlockedEmails(prev => ({ ...prev, [profileId]: data.email }));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Unlock Instagram — 50 tokens ─────────────────────────────
//   const handleUnlockInstagram = async (profileId: string, userId: string) => {
//     if (unlockedInstagrams[profileId] || unlocking === `ig_${profileId}`) return;
//     setUnlocking(`ig_${profileId}`);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: userId, type: "instagram" }),
//       });
//       const data = await res.json();
//       if (!res.ok) { alert(data.message || "Failed to unlock Instagram"); return; }
//       setUnlockedInstagrams(prev => ({ ...prev, [profileId]: data.platform || data.instagram || data.url || "" }));
//     } catch { alert("Something went wrong."); }
//     finally { setUnlocking(null); }
//   };

//   // ── Helpers ───────────────────────────────────────────────────
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
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

//   const filtered = creators.filter(c => {
//     const arr = Array.isArray(c.categories) ? c.categories : [c.categories as string];
//     const nm = filterNiche ? arr.some(x => x?.toLowerCase() === filterNiche) : true;
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

//         /* Cards */
//         .cc{background:#fff;border-radius:20px;border:1.5px solid #ebebeb;overflow:hidden;transition:all 0.22s;position:relative;cursor:pointer}
//         .cc:hover{border-color:#c7d2fe;box-shadow:0 8px 32px rgba(79,70,229,0.1);transform:translateY(-3px)}
//         .cc-top{background:linear-gradient(135deg,#eef2ff,#f5f3ff);padding:28px 24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center}
//         .cc-av{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);object-fit:cover;display:block;margin-bottom:12px}
//         .cc-avph{width:76px;height:76px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(79,70,229,0.15);background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800;margin-bottom:12px}
//         .cc-city{font-size:12px;color:#9ca3af;margin-top:2px}
//         .cc-cats{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:8px}
//         .cc-cat{padding:3px 9px;border-radius:100px;background:rgba(79,70,229,0.08);color:#4f46e5;font-size:11px;font-weight:600}
//         .cc-lock{font-size:10px;color:#c4b5fd;margin-top:6px}
//         .cc-body{padding:16px 20px 20px}
//         .cc-bio{font-size:13px;color:#64748b;line-height:1.65;margin-bottom:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}
//         .cc-stats{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
//         .cc-stat{background:#f8fafc;border-radius:8px;padding:5px 10px;font-size:12px;color:#64748b;font-weight:500}
//         .cc-acts{display:flex;gap:8px}
//         .cbtn-connect{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:none;cursor:pointer;transition:all 0.2s;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;box-shadow:0 2px 10px rgba(79,70,229,0.3)}
//         .cbtn-connect:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,0.4)}
//         .cbtn-connect:disabled{opacity:0.6;cursor:not-allowed;transform:none}
//         .cbtn-pending{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #fde68a;cursor:default;background:#fffbeb;color:#d97706}
//         .cbtn-profile{flex:1;padding:11px;border-radius:11px;font-size:13px;font-weight:700;font-family:'Plus Jakarta Sans',sans-serif;border:1.5px solid #ddd6fe;cursor:pointer;background:#f5f3ff;color:#7c3aed;transition:all 0.2s}
//         .cbtn-profile:hover{background:#ede9fe}
//         .cbtn-chat{width:42px;height:42px;border-radius:11px;border:1.5px solid #c7d2fe;background:#eef2ff;color:#4f46e5;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0}
//         .cbtn-chat:hover{background:#4f46e5;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock{width:42px;height:42px;border-radius:11px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#16a34a;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}
//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .cc-badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .cc-badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .bload{display:flex;align-items:center;justify-content:center;padding:80px}
//         .bspin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         .bempty{display:flex;flex-direction:column;align-items:center;padding:80px 40px;text-align:center}
//         .bempty-ico{font-size:48px;margin-bottom:16px}
//         .bempty-title{font-size:20px;font-weight:700;color:#111;margin-bottom:8px}
//         .bempty-sub{font-size:14px;color:#aaa;max-width:320px;line-height:1.6}

//         /* Modal */
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

//         /* Unlock rows */
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f5f3ff}
//         .mo-masked{font-family:monospace;font-size:12px;color:#aaa;letter-spacing:0.02em}
//         .mo-unlock-action{margin-left:auto;display:flex;align-items:center;gap:4px;flex-shrink:0}
//         .mo-unlock-lbl{font-size:12px;color:#7c3aed;font-weight:700}
//         .mo-unlock-cost{font-size:10px;color:#bbb;background:#f5f3ff;border-radius:100px;padding:2px 7px;font-weight:600}
//         .mo-unlocked-email{color:#16a34a;font-weight:600;word-break:break-all;font-size:13px}
//         .mo-unlocked-ig{color:#4f46e5;font-weight:600;word-break:break-all;font-size:13px;text-decoration:none}
//         .mo-unlocked-ig:hover{text-decoration:underline}

//         .mo-free-banner{background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:14px;padding:12px 16px;margin-bottom:18px;text-align:center}
//         .mo-free-title{font-size:13px;font-weight:700;color:#16a34a;margin-bottom:2px}
//         .mo-free-sub{font-size:11px;color:#6b7280;line-height:1.5}
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
//       `}</style>

//       {/* ── MODAL ── */}
//       {modalCreator && (() => {
//         const id            = modalCreator._id;
//         const status        = connectStatus[id] || "none";
//         const isAccepted    = status === "accepted";
//         const isPending     = status === "pending";
//         const isConn        = connecting === id;
//         const creatorUserId = (modalCreator as any).user || id;
//         const emailUnlocked = unlockedEmails[id];
//         const igUnlocked    = unlockedInstagrams[id];
//         const isUnlockingEmail = unlocking === `email_${id}`;
//         const isUnlockingIg    = unlocking === `ig_${id}`;
//         const { first, last } = splitName(gName(modalCreator));

//         return (
//           <div className="mo" onClick={() => setModalCreator(null)}>
//             <div className="mo-box" onClick={e => e.stopPropagation()}>
//               <button className="mo-close" onClick={() => setModalCreator(null)}>✕</button>
//               <div className="mo-banner" />
//               <div className="mo-avwrap">
//                 {gImg(modalCreator)
//                   ? <img src={gImg(modalCreator)!} alt={first} className="mo-av" />
//                   : <div className="mo-avph">{first.charAt(0).toUpperCase()}</div>
//                 }
//               </div>
//               <div className="mo-body">

//                 {/* Name: first visible, last blurred */}
//                 <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 8 }}>
//                   {first}
//                   {last && <> <span style={{ filter: "blur(6px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                 </div>

//                 <div className="mo-tags">
//                   {gCats(modalCreator)[0] && <span className="mo-tag mo-tag-cat">{em[gCats(modalCreator)[0]?.toLowerCase()] || "✨"} {cap(gCats(modalCreator)[0])}</span>}
//                   {gCity(modalCreator) && <span className="mo-tag mo-tag-city">📍 {cap(gCity(modalCreator))}</span>}
//                 </div>

//                 {gBio(modalCreator) && <div className="mo-bio">{gBio(modalCreator)}</div>}

//                 <div className="mo-stats">
//                   <div className="mo-stat"><div className="mo-sval">{gFollowers(modalCreator) || "—"}</div><div className="mo-slbl">Followers</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCats(modalCreator).length || "—"}</div><div className="mo-slbl">Niches</div></div>
//                   <div className="mo-stat"><div className="mo-sval">{gCity(modalCreator) ? cap(gCity(modalCreator)) : "—"}</div><div className="mo-slbl">City</div></div>
//                 </div>

//                 <div className="mo-info">
//                   {gCity(modalCreator) && <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>}
//                   {gCats(modalCreator).length > 0 && <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>}

//                   {/* Email row */}
//                   {emailUnlocked ? (
//                     <div className="mo-row"><span>📧</span><span className="mo-unlocked-email">{emailUnlocked}</span></div>
//                   ) : (
//                     <div className="mo-row mo-unlock-row" onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                       <span>📧</span>
//                       <span className="mo-masked">{maskEmail("shxxxxxx@gmail.com")}</span>
//                       <div className="mo-unlock-action">
//                         <span className="mo-unlock-lbl">{isUnlockingEmail ? "⏳" : "🔓 Unlock"}</span>
//                         {!isUnlockingEmail && <span className="mo-unlock-cost">50 tokens</span>}
//                       </div>
//                     </div>
//                   )}

//                   {/* Instagram row */}
//                   {modalCreator.platform && (
//                     igUnlocked ? (
//                       <div className="mo-row">
//                         <span>📸</span>
//                         <a href={igUnlocked} target="_blank" rel="noreferrer" className="mo-unlocked-ig">{igUnlocked}</a>
//                       </div>
//                     ) : (
//                       <div className="mo-row mo-unlock-row" onClick={() => handleUnlockInstagram(id, creatorUserId)}>
//                         <span>📸</span>
//                         <span className="mo-masked">{maskInstagram(modalCreator.platform)}</span>
//                         <div className="mo-unlock-action">
//                           <span className="mo-unlock-lbl">{isUnlockingIg ? "⏳" : "🔓 Unlock"}</span>
//                           {!isUnlockingIg && <span className="mo-unlock-cost">50 tokens</span>}
//                         </div>
//                       </div>
//                     )
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row"><span>📅</span><span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span></div>
//                   )}
//                 </div>

//                 {/* Banner */}
//                 <div className="mo-free-banner">
//                   <div className="mo-free-title">🤝 Connect is completely free!</div>
//                   <div className="mo-free-sub">Unlock email & Instagram for 50 tokens each.</div>
//                 </div>

//                 <div className="mo-acts">
//                   {isAccepted ? (
//                     <>
//                       <button className="mo-btn mo-chat" onClick={() => { setModalCreator(null); router.push(`/messages?with=${id}`); }}>💬 Open Chat</button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : isPending ? (
//                     <>
//                       <button className="mo-btn mo-pending-btn" disabled>⏳ Request Sent</button>
//                       <button className="mo-btn mo-cls" onClick={() => setModalCreator(null)}>Close</button>
//                     </>
//                   ) : (
//                     <>
//                       <button className="mo-btn mo-connect" disabled={isConn} onClick={() => handleConnect(id)}>
//                         {isConn ? "Sending..." : "🤝 Connect — Free"}
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
//           {(filterNiche || filterCity) && <button className="bclr" onClick={() => { setFilterNiche(""); setFilterCity(""); }}>✕ Clear</button>}
//           {!loading && <span className="bcnt"><span>{filtered.length}</span> creators found</span>}
//         </div>

//         {loading ? (
//           <div className="bload"><div className="bspin" /></div>
//         ) : filtered.length === 0 ? (
//           <div className="bempty">
//             <div className="bempty-ico">👥</div>
//             <h3 className="bempty-title">{creators.length === 0 ? "No creators yet" : "No matches"}</h3>
//             <p className="bempty-sub">{creators.length === 0 ? "Creators will appear here once they register." : "Try clearing filters to see all creators"}</p>
//           </div>
//         ) : (
//           <div className="bgrid">
//             {filtered.map(creator => {
//               const id            = creator._id;
//               const status        = connectStatus[id] || "none";
//               const isConn        = connecting === id;
//               const img           = gImg(creator);
//               const isAccepted    = status === "accepted";
//               const isPending     = status === "pending";
//               const creatorUserId = (creator as any).user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlockingEmail = unlocking === `email_${id}`;
//               const { first, last } = splitName(gName(creator));

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
//                   {isAccepted && <div className="cc-badge cc-badge-ok">✓ Connected</div>}
//                   {isPending  && <div className="cc-badge cc-badge-pend">⏳ Pending</div>}

//                   <div className="cc-top">
//                     {img
//                       ? <img src={img} alt={first} className="cc-av" />
//                       : <div className="cc-avph">{first.charAt(0).toUpperCase()}</div>
//                     }
//                     {/* First name visible, last name blurred */}
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 3, textAlign: "center" }}>
//                       {first}
//                       {last && <> <span style={{ filter: "blur(5px)", userSelect: "none", display: "inline-block" }}>{last}</span></>}
//                     </div>
//                     {gCity(creator) && <div className="cc-city">📍 {cap(gCity(creator))}</div>}
//                     {gCats(creator).length > 0 && (
//                       <div className="cc-cats">
//                         {gCats(creator).slice(0, 3).map((c, idx) => (
//                           <span key={idx} className="cc-cat">{em[c.toLowerCase()] || "✨"} {cap(c)}</span>
//                         ))}
//                       </div>
//                     )}
//                     <div className="cc-lock">🔒 Last name & contacts hidden</div>
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
//                           <button className="cbtn-profile" onClick={() => setModalCreator(creator)}>👤 View Profile</button>
//                           <button className="cbtn-chat" onClick={() => router.push(`/messages?with=${id}`)} title="Open Chat">💬</button>
//                           {emailUnlocked ? (
//                             <button className="cbtn-unlock" title={`Email: ${emailUnlocked}`} style={{ fontSize: 11, cursor: "default" }} disabled>📧</button>
//                           ) : (
//                             <button className="cbtn-unlock" title="Unlock Email (50 tokens)" disabled={isUnlockingEmail} onClick={() => handleUnlockEmail(id, creatorUserId)}>
//                               {isUnlockingEmail ? "⏳" : "🔓"}
//                             </button>
//                           )}
//                         </>
//                       ) : isPending ? (
//                         <button className="cbtn-pending" disabled>⏳ Request Sent — Awaiting Acceptance</button>
//                       ) : (
//                         <button className="cbtn-connect" onClick={() => setModalCreator(creator)} disabled={isConn}>
//                           {isConn ? "Sending..." : "🤝 Connect — Free"}
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
//   const [modalCreator, setModalCreator] = useState<Creator | null>(null);

//   // ── NEW: Unlock state ──
//   const [unlockedEmails, setUnlockedEmails] = useState<Record<string, string>>({});
//   const [unlocking, setUnlocking] = useState<string | null>(null);

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

//   // ── NEW: Unlock contact handler ──
//   const handleUnlock = async (creatorProfileId: string, creatorUserId: string) => {
//     if (unlockedEmails[creatorProfileId] || unlocking === creatorProfileId) return;
//     setUnlocking(creatorProfileId);
//     try {
//       const res = await fetch(`${API}/contact/unlock`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ influencerId: creatorUserId }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         alert(data.message || "Failed to unlock contact");
//         return;
//       }
//       setUnlockedEmails(prev => ({ ...prev, [creatorProfileId]: data.email }));
//     } catch {
//       alert("Something went wrong. Please try again.");
//     } finally {
//       setUnlocking(null);
//     }
//   };

//   // ── Helper functions ──
//   const gName      = (c: Creator) => c.name || "Creator";
//   const gBio       = (c: Creator) => c.bio || "";
//   const gImg       = (c: Creator) => c.profileImage || null;
//   const gCats      = (c: Creator) => (Array.isArray(c.categories) ? c.categories : [c.categories as string]).filter(Boolean);
//   const gCity      = (c: Creator) => c.city || c.location || "";
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
//         .cbtn-unlock{width:42px;height:42px;border-radius:11px;border:1.5px solid #bbf7d0;background:#f0fdf4;color:#16a34a;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;flex-shrink:0;font-family:'Plus Jakarta Sans',sans-serif}
//         .cbtn-unlock:hover:not(:disabled){background:#16a34a;color:#fff;transform:scale(1.05)}
//         .cbtn-unlock:disabled{opacity:0.6;cursor:not-allowed}

//         .cc-badge{position:absolute;top:12px;right:12px;font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px}
//         .cc-badge-ok{background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0}
//         .cc-badge-pend{background:#fffbeb;color:#d97706;border:1px solid #fde68a}

//         .cc-name-blur{font-size:16px;font-weight:800;color:#111;margin-bottom:3px}
//         .cc-blur-text{filter:blur(5px);user-select:none;pointer-events:none}
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

//         .mo-lock-banner{background:#faf5ff;border:1.5px solid #ddd6fe;border-radius:14px;padding:14px 16px;margin-bottom:18px;text-align:center}
//         .mo-lock-title{font-size:14px;font-weight:700;color:#7c3aed;margin-bottom:4px}
//         .mo-lock-sub{font-size:12px;color:#9ca3af;line-height:1.5}

//         .mo-blur{filter:blur(6px);user-select:none;pointer-events:none;display:inline-block}
//         .mo-hidden-link{filter:blur(6px);user-select:none;pointer-events:none;font-size:13px;color:#4f46e5}

//         /* Unlock email row in modal */
//         .mo-unlock-row{cursor:pointer;transition:background 0.15s;border-radius:8px;padding:10px 6px!important;margin:0 -6px}
//         .mo-unlock-row:hover{background:#f0fdf4}
//         .mo-email-value{color:#16a34a;font-weight:600;word-break:break-all}
//       `}</style>

//       {/* ── MODAL ── */}
//       {modalCreator && (() => {
//         const id = modalCreator._id;
//         const status = connectStatus[id] || "none";
//         const isAccepted = status === "accepted";
//         const isPending  = status === "pending";
//         const isConn = connecting === id;
//         const creatorUserId = (modalCreator as any).user || id;
//         const emailUnlocked = unlockedEmails[id];
//         const isUnlocking = unlocking === id;

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

//                 {gBio(modalCreator) && (
//                   <div className="mo-bio">{gBio(modalCreator)}</div>
//                 )}

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

//                 <div className="mo-info">
//                   {gCity(modalCreator) && (
//                     <div className="mo-row"><span>📍</span><span>{cap(gCity(modalCreator))}</span></div>
//                   )}
//                   {gCats(modalCreator).length > 0 && (
//                     <div className="mo-row"><span>🎯</span><span>{gCats(modalCreator).map(cap).join(", ")}</span></div>
//                   )}
//                   {(modalCreator as any).phone && (
//                     <div className="mo-row">
//                       <span>📞</span>
//                       {isAccepted
//                         ? <span>{(modalCreator as any).phone}</span>
//                         : <span>{String((modalCreator as any).phone).slice(0, 3)}XXXXXXX</span>
//                       }
//                     </div>
//                   )}
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

//                   {/* ── Email unlock row ── */}
//                   {emailUnlocked ? (
//                     <div className="mo-row">
//                       <span>📧</span>
//                       <span className="mo-email-value">{emailUnlocked}</span>
//                     </div>
//                   ) : (
//                     <div
//                       className="mo-row mo-unlock-row"
//                       onClick={() => handleUnlock(id, creatorUserId)}
//                     >
//                       <span>📧</span>
//                       <span style={{color:"#7c3aed",fontWeight:600}}>
//                         {isUnlocking ? "⏳ Unlocking..." : "🔓 Unlock Email (50 bits)"}
//                       </span>
//                     </div>
//                   )}

//                   {modalCreator.createdAt && (
//                     <div className="mo-row">
//                       <span>📅</span>
//                       <span>Joined {new Date(modalCreator.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</span>
//                     </div>
//                   )}
//                 </div>

//                 {!isAccepted && (
//                   <div className="mo-lock-banner">
//                     <div className="mo-lock-title">🔒 Connect to unlock full profile</div>
//                     <div className="mo-lock-sub">
//                       Full name, follower count & Instagram link will be visible once the creator accepts your request.
//                     </div>
//                   </div>
//                 )}

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
//               const creatorUserId = (creator as any).user || id;
//               const emailUnlocked = unlockedEmails[id];
//               const isUnlocking = unlocking === id;

//               return (
//                 <div key={id} className="cc" onClick={() => setModalCreator(creator)}>
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

//                           {/* ── Unlock Email button ── */}
//                           {emailUnlocked ? (
//                             <button
//                               className="cbtn-unlock"
//                               title={`Email: ${emailUnlocked}`}
//                               style={{fontSize:"11px",cursor:"default"}}
//                               disabled
//                             >
//                               📧
//                             </button>
//                           ) : (
//                             <button
//                               className="cbtn-unlock"
//                               title="Unlock Email (50 bits)"
//                               disabled={isUnlocking}
//                               onClick={() => handleUnlock(id, creatorUserId)}
//                             >
//                               {isUnlocking ? "⏳" : "🔓"}
//                             </button>
//                           )}
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



