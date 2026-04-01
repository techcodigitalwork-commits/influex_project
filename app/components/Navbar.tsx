"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

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

export default function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();

  const [user, setUser]                     = useState<any>(null);
  const [profile, setProfile]               = useState<any>(null);
  const [dropdownOpen, setDropdownOpen]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [msgUnread, setMsgUnread]           = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [campsUsed, setCampsUsed]         = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [appliesUsed, setAppliesUsed]     = useState(0);
  const [bits, setBits]                   = useState<number | null>(null);

  const pathnameRef = useRef<string>(pathname || "");
  useEffect(() => { pathnameRef.current = pathname || ""; }, [pathname]);

  // ✅ Helper to read latest user from localStorage
  const readUserFromStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem("cb_user");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }, []);

  // ✅ Sync user + bits from localStorage — call this anytime cb_user changes
  const syncUserFromStorage = useCallback(() => {
    const latest = readUserFromStorage();
    if (!latest) return;
    setUser(latest);
    if (latest.bits != null) setBits(Number(latest.bits));
  }, [readUserFromStorage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("msg_unread_count");
    if (saved !== null && !pathname?.startsWith("/messages")) {
      setMsgUnread(Number(saved));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRaw = localStorage.getItem("cb_user");
    if (!storedRaw) { setUser(null); setProfile(null); setUnreadCount(0); return; }

    let parsedUser: any;
    try { parsedUser = JSON.parse(storedRaw); } catch { return; }

    const token = parsedUser.token || localStorage.getItem("token");
    if (!token) { setUser(null); setProfile(null); return; }

    setUser(parsedUser);
    if (parsedUser.bits != null) setBits(Number(parsedUser.bits));

    fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data?.success && data.profile) setProfile(data.profile);
        setProfileLoaded(true);
      }).catch(() => {});

    if (parsedUser.role?.toLowerCase() === "brand") {
      fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (!data) return;
          const list: any[] = data.data || data.campaigns || [];
          const fresh = readUserFromStorage() || parsedUser;
          const planActivatedAt = fresh.planActivatedAt;
          const isSubscribed = fresh.isSubscribed ?? false;
          if (isSubscribed && planActivatedAt) {
            const planStart = new Date(planActivatedAt);
            setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
          } else {
            const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
            setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
          }
        }).catch(() => {});
    }

    if (parsedUser.role?.toLowerCase() === "influencer") {
      fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          if (!data) return;
          const list: any[] = data.applications || data.data || [];
          const fresh = readUserFromStorage() || parsedUser;
          const isSubscribed = fresh.isSubscribed ?? false;
          const planActivatedAt = fresh.planActivatedAt;
          if (isSubscribed && planActivatedAt) {
            const planStart = new Date(planActivatedAt);
            setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
          } else {
            const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
            setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
          }
        }).catch(() => {});
    }

    if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
    if (!pathname?.startsWith("/messages")) fetchMsgUnread(token, parsedUser);
  }, [pathname]);

  const fetchUnreadCount = async (token: string) => {
    try {
      const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const notifs: any[] = data.notifications || data.data || [];
      setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
    } catch { }
  };

  const fetchMsgUnread = async (token: string, parsedUser?: any) => {
    try {
      const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const convs: any[] = data?.data || data?.conversations || data || [];
      const u = parsedUser || user;
      const myId = u?._id || u?.id || u?.user?._id || u?.user?.id;
      const total = convs.reduce((sum: number, c: any) => {
        const uc = c.unreadCounts?.[myId] ?? c.unreadCount ?? c.unread ?? 0;
        return sum + uc;
      }, 0);
      setMsgUnread(total);
      localStorage.setItem("msg_unread_count", String(total));
    } catch { }
  };

  useEffect(() => {
    if (!pathname?.startsWith("/notification")) return;
    setUnreadCount(0);
    const stored = localStorage.getItem("cb_user");
    if (!stored) return;
    const token = JSON.parse(stored).token || localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        const notifs: any[] = data.notifications || data.data || [];
        notifs.filter((n: any) => !n.read).forEach((n: any) => {
          fetch(`${API_BASE}/notification/read/${n._id}`, {
            method: "PATCH", headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        });
      }).catch(() => {});
  }, [pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/messages")) setMsgUnread(0);
  }, [pathname]);

  const prevPathRef = useRef<string>("");
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname || "";
    if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
      const saved = localStorage.getItem("msg_unread_count");
      if (saved !== null) setMsgUnread(Number(saved));
    }
  }, [pathname]);

  // ✅ MAIN FIX: storage event — cb_user change hone pe plan + bits + isSubscribed update karo
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "notif_all_read") setUnreadCount(0);
      if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
      if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));

      // ✅ KEY FIX: cb_user change → full user + bits + plan update
      if (e.key === "cb_user" && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setUser(updated);
          if (updated.bits != null) setBits(Number(updated.bits));
        } catch { }
      }

      if (e.key === "msg_unread_count" && e.newValue !== null) {
        if (!pathnameRef.current.startsWith("/messages")) {
          setMsgUnread(Number(e.newValue));
        }
      }
    };

    const handleMsgCount = (e: any) => {
      const count = e.detail?.count ?? 0;
      if (!pathnameRef.current.startsWith("/messages")) {
        setMsgUnread(count);
      }
    };

    // ✅ CustomEvent: plan update hone pe navbar live update
    const handlePlanUpdate = () => {
      syncUserFromStorage();
    };

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("msg_unread");
      bc.onmessage = (e) => {
        if (e.data?.type === "msg_unread_update") {
          if (!pathnameRef.current.startsWith("/messages")) {
            setMsgUnread(e.data.count ?? 0);
          }
        }
        // ✅ Plan update broadcast from other tabs
        if (e.data?.type === "plan_update") {
          syncUserFromStorage();
        }
      };
    } catch { }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("msg_unread_update", handleMsgCount);
    window.addEventListener("plan_updated", handlePlanUpdate); // ✅ custom event
    if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("msg_unread_update", handleMsgCount);
      window.removeEventListener("plan_updated", handlePlanUpdate);
      bc?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUserFromStorage]);

  // ✅ POLLING: har 5 second mein localStorage se sync karo (same tab ke liye)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => {
      const latest = readUserFromStorage();
      if (!latest) return;
      setUser((prev: any) => {
        // sirf tab update karo jab plan/bits/isSubscribed change hua ho
        const planChanged    = (latest.plan || latest.activePlan) !== (prev?.plan || prev?.activePlan);
        const bitsChanged    = latest.bits !== prev?.bits;
        const subChanged     = latest.isSubscribed !== prev?.isSubscribed;
        if (planChanged || bitsChanged || subChanged) {
          if (latest.bits != null) setBits(Number(latest.bits));
          return latest;
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [readUserFromStorage]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // ✅ Tab visible hone pe bhi sync karo
      syncUserFromStorage();
      const stored = localStorage.getItem("cb_user");
      if (!stored) return;
      let parsedUser: any;
      try { parsedUser = JSON.parse(stored); } catch { return; }
      const token = parsedUser.token || localStorage.getItem("token");
      if (!token) return;
      if (!pathnameRef.current.startsWith("/notification")) fetchUnreadCount(token);
      if (!pathnameRef.current.startsWith("/messages")) {
        fetchMsgUnread(token, parsedUser);
      } else {
        const saved = localStorage.getItem("msg_unread_count");
        if (saved !== null) setMsgUnread(Number(saved));
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUserFromStorage]);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

  if (pathname === "/" && user) return null;

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
    const plan       = getCreatorPlanLimits(getLivePlan());
    const isUnlim    = plan.applies === "unlimited";
    const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
    const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
    const liveBits   = Number(bits ?? user?.bits ?? planTokens);
    const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
    const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
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
      } catch { }
    }
    ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read","msg_unread_count"]
      .forEach(k => localStorage.removeItem(k));
    setUser(null); setProfile(null); setMsgUnread(0);
    router.push("/");
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

  const handleMsgClick = () => {
    setMsgUnread(0);
    localStorage.setItem("msg_unread_count", "0");
  };

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
        .nav-mobile-incomplete { display:flex; align-items:center; gap:8px; padding:13px 0; border-bottom:1px solid #fde68a; font-size:14px; font-weight:700; color:#b45309; text-decoration:none; background:#fff8e1; border-radius:8px; padding-left:10px; margin-bottom:4px; }
      `}</style>

      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <img src="/collabzy-logo.png" alt="Collabzy" style={{ height:89, width:"auto", maxWidth:280, objectFit:"contain" }} />
          </Link>

          {user ? (
            <div className="nav-links">
              {isInfluencer && (<>
                <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
                <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
                <Link href="/messages"        className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification"    className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
              {isBrand && (<>
                <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
                <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
              {isAdmin && (<>
                <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
                <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
                <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
                  Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
                </Link>
                <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                  Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                </Link>
              </>)}
            </div>
          ) : <div />}

          <div className="nav-right">
            {user ? (
              <>
                <div style={{ position:"relative" }} ref={dropdownRef}>
                  <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <div className="nav-avatar">
                      {displayImage
                        ? <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <span>{displayName.charAt(0).toUpperCase()}</span>}
                    </div>
                    <span className="nav-avatar-name">{displayName}</span>
                    <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
                      <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <div className="nav-dropdown">
                      <div className="nav-dd-user">
                        <p className="nav-dd-username">{displayName}</p>
                        <span className="nav-dd-role">{role}</span>
                        {isProfileIncomplete ? (
                          <div style={{ marginTop:6 }}>
                            <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
                          </div>
                        ) : (
                          <div style={{ marginTop:6 }}>
                            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#f0fdf4", border:"1px solid #86efac", color:"#16a34a", borderRadius:"100px", fontSize:9, fontWeight:700, padding:"2px 7px" }}>✅ Profile Complete</span>
                          </div>
                        )}

                        {isInfluencer && (() => {
                          const { tokensLeft, tokensTotal } = getCreatorPlanStats();
                          return (
                            <div className="nav-plan-box">
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Tokens</div>
                                <div className="nav-plan-stat-val" style={{ color:"#7c3aed" }}>{fmtNum(tokensLeft)}</div>
                                <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
                              </div>
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Plan</div>
                                <div className="nav-plan-stat-val" style={{ color:"#111", fontSize:13 }}>{currentPlanLabel}</div>
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
                                <div className="nav-plan-stat-val" style={{ color:"#7c3aed" }}>{fmtNum(tokensLeft)}</div>
                                <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
                              </div>
                              <div className="nav-plan-stat">
                                <div className="nav-plan-stat-label">Plan</div>
                                <div className="nav-plan-stat-val" style={{ color:"#111", fontSize:13 }}>{currentPlanLabel}</div>
                                <div className="nav-plan-stat-sub">current</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="nav-dd-sep" />
                      <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
                      {isProfileIncomplete && (
                        <Link href="/my-profile" className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>⚠️ Complete Your Profile</Link>
                      )}
                      <div className="nav-dd-sep" />
                      <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
                      <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
                      {isInfluencer && (<>
                        <div className="nav-dd-sep" />
                        <div className="nav-dd-section">My Work</div>
                        <Link href="/deals"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
                        <Link href="/rewards" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
                      </>)}
                      {isBrand && (<>
                        <div className="nav-dd-sep" />
                        <div className="nav-dd-section">Brand Tools</div>
                        <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
                        <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
                      </>)}
                      {isAdmin && (<>
                        <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
                        <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
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
            {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
            {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
            {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
            {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
            <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={handleMsgClick}>
              Messages {msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
            </Link>
            <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
              Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>
            <div className="nav-mobile-section">Work</div>
            <Link href="/deals" className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
            {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}
            {isBrand && (<>
              <div className="nav-mobile-section">Brand Tools</div>
              <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
            </>)}
            {isAdmin && (<>
              <div className="nav-mobile-section">Admin</div>
              <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
            </>)}
            <div className="nav-mobile-section">Account</div>
            <Link href="/upgrade"       className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
            <Link href="/my-profile"    className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
            <Link href="/setup-profile" className={`nav-mobile-link ${isActive("/setup-profile") ? "active" : ""}`}>View Profile</Link>
            <button
              className="nav-mobile-link"
              style={{ color:"#ef4444", border:"none", background:"none", cursor:"pointer", textAlign:"left", width:"100%", fontFamily:"inherit" }}
              onClick={handleLogout}
            >Logout</button>
          </div>
        )}
      </nav>
    </>
  );
}



// "use client";

// import { useEffect, useState, useRef } from "react";
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

//   // ✅ KEY FIX: pathname ko ref mein bhi rakho
//   // Event listeners closures mein hamesha latest pathname milega
//   const pathnameRef = useRef<string>(pathname || "");
//   useEffect(() => {
//     pathnameRef.current = pathname || "";
//   }, [pathname]);

//   // ✅ Page load pe localStorage se count lo
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

//   // Notification page pe unread clear karo
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

//   // Messages page pe count zero
//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   // Messages page SE bahar aane pe localStorage se count lo
//   const prevPathRef = useRef<string>("");
//   useEffect(() => {
//     const prev = prevPathRef.current;
//     prevPathRef.current = pathname || "";
//     if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
//       const saved = localStorage.getItem("msg_unread_count");
//       if (saved !== null) setMsgUnread(Number(saved));
//     }
//   }, [pathname]);

//   // ✅ MAIN FIX: Event listeners — pathnameRef use karo (stale closure nahi hoga)
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
//       // ✅ FIX: pathnameRef.current — stale nahi hoga
//       if (e.key === "msg_unread_count" && e.newValue !== null) {
//         if (!pathnameRef.current.startsWith("/messages")) {
//           setMsgUnread(Number(e.newValue));
//         }
//       }
//     };

//     // ✅ FIX: CustomEvent — pathnameRef.current use karo
//     const handleMsgCount = (e: any) => {
//       const count = e.detail?.count ?? 0;
//       if (!pathnameRef.current.startsWith("/messages")) {
//         setMsgUnread(count);
//       }
//     };

//     // ✅ BroadcastChannel — dusre tabs ke liye
//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") {
//           if (!pathnameRef.current.startsWith("/messages")) {
//             setMsgUnread(e.data.count ?? 0);
//           }
//         }
//       };
//     } catch { }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   // ✅ FIX: dependency array se pathname hata do — pathnameRef se padhta hai
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
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
//         // Messages page pe hain — localStorage se latest lo
//         const saved = localStorage.getItem("msg_unread_count");
//         if (saved !== null) setMsgUnread(Number(saved));
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

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

//   // ✅ Messages click — zero karo
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
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                         {isProfileIncomplete ? (
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



// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:                   { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:            { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly:       { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:             { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly:        { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:                   { label: "Free",  applies: 10,          tokens: 100          },
//   pro_monthly:            { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus_monthly:       { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_yearly:             { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_yearly:        { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
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

//   // ✅ FIX: localStorage se initial count lo — page load pe bhi sahi dikhega
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const saved = localStorage.getItem("msg_unread_count");
//     if (saved !== null) {
//       const n = Number(saved);
//       // Sirf tab show karo jab messages page pe nahi hain
//       if (!pathname?.startsWith("/messages")) setMsgUnread(n);
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

//     // ✅ FIX: Messages page pe hain to fetch mat karo (messages page khud manage karta hai)
//     // Dusre pages pe hain to server se latest count lo
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
//       // ✅ localStorage bhi sync karo
//       localStorage.setItem("msg_unread_count", String(total));
//     } catch { }
//   };

//   // Notification page pe jaane se unread zero karo
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

//   // ✅ FIX: Messages page pe jaane se count zero karo
//   // Messages page se AANE pe count dobara lo (localStorage se)
//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) {
//       // Messages page pe hain — count zero karo (page khud manage karega)
//       setMsgUnread(0);
//     }
//   }, [pathname]);

//   // ✅ FIX: Messages page SE bahar jaane pe localStorage se latest count lo
//   const prevPathRef = useRef<string>("");
//   useEffect(() => {
//     const prev = prevPathRef.current;
//     prevPathRef.current = pathname || "";

//     // Agar pehle messages page pe the aur ab nahi hain
//     if (prev.startsWith("/messages") && !pathname?.startsWith("/messages")) {
//       const saved = localStorage.getItem("msg_unread_count");
//       if (saved !== null) setMsgUnread(Number(saved));
//     }
//   }, [pathname]);

//   // ✅ MAIN FIX: Live events sunna — messages page se real-time updates
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
//       // ✅ FIX: msg_unread_count localStorage change pe update karo
//       // (yeh tab fire hota hai jab DUSRE TAB mein messages page se update aata hai)
//       if (e.key === "msg_unread_count" && e.newValue !== null) {
//         if (!pathname?.startsWith("/messages")) {
//           setMsgUnread(Number(e.newValue));
//         }
//       }
//     };

//     // ✅ FIX: CustomEvent — SAME TAB mein messages page se live update
//     const handleMsgCount = (e: any) => {
//       const count = e.detail?.count ?? 0;
//       // Messages page pe hain to navbar update mat karo (count wahan manage ho raha hai)
//       // Dusre pages pe hain to update karo
//       if (!pathname?.startsWith("/messages")) {
//         setMsgUnread(count);
//       }
//     };

//     // ✅ FIX: BroadcastChannel — dusre tabs ke liye
//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") {
//           if (!pathname?.startsWith("/messages")) {
//             setMsgUnread(e.data.count ?? 0);
//           }
//         }
//       };
//     } catch { }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, [pathname]); // ✅ pathname dependency — taaki messages page check fresh rahe

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       let parsedUser: any;
//       try { parsedUser = JSON.parse(stored); } catch { return; }
//       const token = parsedUser.token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       // ✅ Messages page pe visible ho to fetch mat karo
//       if (!pathname?.startsWith("/messages")) fetchMsgUnread(token, parsedUser);
//       // Messages page se bahar hain to localStorage se bhi check karo
//       if (!pathname?.startsWith("/messages")) {
//         const saved = localStorage.getItem("msg_unread_count");
//         if (saved !== null) setMsgUnread(Math.max(Number(saved), 0));
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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
//     const paidPlans = [
//       "pro_monthly", "pro_plus_monthly", "pro_yearly", "pro_plus_yearly",
//       "pro", "pro_plus", "pro_year", "pro_plus_year",
//     ];
//     return paidPlans.includes(p) ? p : "free";
//   };

//   const getBrandPlanStats = () => {
//     const planStr  = getLivePlan();
//     const plan     = getBrandPlanLimits(planStr);
//     const liveBits = bits ?? user?.bits ?? plan.tokens;
//     return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
//   };

//   const getCreatorPlanStats = () => {
//     const planStr    = getLivePlan();
//     const plan       = getCreatorPlanLimits(planStr);
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

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);
//   const currentPlanLabel = getPlanLabel(getLivePlan());

//   const isProfileIncomplete = (() => {
//     if (!user || isAdmin || !profileLoaded) return false;
//     if (isInfluencer) {
//       const p = profile || {};
//       const hasFollowers = p.followers || p.followersCount;
//       const hasCategory  = p.categories && p.categories.length > 0;
//       const hasCity      = p.location || p.city;
//       const hasLink      = p.platform || p.platformLink;
//       return !(hasFollowers && hasCategory && hasCity && hasLink);
//     }
//     if (isBrand) {
//       const p = profile || {};
//       const hasCompany  = p.companyName;
//       const hasCategory = p.categories && p.categories.length > 0;
//       const hasCity     = p.location || p.city;
//       const hasWebsite  = p.website || p.websiteUrl;
//       return !(hasCompany && hasCategory && hasCity && hasWebsite);
//     }
//     return false;
//   })();

//   // ✅ Messages link click handler — count zero karo
//   const handleMsgClick = () => {
//     setMsgUnread(0);
//     localStorage.setItem("msg_unread_count", "0");
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; position: relative; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-incomplete-dot { width: 9px; height: 9px; background: #f59e0b; border-radius: 50%; border: 1.5px solid #fff; position: absolute; top: 0; right: 0; }
//         .nav-incomplete-badge { display: inline-flex; align-items: center; gap: 4px; background: #fff8e1; border: 1px solid #f59e0b; color: #b45309; border-radius: 100px; font-size: 9px; font-weight: 700; padding: 2px 7px; margin-top: 4px; }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-item.incomplete-dd { background: #fff8e1; color: #b45309; font-weight: 700; border: 1px solid #fde68a; }
//         .nav-dd-item.incomplete-dd:hover { background: #fef3c7; }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box { margin-top: 10px; background: #f8f7ff; border: 1.5px solid #e8e5ff; border-radius: 10px; padding: 10px 12px; display: flex; gap: 0; }
//         .nav-plan-stat { flex: 1; text-align: center; }
//         .nav-plan-stat + .nav-plan-stat { border-left: 1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
//         .nav-plan-stat-val { font-size: 15px; font-weight: 800; line-height: 1; }
//         .nav-plan-stat-sub { font-size: 9px; color: #aaa; font-weight: 500; margin-top: 1px; }
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//         .nav-mobile-incomplete { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #fde68a; font-size: 14px; font-weight: 700; color: #b45309; text-decoration: none; background: #fff8e1; border-radius: 8px; padding-left: 10px; margin-bottom: 4px; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
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
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isProfileIncomplete ? (
//                           <div style={{ marginTop: 6 }}>
//                             <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
//                           </div>
//                         ) : (
//                           <div style={{ marginTop: 6 }}>
//                             <span style={{
//                               display: "inline-flex", alignItems: "center", gap: 4,
//                               background: "#f0fdf4", border: "1px solid #86efac",
//                               color: "#16a34a", borderRadius: "100px",
//                               fontSize: 9, fontWeight: 700, padding: "2px 7px",
//                             }}>✅ Profile Complete</span>
//                           </div>
//                         )}

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
//                         <Link href="/my-profile" className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>
//                           ⚠️ Complete Your Profile
//                         </Link>
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
//               <Link href="/my-profile" className="nav-mobile-incomplete" onClick={() => setMobileMenuOpen(false)}>
//                 ⚠️ Complete Your Profile
//               </Link>
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

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:                    { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:       { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly:  { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:        { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly:   { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:                        { label: "Free",  applies: 10,          tokens: 100          },
//   pro_monthly:      { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus_monthly: { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_yearly:       { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_yearly:  { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const getPlanLabel = (plan: string): string => {
//   if (!plan || plan === "free") return "Free";
//   const p = plan.toLowerCase().trim();
//   if (p.includes("pro_plus") || p.includes("pro+")) return "Pro+";
//   if (p.includes("pro")) return "Pro";
//   return "Free";
// };

// // const getBrandPlanLimits = (plan: string) => {
// //   const p = (plan || "").toLowerCase().trim();
// //   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// // };
// // const getBrandPlanLimits = (plan: string) => {
// //   const p = (plan || "").toLowerCase().trim();
  
// //   // ✅ Short plan names handle karo
// //   if (p === "pro_plus" || p === "pro+" || p.includes("pro_plus")) return BRAND_PLAN_LIMITS["brand_pro_plus_monthly"];
// //   if (p === "pro" || p.includes("pro")) return BRAND_PLAN_LIMITS["brand_pro_monthly"];
  
// //   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// // };

// const getBrandPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return BRAND_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return BRAND_PLAN_LIMITS["pro_plus_monthly"];
//   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// };



// // const getCreatorPlanLimits = (plan: string) => {
// //   const p = (plan || "").toLowerCase().trim();
// //   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// // };

// // const getCreatorPlanLimits = (plan: string) => {
// //   const p = (plan || "").toLowerCase().trim();
  
// //   // ✅ Short plan names handle karo
// //   if (p === "pro_plus" || p === "pro+" || p.includes("pro_plus")) return CREATOR_PLAN_LIMITS["influencer_pro_plus_monthly"];
// //   if (p === "pro" || p.includes("pro")) return CREATOR_PLAN_LIMITS["influencer_pro_monthly"];
  
// //   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// // };
// const getCreatorPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   if (p === "pro") return CREATOR_PLAN_LIMITS["pro_monthly"];
//   if (p === "pro+" || p === "pro_plus") return CREATOR_PLAN_LIMITS["pro_plus_monthly"];
//   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// };


// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]                 = useState<any>(null);
//   const [profile, setProfile]           = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount]   = useState(0);
//   const [msgUnread, setMsgUnread]       = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [profileLoaded, setProfileLoaded] = useState(false);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

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
//          setProfileLoaded(true); // ✅ ADD
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
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//   }, [pathname]);

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { }
//   };

//   // const fetchMsgUnread = async (token: string) => {
//   //   try {
//   //     const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//   //     const data = await res.json();
//   //     const convs: any[] = data?.data || data?.conversations || data || [];
//   //     const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//   //     setMsgUnread(total);
//   //   } catch { }
//   // };


//   const fetchMsgUnread = async (token: string) => {
//   try {
//     const res  = await fetch(`${API_BASE}/conversations/my`, {
//       headers: { Authorization: `Bearer ${token}` }
//     });

//     const data = await res.json();
//     const convs: any[] = data?.data || data?.conversations || data || [];

//     const myId =
//       user?._id ||
//       user?.id ||
//       user?.user?._id ||
//       user?.user?.id;

//     const total = convs.reduce((sum: number, c: any) => {
//       const uc = c.unreadCounts?.[myId] || 0;
//       return sum + uc;
//     }, 0);

//     setMsgUnread(total);

//   } catch {}
// };

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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
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
//     };

//     const handleMsgCount = (e: any) => setMsgUnread(e.detail?.count ?? 0);

//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") setMsgUnread(e.data.count ?? 0);
//       };
//     } catch { }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       let parsedUser: any;
//       try { parsedUser = JSON.parse(stored); } catch { return; }
//       const token = parsedUser.token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   // const getLivePlan = () => (user?.plan || user?.activePlan || "free");

//   // const getBrandPlanStats = () => {
//   //   const u        = user || {};
//   //   const subbed   = u.isSubscribed ?? false;
//   //   const planStr  = subbed ? getLivePlan() : "free";
//   //   const plan     = getBrandPlanLimits(planStr);
//   //   const liveBits = bits ?? u.bits ?? plan.tokens;
//   //   return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
//   // };
//   // console.log("Plan string:", getLivePlan(), "isSubscribed:", user?.isSubscribed);

//   // const getCreatorPlanStats = () => {
//   //   const u       = user || {};
//   //   const subbed  = u.isSubscribed ?? false;
//   //   const planStr = subbed ? getLivePlan() : "free";
//   //   const plan    = getCreatorPlanLimits(planStr);
//   //   const isUnlim = plan.applies === "unlimited";
//   //   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   //   const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   //   const liveBits   = Number(bits ?? u.bits ?? planTokens);
//   //   const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
//   //   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   //   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   //   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   // };
    
//      const getLivePlan = () => {
//   const p = user?.plan || user?.activePlan || "free";
//   const paidPlans = [
//     "pro_monthly", "pro_plus_monthly", "pro_yearly", "pro_plus_yearly",
//     "pro", "pro_plus", "pro_year", "pro_plus_year",
//   ];
//   return paidPlans.includes(p) ? p : "free";
// };

// const getBrandPlanStats = () => {
//   const planStr  = getLivePlan();
//   const plan     = getBrandPlanLimits(planStr);
//   const liveBits = bits ?? user?.bits ?? plan.tokens;
//   return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
// };

// const getCreatorPlanStats = () => {
//   const planStr    = getLivePlan();
//   const plan       = getCreatorPlanLimits(planStr);
//   const isUnlim    = plan.applies === "unlimited";
//   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   const liveBits   = Number(bits ?? user?.bits ?? planTokens);
//   const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(liveBits, planTokens));
//   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
// };


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
//     ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read"]
//       .forEach(k => localStorage.removeItem(k));
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   // ✅ Signup se hi name show hoga — profile load hone ke baad update hoga automatically
//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);
//   const currentPlanLabel = getPlanLabel(getLivePlan());

//   // ✅ Incomplete profile check
//   // const isProfileIncomplete = (() => {
//   //   if (!user || isAdmin) return false;
//   //   if (isInfluencer) {
//   //     const p = profile || {};
//   //     const hasFollowers = p.followersCount || p.followers || p.followerCount;
//   //     const hasCategory  = p.category || (p.categories && p.categories.length > 0);
//   //     const hasCity      = p.city || p.location;
//   //     const hasLink      = p.instagramUrl || p.youtubeUrl || p.tiktokUrl || p.twitterUrl
//   //                       || p.platformLink
//   //                       || (p.socialLinks && Object.values(p.socialLinks).some(Boolean));
//   //     return !(hasFollowers && hasCategory && hasCity && hasLink);
//   //   }
//   //   if (isBrand) {
//   //     const p = profile || {};
//   //     const hasCompany  = p.companyName || user?.companyName;
//   //     const hasCategory = p.category || p.industry;
//   //     const hasCity     = p.city || p.location;
//   //     const hasWebsite  = p.website || p.websiteUrl;
//   //     return !(hasCompany && hasCategory && hasCity && hasWebsite);
//   //   }
//   //   return false;
//   // })();
//   const isProfileIncomplete = (() => {
//   if (!user || isAdmin || !profileLoaded) return false;
//   if (isInfluencer) {
//     const p = profile || {};
//     const hasFollowers = p.followers || p.followersCount;
//     const hasCategory  = p.categories && p.categories.length > 0;
//     const hasCity      = p.location || p.city;
//     const hasLink      = p.platform || p.platformLink;
//     return !(hasFollowers && hasCategory && hasCity && hasLink);
//   }
//   if (isBrand) {
//     const p = profile || {};
//     const hasCompany  = p.companyName;
//     const hasCategory = p.categories && p.categories.length > 0;
//     const hasCity     = p.location || p.city;
//     const hasWebsite  = p.website || p.websiteUrl;
//     return !(hasCompany && hasCategory && hasCity && hasWebsite);
//   }
//   return false;
// })();

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; position: relative; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-incomplete-dot { width: 9px; height: 9px; background: #f59e0b; border-radius: 50%; border: 1.5px solid #fff; position: absolute; top: 0; right: 0; }
//         .nav-incomplete-badge { display: inline-flex; align-items: center; gap: 4px; background: #fff8e1; border: 1px solid #f59e0b; color: #b45309; border-radius: 100px; font-size: 9px; font-weight: 700; padding: 2px 7px; margin-top: 4px; }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-item.incomplete-dd { background: #fff8e1; color: #b45309; font-weight: 700; border: 1px solid #fde68a; }
//         .nav-dd-item.incomplete-dd:hover { background: #fef3c7; }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box { margin-top: 10px; background: #f8f7ff; border: 1.5px solid #e8e5ff; border-radius: 10px; padding: 10px 12px; display: flex; gap: 0; }
//         .nav-plan-stat { flex: 1; text-align: center; }
//         .nav-plan-stat + .nav-plan-stat { border-left: 1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
//         .nav-plan-stat-val { font-size: 15px; font-weight: 800; line-height: 1; }
//         .nav-plan-stat-sub { font-size: 9px; color: #aaa; font-weight: 500; margin-top: 1px; }
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//         .nav-mobile-incomplete { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #fde68a; font-size: 14px; font-weight: 700; color: #b45309; text-decoration: none; background: #fff8e1; border-radius: 8px; padding-left: 10px; margin-bottom: 4px; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages"        className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification"    className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                       {/* ✅ Amber dot on avatar if profile incomplete */}
//                       {/* {isProfileIncomplete && <span className="nav-incomplete-dot" />} */}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* ✅ Incomplete profile badge in dropdown */}
//                         {/* {isProfileIncomplete && (
//                           <div style={{ marginTop: 6 }}>
//                             <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
//                           </div>
//                         )} */}

//                         {isProfileIncomplete ? (
//   <div style={{ marginTop: 6 }}>
//     <span className="nav-incomplete-badge">⚠️ Incomplete Profile</span>
//   </div>
// ) : (
//   <div style={{ marginTop: 6 }}>
//     <span style={{
//       display: "inline-flex", alignItems: "center", gap: 4,
//       background: "#f0fdf4", border: "1px solid #86efac",
//       color: "#16a34a", borderRadius: "100px",
//       fontSize: 9, fontWeight: 700, padding: "2px 7px"
//     }}>✅ Profile Complete</span>
//   </div>
// )}

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

//                       {/* ✅ Complete Profile CTA in dropdown */}
//                       {isProfileIncomplete && (
//                         <Link href="/my-profile" className="nav-dd-item incomplete-dd" onClick={() => setDropdownOpen(false)}>
//                           ⚠️ Complete Your Profile
//                         </Link>
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
//             {/* ✅ Incomplete profile banner in mobile menu */}
//             {isProfileIncomplete && (
//               <Link href="/my-profile" className="nav-mobile-incomplete" onClick={() => setMobileMenuOpen(false)}>
//                 ⚠️ Complete Your Profile
//               </Link>
//             )}
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// // ✅ CORRECT plan names — exactly as backend sends them
// const BRAND_PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:                    { label: "Free",  campaigns: 2,   tokens: 200   },
//   brand_pro_monthly:       { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   brand_pro_plus_monthly:  { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   brand_pro_yearly:        { label: "Pro",   campaigns: 120, tokens: 12000 },
//   brand_pro_plus_yearly:   { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:                        { label: "Free",  applies: 10,          tokens: 100          },
//   influencer_pro_monthly:      { label: "Pro",   applies: 100,         tokens: 1000         },
//   influencer_pro_plus_monthly: { label: "Pro+",  applies: 200,         tokens: 2000         },
//   influencer_pro_yearly:       { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   influencer_pro_plus_yearly:  { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// // ✅ Get plan label — works for any plan string
// const getPlanLabel = (plan: string): string => {
//   if (!plan || plan === "free") return "Free";
//   const p = plan.toLowerCase().trim();
//   if (p.includes("pro_plus") || p.includes("pro+")) return "Pro+";
//   if (p.includes("pro")) return "Pro";
//   return "Free";
// };

// const getBrandPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   return BRAND_PLAN_LIMITS[p] ?? BRAND_PLAN_LIMITS["free"];
// };

// const getCreatorPlanLimits = (plan: string) => {
//   const p = (plan || "").toLowerCase().trim();
//   return CREATOR_PLAN_LIMITS[p] ?? CREATOR_PLAN_LIMITS["free"];
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]                 = useState<any>(null);
//   const [profile, setProfile]           = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount]   = useState(0);
//   const [msgUnread, setMsgUnread]       = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

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

//     // Profile fetch
//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(r => r.json())
//       .then(data => {
//         if (data?.success && data.profile) setProfile(data.profile);
//       }).catch(() => {});

//     // Campaign count for brand
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

//     // Application count for influencer
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
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//   }, [pathname]);

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { }
//   };

//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//       // ✅ Plan upgrade hone pe user state live update
//       if (e.key === "cb_user" && e.newValue) {
//         try {
//           const updated = JSON.parse(e.newValue);
//           setUser(updated);
//           if (updated.bits != null) setBits(Number(updated.bits));
//         } catch { }
//       }
//     };

//     const handleMsgCount = (e: any) => setMsgUnread(e.detail?.count ?? 0);

//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") setMsgUnread(e.data.count ?? 0);
//       };
//     } catch { }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       let parsedUser: any;
//       try { parsedUser = JSON.parse(stored); } catch { return; }
//       const token = parsedUser.token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   // ✅ Live plan — plan ya activePlan jo bhi available hai
//   const getLivePlan = () => (user?.plan || user?.activePlan || "free");

//   const getBrandPlanStats = () => {
//     const u        = user || {};
//     const subbed   = u.isSubscribed ?? false;
//     const planStr  = subbed ? getLivePlan() : "free";
//     const plan     = getBrandPlanLimits(planStr);
//     const liveBits = bits ?? u.bits ?? plan.tokens;
//     return { plan, campsLeft: Math.max(0, plan.campaigns - campsUsed), tokensLeft: Math.max(0, Number(liveBits)) };
//   };

//   const getCreatorPlanStats = () => {
//     const u       = user || {};
//     const subbed  = u.isSubscribed ?? false;
//     const planStr = subbed ? getLivePlan() : "free";
//     const plan    = getCreatorPlanLimits(planStr);
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//     const liveBits   = Number(bits ?? u.bits ?? planTokens);
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
//     ["cb_user","token","appliedCampaigns","connectedCreators","readNotifIds","notif_all_read"]
//       .forEach(k => localStorage.removeItem(k));
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   // ✅ Live plan label
//   const currentPlanLabel = getPlanLabel(getLivePlan());

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box { margin-top: 10px; background: #f8f7ff; border: 1.5px solid #e8e5ff; border-radius: 10px; padding: 10px 12px; display: flex; gap: 0; }
//         .nav-plan-stat { flex: 1; text-align: center; }
//         .nav-plan-stat + .nav-plan-stat { border-left: 1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
//         .nav-plan-stat-val { font-size: 15px; font-weight: 800; line-height: 1; }
//         .nav-plan-stat-sub { font-size: 9px; color: #aaa; font-weight: 500; margin-top: 1px; }
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages"        className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification"    className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// // const toCanonical = (s: string): string => {
// //   if (!s) return "free";
// //   const v = s.toLowerCase().trim();
// //   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
// //   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
// //   if (v === "proyear" || v === "pro_year") return "pro_year";
// //   if (v === "pro") return "pro";
// //   return "free";
// // };

// // const toCanonical = (s: string): string => {
// //   if (!s) return "free";
// //   const v = s.toLowerCase().trim();

// //   // ✅ backend → frontend mapping fix
// //   if (v === "pro_monthly") return "pro_monthly";
// //   if (v === "pro_plus_monthly") return "pro_plus_monthly";
// //   if (v === "pro_yearly") return "pro_yearly";
// //   if (v === "pro_plus_yearly") return "pro_plus_yearly";

// //   // fallback cases
// //   if (v === "pro") return "pro_monthly";
// //   if (v === "pro_plus") return "pro_plus_monthly";

// //   return "free";
// // };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();

//   // brand plans
//   if (v === "pro_monthly") return "pro_monthly";
//   if (v === "pro_plus_monthly") return "pro_plus_monthly";
//   if (v === "pro_yearly") return "pro_yearly";
//   if (v === "pro_plus_yearly") return "pro_plus_yearly";

//   // creator mapping fix 👇
//   if (v === "pro") return "pro";
//   if (v === "pro_plus") return "pro_plus";
//   if (v === "pro_year") return "pro_year";
//   if (v === "pro_plus_year") return "pro_plus_year";

//   return "free";
// };

// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000;

// const cachedFetch = async (url: string, token: string) => {
//   try {
//     const res = await fetch(url, {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     return await res.json();
//   } catch {
//     return null;
//   }
// };

// // const cachedFetch = async (url: string, token: string) => {
// //   const now = Date.now();
// //   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
// //   try {
// //     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
// //     const data = await res.json();
// //     cache[url] = { data, ts: now };
// //     return data;
// //   } catch { return null; }
// // };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const planKey = toCanonical(user?.plan);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [msgUnread, setMsgUnread]     = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

//   useEffect(() => {
//     // if (typeof window === "undefined") return;
//     // const storedUser = localStorage.getItem("cb_user");
//     // if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     // const parsedUser = JSON.parse(storedUser);
//     // const token = parsedUser.token || localStorage.getItem("token");
//     // if (!token) { setUser(null); setProfile(null); return; }

//     // setUser(parsedUser);

//      if (typeof window === "undefined") return;
//   const storedUser = localStorage.getItem("cb_user");
//   if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//   const parsedUser = JSON.parse(storedUser);

//   // ✅ Fix for missing activePlan
//   if (parsedUser.isSubscribed && !parsedUser.activePlan) {
//     parsedUser.activePlan = "pro_monthly";
//     localStorage.setItem("cb_user", JSON.stringify(parsedUser));
//   }

//   const token = parsedUser.token || localStorage.getItem("token");
//   if (!token) { setUser(null); setProfile(null); return; }

//   setUser(parsedUser);



//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);

//     fetchBits(token);
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//         }
//       }
//     } catch { /* silent */ }
//   };

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res    = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data   = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { /* silent */ }
//   };

//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res   = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data  = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
//     } catch { /* silent */ }
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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     // Storage events (cross-tab)
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//     };

//     // ✅ CustomEvent — same tab
//     const handleMsgCount = (e: any) => setMsgUnread(e.detail?.count ?? 0);

//     // ✅ BroadcastChannel — cross-tab
//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") setMsgUnread(e.data.count ?? 0);
//       };
//     } catch { /* BroadcastChannel not supported */ }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (token && !pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     // const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     const tokensLeft = subbed ? Math.max(0, liveBits) : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   // const getCreatorPlanStats = () => {
//   //   const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   //   const subbed  = stored.isSubscribed ?? false;
//   //   const ap      = stored.activePlan ?? null;
//   //   const canon   = subbed && ap ? toCanonical(ap) : "free";
//   //   const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//   //   const isUnlim = plan.applies === "unlimited";
//   //   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   //   const planTokens   = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//   //   const storedBits   = bits ?? stored.bits ?? planTokens;
//   //   const bitsLeft     = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//   //   const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//   //   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   //   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   //   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   // };

//   const getCreatorPlanStats = () => {
//   const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   const subbed  = stored.isSubscribed ?? false;
//   const ap      = stored.activePlan ?? null;

//   const canon   = subbed && ap ? toCanonical(ap) : "free";
//   const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];

//   const isUnlim = plan.applies === "unlimited";

//   const appliesLeft: number | "∞" = isUnlim
//     ? "∞"
//     : Math.max(0, (plan.applies as number) - appliesUsed);

//   const planTokens   = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   const storedBits   = Number(bits ?? stored.bits ?? planTokens);

//   let tokensLeft: number | "∞";

//   if (plan.tokens === "unlimited") {
//     tokensLeft = "∞";
//   } else {
//     tokensLeft = Math.max(0, Math.min(storedBits, planTokens));
//   }

//   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;

//   return {
//     plan,
//     appliesLeft,
//     appliesTotal,
//     tokensLeft,
//     tokensTotal,
//     isUnlim
//   };
// };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               {/* <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div> */}
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               {/* <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div> */}
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";


// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:                        { label: "Free",  campaigns: 2,   tokens: 200   },
//   // Brand plans (backend names)
//   brand_pro_monthly:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   brand_pro_plus_monthly:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   brand_pro_yearly:            { label: "Pro",   campaigns: 120, tokens: 12000 },
//   brand_pro_plus_yearly:       { label: "Pro+",  campaigns: 250, tokens: 25000 },
//   // // Old names (backward compat)
//   // pro_monthly:                 { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   // pro_plus_monthly:            { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   // pro_yearly:                  { label: "Pro",   campaigns: 120, tokens: 12000 },
//   // pro_plus_yearly:             { label: "Pro+",  campaigns: 250, tokens: 25000 },
//   // pro:                         { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   // pro_plus:                    { label: "Pro+",  campaigns: 25,  tokens: 2500  },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:                             { label: "Free",  applies: 10,          tokens: 100          },
//   // Influencer plans (backend names)
//   influencer_pro_monthly:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   influencer_pro_plus_monthly:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   influencer_pro_yearly:            { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   influencer_pro_plus_yearly:       { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
//   // // Old names (backward compat)
//   // pro_monthly:                      { label: "Pro",   applies: 100,         tokens: 1000         },
//   // pro_plus_monthly:                 { label: "Pro+",  applies: 200,         tokens: 2000         },
//   // pro_yearly:                       { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   // pro_plus_yearly:                  { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
//   // pro:                              { label: "Pro",   applies: 100,         tokens: 1000         },
//   // pro_plus:                         { label: "Pro+",  applies: 200,         tokens: 2000         },
// };

// // const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
// //   free:              { label: "Free",  campaigns: 2,   tokens: 200   },
// //   pro_monthly:       { label: "Pro",   campaigns: 10,  tokens: 1000  },
// //   pro_plus_monthly:  { label: "Pro+",  campaigns: 25,  tokens: 2500  },
// //   pro_yearly:        { label: "Pro",   campaigns: 120, tokens: 12000 },
// //   pro_plus_yearly:   { label: "Pro+",  campaigns: 250, tokens: 25000 },
// //   // frontend IDs (upgrade page saves these)
// //   pro:               { label: "Pro",   campaigns: 10,  tokens: 1000  },
// //   pro_plus:          { label: "Pro+",  campaigns: 25,  tokens: 2500  },
// //   pro_year:          { label: "Pro",   campaigns: 120, tokens: 12000 },
// //   pro_plus_year:     { label: "Pro+",  campaigns: 250, tokens: 25000 },
// // };

// // const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
// //   free:              { label: "Free",  applies: 10,          tokens: 100          },
// //   pro:               { label: "Pro",   applies: 100,         tokens: 1000         },
// //   pro_plus:          { label: "Pro+",  applies: 200,         tokens: 2000         },
// //   pro_year:          { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
// //   pro_plus_year:     { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// //   // DB names
// //   pro_monthly:       { label: "Pro",   applies: 100,         tokens: 1000         },
// //   pro_plus_monthly:  { label: "Pro+",  applies: 200,         tokens: 2000         },
// //   pro_yearly:        { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
// //   pro_plus_yearly:   { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// // };

// // ✅ Normalize any plan string — handles both DB names and frontend IDs
// // ✅ NAYA - ye lagao
// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   const map: Record<string, string> = {
//     "pro_monthly":      "pro_monthly",
//     "pro_plus_monthly": "pro_plus_monthly",
//     "pro_yearly":       "pro_yearly",
//     "pro_plus_yearly":  "pro_plus_yearly",
//     "pro":              "pro_monthly",       // ← FIX
//     "pro_plus":         "pro_plus_monthly",  // ← FIX
//     "pro_year":         "pro_yearly",        // ← FIX
//     "pro_plus_year":    "pro_plus_yearly",   // ← FIX
//   };
//   return map[v] ?? "free";
// };



// // const toCanonical = (s: string): string => {
// //   if (!s) return "free";
// //   const v = s.toLowerCase().trim();
// //   const map: Record<string, string> = {
// //     "pro_monthly":      "pro_monthly",
// //     "pro_plus_monthly": "pro_plus_monthly",
// //     "pro_yearly":       "pro_yearly",
// //     "pro_plus_yearly":  "pro_plus_yearly",
// //     "pro":              "pro",
// //     "pro_plus":         "pro_plus",
// //     "pro_year":         "pro_year",
// //     "pro_plus_year":    "pro_plus_year",
// //   };
// //   return map[v] ?? "free";
// // };

// // ✅ Get active plan key from localStorage — handles all field names
// // const getActivePlanKey = (): string => {
// //   try {
// //     const stored = JSON.parse(localStorage.getItem("cb_user") || "{}");
// //     // Check isSubscribed from multiple possible fields
// //     const isSubscribed = stored.isSubscribed === true || stored.subscriptionStatus === "active" || stored.isPremium === true;
// //     if (!isSubscribed) return "free";
// //     // Check plan from multiple possible fields
// //     const raw = stored.plan || stored.activePlan || stored.planId || stored.planName || null;
// //     if (!raw) return "free";
// //     return toCanonical(raw);
// //   } catch {
// //     return "free";
// //   }
// // };

// const getActivePlanKey = (): string => {
//   try {
//     const stored = JSON.parse(localStorage.getItem("cb_user") || "{}");

//     const isSubscribed =
//       stored.isSubscribed === true ||
//       stored.subscriptionStatus === "active";

//     if (!isSubscribed) return "free";

//     // planActivatedAt ki zaroorat nahi
//     const raw =
//       stored.activePlan ||
//       stored.plan ||
//       stored.planId ||
//       stored.planName ||
//       null;

//     if (!raw) return "free";
//     return toCanonical(raw);
//   } catch {
//     return "free";
//   }
// };

// const cachedFetch = async (url: string, token: string) => {
//   try {
//     const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     return await res.json();
//   } catch {
//     return null;
//   }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]                 = useState<any>(null);
//   const [profile, setProfile]           = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount]   = useState(0);
//   const [msgUnread, setMsgUnread]       = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);
//   const [backendPlan, setBackendPlan] = useState<string | null>(null);
// const [backendSubscribed, setBackendSubscribed] = useState(false);
//   const [campsUsed, setCampsUsed]   = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]             = useState<number | null>(null);



//   useEffect(() => {
//   if (typeof window === "undefined") return;
  
//   // ✅ AUTO FIX - mobile/desktop dono pe kaam karega
//   const stored = localStorage.getItem("cb_user");
//   if (!stored) return;
//   const parsed = JSON.parse(stored);
  
//   if (parsed.isSubscribed === true) {
//     const planDbMap: Record<string, string> = {
//       "pro":           "pro_monthly",
//       "pro_plus":      "pro_plus_monthly", 
//       "pro_year":      "pro_yearly",
//       "pro_plus_year": "pro_plus_yearly",
//     };
    
//     const rawPlan = parsed.activePlan || parsed.plan || "";
//     const fixedPlan = planDbMap[rawPlan] || rawPlan;
    
//     // Sirf tab update karo jab galat value ho
//     if (fixedPlan !== rawPlan || !parsed.planActivatedAt) {
//       const updated = {
//         ...parsed,
//         activePlan: fixedPlan,
//         plan: fixedPlan,
//         planActivatedAt: parsed.planActivatedAt || new Date().toISOString(),
//       };
//       localStorage.setItem("cb_user", JSON.stringify(updated));
//     }
//   }
// }, []); // ← sirf ek baar on mount

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     const parsedUser = JSON.parse(storedUser);

//     // ✅ If subscribed but activePlan missing, set from plan field
//     if (parsedUser.isSubscribed && !parsedUser.activePlan && parsedUser.plan) {
//       parsedUser.activePlan = parsedUser.plan;
//       localStorage.setItem("cb_user", JSON.stringify(parsedUser));
//     }

//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     // cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//     //   if (data?.success && data.profile) setProfile(data.profile);
//     // });

//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//   if (data?.success && data.profile) setProfile(data.profile);
    
//    const bu = data?.user || data?.profile || {};
//   const fetchedPlan = bu.plan || bu.activePlan || bu.planId || null;
//   const fetchedSubscribed = bu.isSubscribed === true || bu.subscriptionStatus === "active";
//   const fetchedBits = bu.bits ?? data?.profile?.bits ?? null;

//   if (fetchedSubscribed && fetchedPlan) {
//     setBackendPlan(fetchedPlan);
//     setBackendSubscribed(true);
//   } else {
//     setBackendPlan("free");
//     setBackendSubscribed(false);
//   }

//   if (fetchedBits !== null) setBits(Number(fetchedBits));});

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);

//     fetchBits(token);
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//         }
//       }
//     } catch { /* silent */ }
//   };

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res    = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data   = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { /* silent */ }
//   };

//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
//     } catch { /* silent */ }
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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//     };
//     const handleMsgCount = (e: any) => setMsgUnread(e.detail?.count ?? 0);
//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") setMsgUnread(e.data.count ?? 0);
//       };
//     } catch { /* not supported */ }
//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (token && !pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   // ✅ FIXED: reads plan from all possible localStorage fields
//   // const getBrandPlanStats = () => {
//   //   const stored     = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   //   const planKey    = getActivePlanKey(); // ✅ handles plan/activePlan/isSubscribed correctly
//   //   const plan       = PLAN_LIMITS[planKey] ?? PLAN_LIMITS["free"];
//   //   const liveBits   = bits ?? stored.bits ?? plan.tokens;
//   //   const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//   //   const tokensLeft = Math.max(0, liveBits);
//   //   return { plan, campsLeft, tokensLeft };
//   // };

//   const getBrandPlanStats = () => {
//   // ✅ Backend plan use karo, localStorage nahi
//   const planKey = backendSubscribed && backendPlan
//     ? backendPlan
//     : "free";
//   const plan = PLAN_LIMITS[planKey] ?? PLAN_LIMITS["free"];
//   const liveBits = bits ?? plan.tokens;
//   const tokensLeft = Math.max(0, liveBits);
//   return { plan, tokensLeft };
// };

//   // ✅ FIXED: same for creator
//   // const getCreatorPlanStats = () => {
//   //   const stored    = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   //   const planKey   = getActivePlanKey();
//   //   const plan      = CREATOR_PLAN_LIMITS[planKey] ?? CREATOR_PLAN_LIMITS["free"];
//   //   const isUnlim   = plan.applies === "unlimited";
//   //   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   //   const planTokens  = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   //   const storedBits  = Number(bits ?? stored.bits ?? planTokens);
//   //   let tokensLeft: number | "∞";
//   //   if (plan.tokens === "unlimited") {
//   //     tokensLeft = "∞";
//   //   } else {
//   //     tokensLeft = Math.max(0, Math.min(storedBits, planTokens));
//   //   }
//   //   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   //   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   //   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   // };
    

//   const getCreatorPlanStats = () => {
//   // ✅ Backend plan use karo, localStorage nahi
//   const planKey = backendSubscribed && backendPlan
//     ? backendPlan
//     : "free";
//   const plan = CREATOR_PLAN_LIMITS[planKey] ?? CREATOR_PLAN_LIMITS["free"];
//   const isUnlim = plan.applies === "unlimited";
//   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   const planTokens = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   const storedBits = Number(bits ?? planTokens);
//   const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, Math.min(storedBits, planTokens));
//   const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
// };
//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
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
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro_monthly:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus_monthly:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_yearly:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_yearly: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// // const toCanonical = (s: string): string => {
// //   if (!s) return "free";
// //   const v = s.toLowerCase().trim();
// //   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
// //   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
// //   if (v === "proyear" || v === "pro_year") return "pro_year";
// //   if (v === "pro") return "pro";
// //   return "free";
// // };

// // const toCanonical = (s: string): string => {
// //   if (!s) return "free";
// //   const v = s.toLowerCase().trim();

// //   // ✅ backend → frontend mapping fix
// //   if (v === "pro_monthly") return "pro_monthly";
// //   if (v === "pro_plus_monthly") return "pro_plus_monthly";
// //   if (v === "pro_yearly") return "pro_yearly";
// //   if (v === "pro_plus_yearly") return "pro_plus_yearly";

// //   // fallback cases
// //   if (v === "pro") return "pro_monthly";
// //   if (v === "pro_plus") return "pro_plus_monthly";

// //   return "free";
// // };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();

//   // brand plans
//   if (v === "pro_monthly") return "pro_monthly";
//   if (v === "pro_plus_monthly") return "pro_plus_monthly";
//   if (v === "pro_yearly") return "pro_yearly";
//   if (v === "pro_plus_yearly") return "pro_plus_yearly";

//   // creator mapping fix 👇
//   if (v === "pro") return "pro";
//   if (v === "pro_plus") return "pro_plus";
//   if (v === "pro_year") return "pro_year";
//   if (v === "pro_plus_year") return "pro_plus_year";

//   return "free";
// };

// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000;

// const cachedFetch = async (url: string, token: string) => {
//   try {
//     const res = await fetch(url, {
//       headers: { Authorization: `Bearer ${token}` }
//     });
//     return await res.json();
//   } catch {
//     return null;
//   }
// };

// // const cachedFetch = async (url: string, token: string) => {
// //   const now = Date.now();
// //   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
// //   try {
// //     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
// //     const data = await res.json();
// //     cache[url] = { data, ts: now };
// //     return data;
// //   } catch { return null; }
// // };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const planKey = toCanonical(user?.plan);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [msgUnread, setMsgUnread]     = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

//   useEffect(() => {
//     // if (typeof window === "undefined") return;
//     // const storedUser = localStorage.getItem("cb_user");
//     // if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     // const parsedUser = JSON.parse(storedUser);
//     // const token = parsedUser.token || localStorage.getItem("token");
//     // if (!token) { setUser(null); setProfile(null); return; }

//     // setUser(parsedUser);

//      if (typeof window === "undefined") return;
//   const storedUser = localStorage.getItem("cb_user");
//   if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//   const parsedUser = JSON.parse(storedUser);

//   // ✅ Fix for missing activePlan
//   if (parsedUser.isSubscribed && !parsedUser.activePlan) {
//     parsedUser.activePlan = "pro_monthly";
//     localStorage.setItem("cb_user", JSON.stringify(parsedUser));
//   }

//   const token = parsedUser.token || localStorage.getItem("token");
//   if (!token) { setUser(null); setProfile(null); return; }

//   setUser(parsedUser);



//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);

//     fetchBits(token);
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//         }
//       }
//     } catch { /* silent */ }
//   };

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res    = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data   = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       setUnreadCount(notifs.filter((n: any) => n.type !== "new_message" && !n.read).length);
//     } catch { /* silent */ }
//   };

//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res   = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data  = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
//     } catch { /* silent */ }
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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     // Storage events (cross-tab)
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//     };

//     // ✅ CustomEvent — same tab
//     const handleMsgCount = (e: any) => setMsgUnread(e.detail?.count ?? 0);

//     // ✅ BroadcastChannel — cross-tab
//     let bc: BroadcastChannel | null = null;
//     try {
//       bc = new BroadcastChannel("msg_unread");
//       bc.onmessage = (e) => {
//         if (e.data?.type === "msg_unread_update") setMsgUnread(e.data.count ?? 0);
//       };
//     } catch { /* BroadcastChannel not supported */ }

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount);
//       bc?.close();
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (token && !pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     // const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     const tokensLeft = subbed ? Math.max(0, liveBits) : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   // const getCreatorPlanStats = () => {
//   //   const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   //   const subbed  = stored.isSubscribed ?? false;
//   //   const ap      = stored.activePlan ?? null;
//   //   const canon   = subbed && ap ? toCanonical(ap) : "free";
//   //   const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//   //   const isUnlim = plan.applies === "unlimited";
//   //   const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//   //   const planTokens   = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//   //   const storedBits   = bits ?? stored.bits ?? planTokens;
//   //   const bitsLeft     = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//   //   const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//   //   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   //   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//   //   return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   // };

//   const getCreatorPlanStats = () => {
//   const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//   const subbed  = stored.isSubscribed ?? false;
//   const ap      = stored.activePlan ?? null;

//   const canon   = subbed && ap ? toCanonical(ap) : "free";
//   const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];

//   const isUnlim = plan.applies === "unlimited";

//   const appliesLeft: number | "∞" = isUnlim
//     ? "∞"
//     : Math.max(0, (plan.applies as number) - appliesUsed);

//   const planTokens   = plan.tokens === "unlimited" ? Infinity : Number(plan.tokens);
//   const storedBits   = Number(bits ?? stored.bits ?? planTokens);

//   let tokensLeft: number | "∞";

//   if (plan.tokens === "unlimited") {
//     tokensLeft = "∞";
//   } else {
//     tokensLeft = Math.max(0, Math.min(storedBits, planTokens));
//   }

//   const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//   const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;

//   return {
//     plan,
//     appliesLeft,
//     appliesTotal,
//     tokensLeft,
//     tokensTotal,
//     isUnlim
//   };
// };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               {/* <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div> */}
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               {/* <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div> */}
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000;

// const cachedFetch = async (url: string, token: string) => {
//   const now = Date.now();
//   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
//   try {
//     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     cache[url] = { data, ts: now };
//     return data;
//   } catch { return null; }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [msgUnread, setMsgUnread]     = useState(0); // ✅ messages badge
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     if (!pathname?.startsWith("/messages"))     fetchMsgUnread(token);

//     fetchBits(token);
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//         }
//       }
//     } catch { /* silent */ }
//   };

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res    = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data   = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       const unread = notifs.filter((n: any) => n.type !== "new_message" && !n.read);
//       setUnreadCount(unread.length);
//     } catch { /* silent */ }
//   };

//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res   = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data  = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
//     } catch { /* silent */ }
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
//           fetch(`${API_BASE}/notification/read/${n._id}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
//         });
//       }).catch(() => {});
//   }, [pathname]);

//   // ✅ Messages page pe jaate hi 0
//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;

//     // Storage events (cross-tab)
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//     };

//     // ✅ CustomEvent — same tab se messages page dispatch karta hai
//     const handleMsgCount = (e: any) => {
//       setMsgUnread(e.detail?.count ?? 0);
//     };

//     window.addEventListener("storage", handleStorage);
//     window.addEventListener("msg_unread_update", handleMsgCount); // ✅

//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);

//     return () => {
//       window.removeEventListener("storage", handleStorage);
//       window.removeEventListener("msg_unread_update", handleMsgCount); // ✅
//     };
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (token && !pathname?.startsWith("/messages"))     fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens   = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const storedBits   = bits ?? stored.bits ?? planTokens;
//     const bitsLeft     = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal  = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan, planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false, bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 {/* ✅ Messages with green badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 {/* ✅ Messages with green badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 {/* ✅ Messages with green badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000;

// const cachedFetch = async (url: string, token: string) => {
//   const now = Date.now();
//   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
//   try {
//     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     cache[url] = { data, ts: now };
//     return data;
//   } catch { return null; }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const [msgUnread, setMsgUnread]     = useState(0); // ✅ messages unread count
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);

