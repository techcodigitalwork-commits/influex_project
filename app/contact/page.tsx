"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function ContactPage() {
  const router = useRouter();
  const [token,     setToken]     = useState("");
  const [myId,      setMyId]      = useState("");
  const [bits,      setBits]      = useState(0);
  const [creators,  setCreators]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [unlocking, setUnlocking] = useState<string|null>(null);
  const [unlocked,  setUnlocked]  = useState<Record<string,string>>({}); // id → email
  const [toast,     setToast]     = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
  const [search,    setSearch]    = useState("");

  const showToast = (msg:string, type:"success"|"error"|"warn"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const u = JSON.parse(raw);
    if (u.role?.toLowerCase() !== "brand") { router.push("/dashboard"); return; }
    setToken(u.token);
    setMyId(u.user?._id || u._id || u.id || "");
    setBits(u.bits ?? 0);
    // Load previously unlocked contacts
    const saved = JSON.parse(localStorage.getItem(`unlocked_contacts_${u.user?._id||u._id||""}`) || "{}");
    setUnlocked(saved);
    fetchCreators(u.token);
  }, []);

  const fetchCreators = async (t:string) => {
    try {
      const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      setCreators(data.data || data.influencers || []);
    } catch { showToast("Failed to load creators", "error"); }
    finally { setLoading(false); }
  };

  const handleUnlock = async (creatorId:string) => {
    if (unlocked[creatorId]) return; // already unlocked
    if (bits < 50) {
      showToast("Not enough bits! You need 50 bits to unlock a contact.", "error");
      return;
    }
    setUnlocking(creatorId);
    try {
      const res  = await fetch(`${API}/contact/unlock`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ influencerId: creatorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Unlock failed");

      // Save email
      const email    = data.email || "";
      const newBits  = bits - 50;
      const newUnlocked = { ...unlocked, [creatorId]: email };

      setUnlocked(newUnlocked);
      setBits(newBits);

      // Persist to localStorage
      localStorage.setItem(`unlocked_contacts_${myId}`, JSON.stringify(newUnlocked));
      const stored = localStorage.getItem("cb_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: newBits }));
      }

      showToast(`✅ Contact unlocked! Email: ${email}`, "success");
    } catch(e:any) {
      showToast(e.message || "Unlock failed", "error");
    } finally {
      setUnlocking(null);
    }
  };

  const gName = (c:any) => c.name || c.username || "Creator";
  const gImg  = (c:any) => c.profileImage || c.avatar || null;
  const gCats = (c:any) => (Array.isArray(c.categories) ? c.categories : [c.categories]).filter(Boolean);
  const gCity = (c:any) => c.city || c.location || "";
  const cap   = (s:string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  const filtered = creators.filter(c => {
    const q = search.toLowerCase();
    return !q || gName(c).toLowerCase().includes(q) || gCity(c).toLowerCase().includes(q);
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        body{font-family:'Plus Jakarta Sans',sans-serif}
        .cp{background:#f7f7f5;min-height:100vh;padding-bottom:60px}

        /* HEADER */
        .cp-hdr{background:#fff;border-bottom:1px solid #efefef;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
        .cp-hdr-left{display:flex;align-items:center;gap:14px}
        .cp-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#555;text-decoration:none;font-family:inherit}
        .cp-back:hover{background:#ebebeb}
        .cp-title{font-size:20px;font-weight:800;color:#111}
        .cp-bits{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:12px;padding:8px 16px}
        .cp-bits-val{font-size:18px;font-weight:800;color:#d97706}
        .cp-bits-lbl{font-size:12px;color:#92400e;font-weight:600}

        /* SEARCH + INFO */
        .cp-top{max-width:760px;margin:24px auto;padding:0 20px;display:flex;flex-direction:column;gap:14px}
        .cp-search{width:100%;padding:12px 16px;border-radius:12px;border:1.5px solid #ebebeb;font-size:14px;font-family:inherit;outline:none;background:#fff}
        .cp-search:focus{border-color:#4f46e5}
        .cp-info{background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:14px 16px;font-size:13px;color:#4f46e5;font-weight:600;display:flex;align-items:center;gap:8px}

        /* GRID */
        .cp-grid{max-width:760px;margin:0 auto;padding:0 20px;display:flex;flex-direction:column;gap:12px;animation:fadeIn .3s ease}

        /* CREATOR ROW */
        .cr{background:#fff;border-radius:16px;border:1.5px solid #efefef;padding:16px 20px;display:flex;align-items:center;gap:14px;transition:all .2s}
        .cr:hover{border-color:#c7d2fe;box-shadow:0 4px 16px rgba(79,70,229,.08)}
        .cr-av{width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0}
        .cr-avph{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;flex-shrink:0}
        .cr-info{flex:1;min-width:0}
        .cr-name{font-size:15px;font-weight:700;color:#111;margin-bottom:3px}
        .cr-meta{font-size:12px;color:#aaa;display:flex;gap:8px;flex-wrap:wrap}
        .cr-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}

        /* UNLOCKED STATE */
        .cr-email{background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;color:#16a34a;display:flex;align-items:center;gap:6px;animation:fadeIn .3s ease}
        .cr-email-copy{background:none;border:none;cursor:pointer;font-size:14px;padding:0;color:#16a34a}
        .cr-email-copy:hover{color:#15803d}

        /* UNLOCK BUTTON */
        .cr-unlock-btn{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap}
        .cr-unlock-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.3)}
        .cr-unlock-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
        .cr-unlock-btn.no-bits{background:linear-gradient(135deg,#ef4444,#dc2626)}

        /* EMPTY */
        .cp-empty{text-align:center;padding:60px 20px;color:#aaa}
        .cp-empty-ico{font-size:40px;margin-bottom:12px}

        /* LOADING */
        .cp-load{display:flex;align-items:center;justify-content:center;padding:60px}
        .cp-spin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin .8s linear infinite}

        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
        .toast.success{background:#111;color:#fff}
        .toast.error{background:#ef4444;color:#fff}
        .toast.warn{background:#f59e0b;color:#fff}
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="cp">
        {/* HEADER */}
        <div className="cp-hdr">
          <div className="cp-hdr-left">
            <a href="/browse" className="cp-back">← Back</a>
            <div className="cp-title">🔓 Unlock Contacts</div>
          </div>
          <div className="cp-bits">
            <span className="cp-bits-val">{bits}</span>
            <span className="cp-bits-lbl">bits remaining</span>
          </div>
        </div>

        <div className="cp-top">
          <input
            className="cp-search"
            placeholder="🔍 Search by name or city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="cp-info">
            🪙 Each unlock costs <strong style={{margin:"0 4px"}}>50 bits</strong> — you get the creator's email address
          </div>
        </div>

        {loading ? (
          <div className="cp-load"><div className="cp-spin"/></div>
        ) : filtered.length === 0 ? (
          <div className="cp-empty">
            <div className="cp-empty-ico">👥</div>
            <div style={{fontWeight:700,color:"#555",marginBottom:6}}>No creators found</div>
            <div style={{fontSize:13}}>Try a different search</div>
          </div>
        ) : (
          <div className="cp-grid">
            {filtered.map(c => {
              const cid       = c._id;
              const email     = unlocked[cid];
              const isUnlocked= !!email;
              const isLoading = unlocking === cid;
              const noBits    = bits < 50;

              return (
                <div key={cid} className="cr">
                  {/* Avatar */}
                  {gImg(c)
                    ? <img src={gImg(c)} alt={gName(c)} className="cr-av"/>
                    : <div className="cr-avph">{gName(c).charAt(0).toUpperCase()}</div>
                  }

                  {/* Info */}
                  <div className="cr-info">
                    <div className="cr-name">{gName(c)}</div>
                    <div className="cr-meta">
                      {gCity(c) && <span>📍 {cap(gCity(c))}</span>}
                      {gCats(c)[0] && <span>✨ {cap(gCats(c)[0])}</span>}
                      {c.followers && Number(c.followers) > 0 && (
                        <span>👥 {Number(c.followers) >= 1000 ? `${(Number(c.followers)/1000).toFixed(0)}K` : c.followers}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="cr-right">
                    {isUnlocked ? (
                      <div className="cr-email">
                        ✉️ {email}
                        <button
                          className="cr-email-copy"
                          title="Copy email"
                          onClick={() => { navigator.clipboard.writeText(email); showToast("Email copied!", "success"); }}
                        >📋</button>
                      </div>
                    ) : (
                      <button
                        className={`cr-unlock-btn ${noBits ? "no-bits" : ""}`}
                        disabled={isLoading || noBits}
                        onClick={() => handleUnlock(cid)}
                      >
                        {isLoading ? "Unlocking..." : noBits ? "❌ Need 50 bits" : "🔓 Unlock (50 bits)"}
                      </button>
                    )}
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