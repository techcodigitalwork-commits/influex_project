"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";   // ✅ ADDED

const API = "http://54.252.201.93:5000/api";
const SOCKET_URL = "http://54.252.201.93:5000"; // ✅ ADDED

// ✅ Safe fetch
const safeFetch = async (url: string, opts: RequestInit = {}) => {
  try {
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
    const data = JSON.parse(text);
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: null };
  }
};

function MessagesInner() {

  const router = useRouter();
  const searchParams = useSearchParams();

  const targetUserId = searchParams.get("userId");
  const targetUserName = searchParams.get("name") || "Creator";
  const targetCampaignId = searchParams.get("campaignId");

  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);

  const socketRef = useRef<Socket | null>(null); // ✅ ADDED
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ===== AUTH ===== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cb_user");
    if (!stored) { router.push("/login"); return; }

    const parsed = JSON.parse(stored);
    const t = parsed.token || localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }

    setUser(parsed);
    setToken(t);
  }, []);

  /* ===== SOCKET CONNECT ===== */
  useEffect(() => {
    if (!token || !user) return;

    socketRef.current = io(SOCKET_URL, {
      auth: { token },
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current?.id);

      const myId =
        user?.user?._id ||
        user?.user?.id ||
        user?._id ||
        user?.id;

      if (myId) {
        socketRef.current?.emit("joinRoom", myId);
      }
    });

    socketRef.current.on("newMessage", (msg: any) => {
      console.log("Realtime message:", msg);

      if (activeConv && msg.conversationId === activeConv._id) {
        setMessages(prev => [...prev, msg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });

    return () => socketRef.current?.disconnect();
  }, [token, user, activeConv]);

  /* ===== SEND MESSAGE ===== */
  const sendMessage = async () => {
    if (!newMsg.trim() || sending) return;

    try {
      setSending(true);

      const convId = activeConv?._id;
      if (!convId) return;

      await safeFetch(`${API}/conversations/send/${convId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: newMsg.trim() }),
      });

      // ✅ REALTIME SEND
      socketRef.current?.emit("sendMessage", {
        conversationId: convId,
        text: newMsg.trim(),
      });

      setNewMsg("");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{padding:40}}>
      <h2>Messages</h2>

      <div style={{height:300,overflowY:"auto",border:"1px solid #ddd",padding:10}}>
        {messages.map((m,i)=>(
          <div key={i}>{m.text}</div>
        ))}
        <div ref={bottomRef}/>
      </div>

      <input
        value={newMsg}
        onChange={e=>setNewMsg(e.target.value)}
        placeholder="Type..."
      />

      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagesInner />
    </Suspense>
  );
}




// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ✅ Safe fetch — HTML response pe crash nahi karega
// const safeFetch = async (url: string, opts: RequestInit = {}) => {
//   try {
//     const res = await fetch(url, opts);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const [profileModal, setProfileModal] = useState<any>(null);
//   const [profileFetching, setProfileFetching] = useState(false);
//   const [profileCache, setProfileCache] = useState<Record<string, any>>({});
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   // SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   // Scroll to bottom on new messages
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       // ✅ OLD working route from old code
//       const { ok, data } = await safeFetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("CONVS:", data);
//       const list = data?.data || data?.conversations || [];
//       setConversations(list);
//       if (list.length > 0 && !targetUserId) openConversation(list[0]);

//       // ✅ Har conversation ke participants ka profile fetch karo (profileImage ke liye)
//       const allParticipantIds: string[] = [];
//       list.forEach((conv: any) => {
//         (conv.participants || []).forEach((p: any) => {
//           const id = p._id?.toString() || (typeof p === "string" ? p : "");
//           if (id) allParticipantIds.push(id);
//         });
//       });
//       // Unique IDs
//       const uniqueIds = [...new Set(allParticipantIds)];
//       fetchParticipantProfiles(uniqueIds, token);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Participants ka profile fetch karke cache mein store karo
//   // Backend /profile/user/:id route se profileImage milegi
//   const fetchParticipantProfiles = async (userIds: string[], tok: string) => {
//     const cache: Record<string, any> = {};
//     await Promise.all(
//       userIds.map(async (uid) => {
//         try {
//           const { ok, data } = await safeFetch(`${API}/profile/user/${uid}`, {
//             headers: { Authorization: `Bearer ${tok}` },
//           });
//           if (ok && data) {
//             const p = data.profile || data.data || (data._id ? data : null);
//             if (p) cache[uid] = p;
//           }
//         } catch { }
//       })
//     );
//     if (Object.keys(cache).length > 0) {
//       setProfileCache(prev => ({ ...prev, ...cache }));
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const { ok, data } = await safeFetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("MESSAGES:", data);
//       if (!ok || !data) return;
//       const msgs = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.messages) ? data.messages
//         : data.conversation?.messages || [];
//       console.log("MSGS COUNT:", msgs.length);
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) { console.error("No campaignId"); return null; }
//       const { ok, data } = await safeFetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       console.log("CREATE CONV:", data);
//       const conv = data?.conversation || data?.data;
//       if (ok && conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   /* ===== SEND MESSAGE ===== */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) { alert("Could not start conversation — make sure campaign is linked"); return; }
//       }
//       const { ok, data } = await safeFetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       console.log("SEND:", data);
//       if (!ok) { alert(data?.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // ✅ OLD working myId extraction
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   // ✅ OLD working getOtherParticipant
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   // ✅ Name se consistent color generate karo (WhatsApp style)
//   const getAvatarColor = (name: string): string => {
//     const colors = [
//       "#ef4444", "#f97316", "#eab308", "#22c55e",
//       "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
//       "#06b6d4", "#a855f7", "#f43f5e", "#10b981"
//     ];
//     let hash = 0;
//     for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
//     return colors[Math.abs(hash) % colors.length];
//   };

//   // ✅ OLD working name/image helpers
//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     // Direct fields se try karo
//     const direct = p.profileImage || p.profile?.profileImage || p.avatar || null;
//     if (direct) return direct;
//     // ✅ profileCache se try karo (separately fetched profiles)
//     const uid = p._id?.toString() || (typeof p === "string" ? p : "");
//     const cached = uid ? profileCache[uid] : null;
//     return cached?.profileImage || cached?.avatar || cached?.image || null;
//   };

//   /* ===== PROFILE MODAL — naam/avatar click pe ===== */
//   const openProfileModal = async (other: any) => {
//     if (!other || typeof other === "string") return;
//     const basicInfo = {
//       name: getParticipantName(other),
//       profileImage: getParticipantImage(other),
//       bio: other.profile?.bio || other.bio || "",
//       followers: other.profile?.followers || other.followers || "",
//       categories: other.profile?.categories || other.categories || [],
//       platform: other.profile?.platform || other.platform || "",
//       location: other.profile?.location || other.location || "",
//     };
//     setProfileModal({ ...basicInfo, _loading: true });

//     const userId = other._id?.toString() || other.id?.toString();
//     if (userId) {
//       setProfileFetching(true);
//       try {
//         const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         if (ok && data) {
//           const p = data.profile || data.data || (data._id ? data : null);
//           if (p) { setProfileModal({ ...p, _loading: false }); setProfileFetching(false); return; }
//         }
//       } catch { }
//       setProfileFetching(false);
//     }
//     setProfileModal({ ...basicInfo, _loading: false });
//   };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0;cursor:pointer;transition:opacity 0.15s}
//         .mp-header-avatar:hover{opacity:0.8}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name-btn{background:none;border:none;padding:0;cursor:pointer;font-size:15px;font-weight:700;color:#111;font-family:'Plus Jakarta Sans',sans-serif;transition:color 0.15s;text-align:left;display:block}
//         .mp-header-name-btn:hover{color:#4f46e5}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{display:inline-block;width:20px;height:20px;border:2px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}

//         /* ── PROFILE MODAL ── */
//         .mp-pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s}
//         @media(min-width:500px){.mp-pm-overlay{align-items:center}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .mp-pm-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;animation:slideUp 0.28s ease}
//         @media(min-width:500px){.mp-pm-sheet{border-radius:24px}}
//         @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mp-pm-top{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);padding:28px 24px 22px;position:relative;border-radius:24px 24px 0 0}
//         .mp-pm-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.18);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
//         .mp-pm-close:hover{background:rgba(255,255,255,0.3)}
//         .mp-pm-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}
//         .mp-pm-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-pm-name{font-size:19px;font-weight:800;color:#fff;margin:0 0 3px}
//         .mp-pm-loc{font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 10px}
//         .mp-pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .mp-pm-tag{padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.15);font-size:11px;color:rgba(255,255,255,0.9)}
//         .mp-pm-body{padding:20px;display:flex;flex-direction:column;gap:16px}
//         .mp-pm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
//         .mp-pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .mp-pm-stat-num{font-size:16px;font-weight:800;color:#4f46e5}
//         .mp-pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .mp-pm-lbl{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
//         .mp-pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .mp-pm-link{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500}
//         .mp-pm-link:hover{background:#f0f0f0}
//         .mp-pm-empty{text-align:center;padding:20px;color:#bbb;font-size:13px}
//       `}</style>

//       <div className="mp">
//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>No conversations yet</div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     <div className="mp-conv-avatar" style={{ background: img ? "#e8e8e8" : getAvatarColor(name), color: "#fff", fontSize: "18px", fontWeight: 800 }}>
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className={`mp-chat ${isMobile && !activeConv && !targetUserId ? "hidden" : ""}`}>
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER — avatar/naam click → profile modal */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = getParticipantName(other);
//                   const img = getParticipantImage(other);
//                   return (
//                     <>
//                       {/* ✅ Avatar click → profile */}
//                       <div className="mp-header-avatar" onClick={() => openProfileModal(other)} style={{ background: img ? "#e8e8e8" : getAvatarColor(name), color: "#fff" }}>
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         {/* ✅ Naam click → profile */}
//                         <button className="mp-header-name-btn" onClick={() => openProfileModal(other)}>
//                           {name}
//                         </button>
//                         <div className="mp-header-campaign">
//                           {activeConv.campaignId?.title || "Campaign conversation"}
//                         </div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name-btn">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const senderId = msg.sender?._id || msg.sender;
//                     const isMe = myId && senderId && senderId.toString() === myId.toString();
//                     if (idx === 0) console.log("DEBUG myId:", myId, "senderId:", senderId, "isMe:", isMe);
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>

//       {/* ── PROFILE MODAL ── */}
//       {profileModal && (
//         <div className="mp-pm-overlay" onClick={(e) => e.target === e.currentTarget && setProfileModal(null)}>
//           <div className="mp-pm-sheet">
//             <div className="mp-pm-top">
//               <button className="mp-pm-close" onClick={() => setProfileModal(null)}>✕</button>
//               <div className="mp-pm-avatar" style={{
//                 background: profileModal.profileImage ? "rgba(255,255,255,0.15)" : getAvatarColor(profileModal.name || "U")
//               }}>
//                 {profileModal.profileImage
//                   ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profileModal.profileImage} alt="avatar" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
//                   : (profileModal.name || "U").charAt(0).toUpperCase()}
//               </div>
//               <div className="mp-pm-name">{profileModal.name || "User"}</div>
//               {profileModal.location && <div className="mp-pm-loc">📍 {profileModal.location}</div>}
//               <div className="mp-pm-tags">
//                 {(Array.isArray(profileModal.categories) ? profileModal.categories : [profileModal.categories])
//                   .filter(Boolean).map((c: string, i: number) => (
//                     <span key={i} className="mp-pm-tag">{c}</span>
//                   ))}
//               </div>
//             </div>

//             <div className="mp-pm-body">
//               {profileFetching && (
//                 <div style={{ textAlign: "center", padding: "8px 0" }}>
//                   <span className="mp-spinner" />
//                 </div>
//               )}

//               <div className="mp-pm-stats">
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {profileModal.followers
//                       ? Number(profileModal.followers) >= 1000
//                         ? Math.floor(Number(profileModal.followers) / 1000) + "K"
//                         : profileModal.followers
//                       : "—"}
//                   </div>
//                   <div className="mp-pm-stat-label">Followers</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {Array.isArray(profileModal.categories) ? profileModal.categories.length : profileModal.categories ? 1 : 0}
//                   </div>
//                   <div className="mp-pm-stat-label">Niches</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">{profileModal.platform ? "✓" : "—"}</div>
//                   <div className="mp-pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {!profileFetching && !profileModal.bio && !profileModal.followers && !profileModal.platform && (
//                 <div className="mp-pm-empty">
//                   Profile details not available yet.<br />
//                   <small>Backend needs <code>/api/profile/user/:id</code> route</small>
//                 </div>
//               )}

//               {profileModal.bio && (
//                 <div>
//                   <div className="mp-pm-lbl">About</div>
//                   <div className="mp-pm-bio">{profileModal.bio}</div>
//                 </div>
//               )}
//               {profileModal.platform && (
//                 <div>
//                   <div className="mp-pm-lbl">Platform</div>
//                   <a href={profileModal.platform} target="_blank" rel="noopener noreferrer" className="mp-pm-link">
//                     📸 {profileModal.platform}
//                   </a>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"sans-serif",color:"#aaa"}}>Loading...</div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ✅ Safe fetch — HTML response pe crash nahi karega
// const safeFetch = async (url: string, opts: RequestInit = {}) => {
//   try {
//     const res = await fetch(url, opts);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const [profileModal, setProfileModal] = useState<any>(null);
//   const [profileFetching, setProfileFetching] = useState(false);
//   const [profileCache, setProfileCache] = useState<Record<string, any>>({});
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   // SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   // Scroll to bottom on new messages
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       // ✅ OLD working route from old code
//       const { ok, data } = await safeFetch(`${API}/conversation/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("CONVS:", data);
//       const list = data?.data || data?.conversations || [];
//       setConversations(list);
//       if (list.length > 0 && !targetUserId) openConversation(list[0]);

//       // ✅ Har conversation ke participants ka profile fetch karo (profileImage ke liye)
//       const allParticipantIds: string[] = [];
//       list.forEach((conv: any) => {
//         (conv.participants || []).forEach((p: any) => {
//           const id = p._id?.toString() || (typeof p === "string" ? p : "");
//           if (id) allParticipantIds.push(id);
//         });
//       });
//       // Unique IDs
//       const uniqueIds = [...new Set(allParticipantIds)];
//       fetchParticipantProfiles(uniqueIds, token);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Participants ka profile fetch karke cache mein store karo
//   // Backend /profile/user/:id route se profileImage milegi
//   const fetchParticipantProfiles = async (userIds: string[], tok: string) => {
//     const cache: Record<string, any> = {};
//     await Promise.all(
//       userIds.map(async (uid) => {
//         try {
//           const { ok, data } = await safeFetch(`${API}/profile/user/${uid}`, {
//             headers: { Authorization: `Bearer ${tok}` },
//           });
//           if (ok && data) {
//             const p = data.profile || data.data || (data._id ? data : null);
//             if (p) cache[uid] = p;
//           }
//         } catch { }
//       })
//     );
//     if (Object.keys(cache).length > 0) {
//       setProfileCache(prev => ({ ...prev, ...cache }));
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const { ok, data } = await safeFetch(`${API}/conversation/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("MESSAGES:", data);
//       if (!ok || !data) return;
//       const msgs = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.messages) ? data.messages
//         : data.conversation?.messages || [];
//       console.log("MSGS COUNT:", msgs.length);
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) { console.error("No campaignId"); return null; }
//       const { ok, data } = await safeFetch(`${API}/conversation/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       console.log("CREATE CONV:", data);
//       const conv = data?.conversation || data?.data;
//       if (ok && conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   /* ===== SEND MESSAGE ===== */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) { alert("Could not start conversation — make sure campaign is linked"); return; }
//       }
//       const { ok, data } = await safeFetch(`${API}/conversation/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       console.log("SEND:", data);
//       if (!ok) { alert(data?.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // ✅ OLD working myId extraction
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   // ✅ OLD working getOtherParticipant
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   // ✅ Name se consistent color generate karo (WhatsApp style)
//   const getAvatarColor = (name: string): string => {
//     const colors = [
//       "#ef4444", "#f97316", "#eab308", "#22c55e",
//       "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
//       "#06b6d4", "#a855f7", "#f43f5e", "#10b981"
//     ];
//     let hash = 0;
//     for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
//     return colors[Math.abs(hash) % colors.length];
//   };

//   // ✅ OLD working name/image helpers
//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     // Direct fields se try karo
//     const direct = p.profileImage || p.profile?.profileImage || p.avatar || null;
//     if (direct) return direct;
//     // ✅ profileCache se try karo (separately fetched profiles)
//     const uid = p._id?.toString() || (typeof p === "string" ? p : "");
//     const cached = uid ? profileCache[uid] : null;
//     return cached?.profileImage || cached?.avatar || cached?.image || null;
//   };

//   /* ===== PROFILE MODAL — naam/avatar click pe ===== */
//   const openProfileModal = async (other: any) => {
//     if (!other || typeof other === "string") return;
//     const basicInfo = {
//       name: getParticipantName(other),
//       profileImage: getParticipantImage(other),
//       bio: other.profile?.bio || other.bio || "",
//       followers: other.profile?.followers || other.followers || "",
//       categories: other.profile?.categories || other.categories || [],
//       platform: other.profile?.platform || other.platform || "",
//       location: other.profile?.location || other.location || "",
//     };
//     setProfileModal({ ...basicInfo, _loading: true });

//     const userId = other._id?.toString() || other.id?.toString();
//     if (userId) {
//       setProfileFetching(true);
//       try {
//         const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         if (ok && data) {
//           const p = data.profile || data.data || (data._id ? data : null);
//           if (p) { setProfileModal({ ...p, _loading: false }); setProfileFetching(false); return; }
//         }
//       } catch { }
//       setProfileFetching(false);
//     }
//     setProfileModal({ ...basicInfo, _loading: false });
//   };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0;cursor:pointer;transition:opacity 0.15s}
//         .mp-header-avatar:hover{opacity:0.8}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name-btn{background:none;border:none;padding:0;cursor:pointer;font-size:15px;font-weight:700;color:#111;font-family:'Plus Jakarta Sans',sans-serif;transition:color 0.15s;text-align:left;display:block}
//         .mp-header-name-btn:hover{color:#4f46e5}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{display:inline-block;width:20px;height:20px;border:2px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}

//         /* ── PROFILE MODAL ── */
//         .mp-pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s}
//         @media(min-width:500px){.mp-pm-overlay{align-items:center}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .mp-pm-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;animation:slideUp 0.28s ease}
//         @media(min-width:500px){.mp-pm-sheet{border-radius:24px}}
//         @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mp-pm-top{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);padding:28px 24px 22px;position:relative;border-radius:24px 24px 0 0}
//         .mp-pm-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.18);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
//         .mp-pm-close:hover{background:rgba(255,255,255,0.3)}
//         .mp-pm-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}
//         .mp-pm-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-pm-name{font-size:19px;font-weight:800;color:#fff;margin:0 0 3px}
//         .mp-pm-loc{font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 10px}
//         .mp-pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .mp-pm-tag{padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.15);font-size:11px;color:rgba(255,255,255,0.9)}
//         .mp-pm-body{padding:20px;display:flex;flex-direction:column;gap:16px}
//         .mp-pm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
//         .mp-pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .mp-pm-stat-num{font-size:16px;font-weight:800;color:#4f46e5}
//         .mp-pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .mp-pm-lbl{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
//         .mp-pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .mp-pm-link{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500}
//         .mp-pm-link:hover{background:#f0f0f0}
//         .mp-pm-empty{text-align:center;padding:20px;color:#bbb;font-size:13px}
//       `}</style>

//       <div className="mp">
//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>No conversations yet</div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     <div className="mp-conv-avatar" style={{ background: img ? "#e8e8e8" : getAvatarColor(name), color: "#fff", fontSize: "18px", fontWeight: 800 }}>
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className={`mp-chat ${isMobile && !activeConv && !targetUserId ? "hidden" : ""}`}>
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER — avatar/naam click → profile modal */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = getParticipantName(other);
//                   const img = getParticipantImage(other);
//                   return (
//                     <>
//                       {/* ✅ Avatar click → profile */}
//                       <div className="mp-header-avatar" onClick={() => openProfileModal(other)} style={{ background: img ? "#e8e8e8" : getAvatarColor(name), color: "#fff" }}>
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         {/* ✅ Naam click → profile */}
//                         <button className="mp-header-name-btn" onClick={() => openProfileModal(other)}>
//                           {name}
//                         </button>
//                         <div className="mp-header-campaign">
//                           {activeConv.campaignId?.title || "Campaign conversation"}
//                         </div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name-btn">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const senderId = msg.sender?._id || msg.sender;
//                     const isMe = myId && senderId && senderId.toString() === myId.toString();
//                     if (idx === 0) console.log("DEBUG myId:", myId, "senderId:", senderId, "isMe:", isMe);
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>

//       {/* ── PROFILE MODAL ── */}
//       {profileModal && (
//         <div className="mp-pm-overlay" onClick={(e) => e.target === e.currentTarget && setProfileModal(null)}>
//           <div className="mp-pm-sheet">
//             <div className="mp-pm-top">
//               <button className="mp-pm-close" onClick={() => setProfileModal(null)}>✕</button>
//               <div className="mp-pm-avatar" style={{
//                 background: profileModal.profileImage ? "rgba(255,255,255,0.15)" : getAvatarColor(profileModal.name || "U")
//               }}>
//                 {profileModal.profileImage
//                   ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profileModal.profileImage} alt="avatar" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
//                   : (profileModal.name || "U").charAt(0).toUpperCase()}
//               </div>
//               <div className="mp-pm-name">{profileModal.name || "User"}</div>
//               {profileModal.location && <div className="mp-pm-loc">📍 {profileModal.location}</div>}
//               <div className="mp-pm-tags">
//                 {(Array.isArray(profileModal.categories) ? profileModal.categories : [profileModal.categories])
//                   .filter(Boolean).map((c: string, i: number) => (
//                     <span key={i} className="mp-pm-tag">{c}</span>
//                   ))}
//               </div>
//             </div>

//             <div className="mp-pm-body">
//               {profileFetching && (
//                 <div style={{ textAlign: "center", padding: "8px 0" }}>
//                   <span className="mp-spinner" />
//                 </div>
//               )}

//               <div className="mp-pm-stats">
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {profileModal.followers
//                       ? Number(profileModal.followers) >= 1000
//                         ? Math.floor(Number(profileModal.followers) / 1000) + "K"
//                         : profileModal.followers
//                       : "—"}
//                   </div>
//                   <div className="mp-pm-stat-label">Followers</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {Array.isArray(profileModal.categories) ? profileModal.categories.length : profileModal.categories ? 1 : 0}
//                   </div>
//                   <div className="mp-pm-stat-label">Niches</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">{profileModal.platform ? "✓" : "—"}</div>
//                   <div className="mp-pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {!profileFetching && !profileModal.bio && !profileModal.followers && !profileModal.platform && (
//                 <div className="mp-pm-empty">
//                   Profile details not available yet.<br />
//                   <small>Backend needs <code>/api/profile/user/:id</code> route</small>
//                 </div>
//               )}

//               {profileModal.bio && (
//                 <div>
//                   <div className="mp-pm-lbl">About</div>
//                   <div className="mp-pm-bio">{profileModal.bio}</div>
//                 </div>
//               )}
//               {profileModal.platform && (
//                 <div>
//                   <div className="mp-pm-lbl">Platform</div>
//                   <a href={profileModal.platform} target="_blank" rel="noopener noreferrer" className="mp-pm-link">
//                     📸 {profileModal.platform}
//                   </a>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"sans-serif",color:"#aaa"}}>Loading...</div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }







// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ✅ Safe fetch — HTML response pe crash nahi karega
// const safeFetch = async (url: string, opts: RequestInit = {}) => {
//   try {
//     const res = await fetch(url, opts);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const [profileModal, setProfileModal] = useState<any>(null);
//   const [profileFetching, setProfileFetching] = useState(false);
//   const [profileCache, setProfileCache] = useState<Record<string, any>>({});
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   // SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   // Scroll to bottom on new messages
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       // ✅ OLD working route from old code
//       const { ok, data } = await safeFetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("CONVS:", data);
//       const list = data?.data || data?.conversations || [];
//       setConversations(list);
//       if (list.length > 0 && !targetUserId) openConversation(list[0]);

//       // ✅ Har conversation ke participants ka profile fetch karo (profileImage ke liye)
//       const allParticipantIds: string[] = [];
//       list.forEach((conv: any) => {
//         (conv.participants || []).forEach((p: any) => {
//           const id = p._id?.toString() || (typeof p === "string" ? p : "");
//           if (id) allParticipantIds.push(id);
//         });
//       });
//       // Unique IDs
//       const uniqueIds = [...new Set(allParticipantIds)];
//       fetchParticipantProfiles(uniqueIds, token);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ✅ Participants ka profile fetch karke cache mein store karo
//   // Backend /profile/user/:id route se profileImage milegi
//   const fetchParticipantProfiles = async (userIds: string[], tok: string) => {
//     const cache: Record<string, any> = {};
//     await Promise.all(
//       userIds.map(async (uid) => {
//         try {
//           const { ok, data } = await safeFetch(`${API}/profile/user/${uid}`, {
//             headers: { Authorization: `Bearer ${tok}` },
//           });
//           if (ok && data) {
//             const p = data.profile || data.data || (data._id ? data : null);
//             if (p) cache[uid] = p;
//           }
//         } catch { }
//       })
//     );
//     if (Object.keys(cache).length > 0) {
//       setProfileCache(prev => ({ ...prev, ...cache }));
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const { ok, data } = await safeFetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("MESSAGES:", data);
//       if (!ok || !data) return;
//       const msgs = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.messages) ? data.messages
//         : data.conversation?.messages || [];
//       console.log("MSGS COUNT:", msgs.length);
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) { console.error("No campaignId"); return null; }
//       const { ok, data } = await safeFetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       console.log("CREATE CONV:", data);
//       const conv = data?.conversation || data?.data;
//       if (ok && conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   /* ===== SEND MESSAGE ===== */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) { alert("Could not start conversation — make sure campaign is linked"); return; }
//       }
//       const { ok, data } = await safeFetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       console.log("SEND:", data);
//       if (!ok) { alert(data?.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // ✅ OLD working myId extraction
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   // ✅ OLD working getOtherParticipant
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   // ✅ OLD working name/image helpers
//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     // Direct fields se try karo
//     const direct = p.profileImage || p.profile?.profileImage || p.avatar || null;
//     if (direct) return direct;
//     // ✅ profileCache se try karo (separately fetched profiles)
//     const uid = p._id?.toString() || (typeof p === "string" ? p : "");
//     const cached = uid ? profileCache[uid] : null;
//     return cached?.profileImage || cached?.avatar || cached?.image || null;
//   };

//   /* ===== PROFILE MODAL — naam/avatar click pe ===== */
//   const openProfileModal = async (other: any) => {
//     if (!other || typeof other === "string") return;
//     const basicInfo = {
//       name: getParticipantName(other),
//       profileImage: getParticipantImage(other),
//       bio: other.profile?.bio || other.bio || "",
//       followers: other.profile?.followers || other.followers || "",
//       categories: other.profile?.categories || other.categories || [],
//       platform: other.profile?.platform || other.platform || "",
//       location: other.profile?.location || other.location || "",
//     };
//     setProfileModal({ ...basicInfo, _loading: true });

//     const userId = other._id?.toString() || other.id?.toString();
//     if (userId) {
//       setProfileFetching(true);
//       try {
//         const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         if (ok && data) {
//           const p = data.profile || data.data || (data._id ? data : null);
//           if (p) { setProfileModal({ ...p, _loading: false }); setProfileFetching(false); return; }
//         }
//       } catch { }
//       setProfileFetching(false);
//     }
//     setProfileModal({ ...basicInfo, _loading: false });
//   };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#c7d2fe;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;overflow:hidden;flex-shrink:0;cursor:pointer;transition:opacity 0.15s}
//         .mp-header-avatar:hover{opacity:0.8}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name-btn{background:none;border:none;padding:0;cursor:pointer;font-size:15px;font-weight:700;color:#111;font-family:'Plus Jakarta Sans',sans-serif;transition:color 0.15s;text-align:left;display:block}
//         .mp-header-name-btn:hover{color:#4f46e5}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{display:inline-block;width:20px;height:20px;border:2px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}

//         /* ── PROFILE MODAL ── */
//         .mp-pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s}
//         @media(min-width:500px){.mp-pm-overlay{align-items:center}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .mp-pm-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;animation:slideUp 0.28s ease}
//         @media(min-width:500px){.mp-pm-sheet{border-radius:24px}}
//         @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mp-pm-top{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);padding:28px 24px 22px;position:relative;border-radius:24px 24px 0 0}
//         .mp-pm-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.18);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
//         .mp-pm-close:hover{background:rgba(255,255,255,0.3)}
//         .mp-pm-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}
//         .mp-pm-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-pm-name{font-size:19px;font-weight:800;color:#fff;margin:0 0 3px}
//         .mp-pm-loc{font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 10px}
//         .mp-pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .mp-pm-tag{padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.15);font-size:11px;color:rgba(255,255,255,0.9)}
//         .mp-pm-body{padding:20px;display:flex;flex-direction:column;gap:16px}
//         .mp-pm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
//         .mp-pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .mp-pm-stat-num{font-size:16px;font-weight:800;color:#4f46e5}
//         .mp-pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .mp-pm-lbl{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
//         .mp-pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .mp-pm-link{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500}
//         .mp-pm-link:hover{background:#f0f0f0}
//         .mp-pm-empty{text-align:center;padding:20px;color:#bbb;font-size:13px}
//       `}</style>

//       <div className="mp">
//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>No conversations yet</div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     {/* ✅ WhatsApp style — color from name hash */}
//                     <div className="mp-conv-avatar" style={{
//                       background: img ? undefined : `hsl(${name.charCodeAt(0) * 37 % 360}, 65%, 50%)`,
//                       color: img ? undefined : "#fff"
//                     }}>
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className={`mp-chat ${isMobile && !activeConv && !targetUserId ? "hidden" : ""}`}>
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER — avatar/naam click → profile modal */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = getParticipantName(other);
//                   const img = getParticipantImage(other);
//                   return (
//                     <>
//                       {/* ✅ Avatar click → profile */}
//                       <div className="mp-header-avatar" onClick={() => openProfileModal(other)} style={{
//                         background: img ? undefined : `hsl(${name.charCodeAt(0) * 37 % 360}, 65%, 50%)`,
//                         color: img ? undefined : "#fff"
//                       }}>
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         {/* ✅ Naam click → profile */}
//                         <button className="mp-header-name-btn" onClick={() => openProfileModal(other)}>
//                           {name}
//                         </button>
//                         <div className="mp-header-campaign">
//                           {activeConv.campaignId?.title || "Campaign conversation"}
//                         </div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name-btn">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const senderId = msg.sender?._id || msg.sender;
//                     const isMe = myId && senderId && senderId.toString() === myId.toString();
//                     if (idx === 0) console.log("DEBUG myId:", myId, "senderId:", senderId, "isMe:", isMe);
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>

//       {/* ── PROFILE MODAL ── */}
//       {profileModal && (
//         <div className="mp-pm-overlay" onClick={(e) => e.target === e.currentTarget && setProfileModal(null)}>
//           <div className="mp-pm-sheet">
//             <div className="mp-pm-top">
//               <button className="mp-pm-close" onClick={() => setProfileModal(null)}>✕</button>
//               <div className="mp-pm-avatar">
//                 {profileModal.profileImage
//                   ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profileModal.profileImage} alt="avatar" />
//                   : (profileModal.name || "U").charAt(0).toUpperCase()}
//               </div>
//               <div className="mp-pm-name">{profileModal.name || "User"}</div>
//               {profileModal.location && <div className="mp-pm-loc">📍 {profileModal.location}</div>}
//               <div className="mp-pm-tags">
//                 {(Array.isArray(profileModal.categories) ? profileModal.categories : [profileModal.categories])
//                   .filter(Boolean).map((c: string, i: number) => (
//                     <span key={i} className="mp-pm-tag">{c}</span>
//                   ))}
//               </div>
//             </div>

//             <div className="mp-pm-body">
//               {profileFetching && (
//                 <div style={{ textAlign: "center", padding: "8px 0" }}>
//                   <span className="mp-spinner" />
//                 </div>
//               )}

//               <div className="mp-pm-stats">
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {profileModal.followers
//                       ? Number(profileModal.followers) >= 1000
//                         ? Math.floor(Number(profileModal.followers) / 1000) + "K"
//                         : profileModal.followers
//                       : "—"}
//                   </div>
//                   <div className="mp-pm-stat-label">Followers</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {Array.isArray(profileModal.categories) ? profileModal.categories.length : profileModal.categories ? 1 : 0}
//                   </div>
//                   <div className="mp-pm-stat-label">Niches</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">{profileModal.platform ? "✓" : "—"}</div>
//                   <div className="mp-pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {!profileFetching && !profileModal.bio && !profileModal.followers && !profileModal.platform && (
//                 <div className="mp-pm-empty">
//                   Profile details not available yet.<br />
//                   <small>Backend needs <code>/api/profile/user/:id</code> route</small>
//                 </div>
//               )}

//               {profileModal.bio && (
//                 <div>
//                   <div className="mp-pm-lbl">About</div>
//                   <div className="mp-pm-bio">{profileModal.bio}</div>
//                 </div>
//               )}
//               {profileModal.platform && (
//                 <div>
//                   <div className="mp-pm-lbl">Platform</div>
//                   <a href={profileModal.platform} target="_blank" rel="noopener noreferrer" className="mp-pm-link">
//                     📸 {profileModal.platform}
//                   </a>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// // ✅ Safe fetch — HTML response pe crash nahi karega
// const safeFetch = async (url: string, opts: RequestInit = {}) => {
//   try {
//     const res = await fetch(url, opts);
//     const text = await res.text();
//     if (!text || text.trimStart().startsWith("<")) return { ok: false, data: null };
//     const data = JSON.parse(text);
//     return { ok: res.ok, data };
//   } catch {
//     return { ok: false, data: null };
//   }
// };

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const [profileModal, setProfileModal] = useState<any>(null);
//   const [profileFetching, setProfileFetching] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   // SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   // Scroll to bottom on new messages
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       // ✅ OLD working route from old code
//       const { ok, data } = await safeFetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("CONVS:", data);
//       const list = data?.data || data?.conversations || [];
//       setConversations(list);
//       if (list.length > 0 && !targetUserId) openConversation(list[0]);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const { ok, data } = await safeFetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       console.log("MESSAGES:", data);
//       if (!ok || !data) return;
//       const msgs = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.messages) ? data.messages
//         : data.conversation?.messages || [];
//       console.log("MSGS COUNT:", msgs.length);
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) { console.error("No campaignId"); return null; }
//       const { ok, data } = await safeFetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       console.log("CREATE CONV:", data);
//       const conv = data?.conversation || data?.data;
//       if (ok && conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   /* ===== SEND MESSAGE ===== */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) { alert("Could not start conversation — make sure campaign is linked"); return; }
//       }
//       const { ok, data } = await safeFetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       console.log("SEND:", data);
//       if (!ok) { alert(data?.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // ✅ OLD working myId extraction
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   // ✅ OLD working getOtherParticipant
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   // ✅ OLD working name/image helpers
//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     return p.profileImage || p.profile?.profileImage || p.avatar || null;
//   };

//   /* ===== PROFILE MODAL — naam/avatar click pe ===== */
//   const openProfileModal = async (other: any) => {
//     if (!other || typeof other === "string") return;
//     const basicInfo = {
//       name: getParticipantName(other),
//       profileImage: getParticipantImage(other),
//       bio: other.profile?.bio || other.bio || "",
//       followers: other.profile?.followers || other.followers || "",
//       categories: other.profile?.categories || other.categories || [],
//       platform: other.profile?.platform || other.platform || "",
//       location: other.profile?.location || other.location || "",
//     };
//     setProfileModal({ ...basicInfo, _loading: true });

//     const userId = other._id?.toString() || other.id?.toString();
//     if (userId) {
//       setProfileFetching(true);
//       try {
//         const { ok, data } = await safeFetch(`${API}/profile/user/${userId}`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });
//         if (ok && data) {
//           const p = data.profile || data.data || (data._id ? data : null);
//           if (p) { setProfileModal({ ...p, _loading: false }); setProfileFetching(false); return; }
//         }
//       } catch { }
//       setProfileFetching(false);
//     }
//     setProfileModal({ ...basicInfo, _loading: false });
//   };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0;cursor:pointer;transition:opacity 0.15s}
//         .mp-header-avatar:hover{opacity:0.8}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name-btn{background:none;border:none;padding:0;cursor:pointer;font-size:15px;font-weight:700;color:#111;font-family:'Plus Jakarta Sans',sans-serif;transition:color 0.15s;text-align:left;display:block}
//         .mp-header-name-btn:hover{color:#4f46e5}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{display:inline-block;width:20px;height:20px;border:2px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite}

//         /* ── PROFILE MODAL ── */
//         .mp-pm-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:999;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s}
//         @media(min-width:500px){.mp-pm-overlay{align-items:center}}
//         @keyframes fadeIn{from{opacity:0}to{opacity:1}}
//         .mp-pm-sheet{background:#fff;border-radius:24px 24px 0 0;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;animation:slideUp 0.28s ease}
//         @media(min-width:500px){.mp-pm-sheet{border-radius:24px}}
//         @keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
//         .mp-pm-top{background:linear-gradient(135deg,#312e81 0%,#4f46e5 100%);padding:28px 24px 22px;position:relative;border-radius:24px 24px 0 0}
//         .mp-pm-close{position:absolute;top:14px;right:14px;background:rgba(255,255,255,0.18);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center}
//         .mp-pm-close:hover{background:rgba(255,255,255,0.3)}
//         .mp-pm-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,0.35);background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:800;color:#fff;margin-bottom:12px;overflow:hidden}
//         .mp-pm-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-pm-name{font-size:19px;font-weight:800;color:#fff;margin:0 0 3px}
//         .mp-pm-loc{font-size:13px;color:rgba(255,255,255,0.6);margin:0 0 10px}
//         .mp-pm-tags{display:flex;flex-wrap:wrap;gap:6px}
//         .mp-pm-tag{padding:3px 10px;border-radius:100px;background:rgba(255,255,255,0.15);font-size:11px;color:rgba(255,255,255,0.9)}
//         .mp-pm-body{padding:20px;display:flex;flex-direction:column;gap:16px}
//         .mp-pm-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
//         .mp-pm-stat{background:#fafafa;border-radius:12px;padding:12px;text-align:center;border:1px solid #f0f0f0}
//         .mp-pm-stat-num{font-size:16px;font-weight:800;color:#4f46e5}
//         .mp-pm-stat-label{font-size:10px;color:#aaa;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px}
//         .mp-pm-lbl{font-size:11px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px}
//         .mp-pm-bio{font-size:14px;color:#555;line-height:1.7}
//         .mp-pm-link{display:flex;align-items:center;gap:8px;padding:10px 14px;background:#fafafa;border-radius:10px;border:1px solid #f0f0f0;text-decoration:none;color:#111;font-size:13px;font-weight:500}
//         .mp-pm-link:hover{background:#f0f0f0}
//         .mp-pm-empty{text-align:center;padding:20px;color:#bbb;font-size:13px}
//       `}</style>

//       <div className="mp">
//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>No conversations yet</div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     <div className="mp-conv-avatar">
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className={`mp-chat ${isMobile && !activeConv && !targetUserId ? "hidden" : ""}`}>
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER — avatar/naam click → profile modal */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = getParticipantName(other);
//                   const img = getParticipantImage(other);
//                   return (
//                     <>
//                       {/* ✅ Avatar click → profile */}
//                       <div className="mp-header-avatar" onClick={() => openProfileModal(other)}>
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={img} alt={name} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         {/* ✅ Naam click → profile */}
//                         <button className="mp-header-name-btn" onClick={() => openProfileModal(other)}>
//                           {name}
//                         </button>
//                         <div className="mp-header-campaign">
//                           {activeConv.campaignId?.title || "Campaign conversation"}
//                         </div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name-btn">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const senderId = msg.sender?._id || msg.sender;
//                     const isMe = myId && senderId && senderId.toString() === myId.toString();
//                     if (idx === 0) console.log("DEBUG myId:", myId, "senderId:", senderId, "isMe:", isMe);
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>

//       {/* ── PROFILE MODAL ── */}
//       {profileModal && (
//         <div className="mp-pm-overlay" onClick={(e) => e.target === e.currentTarget && setProfileModal(null)}>
//           <div className="mp-pm-sheet">
//             <div className="mp-pm-top">
//               <button className="mp-pm-close" onClick={() => setProfileModal(null)}>✕</button>
//               <div className="mp-pm-avatar">
//                 {profileModal.profileImage
//                   ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={profileModal.profileImage} alt="avatar" />
//                   : (profileModal.name || "U").charAt(0).toUpperCase()}
//               </div>
//               <div className="mp-pm-name">{profileModal.name || "User"}</div>
//               {profileModal.location && <div className="mp-pm-loc">📍 {profileModal.location}</div>}
//               <div className="mp-pm-tags">
//                 {(Array.isArray(profileModal.categories) ? profileModal.categories : [profileModal.categories])
//                   .filter(Boolean).map((c: string, i: number) => (
//                     <span key={i} className="mp-pm-tag">{c}</span>
//                   ))}
//               </div>
//             </div>

//             <div className="mp-pm-body">
//               {profileFetching && (
//                 <div style={{ textAlign: "center", padding: "8px 0" }}>
//                   <span className="mp-spinner" />
//                 </div>
//               )}

//               <div className="mp-pm-stats">
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {profileModal.followers
//                       ? Number(profileModal.followers) >= 1000
//                         ? Math.floor(Number(profileModal.followers) / 1000) + "K"
//                         : profileModal.followers
//                       : "—"}
//                   </div>
//                   <div className="mp-pm-stat-label">Followers</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">
//                     {Array.isArray(profileModal.categories) ? profileModal.categories.length : profileModal.categories ? 1 : 0}
//                   </div>
//                   <div className="mp-pm-stat-label">Niches</div>
//                 </div>
//                 <div className="mp-pm-stat">
//                   <div className="mp-pm-stat-num">{profileModal.platform ? "✓" : "—"}</div>
//                   <div className="mp-pm-stat-label">Platform</div>
//                 </div>
//               </div>

//               {!profileFetching && !profileModal.bio && !profileModal.followers && !profileModal.platform && (
//                 <div className="mp-pm-empty">
//                   Profile details not available yet.<br />
//                   <small>Backend needs <code>/api/profile/user/:id</code> route</small>
//                 </div>
//               )}

//               {profileModal.bio && (
//                 <div>
//                   <div className="mp-pm-lbl">About</div>
//                   <div className="mp-pm-bio">{profileModal.bio}</div>
//                 </div>
//               )}
//               {profileModal.platform && (
//                 <div>
//                   <div className="mp-pm-lbl">Platform</div>
//                   <a href={profileModal.platform} target="_blank" rel="noopener noreferrer" className="mp-pm-link">
//                     📸 {profileModal.platform}
//                   </a>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// "use client";

// import { useEffect, useState, useRef, useCallback } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);

//   // ✅ Scroll to bottom whenever messages change
//   useEffect(() => {
//     bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);
//   const pollRef = useRef<any>(null);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     // Find existing conv with this user
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) =>
//         (p._id || p) === targetUserId
//       )
//     );
//     if (existing) {
//       openConversation(existing);
//     }
//     // else will be created on first message send
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CONVS:", data);
//       // ✅ Backend sends {success: true, data: [...]} with populated participants
//       const list = data.data || data.conversations || [];
//       setConversations(list);

//       // Auto open first conv (if not coming from notification)
//       if (list.length > 0 && !targetUserId) {
//         openConversation(list[0]);
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = async (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     // Start polling
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const res = await fetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("MESSAGES:", data);
//       // ✅ Backend sends {success: true, data: [...messages array]}
//       const msgs = Array.isArray(data.data) ? data.data
//         : Array.isArray(data.messages) ? data.messages : [];
//       console.log("SETTING MSGS:", msgs.length);
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION & SEND ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) {
//         console.error("No campaignId for conversation");
//         return null;
//       }
//       const res = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       const data = await res.json();
//       console.log("CREATE CONV:", data);
//       const conv = data.conversation || data.data;
//       if (conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;

//     try {
//       setSending(true);
//       let convId = activeConv?._id;

//       // Create conv if not exists (coming from notification)
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) {
//           alert("Could not start conversation — make sure campaign is linked");
//           return;
//         }
//       }

//       const res = await fetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });

//       const data = await res.json();
//       console.log("SEND:", data);

//       if (!res.ok) { alert(data.message || "Send failed"); return; }

//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   // Cleanup polling
//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // myId from user state
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     return p.profileImage || p.profile?.profileImage || p.avatar || null;
//   };

//   const formatTime = (date: string) => {
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         /* SIDEBAR */
//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-conv-unread{width:8px;height:8px;border-radius:50%;background:#4f46e5;flex-shrink:0}

//         /* EMPTY SIDEBAR */
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         /* CHAT AREA */
//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         /* CHAT HEADER */
//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name{font-size:15px;font-weight:700;color:#111}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         /* MESSAGES */
//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         /* BUBBLE */
//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         /* INPUT */
//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s;resize:none}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         /* EMPTY STATE */
//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}

//         /* NEW CHAT BANNER */
//         .mp-new-banner{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}
//         .mp-new-name{font-size:15px;font-weight:700;color:#111}
//         .mp-new-sub{font-size:12px;color:#aaa}
//       `}</style>

//       <div className="mp">
//         {/* SIDEBAR */}
//         <div className={`mp-sidebar ${activeConv && window.innerWidth <= 768 ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {/* New chat from notification */}
//           {targetUserId && !conversations.find(c => c.participants?.some((p: any) => (p._id || p) === targetUserId)) && (
//             <div className="mp-new-chat">
//               💬 New conversation with {targetUserName}
//             </div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>
//                 No conversations yet
//               </div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;

//                 return (
//                   <div
//                     key={conv._id}
//                     className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}
//                   >
//                     <div className="mp-conv-avatar">
//                       {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* CHAT AREA */}
//         <div className={`mp-chat ${!activeConv && !targetUserId ? "" : ""}`}>

//           {/* No conversation selected */}
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => setActiveConv(null)}>←</button>

//                 {activeConv ? (
//                   <>
//                     {(() => {
//                       const other = getOtherParticipant(activeConv);
//                       const name = getParticipantName(other);
//                       const img = getParticipantImage(other);
//                       return (
//                         <>
//                           <div className="mp-header-avatar">
//                             {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                           </div>
//                           <div className="mp-header-info">
//                             <div className="mp-header-name">{name}</div>
//                             <div className="mp-header-campaign">
//                               {activeConv.campaignId?.title || "Campaign conversation"}
//                             </div>
//                           </div>
//                         </>
//                       );
//                     })()}
//                   </>
//                 ) : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {/* DEBUG */}
//               {messages.length > 0 && <div style={{display:"none"}}>msgs: {messages.length}</div>}
//               {msgLoading && messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const senderId = msg.sender?._id || msg.sender;
//               const isMe = myId && senderId && senderId.toString() === myId.toString();
//               if (idx === 0) console.log("DEBUG myId:", myId, "senderId:", senderId, "isMe:", isMe);
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>
//                             {msg.text}
//                           </div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>
//                             {formatTime(msg.createdAt)}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef, useCallback } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     // Find existing conv with this user
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) =>
//         (p._id || p) === targetUserId
//       )
//     );
//     if (existing) {
//       openConversation(existing);
//     }
//     // else will be created on first message send
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/conversations/messages/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CONVS:", data);
//       const list = data.conversations || data.data || [];
//       setConversations(list);

//       // Auto open first or from URL
//       if (list.length > 0 && !activeConv) {
//         openConversation(list[0]);
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = async (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     // Start polling
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const res = await fetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("MESSAGES:", data);
//       const msgs = data.messages || data.data?.messages || [];
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION & SEND ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) {
//         console.error("No campaignId for conversation");
//         return null;
//       }
//       const res = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       const data = await res.json();
//       console.log("CREATE CONV:", data);
//       const conv = data.conversation || data.data;
//       if (conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;

//     try {
//       setSending(true);
//       let convId = activeConv?._id;

//       // Create conv if not exists (coming from notification)
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) {
//           alert("Could not start conversation — make sure campaign is linked");
//           return;
//         }
//       }

//       const res = await fetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });

//       const data = await res.json();
//       console.log("SEND:", data);

//       if (!res.ok) { alert(data.message || "Send failed"); return; }

//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   // Cleanup polling
//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   // ✅ cb_user structure: {token, role, user: {_id, email}} ya direct {_id, token}
//   const myId = user?.user?._id || user?.user?.id || user?._id || user?.id;

//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => {
//       const pid = p?._id?.toString() || p?.toString();
//       return pid !== myId.toString();
//     }) || null;
//   };

//   const getParticipantName = (p: any): string => {
//     if (!p) return "User";
//     return p.name || p.profile?.name || p.username || p.email?.split("@")[0] || "User";
//   };

//   const getParticipantImage = (p: any): string | null => {
//     if (!p) return null;
//     return p.profileImage || p.profile?.profileImage || p.avatar || null;
//   };

//   const formatTime = (date: string) => {
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         /* SIDEBAR */
//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-conv-unread{width:8px;height:8px;border-radius:50%;background:#4f46e5;flex-shrink:0}

//         /* EMPTY SIDEBAR */
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         /* CHAT AREA */
//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         /* CHAT HEADER */
//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name{font-size:15px;font-weight:700;color:#111}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         /* MESSAGES */
//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         /* BUBBLE */
//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         /* INPUT */
//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s;resize:none}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         /* EMPTY STATE */
//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}

//         /* NEW CHAT BANNER */
//         .mp-new-banner{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}
//         .mp-new-name{font-size:15px;font-weight:700;color:#111}
//         .mp-new-sub{font-size:12px;color:#aaa}
//       `}</style>

//       <div className="mp">
//         {/* SIDEBAR */}
//         <div className={`mp-sidebar ${activeConv && window.innerWidth <= 768 ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {/* New chat from notification */}
//           {targetUserId && !conversations.find(c => c.participants?.some((p: any) => (p._id || p) === targetUserId)) && (
//             <div className="mp-new-chat">
//               💬 New conversation with {targetUserName}
//             </div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>
//                 No conversations yet
//               </div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = getParticipantName(other);
//                 const img = getParticipantImage(other);
//                 const isActive = activeConv?._id === conv._id;

//                 return (
//                   <div
//                     key={conv._id}
//                     className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}
//                   >
//                     <div className="mp-conv-avatar">
//                       {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* CHAT AREA */}
//         <div className={`mp-chat ${!activeConv && !targetUserId ? "" : ""}`}>

//           {/* No conversation selected */}
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => setActiveConv(null)}>←</button>

//                 {activeConv ? (
//                   <>
//                     {(() => {
//                       const other = getOtherParticipant(activeConv);
//                       const name = getParticipantName(other);
//                       const img = getParticipantImage(other);
//                       return (
//                         <>
//                           <div className="mp-header-avatar">
//                             {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                           </div>
//                           <div className="mp-header-info">
//                             <div className="mp-header-name">{name}</div>
//                             <div className="mp-header-campaign">
//                               {activeConv.campaignId?.title || "Campaign conversation"}
//                             </div>
//                           </div>
//                         </>
//                       );
//                     })()}
//                   </>
//                 ) : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const isMe = (msg.sender?._id || msg.sender) === myId;
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>
//                             {msg.text}
//                           </div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>
//                             {formatTime(msg.createdAt)}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { socket } from "@/lib/socket";

// const API = "http://54.252.201.93:5000/api";

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);
//   const activeConvRef = useRef<any>(null);

//   // ✅ activeConv ka latest ref — socket handler mein use hoga
//   useEffect(() => {
//     activeConvRef.current = activeConv;
//   }, [activeConv]);

//   // ✅ SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

 
  

//   useEffect(() => {
//   socket.on("receiveMessage", ({ conversationId, message }: any) => {
//     console.log("📩 Message via socket:", message);

//     const conv = activeConvRef.current;

//     if (conv && conv._id === conversationId) {
//       setMessages((prev) => {
//         const exists = prev.some((m) => m._id === message._id);
//         if (exists) return prev;
//         return [...prev, message];
//       });

//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
//     }

//     setConversations((prev) =>
//       prev.map((c) =>
//         c._id === conversationId
//           ? { ...c, lastMessage: message.text, lastMessageAt: message.createdAt }
//           : c
//       )
//     );
//   });

//   return () => {
//     socket.off("receiveMessage");
//   };
// }, []);

//   /* ── FETCH CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ── AUTO-OPEN conv if userId in URL ── */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   // ✅ Backend route: GET /api/conversations/my
//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CONVS:", data);
//       const list = data.conversations || data.data || [];

//       // ✅ Participants populate karo agar sirf IDs aa rahi hain
//       const populated = await Promise.all(
//         list.map(async (conv: any) => {
//           if (!conv.participants) return conv;
//           const populatedParticipants = await Promise.all(
//             conv.participants.map(async (p: any) => {
//               // Agar already object hai (populated) toh skip karo
//               if (typeof p === "object" && p.name) return p;
//               // Sirf ID hai — fetch karo
//               const uid = p._id || p;
//               try {
//                 const uRes = await fetch(`${API}/profile/user/${uid}`, {
//                   headers: { Authorization: `Bearer ${token}` },
//                 });
//                 const uData = await uRes.json();
//                 return uData.user || uData.data || { _id: uid, name: "User" };
//               } catch {
//                 return { _id: uid, name: "User" };
//               }
//             })
//           );
//           return { ...conv, participants: populatedParticipants };
//         })
//       );

//       setConversations(populated);
//       if (populated.length > 0 && !activeConv && !targetUserId) {
//         openConversation(populated[0]);
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     // // if (pollRef.current) clearInterval(pollRef.current);
//     // pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   // ✅ Backend route: GET /api/conversations/messages/:conversationId
//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const res = await fetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("MESSAGES:", data);
//       // ✅ Backend returns: {success: true, data: [...messages]}
//       const msgs = Array.isArray(data.data)
//         ? data.data
//         : data.messages || data.data?.messages || data.conversation?.messages || [];
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   // ✅ Backend route: POST /api/conversations/create
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) {
//         alert("Campaign ID missing — go back and try again from notifications");
//         return null;
//       }
//       const res = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       const data = await res.json();
//       console.log("CREATE CONV:", data);
//       const conv = data.conversation || data.data;
//       if (conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   // ✅ Backend route: POST /api/conversations/send/:conversationId
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;

//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) return;
//       }

//       const res = await fetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       const data = await res.json();
//       console.log("SEND:", data);
//       if (!res.ok) { alert(data.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   const myId = user?._id || user?.id;

//   // const getOtherParticipant = (conv: any) => {
//   //   if (!conv?.participants) return null;
//   //   return conv.participants.find((p: any) => (p._id || p) !== myId) || null;
//   // };

//   const getOtherParticipant = (conv: any) => {
//   if (!conv?.participants || !user?._id) return null;

//   return conv.participants.find((p: any) => {
//     // handle both populated and non-populated cases
//     const participantId =
//       typeof p === "string"
//         ? p
//         : p._id?._id || p._id;

//     return participantId?.toString() !== user._id.toString();
//   });
// };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     if (d.toDateString() === today.toDateString()) return "Today";
//     const yesterday = new Date(today);
//     yesterday.setDate(today.getDate() - 1);
//     if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name{font-size:15px;font-weight:700;color:#111}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.5)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}

//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{width:24px;height:24px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:40px auto}
//       `}</style>

//       <div className="mp">

//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div className="mp-spinner" />
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>
//                 No conversations yet
//               </div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = other?.name || other?.profile?.name || "User";
//                 const img = other?.profileImage || other?.profile?.profileImage;
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     <div className="mp-conv-avatar">
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */
//                           <img src={img} alt={name} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className="mp-chat">

//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = other?.name || other?.profile?.name || "User";
//                   const img = other?.profileImage || other?.profile?.profileImage;
//                   return (
//                     <>
//                       <div className="mp-header-avatar">
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */
//                             <img src={img} alt={name} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         <div className="mp-header-name">{name}</div>
//                         <div className="mp-header-campaign">{activeConv.campaignId?.title || "Campaign conversation"}</div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div className="mp-spinner" />
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const isMe = (msg.sender?._id || msg.sender) === myId;
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }



// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { socket } from "@/lib/socket";

// const API = "http://54.252.201.93:5000/api";

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const [isMobile, setIsMobile] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   // ✅ SSR-safe mobile check
//   useEffect(() => {
//     const check = () => setIsMobile(window.innerWidth <= 768);
//     check();
//     window.addEventListener("resize", check);
//     return () => window.removeEventListener("resize", check);
//   }, []);

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token") || "";
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ── FETCH CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ── AUTO-OPEN conv if userId in URL ── */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) => (p._id || p) === targetUserId)
//     );
//     if (existing) openConversation(existing);
//   }, [conversations, targetUserId]);

//   // ✅ Backend route: GET /api/conversation/my
//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/conversations/my`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CONVS:", data);
//       const list = data.conversations || data.data || [];
//       setConversations(list);
//       if (list.length > 0 && !activeConv && !targetUserId) {
//         openConversation(list[0]);
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = (conv: any) => {
//     setActiveConv(conv);
//     // ✅ Messages conversation ke andar embedded hain schema mein
//     // GET /api/conversation/messages/:conversationId
//     fetchMessages(conv._id);
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   // ✅ Backend route: GET /api/conversation/messages/:conversationId
//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const res = await fetch(`${API}/conversations/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("MESSAGES:", data);
//       // ✅ Schema: messages array conversation ke andar hai
//       const msgs = data.messages || data.data?.messages || data.conversation?.messages || [];
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   // ✅ Backend route: POST /api/conversation/create
//   // Body: { campaignId, participantId }
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) {
//         alert("Campaign ID missing — go back and try again from notifications");
//         return null;
//       }
//       const res = await fetch(`${API}/conversations/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       const data = await res.json();
//       console.log("CREATE CONV:", data);
//       const conv = data.conversation || data.data;
//       if (conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   // ✅ Backend route: POST /api/conversation/send/:conversationId
//   // Body: { text }
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;
//     try {
//       setSending(true);
//       let convId = activeConv?._id;

//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) return;
//       }

//       const res = await fetch(`${API}/conversations/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       const data = await res.json();
//       console.log("SEND:", data);
//       if (!res.ok) { alert(data.message || "Send failed"); return; }
//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   const myId = user?._id || user?.id;

//   // ✅ participants array mein dono users hain — apna ID hata ke doosra dikhao
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants) return null;
//     return conv.participants.find((p: any) => (p._id || p) !== myId) || null;
//   };

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const today = new Date();
//     if (d.toDateString() === today.toDateString()) return "Today";
//     const yesterday = new Date(today);
//     yesterday.setDate(today.getDate() - 1);
//     if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;font-size:13px;color:#4f46e5;font-weight:600}

//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name{font-size:15px;font-weight:700;color:#111}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.5)}

//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}

//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}

//         @keyframes spin{to{transform:rotate(360deg)}}
//         .mp-spinner{width:24px;height:24px;border:3px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin 0.8s linear infinite;margin:40px auto}
//       `}</style>

//       <div className="mp">

//         {/* ── SIDEBAR ── */}
//         <div className={`mp-sidebar ${isMobile && activeConv ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {/* New chat banner — notification se aaya */}
//           {targetUserId && !conversations.find(c =>
//             c.participants?.some((p: any) => (p._id || p) === targetUserId)
//           ) && (
//             <div className="mp-new-chat">💬 New conversation with {targetUserName}</div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div className="mp-spinner" />
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{ padding: "40px", textAlign: "center", color: "#bbb", fontSize: "13px" }}>
//                 No conversations yet
//               </div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = other?.name || other?.profile?.name || "User";
//                 const img = other?.profileImage || other?.profile?.profileImage;
//                 const isActive = activeConv?._id === conv._id;
//                 return (
//                   <div key={conv._id} className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}>
//                     <div className="mp-conv-avatar">
//                       {img
//                         ? /* eslint-disable-next-line @next/next/no-img-element */
//                           <img src={img} alt={name} />
//                         : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       {/* ✅ Schema: lastMessage field hai conversation mein */}
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {/* ✅ Schema: lastMessageAt field hai */}
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* ── CHAT AREA ── */}
//         <div className={`mp-chat ${isMobile && !activeConv && !targetUserId ? "" : ""}`}>