//     // ✅ Messages unread count fetch
//     if (!pathname?.startsWith("/messages")) fetchMsgUnread(token);

//     fetchBits(token);
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) {
//             localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//           }
//         }
//       }
//     } catch { /* silent */ }
//   };

//   // ✅ FIXED: sirf server ka read field
//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       const unread = notifs.filter((n: any) => n.type !== "new_message" && !n.read);
//       setUnreadCount(unread.length);
//     } catch { /* silent */ }
//   };

//   // ✅ Messages unread count — conversations se
//   const fetchMsgUnread = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const convs: any[] = data?.data || data?.conversations || data || [];
//       const total = convs.reduce((sum: number, c: any) => sum + (c.unreadCount || c.unread || 0), 0);
//       setMsgUnread(total);
//     } catch { /* silent */ }
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

//   // ✅ Messages page pe jaate hi msg count 0
//   useEffect(() => {
//     if (pathname?.startsWith("/messages")) setMsgUnread(0);
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//       // ✅ Messages page se dispatch aane pe update karo
//       if (e.key === "msg_unread_count" && e.newValue !== null) setMsgUnread(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       if (token && !pathname?.startsWith("/messages")) fetchMsgUnread(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const storedBits = bits ?? stored.bits ?? planTokens;
//     const bitsLeft = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//             bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-msg-badge { background: #25d366; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 {/* ✅ Messages badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 {/* ✅ Messages badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
//                   Messages{msgUnread > 0 && <span className="nav-msg-badge">{msgUnread > 99 ? "99+" : msgUnread}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 {/* ✅ Messages badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnread(0)}>
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
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000;

// const cachedFetch = async (url: string, token: string) => {
//   const now = Date.now();
//   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
//   try {
//     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     cache[url] = { data, ts: now };
//     return data;
//   } catch { return null; }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   // ✅ Message unread count — alag state
//   const [msgUnreadCount, setMsgUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]     = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]               = useState<number | null>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); setMsgUnreadCount(0); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);

//     fetchBits(token);

//     // ✅ Message unread count — conversations se fetch karo
//     if (!pathname?.startsWith("/messages")) {
//       fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const convs = data?.data || data?.conversations || [];
//           const total = convs.reduce((acc: number, c: any) => acc + (Number(c.unreadCount) || Number(c.unread) || 0), 0);
//           if (total > 0) setMsgUnreadCount(total);
//         }).catch(() => {});
//     }
//   }, [pathname]);

//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) {
//             localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//           }
//         }
//       }
//     } catch { }
//   };

//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       // ✅ new_message type ki notifications ignore karo
//       const unread = notifs.filter((n: any) =>
//         !n.read &&
//         !localRead.includes(n._id) &&
//         !cbNotifStatus[n._id] &&
//         n.type !== "new_message"
//       );
//       setUnreadCount(unread.length);
//     } catch { }
//   };

//   useEffect(() => {
//     // ✅ Messages page pe jaao to msg count zero karo
//     if (pathname?.startsWith("/messages")) setMsgUnreadCount(0);
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
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//       // ✅ Messages page se message aane par count badhao
//       if (e.key === "msg_unread_count" && e.newValue !== null) setMsgUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (!token) return;
//       if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);
//       // ✅ Tab focus pe message count refresh
//       if (!pathname?.startsWith("/messages")) {
//         fetch(`${API_BASE}/conversations/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const convs = data?.data || data?.conversations || [];
//             const total = convs.reduce((acc: number, c: any) => acc + (Number(c.unreadCount) || Number(c.unread) || 0), 0);
//             setMsgUnreadCount(total);
//           }).catch(() => {});
//       }
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

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

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const storedBits = bits ?? stored.bits ?? planTokens;
//     const bitsLeft = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//             bits: u.bits ?? null,
//           }));
//         }
//       } catch { }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"       className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 {/* ✅ Messages with unread badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnreadCount(0)}>
//                   Messages{msgUnreadCount > 0 && <span className="nav-notif-badge">{msgUnreadCount > 99 ? "99+" : msgUnreadCount}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"    className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 {/* ✅ Messages with unread badge */}
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnreadCount(0)}>
//                   Messages{msgUnreadCount > 0 && <span className="nav-notif-badge">{msgUnreadCount > 99 ? "99+" : msgUnreadCount}</span>}
//                 </Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"     className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"     className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnreadCount(0)}>
//                   Messages{msgUnreadCount > 0 && <span className="nav-notif-badge">{msgUnreadCount > 99 ? "99+" : msgUnreadCount}</span>}
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
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"       className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"          className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications" className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             {/* ✅ Mobile messages with badge */}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`} onClick={() => setMsgUnreadCount(0)}>
//               Messages{msgUnreadCount > 0 && <span className="nav-notif-badge">{msgUnreadCount > 99 ? "99+" : msgUnreadCount}</span>}
//             </Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>
//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"    className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
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
//             <button className="nav-mobile-link" style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }} onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// // ── Simple in-memory cache — page reload tak valid ───────────────
// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000; // 1 minute

