"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

const API = "http://54.252.201.93:5000/api";
const SOCKET_URL = "http://54.252.201.93:5000";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚨 KEYWORD DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const BANNED_KEYWORDS = [
  "whatsapp","whatsapp number","wp number","wapp",
  "phone number","phone no","phoneno","my number","call me","give number","contact number",
  "instagram id","instagram handle","insta id","insta handle","dm me","send dm","dm kar",
  "telegram","signal app","snapchat","kik",
  "email id","gmail","yahoo mail","direct mail","mail karo","mail me",
  "outside platform","off platform","direct deal","bypass platform","platform ke bahar",
  "contact me","reach me","connect outside","talk outside","bahar baat","bahar deal",
];

const WARNING_TEXT = "Please keep all communication inside the platform. Sharing contact info or moving deals off-platform may result in account suspension.";

function detectBannedKeyword(text: string): string | null {
  const lower = text.toLowerCase();
  for (const kw of BANNED_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function MessagesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string>("");
  const [myId, setMyId] = useState<string>("");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showDp, setShowDp] = useState(false);

  // ✅ Unread counts per conversation
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  // 🚨 Keyword detection state
  const [bannedWord, setBannedWord] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeConvRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchedConversations = useRef(false);
  const myIdRef = useRef<string>("");

  /* ── AUTH ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cbUser = localStorage.getItem("cb_user");
    if (cbUser) {
      const parsed = JSON.parse(cbUser);
      const tok = parsed.token || parsed.accessToken || "";
      setToken(tok);
      const id = parsed._id || parsed.id || parsed.user?._id || parsed.user?.id || "";
      const idStr = id.toString();
      setMyId(idStr);
      myIdRef.current = idStr;
      console.log("[Messages] myId set:", idStr);
      return;
    }
    const t = localStorage.getItem("token") || "";
    const u = localStorage.getItem("user");
    setToken(t);
    if (u) {
      const parsed = JSON.parse(u);
      const id = parsed._id || parsed.id || parsed.user?._id || "";
      const idStr = id.toString();
      setMyId(idStr);
      myIdRef.current = idStr;
    }
  }, []);

  /* ── SOCKET ── */
  useEffect(() => {
    if (!token) return;
    if (!myId && !myIdRef.current) return;
    if (socketRef.current) return;
    const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
    socketRef.current = socket;
    socket.on("connect", () => { if (myIdRef.current) socket.emit("join", myIdRef.current); });
    socket.on("newMessage", (msg: any) => {
      const conv = activeConvRef.current;
      const msgConvId = (msg.conversationId || msg.conversation)?.toString();
      const senderId = (msg.sender?._id || msg.sender)?.toString();
      const isMe = senderId === myIdRef.current;

      if (conv && msgConvId === conv._id?.toString()) {
        if (!isMe) {
          setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        } else {
          setMessages(prev => {
            const hasReal = prev.some(m => m._id === msg._id);
            if (hasReal) return prev;
            const tempIdx = [...prev].reverse().findIndex(m => m._temp === true);
            if (tempIdx !== -1) {
              const realIdx = prev.length - 1 - tempIdx;
              const updated = [...prev];
              updated[realIdx] = { ...msg };
              return updated;
            }
            return [...prev, msg];
          });
        }
      } else if (!isMe && msgConvId) {
        setUnreadCounts(prev => ({ ...prev, [msgConvId]: (prev[msgConvId] || 0) + 1 }));
        // Move conversation to top
        setConversations(prev => {
          const idx = prev.findIndex(c => c._id?.toString() === msgConvId);
          if (idx <= 0) return prev;
          const updated = [...prev];
          const [moved] = updated.splice(idx, 1);
          return [moved, ...updated];
        });
      }

      setConversations(prev =>
        prev.map(c => c._id?.toString() === msgConvId
          ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
          : c
        )
      );
    });
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [token, myId]);

  /* ── LOAD CONVERSATIONS ── */
  useEffect(() => {
    if (!token || fetchedConversations.current) return;
    fetchedConversations.current = true;
    setLoadingConvs(true);
    fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const rawConvs = data?.data || data?.conversations || data || [];

        // ── DEDUPLICATE by other participant id ──
        const seen = new Set<string>();
        const convs = rawConvs.filter((c: any) => {
          const parts = c.participants || [];
          const otherId = parts.find((p: any) => (p?._id || p)?.toString() !== myIdRef.current);
          const key = (otherId?._id || otherId || c._id)?.toString();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // Sort by latest message
        convs.sort((a: any, b: any) => new Date(b.updatedAt||0).getTime() - new Date(a.updatedAt||0).getTime());

        setConversations(convs);

        const counts: Record<string, number> = {};
        convs.forEach((c: any) => {
          // unreadCount from backend OR unread flag
          const uc = c.unreadCount || c.unread || 0;
          if (uc > 0) counts[c._id] = uc;
        });
        if (Object.keys(counts).length > 0) setUnreadCounts(counts);
        const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
        if (targetUserId && convs.length > 0) {
          const matched = convs.find((c: any) =>
            c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
          );
          if (matched) {
            setActiveConv(matched);
            setShowSidebar(false);
            setUnreadCounts(prev => { const n = { ...prev }; delete n[matched._id]; return n; });
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoadingConvs(false));
  }, [token]);

  /* ── LOAD MESSAGES ── */
  useEffect(() => {
    if (!token || !activeConv) return;
    activeConvRef.current = activeConv;
    fetch(`${API}/conversations/messages/${activeConv._id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setMessages(data?.data || []))
      .catch(console.error);
  }, [activeConv, token]);

  /* ── AUTO SCROLL ── */
  useEffect(() => {
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
  const getInitial = (p: any) => getName(p).charAt(0).toUpperCase();
  const formatTime = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
  };
  const formatMsgTime = (date: string) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /* ── 🚨 INPUT CHANGE WITH KEYWORD DETECTION ── */
  const handleInputChange = (val: string) => {
    setNewMsg(val);
    const kw = detectBannedKeyword(val);
    if (kw) {
      setBannedWord(kw);
      setShowWarning(true);
    } else {
      setBannedWord(null);
      setShowWarning(false);
    }
  };

  /* ── SEND (blocked if banned keyword) ── */
  const sendMessage = async () => {
    if (!newMsg.trim() || sending || !activeConv) return;
    // 🚨 Block send if banned keyword detected
    if (bannedWord) {
      setShowWarning(true);
      // shake input
      inputRef.current?.classList.add("shake");
      setTimeout(() => inputRef.current?.classList.remove("shake"), 500);
      return;
    }
    const text = newMsg.trim();
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      _id: tempId, text,
      sender: myIdRef.current || myId,
      conversationId: activeConv._id,
      createdAt: new Date().toISOString(),
      _temp: true,
    };
    setMessages(prev => [...prev, tempMsg]);
    setNewMsg("");
    setBannedWord(null);
    setShowWarning(false);
    inputRef.current?.focus();
    try {
      setSending(true);
      const res = await fetch(`${API}/conversations/send/${activeConv._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data?.success && data?.data) {
        setMessages(prev => prev.map(m => m._id === tempId ? { ...data.data } : m));
        setConversations(prev =>
          prev.map(c => c._id === activeConv._id
            ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() }
            : c
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => prev.filter(m => m._id !== tempId));
      setNewMsg(text);
    } finally {
      setSending(false);
    }
  };

  const openConv = (conv: any) => {
    setActiveConv(conv);
    setShowSidebar(false);
    setBannedWord(null);
    setShowWarning(false);
    setUnreadCounts(prev => {
      const updated = { ...prev };
      delete updated[conv._id];
      return updated;
    });
  };

  const activeOther = activeConv ? getOtherParticipant(activeConv) : null;
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  /* ── GROUP BY DATE ── */
  const grouped = messages.reduce((acc: any[], msg, i) => {
    const currDate = new Date(msg.createdAt).toDateString();
    const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
    if (currDate !== prevDate) {
      const label = currDate === new Date().toDateString() ? "Today" :
        new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
      acc.push({ type: "date", label });
    }
    acc.push({ type: "msg", ...msg });
    return acc;
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --primary: #4f46e5;
          --bg: #f0f2f5;
          --border: #e9edef;
          --text1: #111b21;
          --text2: #667781;
          --bubble-me: #dcf8c6;
          --bubble-them: #fff;
          --badge: #25d366;
        }
        .wa-root { display: flex; height: 100dvh; font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); overflow: hidden; position: relative; }

        /* SIDEBAR */
        .wa-sidebar { width: 380px; min-width: 380px; background: #fff; border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: transform 0.3s ease; z-index: 10; }
        .wa-sidebar-hdr { background: #f0f2f5; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
        .wa-sidebar-title { font-size: 19px; font-weight: 700; color: var(--text1); }
        .wa-total-badge { background: var(--badge); color: #fff; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 100px; min-width: 20px; text-align: center; }
        .wa-search-bar { padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .wa-search-wrap { position: relative; }
        .wa-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text2); }
        .wa-search-inp { width: 100%; background: #f0f2f5; border: none; border-radius: 8px; padding: 8px 12px 8px 34px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; color: var(--text1); }
        .wa-conv-list { flex: 1; overflow-y: auto; }
        .wa-conv-list::-webkit-scrollbar { width: 3px; }
        .wa-conv-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
        .wa-conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f5f6f6; transition: background 0.15s; position: relative; }
        .wa-conv-item:hover { background: #f5f6f6; }
        .wa-conv-item.active { background: #f0f2f5; }
        .wa-conv-item.unread .wa-conv-name { font-weight: 700; color: #111; }
        .wa-conv-item.unread .wa-conv-last { font-weight: 600; color: #111; }
        .wa-conv-av { width: 49px; height: 49px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; position: relative; }
        .wa-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .wa-conv-info { flex: 1; min-width: 0; }
        .wa-conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
        .wa-conv-name { font-size: 15px; font-weight: 600; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .wa-conv-time { font-size: 11px; color: var(--text2); }
        .wa-conv-time.unread-time { color: var(--badge); font-weight: 600; }
        .wa-conv-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .wa-conv-last { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
        .wa-unread-badge { background: var(--badge); color: #fff; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 100px; display: flex; align-items: center; justify-content: center; padding: 0 5px; flex-shrink: 0; animation: badgePop 0.2s ease; }
        @keyframes badgePop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .wa-conv-empty { padding: 40px 20px; text-align: center; color: var(--text2); font-size: 14px; }

        /* CHAT */
        .wa-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #efeae2; position: relative; }
        .wa-chat::before { content: ''; position: absolute; inset: 0; opacity: 0.08; background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events: none; z-index: 0; }
        .wa-chat-hdr { background: #fff; padding: 10px 16px; display: flex; align-items: center; gap: 12px; height: 60px; border-bottom: 1px solid var(--border); position: relative; z-index: 2; cursor: pointer; transition: background 0.15s; }
        .wa-chat-hdr:hover { background: #f5f6f6; }
        .wa-back-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text2); padding: 4px 8px 4px 0; line-height: 1; }
        .wa-chat-av { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
        .wa-chat-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .wa-chat-name { font-size: 15px; font-weight: 600; color: var(--text1); }
        .wa-chat-sub  { font-size: 12px; color: var(--text2); margin-top: 1px; }

        /* 🛡️ PLATFORM SAFETY CHIP in chat header */
        .wa-safe-chip { margin-left: auto; display: flex; align-items: center; gap: 5px; padding: 4px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 100px; font-size: 11px; font-weight: 600; color: #166534; flex-shrink: 0; }

        /* MESSAGES */
        .wa-messages { flex: 1; overflow-y: auto; padding: 12px 8%; display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
        .wa-messages::-webkit-scrollbar { width: 3px; }
        .wa-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
        .wa-date-lbl { text-align: center; margin: 8px 0; }
        .wa-date-lbl span { background: #e1f2fb; color: #54656f; font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
        .wa-bwrap { display: flex; margin-bottom: 1px; }
        .wa-bwrap.me   { justify-content: flex-end; }
        .wa-bwrap.them { justify-content: flex-start; }
        .wa-bubble { max-width: 65%; padding: 7px 10px 5px; border-radius: 8px; font-size: 14px; line-height: 1.5; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.1); word-break: break-word; }
        .wa-bubble.me   { background: var(--bubble-me); border-top-right-radius: 2px; }
        .wa-bubble.them { background: var(--bubble-them); border-top-left-radius: 2px; }
        .wa-bubble.temp { opacity: 0.75; }
        .wa-bubble.flagged { border: 2px solid #fbbf24 !important; background: #fffbeb !important; }
        .wa-tail-me   { position: absolute; top: 0; right: -8px; width: 0; height: 0; border-left: 8px solid var(--bubble-me); border-bottom: 8px solid transparent; }
        .wa-tail-them { position: absolute; top: 0; left: -8px; width: 0; height: 0; border-right: 8px solid var(--bubble-them); border-bottom: 8px solid transparent; }
        .wa-bmeta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
        .wa-btime { font-size: 10.5px; color: #667781; }
        .wa-tick { font-size: 11px; color: #53bdeb; }
        .wa-tick.pending { color: #aaa; }
        .wa-flagged-label { font-size: 10px; font-weight: 700; color: #d97706; margin-bottom: 3px; }

        /* 🚨 WARNING BANNER */
        .wa-keyword-warning {
          margin: 0 12px 8px;
          padding: 10px 14px;
          background: #fffbeb;
          border: 1.5px solid #fbbf24;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #92400e;
          line-height: 1.6;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          position: relative;
          z-index: 2;
          animation: slideUpWarn 0.2s ease;
        }
        @keyframes slideUpWarn { from{transform:translateY(6px);opacity:0}to{transform:translateY(0);opacity:1} }
        .wa-warn-icon { font-size: 16px; flex-shrink: 0; }
        .wa-warn-dismiss { margin-left: auto; font-size: 14px; cursor: pointer; color: #b45309; flex-shrink: 0; line-height: 1; padding: 0 2px; }

        /* INPUT */
        .wa-input-bar { background: var(--bg); padding: 8px 16px; display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; flex-direction: column; }
        .wa-input-row  { width: 100%; display: flex; align-items: center; gap: 10px; }
        .wa-input-wrap { flex: 1; background: #fff; border-radius: 26px; display: flex; align-items: center; padding: 9px 16px; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: box-shadow 0.2s; }
        .wa-input-wrap.blocked { box-shadow: 0 0 0 2px #ef4444; background: #fff5f5; }
        .wa-input { flex: 1; border: none; outline: none; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text1); background: transparent; }
        .wa-send-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, transform 0.15s; box-shadow: 0 2px 8px rgba(79,70,229,0.35); }
        .wa-send-btn:hover { background: #4338ca; transform: scale(1.05); }
        .wa-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .wa-send-btn.blocked-btn { background: linear-gradient(135deg,#ef4444,#dc2626); box-shadow: 0 2px 8px rgba(239,68,68,0.35); }
        .wa-blocked-hint { width: 100%; text-align: center; font-size: 11px; font-weight: 600; color: #ef4444; padding: 0 0 2px; }

        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-5px)} 40%,80%{transform:translateX(5px)} }
        .shake { animation: shake 0.4s ease !important; }

        /* NO CONV */
        .wa-no-conv { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; position: relative; z-index: 1; border-left: 1px solid var(--border); background: #f8f9fa; }
        .wa-no-conv-icon  { font-size: 56px; opacity: 0.25; }
        .wa-no-conv-title { font-size: 26px; font-weight: 300; color: var(--text1); }
        .wa-no-conv-sub   { font-size: 14px; color: var(--text2); }

        /* PROFILE PANEL */
        .prof-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: flex-start; justify-content: flex-end; animation: fadeIn 0.18s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .prof-panel { width: 360px; height: 100dvh; background: #fff; display: flex; flex-direction: column; animation: slideRight 0.22s ease; overflow-y: auto; }
        @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .prof-cover { background: #111b21; padding: 50px 24px 28px; display: flex; flex-direction: column; align-items: center; position: relative; }
        .prof-close { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
        .prof-close:hover { background: rgba(255,255,255,0.22); }
        .prof-av-big { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 800; color: #fff; overflow: hidden; cursor: zoom-in; transition: transform 0.2s; margin-bottom: 14px; border: 3px solid rgba(255,255,255,0.15); }
        .prof-av-big:hover { transform: scale(1.04); }
        .prof-av-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .prof-cover-name { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; text-align: center; }
        .prof-cover-role { font-size: 13px; color: rgba(255,255,255,0.55); }
        .prof-section { padding: 16px 20px; border-bottom: 8px solid #f0f2f5; }
        .prof-sec-label { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
        .prof-row { display: flex; align-items: flex-start; gap: 16px; padding: 8px 0; }
        .prof-row-icon { font-size: 18px; color: var(--text2); width: 22px; text-align: center; flex-shrink: 0; margin-top: 1px; }
        .prof-row-text { font-size: 14px; color: var(--text1); line-height: 1.5; }
        .prof-tag-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .prof-tag { padding: 4px 12px; background: #eef2ff; color: var(--primary); border-radius: 100px; font-size: 12px; font-weight: 600; }
        .prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); border-radius: 12px; overflow: hidden; }
        .prof-stat { background: #fff; padding: 14px 8px; text-align: center; }
        .prof-stat-num { font-size: 18px; font-weight: 800; color: var(--text1); }
        .prof-stat-lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

        /* DP FULLSCREEN */
        .dp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.93); z-index: 200; display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: fadeIn 0.18s ease; }
        .dp-img  { max-width: 90vw; max-height: 90dvh; border-radius: 50%; object-fit: cover; animation: zoomIn 0.2s ease; }
        .dp-init { width: min(80vw,80dvh); height: min(80vw,80dvh); border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: clamp(60px,15vw,140px); font-weight: 800; color: #fff; animation: zoomIn 0.2s ease; }
        @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { width: 24px; height: 24px; border: 2.5px solid #e0e0e0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
        .spin-wrap { display: flex; justify-content: center; padding: 30px; }

        /* MOBILE */
        @media (max-width: 768px) {
          .wa-sidebar { position: fixed; inset: 0; width: 100% !important; min-width: unset; z-index: 20; }
          .wa-sidebar.hidden { transform: translateX(-100%); }
          .wa-chat { position: fixed; inset: 0; }
          .wa-chat.hidden { display: none; }
          .wa-back-btn { display: block !important; }
          .wa-bubble { max-width: 82%; }
          .wa-no-conv { display: none; }
          .prof-panel { width: 100%; }
          .wa-messages { padding: 12px 4%; }
          .wa-safe-chip { display: none; }
        }
      `}</style>

      <div className="wa-root">
        {/* SIDEBAR */}
        <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
          <div className="wa-sidebar-hdr">
            <span className="wa-sidebar-title">Messages</span>
            {totalUnread > 0 && (
              <span className="wa-total-badge">{totalUnread > 99 ? "99+" : totalUnread}</span>
            )}
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
            ) : conversations.map((conv) => {
              const other   = getOtherParticipant(conv);
              const av      = getAvatar(other);
              const name    = getName(other);
              const unread  = unreadCounts[conv._id] || 0;
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
                      <span className={`wa-conv-time${unread > 0 && !isActive ? " unread-time" : ""}`}>
                        {formatTime(conv.updatedAt)}
                      </span>
                    </div>
                    <div className="wa-conv-bottom">
                      <div className="wa-conv-last">{conv.lastMessage || "Tap to open chat"}</div>
                      {unread > 0 && !isActive && (
                        <span className="wa-unread-badge">{unread > 99 ? "99+" : unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CHAT */}
        <div className={`wa-chat${showSidebar && !activeConv ? " hidden" : ""}`}>
          {activeConv ? (
            <>
              <div className="wa-chat-hdr" onClick={() => setSelectedProfile(activeOther)}>
                <button className="wa-back-btn" onClick={(e) => { e.stopPropagation(); setShowSidebar(true); setActiveConv(null); setMessages([]); setBannedWord(null); setShowWarning(false); }}>←</button>
                <div className="wa-chat-av">
                  {getAvatar(activeOther) ? <img src={getAvatar(activeOther)} alt="dp" /> : getInitial(activeOther)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="wa-chat-name">{getName(activeOther)}</div>
                  <div className="wa-chat-sub">{activeOther?.role || "tap for info"}</div>
                </div>
                {/* 🛡️ Safety chip */}
                <div className="wa-safe-chip">🔒 Platform Protected</div>
              </div>

              <div className="wa-messages">
                {grouped.map((item, i) =>
                  item.type === "date" ? (
                    <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
                  ) : (() => {
                    const senderId = (item.sender?._id || item.sender)?.toString();
                    const isMe     = myId && senderId === myId;
                    const isTemp   = item._temp === true;
                    const isFlagged = !!detectBannedKeyword(item.text || "");
                    return (
                      <div key={item._id || i} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
                        <div className={`wa-bubble ${isMe ? "me" : "them"}${isTemp ? " temp" : ""}${isFlagged ? " flagged" : ""}`}>
                          {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
                          {isFlagged && <div className="wa-flagged-label">⚠️ Flagged message</div>}
                          {item.text}
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

              {/* 🚨 WARNING BANNER — shows when typing banned keyword */}
              {showWarning && bannedWord && (
                <div className="wa-keyword-warning">
                  <span className="wa-warn-icon">🚫</span>
                  <div>
                    <strong>Restricted word detected: "{bannedWord}"</strong><br />
                    {WARNING_TEXT}
                  </div>
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
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder={bannedWord ? "⚠️ Remove restricted word to send..." : "Type a message"}
                      style={bannedWord ? { color: "#dc2626" } : undefined}
                    />
                  </div>
                  <button
                    className={`wa-send-btn${bannedWord ? " blocked-btn" : ""}`}
                    onClick={sendMessage}
                    disabled={!newMsg.trim()}
                    title={bannedWord ? "Cannot send — restricted content detected" : "Send"}>
                    {bannedWord
                      ? <span style={{fontSize:18}}>🚫</span>
                      : <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
                    }
                  </button>
                </div>
                {bannedWord && (
                  <div className="wa-blocked-hint">❌ Message blocked — remove "{bannedWord}" to continue</div>
                )}
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

      {/* PROFILE PANEL */}
      {selectedProfile && !showDp && (
        <div className="prof-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
          <div className="prof-panel">
            <div className="prof-cover">
              <button className="prof-close" onClick={() => setSelectedProfile(null)}>✕</button>
              <div className="prof-av-big" onClick={() => setShowDp(true)}>
                {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
              </div>
              <div className="prof-cover-name">{getName(selectedProfile)}</div>
              <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
            </div>
            <div className="prof-section">
              <div className="prof-stats">
                <div className="prof-stat">
                  <div className="prof-stat-num">{selectedProfile?.followers ? Number(selectedProfile.followers) >= 1000 ? Math.floor(Number(selectedProfile.followers) / 1000) + "K" : selectedProfile.followers : "—"}</div>
                  <div className="prof-stat-lbl">Followers</div>
                </div>
                <div className="prof-stat">
                  <div className="prof-stat-num">{Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}</div>
                  <div className="prof-stat-lbl">Niches</div>
                </div>
                <div className="prof-stat">
                  <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
                  <div className="prof-stat-lbl">Platform</div>
                </div>
              </div>
            </div>
            <div className="prof-section">
              <div className="prof-sec-label">About</div>
              {selectedProfile?.bio && <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>}
              {(selectedProfile?.location || selectedProfile?.city) && <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>}
              {selectedProfile?.email && <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>}
              {selectedProfile?.platform && (
                <div className="prof-row">
                  <span className="prof-row-icon">📸</span>
                  <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 14, textDecoration: "none", wordBreak: "break-all" }}>{selectedProfile.platform}</a>
                </div>
              )}
            </div>
            {selectedProfile?.categories && (
              <div className="prof-section">
                <div className="prof-sec-label">Niches</div>
                <div className="prof-tag-wrap">
                  {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).map((cat: string, i: number) => (
                    <span key={i} className="prof-tag">{cat}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FULLSCREEN DP */}
      {showDp && (
        <div className="dp-overlay" onClick={() => setShowDp(false)}>
          {getAvatar(selectedProfile)
            ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
            : <div className="dp-init">{getInitial(selectedProfile)}</div>}
        </div>
      )}
    </>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <MessagesInner />
    </Suspense>
  );
}


// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { io, Socket } from "socket.io-client";

// const API = "http://54.252.201.93:5000/api";
// const SOCKET_URL = "http://54.252.201.93:5000";

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [token, setToken] = useState<string>("");
//   const [myId, setMyId] = useState<string>("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loadingConvs, setLoadingConvs] = useState(true);
//   const [showSidebar, setShowSidebar] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [showDp, setShowDp] = useState(false);

//   // ✅ Unread counts per conversation
//   const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

//   const socketRef = useRef<Socket | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const activeConvRef = useRef<any>(null);
//   const inputRef = useRef<HTMLInputElement>(null);
//   const fetchedConversations = useRef(false);
//   const myIdRef = useRef<string>("");

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const cbUser = localStorage.getItem("cb_user");
//     if (cbUser) {
//       const parsed = JSON.parse(cbUser);
//       const tok = parsed.token || parsed.accessToken || "";
//       setToken(tok);
//       const id = parsed._id || parsed.id || parsed.user?._id || parsed.user?.id || "";
//       setMyId(id.toString());
//       myIdRef.current = id.toString();
//       return;
//     }
//     const t = localStorage.getItem("token") || "";
//     const u = localStorage.getItem("user");
//     setToken(t);
//     if (u) {
//       const parsed = JSON.parse(u);
//       const id = parsed._id || parsed.id || parsed.user?._id || "";
//       setMyId(id.toString());
//       myIdRef.current = id.toString();
//     }
//   }, []);

//   /* ── SOCKET ── */
//   useEffect(() => {
//     if (!token || !myId) return;
//     if (socketRef.current) return;
//     const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
//     socketRef.current = socket;
//     socket.on("connect", () => socket.emit("join", myId));
//     socket.on("newMessage", (msg: any) => {
//       const conv = activeConvRef.current;
//       const msgConvId = (msg.conversationId || msg.conversation)?.toString();
//       const senderId = (msg.sender?._id || msg.sender)?.toString();
//       const isMe = senderId === myIdRef.current;

//       if (conv && msgConvId === conv._id?.toString()) {
//         if (!isMe) {
//           setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
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
//       } else if (!isMe && msgConvId) {
//         // ✅ Message aaya kisi aur conversation mein — unread count badhao
//         setUnreadCounts(prev => ({
//           ...prev,
//           [msgConvId]: (prev[msgConvId] || 0) + 1,
//         }));
//       }

//       setConversations(prev =>
//         prev.map(c => c._id?.toString() === msgConvId
//           ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
//           : c
//         )
//       );
//     });
//     return () => { socket.disconnect(); socketRef.current = null; };
//   }, [token, myId]);

//   /* ── LOAD CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token || fetchedConversations.current) return;
//     fetchedConversations.current = true;
//     setLoadingConvs(true);
//     fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const convs = data?.data || [];
//         setConversations(convs);

//         // ✅ Backend se unreadCount field aata ho toh set karo
//         const counts: Record<string, number> = {};
//         convs.forEach((c: any) => {
//           if (c.unreadCount && c.unreadCount > 0) {
//             counts[c._id] = c.unreadCount;
//           }
//         });
//         if (Object.keys(counts).length > 0) setUnreadCounts(counts);

//         const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
//         if (targetUserId && convs.length > 0) {
//           const matched = convs.find((c: any) =>
//             c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//           );
//           if (matched) {
//             setActiveConv(matched);
//             setShowSidebar(false);
//             // Clear unread for auto-opened conv
//             setUnreadCounts(prev => { const n = { ...prev }; delete n[matched._id]; return n; });
//           }
//         }
//       })
//       .catch(console.error)
//       .finally(() => setLoadingConvs(false));
//   }, [token]);

//   /* ── LOAD MESSAGES ── */
//   useEffect(() => {
//     if (!token || !activeConv) return;
//     activeConvRef.current = activeConv;
//     fetch(`${API}/conversations/messages/${activeConv._id}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => setMessages(data?.data || []))
//       .catch(console.error);
//   }, [activeConv, token]);

//   /* ── AUTO SCROLL ── */
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ── HELPERS ── */
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => (p?._id || p)?.toString() !== myId);
//   };
//   const getName = (p: any): string => {
//     if (!p || typeof p === "string") return "User";
//     return p.name || p.username || p.fullName || p.email?.split("@")[0] || "User";
//   };
//   const getAvatar = (p: any): string => {
//     if (!p || typeof p === "string") return "";
//     return p.profileImage || p.avatar || p.photo || "";
//   };
//   const getInitial = (p: any) => getName(p).charAt(0).toUpperCase();
//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const diff = Date.now() - d.getTime();
//     if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     return d.toLocaleDateString([], { day: "2-digit", month: "short" });
//   };
//   const formatMsgTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   /* ── SEND ── */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending || !activeConv) return;
//     const text = newMsg.trim();
//     const tempId = `temp_${Date.now()}`;
//     const tempMsg = {
//       _id: tempId, text,
//       sender: myIdRef.current || myId,
//       conversationId: activeConv._id,
//       createdAt: new Date().toISOString(),
//       _temp: true,
//     };
//     setMessages(prev => [...prev, tempMsg]);
//     setNewMsg("");
//     inputRef.current?.focus();
//     try {
//       setSending(true);
//       const res = await fetch(`${API}/conversations/send/${activeConv._id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text }),
//       });
//       const data = await res.json();
//       if (data?.success && data?.data) {
//         setMessages(prev => prev.map(m => m._id === tempId ? { ...data.data } : m));
//         setConversations(prev =>
//           prev.map(c => c._id === activeConv._id
//             ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() }
//             : c
//           )
//         );
//       }
//     } catch (err) {
//       console.error(err);
//       setMessages(prev => prev.filter(m => m._id !== tempId));
//       setNewMsg(text);
//     } finally {
//       setSending(false);
//     }
//   };

//   // ✅ Open conv + clear unread badge
//   const openConv = (conv: any) => {
//     setActiveConv(conv);
//     setShowSidebar(false);
//     setUnreadCounts(prev => {
//       const updated = { ...prev };
//       delete updated[conv._id];
//       return updated;
//     });
//   };

//   const activeOther = activeConv ? getOtherParticipant(activeConv) : null;

//   // Total unread for all convs
//   const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

//   /* ── GROUP BY DATE ── */
//   const grouped = messages.reduce((acc: any[], msg, i) => {
//     const currDate = new Date(msg.createdAt).toDateString();
//     const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
//     if (currDate !== prevDate) {
//       const label = currDate === new Date().toDateString() ? "Today" :
//         new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
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
//           --primary: #4f46e5;
//           --bg: #f0f2f5;
//           --border: #e9edef;
//           --text1: #111b21;
//           --text2: #667781;
//           --bubble-me: #dcf8c6;
//           --bubble-them: #fff;
//           --badge: #25d366;
//         }
//         .wa-root { display: flex; height: 100dvh; font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); overflow: hidden; position: relative; }

//         /* SIDEBAR */
//         .wa-sidebar { width: 380px; min-width: 380px; background: #fff; border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: transform 0.3s ease; z-index: 10; }
//         .wa-sidebar-hdr { background: #f0f2f5; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
//         .wa-sidebar-title { font-size: 19px; font-weight: 700; color: var(--text1); }

//         /* ✅ Total unread pill in header */
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

//         .wa-conv-av { width: 49px; height: 49px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; position: relative; }
//         .wa-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

//         .wa-conv-info { flex: 1; min-width: 0; }
//         .wa-conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
//         .wa-conv-name { font-size: 15px; font-weight: 600; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
//         .wa-conv-time { font-size: 11px; color: var(--text2); }
//         .wa-conv-time.unread-time { color: var(--badge); font-weight: 600; }
//         .wa-conv-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
//         .wa-conv-last { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }

//         /* ✅ Green unread badge — WhatsApp style */
//         .wa-unread-badge {
//           background: var(--badge);
//           color: #fff;
//           font-size: 11px;
//           font-weight: 700;
//           min-width: 20px;
//           height: 20px;
//           border-radius: 100px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           padding: 0 5px;
//           flex-shrink: 0;
//           animation: badgePop 0.2s ease;
//         }
//         @keyframes badgePop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

//         .wa-conv-empty { padding: 40px 20px; text-align: center; color: var(--text2); font-size: 14px; }

//         /* CHAT */
//         .wa-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #efeae2; position: relative; }
//         .wa-chat::before { content: ''; position: absolute; inset: 0; opacity: 0.08; background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events: none; z-index: 0; }

//         .wa-chat-hdr { background: #fff; padding: 10px 16px; display: flex; align-items: center; gap: 12px; height: 60px; border-bottom: 1px solid var(--border); position: relative; z-index: 2; cursor: pointer; transition: background 0.15s; }
//         .wa-chat-hdr:hover { background: #f5f6f6; }
//         .wa-back-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text2); padding: 4px 8px 4px 0; line-height: 1; }
//         .wa-chat-av { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-chat-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-chat-name { font-size: 15px; font-weight: 600; color: var(--text1); }
//         .wa-chat-sub  { font-size: 12px; color: var(--text2); margin-top: 1px; }

//         /* MESSAGES */
//         .wa-messages { flex: 1; overflow-y: auto; padding: 12px 8%; display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
//         .wa-messages::-webkit-scrollbar { width: 3px; }
//         .wa-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-date-lbl { text-align: center; margin: 8px 0; }
//         .wa-date-lbl span { background: #e1f2fb; color: #54656f; font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
//         .wa-bwrap { display: flex; margin-bottom: 1px; }
//         .wa-bwrap.me   { justify-content: flex-end; }
//         .wa-bwrap.them { justify-content: flex-start; }
//         .wa-bubble { max-width: 65%; padding: 7px 10px 5px; border-radius: 8px; font-size: 14px; line-height: 1.5; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.1); word-break: break-word; }
//         .wa-bubble.me   { background: var(--bubble-me); border-top-right-radius: 2px; }
//         .wa-bubble.them { background: var(--bubble-them); border-top-left-radius: 2px; }
//         .wa-bubble.temp { opacity: 0.75; }
//         .wa-tail-me   { position: absolute; top: 0; right: -8px; width: 0; height: 0; border-left: 8px solid var(--bubble-me); border-bottom: 8px solid transparent; }
//         .wa-tail-them { position: absolute; top: 0; left: -8px; width: 0; height: 0; border-right: 8px solid var(--bubble-them); border-bottom: 8px solid transparent; }
//         .wa-bmeta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
//         .wa-btime { font-size: 10.5px; color: #667781; }
//         .wa-tick { font-size: 11px; color: #53bdeb; }
//         .wa-tick.pending { color: #aaa; }

//         /* INPUT */
//         .wa-input-bar { background: var(--bg); padding: 8px 16px; display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; }
//         .wa-input-wrap { flex: 1; background: #fff; border-radius: 26px; display: flex; align-items: center; padding: 9px 16px; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
//         .wa-input { flex: 1; border: none; outline: none; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text1); background: transparent; }
//         .wa-send-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, transform 0.15s; box-shadow: 0 2px 8px rgba(79,70,229,0.35); }
//         .wa-send-btn:hover { background: #4338ca; transform: scale(1.05); }
//         .wa-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

//         /* NO CONV */
//         .wa-no-conv { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; position: relative; z-index: 1; border-left: 1px solid var(--border); background: #f8f9fa; }
//         .wa-no-conv-icon  { font-size: 56px; opacity: 0.25; }
//         .wa-no-conv-title { font-size: 26px; font-weight: 300; color: var(--text1); }
//         .wa-no-conv-sub   { font-size: 14px; color: var(--text2); }

//         /* PROFILE PANEL */
//         .prof-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: flex-start; justify-content: flex-end; animation: fadeIn 0.18s ease; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .prof-panel { width: 360px; height: 100dvh; background: #fff; display: flex; flex-direction: column; animation: slideRight 0.22s ease; overflow-y: auto; }
//         @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
//         .prof-cover { background: #111b21; padding: 50px 24px 28px; display: flex; flex-direction: column; align-items: center; position: relative; }
//         .prof-close { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
//         .prof-close:hover { background: rgba(255,255,255,0.22); }
//         .prof-av-big { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 800; color: #fff; overflow: hidden; cursor: zoom-in; transition: transform 0.2s; margin-bottom: 14px; border: 3px solid rgba(255,255,255,0.15); }
//         .prof-av-big:hover { transform: scale(1.04); }
//         .prof-av-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .prof-cover-name { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; text-align: center; }
//         .prof-cover-role { font-size: 13px; color: rgba(255,255,255,0.55); }
//         .prof-section { padding: 16px 20px; border-bottom: 8px solid #f0f2f5; }
//         .prof-sec-label { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
//         .prof-row { display: flex; align-items: flex-start; gap: 16px; padding: 8px 0; }
//         .prof-row-icon { font-size: 18px; color: var(--text2); width: 22px; text-align: center; flex-shrink: 0; margin-top: 1px; }
//         .prof-row-text { font-size: 14px; color: var(--text1); line-height: 1.5; }
//         .prof-tag-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
//         .prof-tag { padding: 4px 12px; background: #eef2ff; color: var(--primary); border-radius: 100px; font-size: 12px; font-weight: 600; }
//         .prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); border-radius: 12px; overflow: hidden; }
//         .prof-stat { background: #fff; padding: 14px 8px; text-align: center; }
//         .prof-stat-num { font-size: 18px; font-weight: 800; color: var(--text1); }
//         .prof-stat-lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

//         /* DP FULLSCREEN */
//         .dp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.93); z-index: 200; display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: fadeIn 0.18s ease; }
//         .dp-img  { max-width: 90vw; max-height: 90dvh; border-radius: 50%; object-fit: cover; animation: zoomIn 0.2s ease; }
//         .dp-init { width: min(80vw,80dvh); height: min(80vw,80dvh); border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: clamp(60px,15vw,140px); font-weight: 800; color: #fff; animation: zoomIn 0.2s ease; }
//         @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spin { width: 24px; height: 24px; border: 2.5px solid #e0e0e0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
//         .spin-wrap { display: flex; justify-content: center; padding: 30px; }

//         /* MOBILE */
//         @media (max-width: 768px) {
//           .wa-sidebar { position: fixed; inset: 0; width: 100% !important; min-width: unset; z-index: 20; }
//           .wa-sidebar.hidden { transform: translateX(-100%); }
//           .wa-chat { position: fixed; inset: 0; }
//           .wa-chat.hidden { display: none; }
//           .wa-back-btn { display: block !important; }
//           .wa-bubble { max-width: 82%; }
//           .wa-no-conv { display: none; }
//           .prof-panel { width: 100%; }
//           .wa-messages { padding: 12px 4%; }
//         }
//       `}</style>

//       <div className="wa-root">
//         {/* SIDEBAR */}
//         <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
//           <div className="wa-sidebar-hdr">
//             <span className="wa-sidebar-title">Messages</span>
//             {/* ✅ Total unread badge in header */}
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
//             ) : conversations.map((conv) => {
//               const other   = getOtherParticipant(conv);
//               const av      = getAvatar(other);
//               const name    = getName(other);
//               const unread  = unreadCounts[conv._id] || 0;
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
//                       <div className="wa-conv-last">{conv.lastMessage || "Tap to open chat"}</div>
//                       {/* ✅ Green unread badge — WhatsApp style */}
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

//         {/* CHAT */}
//         <div className={`wa-chat${showSidebar && !activeConv ? " hidden" : ""}`}>
//           {activeConv ? (
//             <>
//               <div className="wa-chat-hdr" onClick={() => setSelectedProfile(activeOther)}>
//                 <button className="wa-back-btn" onClick={(e) => { e.stopPropagation(); setShowSidebar(true); setActiveConv(null); setMessages([]); }}>←</button>
//                 <div className="wa-chat-av">
//                   {getAvatar(activeOther) ? <img src={getAvatar(activeOther)} alt="dp" /> : getInitial(activeOther)}
//                 </div>
//                 <div style={{ flex: 1 }}>
//                   <div className="wa-chat-name">{getName(activeOther)}</div>
//                   <div className="wa-chat-sub">{activeOther?.role || "tap for info"}</div>
//                 </div>
//               </div>

//               <div className="wa-messages">
//                 {grouped.map((item, i) =>
//                   item.type === "date" ? (
//                     <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
//                   ) : (() => {
//                     const senderId = (item.sender?._id || item.sender)?.toString();
//                     const isMe     = myId && senderId === myId;
//                     const isTemp   = item._temp === true;
//                     return (
//                       <div key={item._id || i} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
//                         <div className={`wa-bubble ${isMe ? "me" : "them"}${isTemp ? " temp" : ""}`}>
//                           {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
//                           {item.text}
//                           <div className="wa-bmeta">
//                             <span className="wa-btime">{formatMsgTime(item.createdAt)}</span>
//                             {isMe && <span className={`wa-tick${isTemp ? " pending" : ""}`}>{isTemp ? "🕐" : "✓✓"}</span>}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })()
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               <div className="wa-input-bar">
//                 <div className="wa-input-wrap">
//                   <input
//                     ref={inputRef}
//                     className="wa-input"
//                     value={newMsg}
//                     onChange={(e) => setNewMsg(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                     placeholder="Type a message"
//                   />
//                 </div>
//                 <button className="wa-send-btn" onClick={sendMessage} disabled={!newMsg.trim()}>
//                   <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
//                 </button>
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

//       {/* PROFILE PANEL */}
//       {selectedProfile && !showDp && (
//         <div className="prof-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="prof-panel">
//             <div className="prof-cover">
//               <button className="prof-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="prof-av-big" onClick={() => setShowDp(true)}>
//                 {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
//               </div>
//               <div className="prof-cover-name">{getName(selectedProfile)}</div>
//               <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
//             </div>
//             <div className="prof-section">
//               <div className="prof-stats">
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{selectedProfile?.followers ? Number(selectedProfile.followers) >= 1000 ? Math.floor(Number(selectedProfile.followers) / 1000) + "K" : selectedProfile.followers : "—"}</div>
//                   <div className="prof-stat-lbl">Followers</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}</div>
//                   <div className="prof-stat-lbl">Niches</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
//                   <div className="prof-stat-lbl">Platform</div>
//                 </div>
//               </div>
//             </div>
//             <div className="prof-section">
//               <div className="prof-sec-label">About</div>
//               {selectedProfile?.bio && <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>}
//               {(selectedProfile?.location || selectedProfile?.city) && <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>}
//               {selectedProfile?.email && <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>}
//               {selectedProfile?.platform && (
//                 <div className="prof-row">
//                   <span className="prof-row-icon">📸</span>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 14, textDecoration: "none", wordBreak: "break-all" }}>{selectedProfile.platform}</a>
//                 </div>
//               )}
//             </div>
//             {selectedProfile?.categories && (
//               <div className="prof-section">
//                 <div className="prof-sec-label">Niches</div>
//                 <div className="prof-tag-wrap">
//                   {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).map((cat: string, i: number) => (
//                     <span key={i} className="prof-tag">{cat}</span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* FULLSCREEN DP */}
//       {showDp && (
//         <div className="dp-overlay" onClick={() => setShowDp(false)}>
//           {getAvatar(selectedProfile)
//             ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
//             : <div className="dp-init">{getInitial(selectedProfile)}</div>}
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { io, Socket } from "socket.io-client";

// const API = "http://54.252.201.93:5000/api";
// const SOCKET_URL = "http://54.252.201.93:5000";

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [token, setToken] = useState<string>("");
//   const [myId, setMyId] = useState<string>("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loadingConvs, setLoadingConvs] = useState(true);
//   const [showSidebar, setShowSidebar] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [showDp, setShowDp] = useState(false);

//   const socketRef = useRef<Socket | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const activeConvRef = useRef<any>(null);
//   const inputRef = useRef<HTMLInputElement>(null);
//   const fetchedConversations = useRef(false);
//   const myIdRef = useRef<string>("");

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const cbUser = localStorage.getItem("cb_user");
//     if (cbUser) {
//       const parsed = JSON.parse(cbUser);
//       const tok = parsed.token || parsed.accessToken || "";
//       setToken(tok);
//       const id = parsed._id || parsed.id || parsed.user?._id || parsed.user?.id || "";
//       setMyId(id.toString());
//       myIdRef.current = id.toString();
//       return;
//     }
//     const t = localStorage.getItem("token") || "";
//     const u = localStorage.getItem("user");
//     setToken(t);
//     if (u) {
//       const parsed = JSON.parse(u);
//       const id = parsed._id || parsed.id || parsed.user?._id || "";
//       setMyId(id.toString());
//       myIdRef.current = id.toString();
//     }
//   }, []);

//   /* ── SOCKET ── */
//   useEffect(() => {
//     if (!token || !myId) return;
//     if (socketRef.current) return;
//     const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
//     socketRef.current = socket;
//     socket.on("connect", () => socket.emit("join", myId));
//     socket.on("newMessage", (msg: any) => {
//       const conv = activeConvRef.current;
//       const msgConvId = (msg.conversationId || msg.conversation)?.toString();

//       if (conv && msgConvId === conv._id?.toString()) {
//         const senderId = (msg.sender?._id || msg.sender)?.toString();
//         const isMe = senderId === myIdRef.current;
//         if (!isMe) {
//           // ✅ Sirf dusre ka message add karo — apna pehle se temp se add ho chuka hai
//           setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
//         } else {
//           // ✅ Apna temp message real _id se replace karo
//           setMessages(prev => {
//             const hasReal = prev.some(m => m._id === msg._id);
//             if (hasReal) return prev;
//             // Replace last temp message
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
//       }

//       setConversations(prev =>
//         prev.map(c => c._id?.toString() === msgConvId
//           ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
//           : c
//         )
//       );
//     });
//     return () => { socket.disconnect(); socketRef.current = null; };
//   }, [token, myId]);

//   /* ── LOAD CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token || fetchedConversations.current) return;
//     fetchedConversations.current = true;
//     setLoadingConvs(true);
//     fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const convs = data?.data || [];
//         setConversations(convs);
//         const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
//         if (targetUserId && convs.length > 0) {
//           const matched = convs.find((c: any) =>
//             c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//           );
//           if (matched) { setActiveConv(matched); setShowSidebar(false); }
//         }
//       })
//       .catch(console.error)
//       .finally(() => setLoadingConvs(false));
//   }, [token]);

//   /* ── LOAD MESSAGES ── */
//   useEffect(() => {
//     if (!token || !activeConv) return;
//     activeConvRef.current = activeConv;
//     fetch(`${API}/conversations/messages/${activeConv._id}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => setMessages(data?.data || []))
//       .catch(console.error);
//   }, [activeConv, token]);

//   /* ── AUTO SCROLL ── */
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ── HELPERS ── */
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => (p?._id || p)?.toString() !== myId);
//   };
//   const getName = (p: any): string => {
//     if (!p || typeof p === "string") return "User";
//     return p.name || p.username || p.fullName || p.email?.split("@")[0] || "User";
//   };
//   const getAvatar = (p: any): string => {
//     if (!p || typeof p === "string") return "";
//     return p.profileImage || p.avatar || p.photo || "";
//   };
//   const getInitial = (p: any) => getName(p).charAt(0).toUpperCase();
//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const diff = Date.now() - d.getTime();
//     if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     return d.toLocaleDateString([], { day: "2-digit", month: "short" });
//   };
//   const formatMsgTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   /* ── SEND — KEY FIX ── */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending || !activeConv) return;

//     const text = newMsg.trim();

//     // ✅ STEP 1: Turant screen pe dikhao — API ka wait mat karo
//     const tempId = `temp_${Date.now()}`;
//     const tempMsg = {
//       _id: tempId,
//       text,
//       sender: myIdRef.current || myId,
//       conversationId: activeConv._id,
//       createdAt: new Date().toISOString(),
//       _temp: true,
//     };
//     setMessages(prev => [...prev, tempMsg]);
//     setNewMsg(""); // ✅ Input clear karo turant
//     inputRef.current?.focus();

//     try {
//       setSending(true);
//       const res = await fetch(`${API}/conversations/send/${activeConv._id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text }),
//       });
//       const data = await res.json();

//       if (data?.success && data?.data) {
//         // ✅ STEP 2: Temp message ko real message se replace karo
//         setMessages(prev =>
//           prev.map(m => m._id === tempId ? { ...data.data } : m)
//         );
//         setConversations(prev =>
//           prev.map(c => c._id === activeConv._id
//             ? { ...c, lastMessage: text, updatedAt: new Date().toISOString() }
//             : c
//           )
//         );
//       }
//     } catch (err) {
//       console.error(err);
//       // ✅ Error pe temp hatao aur text wapas do
//       setMessages(prev => prev.filter(m => m._id !== tempId));
//       setNewMsg(text);
//     } finally {
//       setSending(false);
//     }
//   };

//   const openConv = (conv: any) => { setActiveConv(conv); setShowSidebar(false); };
//   const activeOther = activeConv ? getOtherParticipant(activeConv) : null;

//   /* ── GROUP BY DATE ── */
//   const grouped = messages.reduce((acc: any[], msg, i) => {
//     const currDate = new Date(msg.createdAt).toDateString();
//     const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
//     if (currDate !== prevDate) {
//       const label = currDate === new Date().toDateString() ? "Today" :
//         new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
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
//           --primary: #4f46e5;
//           --bg: #f0f2f5;
//           --border: #e9edef;
//           --text1: #111b21;
//           --text2: #667781;
//           --bubble-me: #dcf8c6;
//           --bubble-them: #fff;
//           --online: #25d366;
//         }
//         .wa-root { display: flex; height: 100dvh; font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); overflow: hidden; position: relative; }
//         .wa-sidebar { width: 380px; min-width: 380px; background: #fff; border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: transform 0.3s ease; z-index: 10; }
//         .wa-sidebar-hdr { background: #f0f2f5; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
//         .wa-sidebar-title { font-size: 19px; font-weight: 700; color: var(--text1); }
//         .wa-search-bar { padding: 8px 12px; border-bottom: 1px solid var(--border); }
//         .wa-search-wrap { position: relative; }
//         .wa-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text2); }
//         .wa-search-inp { width: 100%; background: #f0f2f5; border: none; border-radius: 8px; padding: 8px 12px 8px 34px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; color: var(--text1); }
//         .wa-conv-list { flex: 1; overflow-y: auto; }
//         .wa-conv-list::-webkit-scrollbar { width: 3px; }
//         .wa-conv-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f5f6f6; transition: background 0.15s; }
//         .wa-conv-item:hover { background: #f5f6f6; }
//         .wa-conv-item.active { background: #f0f2f5; }
//         .wa-conv-av { width: 49px; height: 49px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-conv-info { flex: 1; min-width: 0; }
//         .wa-conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
//         .wa-conv-name { font-size: 15px; font-weight: 600; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
//         .wa-conv-time { font-size: 11px; color: var(--text2); }
//         .wa-conv-last { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .wa-conv-empty { padding: 40px 20px; text-align: center; color: var(--text2); font-size: 14px; }
//         .wa-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #efeae2; position: relative; }
//         .wa-chat::before { content: ''; position: absolute; inset: 0; opacity: 0.08; background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events: none; z-index: 0; }
//         .wa-chat-hdr { background: #fff; padding: 10px 16px; display: flex; align-items: center; gap: 12px; height: 60px; border-bottom: 1px solid var(--border); position: relative; z-index: 2; cursor: pointer; transition: background 0.15s; }
//         .wa-chat-hdr:hover { background: #f5f6f6; }
//         .wa-back-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text2); padding: 4px 8px 4px 0; line-height: 1; }
//         .wa-chat-av { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-chat-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-chat-name { font-size: 15px; font-weight: 600; color: var(--text1); }
//         .wa-chat-sub { font-size: 12px; color: var(--text2); margin-top: 1px; }
//         .wa-messages { flex: 1; overflow-y: auto; padding: 12px 8%; display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
//         .wa-messages::-webkit-scrollbar { width: 3px; }
//         .wa-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-date-lbl { text-align: center; margin: 8px 0; }
//         .wa-date-lbl span { background: #e1f2fb; color: #54656f; font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
//         .wa-bwrap { display: flex; margin-bottom: 1px; }
//         .wa-bwrap.me { justify-content: flex-end; }
//         .wa-bwrap.them { justify-content: flex-start; }
//         .wa-bubble { max-width: 65%; padding: 7px 10px 5px; border-radius: 8px; font-size: 14px; line-height: 1.5; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.1); word-break: break-word; }
//         .wa-bubble.me { background: var(--bubble-me); border-top-right-radius: 2px; }
//         .wa-bubble.them { background: var(--bubble-them); border-top-left-radius: 2px; }
//         .wa-bubble.temp { opacity: 0.75; }
//         .wa-tail-me { position: absolute; top: 0; right: -8px; width: 0; height: 0; border-left: 8px solid var(--bubble-me); border-bottom: 8px solid transparent; }
//         .wa-tail-them { position: absolute; top: 0; left: -8px; width: 0; height: 0; border-right: 8px solid var(--bubble-them); border-bottom: 8px solid transparent; }
//         .wa-bmeta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
//         .wa-btime { font-size: 10.5px; color: #667781; }
//         .wa-tick { font-size: 11px; color: #53bdeb; }
//         .wa-tick.pending { color: #aaa; }
//         .wa-input-bar { background: var(--bg); padding: 8px 16px; display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; }
//         .wa-input-wrap { flex: 1; background: #fff; border-radius: 26px; display: flex; align-items: center; padding: 9px 16px; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
//         .wa-input { flex: 1; border: none; outline: none; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text1); background: transparent; }
//         .wa-send-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, transform 0.15s; box-shadow: 0 2px 8px rgba(79,70,229,0.35); }
//         .wa-send-btn:hover { background: #4338ca; transform: scale(1.05); }
//         .wa-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
//         .wa-no-conv { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; position: relative; z-index: 1; border-left: 1px solid var(--border); background: #f8f9fa; }
//         .wa-no-conv-icon { font-size: 56px; opacity: 0.25; }
//         .wa-no-conv-title { font-size: 26px; font-weight: 300; color: var(--text1); }
//         .wa-no-conv-sub { font-size: 14px; color: var(--text2); }
//         .prof-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: flex-start; justify-content: flex-end; animation: fadeIn 0.18s ease; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .prof-panel { width: 360px; height: 100dvh; background: #fff; display: flex; flex-direction: column; animation: slideRight 0.22s ease; overflow-y: auto; }
//         @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
//         .prof-cover { background: #111b21; padding: 50px 24px 28px; display: flex; flex-direction: column; align-items: center; position: relative; }
//         .prof-close { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
//         .prof-close:hover { background: rgba(255,255,255,0.22); }
//         .prof-av-big { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 800; color: #fff; overflow: hidden; cursor: zoom-in; transition: transform 0.2s; margin-bottom: 14px; border: 3px solid rgba(255,255,255,0.15); }
//         .prof-av-big:hover { transform: scale(1.04); }
//         .prof-av-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .prof-cover-name { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; text-align: center; }
//         .prof-cover-role { font-size: 13px; color: rgba(255,255,255,0.55); }
//         .prof-section { padding: 16px 20px; border-bottom: 8px solid #f0f2f5; }
//         .prof-sec-label { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
//         .prof-row { display: flex; align-items: flex-start; gap: 16px; padding: 8px 0; }
//         .prof-row-icon { font-size: 18px; color: var(--text2); width: 22px; text-align: center; flex-shrink: 0; margin-top: 1px; }
//         .prof-row-text { font-size: 14px; color: var(--text1); line-height: 1.5; }
//         .prof-tag-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
//         .prof-tag { padding: 4px 12px; background: #eef2ff; color: var(--primary); border-radius: 100px; font-size: 12px; font-weight: 600; }
//         .prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); border-radius: 12px; overflow: hidden; }
//         .prof-stat { background: #fff; padding: 14px 8px; text-align: center; }
//         .prof-stat-num { font-size: 18px; font-weight: 800; color: var(--text1); }
//         .prof-stat-lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
//         .dp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.93); z-index: 200; display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: fadeIn 0.18s ease; }
//         .dp-img { max-width: 90vw; max-height: 90dvh; border-radius: 50%; object-fit: cover; animation: zoomIn 0.2s ease; }
//         .dp-init { width: min(80vw,80dvh); height: min(80vw,80dvh); border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: clamp(60px,15vw,140px); font-weight: 800; color: #fff; animation: zoomIn 0.2s ease; }
//         @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spin { width: 24px; height: 24px; border: 2.5px solid #e0e0e0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
//         .spin-wrap { display: flex; justify-content: center; padding: 30px; }
//         @media (max-width: 768px) {
//           .wa-sidebar { position: fixed; inset: 0; width: 100% !important; min-width: unset; z-index: 20; }
//           .wa-sidebar.hidden { transform: translateX(-100%); }
//           .wa-chat { position: fixed; inset: 0; }
//           .wa-chat.hidden { display: none; }
//           .wa-back-btn { display: block !important; }
//           .wa-bubble { max-width: 82%; }
//           .wa-no-conv { display: none; }
//           .prof-panel { width: 100%; }
//           .wa-messages { padding: 12px 4%; }
//         }
//       `}</style>

//       <div className="wa-root">
//         {/* SIDEBAR */}
//         <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
//           <div className="wa-sidebar-hdr">
//             <span className="wa-sidebar-title">Messages</span>
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
//             ) : conversations.map((conv) => {
//               const other = getOtherParticipant(conv);
//               const av = getAvatar(other);
//               const name = getName(other);
//               return (
//                 <div key={conv._id} className={`wa-conv-item${activeConv?._id === conv._id ? " active" : ""}`} onClick={() => openConv(conv)}>
//                   <div className="wa-conv-av">{av ? <img src={av} alt={name} /> : getInitial(other)}</div>
//                   <div className="wa-conv-info">
//                     <div className="wa-conv-top">
//                       <span className="wa-conv-name">{name}</span>
//                       <span className="wa-conv-time">{formatTime(conv.updatedAt)}</span>
//                     </div>
//                     <div className="wa-conv-last">{conv.lastMessage || "Tap to open chat"}</div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* CHAT */}
//         <div className={`wa-chat${showSidebar && !activeConv ? " hidden" : ""}`}>
//           {activeConv ? (
//             <>
//               <div className="wa-chat-hdr" onClick={() => setSelectedProfile(activeOther)}>
//                 <button className="wa-back-btn" onClick={(e) => { e.stopPropagation(); setShowSidebar(true); setActiveConv(null); setMessages([]); }}>←</button>
//                 <div className="wa-chat-av">
//                   {getAvatar(activeOther) ? <img src={getAvatar(activeOther)} alt="dp" /> : getInitial(activeOther)}
//                 </div>
//                 <div style={{ flex: 1 }}>
//                   <div className="wa-chat-name">{getName(activeOther)}</div>
//                   <div className="wa-chat-sub">{activeOther?.role || "tap for info"}</div>
//                 </div>
//               </div>

//               <div className="wa-messages">
//                 {grouped.map((item, i) =>
//                   item.type === "date" ? (
//                     <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
//                   ) : (() => {
//                     const senderId = (item.sender?._id || item.sender)?.toString();
//                     const isMe = myId && senderId === myId;
//                     const isTemp = item._temp === true;
//                     return (
//                       <div key={item._id || i} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
//                         <div className={`wa-bubble ${isMe ? "me" : "them"}${isTemp ? " temp" : ""}`}>
//                           {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
//                           {item.text}
//                           <div className="wa-bmeta">
//                             <span className="wa-btime">{formatMsgTime(item.createdAt)}</span>
//                             {/* ✅ Pending clock vs sent ticks */}
//                             {isMe && <span className={`wa-tick${isTemp ? " pending" : ""}`}>{isTemp ? "🕐" : "✓✓"}</span>}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })()
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               <div className="wa-input-bar">
//                 <div className="wa-input-wrap">
//                   <input
//                     ref={inputRef}
//                     className="wa-input"
//                     value={newMsg}
//                     onChange={(e) => setNewMsg(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                     placeholder="Type a message"
//                   />
//                 </div>
//                 <button className="wa-send-btn" onClick={sendMessage} disabled={!newMsg.trim()}>
//                   <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
//                 </button>
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

//       {/* PROFILE PANEL */}
//       {selectedProfile && !showDp && (
//         <div className="prof-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="prof-panel">
//             <div className="prof-cover">
//               <button className="prof-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="prof-av-big" onClick={() => setShowDp(true)}>
//                 {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
//               </div>
//               <div className="prof-cover-name">{getName(selectedProfile)}</div>
//               <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
//             </div>
//             <div className="prof-section">
//               <div className="prof-stats">
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{selectedProfile?.followers ? Number(selectedProfile.followers) >= 1000 ? Math.floor(Number(selectedProfile.followers) / 1000) + "K" : selectedProfile.followers : "—"}</div>
//                   <div className="prof-stat-lbl">Followers</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}</div>
//                   <div className="prof-stat-lbl">Niches</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
//                   <div className="prof-stat-lbl">Platform</div>
//                 </div>
//               </div>
//             </div>
//             <div className="prof-section">
//               <div className="prof-sec-label">About</div>
//               {selectedProfile?.bio && <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>}
//               {(selectedProfile?.location || selectedProfile?.city) && <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>}
//               {selectedProfile?.email && <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>}
//               {selectedProfile?.platform && (
//                 <div className="prof-row">
//                   <span className="prof-row-icon">📸</span>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 14, textDecoration: "none", wordBreak: "break-all" }}>{selectedProfile.platform}</a>
//                 </div>
//               )}
//             </div>
//             {selectedProfile?.categories && (
//               <div className="prof-section">
//                 <div className="prof-sec-label">Niches</div>
//                 <div className="prof-tag-wrap">
//                   {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).map((cat: string, i: number) => (
//                     <span key={i} className="prof-tag">{cat}</span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* FULLSCREEN DP */}
//       {showDp && (
//         <div className="dp-overlay" onClick={() => setShowDp(false)}>
//           {getAvatar(selectedProfile)
//             ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
//             : <div className="dp-init">{getInitial(selectedProfile)}</div>}
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }


// "use client";

// import { useEffect, useState, useRef, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { io, Socket } from "socket.io-client";

// const API = "http://54.252.201.93:5000/api";
// const SOCKET_URL = "http://54.252.201.93:5000";

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [token, setToken] = useState<string>("");
//   const [myId, setMyId] = useState<string>("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loadingConvs, setLoadingConvs] = useState(true);
//   const [showSidebar, setShowSidebar] = useState(true);
//   const [selectedProfile, setSelectedProfile] = useState<any>(null);
//   const [showDp, setShowDp] = useState(false);

//   const socketRef = useRef<Socket | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const activeConvRef = useRef<any>(null);
//   const inputRef = useRef<HTMLInputElement>(null);
//   const fetchedConversations = useRef(false);
//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const cbUser = localStorage.getItem("cb_user");
//     if (cbUser) {
//       const parsed = JSON.parse(cbUser);
//       const tok = parsed.token || parsed.accessToken || "";
//       setToken(tok);
//       const id = parsed._id || parsed.id || parsed.user?._id || parsed.user?.id || "";
//       setMyId(id.toString());
//       return;
//     }
//     const t = localStorage.getItem("token") || "";
//     const u = localStorage.getItem("user");
//     setToken(t);
//     if (u) {
//       const parsed = JSON.parse(u);
//       const id = parsed._id || parsed.id || parsed.user?._id || "";
//       setMyId(id.toString());
//     }
//   }, []);

//   /* ── SOCKET ── */
//   useEffect(() => {
//     if (!token || !myId) return;
//     if (socketRef.current) return;
//     const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
//     socketRef.current = socket;
//     socket.on("connect", () => socket.emit("join", myId));
//     socket.on("newMessage", (msg: any) => {
//       const conv = activeConvRef.current;
//       if (!conv) return;
//       const msgConvId = (msg.conversationId || msg.conversation)?.toString();
//       if (msgConvId === conv._id?.toString()) {
//         setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
//       }
//       setConversations(prev =>
//         prev.map(c => c._id?.toString() === msgConvId
//           ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
//           : c
//         )
//       );
//     });
//     return () => { socket.disconnect(); socketRef.current = null; };
//   }, [token, myId]);

 
//  /* ── LOAD CONVERSATIONS ── */
//  useEffect(() => {
//   if (!token || fetchedConversations.current) return;

//   fetchedConversations.current = true;
//   setLoadingConvs(true);

//   fetch(`${API}/conversations/my`, {
//     headers: { Authorization: `Bearer ${token}` },
//   })
//     .then(r => r.json())
//     .then(data => {
//       const convs = data?.data || [];
//       setConversations(convs);

//       const targetUserId = searchParams?.get("userId") || searchParams?.get("with");

//       if (targetUserId && convs.length > 0) {
//         const matched = convs.find((c: any) =>
//           c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//         );

//         if (matched) {
//           setActiveConv(matched);
//           setShowSidebar(false);
//         }
//       }
//     })
//     .catch(console.error)
//     .finally(() => setLoadingConvs(false));

// }, [token]);
//   // useEffect(() => {
//   //   if (!token) return;
//   //   setLoadingConvs(true);
//   //   fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//   //     .then(r => r.json())
//   //     .then(data => {
//   //       const convs = data?.data || [];
//   //       setConversations(convs);
//   //       const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
//   //       if (targetUserId && convs.length > 0) {
//   //         const matched = convs.find((c: any) =>
//   //           c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//   //         );
//   //         if (matched) { setActiveConv(matched); setShowSidebar(false); }
//   //       }
//   //     })
//   //     .catch(console.error)
//   //     .finally(() => setLoadingConvs(false));
//   // }, [token]);

//   /* ── LOAD MESSAGES ── */
//   useEffect(() => {
//     if (!token || !activeConv) return;
//     activeConvRef.current = activeConv;
//     fetch(`${API}/conversations/messages/${activeConv._id}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => setMessages(data?.data || []))
//       .catch(console.error);
//   }, [activeConv, token]);

//   /* ── AUTO SCROLL ── */
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ── HELPERS ── */
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => (p?._id || p)?.toString() !== myId);
//   };
//   const getName = (p: any): string => {
//     if (!p || typeof p === "string") return "User";
//     return p.name || p.username || p.fullName || p.email?.split("@")[0] || "User";
//   };
//   const getAvatar = (p: any): string => {
//     if (!p || typeof p === "string") return "";
//     return p.profileImage || p.avatar || p.photo || "";
//   };
//   const getInitial = (p: any) => getName(p).charAt(0).toUpperCase();

//   const formatTime = (date: string) => {
//     if (!date) return "";
//     const d = new Date(date);
//     const diff = Date.now() - d.getTime();
//     if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//     return d.toLocaleDateString([], { day: "2-digit", month: "short" });
//   };

//   const formatMsgTime = (date: string) => {
//     if (!date) return "";
//     return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//   };

//   /* ── SEND ── */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending || !activeConv) return;
//     try {
//       setSending(true);
//       const res = await fetch(`${API}/conversations/send/${activeConv._id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       const data = await res.json();
//       if (data?.success) setNewMsg("");
//     } catch (err) { console.error(err); }
//     finally { setSending(false); inputRef.current?.focus(); }
//   };

//   const openConv = (conv: any) => { setActiveConv(conv); setShowSidebar(false); };
//   const activeOther = activeConv ? getOtherParticipant(activeConv) : null;

//   /* ── GROUP BY DATE ── */
//   const grouped = messages.reduce((acc: any[], msg, i) => {
//     const currDate = new Date(msg.createdAt).toDateString();
//     const prevDate = messages[i - 1] ? new Date(messages[i - 1].createdAt).toDateString() : null;
//     if (currDate !== prevDate) {
//       const label = currDate === new Date().toDateString() ? "Today" :
//         new Date(msg.createdAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
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
//           --primary: #4f46e5;
//           --bg: #f0f2f5;
//           --border: #e9edef;
//           --text1: #111b21;
//           --text2: #667781;
//           --bubble-me: #dcf8c6;
//           --bubble-them: #fff;
//           --online: #25d366;
//         }
//         .wa-root { display: flex; height: 100dvh; font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); overflow: hidden; position: relative; }

//         /* SIDEBAR */
//         .wa-sidebar { width: 380px; min-width: 380px; background: #fff; border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: transform 0.3s ease; z-index: 10; }
//         .wa-sidebar-hdr { background: #f0f2f5; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; height: 60px; }
//         .wa-sidebar-title { font-size: 19px; font-weight: 700; color: var(--text1); }
//         .wa-search-bar { padding: 8px 12px; border-bottom: 1px solid var(--border); }
//         .wa-search-wrap { position: relative; }
//         .wa-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 13px; color: var(--text2); }
//         .wa-search-inp { width: 100%; background: #f0f2f5; border: none; border-radius: 8px; padding: 8px 12px 8px 34px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; color: var(--text1); }
//         .wa-conv-list { flex: 1; overflow-y: auto; }
//         .wa-conv-list::-webkit-scrollbar { width: 3px; }
//         .wa-conv-list::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-conv-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f5f6f6; transition: background 0.15s; }
//         .wa-conv-item:hover { background: #f5f6f6; }
//         .wa-conv-item.active { background: #f0f2f5; }
//         .wa-conv-av { width: 49px; height: 49px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 19px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-conv-info { flex: 1; min-width: 0; }
//         .wa-conv-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 3px; }
//         .wa-conv-name { font-size: 15px; font-weight: 600; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
//         .wa-conv-time { font-size: 11px; color: var(--text2); }
//         .wa-conv-last { font-size: 13px; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .wa-conv-empty { padding: 40px 20px; text-align: center; color: var(--text2); font-size: 14px; }

//         /* CHAT */
//         .wa-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #efeae2; position: relative; }
//         .wa-chat::before { content: ''; position: absolute; inset: 0; opacity: 0.08; background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E"); pointer-events: none; z-index: 0; }

//         .wa-chat-hdr { background: #fff; padding: 10px 16px; display: flex; align-items: center; gap: 12px; height: 60px; border-bottom: 1px solid var(--border); position: relative; z-index: 2; cursor: pointer; transition: background 0.15s; }
//         .wa-chat-hdr:hover { background: #f5f6f6; }
//         .wa-back-btn { display: none; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text2); padding: 4px 8px 4px 0; line-height: 1; }
//         .wa-chat-av { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 700; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .wa-chat-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .wa-chat-name { font-size: 15px; font-weight: 600; color: var(--text1); }
//         .wa-chat-sub { font-size: 12px; color: var(--text2); margin-top: 1px; }

//         /* MESSAGES */
//         .wa-messages { flex: 1; overflow-y: auto; padding: 12px 8%; display: flex; flex-direction: column; gap: 2px; position: relative; z-index: 1; }
//         .wa-messages::-webkit-scrollbar { width: 3px; }
//         .wa-messages::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
//         .wa-date-lbl { text-align: center; margin: 8px 0; }
//         .wa-date-lbl span { background: #e1f2fb; color: #54656f; font-size: 11.5px; font-weight: 600; padding: 4px 12px; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
//         .wa-bwrap { display: flex; margin-bottom: 1px; }
//         .wa-bwrap.me { justify-content: flex-end; }
//         .wa-bwrap.them { justify-content: flex-start; }
//         .wa-bubble { max-width: 65%; padding: 7px 10px 5px; border-radius: 8px; font-size: 14px; line-height: 1.5; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.1); word-break: break-word; }
//         .wa-bubble.me { background: var(--bubble-me); border-top-right-radius: 2px; }
//         .wa-bubble.them { background: var(--bubble-them); border-top-left-radius: 2px; }
//         .wa-tail-me { position: absolute; top: 0; right: -8px; width: 0; height: 0; border-left: 8px solid var(--bubble-me); border-bottom: 8px solid transparent; }
//         .wa-tail-them { position: absolute; top: 0; left: -8px; width: 0; height: 0; border-right: 8px solid var(--bubble-them); border-bottom: 8px solid transparent; }
//         .wa-bmeta { display: flex; align-items: center; justify-content: flex-end; gap: 3px; margin-top: 2px; }
//         .wa-btime { font-size: 10.5px; color: #667781; }
//         .wa-tick { font-size: 11px; color: #53bdeb; }

//         /* INPUT */
//         .wa-input-bar { background: var(--bg); padding: 8px 16px; display: flex; align-items: center; gap: 10px; position: relative; z-index: 2; }
//         .wa-input-wrap { flex: 1; background: #fff; border-radius: 26px; display: flex; align-items: center; padding: 9px 16px; gap: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
//         .wa-input { flex: 1; border: none; outline: none; font-size: 15px; font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text1); background: transparent; }
//         .wa-send-btn { width: 48px; height: 48px; border-radius: 50%; background: var(--primary); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.2s, transform 0.15s; box-shadow: 0 2px 8px rgba(79,70,229,0.35); }
//         .wa-send-btn:hover { background: #4338ca; transform: scale(1.05); }
//         .wa-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

//         /* NO CONV */
//         .wa-no-conv { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; position: relative; z-index: 1; border-left: 1px solid var(--border); background: #f8f9fa; }
//         .wa-no-conv-icon { font-size: 56px; opacity: 0.25; }
//         .wa-no-conv-title { font-size: 26px; font-weight: 300; color: var(--text1); }
//         .wa-no-conv-sub { font-size: 14px; color: var(--text2); }

//         /* PROFILE PANEL */
//         .prof-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 100; display: flex; align-items: flex-start; justify-content: flex-end; animation: fadeIn 0.18s ease; }
//         @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//         .prof-panel { width: 360px; height: 100dvh; background: #fff; display: flex; flex-direction: column; animation: slideRight 0.22s ease; overflow-y: auto; }
//         @keyframes slideRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
//         .prof-cover { background: #111b21; padding: 50px 24px 28px; display: flex; flex-direction: column; align-items: center; position: relative; }
//         .prof-close { position: absolute; top: 12px; left: 12px; background: rgba(255,255,255,0.1); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: background 0.2s; }
//         .prof-close:hover { background: rgba(255,255,255,0.22); }
//         .prof-av-big { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: 44px; font-weight: 800; color: #fff; overflow: hidden; cursor: zoom-in; transition: transform 0.2s; margin-bottom: 14px; border: 3px solid rgba(255,255,255,0.15); }
//         .prof-av-big:hover { transform: scale(1.04); }
//         .prof-av-big img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .prof-cover-name { font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 4px; text-align: center; }
//         .prof-cover-role { font-size: 13px; color: rgba(255,255,255,0.55); }
//         .prof-section { padding: 16px 20px; border-bottom: 8px solid #f0f2f5; }
//         .prof-sec-label { font-size: 12px; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; }
//         .prof-row { display: flex; align-items: flex-start; gap: 16px; padding: 8px 0; }
//         .prof-row-icon { font-size: 18px; color: var(--text2); width: 22px; text-align: center; flex-shrink: 0; margin-top: 1px; }
//         .prof-row-text { font-size: 14px; color: var(--text1); line-height: 1.5; }
//         .prof-tag-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
//         .prof-tag { padding: 4px 12px; background: #eef2ff; color: var(--primary); border-radius: 100px; font-size: 12px; font-weight: 600; }
//         .prof-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--border); border-radius: 12px; overflow: hidden; }
//         .prof-stat { background: #fff; padding: 14px 8px; text-align: center; }
//         .prof-stat-num { font-size: 18px; font-weight: 800; color: var(--text1); }
//         .prof-stat-lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

//         /* DP FULLSCREEN */
//         .dp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.93); z-index: 200; display: flex; align-items: center; justify-content: center; cursor: zoom-out; animation: fadeIn 0.18s ease; }
//         .dp-img { max-width: 90vw; max-height: 90dvh; border-radius: 50%; object-fit: cover; animation: zoomIn 0.2s ease; }
//         .dp-init { width: min(80vw,80dvh); height: min(80vw,80dvh); border-radius: 50%; background: linear-gradient(135deg,#667eea,#764ba2); display: flex; align-items: center; justify-content: center; font-size: clamp(60px,15vw,140px); font-weight: 800; color: #fff; animation: zoomIn 0.2s ease; }
//         @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spin { width: 24px; height: 24px; border: 2.5px solid #e0e0e0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
//         .spin-wrap { display: flex; justify-content: center; padding: 30px; }

//         /* MOBILE */
//         @media (max-width: 768px) {
//           .wa-sidebar { position: fixed; inset: 0; width: 100% !important; min-width: unset; z-index: 20; }
//           .wa-sidebar.hidden { transform: translateX(-100%); }
//           .wa-chat { position: fixed; inset: 0; }
//           .wa-chat.hidden { display: none; }
//           .wa-back-btn { display: block !important; }
//           .wa-bubble { max-width: 82%; }
//           .wa-no-conv { display: none; }
//           .prof-panel { width: 100%; }
//           .wa-messages { padding: 12px 4%; }
//         }
//       `}</style>

//       <div className="wa-root">
//         {/* SIDEBAR */}
//         <div className={`wa-sidebar${!showSidebar ? " hidden" : ""}`}>
//           <div className="wa-sidebar-hdr">
//             <span className="wa-sidebar-title">Messages</span>
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
//             ) : conversations.map((conv) => {
//               const other = getOtherParticipant(conv);
//               const av = getAvatar(other);
//               const name = getName(other);
//               return (
//                 <div key={conv._id} className={`wa-conv-item${activeConv?._id === conv._id ? " active" : ""}`} onClick={() => openConv(conv)}>
//                   <div className="wa-conv-av">{av ? <img src={av} alt={name} /> : getInitial(other)}</div>
//                   <div className="wa-conv-info">
//                     <div className="wa-conv-top">
//                       <span className="wa-conv-name">{name}</span>
//                       <span className="wa-conv-time">{formatTime(conv.updatedAt)}</span>
//                     </div>
//                     <div className="wa-conv-last">{conv.lastMessage || "Tap to open chat"}</div>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         </div>

//         {/* CHAT */}
//         <div className={`wa-chat${showSidebar && !activeConv ? " hidden" : ""}`}>
//           {activeConv ? (
//             <>
//               <div className="wa-chat-hdr" onClick={() => setSelectedProfile(activeOther)}>
//                 <button className="wa-back-btn" onClick={(e) => { e.stopPropagation(); setShowSidebar(true); setActiveConv(null); setMessages([]); }}>←</button>
//                 <div className="wa-chat-av">
//                   {getAvatar(activeOther) ? <img src={getAvatar(activeOther)} alt="dp" /> : getInitial(activeOther)}
//                 </div>
//                 <div style={{ flex: 1 }}>
//                   <div className="wa-chat-name">{getName(activeOther)}</div>
//                   <div className="wa-chat-sub">{activeOther?.role || "tap for info"}</div>
//                 </div>
//               </div>

//               <div className="wa-messages">
//                 {grouped.map((item, i) =>
//                   item.type === "date" ? (
//                     <div key={`d${i}`} className="wa-date-lbl"><span>{item.label}</span></div>
//                   ) : (() => {
//                     const senderId = (item.sender?._id || item.sender)?.toString();
//                     const isMe = myId && senderId === myId;
//                     return (
//                       <div key={item._id || i} className={`wa-bwrap ${isMe ? "me" : "them"}`}>
//                         <div className={`wa-bubble ${isMe ? "me" : "them"}`}>
//                           {isMe ? <div className="wa-tail-me" /> : <div className="wa-tail-them" />}
//                           {item.text}
//                           <div className="wa-bmeta">
//                             <span className="wa-btime">{formatMsgTime(item.createdAt)}</span>
//                             {isMe && <span className="wa-tick">✓✓</span>}
//                           </div>
//                         </div>
//                       </div>
//                     );
//                   })()
//                 )}
//                 <div ref={messagesEndRef} />
//               </div>

//               <div className="wa-input-bar">
//                 <div className="wa-input-wrap">
//                   <input
//                     ref={inputRef}
//                     className="wa-input"
//                     value={newMsg}
//                     onChange={(e) => setNewMsg(e.target.value)}
//                     onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                     placeholder="Type a message"
//                   />
//                 </div>
//                 <button className="wa-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"/></svg>
//                 </button>
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

//       {/* PROFILE PANEL */}
//       {selectedProfile && !showDp && (
//         <div className="prof-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedProfile(null)}>
//           <div className="prof-panel">
//             <div className="prof-cover">
//               <button className="prof-close" onClick={() => setSelectedProfile(null)}>✕</button>
//               <div className="prof-av-big" onClick={() => setShowDp(true)}>
//                 {getAvatar(selectedProfile) ? <img src={getAvatar(selectedProfile)} alt="dp" /> : getInitial(selectedProfile)}
//               </div>
//               <div className="prof-cover-name">{getName(selectedProfile)}</div>
//               <div className="prof-cover-role">{selectedProfile?.role || "Creator"}</div>
//             </div>

//             <div className="prof-section">
//               <div className="prof-stats">
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">
//                     {selectedProfile?.followers ? Number(selectedProfile.followers) >= 1000 ? Math.floor(Number(selectedProfile.followers) / 1000) + "K" : selectedProfile.followers : "—"}
//                   </div>
//                   <div className="prof-stat-lbl">Followers</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{Array.isArray(selectedProfile?.categories) ? selectedProfile.categories.length : selectedProfile?.categories ? 1 : 0}</div>
//                   <div className="prof-stat-lbl">Niches</div>
//                 </div>
//                 <div className="prof-stat">
//                   <div className="prof-stat-num">{selectedProfile?.platform ? "✓" : "—"}</div>
//                   <div className="prof-stat-lbl">Platform</div>
//                 </div>
//               </div>
//             </div>

//             <div className="prof-section">
//               <div className="prof-sec-label">About</div>
//               {selectedProfile?.bio && <div className="prof-row"><span className="prof-row-icon">💬</span><div className="prof-row-text">{selectedProfile.bio}</div></div>}
//               {(selectedProfile?.location || selectedProfile?.city) && <div className="prof-row"><span className="prof-row-icon">📍</span><div className="prof-row-text">{selectedProfile.location || selectedProfile.city}</div></div>}
//               {selectedProfile?.email && <div className="prof-row"><span className="prof-row-icon">✉️</span><div className="prof-row-text">{selectedProfile.email}</div></div>}
//               {selectedProfile?.platform && (
//                 <div className="prof-row">
//                   <span className="prof-row-icon">📸</span>
//                   <a href={selectedProfile.platform} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontSize: 14, textDecoration: "none", wordBreak: "break-all" }}>{selectedProfile.platform}</a>
//                 </div>
//               )}
//             </div>

//             {selectedProfile?.categories && (
//               <div className="prof-section">
//                 <div className="prof-sec-label">Niches</div>
//                 <div className="prof-tag-wrap">
//                   {(Array.isArray(selectedProfile.categories) ? selectedProfile.categories : [selectedProfile.categories]).filter(Boolean).map((cat: string, i: number) => (
//                     <span key={i} className="prof-tag">{cat}</span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       )}

//       {/* FULLSCREEN DP */}
//       {showDp && (
//         <div className="dp-overlay" onClick={() => setShowDp(false)}>
//           {getAvatar(selectedProfile)
//             ? <img className="dp-img" src={getAvatar(selectedProfile)} alt="dp" />
//             : <div className="dp-init">{getInitial(selectedProfile)}</div>}
//         </div>
//       )}
//     </>
//   );
// }

// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{ display: "flex", height: "100dvh", alignItems: "center", justifyContent: "center" }}><div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} /></div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }



// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { io, Socket } from "socket.io-client";

// const API = "http://54.252.201.93:5000/api";
// const SOCKET_URL = "http://54.252.201.93:5000";

// function MessagesInner() {
//   const router = useRouter();
//   const searchParams = useSearchParams();

//   const [token, setToken] = useState<string>("");
//   const [myId, setMyId] = useState<string>("");
//   const [conversations, setConversations] = useState<any[]>([]);
//   const [activeConv, setActiveConv] = useState<any>(null);
//   const [messages, setMessages] = useState<any[]>([]);
//   const [newMsg, setNewMsg] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loadingConvs, setLoadingConvs] = useState(true);

//   const socketRef = useRef<Socket | null>(null);
//   const messagesEndRef = useRef<HTMLDivElement>(null);
//   const activeConvRef = useRef<any>(null);

//   /* ── AUTH ── */
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const cbUser = localStorage.getItem("cb_user");
//     if (cbUser) {
//       const parsed = JSON.parse(cbUser);
//       const tok = parsed.token || parsed.accessToken || "";
//       setToken(tok);
//       const id = parsed._id || parsed.id || parsed.user?._id || parsed.user?.id || "";
//       setMyId(id.toString());
//       return;
//     }
//     const t = localStorage.getItem("token") || "";
//     const u = localStorage.getItem("user");
//     setToken(t);
//     if (u) {
//       const parsed = JSON.parse(u);
//       const id = parsed._id || parsed.id || parsed.user?._id || "";
//       setMyId(id.toString());
//     }
//   }, []);

//   /* ── SOCKET ── */
//   useEffect(() => {
//     if (!token || !myId) return;
//     if (socketRef.current) return;

//     const socket = io(SOCKET_URL, { transports: ["websocket"], auth: { token } });
//     socketRef.current = socket;

//     socket.on("connect", () => socket.emit("join", myId));

//     socket.on("newMessage", (msg: any) => {
//       const conv = activeConvRef.current;
//       if (!conv) return;
//       const msgConvId = (msg.conversationId || msg.conversation)?.toString();
//       if (msgConvId === conv._id?.toString()) {
//         setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
//       }
//       setConversations(prev =>
//         prev.map(c => c._id?.toString() === msgConvId
//           ? { ...c, lastMessage: msg.text, updatedAt: msg.createdAt }
//           : c
//         )
//       );
//     });

//     return () => { socket.disconnect(); socketRef.current = null; };
//   }, [token, myId]);

//   /* ── LOAD CONVERSATIONS ── */
//   useEffect(() => {
//     if (!token) return;
//     setLoadingConvs(true);
//     fetch(`${API}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const convs = data?.data || [];
//         setConversations(convs);
//         const targetUserId = searchParams?.get("userId") || searchParams?.get("with");
//         if (targetUserId && convs.length > 0) {
//           const matched = convs.find((c: any) =>
//             c.participants?.some((p: any) => (p?._id || p)?.toString() === targetUserId)
//           );
//           if (matched) setActiveConv(matched);
//         }
//       })
//       .catch(console.error)
//       .finally(() => setLoadingConvs(false));
//   }, [token]);

//   /* ── LOAD MESSAGES ── */
//   useEffect(() => {
//     if (!token || !activeConv) return;
//     activeConvRef.current = activeConv;
//     fetch(`${API}/conversations/messages/${activeConv._id}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => setMessages(data?.data || []))
//       .catch(console.error);
//   }, [activeConv, token]);

//   /* ── AUTO SCROLL ── */
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   /* ── HELPERS ── */
//   const getOtherParticipant = (conv: any) => {
//     if (!conv?.participants || !myId) return null;
//     return conv.participants.find((p: any) => (p?._id || p)?.toString() !== myId);
//   };

//   const getName = (p: any): string => {
//     if (!p || typeof p === "string") return "User";
//     return p.name || p.username || p.fullName || p.email?.split("@")[0] || "User";
//   };

//   const getAvatar = (p: any): string => {
//     if (!p || typeof p === "string") return "";
//     return p.profileImage || p.avatar || p.photo || "";
//   };

//   /* ── SEND ── */
//   const sendMessage = async () => {
//     if (!newMsg.trim() || sending || !activeConv) return;
//     try {
//       setSending(true);
//       const res = await fetch(`${API}/conversations/send/${activeConv._id}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify({ text: newMsg.trim() }),
//       });
//       const data = await res.json();
//       if (data?.success) setNewMsg("");
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setSending(false);
//     }
//   };

//   const activeOther = activeConv ? getOtherParticipant(activeConv) : null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         .msg-root { display: flex; height: 100vh; font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; }
//         .msg-sidebar { width: 320px; min-width: 280px; background: #fff; border-right: 1.5px solid #ebebeb; display: flex; flex-direction: column; }
//         .msg-sidebar-header { padding: 20px 20px 14px; border-bottom: 1px solid #f0f0f0; }
//         .msg-sidebar-title { font-size: 18px; font-weight: 800; color: #111; }
//         .msg-conv-list { flex: 1; overflow-y: auto; }
//         .msg-conv-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; border-bottom: 1px solid #f7f7f7; transition: background 0.15s; }
//         .msg-conv-item:hover { background: #f7f7ff; }
//         .msg-conv-item.active { background: #eef2ff; }
//         .msg-conv-av { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; color: #fff; flex-shrink: 0; overflow: hidden; }
//         .msg-conv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .msg-conv-info { flex: 1; min-width: 0; }
//         .msg-conv-name { font-size: 14px; font-weight: 700; color: #111; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
//         .msg-conv-last { font-size: 12px; color: #aaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
//         .msg-conv-empty { padding: 40px 20px; text-align: center; color: #bbb; font-size: 13px; }
//         .msg-chat { flex: 1; display: flex; flex-direction: column; min-width: 0; }
//         .msg-chat-header { background: #fff; border-bottom: 1.5px solid #ebebeb; padding: 16px 20px; display: flex; align-items: center; gap: 12px; }
//         .msg-chat-av { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; color: #fff; flex-shrink: 0; overflow: hidden; }
//         .msg-chat-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .msg-chat-name { font-size: 15px; font-weight: 800; color: #111; }
//         .msg-chat-role { font-size: 12px; color: #aaa; margin-top: 1px; }
//         .msg-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 10px; background: #f9f9f6; }
//         .msg-bubble-wrap { display: flex; }
//         .msg-bubble-wrap.me { justify-content: flex-end; }
//         .msg-bubble { max-width: 65%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.5; }
//         .msg-bubble.me { background: #4f46e5; color: #fff; border-bottom-right-radius: 4px; }
//         .msg-bubble.them { background: #fff; color: #222; border: 1.5px solid #ebebeb; border-bottom-left-radius: 4px; }
//         .msg-bubble-time { font-size: 10px; margin-top: 4px; opacity: 0.6; text-align: right; }
//         .msg-input-bar { background: #fff; border-top: 1.5px solid #ebebeb; padding: 14px 16px; display: flex; gap: 10px; align-items: center; }
//         .msg-input { flex: 1; border: 1.5px solid #e0e0e0; border-radius: 12px; padding: 10px 14px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; transition: border 0.2s; }
//         .msg-input:focus { border-color: #4f46e5; }
//         .msg-send-btn { background: #4f46e5; color: #fff; border: none; border-radius: 12px; padding: 10px 20px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer; transition: background 0.2s; white-space: nowrap; }
//         .msg-send-btn:hover:not(:disabled) { background: #4338ca; }
//         .msg-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
//         .msg-no-conv { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #bbb; gap: 10px; }
//         .msg-no-conv-icon { font-size: 48px; }
//         .msg-no-conv-text { font-size: 15px; font-weight: 600; }
//         @media(max-width: 640px) {
//           .msg-sidebar { width: 72px; min-width: 72px; }
//           .msg-sidebar-title { display: none; }
//           .msg-conv-info { display: none; }
//           .msg-conv-item { justify-content: center; padding: 12px 8px; }
//         }
//         @keyframes spin { to { transform: rotate(360deg); } }
//         .spinner-sm { width: 20px; height: 20px; border: 2px solid #e0e0e0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
//       `}</style>

//       <div className="msg-root">
//         {/* SIDEBAR */}
//         <div className="msg-sidebar">
//           <div className="msg-sidebar-header">
//             <div className="msg-sidebar-title">Messages</div>
//           </div>
//           <div className="msg-conv-list">
//             {loadingConvs ? (
//               <div style={{ padding: "30px", display: "flex", justifyContent: "center" }}>
//                 <div className="spinner-sm" />
//               </div>
//             ) : conversations.length === 0 ? (
//               <div className="msg-conv-empty">No conversations yet</div>
//             ) : (
//               conversations.map((conv) => {
//                 const other = getOtherParticipant(conv);
//                 const avatarUrl = getAvatar(other);
//                 const name = getName(other);
//                 return (
//                   <div
//                     key={conv._id}
//                     className={`msg-conv-item ${activeConv?._id === conv._id ? "active" : ""}`}
//                     onClick={() => setActiveConv(conv)}
//                   >
//                     <div className="msg-conv-av">
//                       {avatarUrl ? <img src={avatarUrl} alt={name} /> : name.charAt(0).toUpperCase()}
//                     </div>
//                     <div className="msg-conv-info">
//                       <div className="msg-conv-name">{name}</div>
//                       {conv.lastMessage && (
//                         <div className="msg-conv-last">{conv.lastMessage}</div>
//                       )}
//                     </div>
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         </div>

//         {/* CHAT AREA */}
//         <div className="msg-chat">
//           {activeConv ? (
//             <>
//               <div className="msg-chat-header">
//                 <div className="msg-chat-av">
//                   {getAvatar(activeOther)
//                     ? <img src={getAvatar(activeOther)} alt="avatar" />
//                     : getName(activeOther).charAt(0).toUpperCase()}
//                 </div>
//                 <div>
//                   <div className="msg-chat-name">{getName(activeOther)}</div>
//                   <div className="msg-chat-role">{activeOther?.role || ""}</div>
//                 </div>
//               </div>

//               <div className="msg-messages">
//                 {messages.map((msg, i) => {
//                   const senderId = (msg.sender?._id || msg.sender)?.toString();
//                   const isMe = myId && senderId === myId;
//                   return (
//                     <div key={i} className={`msg-bubble-wrap ${isMe ? "me" : ""}`}>
//                       <div className={`msg-bubble ${isMe ? "me" : "them"}`}>
//                         {msg.text}
//                         <div className="msg-bubble-time">
//                           {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
//                         </div>
//                       </div>
//                     </div>
//                   );
//                 })}
//                 <div ref={messagesEndRef} />
//               </div>

//               <div className="msg-input-bar">
//                 <input
//                   className="msg-input"
//                   value={newMsg}
//                   onChange={(e) => setNewMsg(e.target.value)}
//                   onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
//                   placeholder={`Message ${getName(activeOther)}...`}
//                 />
//                 <button className="msg-send-btn" onClick={sendMessage} disabled={sending || !newMsg.trim()}>
//                   {sending ? "..." : "Send"}
//                 </button>
//               </div>
//             </>
//           ) : (
//             <div className="msg-no-conv">
//               <div className="msg-no-conv-icon">💬</div>
//               <div className="msg-no-conv-text">Select a conversation to start chatting</div>
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// import { Suspense } from "react";
// export default function MessagesPage() {
//   return (
//     <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading...</div>}>
//       <MessagesInner />
//     </Suspense>
//   );
// }

