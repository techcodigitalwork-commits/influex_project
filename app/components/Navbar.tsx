"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const API_BASE = "http://54.252.201.93:5000/api";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedUser = localStorage.getItem("cb_user");
    const parsedUser = JSON.parse(storedUser || "{}");
    const token = parsedUser.token || localStorage.getItem("token");

    if (storedUser && token) {
      setUser(parsedUser);

      fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.success && data.profile) setProfile(data.profile); })
        .catch(() => {});

      if (pathname?.startsWith("/notification")) {
        setUnreadCount(0);
        return;
      }

      fetch(`${API_BASE}/notification`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => {
          const notifs = data.notifications || data.data || [];
          const localRead: string[] = JSON.parse(localStorage.getItem("readNotifIds") || "[]");
          const unread = notifs.filter((n: any) => !n.read && !localRead.includes(n._id));
          setUnreadCount(unread.length);
        })
        .catch(() => {});
    } else {
      setUser(null);
      setProfile(null);
      setUnreadCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "notif_all_read") setUnreadCount(0);
    };
    window.addEventListener("storage", handleStorage);
    const wasRead = localStorage.getItem("notif_all_read");
    if (wasRead) setUnreadCount(0);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: any) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  }, [pathname]);

  if (pathname === "/" && user) return null;

  const handleLogout = () => {
    localStorage.removeItem("cb_user");
    localStorage.removeItem("token");
    localStorage.removeItem("appliedCampaigns");
    localStorage.removeItem("connectedCreators");
    localStorage.removeItem("readNotifIds");
    localStorage.removeItem("notif_all_read");
    setUser(null);
    setProfile(null);
    router.push("/");
  };

  const role         = user?.role?.toLowerCase();
  const isBrand      = role === "brand";
  const isAdmin      = role === "admin";
  const isInfluencer = role === "influencer";

  const displayName = isBrand
    ? (profile?.companyName || user?.companyName || user?.name || "User")
    : (profile?.name || user?.name || "User");

  const displayImage = profile?.profileImage || user?.profileImage || null;
  const isActive = (path: string) => pathname?.startsWith(path);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .nav {
          position: sticky; top: 0; z-index: 9999;
          background: #fff; border-bottom: 1px solid #ebebeb;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .nav-inner {
          max-width: 1280px; margin: 0 auto; padding: 0 24px;
          height: 64px; display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center; gap: 24px;
        }
        @media(max-width:900px){
          .nav-inner {
            grid-template-columns: auto auto;
            justify-content: space-between;
          }
          .nav-inner > *:nth-child(2) { display: none; }
        }

        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
        .nav-logo-icon { width: 36px; height: 36px; background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; flex-shrink: 0; }
        .nav-logo-text { font-weight: 800; font-size: 17px; color: #111; white-space: nowrap; }
        @media(max-width:480px){ .nav-logo-text{ font-size: 15px; } }

        .nav-links { display: flex; align-items: center; gap: 4px; justify-content: center; flex-wrap: nowrap; overflow-x: auto; }
        @media(max-width:900px){ .nav-links{ display: none; } }

        .nav-link { font-size: 13px; font-weight: 600; color: #777; text-decoration: none; padding: 6px 10px; border-radius: 9px; transition: all 0.18s; white-space: nowrap; display: flex; align-items: center; gap: 5px; }
        .nav-link:hover { color: #111; background: #f5f5f3; }
        .nav-link.active { color: #4f46e5; background: #eef2ff; }

        .nav-notif-badge { background: #ef4444; color: #fff; border-radius: 100px; font-size: 9px; padding: 1px 5px; font-weight: 800; display: inline-block; }

        /* MORE DROPDOWN */
        .nav-more-wrap { position: relative; }
        .nav-more-btn { font-size: 13px; font-weight: 600; color: #777; padding: 6px 10px; border-radius: 9px; border: none; background: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; display: flex; align-items: center; gap: 4px; transition: all 0.18s; }
        .nav-more-btn:hover { color: #111; background: #f5f5f3; }
        .nav-more-btn.has-active { color: #4f46e5; background: #eef2ff; }
        .nav-more-drop { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); background: #fff; border: 1.5px solid #ebebeb; border-radius: 14px; box-shadow: 0 8px 28px rgba(0,0,0,0.09); padding: 6px; min-width: 180px; z-index: 9999; animation: dropIn 0.15s ease; }
        .nav-more-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 9px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; white-space: nowrap; }
        .nav-more-item:hover { background: #f5f5f0; color: #111; }
        .nav-more-item.active { background: #eef2ff; color: #4f46e5; }

        .nav-right { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }

        .nav-avatar-btn { display: flex; align-items: center; gap: 8px; padding: 4px 10px 4px 4px; border-radius: 100px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; transition: all 0.2s; }
        .nav-avatar-btn:hover { border-color: #c7d2fe; background: #f8f7ff; }
        .nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; color: #fff; overflow: hidden; flex-shrink: 0; }
        .nav-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .nav-avatar-name { font-size: 13px; font-weight: 600; color: #111; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        @media(max-width:480px){ .nav-avatar-name{ display: none; } }

        .nav-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 230px; background: #fff; border-radius: 16px; border: 1.5px solid #ebebeb; box-shadow: 0 8px 30px rgba(0,0,0,0.1); padding: 8px; z-index: 9999; animation: dropIn 0.15s ease; }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        .nav-dd-user { padding: 10px 12px 12px; }
        .nav-dd-username { font-size: 14px; font-weight: 700; color: #111; margin: 0 0 4px; }
        .nav-dd-role { font-size: 10px; color: #fff; text-transform: uppercase; letter-spacing: 0.08em; margin: 0; display: inline-block; padding: 2px 8px; border-radius: 100px; background: linear-gradient(135deg, #4f46e5, #7c3aed); font-weight: 700; }
        .nav-dd-sep { height: 1px; background: #f0f0f0; margin: 6px 0; }
        .nav-dd-item { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; color: #444; text-decoration: none; transition: background 0.15s; cursor: pointer; border: none; background: none; width: 100%; text-align: left; font-family: 'Plus Jakarta Sans', sans-serif; }
        .nav-dd-item:hover { background: #f5f5f0; color: #111; }
        .nav-dd-item.danger { color: #ef4444; }
        .nav-dd-item.danger:hover { background: #fff5f5; }
        .nav-dd-item.upgrade-dd { background: linear-gradient(135deg, #ede9fe, #e0e7ff); color: #4f46e5; font-weight: 700; }
        .nav-dd-item.upgrade-dd:hover { background: linear-gradient(135deg, #ddd6fe, #c7d2fe); }

        .nav-login { font-size: 13px; font-weight: 600; color: #666; text-decoration: none; padding: 8px 14px; border-radius: 10px; transition: all 0.2s; }
        .nav-login:hover { color: #111; background: #f5f5f0; }
        .nav-join { font-size: 13px; font-weight: 700; color: #fff; background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 9px 18px; border-radius: 10px; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
        .nav-join:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

        .nav-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid #ebebeb; background: none; cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 5px; padding: 10px; transition: all 0.2s; }
        @media(max-width:900px){ .nav-hamburger{ display: flex; } }
        .nav-hamburger:hover { background: #f5f5f0; }
        .nav-hamburger span { display: block; width: 18px; height: 2px; background: #111; border-radius: 2px; }

        .nav-mobile { display: none; background: #fff; border-top: 1px solid #ebebeb; padding: 12px 24px 20px; flex-direction: column; gap: 4px; max-height: 85vh; overflow-y: auto; }
        .nav-mobile.open { display: flex; }
        .nav-mobile-section { font-size: 10px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.08em; padding: 14px 0 6px; }
        .nav-mobile-link { font-size: 14px; font-weight: 600; color: #555; text-decoration: none; padding: 11px 0; border-bottom: 1px solid #f5f5f5; transition: color 0.2s; display: flex; align-items: center; gap: 10px; }
        .nav-mobile-link:hover, .nav-mobile-link.active { color: #4f46e5; }
        .nav-mobile-upgrade { display: flex; align-items: center; gap: 8px; padding: 13px 0; border-bottom: 1px solid #f5f5f5; font-size: 14px; font-weight: 700; color: #4f46e5; text-decoration: none; }
      `}</style>

      <nav className="nav">
        <div className="nav-inner">

          {/* LOGO */}
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">CB</div>
            <span className="nav-logo-text">CreatorBridge</span>
          </Link>

          {/* CENTER LINKS */}
          {user ? (
            <div className="nav-links">

              {/* INFLUENCER LINKS */}
              {isInfluencer && (
                <>
                  <Link href="/discovery"    className={`nav-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>
                  <Link href="/apply"        className={`nav-link ${isActive("/apply") ? "active" : ""}`}>Applied</Link>
                  <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
                  <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
                  <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
                  <MoreDropdown items={[
                    { href:"/rewards",      label:"Rewards",       active: isActive("/rewards")      },
                    { href:"/notification", label:`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`, active: isActive("/notification") },
                  ]} onItemClick={(href) => { if(href==="/notification") setUnreadCount(0); }} />
                </>
              )}

              {/* BRAND LINKS */}
              {isBrand && (
                <>
                  <Link href="/browse"       className={`nav-link ${isActive("/browse") ? "active" : ""}`}>Discover</Link>
                  <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                  <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
                  <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
                  {/* MORE dropdown for brand extra pages */}
                  <MoreDropdown items={[
                    { href:"/messages",     label:"Messages",        active: isActive("/messages")     },
                    { href:"/invite",       label:"Invite Creators", active: isActive("/invite")       },
                    { href:"/contact",      label:"Unlock Contacts", active: isActive("/contact")      },
                    { href:"/smart-match",  label:"Smart Match",     active: isActive("/smart-match")  },
                    { href:"/notification", label:`Notifications${unreadCount > 0 ? ` (${unreadCount})` : ""}`, active: isActive("/notification") },
                  ]} onItemClick={(href) => { if(href==="/notification") setUnreadCount(0); }} />
                  <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                    Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                  </Link>
                </>
              )}

              {/* ADMIN LINKS */}
              {isAdmin && (
                <>
                  <Link href="/admin"        className={`nav-link ${isActive("/admin") ? "active" : ""}`}>Dashboard</Link>
                  <Link href="/campaigns"    className={`nav-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>
                  <Link href="/deals"        className={`nav-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
                  <Link href="/contracts"    className={`nav-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
                  <Link href="/messages"     className={`nav-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
                  <Link href="/notification" className={`nav-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
                    Notifications{unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                  </Link>
                </>
              )}

            </div>
          ) : <div />}

          {/* RIGHT */}
          <div className="nav-right">
            {user ? (
              <>
                <div style={{ position: "relative" }} ref={dropdownRef}>
                  <button className="nav-avatar-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
                    <div className="nav-avatar">
                      {displayImage ? (
                        <img src={displayImage} alt={displayName} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : (
                        <span>{displayName.charAt(0).toUpperCase()}</span>
                      )}
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
                      </div>
                      <div className="nav-dd-sep" />
                      <Link href="/upgrade"       className="nav-dd-item upgrade-dd" onClick={() => setDropdownOpen(false)}>Upgrade Plan</Link>
                      <div className="nav-dd-sep" />
                      <Link href="/my-profile"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Edit Profile</Link>
                      <Link href="/setup-profile" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>View Profile</Link>
                      {isInfluencer && (
                        <Link href="/rewards"     className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Rewards</Link>
                      )}
                      {isBrand && (
                        <>
                          <Link href="/invite"    className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Invite Creators</Link>
                          <Link href="/contact"   className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Unlock Contacts</Link>
                        </>
                      )}
                      {isAdmin && (
                        <Link href="/admin"       className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Admin Panel</Link>
                      )}
                      <Link href="/settings"      className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Settings</Link>
                      {(isBrand || isAdmin) && (
                        <Link href="/campaigns/post" className="nav-dd-item" onClick={() => setDropdownOpen(false)}>Post Campaign</Link>
                      )}
                      <div className="nav-dd-sep" />
                      <button className="nav-dd-item danger" onClick={handleLogout}>Logout</button>
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

        {/* MOBILE MENU */}
        {user && (
          <div className={`nav-mobile ${mobileMenuOpen ? "open" : ""}`}>

            {/* MAIN */}
            <div className="nav-mobile-section">Main</div>
            {isInfluencer && <Link href="/discovery"    className={`nav-mobile-link ${isActive("/discovery") ? "active" : ""}`}>Discover</Link>}
            {isBrand      && <Link href="/browse"       className={`nav-mobile-link ${isActive("/browse") ? "active" : ""}`}>Discover Creators</Link>}
            {(isBrand||isAdmin) && <Link href="/campaigns" className={`nav-mobile-link ${isActive("/campaigns") ? "active" : ""}`}>Campaigns</Link>}
            {isInfluencer && <Link href="/apply"        className={`nav-mobile-link ${isActive("/apply") ? "active" : ""}`}>Applied Campaigns</Link>}
            <Link href="/messages"     className={`nav-mobile-link ${isActive("/messages") ? "active" : ""}`}>Messages</Link>
            <Link href="/notification" className={`nav-mobile-link ${isActive("/notification") ? "active" : ""}`} onClick={() => setUnreadCount(0)}>
              Notifications {unreadCount > 0 && <span className="nav-notif-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </Link>

            {/* DEALS & CONTRACTS */}
            <div className="nav-mobile-section">Work</div>
            <Link href="/deals"        className={`nav-mobile-link ${isActive("/deals") ? "active" : ""}`}>Deals</Link>
            <Link href="/contracts"    className={`nav-mobile-link ${isActive("/contracts") ? "active" : ""}`}>Contracts</Link>
            {isInfluencer && <Link href="/rewards" className={`nav-mobile-link ${isActive("/rewards") ? "active" : ""}`}>Rewards</Link>}

            {/* BRAND ONLY */}
            {isBrand && (
              <>
                <div className="nav-mobile-section">Brand Tools</div>
                <Link href="/invite"   className={`nav-mobile-link ${isActive("/invite") ? "active" : ""}`}>Invite Creators</Link>
                <Link href="/contact"  className={`nav-mobile-link ${isActive("/contact") ? "active" : ""}`}>Unlock Contacts</Link>
                <Link href="/campaigns/post" className={`nav-mobile-link ${isActive("/campaigns/post") ? "active" : ""}`}>Post Campaign</Link>
              </>
            )}

            {/* ADMIN */}
            {isAdmin && (
              <>
                <div className="nav-mobile-section">Admin</div>
                <Link href="/admin"    className={`nav-mobile-link ${isActive("/admin") ? "active" : ""}`}>Admin Panel</Link>
              </>
            )}

            {/* ACCOUNT */}
            <div className="nav-mobile-section">Account</div>
            <Link href="/upgrade"      className="nav-mobile-upgrade">Upgrade Plan</Link>
            <Link href="/my-profile"   className={`nav-mobile-link ${isActive("/my-profile") ? "active" : ""}`}>Edit Profile</Link>
            <Link href="/settings"     className={`nav-mobile-link ${isActive("/settings") ? "active" : ""}`}>Settings</Link>
            <button
              className="nav-mobile-link"
              style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" }}
              onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </nav>
    </>
  );
}

// ── MORE dropdown component ──
function MoreDropdown({ items, onItemClick }: { items: { href: string; label: string; active: boolean }[]; onItemClick?: (href: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasActive = items.some(i => i.active);

  useEffect(() => {
    const handler = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="nav-more-wrap" ref={ref}>
      <button className={`nav-more-btn ${hasActive ? "has-active" : ""}`} onClick={() => setOpen(o => !o)}>
        More
        <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="nav-more-drop">
          {items.map(item => (
            <Link key={item.href} href={item.href} className={`nav-more-item ${item.active ? "active" : ""}`}
              onClick={() => { setOpen(false); onItemClick?.(item.href); }}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}




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