// const cachedFetch = async (url: string, token: string) => {
//   const now = Date.now();
//   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
//   try {
//     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     cache[url] = { data, ts: now };
//     return data;
//   } catch { return null; }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]   = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);
//   const [bits, setBits]             = useState<number | null>(null); // live token count

//   // ── Init: re-run on pathname change to catch login/logout ─────
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { setUser(null); setProfile(null); setUnreadCount(0); return; }
//     const parsedUser = JSON.parse(storedUser);
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     // Profile — cached (won't re-fetch if already fetched in last 1 min)
//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     // Brand: campaigns used — cached
//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     // Creator: applies used — cached
//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     // Unread count — cached, won't spam server
//     if (!pathname?.startsWith("/notification")) fetchUnreadCount(token);

//     // Fetch live bits/tokens from backend
//     fetchBits(token);
//   }, [pathname]); // ← re-run on route change to catch login state

//   // ── Fetch live bits from backend ─────────────────────────────
//   const fetchBits = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       // bits can be in profile or user object
//       const b = data?.profile?.bits ?? data?.user?.bits ?? data?.bits ?? null;
//       if (b !== null) {
//         setBits(Number(b));
//         // Also sync to localStorage so plan stats are correct
//         const stored = localStorage.getItem("cb_user");
//         if (stored) {
//           const parsed = JSON.parse(stored);
//           if (parsed.bits !== Number(b)) {
//             localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: Number(b) }));
//           }
//         }
//       }
//     } catch { /* silent */ }
//   };

