"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

// ─── Plan config ─────────────────────────────────────────────────────────────
const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
  free:             { label: "Free",  campaigns: 2,   tokens: 200   },
  pro_monthly:      { label: "Pro",   campaigns: 10,  tokens: 1000  },
  pro_plus_monthly: { label: "Pro+",  campaigns: 25,  tokens: 2500  },
  pro_yearly:       { label: "Pro",   campaigns: 120, tokens: 12000 },
  pro_plus_yearly:  { label: "Pro+",  campaigns: 250, tokens: 25000 },
};

const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
  free:             { label: "Free",  applies: 10,          tokens: 100         },
  pro_monthly:      { label: "Pro",   applies: 100,         tokens: 1000        },
  pro_plus_monthly: { label: "Pro+",  applies: 200,         tokens: 2000        },
  pro_yearly:       { label: "Pro",   applies: "unlimited", tokens: "unlimited" },
  pro_plus_yearly:  { label: "Pro+",  applies: "unlimited", tokens: "unlimited" },
};

const getPlanLabel = (plan: string): string => {
  if (!plan || plan === "free") return "Free";
  const p = plan.toLowerCase().trim();
  if (p.includes("pro_plus") || p.includes("pro+")) return "Pro+";
  if (p.includes("pro")) return "Pro";
  return "Free";
};

const getBrandPlanLimits = (plan: string) => {
  const p = (plan || "").toLowerCase().trim();
  if (p === "pro") return BRAND_PLAN_LIMITS["pro_monthly"];
  if (p === "pro+" || p === "pro_plus") return BRAND_PLAN_LIMITS["pro_plus_monthly"];
  return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
};

const getCreatorPlanLimits = (plan: string) => {
  const p = (plan || "").toLowerCase().trim();
  if (p === "pro") return CREATOR_PLAN_LIMITS["pro_monthly"];
  if (p === "pro+" || p === "pro_plus") return CREATOR_PLAN_LIMITS["pro_plus_monthly"];
  return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
};

// ─── Tiny in-memory cache ─────────────────────────────────────────────────────
// Prevents duplicate API calls on route changes within TTL window
interface CacheEntry { data: any; ts: number }
const CACHE_TTL = 60_000; // 30 seconds
const globalCache: Record<string, CacheEntry> = {};

function cacheGet(key: string): any | null {
  const e = globalCache[key];
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data;
  return null;
}

function cacheSet(key: string, data: any) {
  globalCache[key] = { data, ts: Date.now() };
}

// ─── Fetcher with cache ───────────────────────────────────────────────────────
async function fetchCached(url: string, token: string): Promise<any | null> {
  const cached = cacheGet(url);
  if (cached !== null) return cached;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    // For 304, res.json() may fail — return cached if available (stale is fine)
    if (res.status === 304) {
      const stale = globalCache[url];
      return stale ? stale.data : null;
    }
    const data = await res.json();
    cacheSet(url, data);
    return data;
  } catch {
    return null;
  }
}

// ─── Section helper ───────────────────────────────────────────────────────────
function getSection(pathname: string | null): string {
  return (pathname || "").split("/")[1] ?? "";
}

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [user, setUser]                     = useState<any>(null);
  const [profile, setProfile]               = useState<any>(null);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [msgUnread, setMsgUnread]           = useState(0);
  const [campsUsed, setCampsUsed]           = useState(0);
  const [appliesUsed, setAppliesUsed]       = useState(0);
  const [bits, setBits]                     = useState<number | null>(null);
  const [profileLoaded, setProfileLoaded]   = useState(false);

  const dropdownRef        = useRef<HTMLDivElement>(null);
  const pathnameRef        = useRef<string>(pathname || "");
  const prevSectionRef     = useRef<string>("");
  const lastVisibilityRef  = useRef<number>(0);
  const lastMsgFetchRef    = useRef<number>(0);
  const lastNotifFetchRef  = useRef<number>(0);

  // Always keep pathnameRef current for event handlers
  useEffect(() => { pathnameRef.current = pathname || ""; }, [pathname]);

  // ─── Read from localStorage → update state ────────────────────────────────
  const syncFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("cb_user");
      if (!raw) return;
      const latest = JSON.parse(raw);
       if (latest.emailVerified  === false) return;
      setUser({ ...latest });
      if (latest.bits != null) setBits(Number(latest.bits));
    } catch {}
  }, []);

  // ─── Fetch notifications (with 30s cooldown) ──────────────────────────────
  // const fetchUnreadCount = useCallback(async (token: string) => {
  //   if (Date.now() - lastNotifFetchRef.current < CACHE_TTL) return;
  //   lastNotifFetchRef.current = Date.now();
  //   const data = await fetchCached(`${API_BASE}/notification?t=${Date.now()}`, token);
  //   if (!data) return;
  //   const notifs: any[] = data.notifications || data.data || [];
  //   setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
  // }, []);

  const fetchUnreadCount = useCallback(async (token: string) => {
  if (Date.now() - lastNotifFetchRef.current < 60_000) return; // ← 60s cooldown
  lastNotifFetchRef.current = Date.now();
  const data = await fetchCached(`${API_BASE}/notification?t=${Date.now()}`, token);
  if (!data) return;
  const notifs: any[] = data.notifications || data.data || [];
  setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
}, []);

  // ─── Fetch message unread (with 30s cooldown) ─────────────────────────────
  const fetchMsgUnread = useCallback(async (token: string, parsedUser?: any) => {
    if (Date.now() - lastMsgFetchRef.current < CACHE_TTL) return;
    lastMsgFetchRef.current = Date.now();
    const data = await fetchCached(`${API_BASE}/conversations/user/all`, token);
    if (!data) return;
    const convs: any[] = data?.chats || data?.data || data?.conversations || [];
    const u    = parsedUser || user;
    const myId = u?._id || u?.id || u?.user?._id || u?.user?.id;
    const total = convs.reduce((sum: number, c: any) => {
      const uc = c.unread_count ?? c.unreadCounts?.[myId] ?? c.unreadCount ?? c.unread ?? 0;
      return sum + uc;
    }, 0);
    setMsgUnread(total);
    localStorage.setItem("msg_unread_count", String(total));
  }, [user]);

  // ─── Fetch campaigns count (NO per-campaign requests) ────────────────────
  // We only fetch /campaigns/my once and count locally. No /applications fetches.
  const fetchCampaignsUsed = useCallback(async (token: string, u: any) => {
    const data = await fetchCached(`${API_BASE}/campaigns/my`, token);
    if (!data) return;
    const list: any[] = data.data || data.campaigns || [];
    const planActivatedAt = u.planActivatedAt;
    const isSubscribed    = u.isSubscribed ?? false;
    if (isSubscribed && planActivatedAt) {
      const planStart = new Date(planActivatedAt);
      setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
    } else {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
    }
  }, []);

  // ─── Fetch applies used ───────────────────────────────────────────────────
  const fetchAppliesUsed = useCallback(async (token: string, u: any) => {
    const data = await fetchCached(`${API_BASE}/application/my`, token);
    if (!data) return;
    const list: any[] = data.applications || data.data || [];
    const isSubscribed    = u.isSubscribed ?? false;
    const planActivatedAt = u.planActivatedAt;
    if (isSubscribed && planActivatedAt) {
      const planStart = new Date(planActivatedAt);
      setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
    } else {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
    }
  }, []);

  // ─── Core init: runs once per top-level section change ───────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const section    = getSection(pathname);
    const prevSection = prevSectionRef.current;
    prevSectionRef.current = section;

    const storedRaw = localStorage.getItem("cb_user");
    if (!storedRaw) { setUser(null); setProfile(null); setUnreadCount(0); return; }

    let parsedUser: any;
    try { parsedUser = JSON.parse(storedRaw); } catch { return; }

    const token = parsedUser.token || localStorage.getItem("token");
      
     // ← Yeh add karo:
