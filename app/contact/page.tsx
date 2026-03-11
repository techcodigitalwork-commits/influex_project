"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function ContactUnlockPage() {
  const router = useRouter();
  const [token, setToken]     = useState("");
  const [role, setRole]       = useState("");
  const [myId, setMyId]       = useState("");
  const [coins, setCoins]     = useState(0);
  const [creators, setCreators] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");
  const [unlocked, setUnlocked] = useState<{[key: string]: { phone:string; instagram:string; email:string; unlockedAt:string }}>({});
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [selected, setSelected]   = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

  const UNLOCK_COST = 10; // coins per unlock

  const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    const t = p.token || "";
    const id = p.user?._id || p._id || p.id || "";
    setToken(t); setMyId(id);
    setRole(p.role?.toLowerCase() || "");
    setCoins(p.bits || p.coins || 0);
    // Load persisted unlocks
    const saved = localStorage.getItem(`unlocked_contacts_${id}`);
    if (saved) setUnlocked(JSON.parse(saved));
    fetchCreators(t);
  }, []);

  const fetchCreators = async (t: string) => {
    try {
      const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setCreators(data.data || data.influencers || data || []);
    } catch { setCreators([]); }
    finally { setLoading(false); }
  };

  const handleUnlock = async (creator: any) => {
    const cid = creator._id || creator.id;
    if (coins < UNLOCK_COST) { showToast("Not enough coins! Buy more coins.", "error"); return; }
    setUnlocking(cid);
    try {
      const res = await fetch(`${API}/contact/unlock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: cid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unlock");
      // Save unlock locally + update coins
      const newUnlocked: {[key: string]: { phone:string; instagram:string; email:string; unlockedAt:string }} = {
        ...unlocked,
        [cid]: {
          phone:     data.phone     || creator.phone     || data.contact?.phone || "",
          instagram: data.instagram || creator.instagram || data.contact?.instagram || "",
          email:     data.email     || creator.email     || data.contact?.email || "",
          unlockedAt: new Date().toISOString(),
        },
      };
      setUnlocked(newUnlocked);
      localStorage.setItem(`unlocked_contacts_${myId}`, JSON.stringify(newUnlocked));
      const newCoins = coins - UNLOCK_COST;
      setCoins(newCoins);
      // Update cb_user coins
      const raw = localStorage.getItem("cb_user");
      if (raw) {
        const p = JSON.parse(raw);
        p.bits = newCoins; p.coins = newCoins;
        localStorage.setItem("cb_user", JSON.stringify(p));
      }
      showToast(`✅ Contact unlocked! ${UNLOCK_COST} coins used.`, "success");
      if (selected?._id === cid) setSelected({ ...selected, _unlocked: newUnlocked[cid as string] as any });
    } catch (err: any) {
      showToast(err.message || "Unlock failed", "error");
    } finally { setUnlocking(null); }
  };

  const blurText = (text: string) => {
    if (!text) return "—";
    const half = Math.ceil(text.length / 2);
    return text.slice(0, half) + "●".repeat(text.length - half);
  };

  const filtered = creators.filter(c => {
    const name = (c.name || c.username || "").toLowerCase();
    const cat  = (c.category || c.niche || "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || cat.includes(search.toLowerCase());
    const isUnlocked  = !!unlocked[c._id || c.id];
    if (filter === "unlocked") return matchSearch && isUnlocked;
    if (filter === "locked")   return matchSearch && !isUnlocked;
    return matchSearch;
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes shine   { from{left:-100%}to{left:200%} }

        .cu { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }

        /* HEADER */
        .cu-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
        @media(max-width:600px){ .cu-header{ padding:14px 16px; } }
        .cu-title { font-size: 22px; font-weight: 800; color: #111; }
        .cu-sub   { font-size: 13px; color: #aaa; margin-top: 2px; }
        .cu-coins { display: flex; align-items: center; gap: 8px; background: linear-gradient(135deg,#fffbeb,#fef3c7); border: 1.5px solid #fde68a; border-radius: 14px; padding: 10px 16px; }
        .cu-coins-icon { font-size: 20px; }
        .cu-coins-val  { font-size: 20px; font-weight: 800; color: #92400e; }
        .cu-coins-lbl  { font-size: 12px; color: #b45309; font-weight: 600; }
        .cu-coins-cost { font-size: 11px; color: #d97706; margin-top: 1px; }

        /* SEARCH BAR */
        .cu-toolbar { padding: 16px 32px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        @media(max-width:600px){ .cu-toolbar{ padding:12px 16px; gap:8px; } }
        .cu-search { flex: 1; min-width: 200px; position: relative; }
        .cu-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 15px; pointer-events: none; }
        .cu-search-input { width: 100%; padding: 10px 14px 10px 36px; border-radius: 12px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; }
        .cu-search-input:focus { border-color: #4f46e5; }
        .cu-filter-btns { display: flex; gap: 6px; }
        .cu-filter-btn { padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1.5px solid #ebebeb; background: #fff; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; transition: all 0.15s; }
        .cu-filter-btn.active { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }

        /* STATS */
        .cu-stats { display: flex; gap: 12px; padding: 0 32px 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .cu-stats{ padding: 0 16px 12px; gap:10px; } }
        .cu-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .cu-stat-val { font-size: 20px; font-weight: 800; color: #111; }
        .cu-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

        /* GRID */
        .cu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; padding: 0 32px 40px; }
        @media(max-width:768px){ .cu-grid{ grid-template-columns:1fr; padding: 0 16px 28px; gap:10px; } }

        /* CARD */
        .cu-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 20px; transition: all 0.22s; animation: fadeUp 0.3s ease both; position: relative; overflow: hidden; }
        .cu-card.is-unlocked { border-color: #bbf7d0; }
        .cu-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.07); transform: translateY(-2px); }
        .cu-card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
        .cu-avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .cu-avatar-fallback { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 800; flex-shrink: 0; }
        .cu-name    { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
        .cu-category{ font-size: 12px; color: #9ca3af; font-weight: 500; }
        .cu-followers{ font-size: 13px; color: #555; font-weight: 600; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

        /* UNLOCK BADGE */
        .cu-unlocked-badge { position: absolute; top: 14px; right: 14px; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; }
        .cu-locked-badge   { position: absolute; top: 14px; right: 14px; background: #f5f5f5; color: #999; border: 1px solid #e0e0e0; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px; }

        /* CONTACT INFO */
        .cu-contact-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: #f9f9f8; margin-bottom: 6px; border: 1px solid #f0f0f0; }
        .cu-contact-icon { font-size: 16px; flex-shrink: 0; }
        .cu-contact-val  { font-size: 13px; font-weight: 600; color: #111; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cu-contact-blurred { font-size: 13px; font-weight: 600; color: #bbb; filter: blur(5px); user-select: none; flex: 1; }
        .cu-contact-copy { background: none; border: none; cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 6px; transition: background 0.15s; }
        .cu-contact-copy:hover { background: #ebebeb; }

        /* UNLOCK BTN */
        .cu-unlock-btn { width: 100%; padding: 11px; border-radius: 12px; background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 3px 10px rgba(245,158,11,0.25); position: relative; overflow: hidden; }
        .cu-unlock-btn::after { content:""; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); animation:shine 2s infinite; }
        .cu-unlock-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(245,158,11,0.35); }
        .cu-unlock-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cu-view-btn { width: 100%; padding: 11px; border-radius: 12px; background: #eef2ff; color: #4f46e5; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; margin-top: 10px; }
        .cu-view-btn:hover { background: #e0e7ff; }

        /* EMPTY */
        .cu-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px; text-align:center; margin:0 32px; background:#fff; border-radius:18px; border:1.5px dashed #e0e0e0; }

        /* LOW COINS BANNER */
        .cu-low-coins { margin: 0 32px 16px; padding: 14px 18px; background: linear-gradient(135deg,#fff7ed,#fffbeb); border: 1.5px solid #fde68a; border-radius: 14px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        @media(max-width:600px){ .cu-low-coins{ margin: 0 16px 12px; } }
        .cu-low-coins-text { flex: 1; font-size: 13px; color: #92400e; font-weight: 600; }
        .cu-buy-btn { padding: 8px 16px; background: linear-gradient(135deg,#f59e0b,#f97316); color: #fff; border-radius: 10px; font-size: 13px; font-weight: 700; border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; white-space: nowrap; }

        /* DETAIL MODAL */
        .dm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.2s; }
        .dm-box { background:#fff; border-radius:24px; max-width:440px; width:100%; max-height:90vh; overflow-y:auto; animation:slideUp 0.25s ease; }
        .dm-head { background:linear-gradient(135deg,#1e1b4b,#4f46e5); padding:24px 24px 20px; border-radius:24px 24px 0 0; position:relative; }
        .dm-close { position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .dm-av { width:64px; height:64px; border-radius:50%; border:3px solid rgba(255,255,255,0.3); object-fit:cover; margin-bottom:10px; }
        .dm-av-fb { width:64px; height:64px; border-radius:50%; border:3px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; color:#fff; font-size:26px; font-weight:800; margin-bottom:10px; }
        .dm-name { font-size:22px; font-weight:800; color:#fff; margin-bottom:4px; }
        .dm-cat  { font-size:13px; color:rgba(255,255,255,0.7); }
        .dm-body { padding:24px; }
        .dm-section { font-size:11px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.07em; margin:16px 0 10px; }
        .dm-section:first-child { margin-top:0; }
        .dm-info-row { display:flex; justify-content:space-between; padding:9px 0; border-bottom:1px solid #f5f5f5; font-size:14px; }
        .dm-info-row:last-child { border-bottom:none; }
        .dm-info-lbl { color:#888; font-weight:500; }
        .dm-info-val { font-weight:700; color:#111; }
        .dm-contact-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px; background:#f9f9f8; margin-bottom:8px; border:1px solid #f0f0f0; }
        .dm-contact-icon { font-size:18px; }
        .dm-contact-val  { font-size:14px; font-weight:600; color:#111; flex:1; }
        .dm-contact-blurred { font-size:14px; font-weight:600; color:#ddd; filter:blur(6px); user-select:none; flex:1; }
        .dm-copy-btn { background:#eef2ff; border:none; border-radius:8px; padding:5px 10px; color:#4f46e5; font-size:12px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; white-space:nowrap; }
        .dm-unlock-btn { width:100%; padding:14px; border-radius:14px; background:linear-gradient(135deg,#f59e0b,#f97316); color:#fff; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; margin-top:16px; position:relative; overflow:hidden; }
        .dm-unlock-btn::after { content:""; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent); animation:shine 2s infinite; }
        .dm-unlock-btn:disabled { opacity:0.6; cursor:not-allowed; }

        .spinner { width:28px; height:28px; border:3px solid #e0e0e0; border-top-color:#4f46e5; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; display:block; }
        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:99999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#111; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
        .toast.warn    { background:#f59e0b; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* DETAIL MODAL */}
      {selected && (() => {
        const cid = selected._id || selected.id;
        const uc  = unlocked[cid];
        return (
          <div className="dm-overlay" onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <div className="dm-box">
              <div className="dm-head">
                <button className="dm-close" onClick={() => setSelected(null)}>✕</button>
                {selected.profileImage
                  ? <img src={selected.profileImage} className="dm-av" alt="" />
                  : <div className="dm-av-fb">{(selected.name||"C").charAt(0).toUpperCase()}</div>}
                <div className="dm-name">{selected.name || selected.username || "Creator"}</div>
                <div className="dm-cat">{selected.category || selected.niche || "Creator"}</div>
              </div>
              <div className="dm-body">
                <div className="dm-section">Profile Info</div>
                <div className="dm-info-row"><span className="dm-info-lbl">Followers</span><span className="dm-info-val">{selected.followers ? Number(selected.followers).toLocaleString() : "—"}</span></div>
                {selected.location && <div className="dm-info-row"><span className="dm-info-lbl">Location</span><span className="dm-info-val">{selected.location}</span></div>}
                {selected.bio && <div style={{fontSize:13,color:"#555",lineHeight:1.65,marginTop:10,padding:"10px 12px",background:"#f9f9f8",borderRadius:10}}>{selected.bio}</div>}

                <div className="dm-section">Contact Details</div>
                {/* Phone */}
                <div className="dm-contact-row">
                  <span className="dm-contact-icon">📱</span>
                  {uc?.phone
                    ? <span className="dm-contact-val">{uc.phone}</span>
                    : <span className="dm-contact-blurred">{selected.phone ? blurText(selected.phone) : "●●●●●●●●●●"}</span>
                  }
                  {uc?.phone && <button className="dm-copy-btn" onClick={() => { navigator.clipboard.writeText(uc.phone); showToast("Phone copied!", "success"); }}>Copy</button>}
                </div>
                {/* Instagram */}
                <div className="dm-contact-row">
                  <span className="dm-contact-icon">📸</span>
                  {uc?.instagram
                    ? <span className="dm-contact-val">{uc.instagram}</span>
                    : <span className="dm-contact-blurred">instagram.com/●●●●●</span>
                  }
                  {uc?.instagram && <button className="dm-copy-btn" onClick={() => { navigator.clipboard.writeText(uc.instagram); showToast("Instagram copied!", "success"); }}>Copy</button>}
                </div>
                {/* Email */}
                <div className="dm-contact-row">
                  <span className="dm-contact-icon">✉️</span>
                  {uc?.email
                    ? <span className="dm-contact-val">{uc.email}</span>
                    : <span className="dm-contact-blurred">●●●●@●●●●.com</span>
                  }
                  {uc?.email && <button className="dm-copy-btn" onClick={() => { navigator.clipboard.writeText(uc.email); showToast("Email copied!", "success"); }}>Copy</button>}
                </div>

                {uc ? (
                  <div style={{marginTop:16,textAlign:"center",padding:"12px",background:"#f0fdf4",borderRadius:12,color:"#16a34a",fontWeight:700,fontSize:13,border:"1.5px solid #bbf7d0"}}>
                    ✅ Contact unlocked on {new Date(uc.unlockedAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                ) : (
                  <button className="dm-unlock-btn" disabled={unlocking === cid} onClick={() => handleUnlock(selected)}>
                    {unlocking === cid ? "Unlocking..." : `🔓 Unlock Contact — ${UNLOCK_COST} Coins`}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="cu">
        <div className="cu-header">
          <div>
            <div className="cu-title">Contact Unlock</div>
            <div className="cu-sub">Unlock creator contacts using coins</div>
          </div>
          <div className="cu-coins">
            <div className="cu-coins-icon">🪙</div>
            <div>
              <div className="cu-coins-val">{coins}</div>
              <div className="cu-coins-lbl">Coins</div>
              <div className="cu-coins-cost">{UNLOCK_COST} coins per unlock</div>
            </div>
          </div>
        </div>

        {/* LOW COINS WARNING */}
        {coins < UNLOCK_COST && (
          <div className="cu-low-coins">
            <span style={{fontSize:20}}>⚠️</span>
            <div className="cu-low-coins-text">
              You have {coins} coin{coins !== 1 ? "s" : ""}. You need at least {UNLOCK_COST} coins to unlock a contact.
            </div>
            <button className="cu-buy-btn" onClick={() => router.push("/upgrade")}>Buy Coins</button>
          </div>
        )}

        {/* TOOLBAR */}
        <div className="cu-toolbar">
          <div className="cu-search">
            <span className="cu-search-icon">🔍</span>
            <input className="cu-search-input" placeholder="Search by name or category..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="cu-filter-btns">
            {["all","unlocked","locked"].map(f => (
              <button key={f} className={`cu-filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "unlocked" ? "✅ Unlocked" : "🔒 Locked"}
              </button>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="cu-stats">
          <div className="cu-stat"><span style={{fontSize:18}}>👥</span><div><div className="cu-stat-val">{creators.length}</div><div className="cu-stat-lbl">Creators</div></div></div>
          <div className="cu-stat"><span style={{fontSize:18}}>✅</span><div><div className="cu-stat-val">{Object.keys(unlocked).length}</div><div className="cu-stat-lbl">Unlocked</div></div></div>
          <div className="cu-stat"><span style={{fontSize:18}}>🪙</span><div><div className="cu-stat-val">{coins}</div><div className="cu-stat-lbl">Coins Left</div></div></div>
          <div className="cu-stat"><span style={{fontSize:18}}>🔓</span><div><div className="cu-stat-val">{Math.floor(coins / UNLOCK_COST)}</div><div className="cu-stat-lbl">Can Unlock</div></div></div>
        </div>

        {/* GRID */}
        {loading ? <div className="spinner" /> :
          filtered.length === 0 ? (
            <div className="cu-empty">
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <div style={{fontSize:18,fontWeight:800,color:"#111",marginBottom:8}}>No creators found</div>
              <div style={{fontSize:14,color:"#aaa"}}>Try changing your search or filter</div>
            </div>
          ) : (
            <div className="cu-grid">
              {filtered.map((c, idx) => {
                const cid = c._id || c.id;
                const uc  = unlocked[cid];
                return (
                  <div key={cid} className={`cu-card ${uc ? "is-unlocked" : ""}`} style={{ animationDelay: `${idx * 0.04}s` }}>
                    {uc
                      ? <div className="cu-unlocked-badge">✅ Unlocked</div>
                      : <div className="cu-locked-badge"><span>🔒</span>{UNLOCK_COST} coins</div>
                    }

                    <div className="cu-card-top">
                      {c.profileImage
                        ? <img src={c.profileImage} className="cu-avatar" alt="" />
                        : <div className="cu-avatar-fallback">{(c.name||"C").charAt(0).toUpperCase()}</div>
                      }
                      <div style={{flex:1,paddingRight:72}}>
                        <div className="cu-name">{c.name || c.username || "Creator"}</div>
                        <div className="cu-category">{c.category || c.niche || "Creator"}</div>
                        <div className="cu-followers">
                          <span>👥</span> {c.followers ? Number(c.followers).toLocaleString() : "—"} followers
                        </div>
                      </div>
                    </div>

                    {/* CONTACT ROWS */}
                    <div className="cu-contact-row">
                      <span className="cu-contact-icon">📱</span>
                      {uc?.phone
                        ? <span className="cu-contact-val">{uc.phone}</span>
                        : <span className="cu-contact-blurred">{c.phone ? blurText(c.phone) : "●●●●●●●●●●"}</span>
                      }
                      {uc?.phone && (
                        <button className="cu-contact-copy" onClick={() => { navigator.clipboard.writeText(uc.phone); showToast("Copied!", "success"); }}>📋</button>
                      )}
                    </div>
                    <div className="cu-contact-row">
                      <span className="cu-contact-icon">📸</span>
                      {uc?.instagram
                        ? <span className="cu-contact-val">{uc.instagram}</span>
                        : <span className="cu-contact-blurred">instagram.com/●●●●●</span>
                      }
                      {uc?.instagram && (
                        <button className="cu-contact-copy" onClick={() => { navigator.clipboard.writeText(uc.instagram); showToast("Copied!", "success"); }}>📋</button>
                      )}
                    </div>

                    {uc
                      ? <button className="cu-view-btn" onClick={() => setSelected(c)}>👁 View Full Contact</button>
                      : <button className="cu-unlock-btn" disabled={unlocking === cid || coins < UNLOCK_COST}
                          onClick={() => handleUnlock(c)}>
                          {unlocking === cid ? "Unlocking..." : `🔓 Unlock — ${UNLOCK_COST} Coins`}
                        </button>
                    }
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </>
  );
}