//   // ── Unread count: sirf mount pe aur tab-switch pe ────────────
//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       const cbStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const unread = notifs.filter(
//         (n: any) => !n.read && !localRead.includes(n._id) && !cbStatus[n._id]
//       );
//       setUnreadCount(unread.length);
//     } catch { /* silent */ }
//   };

//   // ── Notification page pe: mark all read, no polling ──────────
//   useEffect(() => {
//     if (!pathname?.startsWith("/notification")) return;
//     setUnreadCount(0);
//     // Mark all read on server — fire and forget
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
//   }, [pathname]); // only when pathname changes to /notification

//   // ── Storage events: unread badge + bits update ───────────────
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//       // ✅ Bits update — unlock ya campaign create ke baad
//       if (e.key === "cb_user_bits" && e.newValue !== null) setBits(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   // ── Visibility change: refresh unread count on tab focus ─────
//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

//   // ── Click outside dropdown ────────────────────────────────────
//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // ── Close mobile menu on route change ────────────────────────
//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     // Use live bits from state, fallback to localStorage
//     const liveBits   = bits ?? stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, liveBits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const storedBits = bits ?? stored.bits ?? planTokens;
//     const bitsLeft = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//             bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 72px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           {/* LOGO */}
//           {/* <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link> */}

//           <Link href="/" className="nav-logo">
//   {/* <img src="/collabzy-logo.png.png" alt="Collabzy" style={{ height: 100, width: "auto", objectFit: "contain" }} /> */}
//   <img src="/collabzy-logo.png" alt="Collabzy" style={{ height: 89, width: "auto", maxWidth: 280, objectFit: "contain" }} />
// </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>