// if (!parsedUser.emailVerified  === false)
if (parsedUser.emailVerified === false) {
  setUser(null); setProfile(null);
  return;
}

    if (!token) { setUser(null); setProfile(null); return; }

    setUser(parsedUser);
    if (parsedUser.bits != null) setBits(Number(parsedUser.bits));

    const role = parsedUser.role?.toLowerCase();

    // Profile: fetch only once, then rely on cache
    if (!profileLoaded) {
      fetchCached(`${API_BASE}/profile/me`, token).then(data => {
        if (data?.success && data.profile) setProfile(data.profile);
        setProfileLoaded(true);
      });
    }

    // Role-specific counts: only fetch when section changes (not on every nav)
    if (section !== prevSection) {
      if (role === "brand") fetchCampaignsUsed(token, parsedUser);
      if (role === "influencer") fetchAppliesUsed(token, parsedUser);
    }

    // // Notifications: skip on notification page
    // if (!pathname?.startsWith("/notification")) {
    //   fetchUnreadCount(token);
    // }

    // Messages: skip on messages page
    // if (!pathname?.startsWith("/messages")) {
    //   const saved = localStorage.getItem("msg_unread_count");
    //   if (saved !== null) setMsgUnread(Number(saved)); // show cached instantly
    //   fetchMsgUnread(token, parsedUser);              // then refresh in bg
    // }
    if (!pathname?.startsWith("/messages")) {
  const saved = localStorage.getItem("msg_unread_count");
  if (saved !== null) setMsgUnread(Number(saved));
  // sirf first load pe fetch karo, har page change pe nahi
  if (!profileLoaded) fetchMsgUnread(token, parsedUser);
}
  }, [pathname]);

  // ─── plan_updated event (same-tab, e.g. after campaign post) ─────────────
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.bits != null) setBits(Number(e.detail.bits));
      syncFromStorage();
      // Invalidate campaign cache so next fetch is fresh
      Object.keys(globalCache).forEach(k => {
        if (k.includes("/campaigns/my")) delete globalCache[k];
      });
      const stored = localStorage.getItem("cb_user");
      if (!stored) return;
      const u = JSON.parse(stored);
      const token = u.token || localStorage.getItem("token");
      if (token && u.role?.toLowerCase() === "brand") fetchCampaignsUsed(token, u);
    };
    window.addEventListener("plan_updated", handler);
    return () => window.removeEventListener("plan_updated", handler);
  }, [syncFromStorage, fetchCampaignsUsed]);

  // ─── Storage & cross-tab sync ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "notif_all_read") setUnreadCount(0);
      if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
      if (e.key === "cb_user_bits"       && e.newValue !== null) setBits(Number(e.newValue));
      if (e.key === "cb_user" && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setUser({ ...updated });
          if (updated.bits != null) setBits(Number(updated.bits));
        } catch {}
      }
      if (e.key === "msg_unread_count" && e.newValue !== null) {
        if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(Number(e.newValue));
      }
    };

    const handleMsgCount = (e: any) => {
      const count = e.detail?.count ?? 0;
      if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(count);
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("msg_unread");
      bc.onmessage = (e) => {
        if (e.data?.type === "msg_unread_update") {
          if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(e.data.count ?? 0);
        }
        if (e.data?.type === "plan_update") syncFromStorage();
      };
    } catch {}

    window.addEventListener("storage", handleStorage);
    window.addEventListener("msg_unread_update", handleMsgCount);
    if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("msg_unread_update", handleMsgCount);
      bc?.close();
    };
  }, [syncFromStorage]);

  // ─── Visibility change: re-sync but THROTTLED (max once per 60s) ──────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastVisibilityRef.current < 120_000) return; // 60s cooldown
      lastVisibilityRef.current = now;

      syncFromStorage();
      const stored = localStorage.getItem("cb_user");
      if (!stored) return;
      let parsedUser: any;
      try { parsedUser = JSON.parse(stored); } catch { return; }
      const token = parsedUser.token || localStorage.getItem("token");
      if (!token) return;

      if ( !pathnameRef.current.startsWith("/notification")) fetchUnreadCount(token);
      if (!pathnameRef.current.startsWith("/messages")) fetchMsgUnread(token, parsedUser);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [syncFromStorage, fetchUnreadCount, fetchMsgUnread]);

  // ─── Notification page: mark all read ────────────────────────────────────
  // useEffect(() => {
  //   if (!pathname?.startsWith("/notification")) return;
  //   setUnreadCount(0);
  //   const stored = localStorage.getItem("cb_user");
  //   if (!stored) return;
  //   const token = JSON.parse(stored).token || localStorage.getItem("token");
  //   if (!token) return;
  //   fetch(`${API_BASE}/notification?t=${Date.now()}`,
  //      { headers: { Authorization: `Bearer ${token}` } })
  //     .then(r => r.json())
  //     .then(data => {
  //       const notifs: any[] = data.notifications || data.data || [];
  //       notifs.filter((n: any) => !n.read).forEach((n: any) => {
  //         fetch(`${API_BASE}/notification/read/${n._id}`, {
  //           method: "PATCH", headers: { Authorization: `Bearer ${token}` },
  //         }).catch(() => {});
  //       });
  //     }).catch(() => {});
  // }, [pathname]);

  useEffect(() => {
  if (pathname?.startsWith("/notification")) setUnreadCount(0);
}, [pathname]);

  // ─── Messages page: clear badge ──────────────────────────────────────────
  useEffect(() => {
    if (pathname?.startsWith("/messages")) setMsgUnread(0);
  }, [pathname]);

  // ─── Restore msg count when leaving /messages ─────────────────────────────
  const prevPathRef = useRef<string>("");
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname || "";
    if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
      const saved = localStorage.getItem("msg_unread_count");
      if (saved !== null) setMsgUnread(Number(saved));
    }
  }, [pathname]);

  // ─── Click outside dropdown ───────────────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Close menus on route change ─────────────────────────────────────────
  useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

  // ─── Msg unread from localStorage on mount ────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("msg_unread_count");
    if (saved !== null && !pathname?.startsWith("/messages")) setMsgUnread(Number(saved));
  }, []);

  // ─── Hide navbar on landing page if logged in ─────────────────────────────
  if (pathname === "/" && user) return null;
  if (pathname?.startsWith("/verify-otp")) return null; 

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fmtNum = (n: number | string) => {
    if (n === "unlimited" || n === "∞") return "∞";
    const num = Number(n);
    return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
  };

  const getLivePlan = () => {
    const p = user?.plan || user?.activePlan || "free";
    const paidPlans = ["pro_monthly","pro_plus_monthly","pro_yearly","pro_plus_yearly","pro","pro_plus","pro_year","pro_plus_year"];
    return paidPlans.includes(p) ? p : "free";
  };

  const getBrandPlanStats = () => {
    const plan     = getBrandPlanLimits(getLivePlan());
    const liveBits = bits ?? user?.bits ?? plan.tokens;
    return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
  };

  const getCreatorPlanStats = () => {
    const plan        = getCreatorPlanLimits(getLivePlan());
    const isUnlim     = plan.applies === "unlimited";
    const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
    const planTokens  = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
    const liveBits    = Number(bits ?? user?.bits ?? planTokens);
    const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
    const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
    const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
    return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
  };

  const handleLogout = () => {
    const stored = localStorage.getItem("cb_user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        const planVal = u.plan || u.activePlan;
        if (planVal) {
          localStorage.setItem("cb_plan_backup", JSON.stringify({
            activePlan: planVal, planActivatedAt: u.planActivatedAt || null,
            isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
          }));
        }
      } catch {}
    }
    ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read","msg_unread_count"]
      .forEach(k => localStorage.removeItem(k));
    // Clear in-memory cache on logout
    Object.keys(globalCache).forEach(k => delete globalCache[k]);
    setUser(null); setProfile(null); setMsgUnread(0); setUnreadCount(0);
    router.push("/");
  };

  const handleMsgClick = () => {
    setMsgUnread(0);
    localStorage.setItem("msg_unread_count", "0");
  };

  const role         = user?.role?.toLowerCase();
  const isBrand      = role === "brand";
  const isAdmin      = role === "admin";
  const isInfluencer = role === "influencer";

  const displayName = isBrand
    ? (profile?.companyName || user?.companyName || user?.name || "User")
    : (profile?.name || user?.name || "User");

  const displayImage     = profile?.profileImage || user?.profileImage || null;
  const isActive         = (path: string) => pathname?.startsWith(path);
  const currentPlanLabel = getPlanLabel(getLivePlan());

  const isProfileIncomplete = (() => {
    if (!user || isAdmin || !profileLoaded) return false;
    if (isInfluencer) {
      const p = profile || {};
      return !(p.followers || p.followersCount) || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.platform || p.platformLink);
    }
    if (isBrand) {
      const p = profile || {};
      return !p.companyName || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.website || p.websiteUrl);
    }
    return false;
  })();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .nav { position:sticky; top:0; z-index:9999; background:#fff; border-bottom:1px solid #ebebeb; font-family:'Plus Jakarta Sans',sans-serif; }
        .nav-inner { max-width:1280px; margin:0 auto; padding:0 24px; height:72px; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:24px; }
        @media(max-width:900px){ .nav-inner { grid-template-columns:auto auto; justify-content:space-between; } .nav-inner > *:nth-child(2) { display:none; } }
        .nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; flex-shrink:0; }
        .nav-links { display:flex; align-items:center; gap:4px; justify-content:center; flex-wrap:nowrap; overflow-x:auto; }
        @media(max-width:900px){ .nav-links { display:none; } }
        .nav-link { font-size:12.5px; font-weight:600; color:#777; text-decoration:none; padding:6px 7px; border-radius:9px; transition:all 0.18s; white-space:nowrap; display:flex; align-items:center; gap:5px; }
        .nav-link:hover { color:#111; background:#f5f5f3; }
        .nav-link.active { color:#4f46e5; background:#eef2ff; }
        .nav-notif-badge { background:#ef4444; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
        .nav-msg-badge { background:#25d366; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
        .nav-right { display:flex; align-items:center; gap:8px; justify-content:flex-end; }
        .nav-avatar-btn { display:flex; align-items:center; gap:8px; padding:4px 10px 4px 4px; border-radius:100px; border:1.5px solid #ebebeb; background:none; cursor:pointer; transition:all 0.2s; }
        .nav-avatar-btn:hover { border-color:#c7d2fe; background:#f8f7ff; }
        .nav-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#fff; overflow:hidden; flex-shrink:0; position:relative; }
        .nav-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
        .nav-avatar-name { font-size:13px; font-weight:600; color:#111; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        @media(max-width:480px){ .nav-avatar-name { display:none; } }
        .nav-incomplete-badge { display:inline-flex; align-items:center; gap:4px; background:#fff8e1; border:1px solid #f59e0b; color:#b45309; border-radius:100px; font-size:9px; font-weight:700; padding:2px 7px; margin-top:4px; }
        .nav-dropdown { position:absolute; top:calc(100% + 8px); right:0; width:260px; background:#fff; border-radius:16px; border:1.5px solid #ebebeb; box-shadow:0 8px 30px rgba(0,0,0,0.1); padding:8px; z-index:9999; animation:dropIn 0.15s ease; max-height:calc(100vh - 80px); overflow-y:auto; overflow-x:hidden; }
        @keyframes dropIn { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)} }
        .nav-dd-user { padding:10px 12px 12px; }
        .nav-dd-username { font-size:14px; font-weight:700; color:#111; margin:0 0 4px; }
        .nav-dd-role { font-size:10px; color:#fff; text-transform:uppercase; letter-spacing:0.08em; margin:0; display:inline-block; padding:2px 8px; border-radius:100px; background:linear-gradient(135deg,#4f46e5,#7c3aed); font-weight:700; }
        .nav-dd-sep { height:1px; background:#f0f0f0; margin:6px 0; }
        .nav-dd-item { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px; font-size:13px; font-weight:600; color:#444; text-decoration:none; transition:background 0.15s; cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Plus Jakarta Sans',sans-serif; }
        .nav-dd-item:hover { background:#f5f5f0; color:#111; }
        .nav-dd-item.danger { color:#ef4444; }
        .nav-dd-item.danger:hover { background:#fff5f5; }
        .nav-dd-item.upgrade-dd { background:linear-gradient(135deg,#ede9fe,#e0e7ff); color:#4f46e5; font-weight:700; }
        .nav-dd-item.upgrade-dd:hover { background:linear-gradient(135deg,#ddd6fe,#c7d2fe); }
        .nav-dd-item.incomplete-dd { background:#fff8e1; color:#b45309; font-weight:700; border:1px solid #fde68a; }
        .nav-dd-item.incomplete-dd:hover { background:#fef3c7; }
        .nav-dd-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:8px 12px 4px; }
        .nav-plan-box { margin-top:10px; background:#f8f7ff; border:1.5px solid #e8e5ff; border-radius:10px; padding:10px 12px; display:flex; }
        .nav-plan-stat { flex:1; text-align:center; }
        .nav-plan-stat + .nav-plan-stat { border-left:1px solid #e8e5ff; }
        .nav-plan-stat-label { font-size:9px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:.07em; margin-bottom:3px; }
        .nav-plan-stat-val { font-size:15px; font-weight:800; line-height:1; }
        .nav-plan-stat-sub { font-size:9px; color:#aaa; font-weight:500; margin-top:1px; }
        .nav-login { font-size:13px; font-weight:600; color:#666; text-decoration:none; padding:8px 14px; border-radius:10px; transition:all 0.2s; }
        .nav-login:hover { color:#111; background:#f5f5f0; }
        .nav-join { font-size:13px; font-weight:700; color:#fff; background:linear-gradient(135deg,#4f46e5,#7c3aed); padding:9px 18px; border-radius:10px; text-decoration:none; transition:all 0.2s; box-shadow:0 2px 10px rgba(79,70,229,0.3); }
        .nav-join:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,70,229,0.4); }
        .nav-hamburger { display:none; width:40px; height:40px; border-radius:10px; border:1.5px solid #ebebeb; background:none; cursor:pointer; align-items:center; justify-content:center; flex-direction:column; gap:5px; padding:10px; transition:all 0.2s; }
        @media(max-width:900px){ .nav-hamburger { display:flex; } }
        .nav-hamburger:hover { background:#f5f5f0; }
        .nav-hamburger span { display:block; width:18px; height:2px; background:#111; border-radius:2px; }
        .nav-mobile { display:none; background:#fff; border-top:1px solid #ebebeb; padding:12px 24px 20px; flex-direction:column; gap:4px; max-height:85vh; overflow-y:auto; }
        .nav-mobile.open { display:flex; }
        .nav-mobile-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:14px 0 6px; }
        .nav-mobile-link { font-size:14px; font-weight:600; color:#555; text-decoration:none; padding:11px 0; border-bottom:1px solid #f5f5f5; transition:color 0.2s; display:flex; align-items:center; gap:10px; }
        .nav-mobile-link:hover, .nav-mobile-link.active { color:#4f46e5; }
        .nav-mobile-upgrade { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #f5f5f5; font-size:14px; font-weight:700; color:#4f46e5; text-decoration:none; }
        .nav-mobile-incomplete { display:flex; align-items:center; gap:8px; padding:13px 10px; border-bottom:1px solid #fde68a; font-size:14px; font-weight:700; color:#b45309; text-decoration:none; background:#fff8e1; border-radius:8px; margin-bottom:4px; }
        .nav-plan-badge { display:inline-flex; align-items:center; gap:4px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-radius:100px; font-size:9px; font-weight:800; padding:2px 8px; margin-left:4px; }
      `}</style>

      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img
              src="/collabzy-logo.png"
              alt="Collabzy"
              style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }}
            />
          </Link>

          {user ? (
            <div className="nav-links">
              {isInfluencer && (<>
                <Link href="/discovery"  prefetch={false}      className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
                <Link href="/my-applications" prefetch={false}  className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
                <Link href="/messages"  prefetch={false}       className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification"  prefetch={false}   className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
              {isBrand && (<>
                <Link href="/browse" prefetch={false}       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
                <Link href="/campaigns" prefetch={false}    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                <Link href="/messages" prefetch={false}     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification" prefetch={false}  className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
              {isAdmin && (<>
                <Link href="/admin" prefetch={false}        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
                <Link href="/campaigns"prefetch={false}     className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                <Link href="/deals" prefetch={false}        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
                <Link href="/messages" prefetch={false}     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification" prefetch={false}  className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
            </div>
          ) : <div />}

          <div className="nav-right">
            {user ? (
              <>
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <div className="nav-avatar">
                      {displayImage
                        ? <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <span>{displayName.charAt(0).toUpperCase()}</span>}
                    </div>
                    <span className="nav-avatar-name">
                      {displayName}
                      {user?.isSubscribed && currentPlanLabel !== "Free" && (
                        <span className="nav-plan-badge">✦ {currentPlanLabel}</span>
                      )}
                    </span>
                    <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
                      <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="nav-dropdown">
                      <div className="nav-dd-user">
                        <p className="nav-dd-username">{displayName}</p>
                        <span className="nav-dd-role">{role}</span>
                        {user?.isSubscribed && currentPlanLabel !== "Free" ? (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.1))", border:"1px solid rgba(79,70,229,0.3)", color:"#4f46e5", borderRadius:"100px", fontSize:9, fontWeight:800, padding:"2px 8px" }}>
                              ✦ {currentPlanLabel} Active
                            </span>
                          </div>
                        ) : isProfileIncomplete ? (
                          <div style={{ marginTop: 6 }}>
                            <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#f0fdf4", border:"1px solid #86efac", color:"#16a34a", borderRadius:"100px", fontSize:9, fontWeight:700, padding:"2px 7px" }}>✅ Profile Complete</span>
                          </div>
                        )}

                        {isInfluencer && (() => {
                          const { tokensLeft, tokensTotal } = getCreatorPlanStats();
                          return (
                            <div className="nav-plan-box">
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Tokens</div>
                                <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
                                <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
                              </div>
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Plan</div>
                                <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{currentPlanLabel}</div>
                                <div className="nav-plan-stat-sub">current</div>
                              </div>
                            </div>
                          );
                        })()}
                        {isBrand && (() => {
                          const { plan, tokensLeft } = getBrandPlanStats();
                          return (
                            <div className="nav-plan-box">
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Tokens</div>
                                <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
                                <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
                              </div>
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Plan</div>
                                <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{currentPlanLabel}</div>
                                <div className="nav-plan-stat-sub">current</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="nav-dd-sep" />
                      <Link href="/upgrade"prefetch={false}  className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
                      {isProfileIncomplete && (
                        <Link href="/my-profile" prefetch={false}  className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>⚠️ Complete Your Profile</Link>
                      )}
                      <div className="nav-dd-sep" />
                      <Link href="/my-profile" prefetch={false}    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
                      <Link href="/setup-profile" prefetch={false}  className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
                      {isInfluencer && (<>
                        <div className="nav-dd-sep" />
                        <div className="nav-dd-section">My Work</div>
                        <Link href="/deals" prefetch={false}   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
                        <Link href="/rewards" prefetch={false}  className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
                      </>)}
                      {isBrand && (<>
                        <div className="nav-dd-sep" />
                        <div className="nav-dd-section">Brand Tools</div>
                        <Link href="/deals" prefetch={false}           className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
                        <Link href="/campaigns/post" prefetch={false}  className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
                      </>)}
                      {isAdmin && (<>
                        <Link href="/admin" prefetch={false}           className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
                        <Link href="/campaigns/post" prefetch={false}  className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
                      </>)}
                      <div className="nav-dd-sep" />
                      <button className="nav-dd-item danger" onClick={handleLogout}>🚪 Logout</button>
                    </div>
                  )}
                </div>
                <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
                  <span /><span /><span />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-login">Login</Link>
                <Link href="/join"  className="nav-join">Join</Link>
              </>
            )}
          </div>
        </div>

        {user && (
          <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
            {isProfileIncomplete && (
              <Link href="/my-profile" className="nav-mobile-incomplete" onClick={() => setMobileMenuOpen(false)}>⚠️ Complete Your Profile</Link>
            )}
            <div className="nav-mobile-section">Main</div>
            {isInfluencer && <Link href="/discovery" prefetch={false}       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
            {isBrand      && <Link href="/browse" prefetch={false}          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
            {(isBrand||isAdmin) && <Link href="/campaigns" prefetch={false}  className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
            {isInfluencer && <Link href="/my-applications" prefetch={false}  className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
            <Link href="/messages" prefetch={false}  className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
              Messages {msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
            </Link>
            <Link href="/notification" prefetch={false}  className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
              Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
            <div className="nav-mobile-section">Work</div>
            <Link href="/deals" prefetch={false}  className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
            {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}
            {isBrand && (<>
              <div className="nav-mobile-section">Brand Tools</div>
              <Link href="/campaigns/post" prefetch={false}  className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
            </>)}
            {isAdmin && (<>
              <div className="nav-mobile-section">Admin</div>
              <Link href="/admin" prefetch={false}  className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
            </>)}
            <div className="nav-mobile-section">Account</div>
            <Link href="/upgrade" prefetch={false}       className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
            <Link href="/my-profile" prefetch={false}    className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
            <Link href="/setup-profile" prefetch={false}  className={`nav-mobile-link ${isActive("/setup-profile") ? "active" : ""}`}>View Profile</Link>
            <button
              className="nav-mobile-link"
              style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
}


// "use client";

// import { useEffect, useState, useRef, useCallback } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:             { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:      { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly: { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:       { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly:  { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:             { label: "Free",  applies: 10,          tokens: 100         },
//   pro_monthly:      { label: "Pro",   applies: 100,         tokens: 1000        },
//   pro_plus_monthly: { label: "Pro+",  applies: 200,         tokens: 2000        },
//   pro_yearly:       { label: "Pro",   applies: "unlimited", tokens: "unlimited" },
//   pro_plus_yearly:  { label: "Pro+",  applies: "unlimited", tokens: "unlimited" },
// };

// const getPlanLabel = (plan: string): string => {
//   if (!plan || plan === "free") return "Free";
//   const p = plan.toLowerCase().trim();
//   if (p.includes("pro_plus") || p.includes("pro+")) return "Pro+";
//   if (p.includes("pro")) return "Pro";
//   return "Free";
// };

// const getBrandPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return BRAND_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return BRAND_PLAN_LIMITS["pro_plus_monthly"];
//   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// };

// const getCreatorPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return CREATOR_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return CREATOR_PLAN_LIMITS["pro_plus_monthly"];
//   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]                     = useState<any>(null);
//   const [profile, setProfile]               = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen]     = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount]       = useState(0);
//   const [msgUnread, setMsgUnread]           = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]         = useState(0);
//   const [profileLoaded, setProfileLoaded] = useState(false);
//   const [appliesUsed, setAppliesUsed]     = useState(0);
//   // bits: live token count shown in navbar dropdown
//   const [bits, setBits] = useState<number | null>(null);

//   const pathnameRef = useRef<string>(pathname || "");
//   useEffect(() => { pathnameRef.current = pathname || ""; }, [pathname]);

//   // ─── Core sync: read localStorage → update all navbar state ──────────────
//   const syncFromStorage = useCallback(() => {
//     try {
//       const raw = localStorage.getItem("cb_user");
//       if (!raw) return;
//       const latest = JSON.parse(raw);
//       // Force object identity change so React re-renders
//       setUser((prev: any) => {
//         const prevBits = prev?.bits;
//         const newBits  = latest?.bits;
//         // Always update — spread guarantees new reference
//         if (latest.bits != null) setBits(Number(latest.bits));
//         return { ...latest };
//       });
//     } catch {}
//   }, []);

//   // ─── plan_updated listener (same-tab, fired by PostCampaign after submit) ──
//   useEffect(() => {
//     const handler = (e: any) => {
//       // If event carries bits directly, use it instantly (no localStorage read needed)
//       if (e.detail?.bits != null) {
//         setBits(Number(e.detail.bits));
//       }
//       // Then do full sync to catch any other fields
//       syncFromStorage();
//     };
//     window.addEventListener("plan_updated", handler);
//     return () => window.removeEventListener("plan_updated", handler);
//   }, [syncFromStorage]);

//   // ─── Initial load + route change ─────────────────────────────────────────
//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const storedRaw = localStorage.getItem("cb_user");
//     if (!storedRaw) { setUser(null); setProfile(null); setUnreadCount(0); return; }

//     let parsedUser: any;
//     try { parsedUser = JSON.parse(storedRaw); } catch { return; }

//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);
//     if (parsedUser.bits != null) setBits(Number(parsedUser.bits));

//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         if (data?.success && data.profile) setProfile(data.profile);
//         setProfileLoaded(true);
//       }).catch(() => {});

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           if (!data) return;
//           const list: any[] = data.data || data.campaigns || [];
//           const fresh = JSON.parse(localStorage.getItem("cb_user") || "{}");
//           const planActivatedAt = fresh.planActivatedAt;
//           const isSubscribed = fresh.isSubscribed ?? false;
//           if (isSubscribed && planActivatedAt) {
//             const planStart = new Date(planActivatedAt);
//             setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//           } else {
//             const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//             setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//           }
//         }).catch(() => {});
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           if (!data) return;
//           const list: any[] = data.applications || data.data || [];
//           const fresh = JSON.parse(localStorage.getItem("cb_user") || "{}");
//           const isSubscribed = fresh.isSubscribed ?? false;
//           const planActivatedAt = fresh.planActivatedAt;
//           if (isSubscribed && planActivatedAt) {
//             const planStart = new Date(planActivatedAt);
//             setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//           } else {
//             const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//             setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//           }
//         }).catch(() => {});
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages")) fetchMsgUnread(token, parsedUser);
//   }, [pathname]);

//   // ─── Msg unread init ──────────────────────────────────────────────────────
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const saved = localStorage.getItem("msg_unread_count");
//     if (saved !== null && !pathname?.startsWith("/messages")) setMsgUnread(Number(saved));
//   }, []);

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch {}
//   };

//   // const fetchMsgUnread = async (token: string, parsedUser?: any) => {
//   //   try {
//   //     const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//   //     const data = await res.json();
//   //     const convs: any[] = data?.data || data?.conversations || data || [];
//   //     const u = parsedUser || user;
//   //     const myId = u?._id || u?.id || u?.user?._id || u?.user?.id;
//   //     const total = convs.reduce((sum: number, c: any) => {
//   //       const uc = c.unreadCounts?.[myId] ?? c.unreadCount ?? c.unread ?? 0;
//   //       return sum + uc;
//   //     }, 0);
//   //     setMsgUnread(total);
//   //     localStorage.setItem("msg_unread_count", String(total));
//   //   } catch {}
//   // };

//   const fetchMsgUnread = async (token: string, parsedUser?: any) => {
//   try {
//     const res  = await fetch(`${API_BASE}/conversations/user/all`, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     const convs: any[] = data?.chats || data?.data || data?.conversations || data || [];
//     const u = parsedUser || user;
//     const myId = u?._id || u?.id || u?.user?._id || u?.user?.id;
//     const total = convs.reduce((sum: number, c: any) => {
//       const uc = c.unread_count ?? c.unreadCounts?.[myId] ?? c.unreadCount ?? c.unread ?? 0;
//       return sum + uc;
//     }, 0);
//     setMsgUnread(total);
//     localStorage.setItem("msg_unread_count", String(total));
//   } catch {}
// };


//   // ─── Notification page: mark all read ────────────────────────────────────
//   useEffect(() => {
//     if (!pathname?.startsWith("/notification")) return;
//     setUnreadCount(0);
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const token = JSON.parse(stored).token || localStorage.getItem("token");
//     if (!token) return;
//     fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const notifs: any[] = data.notifications || data.data || [];
//         notifs.filter((n: any) => !n.read).forEach((n: any) => {
//           fetch(`${API_BASE}/notification/read/${n._id}`, {
//             method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//           }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   const prevPathRef = useRef<string>("");
//   useEffect(() => {
//     const prev = prevPathRef.current;
//     prevPathRef.current = pathname || "";
//     if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
//       const saved = localStorage.getItem("msg_unread_count");
//       if (saved !== null) setMsgUnread(Number(saved));
//     }
//   }, [pathname]);

//   // ─── Storage event (cross-tab) + other window events ─────────────────────
//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits"  && e.newValue !== null) setBits(Number(e.newValue));
//       if (e.key === "cb_user" && e.newValue) {
//         try {
//           const updated = JSON.parse(e.newValue);
//           setUser({ ...updated });
//           if (updated.bits != null) setBits(Number(updated.bits));
//         } catch {}
//       }
//       if (e.key === "msg_unread_count" && e.newValue !== null) {
//         if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(Number(e.newValue));
//       }
//     };

//     const handleMsgCount = (e: any) => {
//       const count = e.detail?.count ?? 0;
//       if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(count);
//     };

//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") {
//           if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(e.data.count ?? 0);
//         }
//         if (e.data?.type === "plan_update") syncFromStorage();
//       };
//     } catch {}

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, [syncFromStorage]);

//   // ─── Visibility change: re-sync when tab comes back into focus ───────────
//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       syncFromStorage();
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       let parsedUser: any;
//       try { parsedUser = JSON.parse(stored); } catch { return; }
//       const token = parsedUser.token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathnameRef.current.startsWith("/notification")) fetchUnreadCount(token);
//       if (!pathnameRef.current.startsWith("/messages")) {
//         fetchMsgUnread(token, parsedUser);
//       } else {
//         const saved = localStorage.getItem("msg_unread_count");
//         if (saved !== null) setMsgUnread(Number(saved));
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [syncFromStorage]);

//   // ─── Click outside dropdown ───────────────────────────────────────────────
//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   // ─── Helpers ──────────────────────────────────────────────────────────────
//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getLivePlan = () => {
//     const p = user?.plan || user?.activePlan || "free";
//     const paidPlans = ["pro_monthly","pro_plus_monthly","pro_yearly","pro_plus_yearly","pro","pro_plus","pro_year","pro_plus_year"];
//     return paidPlans.includes(p) ? p : "free";
//   };

//   const getBrandPlanStats = () => {
//     const plan     = getBrandPlanLimits(getLivePlan());
//     // ✅ bits state is always the freshest value — updated directly by plan_updated event
//     const liveBits = bits ?? user?.bits ?? plan.tokens;
//     return {
//       plan,
//       campsLeft:  Math.max(0, plan.campaigns - campsUsed),
//       tokensLeft: Math.max(0, Number(liveBits)),
//     };
//   };

//   const getCreatorPlanStats = () => {
//     const plan       = getCreatorPlanLimits(getLivePlan());
//     const isUnlim    = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//     const liveBits   = Number(bits ?? user?.bits ?? planTokens);
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
//     const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         const planVal = u.plan || u.activePlan;
//         if (planVal) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: planVal, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch {}
//     }
//     ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read","msg_unread_count"]
//       .forEach(k => localStorage.removeItem(k));
//     setUser(null); setProfile(null); setMsgUnread(0);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage     = profile?.profileImage || user?.profileImage || null;
//   const isActive         = (path: string) => pathname?.startsWith(path);
//   const currentPlanLabel = getPlanLabel(getLivePlan());

//   const isProfileIncomplete = (() => {
//     if (!user || isAdmin || !profileLoaded) return false;
//     if (isInfluencer) {
//       const p = profile || {};
//       return !(p.followers || p.followersCount) || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.platform || p.platformLink);
//     }
//     if (isBrand) {
//       const p = profile || {};
//       return !p.companyName || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.website || p.websiteUrl);
//     }
//     return false;
//   })();

//   const handleMsgClick = () => {
//     setMsgUnread(0);
//     localStorage.setItem("msg_unread_count", "0");
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position:sticky; top:0; z-index:9999; background:#fff; border-bottom:1px solid #ebebeb; font-family:'Plus Jakarta Sans',sans-serif; }
//         .nav-inner { max-width:1280px; margin:0 auto; padding:0 24px; height:72px; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns:auto auto; justify-content:space-between; } .nav-inner > *:nth-child(2) { display:none; } }
//         .nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; flex-shrink:0; }
//         .nav-links { display:flex; align-items:center; gap:4px; justify-content:center; flex-wrap:nowrap; overflow-x:auto; }
//         @media(max-width:900px){ .nav-links { display:none; } }
//         .nav-link { font-size:12.5px; font-weight:600; color:#777; text-decoration:none; padding:6px 7px; border-radius:9px; transition:all 0.18s; white-space:nowrap; display:flex; align-items:center; gap:5px; }
//         .nav-link:hover { color:#111; background:#f5f5f3; }
//         .nav-link.active { color:#4f46e5; background:#eef2ff; }
//         .nav-notif-badge { background:#ef4444; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
//         .nav-msg-badge { background:#25d366; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
//         .nav-right { display:flex; align-items:center; gap:8px; justify-content:flex-end; }
//         .nav-avatar-btn { display:flex; align-items:center; gap:8px; padding:4px 10px 4px 4px; border-radius:100px; border:1.5px solid #ebebeb; background:none; cursor:pointer; transition:all 0.2s; }
//         .nav-avatar-btn:hover { border-color:#c7d2fe; background:#f8f7ff; }
//         .nav-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#fff; overflow:hidden; flex-shrink:0; position:relative; }
//         .nav-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
//         .nav-avatar-name { font-size:13px; font-weight:600; color:#111; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
//         @media(max-width:480px){ .nav-avatar-name { display:none; } }
//         .nav-incomplete-badge { display:inline-flex; align-items:center; gap:4px; background:#fff8e1; border:1px solid #f59e0b; color:#b45309; border-radius:100px; font-size:9px; font-weight:700; padding:2px 7px; margin-top:4px; }
//         .nav-dropdown { position:absolute; top:calc(100% + 8px); right:0; width:260px; background:#fff; border-radius:16px; border:1.5px solid #ebebeb; box-shadow:0 8px 30px rgba(0,0,0,0.1); padding:8px; z-index:9999; animation:dropIn 0.15s ease; max-height:calc(100vh - 80px); overflow-y:auto; overflow-x:hidden; }
//         @keyframes dropIn { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)} }
//         .nav-dd-user { padding:10px 12px 12px; }
//         .nav-dd-username { font-size:14px; font-weight:700; color:#111; margin:0 0 4px; }
//         .nav-dd-role { font-size:10px; color:#fff; text-transform:uppercase; letter-spacing:0.08em; margin:0; display:inline-block; padding:2px 8px; border-radius:100px; background:linear-gradient(135deg,#4f46e5,#7c3aed); font-weight:700; }
//         .nav-dd-sep { height:1px; background:#f0f0f0; margin:6px 0; }
//         .nav-dd-item { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px; font-size:13px; font-weight:600; color:#444; text-decoration:none; transition:background 0.15s; cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Plus Jakarta Sans',sans-serif; }
//         .nav-dd-item:hover { background:#f5f5f0; color:#111; }
//         .nav-dd-item.danger { color:#ef4444; }
//         .nav-dd-item.danger:hover { background:#fff5f5; }
//         .nav-dd-item.upgrade-dd { background:linear-gradient(135deg,#ede9fe,#e0e7ff); color:#4f46e5; font-weight:700; }
//         .nav-dd-item.upgrade-dd:hover { background:linear-gradient(135deg,#ddd6fe,#c7d2fe); }
//         .nav-dd-item.incomplete-dd { background:#fff8e1; color:#b45309; font-weight:700; border:1px solid #fde68a; }
//         .nav-dd-item.incomplete-dd:hover { background:#fef3c7; }
//         .nav-dd-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:8px 12px 4px; }
//         .nav-plan-box { margin-top:10px; background:#f8f7ff; border:1.5px solid #e8e5ff; border-radius:10px; padding:10px 12px; display:flex; }
//         .nav-plan-stat { flex:1; text-align:center; }
//         .nav-plan-stat + .nav-plan-stat { border-left:1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size:9px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:.07em; margin-bottom:3px; }
//         .nav-plan-stat-val { font-size:15px; font-weight:800; line-height:1; }
//         .nav-plan-stat-sub { font-size:9px; color:#aaa; font-weight:500; margin-top:1px; }
//         .nav-login { font-size:13px; font-weight:600; color:#666; text-decoration:none; padding:8px 14px; border-radius:10px; transition:all 0.2s; }
//         .nav-login:hover { color:#111; background:#f5f5f0; }
//         .nav-join { font-size:13px; font-weight:700; color:#fff; background:linear-gradient(135deg,#4f46e5,#7c3aed); padding:9px 18px; border-radius:10px; text-decoration:none; transition:all 0.2s; box-shadow:0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display:none; width:40px; height:40px; border-radius:10px; border:1.5px solid #ebebeb; background:none; cursor:pointer; align-items:center; justify-content:center; flex-direction:column; gap:5px; padding:10px; transition:all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger { display:flex; } }
//         .nav-hamburger:hover { background:#f5f5f0; }
//         .nav-hamburger span { display:block; width:18px; height:2px; background:#111; border-radius:2px; }
//         .nav-mobile { display:none; background:#fff; border-top:1px solid #ebebeb; padding:12px 24px 20px; flex-direction:column; gap:4px; max-height:85vh; overflow-y:auto; }
//         .nav-mobile.open { display:flex; }
//         .nav-mobile-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:14px 0 6px; }
//         .nav-mobile-link { font-size:14px; font-weight:600; color:#555; text-decoration:none; padding:11px 0; border-bottom:1px solid #f5f5f5; transition:color 0.2s; display:flex; align-items:center; gap:10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color:#4f46e5; }
//         .nav-mobile-upgrade { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #f5f5f5; font-size:14px; font-weight:700; color:#4f46e5; text-decoration:none; }
//         .nav-mobile-incomplete { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #fde68a; font-size:14px; font-weight:700; color:#b45309; text-decoration:none; background:#fff8e1; border-radius:8px; padding-left:10px; margin-bottom:4px; }
//         .nav-plan-badge { display:inline-flex; align-items:center; gap:4px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-radius:100px; font-size:9px; font-weight:800; padding:2px 8px; margin-left:4px; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img
//               src="/collabzy-logo.png"
//               alt="Collabzy"
//               style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }}
//             />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages"        className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification"    className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//             </div>
//           ) : <div />}

//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage
//                         ? <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">
//                       {displayName}
//                       {user?.isSubscribed && currentPlanLabel !== "Free" && (
//                         <span className="nav-plan-badge">✦ {currentPlanLabel}</span>
//                       )}
//                     </span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                         {user?.isSubscribed && currentPlanLabel !== "Free" ? (
//                           <div style={{ marginTop: 6 }}>
//                             <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.1))", border:"1px solid rgba(79,70,229,0.3)", color:"#4f46e5", borderRadius:"100px", fontSize:9, fontWeight:800, padding:"2px 8px" }}>
//                               ✦ {currentPlanLabel} Active
//                             </span>
//                           </div>
//                         ) : isProfileIncomplete ? (
//                           <div style={{ marginTop: 6 }}>
//                             <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
//                           </div>
//                         ) : (
//                           <div style={{ marginTop: 6 }}>
//                             <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#f0fdf4", border:"1px solid #86efac", color:"#16a34a", borderRadius:"100px", fontSize:9, fontWeight:700, padding:"2px 7px" }}>✅ Profile Complete</span>
//                           </div>
//                         )}

//                         {/* ✅ Token count — reads from bits state which updates instantly on plan_updated */}
//                         {isInfluencer && (() => {
//                           const { tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{currentPlanLabel}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                         {isBrand && (() => {
//                           const { plan, tokensLeft } = getBrandPlanStats();
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{currentPlanLabel}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>

//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       {isProfileIncomplete && (
//                         <Link href="/my-profile" className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>⚠️ Complete Your Profile</Link>
//                       )}
//                       <div className="nav-dd-sep" />
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
//                       {isInfluencer && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">My Work</div>
//                         <Link href="/deals"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/rewards" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                       </>)}
//                       {isBrand && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">Brand Tools</div>
//                         <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}
//                       {isAdmin && (<>
//                         <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}
//                       <div className="nav-dd-sep" />
//                       <button className="nav-dd-item danger" onClick={handleLogout}>🚪 Logout</button>
//                     </div>
//                   )}
//                 </div>
//                 <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
//                   <span /><span /><span />
//                 </button>
//               </>
//             ) : (
//               <>
//                 <Link href="/login" className="nav-login">Login</Link>
//                 <Link href="/join"  className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isProfileIncomplete && (
//               <Link href="/my-profile" className="nav-mobile-incomplete" onClick={() => setMobileMenuOpen(false)}>⚠️ Complete Your Profile</Link>
//             )}
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//               Messages {msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//             </Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>
//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals" className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}
//             {isBrand && (<>
//               <div className="nav-mobile-section">Brand Tools</div>
//               <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//             </>)}
//             {isAdmin && (<>
//               <div className="nav-mobile-section">Admin</div>
//               <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//             </>)}
//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"       className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile"    className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/setup-profile" className={`nav-mobile-link ${isActive("/setup-profile") ? "active" : ""}`}>View Profile</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}
//             >
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef, useCallback } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:             { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:      { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly: { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:       { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly:  { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:             { label: "Free",  applies: 10,          tokens: 100         },
//   pro_monthly:      { label: "Pro",   applies: 100,         tokens: 1000        },
//   pro_plus_monthly: { label: "Pro+",  applies: 200,         tokens: 2000        },
//   pro_yearly:       { label: "Pro",   applies: "unlimited", tokens: "unlimited" },
//   pro_plus_yearly:  { label: "Pro+",  applies: "unlimited", tokens: "unlimited" },
// };

// const getPlanLabel = (plan: string): string => {
//   if (!plan || plan === "free") return "Free";
//   const p = plan.toLowerCase().trim();
//   if (p.includes("pro_plus") || p.includes("pro+")) return "Pro+";
//   if (p.includes("pro")) return "Pro";
//   return "Free";
// };

// const getBrandPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return BRAND_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return BRAND_PLAN_LIMITS["pro_plus_monthly"];
//   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// };

// const getCreatorPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return CREATOR_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return CREATOR_PLAN_LIMITS["pro_plus_monthly"];
//   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]                     = useState<any>(null);
//   const [profile, setProfile]               = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen]     = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount]       = useState(0);
//   const [msgUnread, setMsgUnread]           = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]         = useState(0);
//   const [profileLoaded, setProfileLoaded] = useState(false);
//   const [appliesUsed, setAppliesUsed]     = useState(0);
//   const [bits, setBits]                   = useState<number | null>(null);

//   const pathnameRef = useRef<string>(pathname || "");
//   useEffect(() => { pathnameRef.current = pathname || ""; }, [pathname]);

// //   // ✅ Full re-read from localStorage — plan + bits + isSubscribed sab
// //   const syncFromStorage = useCallback(() => {
// //     try {
// //       const raw = localStorage.getItem("cb_user");
// //       if (!raw) return;
// //       const latest = JSON.parse(raw);
// //       // setUser((prev: any) => {
// //       //   // hamesha update karo — plan change detect karne ki zarurat nahi
// //       //   return { ...latest };
// //       // });
// //   //     setUser(JSON.parse(JSON.stringify(latest))); // 🔥 force re-render
// //   //     if (latest.bits != null) setBits(Number(latest.bits));
// //   //   } catch {}
// //   // }, []);
// //   setUser((prev: any) => {
// //   if (!prev) return latest;

// //   const prevBits = prev.bits;
// //   const newBits  = latest.bits;

// //   if (prevBits !== newBits) {
// //     if (latest.bits != null) setBits(Number(latest.bits));

// //     return JSON.parse(JSON.stringify(latest)); // ✅ FORCE RE-RENDER
// //   }

// //   return prev;
// // });
    
// // const syncFromStorage = useCallback(() => {
// //   try {
// //     const raw = localStorage.getItem("cb_user");
// //     if (!raw) return;

// //     const latest = JSON.parse(raw);

// //     setUser({ ...latest }); // ✅ ALWAYS update
// //     if (latest.bits != null) setBits(Number(latest.bits));

// //   } catch {}
// // }, []);
// const syncFromStorage = useCallback(() => {
//   try {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;

//     const latest = JSON.parse(raw);

//     console.log("🔄 syncing navbar", latest.bits);

//     // 🔥 FORCE RE-RENDER
//     setUser(JSON.parse(JSON.stringify(latest)));

//     setBits(Number(latest.bits ?? 0));

//   } catch (err) {
//     console.log("sync error", err);
//   }
// }, []);


// useEffect(() => {
//   const handler = (e: any) => {
//     console.log("🔥 plan_updated received", e.detail);

//     syncFromStorage(); // 🔥 update navbar instantly
//   };

//   window.addEventListener("plan_updated", handler);

//   return () => {
//     window.removeEventListener("plan_updated", handler);
//   };
// }, [syncFromStorage]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const saved = localStorage.getItem("msg_unread_count");
//     if (saved !== null && !pathname?.startsWith("/messages")) {
//       setMsgUnread(Number(saved));
//     }
//   }, []);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedRaw = localStorage.getItem("cb_user");
//     if (!storedRaw) { setUser(null); setProfile(null); setUnreadCount(0); return; }

//     let parsedUser: any;
//     try { parsedUser = JSON.parse(storedRaw); } catch { return; }

//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);
//     if (parsedUser.bits != null) setBits(Number(parsedUser.bits));

//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         if (data?.success && data.profile) setProfile(data.profile);
//         setProfileLoaded(true);
//       }).catch(() => {});

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           if (!data) return;
//           const list: any[] = data.data || data.campaigns || [];
//           const fresh = JSON.parse(localStorage.getItem("cb_user") || "{}");
//           const planActivatedAt = fresh.planActivatedAt;
//           const isSubscribed = fresh.isSubscribed ?? false;
//           if (isSubscribed && planActivatedAt) {
//             const planStart = new Date(planActivatedAt);
//             setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//           } else {
//             const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//             setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//           }
//         }).catch(() => {});
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           if (!data) return;
//           const list: any[] = data.applications || data.data || [];
//           const fresh = JSON.parse(localStorage.getItem("cb_user") || "{}");
//           const isSubscribed = fresh.isSubscribed ?? false;
//           const planActivatedAt = fresh.planActivatedAt;
//           if (isSubscribed && planActivatedAt) {
//             const planStart = new Date(planActivatedAt);
//             setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//           } else {
//             const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//             setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//           }
//         }).catch(() => {});
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages")) fetchMsgUnread(token, parsedUser);
//   }, [pathname]);

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { }
//   };

//   const fetchMsgUnread = async (token: string, parsedUser?: any) => {
//     try {
//       const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const u = parsedUser || user;
//       const myId = u?._id || u?.id || u?.user?._id || u?.user?.id;
//       const total = convs.reduce((sum: number, c: any) => {
//         const uc = c.unreadCounts?.[myId] ?? c.unreadCount ?? c.unread ?? 0;
//         return sum + uc;
//       }, 0);
//       setMsgUnread(total);
//       localStorage.setItem("msg_unread_count", String(total));
//     } catch { }
//   };

//   useEffect(() => {
//     if (!pathname?.startsWith("/notification")) return;
//     setUnreadCount(0);
//     const stored = localStorage.getItem("cb_user");
//     if (!stored) return;
//     const token = JSON.parse(stored).token || localStorage.getItem("token");
//     if (!token) return;
//     fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const notifs: any[] = data.notifications || data.data || [];
//         notifs.filter((n: any) => !n.read).forEach((n: any) => {
//           fetch(`${API_BASE}/notification/read/${n._id}`, {
//             method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//           }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   const prevPathRef = useRef<string>("");
//   useEffect(() => {
//     const prev = prevPathRef.current;
//     prevPathRef.current = pathname || "";
//     if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
//       const saved = localStorage.getItem("msg_unread_count");
//       if (saved !== null) setMsgUnread(Number(saved));
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//       if (e.key === "cb_user" && e.newValue) {
//         try {
//           const updated = JSON.parse(e.newValue);
//           setUser(updated);
//           if (updated.bits != null) setBits(Number(updated.bits));
//         } catch { }
//       }
//       if (e.key === "msg_unread_count" && e.newValue !== null) {
//         if (!pathnameRef.current.startsWith("/messages")) {
//           setMsgUnread(Number(e.newValue));
//         }
//       }
//     };

//     const handleMsgCount = (e: any) => {
//       const count = e.detail?.count ?? 0;
//       if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(count);
//     };

//     // ✅ plan_updated event — SAME TAB mein turant sync karo
//     // const handlePlanUpdated = () => {
//     //   syncFromStorage();
//     // };
// //     const handlePlanUpdated = () => {
// //   syncFromStorage();

// //   // 🔥 bits ko force update karo
// //   const raw = localStorage.getItem("cb_user");
// //   if (raw) {
// //     const parsed = JSON.parse(raw);
// //     if (parsed.bits != null) {
// //       setBits(Number(parsed.bits));
// //     }
// //   }
// // };
// // const handlePlanUpdated = () => {
// //   try {
// //     const raw = localStorage.getItem("cb_user");
// //     if (!raw) return;

// //     const latest = JSON.parse(raw);

// //     setUser({ ...latest }); // 🔥 force re-render
// //     if (latest.bits != null) setBits(Number(latest.bits));

// //   } catch {}
// // };
// const handlePlanUpdated = async () => {
//   try {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) return;

//     const latest = JSON.parse(raw);

//     setUser({ ...latest });

//     if (latest.bits != null) {
//       setBits(Number(latest.bits));
//     }

//     const token = latest.token || localStorage.getItem("token");
//     if (!token) return;

//     // 🔥 CAMPAIGNS REFRESH (IMPORTANT)
//     if (latest.role?.toLowerCase() === "brand") {
//       const res = await fetch(`${API_BASE}/campaigns/my`, {
//         headers: { Authorization: `Bearer ${token}` }
//       });

//       const data = await res.json();
//       const list: any[] = data.data || data.campaigns || [];

//       const planActivatedAt = latest.planActivatedAt;
//       const isSubscribed = latest.isSubscribed ?? false;

//       if (isSubscribed && planActivatedAt) {
//         const planStart = new Date(planActivatedAt);
//         setCampsUsed(
//           list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length
//         );
//       } else {
//         const monthStart = new Date();
//         monthStart.setDate(1);
//         monthStart.setHours(0,0,0,0);

//         setCampsUsed(
//           list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length
//         );
//       }
//     }

//   } catch (err) {
//     console.log("plan update error", err);
//   }
// };

//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") {
//           if (!pathnameRef.current.startsWith("/messages")) setMsgUnread(e.data.count ?? 0);
//         }
//         if (e.data?.type === "plan_update") syncFromStorage();
//       };
//     } catch { }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     window.addEventListener("plan_updated", handlePlanUpdated); // ✅ same tab
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       window.removeEventListener("plan_updated", handlePlanUpdated);
//       bc?.close();
//     };
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [syncFromStorage]);

//   // ✅ Polling — har 3 sec mein localStorage check karo (same tab ke liye failsafe)
//   // useEffect(() => {
//   //   if (typeof window === "undefined") return;
//   //   const interval = setInterval(() => {
//   //     try {
//   //       const raw = localStorage.getItem("cb_user");
//   //       if (!raw) return;
//   //       const latest = JSON.parse(raw);
//   //       setUser((prev: any) => {
//   //         if (!prev) return latest;
//   //         const prevPlan = prev.plan || prev.activePlan || "free";
//   //         const newPlan  = latest.plan || latest.activePlan || "free";
//   //         const prevSub  = prev.isSubscribed;
//   //         const newSub   = latest.isSubscribed;
//   //         const prevBits = prev.bits;
//   //         const newBits  = latest.bits;
//   //         if (prevPlan !== newPlan || prevSub !== newSub || prevBits !== newBits) {
//   //           if (latest.bits != null) setBits(Number(latest.bits));
//   //           return { ...latest };
//   //         }
//   //         return prev;
//   //       });
//   //     } catch {}
//   //   }, 3000);
//   //   return () => clearInterval(interval);
//   // }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       syncFromStorage();
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       let parsedUser: any;
//       try { parsedUser = JSON.parse(stored); } catch { return; }
//       const token = parsedUser.token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathnameRef.current.startsWith("/notification")) fetchUnreadCount(token);
//       if (!pathnameRef.current.startsWith("/messages")) {
//         fetchMsgUnread(token, parsedUser);
//       } else {
//         const saved = localStorage.getItem("msg_unread_count");
//         if (saved !== null) setMsgUnread(Number(saved));
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [syncFromStorage]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getLivePlan = () => {
//     const p = user?.plan || user?.activePlan || "free";
//     const paidPlans = ["pro_monthly","pro_plus_monthly","pro_yearly","pro_plus_yearly","pro","pro_plus","pro_year","pro_plus_year"];
//     return paidPlans.includes(p) ? p : "free";
//   };

//   const getBrandPlanStats = () => {
//     const plan     = getBrandPlanLimits(getLivePlan());
//     const liveBits = bits ?? user?.bits ?? plan.tokens;
//     return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
//   };

//   const getCreatorPlanStats = () => {
//     const plan       = getCreatorPlanLimits(getLivePlan());
//     const isUnlim    = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//     const liveBits   = Number(bits ?? user?.bits ?? planTokens);
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
//     const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         const planVal = u.plan || u.activePlan;
//         if (planVal) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: planVal, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch { }
//     }
//     ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read","msg_unread_count"]
//       .forEach(k => localStorage.removeItem(k));
//     setUser(null); setProfile(null); setMsgUnread(0);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage     = profile?.profileImage || user?.profileImage || null;
//   const isActive         = (path: string) => pathname?.startsWith(path);
//   const currentPlanLabel = getPlanLabel(getLivePlan());

//   const isProfileIncomplete = (() => {
//     if (!user || isAdmin || !profileLoaded) return false;
//     if (isInfluencer) {
//       const p = profile || {};
//       return !(p.followers || p.followersCount) || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.platform || p.platformLink);
//     }
//     if (isBrand) {
//       const p = profile || {};
//       return !p.companyName || !(p.categories?.length > 0) || !(p.location || p.city) || !(p.website || p.websiteUrl);
//     }
//     return false;
//   })();

//   const handleMsgClick = () => {
//     setMsgUnread(0);
//     localStorage.setItem("msg_unread_count", "0");
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position:sticky; top:0; z-index:9999; background:#fff; border-bottom:1px solid #ebebeb; font-family:'Plus Jakarta Sans',sans-serif; }
//         .nav-inner { max-width:1280px; margin:0 auto; padding:0 24px; height:72px; display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns:auto auto; justify-content:space-between; } .nav-inner > *:nth-child(2) { display:none; } }
//         .nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; flex-shrink:0; }
//         .nav-links { display:flex; align-items:center; gap:4px; justify-content:center; flex-wrap:nowrap; overflow-x:auto; }
//         @media(max-width:900px){ .nav-links { display:none; } }
//         .nav-link { font-size:12.5px; font-weight:600; color:#777; text-decoration:none; padding:6px 7px; border-radius:9px; transition:all 0.18s; white-space:nowrap; display:flex; align-items:center; gap:5px; }
//         .nav-link:hover { color:#111; background:#f5f5f3; }
//         .nav-link.active { color:#4f46e5; background:#eef2ff; }
//         .nav-notif-badge { background:#ef4444; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
//         .nav-msg-badge { background:#25d366; color:#fff; border-radius:100px; font-size:9px; padding:1px 5px; font-weight:800; display:inline-block; }
//         .nav-right { display:flex; align-items:center; gap:8px; justify-content:flex-end; }
//         .nav-avatar-btn { display:flex; align-items:center; gap:8px; padding:4px 10px 4px 4px; border-radius:100px; border:1.5px solid #ebebeb; background:none; cursor:pointer; transition:all 0.2s; }
//         .nav-avatar-btn:hover { border-color:#c7d2fe; background:#f8f7ff; }
//         .nav-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#fff; overflow:hidden; flex-shrink:0; position:relative; }
//         .nav-avatar img { width:100%; height:100%; object-fit:cover; border-radius:50%; }
//         .nav-avatar-name { font-size:13px; font-weight:600; color:#111; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
//         @media(max-width:480px){ .nav-avatar-name { display:none; } }
//         .nav-incomplete-badge { display:inline-flex; align-items:center; gap:4px; background:#fff8e1; border:1px solid #f59e0b; color:#b45309; border-radius:100px; font-size:9px; font-weight:700; padding:2px 7px; margin-top:4px; }
//         .nav-dropdown { position:absolute; top:calc(100% + 8px); right:0; width:260px; background:#fff; border-radius:16px; border:1.5px solid #ebebeb; box-shadow:0 8px 30px rgba(0,0,0,0.1); padding:8px; z-index:9999; animation:dropIn 0.15s ease; max-height:calc(100vh - 80px); overflow-y:auto; overflow-x:hidden; }
//         @keyframes dropIn { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)} }
//         .nav-dd-user { padding:10px 12px 12px; }
//         .nav-dd-username { font-size:14px; font-weight:700; color:#111; margin:0 0 4px; }
//         .nav-dd-role { font-size:10px; color:#fff; text-transform:uppercase; letter-spacing:0.08em; margin:0; display:inline-block; padding:2px 8px; border-radius:100px; background:linear-gradient(135deg,#4f46e5,#7c3aed); font-weight:700; }
//         .nav-dd-sep { height:1px; background:#f0f0f0; margin:6px 0; }
//         .nav-dd-item { display:flex; align-items:center; gap:8px; padding:9px 12px; border-radius:10px; font-size:13px; font-weight:600; color:#444; text-decoration:none; transition:background 0.15s; cursor:pointer; border:none; background:none; width:100%; text-align:left; font-family:'Plus Jakarta Sans',sans-serif; }
//         .nav-dd-item:hover { background:#f5f5f0; color:#111; }
//         .nav-dd-item.danger { color:#ef4444; }
//         .nav-dd-item.danger:hover { background:#fff5f5; }
//         .nav-dd-item.upgrade-dd { background:linear-gradient(135deg,#ede9fe,#e0e7ff); color:#4f46e5; font-weight:700; }
//         .nav-dd-item.upgrade-dd:hover { background:linear-gradient(135deg,#ddd6fe,#c7d2fe); }
//         .nav-dd-item.incomplete-dd { background:#fff8e1; color:#b45309; font-weight:700; border:1px solid #fde68a; }
//         .nav-dd-item.incomplete-dd:hover { background:#fef3c7; }
//         .nav-dd-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:8px 12px 4px; }
//         .nav-plan-box { margin-top:10px; background:#f8f7ff; border:1.5px solid #e8e5ff; border-radius:10px; padding:10px 12px; display:flex; }
//         .nav-plan-stat { flex:1; text-align:center; }
//         .nav-plan-stat + .nav-plan-stat { border-left:1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size:9px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:.07em; margin-bottom:3px; }
//         .nav-plan-stat-val { font-size:15px; font-weight:800; line-height:1; }
//         .nav-plan-stat-sub { font-size:9px; color:#aaa; font-weight:500; margin-top:1px; }
//         .nav-login { font-size:13px; font-weight:600; color:#666; text-decoration:none; padding:8px 14px; border-radius:10px; transition:all 0.2s; }
//         .nav-login:hover { color:#111; background:#f5f5f0; }
//         .nav-join { font-size:13px; font-weight:700; color:#fff; background:linear-gradient(135deg,#4f46e5,#7c3aed); padding:9px 18px; border-radius:10px; text-decoration:none; transition:all 0.2s; box-shadow:0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display:none; width:40px; height:40px; border-radius:10px; border:1.5px solid #ebebeb; background:none; cursor:pointer; align-items:center; justify-content:center; flex-direction:column; gap:5px; padding:10px; transition:all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger { display:flex; } }
//         .nav-hamburger:hover { background:#f5f5f0; }
//         .nav-hamburger span { display:block; width:18px; height:2px; background:#111; border-radius:2px; }
//         .nav-mobile { display:none; background:#fff; border-top:1px solid #ebebeb; padding:12px 24px 20px; flex-direction:column; gap:4px; max-height:85vh; overflow-y:auto; }
//         .nav-mobile.open { display:flex; }
//         .nav-mobile-section { font-size:10px; font-weight:700; color:#bbb; text-transform:uppercase; letter-spacing:0.08em; padding:14px 0 6px; }
//         .nav-mobile-link { font-size:14px; font-weight:600; color:#555; text-decoration:none; padding:11px 0; border-bottom:1px solid #f5f5f5; transition:color 0.2s; display:flex; align-items:center; gap:10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color:#4f46e5; }
//         .nav-mobile-upgrade { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #f5f5f5; font-size:14px; font-weight:700; color:#4f46e5; text-decoration:none; }
//         .nav-mobile-incomplete { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #fde68a; font-size:14px; font-weight:700; color:#b45309; text-decoration:none; background:#fff8e1; border-radius:8px; padding-left:10px; margin-bottom:4px; }
//         /* ✅ Pro badge in navbar */
//         .nav-plan-badge { display:inline-flex; align-items:center; gap:4px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-radius:100px; font-size:9px; font-weight:800; padding:2px 8px; margin-left:4px; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height:89, width:"auto", maxWidth:280, objectFit:"contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages"        className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification"    className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//             </div>
//           ) : <div />}

//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position:"relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage
//                         ? <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">
//                       {displayName}
//                       {/* ✅ Live plan badge next to name */}
//                       {user?.isSubscribed && currentPlanLabel !== "Free" && (
//                         <span className="nav-plan-badge">✦ {currentPlanLabel}</span>
//                       )}
//                     </span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                         {/* ✅ Live plan status */}
//                         {user?.isSubscribed && currentPlanLabel !== "Free" ? (
//                           <div style={{ marginTop:6 }}>
//                             <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"linear-gradient(135deg,rgba(79,70,229,0.1),rgba(124,58,237,0.1))", border:"1px solid rgba(79,70,229,0.3)", color:"#4f46e5", borderRadius:"100px", fontSize:9, fontWeight:800, padding:"2px 8px" }}>
//                               ✦ {currentPlanLabel} Active
//                             </span>
//                           </div>
//                         ) : isProfileIncomplete ? (
//                           <div style={{ marginTop:6 }}>
//                             <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
//                           </div>
//                         ) : (
//                           <div style={{ marginTop:6 }}>
//                             <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#f0fdf4", border:"1px solid #86efac", color:"#16a34a", borderRadius:"100px", fontSize:9, fontWeight:700, padding:"2px 7px" }}>✅ Profile Complete</span>
//                           </div>
//                         )}

//                         {isInfluencer && (() => {
//                           const { tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color:"#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color:"#111", fontSize:13 }}>{currentPlanLabel}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                         {isBrand && (() => {
//                           const { plan, tokensLeft } = getBrandPlanStats();
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color:"#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color:"#111", fontSize:13 }}>{currentPlanLabel}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>

//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       {isProfileIncomplete && (
//                         <Link href="/my-profile" className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>⚠️ Complete Your Profile</Link>
//                       )}
//                       <div className="nav-dd-sep" />
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
//                       {isInfluencer && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">My Work</div>
//                         <Link href="/deals"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/rewards" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                       </>)}
//                       {isBrand && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">Brand Tools</div>
//                         <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}
//                       {isAdmin && (<>
//                         <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}
//                       <div className="nav-dd-sep" />
//                       <button className="nav-dd-item danger" onClick={handleLogout}>🚪 Logout</button>
//                     </div>
//                   )}
//                 </div>
//                 <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
//                   <span /><span /><span />
//                 </button>
//               </>
//             ) : (
//               <>
//                 <Link href="/login" className="nav-login">Login</Link>
//                 <Link href="/join"  className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isProfileIncomplete && (
//               <Link href="/my-profile" className="nav-mobile-incomplete" onClick={() => setMobileMenuOpen(false)}>⚠️ Complete Your Profile</Link>
//             )}
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
//               Messages {msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//             </Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>
//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals" className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}
//             {isBrand && (<>
//               <div className="nav-mobile-section">Brand Tools</div>
//               <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//             </>)}
//             {isAdmin && (<>
//               <div className="nav-mobile-section">Admin</div>
//               <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//             </>)}
//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"       className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile"    className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/setup-profile" className={`nav-mobile-link ${isActive("/setup-profile") ? "active" : ""}`}>View Profile</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color:"#ef4444", border:"none", background:"none", cursor:"pointer", textAlign:"left", width:"100%", fontFamily:"inherit" }}
//               onClick={handleLogout}
//             >Logout</button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


