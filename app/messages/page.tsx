"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API = "https://api.collabzy.in/api";
const SOCKET_URL = "https://api.collabzy.in";

const BANNED_KEYWORDS = [
  "whatsapp","number","send me you ph no","whatsapp number","wp number","wapp",
  "phone number","phone no","phoneno","my number","call me","give number","contact number",
  "instagram id","instagram handle","insta id","insta handle","dm me","send dm","dm kar",
  "telegram","signal app","snapchat","kik",
  "email id","gmail","yahoo mail","direct mail","mail karo","mail me",
  "outside platform","off platform","direct deal","bypass platform","platform ke bahar",
  "contact me","reach me","connect outside","talk outside","bahar baat","bahar deal",
];

const WARNING_TEXT = "Please keep all communication inside the platform. Sharing contact info or moving deals off-platform may result in account suspension.";

const FOLLOWER_LABELS: Record<string, string> = {
  "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
  "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
};

function detectBannedKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of BANNED_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

const msgChannel = typeof window !== "undefined" ? new BroadcastChannel("msg_unread") : null;

// ✅ CENTRAL SYNC — localStorage + BroadcastChannel + CustomEvent ek saath
function syncMsgCount(count: number) {
  localStorage.setItem("msg_unread_count", String(count));
  msgChannel?.postMessage({ type: "msg_unread_update", count });
  window.dispatchEvent(new CustomEvent("msg_unread_update", { detail: { count } }));
}

function MessagesInner() {
  const searchParams = useSearchParams();

  const [token, setToken]                   = useState<string>("");
  const [myId, setMyId]                     = useState<string>("");
  const [conversations, setConversations]   = useState<any[]>([]);
  const [activeConv, setActiveConv]         = useState<any>(null);
  const [messages, setMessages]             = useState<any[]>([]);
  const [newMsg, setNewMsg]                 = useState("");
  const [sending, setSending]               = useState(false);
  const [loadingConvs, setLoadingConvs]     = useState(true);
  const [showSidebar, setShowSidebar]       = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showDp, setShowDp]                 = useState(false);
  const [unreadCounts, setUnreadCounts]     = useState<Record<string, number>>({});
  const [bannedWord, setBannedWord]         = useState<string | null>(null);
  const [showWarning, setShowWarning]       = useState(false);

  const socketRef            = useRef<Socket | null>(null);
  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const activeConvRef        = useRef<any>(null);
  const inputRef             = useRef<HTMLInputElement>(null);
  const fetchedConversations = useRef(false);
  const myIdRef              = useRef<string>("");
  const tokenRef             = useRef<string>("");
  const profileOpenRef       = useRef(false);
  // ✅ Ref — socket closure mein stale nahi hoga
  const unreadCountsRef      = useRef<Record<string, number>>({});

  // ✅ HELPER — state + ref + navbar teenon ek saath update
  const updateUnreadCounts = (
    updater: (prev: Record<string, number>) => Record<string, number>
  ) => {
    setUnreadCounts(prev => {
      const updated = updater(prev);
      unreadCountsRef.current = updated;
      const total = Object.values(updated).reduce((a, b) => a + b, 0);
      syncMsgCount(total);
      return updated;
    });
  };

  /* ── AUTH ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cbUser = localStorage.getItem("cb_user");
    if (cbUser) {
      const parsed = JSON.parse(cbUser);
      const tok = parsed.token || parsed.accessToken || "";
      setToken(tok); tokenRef.current = tok;
      const id = parsed.id || parsed._id || parsed.user?._id || parsed.user?.id || "";
      const idStr = id.toString();
      setMyId(idStr); myIdRef.current = idStr;
      return;
    }
    const t = localStorage.getItem("token") || "";
    const u = localStorage.getItem("user");
    setToken(t); tokenRef.current = t;
    if (u) {
      const parsed = JSON.parse(u);
      const id = parsed._id || parsed.id || parsed.user?._id || "";
      const idStr = id.toString();
      setMyId(idStr); myIdRef.current = idStr;
    }
  }, []);

  /* ── Mobile back button ── */
  useEffect(() => {
    if (!activeConv) return;
    window.history.pushState({ chatOpen: true }, "");
    const handlePopState = () => {
      setShowSidebar(true);
      setActiveConv(null); activeConvRef.current = null;
      setMessages([]); setBannedWord(null); setShowWarning(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeConv]);

  /* ── SOCKET ── */
// useEffect(() => {
//   if (!token || socketRef.current) return;

//   const socket = io(SOCKET_URL, {
//     transports: ["websocket"], // ✅ better than polling
//     auth: { token },
//   });

//   socketRef.current = socket;

//   socket.on("connect", () => {
//     if (myIdRef.current) {
//       socket.emit("join", myIdRef.current);
//     }
//   });

//   socket.on("newMessage", (msg: any) => {
//     const conv = activeConvRef.current;
//     const msgConvId = (msg.conversationId || msg.conversation)?.toString();

//     // ✅ active chat
//     if (conv && msgConvId === conv._id?.toString()) {
//       setMessages(prev => {
//         // 🔥 duplicate prevent
//         if (prev.some(m => m._id === msg._id)) return prev;

//         return [...prev, msg];
//       });
//     } else {
//       // ✅ unread count
//       updateUnreadCounts(prev => ({
//         ...prev,
//         [msgConvId]: (prev[msgConvId] || 0) + 1
//       }));
//     }
//   });

//   return () => {
//     socket.disconnect();
//     socketRef.current = null;
//   };
// }, [token]);


useEffect(() => {
  if (!token || socketRef.current) return;

  const socket = io(SOCKET_URL, {
    transports: ["websocket"],
    auth: { token },
  });

  socketRef.current = socket;

  socket.on("connect", () => {
    if (myIdRef.current) {
      socket.emit("join", myIdRef.current);
    }
  });

  // ✅ YAHI PE LAGAYA
  socket.on("newMessage", (msg) => {
     console.log("🔥 NEW MESSAGE RECEIVED:", msg);
    const conv = activeConvRef.current;
    const msgConvId = (msg.conversationId || msg.conversation)?.toString();

    if (conv && msgConvId === conv._id?.toString()) {
      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    } else {
      updateUnreadCounts(prev => ({
        ...prev,
        [msgConvId]: (prev[msgConvId] || 0) + 1
      }));
    }
  });

  return () => {
    socket.disconnect();
    socketRef.current = null;
  };
}, [token]);


  // useEffect(() => {
  //   if (!token || socketRef.current) return;
  //   if (!myId && !myIdRef.current) return;

  //   const socket = io(SOCKET_URL, { transports: ["polling"], auth: { token } });
  //   socketRef.current = socket;

  //   socket.on("connect", () => {
  //     if (myIdRef.current) socket.emit("join", myIdRef.current);
  //   });

  //   socket.on("newMessage", (msg: any) => {
  //     const conv      = activeConvRef.current;
  //     const msgConvId = (msg.conversationId || msg.conversation)?.toString();
  //     const senderId  = (msg.sender?._id || msg.sender)?.toString();
  //     const isMe      = senderId === myIdRef.current;

  //     if (conv && msgConvId === conv._id?.toString()) {
  //       // Active conversation — message seedha add karo
  //       if (!isMe) {
  //         setMessages(prev =>
  //           prev.some(m => m._id === msg._id) ? prev : [...prev, msg]
  //         );
  //       } else {
  //         setMessages(prev => {
  //           const hasReal = prev.some(m => m._id === msg._id);
  //           if (hasReal) return prev;
  //           const tempIdx = [...prev].reverse().findIndex(m => m._temp === true);
  //           if (tempIdx !== -1) {
  //             const realIdx = prev.length - 1 - tempIdx;
  //             const updated = [...prev];
  //             updated[realIdx] = { ...msg };
  //             return updated;
  //           }
  //           return [...prev, msg];
  //         });
  //       }
  //       // Sidebar last message update
  //       setConversations(prev =>
  //         prev.map(c =>
  //           c._id?.toString() === msgConvId
  //             ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
  //             : c
  //         )
  //       );
  //     } else if (!isMe && msgConvId) {
  //       // ✅ Background conv — count badhao + syncMsgCount ZAROOR call karo
  //       const currentCounts = unreadCountsRef.current;
  //       const updated: Record<string, number> = {
  //         ...currentCounts,
  //         [msgConvId]: (currentCounts[msgConvId] || 0) + 1,
  //       };
  //       unreadCountsRef.current = updated;
  //       setUnreadCounts(updated);

  //       // ✅ YAHI WOH LINE THI JO MISSING THI — navbar live update
  //       const total = Object.values(updated).reduce((a, b) => a + b, 0);
  //       syncMsgCount(total);

  //       // Conversation list top pe le jao
  //       setConversations(prev => {
  //         const idx = prev.findIndex(c => c._id?.toString() === msgConvId);
  //         if (idx === -1) return prev;
  //         const arr = [...prev];
  //         const [moved] = arr.splice(idx, 1);
  //         return [{ ...moved, lastMessage: msg.text, updatedAt: msg.createdAt }, ...arr];
  //       });
  //     }
  //   });

  //   return () => { socket.disconnect(); socketRef.current = null; };
  // }, [token]);

  /* ── LOAD CONVERSATIONS ── */
  useEffect(() => {
    if (!token || fetchedConversations.current) return;
    fetchedConversations.current = true;
    setLoadingConvs(true);

    fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const rawConvs = data?.data || data?.conversations || data || [];
        const seen = new Set<string>();
        const convs = rawConvs.filter((c: any) => {
          const parts   = c.participants || [];
          const otherId = parts.find((p: any) => (p?._id || p)?.toString() !== myIdRef.current);
          const key     = (otherId?._id || otherId || c._id)?.toString();
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
        convs.sort((a: any, b: any) =>
          new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        );
        setConversations(convs);

        const counts: Record<string, number> = {};
        convs.forEach((c: any) => {
          const uc = c.unreadCount ?? c.unread ?? c.unreadCounts?.[myIdRef.current] ?? 0;
          if (uc > 0) counts[c._id] = uc;
        });

        unreadCountsRef.current = counts;
        setUnreadCounts(counts);
        // ✅ Page load pe navbar sync
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        syncMsgCount(total);

        const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
        const targetCampId = searchParams?.get("campaignId") || searchParams?.get("campaign");

        if (targetUserId) {
          const matched = convs.find((c: any) =>
            c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
          );
          if (matched) {
            setActiveConv(matched); activeConvRef.current = matched;
            setShowSidebar(false);
            updateUnreadCounts(prev => { const n = { ...prev }; delete n[matched._id]; return n; });
          } else {
            const body: any = { participantId: targetUserId };
            if (targetCampId) body.campaignId = targetCampId;
            fetch(`${API}/conversations/create`, {
              method: "POST",
              headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }).then(r => r.json()).then(newData => {
              const newConv = newData?.data || newData?.conversation || newData;
              if (newConv?._id) {
                setConversations(prev => [newConv, ...prev]);
                setActiveConv(newConv); activeConvRef.current = newConv;
                setShowSidebar(false);
              }
            }).catch(console.error);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingConvs(false));
  }, [token]);

  /* ── LOAD MESSAGES + POLLING ── */

  useEffect(() => {
  if (!token || !activeConv?._id) return;

  activeConvRef.current = activeConv;
  const convId = activeConv._id;

  const loadMessages = async () => {
    try {
      const res = await fetch(`${API}/conversations/messages/${convId}`, {
        headers: { Authorization: `Bearer ${tokenRef.current || token}` },
      });

      const data = await res.json();
      const incoming = data?.data || [];

      if (incoming.length > 0) {
        setMessages(() => incoming); // ✅ always fresh replace (no duplicate)
      }

      // unread clear
      updateUnreadCounts(prev => {
        if (!prev[convId]) return prev;
        const updated = { ...prev };
        delete updated[convId];
        return updated;
      });

    } catch (err) {
      console.error(err);
    }
  };

  loadMessages(); // ✅ only once on open

}, [activeConv?._id, token]);
  // useEffect(() => {
  //   if (!token || !activeConv) return;
  //   activeConvRef.current = activeConv;
  //   const convId = activeConv._id;

  //   const loadMessages = () => {
  //     fetch(`${API}/conversations/messages/${convId}`, {
  //       headers: { Authorization: `Bearer ${tokenRef.current || token}` },
  //     }).then(r => r.json()).then(data => {
  //       const incoming = data?.data || [];
  //       if (incoming.length > 0) {
  //         setMessages(prev => {
  //           if (incoming.length === prev.filter(m => !m._temp).length) return prev;
  //           return incoming;
  //         });
  //       }
  //       // Read hone pe count hatao + navbar sync
  //       updateUnreadCounts(prev => {
  //         if (!prev[convId]) return prev;
  //         const updated = { ...prev };
  //         delete updated[convId];
  //         return updated;
  //       });
  //     }).catch(console.error);
  //   };

  //   loadMessages();
  //   const poll = setInterval(loadMessages, 30000);
  //   return () => clearInterval(poll);
  // }, [activeConv?._id, token]);

  /* ── AUTO SCROLL ── */
  useEffect(() => {
    if (profileOpenRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── HELPERS ── */
  const getOtherParticipant = (conv: any) => {
    if (!conv?.participants) return null;
    const id = myId || myIdRef.current;
    if (!id) return conv.participants[0] || null;
    const other = conv.participants.find((p: any) => (p?._id || p)?.toString() !== id);
    return other || conv.participants[0] || null;
  };
  const getName = (p: any): string => {
    if (!p || typeof p === "string") return "User";
    return p.name || p.fullName || p.username || p.displayName || p.email?.split("@")[0] || "User";
  };
  const getAvatar = (p: any): string => {
    if (!p || typeof p === "string") return "";
    return p.profileImage || p.profilePicture || p.avatar || p.photo || p.image || p.picture || "";
  };
  const getInitial    = (p: any) => getName(p).charAt(0).toUpperCase();
  const formatTime    = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    if (Date.now() - d.getTime() < 86400000)
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
  };
  const formatMsgTime = (date: string) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const fmtFollowers  = (f: any) => {
    if (!f && f !== 0) return "—";
    const key = String(f);
    if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
    const num = Number(f);
    if (isNaN(num)) return String(f);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return Math.floor(num / 1000) + "K";
    return String(num);
  };

  const handleInputChange = (val: string) => {
    setNewMsg(val);
    const kw = detectBannedKeyword(val);
    if (kw) { setBannedWord(kw); setShowWarning(true); }
    else    { setBannedWord(null); setShowWarning(false); }
  };

  /* ── SEND ── */
  const sendMessage = async () => {
    if (!newMsg.trim() || sending || !activeConv) return;
    if (bannedWord) {
      setShowWarning(true);
      inputRef.current?.classList.add("shake");
      setTimeout(() => inputRef.current?.classList.remove("shake"), 500);
      return;
    }
    const text = newMsg.trim();
    const tempId = `temp_${Date.now()}`;
    setMessages(prev => [...prev, {
      _id: tempId, text,
      sender: myIdRef.current || myId,
      conversationId: activeConv._id,
      createdAt: new Date().toISOString(),
      _temp: true,
    }]);
    setNewMsg(""); setBannedWord(null); setShowWarning(false);
    inputRef.current?.focus();
    try {
      setSending(true);
      const res  = await fetch(`${API}/conversations/send/${activeConv._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data?.success && data?.data) {
        setMessages(prev => prev.map(m => m._id === tempId ? { ...data.data } : m));
        setConversations(prev =>
          prev.map(c => c._id === activeConv._id
            ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() } : c
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setNewMsg(text);
    } finally { setSending(false); }
  };

  const openConv = (conv: any) => {
    setActiveConv(conv); activeConvRef.current = conv;
    setShowSidebar(false);
    setBannedWord(null); setShowWarning(false);
      socketRef.current?.emit("joinConversation", conv._id);
    updateUnreadCounts(prev => { const u = { ...prev }; delete u[conv._id]; return u; });
    fetch(`${API}/conversations/read/${conv._id}`, {
      method: "POST", headers: { Authorization: `Bearer ${tokenRef.current}` },
    }).catch(() => {});
  };

  const handleProfileClick = async () => {
    const other = activeConv ? getOtherParticipant(activeConv) : null;
    if (!other) return;
    const userId = (other?._id || other)?.toString();
    profileOpenRef.current = true;
    if (!userId || typeof userId !== "string" || userId.length < 10) {
      setSelectedProfile(other); return;
    }
    setProfileLoading(true);
    try {
      const res  = await fetch(`${API}/profile/user/${userId}`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      const data = await res.json();
      setSelectedProfile(data?.profile || data?.data || (data?._id ? data : null) || other);
    } catch { setSelectedProfile(other); }
    setProfileLoading(false);
  };

  const closeProfile = () => { setSelectedProfile(null); profileOpenRef.current = false; };

  const activeOther = activeConv ? getOtherParticipant(activeConv) : null;
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const grouped = messages.reduce((acc: any[], msg, i) => {
    const currDate = new Date(msg.createdAt).toDateString();
    const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
    if (currDate !== prevDate) {
      acc.push({
        type: "date",
        label: currDate === new Date().toDateString() ? "Today"
          : new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }),
      });
    }
    acc.push({ type: "msg", ...msg });
    return acc;
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root { --primary:#4f46e5; --bg:#f0f2f5; --border:#e9edef; --text1:#111b21; --text2:#667781; --badge:#25d366; }
        .wa-root { display:flex; height:100dvh; font-family:'Plus Jakarta Sans',sans-serif; background:var(--bg); overflow:hidden; }
        .wa-sidebar { width:380px; min-width:380px; background:#fff; border-right:1px solid var(--border); display:flex; flex-direction:column; transition:transform 0.3s ease; z-index:10; }
        .wa-sidebar-hdr { background:#f0f2f5; padding:14px 16px; display:flex; align-items:center; justify-content:space-between; height:60px; }
        .wa-sidebar-title { font-size:19px; font-weight:700; color:var(--text1); }
        .wa-total-badge { background:var(--badge); color:#fff; font-size:11px; font-weight:700; padding:2px 8px; border-radius:100px; min-width:20px; text-align:center; }
        .wa-search-bar { padding:8px 12px; border-bottom:1px solid var(--border); }
        .wa-search-wrap { position:relative; }
        .wa-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); font-size:13px; color:var(--text2); }
        .wa-search-inp { width:100%; background:#f0f2f5; border:none; border-radius:8px; padding:8px 12px 8px 34px; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; outline:none; color:var(--text1); }
        .wa-conv-list { flex:1; overflow-y:auto; }
        .wa-conv-list::-webkit-scrollbar { width:3px; }
        .wa-conv-list::-webkit-scrollbar-thumb { background:#ccc; border-radius:2px; }
        .wa-conv-item { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; border-bottom:1px solid #f5f6f6; transition:background 0.15s; }
        .wa-conv-item:hover { background:#f5f6f6; }
        .wa-conv-item.active { background:#f0f2f5; }
        .wa-conv-item.unread .wa-conv-name { font-weight:700; color:#111; }
        .wa-conv-item.unread .wa-conv-last { font-weight:600; color:#111; }
        .wa-conv-av { width:49px; height:49px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:19px; font-weight:700; color:#fff; overflow:hidden; flex-shrink:0; }
        .wa-conv-av img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        .wa-conv-info { flex:1; min-width:0; }
        .wa-conv-top { display:flex; align-items:center; justify-content:space-between; margin-bottom:3px; }
        .wa-conv-name { font-size:15px; font-weight:600; color:var(--text1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px; }
        .wa-conv-time { font-size:11px; color:var(--text2); }
        .wa-conv-time.unread-time { color:var(--badge); font-weight:600; }
        .wa-conv-bottom { display:flex; align-items:center; justify-content:space-between; gap:8px; }
        .wa-conv-last { font-size:13px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }
        .wa-unread-badge { background:var(--badge); color:#fff; font-size:11px; font-weight:700; min-width:20px; height:20px; border-radius:100px; display:flex; align-items:center; justify-content:center; padding:0 5px; flex-shrink:0; animation:badgePop 0.2s ease; }
        @keyframes badgePop { from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1} }
        .wa-conv-empty { padding:40px 20px; text-align:center; color:var(--text2); font-size:14px; }
        .wa-chat { flex:1; display:flex; flex-direction:column; min-width:0; background:#efeae2; position:relative; }
        .wa-chat::before { content:''; position:absolute; inset:0; opacity:0.08; background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events:none; z-index:0; }
        .wa-chat-hdr { background:#fff; display:flex; align-items:center; height:60px; border-bottom:1px solid var(--border); position:relative; z-index:2; }
        .wa-back-btn { display:none; background:none; border:none; cursor:pointer; padding:0 6px; align-items:center; justify-content:center; min-width:44px; min-height:44px; flex-shrink:0; -webkit-tap-highlight-color:transparent; }
        .wa-chat-av { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; color:#fff; overflow:hidden; flex-shrink:0; }
        .wa-chat-av img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        .wa-safe-chip { margin-left:auto; display:flex; align-items:center; gap:5px; padding:4px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:100px; font-size:11px; font-weight:600; color:#166634; flex-shrink:0; margin-right:12px; }
        .wa-messages { flex:1; overflow-y:auto; padding:12px 8%; display:flex; flex-direction:column; gap:2px; position:relative; z-index:1; }
        .wa-messages::-webkit-scrollbar { width:3px; }
        .wa-messages::-webkit-scrollbar-thumb { background:#ccc; border-radius:2px; }
        .wa-date-lbl { text-align:center; margin:8px 0; }
        .wa-date-lbl span { background:#e1f2fb; color:#54656f; font-size:11.5px; font-weight:600; padding:4px 12px; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.08); }
        .wa-bwrap { display:flex; margin-bottom:1px; }
        .wa-bwrap.me { justify-content:flex-end; }
        .wa-bwrap.them { justify-content:flex-start; }
        .wa-bubble { max-width:65%; padding:7px 10px 5px; border-radius:8px; font-size:14px; line-height:1.5; position:relative; box-shadow:0 1px 2px rgba(0,0,0,0.1); word-break:break-word; color:#111b21 !important; }
        .wa-bubble.me { background:#dcf8c6; border-top-right-radius:2px; }
        .wa-bubble.them { background:#ffffff; border-top-left-radius:2px; }
        .wa-bubble.temp { opacity:0.75; }
        .wa-bubble.flagged { border:2px solid #fbbf24 !important; background:#fffbeb !important; }
        .wa-tail-me { position:absolute; top:0; right:-8px; width:0; height:0; border-left:8px solid #dcf8c6; border-bottom:8px solid transparent; }
        .wa-tail-them { position:absolute; top:0; left:-8px; width:0; height:0; border-right:8px solid #ffffff; border-bottom:8px solid transparent; }
        .wa-bmeta { display:flex; align-items:center; justify-content:flex-end; gap:3px; margin-top:2px; }
        .wa-btime { font-size:10.5px; color:#667781; }
        .wa-tick { font-size:11px; color:#53bdeb; }
        .wa-tick.pending { color:#aaa; }
        .wa-flagged-label { font-size:10px; font-weight:700; color:#d97706; margin-bottom:3px; }
        .wa-keyword-warning { margin:0 12px 8px; padding:10px 14px; background:#fffbeb; border:1.5px solid #fbbf24; border-radius:12px; font-size:12px; font-weight:600; color:#92400e; line-height:1.6; display:flex; gap:8px; align-items:flex-start; position:relative; z-index:2; animation:slideUpWarn 0.2s ease; }
        @keyframes slideUpWarn { from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1} }
        .wa-warn-icon { font-size:16px; flex-shrink:0; }
        .wa-warn-dismiss { margin-left:auto; font-size:14px; cursor:pointer; color:#b45309; flex-shrink:0; }
        .wa-input-bar { background:var(--bg); padding:8px 16px; display:flex; flex-direction:column; gap:6px; position:relative; z-index:2; }
        .wa-input-row { display:flex; align-items:center; gap:10px; }
        .wa-input-wrap { flex:1; background:#fff; border-radius:26px; display:flex; align-items:center; padding:9px 16px; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.06); transition:box-shadow 0.2s; }
        .wa-input-wrap.blocked { box-shadow:0 0 0 2px #ef4444; background:#fff5f5; }
        .wa-input { flex:1; border:none; outline:none; font-size:15px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--text1); background:transparent; }
        .wa-send-btn { width:48px; height:48px; border-radius:50%; background:var(--primary); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.2s,transform 0.15s; box-shadow:0 2px 8px rgba(79,70,229,0.35); }
        .wa-send-btn:hover { background:#4338ca; transform:scale(1.05); }
        .wa-send-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .wa-send-btn.blocked-btn { background:linear-gradient(135deg,#ef4444,#dc2626); }
        .wa-blocked-hint { text-align:center; font-size:11px; font-weight:600; color:#ef4444; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .shake { animation:shake 0.4s ease!important; }
        .wa-no-conv { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; position:relative; z-index:1; background:#f8f9fa; border-left:1px solid var(--border); }
        .wa-no-conv-icon { font-size:56px; opacity:0.25; }
        .wa-no-conv-title { font-size:26px; font-weight:300; color:var(--text1); }
        .wa-no-conv-sub { font-size:14px; color:var(--text2); }
        .prof-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:100; display:flex; align-items:flex-start; justify-content:flex-end; animation:fadeIn 0.18s ease; }
        @keyframes fadeIn { from{opacity:0}to{opacity:1} }
        .prof-panel { width:360px; height:100dvh; background:#fff; display:flex; flex-direction:column; animation:slideRight 0.22s ease; overflow-y:auto; }
        @keyframes slideRight { from{transform:translateX(100%)}to{transform:translateX(0)} }
        .prof-cover { background:#111b21; padding:50px 24px 28px; display:flex; flex-direction:column; align-items:center; position:relative; }
        .prof-close { position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; }
        .prof-back-btn { position:absolute; top:12px; left:12px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:18px; display:none; align-items:center; justify-content:center; }
        .prof-av-big { width:120px; height:120px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:44px; font-weight:800; color:#fff; overflow:hidden; cursor:zoom-in; transition:transform 0.2s; margin-bottom:14px; border:3px solid rgba(255,255,255,0.15); }
        .prof-av-big:hover { transform:scale(1.04); }
        .prof-av-big img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        .prof-cover-name { font-size:20px; font-weight:700; color:#fff; margin-bottom:4px; text-align:center; }
        .prof-cover-role { font-size:13px; color:rgba(255,255,255,0.55); }
        .prof-section { padding:16px 20px; border-bottom:8px solid #f0f2f5; }
        .prof-sec-label { font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
        .prof-row { display:flex; align-items:flex-start; gap:16px; padding:8px 0; }
        .prof-row-icon { font-size:18px; color:var(--text2); width:22px; text-align:center; flex-shrink:0; margin-top:1px; }
        .prof-row-text { font-size:14px; color:var(--text1); line-height:1.5; }
        .prof-tag-wrap { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
        .prof-tag { padding:4px 12px; background:#eef2ff; color:var(--primary); border-radius:100px; font-size:12px; font-weight:600; }
        .prof-stats { display:grid; gap:1px; background:var(--border); border-radius:12px; overflow:hidden; }
        .prof-stat { background:#fff; padding:14px 8px; text-align:center; }
        .prof-stat-num { font-size:18px; font-weight:800; color:var(--text1); }
        .prof-stat-lbl { font-size:10px; color:var(--text2); text-transform:uppercase; letter-spacing:0.05em; margin-top:2px; }
        .dp-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.93); z-index:200; display:flex; align-items:center; justify-content:center; cursor:zoom-out; animation:fadeIn 0.18s ease; }
        .dp-img { max-width:90vw; max-height:90dvh; border-radius:50%; object-fit:cover; animation:zoomIn 0.2s ease; }
        .dp-init { width:min(80vw,80dvh); height:min(80vw,80dvh); border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:clamp(60px,15vw,140px); font-weight:800; color:#fff; animation:zoomIn 0.2s ease; }
        @keyframes zoomIn { from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spin { width:24px; height:24px; border:2.5px solid #e0e0e0; border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; }
        .spin-wrap { display:flex; justify-content:center; padding:30px; }

        @media (max-width:768px) {
          .wa-sidebar { position:fixed; inset:0; width:100% !important; min-width:unset; z-index:20; }
          .wa-sidebar.hidden { transform:translateX(-100%); }
          .wa-chat { position:fixed; inset:0; z-index:15; }
          .wa-chat.hidden { display:none !important; }
          .wa-back-btn { display:flex !important; min-width:44px !important; min-height:56px !important; flex-shrink:0 !important; }
          .wa-chat-hdr { height:64px !important; }
          .wa-bubble { max-width:82%; }
          .wa-no-conv { display:none; }
          .wa-messages { padding:12px 4%; }
          .wa-safe-chip { display:none; }
          .prof-overlay { justify-content:flex-start !important; }
          .prof-panel { width:100% !important; animation:slideUp 0.25s ease !important; }
          @keyframes slideUp { from{transform:translateY(100%)}to{transform:translateY(0)} }
          .prof-back-btn { display:flex !important; }
          .prof-close { display:none !important; }
          .prof-av-big { width:96px !important; height:96px !important; font-size:36px !important; }
          .prof-cover-name { font-size:18px !important; }
        }
        @media (min-width:769px) { .wa-back-btn { display:none !important; } }
      `}</style>

      <div className="wa-root">

        {/* ── SIDEBAR ── */}
        <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
          <div className="wa-sidebar-hdr">
            <span className="wa-sidebar-title">Messages</span>
            {totalUnread > 0 && <span className="wa-total-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </div>
          <div className="wa-search-bar">
            <div className="wa-search-wrap">
              <span className="wa-search-icon">🔍</span>
              <input className="wa-search-inp" placeholder="Search conversations" />
            </div>
          </div>
          <div className="wa-conv-list">
            {loadingConvs ? (
              <div className="spin-wrap"><div className="spin" /></div>
            ) : conversations.length === 0 ? (
              <div className="wa-conv-empty">No conversations yet</div>
            ) : conversations.map(conv => {
              const other    = getOtherParticipant(conv);
              const av       = getAvatar(other);
              const name     = getName(other);
              const unread   = unreadCounts[conv._id] || 0;
              const isActive = activeConv?._id === conv._id;
              return (
                <div
                  key={conv._id}
                  className={`wa-conv-item${isActive ? " active" : ""}${unread > 0 && !isActive ? " unread" : ""}`}
                  onClick={() => openConv(conv)}
                >
                  <div className="wa-conv-av">
                    {av ? <img src={av} alt={name} /> : getInitial(other)}
                  </div>
                  <div className="wa-conv-info">
                    <div className="wa-conv-top">
                      <span className="wa-conv-name">{name}</span>
                      <span className={`wa-conv-time${unread > 0 && !isActive ? " unread-time" : ""}`}>{formatTime(conv.updatedAt)}</span>
                    </div>
                    <div className="wa-conv-bottom">
                      <div className="wa-conv-last">{conv.lastMessage || conv.messages?.[conv.messages.length-1]?.text || "Tap to open chat"}</div>
                      {unread > 0 && !isActive && <span className="wa-unread-badge">{unread > 99 ? "99+" : unread}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── CHAT ── */}
        <div className={`wa-chat${!activeConv ? " hidden" : ""}`}>
          {activeConv ? (
            <>
              <div className="wa-chat-hdr">
                <button
                  className="wa-back-btn"
                  onClick={e => {
                    e.preventDefault(); e.stopPropagation();
                    setShowSidebar(true); setActiveConv(null); activeConvRef.current = null;
                    setMessages([]); setBannedWord(null); setShowWarning(false);
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M15 18L9 12L15 6" stroke="#111b21" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div
                  onClick={handleProfileClick}
                  style={{ display:"flex", alignItems:"center", gap:"10px", flex:1, minWidth:0, overflow:"hidden", cursor:"pointer", padding:"10px 8px", WebkitTapHighlightColor:"rgba(0,0,0,0.05)" }}
                >
                  <div className="wa-chat-av" style={{ flexShrink:0, width:42, height:42 }}>
                    {getAvatar(activeOther)
                      ? <img src={getAvatar(activeOther)} alt="dp" style={{ width:"100%", height:"100%", objectFit:"cover", borderRadius:"50%" }} />
                      : <span style={{ color:"#fff", fontWeight:800, fontSize:16 }}>{getInitial(activeOther)}</span>
                    }
                  </div>
                  <div style={{ minWidth:0, flex:1, overflow:"hidden" }}>
                    <div style={{ color:"#111b21", fontWeight:700, fontSize:"15px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:"1.2" }}>
                      {getName(activeOther)}
                    </div>
                    <div style={{ color:"#667781", fontSize:"12px", marginTop:"2px", fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {profileLoading ? "Loading..." : (activeOther?.role || "tap to view profile")}
                    </div>
                  </div>
                </div>

                <div className="wa-safe-chip">🔒 Safe</div>
              </div>

              <div className="wa-messages">
                {grouped.map((item, i) =>
                  item.type === "date" ? (
                    <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
                  ) : (() => {
                    const senderId  = (item.sender?._id || item.sender)?.toString();
                    const isMe      = myId && senderId === myId;
                    const isTemp    = item._temp === true;
                    const isFlagged = !!detectBannedKeyword(item.text || "");
                    return (
                      <div key={`${item._id}-${item.createdAt}`} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
                        <div className={`wa-bubble ${isMe ? "me" : "them"}${isTemp ? " temp" : ""}${isFlagged ? " flagged" : ""}`}>
                          {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
                          {isFlagged && <div className="wa-flagged-label">⚠️ Flagged message</div>}
                          <span style={{ color:"#111b21", fontSize:"14px" }}>{item.text}</span>
                          <div className="wa-bmeta">
                            <span className="wa-btime">{formatMsgTime(item.createdAt)}</span>
                            {isMe && <span className={`wa-tick${isTemp ? " pending" : ""}`}>{isTemp ? "🕐" : "✓✓"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {showWarning && bannedWord && (
                <div className="wa-keyword-warning">
                  <span className="wa-warn-icon">🚫</span>
                  <div><strong>Restricted word detected: "{bannedWord}"</strong><br />{WARNING_TEXT}</div>
                  <span className="wa-warn-dismiss" onClick={() => setShowWarning(false)}>✕</span>
                </div>
              )}

              <div className="wa-input-bar">
                <div className="wa-input-row">
                  <div className={`wa-input-wrap${bannedWord ? " blocked" : ""}`}>
                    <input
                      ref={inputRef}
                      className="wa-input"
                      value={newMsg}
                      onChange={e => handleInputChange(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder={bannedWord ? "⚠️ Remove restricted word to send..." : "Type a message"}
                      style={bannedWord ? { color:"#dc2626" } : undefined}
                    />
                  </div>
                  <button
                    className={`wa-send-btn${bannedWord ? " blocked-btn" : ""}`}
                    onClick={sendMessage}
                    disabled={!newMsg.trim()}
                  >
                    {bannedWord
                      ? <span style={{ fontSize:18 }}>🚫</span>
                      : <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                    }
                  </button>
                </div>
                {bannedWord && <div className="wa-blocked-hint">❌ Message blocked — remove "{bannedWord}" to continue</div>}
              </div>
            </>
          ) : (
            <div className="wa-no-conv">
              <div className="wa-no-conv-icon">💬</div>
              <div className="wa-no-conv-title">Messages</div>
              <div className="wa-no-conv-sub">Select a conversation to start chatting</div>
            </div>
          )}
        </div>
      </div>

      {selectedProfile && !showDp && (
        <div className="prof-overlay" onClick={e => { if (e.target === e.currentTarget) closeProfile(); }}>
          <div className="prof-panel">
            <div className="prof-cover">
              <button className="prof-back-btn" onClick={closeProfile}>←</button>
              <button className="prof-close" onClick={closeProfile}>✕</button>
              <div className="prof-av-big" onClick={() => setShowDp(true)}>
                {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
              </div>
              <div className="prof-cover-name">{getName(selectedProfile)}</div>
              <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
            </div>

            <div className="prof-section">
              {(() => {
                const isBrandProfile = selectedProfile?.role?.toLowerCase() === "brand";
                return (
                  <div className="prof-stats" style={{ gridTemplateColumns:`repeat(${isBrandProfile ? 2 : 3}, 1fr)` }}>
                    {!isBrandProfile && (
                      <div className="prof-stat">
                        <div className="prof-stat-num">{fmtFollowers(selectedProfile?.followers)}</div>
                        <div className="prof-stat-lbl">Followers</div>
                      </div>
                    )}
                    <div className="prof-stat">
                      <div className="prof-stat-num">{Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}</div>
                      <div className="prof-stat-lbl">Niches</div>
                    </div>
                    <div className="prof-stat">
                      <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
                      <div className="prof-stat-lbl">Platform</div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="prof-section">
              <div className="prof-sec-label">About</div>
              {selectedProfile?.bio && <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>}
              {(selectedProfile?.location || selectedProfile?.city) && <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>}
              {selectedProfile?.email && <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>}
              {selectedProfile?.platform && (
                <div className="prof-row">
                  <span className="prof-row-icon">📸</span>
                  <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color:"var(--primary)", fontSize:14, textDecoration:"none", wordBreak:"break-all" }}>{selectedProfile.platform}</a>
                </div>
              )}
              {!selectedProfile?.bio && !selectedProfile?.location && !selectedProfile?.city && !selectedProfile?.email && !selectedProfile?.platform && (
                <div style={{ fontSize:13, color:"#aaa", padding:"8px 0" }}>No additional info available</div>
              )}
            </div>

            {selectedProfile?.categories &&
              (Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).length > 0 && (
              <div className="prof-section">
                <div className="prof-sec-label">Niches</div>
                <div className="prof-tag-wrap">
                  {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
                    .filter(Boolean).map((cat: string, i: number) => <span key={i} className="prof-tag">{cat}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDp && (
        <div className="dp-overlay" onClick={() => setShowDp(false)}>
          {getAvatar(selectedProfile)
            ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
            : <div className="dp-init">{getInitial(selectedProfile)}</div>
          }
        </div>
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ display:"flex", height:"100dvh", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:28, height:28, border:"3px solid #e0e0e0", borderTopColor:"#4f46e5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <MessagesInner />
    </Suspense>
  );
}


// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { io, Socket } from "socket.io-client";

// const API = "https://api.collabzy.in/api";
// const SOCKET_URL = "https://api.collabzy.in";

// const BANNED_KEYWORDS = [
//   "whatsapp","whatsapp number","wp number","wapp",
//   "phone number","phone no","phoneno","my number","call me","give number","contact number",
//   "instagram id","instagram handle","insta id","insta handle","dm me","send dm","dm kar",
//   "telegram","signal app","snapchat","kik",
//   "email id","gmail","yahoo mail","direct mail","mail karo","mail me",
//   "outside platform","off platform","direct deal","bypass platform","platform ke bahar",
//   "contact me","reach me","connect outside","talk outside","bahar baat","bahar deal",
// ];

// const WARNING_TEXT = "Please keep all communication inside the platform. Sharing contact info or moving deals off-platform may result in account suspension.";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000": "1K – 5K", "5000": "5K – 10K", "10000": "10K – 20K",
//   "30000": "20K – 50K", "50000": "50K – 75K", "99000": "99K+",
// };

// function detectBannedKeyword(text: string): string | null {
//   const lower = text.toLowerCase();
//   for (const kw of BANNED_KEYWORDS) {
//     if (lower.includes(kw)) return kw;
//   }
//   return null;
// }

// const msgChannel = typeof window !== "undefined" ? new BroadcastChannel("msg_unread") : null;

// // ✅ CENTRAL FUNCTION: count update karo — localStorage + BroadcastChannel + CustomEvent sab ek saath
// function syncMsgCount(count: number) {
//   // localStorage mein store karo taaki navbar dusre page pe bhi padh sake
//   localStorage.setItem("msg_unread_count", String(count));
//   // BroadcastChannel — same tab ke dusre windows ke liye
//   msgChannel?.postMessage({ type: "msg_unread_update", count });
//   // CustomEvent — same tab ke navbar ke liye (MOST IMPORTANT)
//   window.dispatchEvent(new CustomEvent("msg_unread_update", { detail: { count } }));
// }

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [token, setToken]               = useState<string>("");
//   const [myId, setMyId]                 = useState<string>("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv]     = useState<any>(null);
//   const [messages, setMessages]         = useState<any[]>([]);
//   const [newMsg, setNewMsg]             = useState("");
//   const [sending, setSending]           = useState(false);
//   const [loadingConvs, setLoadingConvs] = useState(true);
//   const [showSidebar, setShowSidebar]   = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [profileLoading, setProfileLoading]   = useState(false);
//   const [showDp, setShowDp]             = useState(false);
//   const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
//   const [bannedWord, setBannedWord]     = useState<string | null>(null);
//   const [showWarning, setShowWarning]   = useState(false);

//   const socketRef            = useRef<Socket | null>(null);
//   const messagesEndRef       = useRef<HTMLDivElement>(null);
//   const activeConvRef        = useRef<any>(null);
//   const inputRef             = useRef<HTMLInputElement>(null);
//   const fetchedConversations = useRef(false);
//   const myIdRef              = useRef<string>("");
//   const tokenRef             = useRef<string>("");
//   const profileOpenRef       = useRef(false);
//   // ✅ FIX: ref taaki socket closure mein hamesha latest counts mile
//   const unreadCountsRef      = useRef<Record<string, number>>({});

//   // ✅ HELPER: unreadCounts update + ref sync + navbar sync — sab ek jagah
//   const updateUnreadCounts = (
//     updater: (prev: Record<string, number>) => Record<string, number>
//   ) => {
//     setUnreadCounts(prev => {
//       const updated = updater(prev);
//       unreadCountsRef.current = updated;
//       // Navbar ko live update bhejo
//       const total = Object.values(updated).reduce((a, b) => a + b, 0);
//       syncMsgCount(total);
//       return updated;
//     });
//   };

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const cbUser = localStorage.getItem("cb_user");
//     if (cbUser) {
//       const parsed = JSON.parse(cbUser);
//       const tok = parsed.token || parsed.accessToken || "";
//       setToken(tok);
//       tokenRef.current = tok;
//       const id = parsed.id || parsed._id || parsed.user?._id || parsed.user?.id || "";
//       const idStr = id.toString();
//       setMyId(idStr);
//       myIdRef.current = idStr;
//       return;
//     }
//     const t = localStorage.getItem("token") || "";
//     const u = localStorage.getItem("user");
//     setToken(t);
//     tokenRef.current = t;
//     if (u) {
//       const parsed = JSON.parse(u);
//       const id = parsed._id || parsed.id || parsed.user?._id || "";
//       const idStr = id.toString();
//       setMyId(idStr);
//       myIdRef.current = idStr;
//     }
//   }, []);

//   /* ── Browser back button — mobile ── */
//   useEffect(() => {
//     if (!activeConv) return;
//     window.history.pushState({ chatOpen: true }, "");
//     const handlePopState = () => {
//       setShowSidebar(true);
//       setActiveConv(null);
//       activeConvRef.current = null;
//       setMessages([]);
//       setBannedWord(null);
//       setShowWarning(false);
//     };
//     window.addEventListener("popstate", handlePopState);
//     return () => window.removeEventListener("popstate", handlePopState);
//   }, [activeConv]);

//   /* ── SOCKET ── */
//   useEffect(() => {
//     if (!token) return;
//     if (!myId && !myIdRef.current) return;
//     if (socketRef.current) return;

//     const socket = io(SOCKET_URL, { transports: ["polling"], auth: { token } });
//     socketRef.current = socket;

//     socket.on("connect", () => {
//       if (myIdRef.current) socket.emit("join", myIdRef.current);
//     });

//     socket.on("newMessage", (msg: any) => {
//       const conv      = activeConvRef.current;
//       const msgConvId = (msg.conversationId || msg.conversation)?.toString();
//       const senderId  = (msg.sender?._id || msg.sender)?.toString();
//       const isMe      = senderId === myIdRef.current;

//       if (conv && msgConvId === conv._id?.toString()) {
//         // ── Active conversation: message seedha add karo ──
//         if (!isMe) {
//           setMessages(prev =>
//             prev.some(m => m._id === msg._id) ? prev : [...prev, msg]
//           );
//         } else {
//           setMessages(prev => {
//             const hasReal = prev.some(m => m._id === msg._id);
//             if (hasReal) return prev;
//             const tempIdx = [...prev].reverse().findIndex(m => m._temp === true);
//             if (tempIdx !== -1) {
//               const realIdx = prev.length - 1 - tempIdx;
//               const updated = [...prev];
//               updated[realIdx] = { ...msg };
//               return updated;
//             }
//             return [...prev, msg];
//           });
//         }
//         // Active conv ka last message sidebar mein update karo
//         setConversations(prev =>
//           prev.map(c =>
//             c._id?.toString() === msgConvId
//               ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
//               : c
//           )
//         );
//       } else if (!isMe && msgConvId) {
//         // ── Background conversation: count badhao + navbar update karo ──
//         // ✅ KEY FIX: ref se latest counts lo (closure stale nahi hoga)
//         const currentCounts = unreadCountsRef.current;
//         const updated = {
//           ...currentCounts,
//           [msgConvId]: (currentCounts[msgConvId] || 0) + 1,
//         };
//         unreadCountsRef.current = updated;
//         setUnreadCounts(updated);

//         // ✅ Navbar ko LIVE update karo — localStorage + events
//         // const total = Object.values(updated).reduce((a, b) => a + b, 0);
//   //       const total = Object.values(updated)
//   // .reduce((a, b) => (a as number) + (b as number), 0);
//   //       syncMsgCount(total);

//   const total: number = Object.values(updated as Record<string, number>)
//   .reduce((a, b) => a + b, 0);

//         // Conversation top pe le jao
//         setConversations(prev => {
//           const idx = prev.findIndex(c => c._id?.toString() === msgConvId);
//           if (idx === -1) return prev;
//           const arr = [...prev];
//           const [moved] = arr.splice(idx, 1);
//           return [{ ...moved, lastMessage: msg.text, updatedAt: msg.createdAt }, ...arr];
//         });
//       }
//     });

//     return () => {
//       socket.disconnect();
//       socketRef.current = null;
//     };
//   }, [token]);

//   /* ── LOAD CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token || fetchedConversations.current) return;
//     fetchedConversations.current = true;
//     setLoadingConvs(true);

//     fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const rawConvs = data?.data || data?.conversations || data || [];
//         const seen = new Set<string>();
//         const convs = rawConvs.filter((c: any) => {
//           const parts   = c.participants || [];
//           const otherId = parts.find((p: any) => (p?._id || p)?.toString() !== myIdRef.current);
//           const key     = (otherId?._id || otherId || c._id)?.toString();
//           if (seen.has(key)) return false;
//           seen.add(key);
//           return true;
//         });
//         convs.sort(
//           (a: any, b: any) =>
//             new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
//         );
//         setConversations(convs);

//         const counts: Record<string, number> = {};
//         convs.forEach((c: any) => {
//           const uc = c.unreadCount ?? c.unread ?? c.unreadCounts?.[myIdRef.current] ?? 0;
//           if (uc > 0) counts[c._id] = uc;
//         });

//         if (Object.keys(counts).length > 0) {
//           unreadCountsRef.current = counts;
//           setUnreadCounts(counts);
//           // ✅ Page load pe bhi navbar sync karo
//           const total = Object.values(counts).reduce((a, b) => a + b, 0);
//           syncMsgCount(total);
//         } else {
//           // ✅ Koi unread nahi — navbar ko 0 bhejo
//           syncMsgCount(0);
//         }

//         const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
//         const targetCampId = searchParams?.get("campaignId") || searchParams?.get("campaign");

//         if (targetUserId) {
//           const matched = convs.find((c: any) =>
//             c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//           );
//           if (matched) {
//             setActiveConv(matched);
//             activeConvRef.current = matched;
//             setShowSidebar(false);
//             updateUnreadCounts(prev => { const n = { ...prev }; delete n[matched._id]; return n; });
//           } else {
//             const body: any = { participantId: targetUserId };
//             if (targetCampId) body.campaignId = targetCampId;
//             fetch(`${API}/conversations/create`, {
//               method: "POST",
//               headers: { Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json" },
//               body: JSON.stringify(body),
//             })
//               .then(r => r.json())
//               .then(newData => {
//                 const newConv = newData?.data || newData?.conversation || newData;
//                 if (newConv?._id) {
//                   setConversations(prev => [newConv, ...prev]);
//                   setActiveConv(newConv);
//                   activeConvRef.current = newConv;
//                   setShowSidebar(false);
//                 }
//               })
//               .catch(console.error);
//           }
//         }
//       })
//       .catch(console.error)
//       .finally(() => setLoadingConvs(false));
//   }, [token]);

//   /* ── LOAD MESSAGES + POLLING ── */
//   useEffect(() => {
//     if (!token || !activeConv) return;
//     activeConvRef.current = activeConv;
//     const convId = activeConv._id;

//     const loadMessages = () => {
//       fetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${tokenRef.current || token}` },
//       })
//         .then(r => r.json())
//         .then(data => {
//           const incoming = data?.data || [];
//           if (incoming.length > 0) {
//             setMessages(prev => {
//               if (incoming.length === prev.filter(m => !m._temp).length) return prev;
//               return incoming;
//             });
//           }
//           // ✅ Conv read hone pe count hatao + navbar update
//           updateUnreadCounts(prev => {
//             if (!prev[convId]) return prev;
//             const updated = { ...prev };
//             delete updated[convId];
//             return updated;
//           });
//         })
//         .catch(console.error);
//     };

//     loadMessages();
//     const poll = setInterval(loadMessages, 3000);
//     return () => clearInterval(poll);
//   }, [activeConv?._id, token]);

//   /* ── AUTO SCROLL ── */
//   useEffect(() => {
//     if (profileOpenRef.current) return;
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ── HELPERS ── */
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants) return null;
//     const id    = myId || myIdRef.current;
//     if (!id) return conv.participants[0] || null;
//     const other = conv.participants.find((p: any) => (p?._id || p)?.toString() !== id);
//     return other || conv.participants[0] || null;
//   };

//   const getName = (p: any): string => {
//     if (!p || typeof p === "string") return "User";
//     return p.name || p.fullName || p.username || p.displayName || p.email?.split("@")[0] || "User";
//   };

//   const getAvatar = (p: any): string => {
//     if (!p || typeof p === "string") return "";
//     return p.profileImage || p.profilePicture || p.avatar || p.photo || p.image || p.picture || "";
//   };

//   const getInitial    = (p: any) => getName(p).charAt(0).toUpperCase();

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d    = new Date(date);
//     const diff = Date.now() - d.getTime();
//     if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     return d.toLocaleDateString([], { day: "2-digit", month: "short" });
//   };

//   const formatMsgTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const fmtFollowers = (f: any) => {
//     if (!f && f !== 0) return "—";
//     const key = String(f);
//     if (FOLLOWER_LABELS[key]) return FOLLOWER_LABELS[key];
//     const num = Number(f);
//     if (isNaN(num)) return String(f);
//     if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
//     if (num >= 1000) return Math.floor(num / 1000) + "K";
//     return String(num);
//   };

//   const handleInputChange = (val: string) => {
//     setNewMsg(val);
//     const kw = detectBannedKeyword(val);
//     if (kw) { setBannedWord(kw); setShowWarning(true); }
//     else    { setBannedWord(null); setShowWarning(false); }
//   };

//   /* ── SEND ── */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending || !activeConv) return;
//     if (bannedWord) {
//       setShowWarning(true);
//       inputRef.current?.classList.add("shake");
//       setTimeout(() => inputRef.current?.classList.remove("shake"), 500);
//       return;
//     }
//     const text   = newMsg.trim();
//     const tempId = `temp_${Date.now()}`;
//     const tempMsg = {
//       _id: tempId, text,
//       sender: myIdRef.current || myId,
//       conversationId: activeConv._id,
//       createdAt: new Date().toISOString(),
//       _temp: true,
//     };
//     setMessages(prev => [...prev, tempMsg]);
//     setNewMsg(""); setBannedWord(null); setShowWarning(false);
//     inputRef.current?.focus();
//     try {
//       setSending(true);
//       const res  = await fetch(`${API}/conversations/send/${activeConv._id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text }),
//       });
//       const data = await res.json();
//       if (data?.success && data?.data) {
//         setMessages(prev => prev.map(m => m._id === tempId ? { ...data.data } : m));
//         setConversations(prev =>
//           prev.map(c =>
//             c._id === activeConv._id
//               ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() }
//               : c
//           )
//         );
//       }
//     } catch (err) {
//       console.error(err);
//       setMessages(prev => prev.filter(m => m._id !== tempId));
//       setNewMsg(text);
//     } finally { setSending(false); }
//   };

//   const openConv = (conv: any) => {
//     setActiveConv(conv);
//     activeConvRef.current = conv;
//     setShowSidebar(false);
//     setBannedWord(null);
//     setShowWarning(false);
//     // ✅ Conv open karte waqt count hatao + navbar sync
//     updateUnreadCounts(prev => {
//       const updated = { ...prev };
//       delete updated[conv._id];
//       return updated;
//     });
//     fetch(`${API}/conversations/read/${conv._id}`, {
//       method: "POST",
//       headers: { Authorization: `Bearer ${tokenRef.current}` },
//     }).catch(() => {});
//   };

//   const handleProfileClick = async () => {
//     const other  = activeConv ? getOtherParticipant(activeConv) : null;
//     if (!other) return;
//     const userId = (other?._id || other)?.toString();
//     profileOpenRef.current = true;
//     if (!userId || typeof userId !== "string" || userId.length < 10) {
//       setSelectedProfile(other); return;
//     }
//     setProfileLoading(true);
//     try {
//       const res  = await fetch(`${API}/profile/user/${userId}`, {
//         headers: { Authorization: `Bearer ${tokenRef.current}` },
//       });
//       const data = await res.json();
//       setSelectedProfile(data?.profile || data?.data || (data?._id ? data : null) || other);
//     } catch { setSelectedProfile(other); }
//     setProfileLoading(false);
//   };

//   const closeProfile = () => {
//     setSelectedProfile(null);
//     profileOpenRef.current = false;
//   };

//   const activeOther = activeConv ? getOtherParticipant(activeConv) : null;
//   // const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
//   const totalUnread = Object.values(unreadCounts as Record<string, number>)
//   .reduce((a, b) => a + b, 0);

//   const grouped = messages.reduce((acc: any[], msg, i) => {
//     const currDate = new Date(msg.createdAt).toDateString();
//     const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
//     if (currDate !== prevDate) {
//       const label =
//         currDate === new Date().toDateString()
//           ? "Today"
//           : new Date(msg.createdAt).toLocaleDateString([], {
//               weekday: "long", day: "numeric", month: "long",
//             });
//       acc.push({ type: "date", label });
//     }
//     acc.push({ type: "msg", ...msg });
//     return acc;
//   }, []);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         :root {
//           --primary: #4f46e5; --bg: #f0f2f5; --border: #e9edef;
//           --text1: #111b21; --text2: #667781;
//           --bubble-me: #dcf8c6; --bubble-them: #ffffff; --badge: #25d366;
//         }
//         .wa-root { display: flex; height: 100dvh; font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); overflow: hidden; position: relative; }
//         .wa-sidebar { width: 380px; min-width: 380px; background: #fff; border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: transform 0.3s ease; z-index: 10; }
//         .wa-sidebar-hdr { background: #f0f2f5; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
//         .wa-sidebar-title { font-size: 19px; font-weight: 700; color: var(--text1); }
//         .wa-total-badge { background: var(--badge); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 100px; min-width: 20px; text-align: center; }
//         .wa-search-bar { padding: 8px 12px; border-bottom: 1px solid var(--border); }
//         .wa-search-wrap { position: relative; }
//         .wa-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text2); }
//         .wa-search-inp { width: 100%; background: #f0f2f5; border: none; border-radius: 8px; padding: 8px 12px 8px 34px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; color: var(--text1); }
//         .wa-conv-list { flex: 1; overflow-y: auto; }
//         .wa-conv-list::-webkit-scrollbar { width: 3px; }
//         .wa-conv-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f5f6f6; transition: background 0.15s; position: relative; }
//         .wa-conv-item:hover { background: #f5f6f6; }
//         .wa-conv-item.active { background: #f0f2f5; }
//         .wa-conv-item.unread .wa-conv-name { font-weight: 700; color: #111; }
//         .wa-conv-item.unread .wa-conv-last { font-weight: 600; color: #111; }
//         .wa-conv-av { width: 49px; height: 49px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-conv-info { flex: 1; min-width: 0; }
//         .wa-conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
//         .wa-conv-name { font-size: 15px; font-weight: 600; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
//         .wa-conv-time { font-size: 11px; color: var(--text2); }
//         .wa-conv-time.unread-time { color: var(--badge); font-weight: 600; }
//         .wa-conv-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
//         .wa-conv-last { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
//         .wa-unread-badge { background: var(--badge); color: #fff; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 100px; display: flex; align-items: center; justify-content: center; padding: 0 5px; flex-shrink: 0; animation: badgePop 0.2s ease; }
//         @keyframes badgePop { from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1} }
//         .wa-conv-empty { padding: 40px 20px; text-align: center; color: var(--text2); font-size: 14px; }
//         .wa-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #efeae2; position: relative; }
//         .wa-chat::before { content:''; position:absolute; inset:0; opacity:0.08; background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events:none; z-index:0; }
//         .wa-chat-hdr { background:#fff; padding:10px 16px; display:flex; align-items:center; gap:12px; height:60px; border-bottom:1px solid var(--border); position:relative; z-index:2; transition:background 0.15s; }
//         .wa-back-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px 8px 4px 0; line-height: 1; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
//         .wa-chat-av { width:40px; height:40px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700; color:#fff; overflow:hidden; flex-shrink:0; }
//         .wa-chat-av img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
//         .wa-hdr-info  { flex:1; min-width:0; overflow:hidden; }
//         .wa-safe-chip { margin-left:auto; display:flex; align-items:center; gap:5px; padding:4px 12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:100px; font-size:11px; font-weight:600; color:#166634; flex-shrink:0; }
//         .wa-messages { flex:1; overflow-y:auto; padding:12px 8%; display:flex; flex-direction:column; gap:2px; position:relative; z-index:1; }
//         .wa-messages::-webkit-scrollbar { width:3px; }
//         .wa-messages::-webkit-scrollbar-thumb { background:#ccc; border-radius:2px; }
//         .wa-date-lbl { text-align:center; margin:8px 0; }
//         .wa-date-lbl span { background:#e1f2fb; color:#54656f; font-size:11.5px; font-weight:600; padding:4px 12px; border-radius:8px; box-shadow:0 1px 2px rgba(0,0,0,0.08); }
//         .wa-bwrap { display:flex; margin-bottom:1px; }
//         .wa-bwrap.me   { justify-content:flex-end; }
//         .wa-bwrap.them { justify-content:flex-start; }
//         .wa-bubble { max-width:65%; padding:7px 10px 5px; border-radius:8px; font-size:14px; line-height:1.5; position:relative; box-shadow:0 1px 2px rgba(0,0,0,0.1); word-break:break-word; color:#111b21 !important; }
//         .wa-bubble.me   { background:#dcf8c6; border-top-right-radius:2px; }
//         .wa-bubble.them { background:#ffffff; border-top-left-radius:2px; }
//         .wa-bubble.temp { opacity:0.75; }
//         .wa-bubble.flagged { border:2px solid #fbbf24 !important; background:#fffbeb !important; }
//         .wa-tail-me   { position:absolute; top:0; right:-8px; width:0; height:0; border-left:8px solid #dcf8c6; border-bottom:8px solid transparent; }
//         .wa-tail-them { position:absolute; top:0; left:-8px; width:0; height:0; border-right:8px solid #ffffff; border-bottom:8px solid transparent; }
//         .wa-bmeta { display:flex; align-items:center; justify-content:flex-end; gap:3px; margin-top:2px; }
//         .wa-btime { font-size:10.5px; color:#667781; }
//         .wa-tick { font-size:11px; color:#53bdeb; }
//         .wa-tick.pending { color:#aaa; }
//         .wa-flagged-label { font-size:10px; font-weight:700; color:#d97706; margin-bottom:3px; }
//         .wa-keyword-warning { margin:0 12px 8px; padding:10px 14px; background:#fffbeb; border:1.5px solid #fbbf24; border-radius:12px; font-size:12px; font-weight:600; color:#92400e; line-height:1.6; display:flex; gap:8px; align-items:flex-start; position:relative; z-index:2; animation:slideUpWarn 0.2s ease; }
//         @keyframes slideUpWarn { from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1} }
//         .wa-warn-icon { font-size:16px; flex-shrink:0; }
//         .wa-warn-dismiss { margin-left:auto; font-size:14px; cursor:pointer; color:#b45309; flex-shrink:0; line-height:1; padding:0 2px; }
//         .wa-input-bar { background:var(--bg); padding:8px 16px; display:flex; align-items:center; gap:10px; position:relative; z-index:2; flex-direction:column; }
//         .wa-input-row { width:100%; display:flex; align-items:center; gap:10px; }
//         .wa-input-wrap { flex:1; background:#fff; border-radius:26px; display:flex; align-items:center; padding:9px 16px; gap:10px; box-shadow:0 1px 3px rgba(0,0,0,0.06); transition:box-shadow 0.2s; }
//         .wa-input-wrap.blocked { box-shadow:0 0 0 2px #ef4444; background:#fff5f5; }
//         .wa-input { flex:1; border:none; outline:none; font-size:15px; font-family:'Plus Jakarta Sans',sans-serif; color:var(--text1); background:transparent; }
//         .wa-send-btn { width:48px; height:48px; border-radius:50%; background:var(--primary); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:background 0.2s,transform 0.15s; box-shadow:0 2px 8px rgba(79,70,229,0.35); }
//         .wa-send-btn:hover { background:#4338ca; transform:scale(1.05); }
//         .wa-send-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
//         .wa-send-btn.blocked-btn { background:linear-gradient(135deg,#ef4444,#dc2626); box-shadow:0 2px 8px rgba(239,68,68,0.35); }
//         .wa-blocked-hint { width:100%; text-align:center; font-size:11px; font-weight:600; color:#ef4444; padding:0 0 2px; }
//         @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
//         .shake { animation:shake 0.4s ease!important; }
//         .wa-no-conv { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; position:relative; z-index:1; border-left:1px solid var(--border); background:#f8f9fa; }
//         .wa-no-conv-icon  { font-size:56px; opacity:0.25; }
//         .wa-no-conv-title { font-size:26px; font-weight:300; color:var(--text1); }
//         .wa-no-conv-sub   { font-size:14px; color:var(--text2); }
//         .prof-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:100; display:flex; align-items:flex-start; justify-content:flex-end; animation:fadeIn 0.18s ease; }
//         @keyframes fadeIn { from{opacity:0}to{opacity:1} }
//         .prof-panel { width:360px; height:100dvh; background:#fff; display:flex; flex-direction:column; animation:slideRight 0.22s ease; overflow-y:auto; }
//         @keyframes slideRight { from{transform:translateX(100%)}to{transform:translateX(0)} }
//         .prof-cover { background:#111b21; padding:50px 24px 28px; display:flex; flex-direction:column; align-items:center; position:relative; }
//         .prof-close { position:absolute; top:12px; right:12px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; }
//         .prof-back-btn { position:absolute; top:12px; left:12px; background:rgba(255,255,255,0.1); border:none; color:#fff; width:34px; height:34px; border-radius:50%; cursor:pointer; font-size:18px; display:none; align-items:center; justify-content:center; }
//         .prof-av-big { width:120px; height:120px; border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:44px; font-weight:800; color:#fff; overflow:hidden; cursor:zoom-in; transition:transform 0.2s; margin-bottom:14px; border:3px solid rgba(255,255,255,0.15); }
//         .prof-av-big:hover { transform:scale(1.04); }
//         .prof-av-big img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
//         .prof-cover-name { font-size:20px; font-weight:700; color:#fff; margin-bottom:4px; text-align:center; }
//         .prof-cover-role { font-size:13px; color:rgba(255,255,255,0.55); }
//         .prof-section { padding:16px 20px; border-bottom:8px solid #f0f2f5; }
//         .prof-sec-label { font-size:12px; font-weight:700; color:var(--primary); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:10px; }
//         .prof-row { display:flex; align-items:flex-start; gap:16px; padding:8px 0; }
//         .prof-row-icon { font-size:18px; color:var(--text2); width:22px; text-align:center; flex-shrink:0; margin-top:1px; }
//         .prof-row-text { font-size:14px; color:var(--text1); line-height:1.5; }
//         .prof-tag-wrap { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
//         .prof-tag { padding:4px 12px; background:#eef2ff; color:var(--primary); border-radius:100px; font-size:12px; font-weight:600; }
//         .prof-stats { display:grid; gap:1px; background:var(--border); border-radius:12px; overflow:hidden; }
//         .prof-stat { background:#fff; padding:14px 8px; text-align:center; }
//         .prof-stat-num { font-size:18px; font-weight:800; color:var(--text1); }
//         .prof-stat-lbl { font-size:10px; color:var(--text2); text-transform:uppercase; letter-spacing:0.05em; margin-top:2px; }
//         .dp-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.93); z-index:200; display:flex; align-items:center; justify-content:center; cursor:zoom-out; animation:fadeIn 0.18s ease; }
//         .dp-img  { max-width:90vw; max-height:90dvh; border-radius:50%; object-fit:cover; animation:zoomIn 0.2s ease; }
//         .dp-init { width:min(80vw,80dvh); height:min(80vw,80dvh); border-radius:50%; background:linear-gradient(135deg,#667eea,#764ba2); display:flex; align-items:center; justify-content:center; font-size:clamp(60px,15vw,140px); font-weight:800; color:#fff; animation:zoomIn 0.2s ease; }
//         @keyframes zoomIn { from{transform:scale(0.8);opacity:0}to{transform:scale(1);opacity:1} }
//         @keyframes spin { to{transform:rotate(360deg)} }
//         .spin { width:24px; height:24px; border:2.5px solid #e0e0e0; border-top-color:var(--primary); border-radius:50%; animation:spin 0.8s linear infinite; }
//         .spin-wrap { display:flex; justify-content:center; padding:30px; }

//         @media (max-width: 768px) {
//           .wa-sidebar { position:fixed; inset:0; width:100% !important; min-width:unset; z-index:20; transform:translateX(0); transition:transform 0.3s ease; }
//           .wa-sidebar.hidden { transform:translateX(-100%); }
//           .wa-chat { position:fixed; inset:0; z-index:15; }
//           .wa-chat.hidden { display:none !important; }
//           .wa-back-btn { display:flex !important; align-items:center !important; justify-content:center !important; padding:0 6px !important; min-width:44px !important; min-height:56px !important; flex-shrink:0 !important; }
//           .wa-chat-hdr { height:64px !important; padding:0 12px 0 4px !important; }
//           .wa-bubble { max-width:82%; }
//           .wa-no-conv { display:none; }
//           .wa-messages { padding:12px 4%; }
//           .wa-safe-chip { display:none; }
//           .prof-overlay { justify-content:flex-start !important; align-items:flex-start !important; }
//           .prof-panel { width:100% !important; height:100dvh !important; animation:slideUp 0.25s ease !important; }
//           @keyframes slideUp { from{transform:translateY(100%)}to{transform:translateY(0)} }
//           .prof-back-btn { display:flex !important; }
//           .prof-close { display:none !important; }
//           .prof-av-big { width:96px !important; height:96px !important; font-size:36px !important; }
//           .prof-cover-name { font-size:18px !important; }
//         }
//         @media (min-width: 769px) {
//           .wa-back-btn { display:none !important; }
//         }
//       `}</style>

//       <div className="wa-root">

//         {/* ── SIDEBAR ── */}
//         <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
//           <div className="wa-sidebar-hdr">
//             <span className="wa-sidebar-title">Messages</span>
//             {totalUnread > 0 && (
//               <span className="wa-total-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
//             )}
//           </div>
//           <div className="wa-search-bar">
//             <div className="wa-search-wrap">
//               <span className="wa-search-icon">🔍</span>
//               <input className="wa-search-inp" placeholder="Search conversations" />
//             </div>
//           </div>
//           <div className="wa-conv-list">
//             {loadingConvs ? (
//               <div className="spin-wrap"><div className="spin" /></div>
//             ) : conversations.length === 0 ? (
//               <div className="wa-conv-empty">No conversations yet</div>
//             ) : conversations.map(conv => {
//               const other    = getOtherParticipant(conv);
//               const av       = getAvatar(other);
//               const name     = getName(other);
//               const unread   = unreadCounts[conv._id] || 0;
//               const isActive = activeConv?._id === conv._id;
//               return (
//                 <div
//                   key={conv._id}
//                   className={`wa-conv-item${isActive ? " active" : ""}${unread > 0 && !isActive ? " unread" : ""}`}
//                   onClick={() => openConv(conv)}
//                 >
//                   <div className="wa-conv-av">
//                     {av ? <img src={av} alt={name} /> : getInitial(other)}
//                   </div>
//                   <div className="wa-conv-info">
//                     <div className="wa-conv-top">
//                       <span className="wa-conv-name">{name}</span>
//                       <span className={`wa-conv-time${unread > 0 && !isActive ? " unread-time" : ""}`}>
//                         {formatTime(conv.updatedAt)}
//                       </span>
//                     </div>
//                     <div className="wa-conv-bottom">
//                       <div className="wa-conv-last">
//                         {conv.lastMessage || conv.messages?.[conv.messages.length - 1]?.text || "Tap to open chat"}
//                       </div>
//                       {unread > 0 && !isActive && (
//                         <span className="wa-unread-badge">{unread > 99 ? "99+" : unread}</span>
//                       )}
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* ── CHAT ── */}
//         <div className={`wa-chat${!activeConv ? " hidden" : ""}`}>
//           {activeConv ? (
//             <>
//               <div className="wa-chat-hdr" style={{ cursor: "default", padding: "0 12px 0 4px" }}>
//                 <button
//                   className="wa-back-btn"
//                   onClick={e => {
//                     e.preventDefault(); e.stopPropagation();
//                     setShowSidebar(true);
//                     setActiveConv(null);
//                     activeConvRef.current = null;
//                     setMessages([]);
//                     setBannedWord(null);
//                     setShowWarning(false);
//                   }}
//                 >
//                   <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
//                     <path d="M15 18L9 12L15 6" stroke="#111b21" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>

//                 <div
//                   onClick={handleProfileClick}
//                   style={{
//                     display: "flex", alignItems: "center", gap: "10px",
//                     flex: 1, minWidth: 0, overflow: "hidden",
//                     cursor: "pointer", padding: "10px 8px",
//                     WebkitTapHighlightColor: "rgba(0,0,0,0.05)",
//                   }}
//                 >
//                   <div className="wa-chat-av" style={{ flexShrink: 0, width: 42, height: 42 }}>
//                     {getAvatar(activeOther)
//                       ? <img src={getAvatar(activeOther)} alt="dp" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
//                       : <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>{getInitial(activeOther)}</span>
//                     }
//                   </div>
//                   <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
//                     <div style={{ color: "#111b21", fontWeight: 700, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: "1.2" }}>
//                       {getName(activeOther)}
//                     </div>
//                     <div style={{ color: "#667781", fontSize: "12px", marginTop: "2px", fontFamily: "'Plus Jakarta Sans', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
//                       {profileLoading ? "Loading..." : (activeOther?.role || "tap to view profile")}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="wa-safe-chip">🔒 Safe</div>
//               </div>

//               <div className="wa-messages">
//                 {grouped.map((item, i) =>
//                   item.type === "date" ? (
//                     <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
//                   ) : (() => {
//                     const senderId  = (item.sender?._id || item.sender)?.toString();
//                     const isMe      = myId && senderId === myId;
//                     const isTemp    = item._temp === true;
//                     const isFlagged = !!detectBannedKeyword(item.text || "");
//                     return (
//                       <div key={item._id || i} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
//                         <div className={`wa-bubble ${isMe ? "me" : "them"}${isTemp ? " temp" : ""}${isFlagged ? " flagged" : ""}`}>
//                           {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
//                           {isFlagged && <div className="wa-flagged-label">⚠️ Flagged message</div>}
//                           <span style={{ color: "#111b21", fontSize: "14px" }}>{item.text}</span>
//                           <div className="wa-bmeta">
//                             <span className="wa-btime">{formatMsgTime(item.createdAt)}</span>
//                             {isMe && (
//                               <span className={`wa-tick${isTemp ? " pending" : ""}`}>
//                                 {isTemp ? "🕐" : "✓✓"}
//                               </span>
//                             )}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })()
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               {showWarning && bannedWord && (
//                 <div className="wa-keyword-warning">
//                   <span className="wa-warn-icon">🚫</span>
//                   <div>
//                     <strong>Restricted word detected: "{bannedWord}"</strong><br />
//                     {WARNING_TEXT}
//                   </div>
//                   <span className="wa-warn-dismiss" onClick={() => setShowWarning(false)}>✕</span>
//                 </div>
//               )}

//               <div className="wa-input-bar">
//                 <div className="wa-input-row">
//                   <div className={`wa-input-wrap${bannedWord ? " blocked" : ""}`}>
//                     <input
//                       ref={inputRef}
//                       className="wa-input"
//                       value={newMsg}
//                       onChange={e => handleInputChange(e.target.value)}
//                       onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                       placeholder={bannedWord ? "⚠️ Remove restricted word to send..." : "Type a message"}
//                       style={bannedWord ? { color: "#dc2626" } : undefined}
//                     />
//                   </div>
//                   <button
//                     className={`wa-send-btn${bannedWord ? " blocked-btn" : ""}`}
//                     onClick={sendMessage}
//                     disabled={!newMsg.trim()}
//                     title={bannedWord ? "Cannot send" : "Send"}
//                   >
//                     {bannedWord
//                       ? <span style={{ fontSize: 18 }}>🚫</span>
//                       : <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
//                     }
//                   </button>
//                 </div>
//                 {bannedWord && (
//                   <div className="wa-blocked-hint">❌ Message blocked — remove "{bannedWord}" to continue</div>
//                 )}
//               </div>
//             </>
//           ) : (
//             <div className="wa-no-conv">
//               <div className="wa-no-conv-icon">💬</div>
//               <div className="wa-no-conv-title">Messages</div>
//               <div className="wa-no-conv-sub">Select a conversation to start chatting</div>
//             </div>
//           )}
//         </div>
//       </div>

//       {selectedProfile && !showDp && (
//         <div className="prof-overlay" onClick={e => { if (e.target === e.currentTarget) closeProfile(); }}>
//           <div className="prof-panel">
//             <div className="prof-cover">
//               <button className="prof-back-btn" onClick={closeProfile}>←</button>
//               <button className="prof-close" onClick={closeProfile}>✕</button>
//               <div className="prof-av-big" onClick={() => setShowDp(true)}>
//                 {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
//               </div>
//               <div className="prof-cover-name">{getName(selectedProfile)}</div>
//               <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
//             </div>

//             <div className="prof-section">
//               {(() => {
//                 const isBrandProfile = selectedProfile?.role?.toLowerCase() === "brand";
//                 const cols = isBrandProfile ? 2 : 3;
//                 return (
//                   <div className="prof-stats" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
//                     {!isBrandProfile && (
//                       <div className="prof-stat">
//                         <div className="prof-stat-num">{fmtFollowers(selectedProfile?.followers)}</div>
//                         <div className="prof-stat-lbl">Followers</div>
//                       </div>
//                     )}
//                     <div className="prof-stat">
//                       <div className="prof-stat-num">
//                         {Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}
//                       </div>
//                       <div className="prof-stat-lbl">Niches</div>
//                     </div>
//                     <div className="prof-stat">
//                       <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
//                       <div className="prof-stat-lbl">Platform</div>
//                     </div>
//                   </div>
//                 );
//               })()}
//             </div>

//             <div className="prof-section">
//               <div className="prof-sec-label">About</div>
//               {selectedProfile?.bio && (
//                 <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>
//               )}
//               {(selectedProfile?.location || selectedProfile?.city) && (
//                 <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>
//               )}
//               {selectedProfile?.email && (
//                 <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>
//               )}
//               {selectedProfile?.platform && (
//                 <div className="prof-row">
//                   <span className="prof-row-icon">📸</span>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 14, textDecoration: "none", wordBreak: "break-all" }}>
//                     {selectedProfile.platform}
//                   </a>
//                 </div>
//               )}
//               {!selectedProfile?.bio && !selectedProfile?.location && !selectedProfile?.city && !selectedProfile?.email && !selectedProfile?.platform && (
//                 <div style={{ fontSize: 13, color: "#aaa", padding: "8px 0" }}>No additional info available</div>
//               )}
//             </div>

//             {selectedProfile?.categories &&
//               (Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).length > 0 && (
//               <div className="prof-section">
//                 <div className="prof-sec-label">Niches</div>
//                 <div className="prof-tag-wrap">
//                   {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories])
//                     .filter(Boolean).map((cat: string, i: number) => (
//                     <span key={i} className="prof-tag">{cat}</span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {showDp && (
//         <div className="dp-overlay" onClick={() => setShowDp(false)}>
//           {getAvatar(selectedProfile)
//             ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
//             : <div className="dp-init">{getInitial(selectedProfile)}</div>
//           }
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={
//       <div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}>
//         <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }}/>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     }>
//       <MessagesInner />
//     </Suspense>
//   );
// }