//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>


//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//                       {/* <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link> */}
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/my-applications"        className={`nav-mobile-link ${isActive("/my-applications") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
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
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/setup-profile"   className={`nav-mobile-link ${isActive("/setup-profile") ? "active" : ""}`}>Viwe Profile</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// // ── Simple in-memory cache — page reload tak valid ───────────────
// const cache: Record<string, { data: any; ts: number }> = {};
// const CACHE_TTL = 60_000; // 1 minute

// const cachedFetch = async (url: string, token: string) => {
//   const now = Date.now();
//   if (cache[url] && now - cache[url].ts < CACHE_TTL) return cache[url].data;
//   try {
//     const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
//     const data = await res.json();
//     cache[url] = { data, ts: now };
//     return data;
//   } catch { return null; }
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router   = useRouter();

//   const [user, setUser]               = useState<any>(null);
//   const [profile, setProfile]         = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed]   = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   // ── Init: runs ONCE on mount — fetch profile + usage counts ──
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");
//     if (!storedUser || !token) { setUser(null); setProfile(null); return; }

//     setUser(parsedUser);

//     // Profile — cached, call once
//     cachedFetch(`${API_BASE}/profile/me`, token).then(data => {
//       if (data?.success && data.profile) setProfile(data.profile);
//     });

//     // Brand: campaigns used — cached
//     if (parsedUser.role?.toLowerCase() === "brand") {
//       cachedFetch(`${API_BASE}/campaigns/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.data || data.campaigns || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const planActivatedAt = freshUser.planActivatedAt;
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setCampsUsed(list.filter((c: any) => new Date(c.createdAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     // Creator: applies used — cached
//     if (parsedUser.role?.toLowerCase() === "influencer") {
//       cachedFetch(`${API_BASE}/application/my`, token).then(data => {
//         if (!data) return;
//         const list: any[] = data.applications || data.data || [];
//         const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//         const isSubscribed = freshUser.isSubscribed ?? false;
//         const planActivatedAt = freshUser.planActivatedAt;
//         if (isSubscribed && planActivatedAt) {
//           const planStart = new Date(planActivatedAt);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart).length);
//         } else {
//           const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//           setAppliesUsed(list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart).length);
//         }
//       });
//     }

//     // Unread notifications — lightweight, called once on mount
//     fetchUnreadCount(token);
//   }, []); // ← ONLY on mount, NOT on every pathname change

//   // ── Unread count: sirf mount pe aur tab-switch pe ────────────
//   const fetchUnreadCount = async (token: string) => {
//     try {
//       const res  = await fetch(`${API_BASE}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const notifs: any[] = data.notifications || data.data || [];
//       const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//       const cbStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//       const unread = notifs.filter(
//         (n: any) => !n.read && !localRead.includes(n._id) && !cbStatus[n._id]
//       );
//       setUnreadCount(unread.length);
//     } catch { /* silent */ }
//   };

//   // ── Notification page pe: mark all read, no polling ──────────
//   useEffect(() => {
//     if (!pathname?.startsWith("/notification")) return;
//     setUnreadCount(0);
//     // Mark all read on server — fire and forget
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
//   }, [pathname]); // only when pathname changes to /notification

//   // ── Storage events: unread badge update from other pages ─────
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   // ── Visibility change: refresh unread count on tab focus ─────
//   useEffect(() => {
//     const handleVisibility = () => {
//       if (document.visibilityState !== "visible") return;
//       const stored = localStorage.getItem("cb_user");
//       if (!stored) return;
//       const token = JSON.parse(stored).token || localStorage.getItem("token");
//       if (token && !pathname?.startsWith("/notification")) fetchUnreadCount(token);
//     };
//     document.addEventListener("visibilitychange", handleVisibility);
//     return () => document.removeEventListener("visibilitychange", handleVisibility);
//   }, [pathname]);

//   // ── Click outside dropdown ────────────────────────────────────
//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // ── Close mobile menu on route change ────────────────────────
//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const storedBits = stored.bits ?? planTokens;
//     const bitsLeft = subbed ? (storedBits <= planTokens ? storedBits : planTokens) : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//             bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 24px; height: 64px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; }
//         @media(max-width:900px){ .nav-inner { grid-template-columns: auto auto; justify-content: space-between; } .nav-inner > *:nth-child(2) { display: none; } }
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }
//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }
//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }
//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/my-applications" className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>MyApplications</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage
//                         ? <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                         : <span>{displayName.charAt(0).toUpperCase()}</span>}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
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
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
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
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }




// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     // ✅ Subscribed user ke liye: bits sirf tab use karo jab plan tokens se kam ho
//     // Agar bits > planTokens hai toh purana data hai — plan tokens dikhao
//     const storedBits = stored.bits ?? planTokens;
//     const bitsLeft = subbed
//       ? (storedBits <= planTokens ? storedBits : planTokens) // cap at plan max
//       : storedBits;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     // ✅ Plan info save rakho — next login pe restore hogi
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//             bits: u.bits ?? null,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/my-applications"    className={`nav-link ${isActive("/my-applications") ? "active" : ""}`}>MyApplications</Link>
               
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   {/* <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link> */}
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* Creator plan stats box */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* Brand plan stats box */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           {/* <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link> */}
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           {/* <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link> */}
//                           {/* <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link> */}
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             {/* <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link> */}
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
             
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     // ✅ bits = actual remaining tokens (deducted on each apply)
//     // Agar bits set nahi hai toh plan ki full tokens dikhao
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const bitsLeft = stored.bits !== undefined ? stored.bits : planTokens;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     // ✅ Plan info save rakho — next login pe restore hogi
//     const stored = localStorage.getItem("cb_user");
//     if (stored) {
//       try {
//         const u = JSON.parse(stored);
//         if (u.activePlan) {
//           localStorage.setItem("cb_plan_backup", JSON.stringify({
//             activePlan: u.activePlan,
//             planActivatedAt: u.planActivatedAt || null,
//             isSubscribed: u.isSubscribed || false,
//           }));
//         }
//       } catch { /* silent */ }
//     }
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* Creator plan stats box */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* Brand plan stats box */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     // ✅ bits = actual remaining tokens (deducted on each apply)
//     // Agar bits set nahi hai toh plan ki full tokens dikhao
//     const planTokens = plan.tokens === "unlimited" ? 0 : (plan.tokens as number);
//     const bitsLeft = stored.bits !== undefined ? stored.bits : planTokens;
//     const tokensLeft: number | "∞" = plan.tokens === "unlimited" ? "∞" : Math.max(0, bitsLeft);
//     const tokensTotal = plan.tokens === "unlimited" ? "∞" : plan.tokens;
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* Creator plan stats box */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* Brand plan stats box */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     // ✅ Subscribed user ke liye plan ki full tokens dikhao — purana bits ignore karo
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : (plan.tokens as number);
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* Creator plan stats box */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* Brand plan stats box */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const bits    = stored.bits ?? (plan.tokens === "unlimited" ? 0 : plan.tokens);
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, bits);
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 260px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; max-height: calc(100vh - 80px); overflow-y: auto; overflow-x: hidden; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* Creator plan stats box */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* Brand plan stats box */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }

// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             // ✅ Sirf plan activate hone ke BAAD ke campaigns count karo
//             // ✅ Fresh localStorage read for brand too
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const planActivatedAt = freshUser.planActivatedAt;
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             if (isSubscribed && planActivatedAt) {
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) > planStart);
//               setCampsUsed(since.length);
//             } else {
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((c: any) => new Date(c.createdAt || c.created_at || 0) >= monthStart);
//               setCampsUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation only
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             // ✅ Fresh localStorage read - plan upgrade ke baad updated value milegi
//             const freshUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//             const isSubscribed = freshUser.isSubscribed ?? false;
//             const planActivatedAt = freshUser.planActivatedAt;
//             if (isSubscribed && planActivatedAt) {
//               // Paid plan: sirf activation ke BAAD ke applies count karo
//               const planStart = new Date(planActivatedAt);
//               const since = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) > planStart);
//               setAppliesUsed(since.length);
//             } else {
//               // Free plan: is mahine ke applies
//               const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
//               const thisMonth = list.filter((a: any) => new Date(a.createdAt || a.appliedAt || 0) >= monthStart);
//               setAppliesUsed(thisMonth.length);
//             }
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand ? (profile?.companyName || user?.companyName || user?.name || "User") : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   // Brand plan stats
//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   // Creator plan stats
//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const bits    = stored.bits ?? (plan.tokens === "unlimited" ? 0 : plan.tokens);
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, bits);
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 230px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             const planStart = parsedUser.planActivatedAt
//               ? new Date(parsedUser.planActivatedAt)
//               : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
//             const sinceActivation = list.filter((c: any) => {
//               const d = new Date(c.createdAt || c.created_at || 0);
//               return d >= planStart;
//             });
//             setCampsUsed(sinceActivation.length);
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used SINCE plan activation
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             const planStart = parsedUser.planActivatedAt
//               ? new Date(parsedUser.planActivatedAt)
//               : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
//             const sinceActivation = list.filter((a: any) => {
//               const d = new Date(a.createdAt || a.appliedAt || 0);
//               return d >= planStart;
//             });
//             setAppliesUsed(sinceActivation.length);
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand ? (profile?.companyName || user?.companyName || user?.name || "User") : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   // Brand plan stats
//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   // Creator plan stats
//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const bits    = stored.bits ?? (plan.tokens === "unlimited" ? 0 : plan.tokens);
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, bits);
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav{position:sticky;top:0;z-index:9999;background:#fff;border-bottom:1px solid #ebebeb;font-family:'Plus Jakarta Sans',sans-serif}
//         .nav-inner{max-width:1280px;margin:0 auto;padding:0 24px;height:64px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:24px}
//         @media(max-width:900px){.nav-inner{grid-template-columns:auto auto;justify-content:space-between}.nav-inner>*:nth-child(2){display:none}}
//         .nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}
//         .nav-logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;flex-shrink:0}
//         .nav-logo-text{font-weight:800;font-size:17px;color:#111;white-space:nowrap}
//         @media(max-width:480px){.nav-logo-text{font-size:15px}}
//         .nav-links{display:flex;align-items:center;gap:4px;justify-content:center;flex-wrap:nowrap;overflow-x:auto}
//         @media(max-width:900px){.nav-links{display:none}}
//         .nav-link{font-size:12.5px;font-weight:600;color:#777;text-decoration:none;padding:6px 7px;border-radius:9px;transition:all .18s;white-space:nowrap;display:flex;align-items:center;gap:5px}
//         .nav-link:hover{color:#111;background:#f5f5f3}
//         .nav-link.active{color:#4f46e5;background:#eef2ff}
//         .nav-notif-badge{background:#ef4444;color:#fff;border-radius:100px;font-size:9px;padding:1px 5px;font-weight:800;display:inline-block}
//         .nav-right{display:flex;align-items:center;gap:8px;justify-content:flex-end}
//         .nav-avatar-btn{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border-radius:100px;border:1.5px solid #ebebeb;background:none;cursor:pointer;transition:all .2s}
//         .nav-avatar-btn:hover{border-color:#c7d2fe;background:#f8f7ff}
//         .nav-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0}
//         .nav-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .nav-avatar-name{font-size:13px;font-weight:600;color:#111;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
//         @media(max-width:480px){.nav-avatar-name{display:none}}
//         .nav-dropdown{position:absolute;top:calc(100% + 8px);right:0;width:260px;background:#fff;border-radius:16px;border:1.5px solid #ebebeb;box-shadow:0 8px 30px rgba(0,0,0,.1);padding:8px;z-index:9999;animation:dropIn .15s ease;max-height:calc(100vh - 80px);overflow-y:auto;overflow-x:hidden}
//         @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
//         .nav-dd-user{padding:10px 12px 12px}
//         .nav-dd-username{font-size:14px;font-weight:700;color:#111;margin:0 0 4px}
//         .nav-dd-role{font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:.08em;margin:0;display:inline-block;padding:2px 8px;border-radius:100px;background:linear-gradient(135deg,#4f46e5,#7c3aed);font-weight:700}
//         .nav-dd-sep{height:1px;background:#f0f0f0;margin:6px 0}
//         .nav-dd-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;text-decoration:none;transition:background .15s;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:'Plus Jakarta Sans',sans-serif}
//         .nav-dd-item:hover{background:#f5f5f0;color:#111}
//         .nav-dd-item.danger{color:#ef4444}
//         .nav-dd-item.danger:hover{background:#fff5f5}
//         .nav-dd-item.upgrade-dd{background:linear-gradient(135deg,#ede9fe,#e0e7ff);color:#4f46e5;font-weight:700}
//         .nav-dd-item.upgrade-dd:hover{background:linear-gradient(135deg,#ddd6fe,#c7d2fe)}
//         .nav-dd-section{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.08em;padding:8px 12px 4px}
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login{font-size:13px;font-weight:600;color:#666;text-decoration:none;padding:8px 14px;border-radius:10px;transition:all .2s}
//         .nav-login:hover{color:#111;background:#f5f5f0}
//         .nav-join{font-size:13px;font-weight:700;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:9px 18px;border-radius:10px;text-decoration:none;transition:all .2s;box-shadow:0 2px 10px rgba(79,70,229,.3)}
//         .nav-join:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,.4)}
//         .nav-hamburger{display:none;width:40px;height:40px;border-radius:10px;border:1.5px solid #ebebeb;background:none;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:10px;transition:all .2s}
//         @media(max-width:900px){.nav-hamburger{display:flex}}
//         .nav-hamburger:hover{background:#f5f5f0}
//         .nav-hamburger span{display:block;width:18px;height:2px;background:#111;border-radius:2px}
//         .nav-mobile{display:none;background:#fff;border-top:1px solid #ebebeb;padding:12px 24px 20px;flex-direction:column;gap:4px;max-height:85vh;overflow-y:auto}
//         .nav-mobile.open{display:flex}
//         .nav-mobile-section{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.08em;padding:14px 0 6px}
//         .nav-mobile-link{font-size:14px;font-weight:600;color:#555;text-decoration:none;padding:11px 0;border-bottom:1px solid #f5f5f5;transition:color .2s;display:flex;align-items:center;gap:10px}
//         .nav-mobile-link:hover,.nav-mobile-link.active{color:#4f46e5}
//         .nav-mobile-upgrade{display:flex;align-items:center;gap:8px;padding:13px 0;border-bottom:1px solid #f5f5f5;font-size:14px;font-weight:700;color:#4f46e5;text-decoration:none}
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
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
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* ── Creator plan stats box ── */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* ── Brand plan stats box ── */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {isInfluencer && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">My Work</div>
//                         <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                         <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                       </>)}

//                       {isBrand && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">Brand Tools</div>
//                         <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}

//                       {isAdmin && (<>
//                         <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"     className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts" className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
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

//             {/* Creator mobile plan box */}
//             {isInfluencer && (() => {
//               const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//               const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//               return (
//                 <div style={{ background: "#f8f7ff", border: "1.5px solid #e8e5ff", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 0, margin: "6px 0 10px" }}>
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Applies</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(appliesTotal)} left</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Tokens</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(tokensTotal)}</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Plan</div>
//                     <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{plan.label}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>current</div>
//                   </div>
//                 </div>
//               );
//             })()}

//             {/* Brand mobile plan box */}
//             {isBrand && (() => {
//               const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//               const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//               return (
//                 <div style={{ background: "#f8f7ff", border: "1.5px solid #e8e5ff", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 0, margin: "6px 0 10px" }}>
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Campaigns</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: campColor }}>{campsLeft}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {plan.campaigns} left</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Tokens</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(plan.tokens)}</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Plan</div>
//                     <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{plan.label}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>current</div>
//                   </div>
//                 </div>
//               );
//             })()}

//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}
//             >Logout</button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const CREATOR_PLAN_LIMITS: Record<string, { label: string; applies: number | "unlimited"; tokens: number | "unlimited" }> = {
//   free:          { label: "Free",  applies: 10,          tokens: 100          },
//   pro:           { label: "Pro",   applies: 100,         tokens: 1000         },
//   pro_plus:      { label: "Pro+",  applies: 200,         tokens: 2000         },
//   pro_year:      { label: "Pro",   applies: "unlimited", tokens: "unlimited"  },
//   pro_plus_year: { label: "Pro+",  applies: "unlimited", tokens: "unlimited"  },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   const [campsUsed, setCampsUsed] = useState(0);
//   const [appliesUsed, setAppliesUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Brand: fetch campaigns used this month
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             const now = new Date();
//             const thisMonth = list.filter((c: any) => {
//               const d = new Date(c.createdAt || c.created_at || 0);
//               return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
//             });
//             setCampsUsed(thisMonth.length);
//           })
//           .catch(() => {});
//       }