//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => { setActiveConv(null); if (pollRef.current) clearInterval(pollRef.current); }}>←</button>

//                 {activeConv ? (() => {
//                   const other = getOtherParticipant(activeConv);
//                   const name = other?.name || other?.profile?.name || "User";
//                   const img = other?.profileImage || other?.profile?.profileImage;
//                   return (
//                     <>
//                       <div className="mp-header-avatar">
//                         {img
//                           ? /* eslint-disable-next-line @next/next/no-img-element */
//                             <img src={img} alt={name} />
//                           : name.charAt(0).toUpperCase()}
//                       </div>
//                       <div className="mp-header-info">
//                         <div className="mp-header-name">{name}</div>
//                         {/* ✅ Schema: campaignId ref Campaign hai */}
//                         <div className="mp-header-campaign">{activeConv.campaignId?.title || "Campaign conversation"}</div>
//                       </div>
//                     </>
//                   );
//                 })() : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div className="mp-spinner" />
//                 ) : messages.length === 0 ? (
//                   <div style={{ textAlign: "center", color: "#bbb", fontSize: "13px", padding: "40px" }}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     // ✅ Schema: sender ObjectId ref User
//                     const isMe = (msg.sender?._id || msg.sender) === myId;
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           {/* ✅ Schema: text field */}
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>{msg.text}</div>
//                           {/* ✅ Schema: createdAt field */}
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>{formatTime(msg.createdAt)}</div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }



// "use client";

// import { useEffect, useState, useRef, useCallback } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// export default function MessagesPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const targetUserId = searchParams.get("userId");
//   const targetUserName = searchParams.get("name") || "Creator";
//   const targetCampaignId = searchParams.get("campaignId");

//   const [user, setUser] = useState<any>(null);
//   const [token, setToken] = useState("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loading, setLoading] = useState(true);
//   const [msgLoading, setMsgLoading] = useState(false);
//   const bottomRef = useRef<HTMLDivElement>(null);
//   const pollRef = useRef<any>(null);

//   /* ===== AUTH ===== */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) { router.push("/login"); return; }
//     const parsed = JSON.parse(stored);
//     const t = parsed.token || localStorage.getItem("token");
//     if (!t) { router.push("/login"); return; }
//     setUser(parsed);
//     setToken(t);
//   }, []);

//   /* ===== FETCH CONVERSATIONS ===== */
//   useEffect(() => {
//     if (!token) return;
//     fetchConversations();
//   }, [token]);

//   /* ===== AUTO-OPEN if userId in URL ===== */
//   useEffect(() => {
//     if (!token || !targetUserId || conversations.length === 0) return;
//     // Find existing conv with this user
//     const existing = conversations.find((c: any) =>
//       c.participants?.some((p: any) =>
//         (p._id || p) === targetUserId
//       )
//     );
//     if (existing) {
//       openConversation(existing);
//     }
//     // else will be created on first message send
//   }, [conversations, targetUserId]);