//       // Creator: fetch applies used this month
//       if (parsedUser.role?.toLowerCase() === "influencer") {
//         fetch(`${API_BASE}/application/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.applications || data.data || [];
//             const now = new Date();
//             const thisMonth = list.filter((a: any) => {
//               const d = new Date(a.createdAt || a.appliedAt || 0);
//               return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
//             });
//             setAppliesUsed(thisMonth.length);
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             notifs.filter((n: any) => !n.read).forEach((n: any) => {
//               fetch(`${API_BASE}/notification/read/${n._id}`, {
//                 method: "PATCH", headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]);
//           setUnreadCount(unread.length);
//         }).catch(() => {});
//     } else {
//       setUser(null); setProfile(null); setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) setUnreadCount(Number(e.newValue));
//     };
//     window.addEventListener("storage", handleStorage);
//     if (localStorage.getItem("notif_all_read")) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => { setMobileMenuOpen(false); setDropdownOpen(false); }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user"); localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns"); localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds"); localStorage.removeItem("notif_all_read");
//     setUser(null); setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName  = isBrand ? (profile?.companyName || user?.companyName || user?.name || "User") : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive     = (path: string) => pathname?.startsWith(path);

//   const fmtNum = (n: number | string) => {
//     if (n === "unlimited" || n === "∞") return "∞";
//     const num = Number(n);
//     return num >= 1000 ? `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}k` : String(num);
//   };

//   // Brand plan stats
//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   // Creator plan stats
//   const getCreatorPlanStats = () => {
//     const stored  = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed  = stored.isSubscribed ?? false;
//     const ap      = stored.activePlan ?? null;
//     const canon   = subbed && ap ? toCanonical(ap) : "free";
//     const plan    = CREATOR_PLAN_LIMITS[canon] ?? CREATOR_PLAN_LIMITS["free"];
//     const bits    = stored.bits ?? (plan.tokens === "unlimited" ? 0 : plan.tokens);
//     const isUnlim = plan.applies === "unlimited";
//     const appliesLeft: number | "∞" = isUnlim ? "∞" : Math.max(0, (plan.applies as number) - appliesUsed);
//     const tokensLeft: number | "∞"  = plan.tokens === "unlimited" ? "∞" : Math.max(0, bits);
//     const appliesTotal = plan.applies === "unlimited" ? "∞" : plan.applies;
//     const tokensTotal  = plan.tokens  === "unlimited" ? "∞" : plan.tokens;
//     return { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal, isUnlim };
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         .nav{position:sticky;top:0;z-index:9999;background:#fff;border-bottom:1px solid #ebebeb;font-family:'Plus Jakarta Sans',sans-serif}
//         .nav-inner{max-width:1280px;margin:0 auto;padding:0 24px;height:64px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:24px}
//         @media(max-width:900px){.nav-inner{grid-template-columns:auto auto;justify-content:space-between}.nav-inner>*:nth-child(2){display:none}}
//         .nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}
//         .nav-logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#4f46e5,#7c3aed);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;flex-shrink:0}
//         .nav-logo-text{font-weight:800;font-size:17px;color:#111;white-space:nowrap}
//         @media(max-width:480px){.nav-logo-text{font-size:15px}}
//         .nav-links{display:flex;align-items:center;gap:4px;justify-content:center;flex-wrap:nowrap;overflow-x:auto}
//         @media(max-width:900px){.nav-links{display:none}}
//         .nav-link{font-size:12.5px;font-weight:600;color:#777;text-decoration:none;padding:6px 7px;border-radius:9px;transition:all .18s;white-space:nowrap;display:flex;align-items:center;gap:5px}
//         .nav-link:hover{color:#111;background:#f5f5f3}
//         .nav-link.active{color:#4f46e5;background:#eef2ff}
//         .nav-notif-badge{background:#ef4444;color:#fff;border-radius:100px;font-size:9px;padding:1px 5px;font-weight:800;display:inline-block}
//         .nav-right{display:flex;align-items:center;gap:8px;justify-content:flex-end}
//         .nav-avatar-btn{display:flex;align-items:center;gap:8px;padding:4px 10px 4px 4px;border-radius:100px;border:1.5px solid #ebebeb;background:none;cursor:pointer;transition:all .2s}
//         .nav-avatar-btn:hover{border-color:#c7d2fe;background:#f8f7ff}
//         .nav-avatar{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;overflow:hidden;flex-shrink:0}
//         .nav-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
//         .nav-avatar-name{font-size:13px;font-weight:600;color:#111;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
//         @media(max-width:480px){.nav-avatar-name{display:none}}
//         .nav-dropdown{position:absolute;top:calc(100% + 8px);right:0;width:260px;background:#fff;border-radius:16px;border:1.5px solid #ebebeb;box-shadow:0 8px 30px rgba(0,0,0,.1);padding:8px;z-index:9999;animation:dropIn .15s ease;max-height:calc(100vh - 80px);overflow-y:auto;overflow-x:hidden}
//         @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
//         .nav-dd-user{padding:10px 12px 12px}
//         .nav-dd-username{font-size:14px;font-weight:700;color:#111;margin:0 0 4px}
//         .nav-dd-role{font-size:10px;color:#fff;text-transform:uppercase;letter-spacing:.08em;margin:0;display:inline-block;padding:2px 8px;border-radius:100px;background:linear-gradient(135deg,#4f46e5,#7c3aed);font-weight:700}
//         .nav-dd-sep{height:1px;background:#f0f0f0;margin:6px 0}
//         .nav-dd-item{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;font-size:13px;font-weight:600;color:#444;text-decoration:none;transition:background .15s;cursor:pointer;border:none;background:none;width:100%;text-align:left;font-family:'Plus Jakarta Sans',sans-serif}
//         .nav-dd-item:hover{background:#f5f5f0;color:#111}
//         .nav-dd-item.danger{color:#ef4444}
//         .nav-dd-item.danger:hover{background:#fff5f5}
//         .nav-dd-item.upgrade-dd{background:linear-gradient(135deg,#ede9fe,#e0e7ff);color:#4f46e5;font-weight:700}
//         .nav-dd-item.upgrade-dd:hover{background:linear-gradient(135deg,#ddd6fe,#c7d2fe)}
//         .nav-dd-section{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.08em;padding:8px 12px 4px}
//         .nav-plan-box{margin-top:10px;background:#f8f7ff;border:1.5px solid #e8e5ff;border-radius:10px;padding:10px 12px;display:flex;gap:0}
//         .nav-plan-stat{flex:1;text-align:center}
//         .nav-plan-stat+.nav-plan-stat{border-left:1px solid #e8e5ff}
//         .nav-plan-stat-label{font-size:9px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}
//         .nav-plan-stat-val{font-size:15px;font-weight:800;line-height:1}
//         .nav-plan-stat-sub{font-size:9px;color:#aaa;font-weight:500;margin-top:1px}
//         .nav-login{font-size:13px;font-weight:600;color:#666;text-decoration:none;padding:8px 14px;border-radius:10px;transition:all .2s}
//         .nav-login:hover{color:#111;background:#f5f5f0}
//         .nav-join{font-size:13px;font-weight:700;color:#fff;background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:9px 18px;border-radius:10px;text-decoration:none;transition:all .2s;box-shadow:0 2px 10px rgba(79,70,229,.3)}
//         .nav-join:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(79,70,229,.4)}
//         .nav-hamburger{display:none;width:40px;height:40px;border-radius:10px;border:1.5px solid #ebebeb;background:none;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:10px;transition:all .2s}
//         @media(max-width:900px){.nav-hamburger{display:flex}}
//         .nav-hamburger:hover{background:#f5f5f0}
//         .nav-hamburger span{display:block;width:18px;height:2px;background:#111;border-radius:2px}
//         .nav-mobile{display:none;background:#fff;border-top:1px solid #ebebeb;padding:12px 24px 20px;flex-direction:column;gap:4px;max-height:85vh;overflow-y:auto}
//         .nav-mobile.open{display:flex}
//         .nav-mobile-section{font-size:10px;font-weight:700;color:#bbb;text-transform:uppercase;letter-spacing:.08em;padding:14px 0 6px}
//         .nav-mobile-link{font-size:14px;font-weight:600;color:#555;text-decoration:none;padding:11px 0;border-bottom:1px solid #f5f5f5;transition:color .2s;display:flex;align-items:center;gap:10px}
//         .nav-mobile-link:hover,.nav-mobile-link.active{color:#4f46e5}
//         .nav-mobile-upgrade{display:flex;align-items:center;gap:8px;padding:13px 0;border-bottom:1px solid #f5f5f5;font-size:14px;font-weight:700;color:#4f46e5;text-decoration:none}
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (<>
//                 <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isBrand && (<>
//                 <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                 <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                   Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                 </Link>
//               </>)}
//               {isAdmin && (<>
//                 <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                 <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                 <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                 <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                 <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
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
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* ── Creator plan stats box ── */}
//                         {isInfluencer && (() => {
//                           const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//                           const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Applies</div>
//                                 <div className="nav-plan-stat-val" style={{ color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(appliesTotal)} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(tokensTotal)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}

//                         {/* ── Brand plan stats box ── */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {isInfluencer && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">My Work</div>
//                         <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                         <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                       </>)}

//                       {isBrand && (<>
//                         <div className="nav-dd-sep" />
//                         <div className="nav-dd-section">Brand Tools</div>
//                         <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                         <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}

//                       {isAdmin && (<>
//                         <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                       </>)}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"     className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts" className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
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

//             {/* Creator mobile plan box */}
//             {isInfluencer && (() => {
//               const { plan, appliesLeft, appliesTotal, tokensLeft, tokensTotal } = getCreatorPlanStats();
//               const applyColor = appliesLeft === "∞" ? "#16a34a" : (appliesLeft as number) === 0 ? "#ef4444" : (appliesLeft as number) <= 3 ? "#f59e0b" : "#4f46e5";
//               return (
//                 <div style={{ background: "#f8f7ff", border: "1.5px solid #e8e5ff", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 0, margin: "6px 0 10px" }}>
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Applies</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: applyColor }}>{fmtNum(appliesLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(appliesTotal)} left</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Tokens</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(tokensTotal)}</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Plan</div>
//                     <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{plan.label}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>current</div>
//                   </div>
//                 </div>
//               );
//             })()}

//             {/* Brand mobile plan box */}
//             {isBrand && (() => {
//               const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//               const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//               return (
//                 <div style={{ background: "#f8f7ff", border: "1.5px solid #e8e5ff", borderRadius: 12, padding: "12px 16px", display: "flex", gap: 0, margin: "6px 0 10px" }}>
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Campaigns</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: campColor }}>{campsLeft}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {plan.campaigns} left</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Tokens</div>
//                     <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>of {fmtNum(plan.tokens)}</div>
//                   </div>
//                   <div style={{ width: 1, background: "#e8e5ff" }} />
//                   <div style={{ flex: 1, textAlign: "center" }}>
//                     <div style={{ fontSize: 9, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>Plan</div>
//                     <div style={{ fontSize: 14, fontWeight: 800, color: "#111" }}>{plan.label}</div>
//                     <div style={{ fontSize: 9, color: "#aaa", marginTop: 1 }}>current</div>
//                   </div>
//                 </div>
//               );
//             })()}

//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}
//             >Logout</button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// // ── Plan limits (same as PostCampaignPage) ──
// const PLAN_LIMITS: Record<string, { label: string; campaigns: number; tokens: number }> = {
//   free:          { label: "Free",  campaigns: 2,   tokens: 200   },
//   pro:           { label: "Pro",   campaigns: 10,  tokens: 1000  },
//   pro_plus:      { label: "Pro+",  campaigns: 25,  tokens: 2500  },
//   pro_year:      { label: "Pro",   campaigns: 120, tokens: 12000 },
//   pro_plus_year: { label: "Pro+",  campaigns: 250, tokens: 25000 },
// };

// const toCanonical = (s: string): string => {
//   if (!s) return "free";
//   const v = s.toLowerCase().trim();
//   if (v === "pro+" || v === "pro_plus" || v === "proplus") return "pro_plus";
//   if (v === "pro+year" || v === "pro_plus_year" || v === "proplusyear") return "pro_plus_year";
//   if (v === "proyear" || v === "pro_year") return "pro_year";
//   if (v === "pro") return "pro";
//   return "free";
// };

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   // Brand plan stats
//   const [campsUsed, setCampsUsed] = useState(0);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // Fetch brand campaign usage this month
//       if (parsedUser.role?.toLowerCase() === "brand") {
//         fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const list: any[] = data.data || data.campaigns || [];
//             const now = new Date();
//             const thisMonth = list.filter((c: any) => {
//               const d = new Date(c.createdAt || c.created_at || 0);
//               return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
//             });
//             setCampsUsed(thisMonth.length);
//           })
//           .catch(() => {});
//       }

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             const unreadIds = notifs.filter((n: any) => !n.read).map((n: any) => n._id);
//             unreadIds.forEach((id: string) => {
//               fetch(`${API_BASE}/notification/read/${id}`, {
//                 method: "PATCH",
//                 headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) =>
//             !n.read && !localRead.includes(n._id) && !cbNotifStatus[n._id]
//           );
//           setUnreadCount(unread.length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//       setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       if (e.key === "notif_unread_count" && e.newValue !== null) {
//         setUnreadCount(Number(e.newValue));
//       }
//     };
//     window.addEventListener("storage", handleStorage);
//     const wasRead = localStorage.getItem("notif_all_read");
//     if (wasRead) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   // ── Brand plan stats ──
//   const getBrandPlanStats = () => {
//     const stored   = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const subbed   = stored.isSubscribed ?? false;
//     const ap       = stored.activePlan ?? null;
//     const plan     = subbed && ap ? (PLAN_LIMITS[toCanonical(ap)] ?? PLAN_LIMITS["free"]) : PLAN_LIMITS["free"];
//     const bits     = stored.bits ?? plan.tokens;
//     const campsLeft  = Math.max(0, plan.campaigns - campsUsed);
//     const tokensLeft = subbed ? plan.tokens : Math.max(0, bits);
//     return { plan, campsLeft, tokensLeft };
//   };

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 240px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }

//         /* ── Brand plan mini box ── */
//         .nav-plan-box { margin-top: 10px; background: #f8f7ff; border: 1.5px solid #e8e5ff; border-radius: 10px; padding: 10px 12px; display: flex; gap: 0; }
//         .nav-plan-stat { flex: 1; text-align: center; }
//         .nav-plan-stat + .nav-plan-stat { border-left: 1px solid #e8e5ff; }
//         .nav-plan-stat-label { font-size: 9px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px; }
//         .nav-plan-stat-val { font-size: 15px; font-weight: 800; line-height: 1; }
//         .nav-plan-stat-sub { font-size: 9px; color: #aaa; font-weight: 500; margin-top: 1px; }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}
//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>

//                         {/* ── Brand plan mini stats box ── */}
//                         {isBrand && (() => {
//                           const { plan, campsLeft, tokensLeft } = getBrandPlanStats();
//                           const campColor = campsLeft === 0 ? "#ef4444" : campsLeft <= 2 ? "#f59e0b" : "#4f46e5";
//                           const fmtNum = (n: number) => n >= 1000 ? `${(n/1000).toFixed(n%1000===0?0:1)}k` : String(n);
//                           return (
//                             <div className="nav-plan-box">
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Campaigns</div>
//                                 <div className="nav-plan-stat-val" style={{ color: campColor }}>{campsLeft}</div>
//                                 <div className="nav-plan-stat-sub">of {plan.campaigns} left</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Tokens</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#7c3aed" }}>{fmtNum(tokensLeft)}</div>
//                                 <div className="nav-plan-stat-sub">of {fmtNum(plan.tokens)}</div>
//                               </div>
//                               <div className="nav-plan-stat">
//                                 <div className="nav-plan-stat-label">Plan</div>
//                                 <div className="nav-plan-stat-val" style={{ color: "#111", fontSize: 13 }}>{plan.label}</div>
//                                 <div className="nav-plan-stat-sub">current</div>
//                               </div>
//                             </div>
//                           );
//                         })()}
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/smart-match"    className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
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

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       if (pathname?.startsWith("/notification")) {
//         // ✅ Notification page pe hain — sab read mark karo aur 0 dikhao
//         setUnreadCount(0);
//         // Backend pe bhi sab read mark karo silently
//         fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//           .then(r => r.json())
//           .then(data => {
//             const notifs = data.notifications || data.data || [];
//             const unreadIds = notifs.filter((n: any) => !n.read).map((n: any) => n._id);
//             unreadIds.forEach((id: string) => {
//               fetch(`${API_BASE}/notification/read/${id}`, {
//                 method: "PATCH",
//                 headers: { Authorization: `Bearer ${token}` },
//               }).catch(() => {});
//             });
//           }).catch(() => {});
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           // ✅ cb_notif_status se locally read/accepted wale bhi check karo
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const cbNotifStatus: Record<string, string> = JSON.parse(localStorage.getItem("cb_notif_status") || "{}");
//           const unread = notifs.filter((n: any) =>
//             !n.read &&
//             !localRead.includes(n._id) &&
//             !cbNotifStatus[n._id]  // cb_notif_status mein hai matlab read ho chuka hai
//           );
//           setUnreadCount(unread.length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//       setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//       // ✅ NotificationsPage se real-time count update
//       if (e.key === "notif_unread_count" && e.newValue !== null) {
//         setUnreadCount(Number(e.newValue));
//       }
//     };
//     window.addEventListener("storage", handleStorage);
//     const wasRead = localStorage.getItem("notif_all_read");
//     if (wasRead) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 230px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER LINKS — Deals/Contracts/Rewards moved to profile dropdown */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND LINKS — More dropdown removed, Deals/Contracts moved to profile dropdown */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN LINKS */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* Upgrade */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       {/* Profile */}
//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* Influencer extras — Deals, Contracts, Rewards in dropdown */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                         </>
//                       )}

//                       {/* Brand extras — Deals, Contracts, tools moved here */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/deals"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           {/* <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link> */}
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       {/* Admin */}
//                       {isAdmin && (
//                         <>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             <div className="nav-mobile-section">Work</div>
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 {/* <Link href="/invite"      className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
//                 <Link href="/contact"     className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link> */}
//                 <Link href="/smart-match" className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"    className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"   className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id));
//           setUnreadCount(unread.length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//       setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//     };
//     window.addEventListener("storage", handleStorage);
//     const wasRead = localStorage.getItem("notif_all_read");
//     if (wasRead) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 230px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   {/* <Link href="/apply"        className={`nav-link ${isActive("/apply") ? "active" : ""}`}>Applied</Link> */}
//                   {/* <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link> */}
//                   {/* <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link> */}
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   {/* <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link> */}
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   {/* <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link> */}
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* INFLUENCER DROPDOWN */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                           <Link href="/terms"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📜 Platform Terms</Link>
//                         </>
//                       )}

//                       {/* BRAND DROPDOWN */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/deals"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🤝 Deals</Link>
//                           <Link href="/contracts" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📄 Contracts</Link>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                           <Link href="/terms"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📜 Platform Terms</Link>
//                         </>
//                       )}

//                       {/* ADMIN DROPDOWN */}
//                       {isAdmin && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Admin</div>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             {isInfluencer && (
//               <>
//                 <div className="nav-mobile-section">Rewards & More</div>
//                 <Link href="/rewards"   className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>🎁 Rewards</Link>
//                 <Link href="/terms"     className={`nav-mobile-link ${isActive("/terms") ? "active" : ""}`}>📜 Platform Terms</Link>
//               </>
//             )}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"         className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>📩 Invite Creators</Link>
//                 <Link href="/contact"        className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>🔓 Unlock Contacts</Link>
//                 <Link href="/smart-match"    className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>✨ Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>📋 Post Campaign</Link>
//                 <Link href="/terms"          className={`nav-mobile-link ${isActive("/terms") ? "active" : ""}`}>📜 Platform Terms</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>🛡️ Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"      className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile"   className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"     className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }

// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         return;
//       }

//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id));
//           setUnreadCount(unread.length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//       setUnreadCount(0);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//     };
//     window.addEventListener("storage", handleStorage);
//     const wasRead = localStorage.getItem("notif_all_read");
//     if (wasRead) setUnreadCount(0);
//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role         = user?.role?.toLowerCase();
//   const isBrand      = role === "brand";
//   const isAdmin      = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1280px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }
//         @media(max-width:900px){
//           .nav-inner {
//             grid-template-columns: auto auto;
//             justify-content: space-between;
//           }
//           .nav-inner > *:nth-child(2) { display: none; }
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
//         @media(max-width:900px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 12.5px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 7px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
//         .nav-link:hover { color: #111; background: #f5f5f3; }
//         .nav-link.active { color: #4f46e5; background: #eef2ff; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 230px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }
//         .nav-dd-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 8px 12px 4px; }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:900px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
//         .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">

//               {/* INFLUENCER */}
//               {isInfluencer && (
//                 <>
//                   <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/apply"        className={`nav-link ${isActive("/apply") ? "active" : ""}`}>Applied</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* BRAND */}
//               {isBrand && (
//                 <>
//                   <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//               {/* ADMIN */}
//               {isAdmin && (
//                 <>
//                   <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
//                   <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//                   <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//                   <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//                   <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//                   <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//                     Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//                   </Link>
//                 </>
//               )}

//             </div>
//           ) : <div />}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>⚡ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* INFLUENCER DROPDOWN */}
//                       {isInfluencer && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">My Work</div>
//                           <Link href="/rewards"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🎁 Rewards</Link>
//                           <Link href="/terms"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📜 Platform Terms</Link>
//                         </>
//                       )}

//                       {/* BRAND DROPDOWN */}
//                       {isBrand && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Brand Tools</div>
//                           <Link href="/invite"         className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📩 Invite Creators</Link>
//                           <Link href="/contact"        className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔓 Unlock Contacts</Link>
//                           <Link href="/smart-match"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✨ Smart Match</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                           <Link href="/terms"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📜 Platform Terms</Link>
//                         </>
//                       )}

//                       {/* ADMIN DROPDOWN */}
//                       {isAdmin && (
//                         <>
//                           <div className="nav-dd-sep" />
//                           <div className="nav-dd-section">Admin</div>
//                           <Link href="/admin"          className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🛡️ Admin Panel</Link>
//                           <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📋 Post Campaign</Link>
//                         </>
//                       )}

//                       <div className="nav-dd-sep" />
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
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

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

//             <div className="nav-mobile-section">Main</div>
//             {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
//             {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
//             {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
//             {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
//             <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
//             <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
//             <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>

//             {isInfluencer && (
//               <>
//                 <div className="nav-mobile-section">Rewards & More</div>
//                 <Link href="/rewards"   className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>🎁 Rewards</Link>
//                 <Link href="/terms"     className={`nav-mobile-link ${isActive("/terms") ? "active" : ""}`}>📜 Platform Terms</Link>
//               </>
//             )}

//             {isBrand && (
//               <>
//                 <div className="nav-mobile-section">Brand Tools</div>
//                 <Link href="/invite"         className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>📩 Invite Creators</Link>
//                 <Link href="/contact"        className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>🔓 Unlock Contacts</Link>
//                 <Link href="/smart-match"    className={`nav-mobile-link ${isActive("/smart-match") ? "active" : ""}`}>✨ Smart Match</Link>
//                 <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>📋 Post Campaign</Link>
//                 <Link href="/terms"          className={`nav-mobile-link ${isActive("/terms") ? "active" : ""}`}>📜 Platform Terms</Link>
//               </>
//             )}

//             {isAdmin && (
//               <>
//                 <div className="nav-mobile-section">Admin</div>
//                 <Link href="/admin" className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>🛡️ Admin Panel</Link>
//               </>
//             )}

//             <div className="nav-mobile-section">Account</div>
//             <Link href="/upgrade"      className="nav-mobile-upgrade">⚡ Upgrade Plan</Link>
//             <Link href="/my-profile"   className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
//             <Link href="/settings"     className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
//               onClick={handleLogout}>
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }



// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});

//       // ✅ If user is ON notification page right now — count = 0 immediately
//       if (pathname?.startsWith("/notification")) {
//         setUnreadCount(0);
//         return;
//       }

//       // ✅ Fetch unread count but subtract locally-read ones
//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then(r => r.json())
//         .then(data => {
//           const notifs = data.notifications || data.data || [];
//           const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
//           const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id));
//           setUnreadCount(unread.length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//       setUnreadCount(0);
//     }
//   }, [pathname]);

//   // ✅ Listen for notif_all_read signal from notification page
//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const handleStorage = (e: StorageEvent) => {
//       if (e.key === "notif_all_read") setUnreadCount(0);
//     };
//     window.addEventListener("storage", handleStorage);

//     // Also check on mount in case it was already set
//     const wasRead = localStorage.getItem("notif_all_read");
//     if (wasRead) setUnreadCount(0);

//     return () => window.removeEventListener("storage", handleStorage);
//   }, []);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   // ✅ Landing page pe logged-in user ko navbar mat dikhao
//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     localStorage.removeItem("readNotifIds");
//     localStorage.removeItem("notif_all_read");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role        = user?.role?.toLowerCase();
//   const isBrand     = role === "brand";
//   const isAdmin     = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .nav-inner {
//           max-width: 1200px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         .nav-links { display: flex; align-items: center; gap: 28px; justify-content: center; }
//         @media(max-width:768px){ .nav-links{ display: none; } }

//         .nav-link { font-size: 14px; font-weight: 600; color: #888; text-decoration: none; padding: 4px 0; border-bottom: 2px solid transparent; transition: all 0.2s; white-space: nowrap; }
//         .nav-link:hover { color: #111; }
//         .nav-link.active { color: #4f46e5; border-bottom-color: #4f46e5; }

//         .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 10px; padding: 1px 6px; margin-left: 4px; font-weight: 700; display: inline-block; }

//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 2px; }
//         .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }

//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:768px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-link { font-size: 15px; font-weight: 600; color: #555; text-decoration: none; padding: 12px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 8px; }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 15px; font-weight: 700; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS */}
//           {user ? (
//             <div className="nav-links">
//               {isInfluencer && (
//                 <Link href="/discovery" className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//               )}
//               {isBrand && (
//                 <Link href="/browse" className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
//               )}
//               {(isBrand || isAdmin) && (
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//               )}
//               <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//               <Link
//                 href="/notification"
//                 className={`nav-link ${isActive("/notification") ? "active" : ""}`}
//                 onClick={() => setUnreadCount(0)}
//               >
//                 Notifications
//                 {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//               </Link>
//             </div>
//           ) : (
//             <div />
//           )}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>✦ Upgrade Plan</Link>
//                       <div className="nav-dd-sep" />
//                       <Link href="/my-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>
//                       {(isBrand || isAdmin) && (
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📢 Post Campaign</Link>
//                       )}
//                       {isBrand && (
//                         <Link href="/browse" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔍 Discover</Link>
//                       )}
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
//                 <Link href="/join" className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isInfluencer && (
//               <Link href="/discovery" className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>🔍 Discover</Link>
//             )}
//             {(isBrand || isAdmin) && (
//               <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>📋 Campaigns</Link>
//             )}
//             {isBrand && (
//               <Link href="/browse" className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>👥 Browse Creators</Link>
//             )}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>💬 Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
//               🔔 Notifications
//               {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
//             </Link>
//             <Link href="/upgrade" className="nav-mobile-upgrade">✦ Upgrade Plan</Link>
//             <Link href="/settings" className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>⚙️ Settings</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>👤 Profile</Link>
//             <button className="nav-mobile-link" style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%" }} onClick={handleLogout}>
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);
//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then((res) => res.json())
//         .then((data) => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});
//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then((res) => res.json())
//         .then((data) => {
//           const notifs = data.notifications || data.data || [];
//           setUnreadCount(notifs.filter((n: any) => !n.read).length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   // ✅ Landing page pe logged-in user ko navbar mat dikhao
//   if (pathname === "/" && user) return null;

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     localStorage.removeItem("connectedCreators");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role = user?.role?.toLowerCase();
//   const isBrand = role === "brand";
//   const isAdmin = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

//         .nav {
//           position: sticky; top: 0; z-index: 9999;
//           background: #fff; border-bottom: 1px solid #ebebeb;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }

//         .nav-inner {
//           max-width: 1200px; margin: 0 auto; padding: 0 24px;
//           height: 64px; display: grid;
//           grid-template-columns: auto 1fr auto;
//           align-items: center; gap: 24px;
//         }

//         /* LOGO */
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon {
//           width: 36px; height: 36px;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           border-radius: 10px; display: flex; align-items: center;
//           justify-content: center; color: #fff; font-weight: 800; font-size: 13px;
//           flex-shrink: 0;
//         }
//         .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

//         /* CENTER LINKS */
//         .nav-links { display: flex; align-items: center; gap: 28px; justify-content: center; }
//         @media(max-width:768px){ .nav-links{ display: none; } }

//         .nav-link {
//           font-size: 14px; font-weight: 600; color: #888;
//           text-decoration: none; padding: 4px 0;
//           border-bottom: 2px solid transparent; transition: all 0.2s;
//           white-space: nowrap;
//         }
//         .nav-link:hover { color: #111; }
//         .nav-link.active { color: #4f46e5; border-bottom-color: #4f46e5; }

//         .nav-notif-badge {
//           background: #ef4444; color: #fff; border-radius: 100px;
//           font-size: 10px; padding: 1px 6px; margin-left: 4px;
//           font-weight: 700; display: inline-block;
//         }

//         /* RIGHT */
//         .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

//         /* Avatar button */
//         .nav-avatar-btn {
//           display: flex; align-items: center; gap: 8px;
//           padding: 4px 10px 4px 4px; border-radius: 100px;
//           border: 1.5px solid #ebebeb; background: none;
//           cursor: pointer; transition: all 0.2s;
//         }
//         .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }

//         .nav-avatar {
//           width: 32px; height: 32px; border-radius: 50%;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           display: flex; align-items: center; justify-content: center;
//           font-size: 13px; font-weight: 800; color: #fff;
//           overflow: hidden; flex-shrink: 0;
//         }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name {
//           font-size: 13px; font-weight: 600; color: #111;
//           max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
//         }
//         @media(max-width:480px){ .nav-avatar-name{ display: none; } }

//         /* Dropdown */
//         .nav-dropdown {
//           position: absolute; top: calc(100% + 8px); right: 0;
//           width: 220px; background: #fff; border-radius: 16px;
//           border: 1.5px solid #ebebeb;
//           box-shadow: 0 8px 30px rgba(0,0,0,0.1);
//           padding: 8px; z-index: 9999;
//           animation: dropIn 0.15s ease;
//         }
//         @keyframes dropIn {
//           from { opacity: 0; transform: translateY(-6px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }
//         .nav-dd-user { padding: 10px 12px 12px; }
//         .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 2px; }
//         .nav-dd-role {
//           font-size: 10px; color: #fff; text-transform: uppercase;
//           letter-spacing: 0.08em; margin: 0;
//           display: inline-block; padding: 2px 8px; border-radius: 100px;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700;
//         }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }

//         .nav-dd-item {
//           display: flex; align-items: center; gap: 8px;
//           padding: 10px 12px; border-radius: 10px;
//           font-size: 13px; font-weight: 600; color: #444;
//           text-decoration: none; transition: background 0.15s;
//           cursor: pointer; border: none; background: none;
//           width: 100%; text-align: left;
//         }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd {
//           background: linear-gradient(135deg, #ede9fe, #e0e7ff);
//           color: #4f46e5; font-weight: 700;
//         }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }

//         /* Auth buttons */
//         .nav-login {
//           font-size: 13px; font-weight: 600; color: #666;
//           text-decoration: none; padding: 8px 14px;
//           border-radius: 10px; transition: all 0.2s;
//         }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join {
//           font-size: 13px; font-weight: 700; color: #fff;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           padding: 9px 18px; border-radius: 10px;
//           text-decoration: none; transition: all 0.2s;
//           box-shadow: 0 2px 10px rgba(79,70,229,0.3);
//         }
//         .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         /* Hamburger */
//         .nav-hamburger {
//           display: none; width: 40px; height: 40px;
//           border-radius: 10px; border: 1.5px solid #ebebeb;
//           background: none; cursor: pointer;
//           align-items: center; justify-content: center;
//           flex-direction: column; gap: 5px; padding: 10px;
//           transition: all 0.2s;
//         }
//         @media(max-width:768px){ .nav-hamburger{ display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         /* Mobile menu */
//         .nav-mobile {
//           display: none; background: #fff;
//           border-top: 1px solid #ebebeb;
//           padding: 12px 24px 20px;
//           flex-direction: column; gap: 4px;
//         }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-link {
//           font-size: 15px; font-weight: 600; color: #555;
//           text-decoration: none; padding: 12px 0;
//           border-bottom: 1px solid #f5f5f5;
//           transition: color 0.2s; display: flex;
//           align-items: center; gap: 8px;
//         }
//         .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
//         .nav-mobile-upgrade {
//           display: flex; align-items: center; gap: 8px;
//           padding: 13px 0; border-bottom: 1px solid #f5f5f5;
//           font-size: 15px; font-weight: 700;
//           color: #4f46e5; text-decoration: none;
//         }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* ── LOGO ── */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* ── CENTER LINKS ── */}
//           {user ? (
//             <div className="nav-links">
//               {/* Influencer links */}
//               {isInfluencer && (
//                 <Link href="/discovery" className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>
//                   Discover
//                 </Link>
//               )}

//                   {/* ✅ Browse Creators — only brand */}
//               {isBrand && (
//                 <Link href="/browse" className={`nav-link ${isActive("/browse") ? "active" : ""}`}>
//                   Discover
//                 </Link>
//               )}

//               {/* Brand links */}
//               {(isBrand || isAdmin) && (
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>
//                   Campaigns
//                 </Link>
//               )}

//               {/* ✅ Browse Creators — only brand */}
//               {/* {isBrand && (
//                 <Link href="/browse" className={`nav-link ${isActive("/browse") ? "active" : ""}`}>
//                   Discover
//                 </Link>
//               )} */}

//               <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`}>
//                 Messages
//               </Link>

//               <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`}>
//                 Notifications
//                 {unreadCount > 0 && (
//                   <span className="nav-notif-badge">{unreadCount}</span>
//                 )}
//               </Link>
//             </div>
//           ) : (
//             <div /> /* empty center when logged out */
//           )}

//           {/* ── RIGHT ── */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 <div style={{ position: "relative" }} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img
//                           src={displayImage} alt={displayName}
//                           onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
//                         />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <span className="nav-dd-role">{role}</span>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>
//                         ✦ Upgrade Plan
//                       </Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>

//                       {(isBrand || isAdmin) && (
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📢 Post Campaign</Link>
//                       )}
//                       {/* ✅ Browse in dropdown for brand too */}
//                       {isBrand && (
//                         <Link href="/browse" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>🔍 Browse Creators</Link>
//                       )}

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
//                 <Link href="/join" className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {/* ── MOBILE MENU ── */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isInfluencer && (
//               <Link href="/discovery" className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>🔍 Discover</Link>
//             )}
//             {(isBrand || isAdmin) && (
//               <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>📋 Campaigns</Link>
//             )}
//             {isBrand && (
//               <Link href="/browse" className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>👥 Browse Creators</Link>
//             )}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>💬 Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`}>
//               🔔 Notifications
//               {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount}</span>}
//             </Link>
//             <Link href="/upgrade" className="nav-mobile-upgrade">✦ Upgrade Plan</Link>
//             <Link href="/settings" className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>⚙️ Settings</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>👤 Profile</Link>
//             <button
//               className="nav-mobile-link"
//               style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%" }}
//               onClick={handleLogout}
//             >
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);
//       fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//         .then((res) => res.json())
//         .then((data) => { if (data.success && data.profile) setProfile(data.profile); })
//         .catch(() => {});
//       fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
//         .then((res) => res.json())
//         .then((data) => {
//           const notifs = data.notifications || data.data || [];
//           setUnreadCount(notifs.filter((n: any) => !n.read).length);
//         })
//         .catch(() => {});
//     } else {
//       setUser(null);
//       setProfile(null);
//     }
//   }, [pathname]);

//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role = user?.role?.toLowerCase();
//   const isBrand = role === "brand";
//   const isAdmin = role === "admin";
//   const isInfluencer = role === "influencer";
//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");
//   const displayImage = profile?.profileImage || user?.profileImage || null;
//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'DM Sans', sans-serif; }
//         .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: #4f46e5; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 13px; }
//         .nav-logo-text { font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 17px; color: #4f46e5; white-space: nowrap; }
//         @media(max-width:480px){ .nav-logo-text{ font-size:15px; } }

//         .nav-links { display: flex; align-items: center; gap: 32px; }
//         @media(max-width:768px){ .nav-links{ display:none; } }
//         .nav-link { font-size: 14px; font-weight: 500; color: #888; text-decoration: none; padding: 4px 0; border-bottom: 2px solid transparent; transition: all 0.2s; }
//         .nav-link:hover { color: #111; }
//         .nav-link.active { color: #111; border-bottom-color: #111; }

//         .nav-right { display: flex; align-items: center; gap: 8px; }

//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #d0d0d0; background: #fafafa; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 500; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width:480px){ .nav-avatar-name{ display:none; } }

//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 500; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-item.upgrade-dd { background: linear-gradient(135deg,#ede9fe,#e0e7ff); color: #4f46e5; font-weight: 600; }
//         .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg,#ddd6fe,#c7d2fe); }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-user { padding: 10px 12px 14px; }
//         .nav-dd-username { font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600; color: #111; margin: 0 0 2px; }
//         .nav-dd-role { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }

//         .nav-login { font-size: 13px; font-weight: 500; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 600; color: #fff; background: #111; padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: background 0.2s; }
//         .nav-join:hover { background: #333; }

//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width:768px){ .nav-hamburger{ display:flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-link { font-size: 15px; font-weight: 500; color: #555; text-decoration: none; padding: 12px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 8px; }
//         .nav-mobile-link:hover { color: #111; }
//         .nav-mobile-link.active { color: #111; }
//         .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 15px; font-weight: 600; color: #4f46e5; text-decoration: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS - desktop only */}
//           {user && (
//             <div className="nav-links">
//               {isInfluencer && (
//                 <Link href="/discovery" className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
//               )}
//               {(isBrand || isAdmin) && (
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
//               )}
//               <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
//               <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`}>
//                 Notifications {unreadCount > 0 && <span style={{background:"#ef4444",color:"#fff",borderRadius:"100px",fontSize:"10px",padding:"1px 6px",marginLeft:"4px"}}>{unreadCount}</span>}
//               </Link>
//             </div>
//           )}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 {/* PROFILE DROPDOWN — Upgrade + Settings inside */}
//                 <div style={{position:"relative"}} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <p className="nav-dd-role">{role}</p>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       {/* ✅ Upgrade - inside dropdown */}
//                       <Link href="/upgrade" className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>
//                         ✦ Upgrade Plan
//                       </Link>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>✏️ Edit Profile</Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>👤 View Profile</Link>

//                       {/* ✅ Settings - inside dropdown */}
//                       <Link href="/settings" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>⚙️ Settings</Link>

//                       {(isBrand || isAdmin) && (
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>📢 Post Campaign</Link>
//                       )}
//                       <div className="nav-dd-sep" />
//                       <button className="nav-dd-item danger" onClick={handleLogout}>🚪 Logout</button>
//                     </div>
//                   )}
//                 </div>

//                 {/* HAMBURGER - mobile only */}
//                 <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
//                   <span /><span /><span />
//                 </button>
//               </>
//             ) : (
//               <>
//                 <Link href="/login" className="nav-login">Login</Link>
//                 <Link href="/join" className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isInfluencer && (
//               <Link href="/discovery" className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>🔍 Discover</Link>
//             )}
//             {(isBrand || isAdmin) && (
//               <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>📋 Campaigns</Link>
//             )}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>💬 Messages</Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`}>
//               🔔 Notifications {unreadCount > 0 && <span style={{background:"#ef4444",color:"#fff",borderRadius:"100px",fontSize:"10px",padding:"1px 6px"}}>{unreadCount}</span>}
//             </Link>
//             {/* ✅ Upgrade + Settings in mobile menu too */}
//             <Link href="/upgrade" className="nav-mobile-upgrade">✦ Upgrade Plan</Link>
//             <Link href="/settings" className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>⚙️ Settings</Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>👤 Profile</Link>
//             <button
//               className="nav-mobile-link"
//               style={{color:"#ef4444",border:"none",background:"none",cursor:"pointer",textAlign:"left",width:"100%"}}
//               onClick={handleLogout}
//             >
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }


// "use client";

// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";
// import { useRouter, usePathname } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function Navbar() {
//   const pathname = usePathname();
//   const router = useRouter();
//   const [user, setUser] = useState<any>(null);
//   const [profile, setProfile] = useState<any>(null);
//   const [dropdownOpen, setDropdownOpen] = useState(false);
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
//   const [unreadCount, setUnreadCount] = useState(0);
//   const dropdownRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     if (typeof window === "undefined") return;
//     const storedUser = localStorage.getItem("cb_user");
//     const parsedUser = JSON.parse(storedUser || "{}");
//     const token = parsedUser.token || localStorage.getItem("token");

//     if (storedUser && token) {
//       setUser(parsedUser);

//       // ✅ Profile fetch
//       fetch(`${API_BASE}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       })
//         .then((res) => res.json())
//         .then((data) => {
//           if (data.success && data.profile) setProfile(data.profile);
//         })
//         .catch(() => {});

//       // ✅ Unread notifications count
//       fetch(`${API_BASE}/notification`, {
//         headers: { Authorization: `Bearer ${token}` },
//       })
//         .then((res) => res.json())
//         .then((data) => {
//           const notifs = data.notifications || data.data || [];
//           setUnreadCount(notifs.filter((n: any) => !n.read).length);
//         })
//         .catch(() => {});

//     } else {
//       setUser(null);
//       setProfile(null);
//     }
//   }, [pathname]);

//   // Close dropdown on outside click
//   useEffect(() => {
//     const handleClickOutside = (e: any) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
//         setDropdownOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   // Close mobile menu on route change
//   useEffect(() => {
//     setMobileMenuOpen(false);
//     setDropdownOpen(false);
//   }, [pathname]);

//   const handleLogout = () => {
//     localStorage.removeItem("cb_user");
//     localStorage.removeItem("token");
//     localStorage.removeItem("appliedCampaigns");
//     setUser(null);
//     setProfile(null);
//     router.push("/");
//   };

//   const role = user?.role?.toLowerCase();
//   const isBrand = role === "brand";
//   const isAdmin = role === "admin";
//   const isInfluencer = role === "influencer";

//   const displayName = isBrand
//     ? (profile?.companyName || user?.companyName || user?.name || "User")
//     : (profile?.name || user?.name || "User");

//   // ✅ Regular <img> use karo — next/image SVG URLs block karta hai
//   const displayImage = profile?.profileImage || user?.profileImage || null;

//   const isActive = (path: string) => pathname?.startsWith(path);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

//         .nav { position: sticky; top: 0; z-index: 9999; background: #fff; border-bottom: 1px solid #ebebeb; font-family: 'DM Sans', sans-serif; }
//         .nav-inner { max-width: 1200px; margin: 0 auto; padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }

//         /* LOGO */
//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
//         .nav-logo-icon { width: 36px; height: 36px; background: #4f46e5; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-family: 'Syne', sans-serif; font-weight: 800; font-size: 13px; letter-spacing: 0; }
//         .nav-logo-text { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 17px; color: #4f46e5; white-space: nowrap; }
//         @media(max-width: 480px) { .nav-logo-text { display: block; font-size: 15px; } }

//         /* CENTER LINKS */
//         .nav-links { display: flex; align-items: center; gap: 32px; }
//         @media(max-width: 768px) { .nav-links { display: none; } }
//         .nav-link { font-size: 14px; font-weight: 600; color: #888; text-decoration: none; padding: 4px 0; border-bottom: 2px solid transparent; transition: all 0.2s; }
//         .nav-link:hover { color: #111; }
//         .nav-link.active { color: #111; border-bottom-color: #111; }

//         /* RIGHT */
//         .nav-right { display: flex; align-items: center; gap: 8px; }

//         /* ICON BUTTONS */
//         .nav-icon-btn { position: relative; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #666; text-decoration: none; transition: all 0.2s; border: none; background: none; cursor: pointer; }
//         .nav-icon-btn:hover { background: #f5f5f0; color: #111; }
//         .nav-icon-btn.active { background: #f5f5f0; color: #111; }
//         .nav-badge { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; background: #ef4444; border-radius: 50%; border: 2px solid #fff; }
//         .nav-badge-num { position: absolute; top: 4px; right: 4px; background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; font-weight: 700; padding: 1px 4px; min-width: 16px; text-align: center; border: 1.5px solid #fff; line-height: 1.4; }

//         /* AVATAR */
//         .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
//         .nav-avatar-btn:hover { border-color: #d0d0d0; background: #fafafa; }
//         .nav-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 14px; overflow: hidden; flex-shrink: 0; }
//         .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
//         .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
//         @media(max-width: 480px) { .nav-avatar-name { display: none; } }

//         /* DROPDOWN */
//         .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 200px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
//         @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
//         .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 10px; font-size: 13px; font-weight: 500; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; }
//         .nav-dd-item:hover { background: #f5f5f0; color: #111; }
//         .nav-dd-item.danger { color: #ef4444; }
//         .nav-dd-item.danger:hover { background: #fff5f5; }
//         .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
//         .nav-dd-user { padding: 10px 12px 14px; }
//         .nav-dd-username { font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #111; margin: 0 0 2px; }
//         .nav-dd-role { font-size: 11px; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; margin: 0; }

//         /* AUTH BUTTONS */
//         .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
//         .nav-login:hover { color: #111; background: #f5f5f0; }
//         .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: #111; padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: background 0.2s; font-family: 'Syne', sans-serif; }
//         .nav-join:hover { background: #333; }

//         /* MOBILE MENU BUTTON */
//         .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
//         @media(max-width: 768px) { .nav-hamburger { display: flex; } }
//         .nav-hamburger:hover { background: #f5f5f0; }
//         .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; transition: all 0.2s; }

//         /* MOBILE MENU */
//         .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; }
//         .nav-mobile.open { display: flex; }
//         .nav-mobile-link { font-size: 15px; font-weight: 600; color: #555; text-decoration: none; padding: 12px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 8px; }
//         .nav-mobile-link:hover { color: #111; }
//         .nav-mobile-link.active { color: #111; }
//         .nav-mobile-link:last-child { border-bottom: none; }
//       `}</style>

//       <nav className="nav">
//         <div className="nav-inner">

//           {/* LOGO */}
//           <Link href="/" className="nav-logo">
//             <div className="nav-logo-icon">CB</div>
//             <span className="nav-logo-text">CreatorBridge</span>
//           </Link>

//           {/* CENTER LINKS — desktop */}
//           {user && (
//             <div className="nav-links">
//               {isInfluencer && (
//                 <Link href="/discovery" className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>
//                   Discover
//                 </Link>
//               )}
//               {(isBrand || isAdmin) && (
//                 <Link href="/campaigns" className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>
//                   Campaigns
//                 </Link>
//               )}
//               <Link href="/messages" className={`nav-link ${isActive("/messages") ? "active" : ""}`}>
//                 Messages
//               </Link>
//               <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`}>
//                 Notifications {unreadCount > 0 && <span style={{background:"#ef4444",color:"#fff",borderRadius:"100px",fontSize:"10px",padding:"1px 6px",marginLeft:"4px"}}>{unreadCount}</span>}
//               </Link>
//             </div>
//           )}

//           {/* RIGHT */}
//           <div className="nav-right">
//             {user ? (
//               <>
//                 {/* Icons — mobile only */}
//                 <Link href="/messages" className={`nav-icon-btn ${isActive("/messages") ? "active" : ""}`} style={{display:"none"}}
//                   aria-label="Messages">
//                   <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
//                   </svg>
//                 </Link>

//                 <Link href="/notification" className={`nav-icon-btn ${isActive("/notification") ? "active" : ""}`}
//                   aria-label="Notifications" style={{display:"none"}}>
//                   <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
//                     <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h11z" />
//                   </svg>
//                   {unreadCount > 0 && <span className="nav-badge-num">{unreadCount}</span>}
//                 </Link>

//                 {/* PROFILE DROPDOWN */}
//                 <div style={{position:"relative"}} ref={dropdownRef}>
//                   <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
//                     <div className="nav-avatar">
//                       {displayImage ? (
//                         // ✅ Regular <img> — next/image SVG block nahi karta
//                         <img
//                           src={displayImage}
//                           alt={displayName}
//                           onError={(e) => {
//                             (e.target as HTMLImageElement).style.display = "none";
//                           }}
//                         />
//                       ) : (
//                         <span>{displayName.charAt(0).toUpperCase()}</span>
//                       )}
//                     </div>
//                     <span className="nav-avatar-name">{displayName}</span>
//                     <svg width="12" height="12" fill="none" stroke="#aaa" viewBox="0 0 24 24">
//                       <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
//                     </svg>
//                   </button>

//                   {dropdownOpen && (
//                     <div className="nav-dropdown">
//                       <div className="nav-dd-user">
//                         <p className="nav-dd-username">{displayName}</p>
//                         <p className="nav-dd-role">{role}</p>
//                       </div>
//                       <div className="nav-dd-sep" />

//                       <Link href="/my-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>
//                         ✏️ Edit Profile
//                       </Link>
//                       <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>
//                         👤 View Profile
//                       </Link>
//                       {(isBrand || isAdmin) && (
//                         <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>
//                           📢 Post Campaign
//                         </Link>
//                       )}

//                       <div className="nav-dd-sep" />

//                       <button className="nav-dd-item danger" onClick={handleLogout}>
//                         🚪 Logout
//                       </button>
//                     </div>
//                   )}
//                 </div>

//                 {/* HAMBURGER — mobile */}
//                 <button className="nav-hamburger" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Menu">
//                   <span />
//                   <span />
//                   <span />
//                 </button>
//               </>
//             ) : (
//               <>
//                 <Link href="/login" className="nav-login">Login</Link>
//                 <Link href="/join" className="nav-join">Join</Link>
//               </>
//             )}
//           </div>
//         </div>

//         {/* MOBILE MENU */}
//         {user && (
//           <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>
//             {isInfluencer && (
//               <Link href="/discovery" className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>
//                 🔍 Discover
//               </Link>
//             )}
//             {(isBrand || isAdmin) && (
//               <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>
//                 📋 Campaigns
//               </Link>
//             )}
//             <Link href="/messages" className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>
//               💬 Messages
//             </Link>
//             <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`}>
//               🔔 Notifications {unreadCount > 0 && <span style={{background:"#ef4444",color:"#fff",borderRadius:"100px",fontSize:"10px",padding:"1px 6px"}}>{unreadCount}</span>}
//             </Link>
//             <Link href="/my-profile" className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>
//               👤 Profile
//             </Link>
//             <button className="nav-mobile-link danger" style={{color:"#ef4444",border:"none",background:"none",cursor:"pointer",textAlign:"left",width:"100%"}} onClick={handleLogout}>
//               🚪 Logout
//             </button>
//           </div>
//         )}
//       </nav>
//     </>
//   );
// }