//   const fetchConversations = async () => {
//     try {
//       setLoading(true);
//       const res = await fetch(`${API}/conversation/messages/all`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("CONVS:", data);
//       const list = data.conversations || data.data || [];
//       setConversations(list);

//       // Auto open first or from URL
//       if (list.length > 0 && !activeConv) {
//         openConversation(list[0]);
//       }
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const openConversation = async (conv: any) => {
//     setActiveConv(conv);
//     fetchMessages(conv._id);
//     // Start polling
//     if (pollRef.current) clearInterval(pollRef.current);
//     pollRef.current = setInterval(() => fetchMessages(conv._id), 5000);
//   };

//   const fetchMessages = async (convId: string) => {
//     try {
//       setMsgLoading(true);
//       const res = await fetch(`${API}/conversation/messages/${convId}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       console.log("MESSAGES:", data);
//       const msgs = data.messages || data.data?.messages || [];
//       setMessages(msgs);
//       setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setMsgLoading(false);
//     }
//   };

//   /* ===== CREATE CONVERSATION & SEND ===== */
//   const createConversation = async (): Promise<string | null> => {
//     if (!targetUserId) return null;
//     try {
//       const campaignId = targetCampaignId || activeConv?.campaignId?._id || activeConv?.campaignId;
//       if (!campaignId) {
//         console.error("No campaignId for conversation");
//         return null;
//       }
//       const res = await fetch(`${API}/conversation/create`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ campaignId, participantId: targetUserId }),
//       });
//       const data = await res.json();
//       console.log("CREATE CONV:", data);
//       const conv = data.conversation || data.data;
//       if (conv) {
//         setActiveConv(conv);
//         setConversations(prev => [conv, ...prev]);
//         return conv._id;
//       }
//       return null;
//     } catch (err) {
//       console.error(err);
//       return null;
//     }
//   };

//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending) return;

//     try {
//       setSending(true);
//       let convId = activeConv?._id;

//       // Create conv if not exists (coming from notification)
//       if (!convId && targetUserId) {
//         convId = await createConversation();
//         if (!convId) {
//           alert("Could not start conversation — make sure campaign is linked");
//           return;
//         }
//       }

//       const res = await fetch(`${API}/conversation/send/${convId}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });

//       const data = await res.json();
//       console.log("SEND:", data);

//       if (!res.ok) { alert(data.message || "Send failed"); return; }

//       setNewMsg("");
//       fetchMessages(convId);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   // Cleanup polling
//   useEffect(() => {
//     return () => { if (pollRef.current) clearInterval(pollRef.current); };
//   }, []);

//   const myId = user?._id || user?.id;

//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants) return null;
//     return conv.participants.find((p: any) => (p._id || p) !== myId);
//   };

//   const formatTime = (date: string) => {
//     const d = new Date(date);
//     return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   const formatDate = (date: string) => {
//     const d = new Date(date);
//     const today = new Date();
//     const diff = today.getDate() - d.getDate();
//     if (diff === 0) return "Today";
//     if (diff === 1) return "Yesterday";
//     return d.toLocaleDateString();
//   };

//   /* ===== UI ===== */
//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *{box-sizing:border-box;margin:0;padding:0}
//         .mp{font-family:'Plus Jakarta Sans',sans-serif;background:#f5f5f0;height:calc(100vh - 64px);display:flex;overflow:hidden}

//         /* SIDEBAR */
//         .mp-sidebar{width:300px;background:#fff;border-right:1px solid #ebebeb;display:flex;flex-direction:column;flex-shrink:0}
//         @media(max-width:768px){.mp-sidebar{width:100%;position:absolute;z-index:10;height:100%}.mp-sidebar.hidden{display:none}}
//         .mp-sidebar-header{padding:20px;border-bottom:1px solid #f0f0f0}
//         .mp-sidebar-title{font-size:18px;font-weight:800;color:#111}
//         .mp-conv-list{flex:1;overflow-y:auto}
//         .mp-conv-item{display:flex;align-items:center;gap:12px;padding:16px 20px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #fafafa}
//         .mp-conv-item:hover{background:#f9f9f9}
//         .mp-conv-item.active{background:#eff6ff;border-left:3px solid #4f46e5}
//         .mp-conv-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#666;flex-shrink:0;overflow:hidden}
//         .mp-conv-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-conv-info{flex:1;min-width:0}
//         .mp-conv-name{font-size:14px;font-weight:700;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
//         .mp-conv-last{font-size:12px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
//         .mp-conv-time{font-size:11px;color:#bbb;flex-shrink:0}
//         .mp-conv-unread{width:8px;height:8px;border-radius:50%;background:#4f46e5;flex-shrink:0}

//         /* EMPTY SIDEBAR */
//         .mp-new-chat{margin:16px;padding:12px 16px;background:#eff6ff;border-radius:12px;border:1px solid #bfdbfe;display:flex;align-items:center;gap:8px;font-size:13px;color:#4f46e5;font-weight:600}

//         /* CHAT AREA */
//         .mp-chat{flex:1;display:flex;flex-direction:column;min-width:0}
//         @media(max-width:768px){.mp-chat{position:absolute;width:100%;height:100%;z-index:5}.mp-chat.hidden{display:none}}

//         /* CHAT HEADER */
//         .mp-chat-header{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-back-btn{display:none;background:none;border:none;cursor:pointer;font-size:20px;color:#666;padding:4px 8px;border-radius:8px}
//         @media(max-width:768px){.mp-back-btn{display:block}}
//         .mp-header-avatar{width:40px;height:40px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#666;overflow:hidden;flex-shrink:0}
//         .mp-header-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .mp-header-info{flex:1}
//         .mp-header-name{font-size:15px;font-weight:700;color:#111}
//         .mp-header-campaign{font-size:12px;color:#aaa;margin-top:1px}

//         /* MESSAGES */
//         .mp-messages{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:4px;background:#f8f8f5}
//         .mp-date-label{text-align:center;margin:12px 0}
//         .mp-date-text{background:#e8e8e8;color:#888;font-size:11px;padding:4px 12px;border-radius:100px;display:inline-block}

//         /* BUBBLE */
//         .mp-bubble-wrap{display:flex;flex-direction:column;margin:2px 0}
//         .mp-bubble-wrap.me{align-items:flex-end}
//         .mp-bubble-wrap.them{align-items:flex-start}
//         .mp-bubble{max-width:68%;padding:10px 14px;border-radius:18px;font-size:14px;line-height:1.5;word-break:break-word}
//         .mp-bubble.me{background:#4f46e5;color:#fff;border-bottom-right-radius:4px}
//         .mp-bubble.them{background:#fff;color:#111;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
//         .mp-bubble-time{font-size:10px;color:#bbb;margin-top:3px;padding:0 4px}
//         .mp-bubble-time.me{color:rgba(79,70,229,0.6)}

//         /* INPUT */
//         .mp-input-area{background:#fff;border-top:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-input{flex:1;padding:12px 16px;border-radius:24px;border:1.5px solid #ebebeb;background:#f9f9f9;font-size:14px;font-family:'Plus Jakarta Sans',sans-serif;outline:none;transition:all 0.2s;resize:none}
//         .mp-input:focus{border-color:#4f46e5;background:#fff}
//         .mp-send-btn{width:44px;height:44px;border-radius:50%;background:#4f46e5;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s}
//         .mp-send-btn:hover{background:#4338ca;transform:scale(1.05)}
//         .mp-send-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none}

//         /* EMPTY STATE */
//         .mp-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f8f8f5;gap:12px;color:#bbb}
//         .mp-empty-icon{font-size:52px}
//         .mp-empty-title{font-size:16px;font-weight:700;color:#999}
//         .mp-empty-sub{font-size:13px;color:#bbb;text-align:center;max-width:260px;line-height:1.6}

//         /* NEW CHAT BANNER */
//         .mp-new-banner{background:#fff;border-bottom:1px solid #ebebeb;padding:16px 20px;display:flex;align-items:center;gap:12px}
//         .mp-new-avatar{width:44px;height:44px;border-radius:50%;background:#eff6ff;border:2px solid #bfdbfe;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#4f46e5}
//         .mp-new-name{font-size:15px;font-weight:700;color:#111}
//         .mp-new-sub{font-size:12px;color:#aaa}
//       `}</style>

//       <div className="mp">
//         {/* SIDEBAR */}
//         <div className={`mp-sidebar ${activeConv && window.innerWidth <= 768 ? "hidden" : ""}`}>
//           <div className="mp-sidebar-header">
//             <div className="mp-sidebar-title">Messages</div>
//           </div>

//           {/* New chat from notification */}
//           {targetUserId && !conversations.find(c => c.participants?.some((p: any) => (p._id || p) === targetUserId)) && (
//             <div className="mp-new-chat">
//               💬 New conversation with {targetUserName}
//             </div>
//           )}

//           <div className="mp-conv-list">
//             {loading ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>Loading...</div>
//             ) : conversations.length === 0 && !targetUserId ? (
//               <div style={{padding:"40px",textAlign:"center",color:"#bbb",fontSize:"13px"}}>
//                 No conversations yet
//               </div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const name = other?.name || other?.profile?.name || "User";
//                 const img = other?.profileImage || other?.profile?.profileImage;
//                 const isActive = activeConv?._id === conv._id;

//                 return (
//                   <div
//                     key={conv._id}
//                     className={`mp-conv-item ${isActive ? "active" : ""}`}
//                     onClick={() => openConversation(conv)}
//                   >
//                     <div className="mp-conv-avatar">
//                       {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="mp-conv-info">
//                       <div className="mp-conv-name">{name}</div>
//                       <div className="mp-conv-last">{conv.lastMessage || "Start chatting..."}</div>
//                     </div>
//                     {conv.lastMessageAt && (
//                       <div className="mp-conv-time">{formatTime(conv.lastMessageAt)}</div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* CHAT AREA */}
//         <div className={`mp-chat ${!activeConv && !targetUserId ? "" : ""}`}>

//           {/* No conversation selected */}
//           {!activeConv && !targetUserId ? (
//             <div className="mp-empty">
//               <div className="mp-empty-icon">💬</div>
//               <div className="mp-empty-title">Your Messages</div>
//               <div className="mp-empty-sub">Accept a creator from notifications to start a conversation</div>
//             </div>
//           ) : (
//             <>
//               {/* HEADER */}
//               <div className="mp-chat-header">
//                 <button className="mp-back-btn" onClick={() => setActiveConv(null)}>←</button>

//                 {activeConv ? (
//                   <>
//                     {(() => {
//                       const other = getOtherParticipant(activeConv);
//                       const name = other?.name || other?.profile?.name || "User";
//                       const img = other?.profileImage || other?.profile?.profileImage;
//                       return (
//                         <>
//                           <div className="mp-header-avatar">
//                             {img ? <img src={img} alt={name} /> : name.charAt(0).toUpperCase()}
//                           </div>
//                           <div className="mp-header-info">
//                             <div className="mp-header-name">{name}</div>
//                             <div className="mp-header-campaign">
//                               {activeConv.campaignId?.title || "Campaign conversation"}
//                             </div>
//                           </div>
//                         </>
//                       );
//                     })()}
//                   </>
//                 ) : (
//                   <>
//                     <div className="mp-new-avatar">{targetUserName.charAt(0).toUpperCase()}</div>
//                     <div className="mp-header-info">
//                       <div className="mp-header-name">{targetUserName}</div>
//                       <div className="mp-header-campaign">Send a message to start</div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {/* MESSAGES */}
//               <div className="mp-messages">
//                 {msgLoading && messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>Loading messages...</div>
//                 ) : messages.length === 0 ? (
//                   <div style={{textAlign:"center",color:"#bbb",fontSize:"13px",padding:"40px"}}>
//                     No messages yet — say hello! 👋
//                   </div>
//                 ) : (
//                   messages.map((msg, idx) => {
//                     const isMe = (msg.sender?._id || msg.sender) === myId;
//                     const prevMsg = messages[idx - 1];
//                     const showDate = !prevMsg ||
//                       new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

//                     return (
//                       <div key={msg._id || idx}>
//                         {showDate && (
//                           <div className="mp-date-label">
//                             <span className="mp-date-text">{formatDate(msg.createdAt)}</span>
//                           </div>
//                         )}
//                         <div className={`mp-bubble-wrap ${isMe ? "me" : "them"}`}>
//                           <div className={`mp-bubble ${isMe ? "me" : "them"}`}>
//                             {msg.text}
//                           </div>
//                           <div className={`mp-bubble-time ${isMe ? "me" : ""}`}>
//                             {formatTime(msg.createdAt)}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })
//                 )}
//                 <div ref={bottomRef} />
//               </div>

//               {/* INPUT */}
//               <div className="mp-input-area">
//                 <input
//                   className="mp-input"
//                   placeholder="Type a message..."
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                 />
//                 <button className="mp-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
//                     <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
//                   </svg>
//                 </button>
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }