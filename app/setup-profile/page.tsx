"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

const FOLLOWER_LABELS: Record<string, string> = {
  "1000":  "1K – 5K",
  "5000":  "5K – 10K",
  "10000": "10K – 20K",
  "30000": "20K – 50K",
  "50000": "50K – 75K",
  "99000": "99K+",
};

function getFollowerLabel(val: string | number) {
  return FOLLOWER_LABELS[String(val)] || (val ? `${Number(val).toLocaleString()}` : "—");
}

function capitalize(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function getCategories(cats: any): string[] {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.filter(Boolean);
  if (typeof cats === "string" && cats.trim()) return [cats];
  return [];
}

function getSubCategories(subs: any): string[] {
  if (!subs) return [];
  if (Array.isArray(subs)) return subs.filter(Boolean);
  if (typeof subs === "string" && subs.trim()) return [subs];
  return [];
}

function getInitial(name?: string): string {
  if (!name) return "U";
  return name.trim().charAt(0).toUpperCase();
}

type PortfolioPost = {
  _id: string;
  urls: string[];
  images: string[];
  caption: string;
  createdAt: string;
  user?: string;
  userId?: string;
};

// ─── Portfolio Section ─────────────────────────────────────
function PortfolioSection() {
  const [posts, setPosts]         = useState<PortfolioPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "reels" | "posts">("all");
  const [lightbox, setLightbox]   = useState<{ type: "video" | "image"; src: string } | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getToken = () => {
    const u = JSON.parse(localStorage.getItem("cb_user") || "{}");
    return localStorage.getItem("token") || u.token || "";
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = getToken();
    const currentUserId = storedUser._id || storedUser.id || "";
    if (!token) { setLoading(false); return; }
    if (!currentUserId) { setLoading(false); return; }

    fetch(`${API_BASE}/posts/${currentUserId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then((data: any) => {
        if (data.success && Array.isArray(data.data)) setPosts(data.data);
        else if (data.success && Array.isArray(data.posts)) setPosts(data.posts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    setConfirmDelete(null);
    try {
      const res = await fetch(`${API_BASE}/post/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Delete failed");
      setPosts(prev => prev.filter(p => p._id !== postId));
      showToast("Post deleted successfully", "success");
    } catch {
      showToast("Could not delete post", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const allItems = posts.flatMap((post) => [
    ...post.urls.map((src) => ({ type: "video" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
    ...post.images.map((src) => ({ type: "image" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
  ]);

  const reels     = allItems.filter((i) => i.type === "video");
  const imgs      = allItems.filter((i) => i.type === "image");
  const displayed = activeTab === "reels" ? reels : activeTab === "posts" ? imgs : allItems;

  return (
    <>
      <style>{`
        @keyframes portfolioFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pfToastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes pfFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes pfSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        .pf-item { position:relative; border-radius:14px; overflow:hidden; aspect-ratio:4/5; cursor:pointer; background:#1a1a2e; animation:portfolioFadeIn 0.3s ease both; border:1.5px solid rgba(255,255,255,0.06); transition:transform 0.2s,box-shadow 0.2s; }
        .pf-item:hover { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(0,0,0,0.18); }
        .pf-item:hover .pf-overlay { opacity:1; }
        .pf-item:hover .pf-actions { opacity:1; }
        .pf-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%); opacity:0; transition:opacity 0.2s; display:flex; align-items:flex-end; padding:12px; }
        .pf-caption { font-size:11px; color:rgba(255,255,255,0.9); font-family:'DM Sans',sans-serif; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .pf-badge { position:absolute; top:9px; left:9px; padding:3px 9px; border-radius:100px; font-size:10px; font-weight:600; font-family:'DM Sans',sans-serif; backdrop-filter:blur(6px); }
        .pf-actions { position:absolute; top:9px; right:9px; display:flex; gap:5px; opacity:0; transition:opacity 0.2s; z-index:10; }
        .pf-action-btn { width:28px; height:28px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; backdrop-filter:blur(6px); transition:all 0.15s; }
        .pf-action-delete { background:rgba(239,68,68,0.75); color:#fff; }
        .pf-action-delete:hover { background:rgba(239,68,68,1); }
        .pf-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .pf-tab { padding:7px 18px; border-radius:100px; border:none; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.18s; letter-spacing:0.02em; }
        .pf-tab-active { background:#111; color:#fff; }
        .pf-tab-idle { background:transparent; color:#999; }
        .pf-tab:hover { color:#111; }
        .pf-lightbox { position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; animation:pfFadeIn 0.2s ease; }
        .pf-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.12); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
        .pf-lightbox-close:hover { background:rgba(255,255,255,0.25); }
        .pf-lightbox-media { max-width:92vw; max-height:88vh; border-radius:16px; object-fit:contain; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
        .pf-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:pfFadeIn 0.2s ease; }
        .pf-modal-box { background:#fff; border-radius:20px; padding:32px 28px 24px; max-width:360px; width:100%; text-align:center; animation:pfSlideUp 0.22s ease; }
        .pf-modal-icon { font-size:44px; margin-bottom:12px; }
        .pf-modal-title { font-size:18px; font-weight:700; color:#111; margin-bottom:8px; font-family:'DM Sans',sans-serif; }
        .pf-modal-sub { font-size:13px; color:#888; line-height:1.6; margin-bottom:22px; font-family:'DM Sans',sans-serif; }
        .pf-modal-actions { display:flex; gap:10px; }
        .pf-modal-cancel { flex:1; padding:12px; border-radius:10px; border:1.5px solid #ebebeb; background:#fff; color:#555; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .pf-modal-cancel:hover { background:#f5f5f3; }
        .pf-modal-confirm { flex:1; padding:12px; border-radius:10px; border:none; background:#ef4444; color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.2s; }
        .pf-modal-confirm:hover { background:#dc2626; }
        .pf-modal-confirm:disabled { opacity:0.6; cursor:not-allowed; }
        .pf-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:11px 22px; border-radius:12px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; z-index:99999; white-space:nowrap; max-width:90vw; text-align:center; animation:pfToastIn 0.3s ease; box-shadow:0 4px 20px rgba(0,0,0,0.12); }
        .pf-toast.success { background:#111; color:#fff; }
        .pf-toast.error   { background:#ef4444; color:#fff; }
        .pf-mini-spin { width:13px; height:13px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; vertical-align:middle; margin-right:5px; }
      `}</style>

      {toast && <div className={`pf-toast ${toast.type}`}>{toast.msg}</div>}

      {confirmDelete && (
        <div className="pf-modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="pf-modal-box" onClick={e => e.stopPropagation()}>
            <div className="pf-modal-icon">🗑️</div>
            <div className="pf-modal-title">Delete this post?</div>
            <div className="pf-modal-sub">This cannot be undone. The post will be permanently removed from your portfolio.</div>
            <div className="pf-modal-actions">
              <button className="pf-modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="pf-modal-confirm" disabled={deletingId !== null} onClick={() => handleDelete(confirmDelete)}>
                {deletingId === confirmDelete ? <><span className="pf-mini-spin" />Deleting...</> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="pf-lightbox" onClick={() => setLightbox(null)}>
          <button className="pf-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          {lightbox.type === "video"
            ? <video src={lightbox.src} className="pf-lightbox-media" controls autoPlay onClick={(e) => e.stopPropagation()} />
            : <img src={lightbox.src} className="pf-lightbox-media" alt="portfolio" onClick={(e) => e.stopPropagation()} />
          }
        </div>
      )}

      <div style={{ background:"#fff", borderRadius:16, border:"1px solid #ebebeb", overflow:"hidden", marginBottom:24, animation:"portfolioFadeIn 0.4s ease 0.32s both" }}>
        <div style={{ padding:"20px 20px 0", borderBottom:"1px solid #f0f0f0" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎬</div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Portfolio</div>
              <div style={{ fontSize:11, color:"#aaa", fontFamily:"'DM Sans',sans-serif" }}>
                {reels.length} reel{reels.length !== 1 ? "s" : ""} · {imgs.length} post{imgs.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:4, paddingBottom:2 }}>
            {(["all","reels","posts"] as const).map((tab) => (
              <button key={tab} className={`pf-tab ${activeTab===tab?"pf-tab-active":"pf-tab-idle"}`} onClick={() => setActiveTab(tab)}>
                {tab==="all" ? `All (${allItems.length})` : tab==="reels" ? `Reels (${reels.length})` : `Posts (${imgs.length})`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding:"16px 20px 20px" }}>
          {loading && (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ width:28, height:28, borderRadius:"50%", border:"2.5px solid #e5e7eb", borderTopColor:"#7c3aed", animation:"spin 0.7s linear infinite", margin:"0 auto 10px" }} />
              <p style={{ fontSize:12, color:"#bbb", fontFamily:"'DM Sans',sans-serif" }}>Loading portfolio…</p>
            </div>
          )}
          {!loading && displayed.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 16px", background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:12, border:"1.5px dashed #d8d4ff" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎞️</div>
              <p style={{ fontSize:14, fontWeight:600, color:"#4f46e5", fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>No portfolio yet</p>
              <p style={{ fontSize:12, color:"#aaa", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>Upload reels & posts from the Portfolio section above.</p>
            </div>
          )}
          {!loading && displayed.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:10 }}>
              {displayed.map((item, i) => (
                <div key={item._id} className="pf-item" style={{ animationDelay:`${i*0.05}s` }}
                  onClick={() => setLightbox({ type: item.type, src: item.src })}>
                  {item.type === "video"
                    ? <video src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} muted playsInline
                        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime=0; }}
                      />
                    : <img src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt={item.caption||"post"} />
                  }
                  <span className="pf-badge" style={{ background:item.type==="video"?"rgba(79,70,229,0.82)":"rgba(245,158,11,0.82)", color:"#fff" }}>
                    {item.type==="video" ? "🎬 Reel" : "📷 Post"}
                  </span>
                  <div className="pf-actions" onClick={e => e.stopPropagation()}>
                    <button className="pf-action-btn pf-action-delete" title="Delete post"
                      disabled={deletingId === item.postId} onClick={() => setConfirmDelete(item.postId)}>
                      {deletingId === item.postId ? "⏳" : "🗑"}
                    </button>
                  </div>
                  <div className="pf-overlay">
                    {item.caption && <span className="pf-caption">{item.caption}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main ViewProfile ───────────────────────────────────────
export default function ViewProfile() {
  const router = useRouter();
  const [profile, setProfile]     = useState<any>(null);
  const [user, setUser]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [imgLightbox, setImgLightbox] = useState(false);
  const [bannerColor, setBannerColor] = useState("#111111");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token;
    if (!token) { router.push("/login"); return; }
    setUser(storedUser);

    fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then((data) => {
        if (data.success && data.profile) {
          setProfile(data.profile);
          if (data.profile.profileImage) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const canvas = document.createElement("canvas");
                canvas.width = 50; canvas.height = 50;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, 50, 50);
                const d = ctx.getImageData(0, 0, 50, 50).data;
                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < d.length; i += 4) {
                  const br = (d[i] + d[i+1] + d[i+2]) / 3;
                  if (br > 240 || br < 15) continue;
                  r += d[i]; g += d[i+1]; b += d[i+2]; count++;
                }
                if (count > 0) {
                  r = Math.floor(r / count * 0.55);
                  g = Math.floor(g / count * 0.55);
                  b = Math.floor(b / count * 0.55);
                  setBannerColor(`rgb(${r},${g},${b})`);
                }
              } catch {}
            };
            img.src = data.profile.profileImage;
          }
        } else {
          setProfile(null);
        }
      })
      .catch(() => { setProfile(null); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const storedUser   = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("cb_user") || "{}" : "{}");
  const isBrand      = (profile?.role || storedUser?.role || "").toLowerCase() === "brand";
  const displayName  = profile
    ? (isBrand ? (profile.companyName || profile.name) : profile.name) || storedUser?.name || ""
    : storedUser?.name || "";
  const displayEmail      = storedUser?.email || "";
  const displayRole       = profile?.role || storedUser?.role || "";
  const displayBio        = profile?.bio || "";
  const displayLocation   = profile?.location || profile?.city || "";
  const displayPhone      = profile?.phone || "";
  const displayPlatform   = profile?.platform || "";
  const displayFollowers  = profile?.followers || "";
  const displayProfileImg = profile?.profileImage || storedUser?.profileImage || "";
  const displayCompany    = profile?.companyName || "";
  const displayWebsite    = profile?.website || "";
  const displayCreatedAt  = profile?.createdAt || storedUser?.createdAt || "";
  const categories        = getCategories(profile?.categories || storedUser?.categories);
  const subCategories     = getSubCategories(profile?.subCategories || storedUser?.subCategories);
  const initial           = getInitial(displayName);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin   { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes imgFadeIn { from{opacity:0} to{opacity:1} }
        .vp-fade   { animation:fadeUp 0.4s ease both; }
        .vp-fade-1 { animation-delay:0.05s; }
        .vp-fade-2 { animation-delay:0.12s; }
        .vp-fade-3 { animation-delay:0.20s; }
        .vp-fade-4 { animation-delay:0.28s; }
        .vp-fade-5 { animation-delay:0.35s; }
        .vp-edit-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:none; background:#111; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s,transform 0.15s; }
        .vp-edit-btn:hover { background:#333; transform:translateY(-1px); }
        .vp-bank-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:1.5px solid #ebebeb; background:#fff; color:#111; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .vp-bank-btn:hover { border-color:#4f46e5; color:#4f46e5; transform:translateY(-1px); }
        .vp-tag { display:inline-block; padding:5px 13px; border-radius:100px; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; text-transform:capitalize; }
        .vp-stat { background:#fff; border-radius:14px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #ebebeb; display:flex; flex-direction:column; gap:4px; transition:transform 0.2s; }
        .vp-stat:hover { transform:translateY(-2px); }
        .vp-stat-val { font-size:20px; font-weight:600; color:#111; font-family:'DM Sans',sans-serif; }
        .vp-stat-lbl { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
        .vp-info-row { display:flex; align-items:flex-start; gap:12px; padding:14px 0; border-bottom:1px solid #f0f0f0; }
        .vp-info-row:last-child { border-bottom:none; }
        .vp-icon { width:34px; height:34px; border-radius:10px; background:#f5f5f0; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
        .vp-info-label { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
        .vp-info-val { font-size:14px; color:#222; font-weight:500; margin-top:3px; }
        .vp-info-val.empty { color:#ccc; font-style:italic; font-weight:400; }
        .vp-header-row { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
        .vp-edit-desktop { display:inline-flex; }
        .vp-banner-edit  { display:none; }
        .vp-portfolio-btn { width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.25); }
        .vp-portfolio-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.35); }
        .vp-avatar-wrap { position:relative; cursor:pointer; }
        .vp-avatar-hover-overlay { position:absolute; inset:0; border-radius:50%; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; font-weight:600; }
        .vp-avatar-wrap:hover .vp-avatar-hover-overlay { opacity:1; }
        .vp-img-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; animation:imgFadeIn 0.2s ease; cursor:zoom-out; }
        .vp-img-lightbox img { max-width:90vw; max-height:90vh; border-radius:50%; object-fit:cover; box-shadow:0 24px 80px rgba(0,0,0,0.8); }
        .vp-img-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        @media(max-width:480px) {
          .vp-edit-desktop { display:none !important; }
          .vp-banner-edit  { display:inline-flex !important; }
          .vp-stat-val { font-size:17px; }
        }
      `}</style>

      {imgLightbox && displayProfileImg && (
        <div className="vp-img-lightbox" onClick={() => setImgLightbox(false)}>
          <button className="vp-img-lightbox-close" onClick={() => setImgLightbox(false)}>✕</button>
          <img src={displayProfileImg} alt="profile" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", background:"#f5f5f0" }}>

        {/* BANNER */}
        <div style={{ background: bannerColor, height:160, position:"relative", transition:"background 0.5s ease" }}>
          <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
            <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
              style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
              ✏️ Edit
            </button>
            {!isBrand && (
              <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/Bankdetails")}
                style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
                🏦 Bank
              </button>
            )}
          </div>
        </div>

        <div style={{ maxWidth:680, margin:"0 auto", padding:"0 16px 60px" }}>

          {/* AVATAR ROW */}
          <div className="vp-fade vp-header-row" style={{ marginTop:-56, marginBottom:20 }}>
            <div className="vp-avatar-wrap" onClick={() => displayProfileImg && setImgLightbox(true)}>
              {displayProfileImg ? (
                <img src={displayProfileImg} alt="avatar"
                  style={{ width:108, height:108, borderRadius:"50%", objectFit:"cover", border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)", display:"block" }}
                />
              ) : (
                <div style={{
                  width:108, height:108, borderRadius:"50%",
                  background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
                  border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:42, fontWeight:700, color:"#fff", fontFamily:"'DM Sans',sans-serif",
                }}>
                  {initial}
                </div>
              )}
              {displayProfileImg && <div className="vp-avatar-hover-overlay">View</div>}
              <div style={{ position:"absolute", bottom:5, right:5, width:16, height:16, borderRadius:"50%", background:isBrand?"#6366f1":"#10b981", border:"3px solid #f5f5f0" }} />
            </div>

            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>✏️ Edit Profile</button>
              {!isBrand && (
                <button className="vp-bank-btn vp-edit-desktop" onClick={() => router.push("/Bankdetails")}>🏦 Bank Details</button>
              )}
            </div>
          </div>

          {/* NAME & BADGES */}
          <div className="vp-fade vp-fade-1" style={{ marginBottom:20 }}>
            <h1 style={{ fontSize:"clamp(20px,5vw,26px)", fontWeight:600, color: displayName ? "#111" : "#bbb", lineHeight:1.2, fontFamily:"'DM Sans',sans-serif" }}>
              {displayName || "Your Name"}
            </h1>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
              {displayRole && (
                <span className="vp-tag" style={{ background:isBrand?"#eef2ff":"#ecfdf5", color:isBrand?"#6366f1":"#10b981" }}>
                  {capitalize(displayRole)}
                </span>
              )}
              {/* Main Categories */}
              {categories.length > 0
                ? categories.map((cat, i) => (
                    <span key={i} className="vp-tag" style={{ background:"#fef3c7", color:"#d97706" }}>{capitalize(cat)}</span>
                  ))
                : <span className="vp-tag" style={{ background:"#f5f5f3", color:"#ccc" }}>No category yet</span>
              }
              {/* Sub Categories — shown as smaller purple tags */}
              {subCategories.map((sub, i) => (
                <span key={`sub-${i}`} className="vp-tag" style={{ background:"#ede9fe", color:"#6d28d9", fontSize:11 }}>{capitalize(sub)}</span>
              ))}
              {displayLocation
                ? <span style={{ fontSize:13, color:"#888", display:"flex", alignItems:"center", gap:4 }}>📍 {capitalize(displayLocation)}</span>
                : <span style={{ fontSize:13, color:"#ccc", fontStyle:"italic" }}>📍 City not set</span>
              }
            </div>
            <p style={{ fontSize:13, color: displayEmail ? "#aaa" : "#ddd", marginTop:6, fontStyle: displayEmail ? "normal" : "italic" }}>
              {displayEmail || "Email not available"}
            </p>
          </div>

          {/* BIO */}
          <div className="vp-fade vp-fade-2" style={{ background:"#fff", borderRadius:14, padding:"18px 20px", marginBottom:16, border:"1px solid #ebebeb" }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>About</p>
            <p style={{ fontSize:14, color: displayBio ? "#444" : "#ccc", lineHeight:1.7, fontWeight:400, fontStyle: displayBio ? "normal" : "italic" }}>
              {displayBio || "No bio added yet. Edit your profile to add one."}
            </p>
          </div>

          {/* STATS */}
          <div className="vp-fade vp-fade-2" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:16 }}>
            {!isBrand && (
              <div className="vp-stat">
                <span className="vp-stat-val" style={{ color: displayFollowers ? "#111" : "#ccc" }}>
                  {displayFollowers ? getFollowerLabel(displayFollowers) : "—"}
                </span>
                <span className="vp-stat-lbl">Followers</span>
              </div>
            )}
            {!isBrand && (
              <div className="vp-stat">
                <span className="vp-stat-val">{displayPlatform ? "🔗" : "—"}</span>
                <span className="vp-stat-lbl">Platform</span>
              </div>
            )}
            {/* Main Category stat */}
            <div className="vp-stat">
              <span className="vp-stat-val" style={{ fontSize: categories.length > 1 ? 13 : 20, color: categories.length > 0 ? "#111" : "#ccc" }}>
                {categories.length > 0 ? categories.map(capitalize).join(", ") : "—"}
              </span>
              <span className="vp-stat-lbl">CATEGORIES</span>
            </div>
            {/* Sub Category stat — only if present */}
            {subCategories.length > 0 && (
              <div className="vp-stat">
                <span className="vp-stat-val" style={{ fontSize: subCategories.length > 1 ? 12 : 16, color:"#6d28d9" }}>
                  {subCategories.map(capitalize).join(", ")}
                </span>
                <span className="vp-stat-lbl">SUB_CATEGORIES</span>
              </div>
            )}
          </div>

          {/* INFO CARD */}
          <div className="vp-fade vp-fade-3" style={{ background:"#fff", borderRadius:14, padding:"8px 20px", border:"1px solid #ebebeb", marginBottom:20 }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", padding:"14px 0 4px" }}>Details</p>

            {/* Name */}
            <div className="vp-info-row">
              <div className="vp-icon">👤</div>
              <div>
                <p className="vp-info-label">Name</p>
                <p className={`vp-info-val ${!displayName ? "empty" : ""}`}>{displayName || "Not set"}</p>
              </div>
            </div>

            {/* Email */}
            <div className="vp-info-row">
              <div className="vp-icon">📧</div>
              <div>
                <p className="vp-info-label">Email</p>
                <p className={`vp-info-val ${!displayEmail ? "empty" : ""}`}>{displayEmail || "Not set"}</p>
              </div>
            </div>

            {/* Phone */}
            <div className="vp-info-row">
              <div className="vp-icon">📞</div>
              <div>
                <p className="vp-info-label">Phone</p>
                <p className={`vp-info-val ${!displayPhone ? "empty" : ""}`}>{displayPhone || "Not set"}</p>
              </div>
            </div>

            {/* City */}
            <div className="vp-info-row">
              <div className="vp-icon">📍</div>
              <div>
                <p className="vp-info-label">City</p>
                <p className={`vp-info-val ${!displayLocation ? "empty" : ""}`}>{displayLocation ? capitalize(displayLocation) : "Not set"}</p>
              </div>
            </div>

            {/* Main Categories */}
            <div className="vp-info-row">
              <div className="vp-icon">🏷️</div>
              <div>
                <p className="vp-info-label">CATEGORIES</p>
                {categories.length > 0 ? (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:5 }}>
                    {categories.map((cat, i) => (
                      <span key={i} style={{ padding:"3px 10px", borderRadius:"100px", background:"#fef3c7", color:"#d97706", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
                        {capitalize(cat)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="vp-info-val empty">Not set</p>
                )}
              </div>
            </div>

            {/* Sub Categories — only when present */}
            {subCategories.length > 0 && (
              <div className="vp-info-row">
                <div className="vp-icon">✨</div>
                <div>
                  <p className="vp-info-label">SUB_CATEGORIES</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:5 }}>
                    {subCategories.map((sub, i) => (
                      <span key={i} style={{ padding:"3px 10px", borderRadius:"100px", background:"#ede9fe", color:"#6d28d9", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
                        {capitalize(sub)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Platform — influencer only */}
            {!isBrand && (
              <div className="vp-info-row">
                <div className="vp-icon">🔗</div>
                <div>
                  <p className="vp-info-label">Platform</p>
                  {displayPlatform
                    ? <a href={displayPlatform} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayPlatform}</a>
                    : <p className="vp-info-val empty">Not set</p>
                  }
                </div>
              </div>
            )}

            {/* Company — brand only */}
            {isBrand && (
              <div className="vp-info-row">
                <div className="vp-icon">🏢</div>
                <div>
                  <p className="vp-info-label">Company</p>
                  <p className={`vp-info-val ${!displayCompany ? "empty" : ""}`}>{displayCompany || "Not set"}</p>
                </div>
              </div>
            )}

            {/* Website — brand only */}
            {isBrand && (
              <div className="vp-info-row">
                <div className="vp-icon">🌐</div>
                <div>
                  <p className="vp-info-label">Website</p>
                  {displayWebsite
                    ? <a href={displayWebsite} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayWebsite}</a>
                    : <p className="vp-info-val empty">Not set</p>
                  }
                </div>
              </div>
            )}

            {/* Member since */}
            {displayCreatedAt && (
              <div className="vp-info-row">
                <div className="vp-icon">📅</div>
                <div>
                  <p className="vp-info-label">Member Since</p>
                  <p className="vp-info-val">{new Date(displayCreatedAt).toLocaleDateString("en-IN", { year:"numeric", month:"long" })}</p>
                </div>
              </div>
            )}
          </div>

          {/* PORTFOLIO UPLOAD CTA */}
          {!isBrand && (
            <div className="vp-fade vp-fade-4" style={{ background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:14, padding:"22px 20px", border:"1.5px solid #e8e5ff", marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎬</div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Your Portfolio</div>
                  <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Showcase your best content to brands</div>
                </div>
              </div>
              <p style={{ fontSize:13, color:"#666", lineHeight:1.7, marginBottom:16, fontFamily:"'DM Sans',sans-serif" }}>
                Upload up to <strong style={{ color:"#4f46e5" }}>2 Reels</strong> and <strong style={{ color:"#f59e0b" }}>3 Posts</strong> to showcase your work.
              </p>
              <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>📤 Upload My Portfolio</button>
            </div>
          )}

          {/* PORTFOLIO GRID */}
          {!isBrand && <PortfolioSection />}

          {/* BOTTOM CTA */}
          <div className="vp-fade vp-fade-5" style={{ textAlign:"center" }}>
            <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding:"12px 30px", fontSize:14 }}>✏️ Edit Profile</button>
            <p style={{ fontSize:12, color:"#bbb", marginTop:10, fontWeight:400 }}>You can update this anytime from your profile settings</p>
          </div>

        </div>
      </div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  center:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" },
  spinner: { width:34, height:34, borderRadius:"50%", border:"3px solid #e5e7eb", borderTopColor:"#111", animation:"spin 0.7s linear infinite" },
  btnMain: { marginTop:16, padding:"11px 26px", borderRadius:"100px", background:"#111", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14, border:"none", cursor:"pointer" },
};



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000":  "1K – 5K",
//   "5000":  "5K – 10K",
//   "10000": "10K – 20K",
//   "30000": "20K – 50K",
//   "50000": "50K – 75K",
//   "99000": "99K+",
// };

// function getFollowerLabel(val: string | number) {
//   return FOLLOWER_LABELS[String(val)] || (val ? `${Number(val).toLocaleString()}` : "—");
// }

// function capitalize(s: string) {
//   if (!s) return "";
//   return s.charAt(0).toUpperCase() + s.slice(1);
// }

// function getCategories(cats: any): string[] {
//   if (!cats) return [];
//   if (Array.isArray(cats)) return cats.filter(Boolean);
//   if (typeof cats === "string" && cats.trim()) return [cats];
//   return [];
// }

// // ✅ Get first letter of name for avatar
// function getInitial(name?: string): string {
//   if (!name) return "U";
//   return name.trim().charAt(0).toUpperCase();
// }

// type PortfolioPost = {
//   _id: string;
//   urls: string[];
//   images: string[];
//   caption: string;
//   createdAt: string;
//   user?: string;
//   userId?: string;
// };

// // ─── Portfolio Section ─────────────────────────────────────
// function PortfolioSection() {
//   const [posts, setPosts]         = useState<PortfolioPost[]>([]);
//   const [loading, setLoading]     = useState(true);
//   const [error, setError]         = useState("");
//   const [activeTab, setActiveTab] = useState<"all" | "reels" | "posts">("all");
//   const [lightbox, setLightbox]   = useState<{ type: "video" | "image"; src: string } | null>(null);
//   const [deletingId, setDeletingId]       = useState<string | null>(null);
//   const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   const getToken = () => {
//     const u = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     return localStorage.getItem("token") || u.token || "";
//   };

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = getToken();
//     const currentUserId = storedUser._id || storedUser.id || "";
//     if (!token) { setLoading(false); return; }
//     if (!currentUserId) { setLoading(false); return; }

//     fetch(`${API_BASE}/posts/${currentUserId}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(async (res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data: any) => {
//         if (data.success && Array.isArray(data.data)) setPosts(data.data);
//         else if (data.success && Array.isArray(data.posts)) setPosts(data.posts);
//       })
//       .catch(() => {})
//       .finally(() => setLoading(false));
//   }, []);

//   const handleDelete = async (postId: string) => {
//     setDeletingId(postId);
//     setConfirmDelete(null);
//     try {
//       const res = await fetch(`${API_BASE}/post/${postId}`, {
//         method: "DELETE",
//         headers: { Authorization: `Bearer ${getToken()}` },
//       });
//       if (!res.ok) throw new Error("Delete failed");
//       setPosts(prev => prev.filter(p => p._id !== postId));
//       showToast("Post deleted successfully", "success");
//     } catch {
//       showToast("Could not delete post", "error");
//     } finally {
//       setDeletingId(null);
//     }
//   };

//   const allItems = posts.flatMap((post) => [
//     ...post.urls.map((src) => ({ type: "video" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
//     ...post.images.map((src) => ({ type: "image" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
//   ]);

//   const reels     = allItems.filter((i) => i.type === "video");
//   const imgs      = allItems.filter((i) => i.type === "image");
//   const displayed = activeTab === "reels" ? reels : activeTab === "posts" ? imgs : allItems;

//   return (
//     <>
//       <style>{`
//         @keyframes portfolioFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes pfToastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
//         @keyframes pfFadeIn  { from{opacity:0} to{opacity:1} }
//         @keyframes pfSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
//         .pf-item { position:relative; border-radius:14px; overflow:hidden; aspect-ratio:4/5; cursor:pointer; background:#1a1a2e; animation:portfolioFadeIn 0.3s ease both; border:1.5px solid rgba(255,255,255,0.06); transition:transform 0.2s,box-shadow 0.2s; }
//         .pf-item:hover { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(0,0,0,0.18); }
//         .pf-item:hover .pf-overlay { opacity:1; }
//         .pf-item:hover .pf-actions { opacity:1; }
//         .pf-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%); opacity:0; transition:opacity 0.2s; display:flex; align-items:flex-end; padding:12px; }
//         .pf-caption { font-size:11px; color:rgba(255,255,255,0.9); font-family:'DM Sans',sans-serif; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
//         .pf-badge { position:absolute; top:9px; left:9px; padding:3px 9px; border-radius:100px; font-size:10px; font-weight:600; font-family:'DM Sans',sans-serif; backdrop-filter:blur(6px); }
//         .pf-actions { position:absolute; top:9px; right:9px; display:flex; gap:5px; opacity:0; transition:opacity 0.2s; z-index:10; }
//         .pf-action-btn { width:28px; height:28px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; backdrop-filter:blur(6px); transition:all 0.15s; }
//         .pf-action-delete { background:rgba(239,68,68,0.75); color:#fff; }
//         .pf-action-delete:hover { background:rgba(239,68,68,1); }
//         .pf-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
//         .pf-tab { padding:7px 18px; border-radius:100px; border:none; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.18s; letter-spacing:0.02em; }
//         .pf-tab-active { background:#111; color:#fff; }
//         .pf-tab-idle { background:transparent; color:#999; }
//         .pf-tab:hover { color:#111; }
//         .pf-lightbox { position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; animation:pfFadeIn 0.2s ease; }
//         .pf-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.12); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
//         .pf-lightbox-close:hover { background:rgba(255,255,255,0.25); }
//         .pf-lightbox-media { max-width:92vw; max-height:88vh; border-radius:16px; object-fit:contain; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
//         .pf-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:pfFadeIn 0.2s ease; }
//         .pf-modal-box { background:#fff; border-radius:20px; padding:32px 28px 24px; max-width:360px; width:100%; text-align:center; animation:pfSlideUp 0.22s ease; }
//         .pf-modal-icon { font-size:44px; margin-bottom:12px; }
//         .pf-modal-title { font-size:18px; font-weight:700; color:#111; margin-bottom:8px; font-family:'DM Sans',sans-serif; }
//         .pf-modal-sub { font-size:13px; color:#888; line-height:1.6; margin-bottom:22px; font-family:'DM Sans',sans-serif; }
//         .pf-modal-actions { display:flex; gap:10px; }
//         .pf-modal-cancel { flex:1; padding:12px; border-radius:10px; border:1.5px solid #ebebeb; background:#fff; color:#555; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; }
//         .pf-modal-cancel:hover { background:#f5f5f3; }
//         .pf-modal-confirm { flex:1; padding:12px; border-radius:10px; border:none; background:#ef4444; color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.2s; }
//         .pf-modal-confirm:hover { background:#dc2626; }
//         .pf-modal-confirm:disabled { opacity:0.6; cursor:not-allowed; }
//         .pf-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:11px 22px; border-radius:12px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; z-index:99999; white-space:nowrap; max-width:90vw; text-align:center; animation:pfToastIn 0.3s ease; box-shadow:0 4px 20px rgba(0,0,0,0.12); }
//         .pf-toast.success { background:#111; color:#fff; }
//         .pf-toast.error   { background:#ef4444; color:#fff; }
//         .pf-mini-spin { width:13px; height:13px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; vertical-align:middle; margin-right:5px; }
//       `}</style>

//       {toast && <div className={`pf-toast ${toast.type}`}>{toast.msg}</div>}

//       {confirmDelete && (
//         <div className="pf-modal-overlay" onClick={() => setConfirmDelete(null)}>
//           <div className="pf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="pf-modal-icon">🗑️</div>
//             <div className="pf-modal-title">Delete this post?</div>
//             <div className="pf-modal-sub">This cannot be undone. The post will be permanently removed from your portfolio.</div>
//             <div className="pf-modal-actions">
//               <button className="pf-modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
//               <button className="pf-modal-confirm" disabled={deletingId !== null} onClick={() => handleDelete(confirmDelete)}>
//                 {deletingId === confirmDelete ? <><span className="pf-mini-spin" />Deleting...</> : "Yes, Delete"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {lightbox && (
//         <div className="pf-lightbox" onClick={() => setLightbox(null)}>
//           <button className="pf-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
//           {lightbox.type === "video"
//             ? <video src={lightbox.src} className="pf-lightbox-media" controls autoPlay onClick={(e) => e.stopPropagation()} />
//             : <img src={lightbox.src} className="pf-lightbox-media" alt="portfolio" onClick={(e) => e.stopPropagation()} />
//           }
//         </div>
//       )}

//       <div style={{ background:"#fff", borderRadius:16, border:"1px solid #ebebeb", overflow:"hidden", marginBottom:24, animation:"portfolioFadeIn 0.4s ease 0.32s both" }}>
//         <div style={{ padding:"20px 20px 0", borderBottom:"1px solid #f0f0f0" }}>
//           <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
//             <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎬</div>
//             <div>
//               <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Portfolio</div>
//               <div style={{ fontSize:11, color:"#aaa", fontFamily:"'DM Sans',sans-serif" }}>
//                 {reels.length} reel{reels.length !== 1 ? "s" : ""} · {imgs.length} post{imgs.length !== 1 ? "s" : ""}
//               </div>
//             </div>
//           </div>
//           <div style={{ display:"flex", gap:4, paddingBottom:2 }}>
//             {(["all","reels","posts"] as const).map((tab) => (
//               <button key={tab} className={`pf-tab ${activeTab===tab?"pf-tab-active":"pf-tab-idle"}`} onClick={() => setActiveTab(tab)}>
//                 {tab==="all" ? `All (${allItems.length})` : tab==="reels" ? `Reels (${reels.length})` : `Posts (${imgs.length})`}
//               </button>
//             ))}
//           </div>
//         </div>

//         <div style={{ padding:"16px 20px 20px" }}>
//           {loading && (
//             <div style={{ textAlign:"center", padding:"32px 0" }}>
//               <div style={{ width:28, height:28, borderRadius:"50%", border:"2.5px solid #e5e7eb", borderTopColor:"#7c3aed", animation:"spin 0.7s linear infinite", margin:"0 auto 10px" }} />
//               <p style={{ fontSize:12, color:"#bbb", fontFamily:"'DM Sans',sans-serif" }}>Loading portfolio…</p>
//             </div>
//           )}
//           {!loading && displayed.length === 0 && (
//             <div style={{ textAlign:"center", padding:"32px 16px", background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:12, border:"1.5px dashed #d8d4ff" }}>
//               <div style={{ fontSize:36, marginBottom:10 }}>🎞️</div>
//               <p style={{ fontSize:14, fontWeight:600, color:"#4f46e5", fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>No portfolio yet</p>
//               <p style={{ fontSize:12, color:"#aaa", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>Upload reels & posts from the Portfolio section above.</p>
//             </div>
//           )}
//           {!loading && displayed.length > 0 && (
//             <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:10 }}>
//               {displayed.map((item, i) => (
//                 <div key={item._id} className="pf-item" style={{ animationDelay:`${i*0.05}s` }}
//                   onClick={() => setLightbox({ type: item.type, src: item.src })}>
//                   {item.type === "video"
//                     ? <video src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} muted playsInline
//                         onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//                         onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime=0; }}
//                       />
//                     : <img src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt={item.caption||"post"} />
//                   }
//                   <span className="pf-badge" style={{ background:item.type==="video"?"rgba(79,70,229,0.82)":"rgba(245,158,11,0.82)", color:"#fff" }}>
//                     {item.type==="video" ? "🎬 Reel" : "📷 Post"}
//                   </span>
//                   <div className="pf-actions" onClick={e => e.stopPropagation()}>
//                     <button className="pf-action-btn pf-action-delete" title="Delete post"
//                       disabled={deletingId === item.postId} onClick={() => setConfirmDelete(item.postId)}>
//                       {deletingId === item.postId ? "⏳" : "🗑"}
//                     </button>
//                   </div>
//                   <div className="pf-overlay">
//                     {item.caption && <span className="pf-caption">{item.caption}</span>}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Main ViewProfile ───────────────────────────────────────
// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile]     = useState<any>(null);
//   const [user, setUser]           = useState<any>(null);
//   const [loading, setLoading]     = useState(true);
//   // ✅ lightbox for profile image
//   const [imgLightbox, setImgLightbox] = useState(false);
//   // ✅ banner color from profile image
//   const [bannerColor, setBannerColor] = useState("#111111");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);

//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) {
//           setProfile(data.profile);
//           // ✅ extract banner color from profile image
//           if (data.profile.profileImage) {
//             const img = new Image();
//             img.crossOrigin = "anonymous";
//             img.onload = () => {
//               try {
//                 const canvas = document.createElement("canvas");
//                 canvas.width = 50; canvas.height = 50;
//                 const ctx = canvas.getContext("2d")!;
//                 ctx.drawImage(img, 0, 0, 50, 50);
//                 const d = ctx.getImageData(0, 0, 50, 50).data;
//                 let r = 0, g = 0, b = 0, count = 0;
//                 for (let i = 0; i < d.length; i += 4) {
//                   const br = (d[i] + d[i+1] + d[i+2]) / 3;
//                   if (br > 240 || br < 15) continue;
//                   r += d[i]; g += d[i+1]; b += d[i+2]; count++;
//                 }
//                 if (count > 0) {
//                   r = Math.floor(r / count * 0.55);
//                   g = Math.floor(g / count * 0.55);
//                   b = Math.floor(b / count * 0.55);
//                   setBannerColor(`rgb(${r},${g},${b})`);
//                 }
//               } catch {}
//             };
//             img.src = data.profile.profileImage;
//           }
//         } else {
//           setProfile(null);
//         }
//       })
//       .catch(() => {
//         // ✅ even on error, show localStorage data — don't block
//         setProfile(null);
//       })
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   // ✅ Build display data — merge API profile + localStorage fallback
//   const storedUser   = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("cb_user") || "{}" : "{}");
//   const isBrand      = (profile?.role || storedUser?.role || "").toLowerCase() === "brand";
//   const displayName  = profile
//     ? (isBrand ? (profile.companyName || profile.name) : profile.name) || storedUser?.name || ""
//     : storedUser?.name || "";
//   const displayEmail      = storedUser?.email || "";
//   const displayRole       = profile?.role || storedUser?.role || "";
//   const displayBio        = profile?.bio || "";
//   const displayLocation   = profile?.location || profile?.city || "";
//   const displayPhone      = profile?.phone || "";
//   const displayPlatform   = profile?.platform || "";
//   const displayFollowers  = profile?.followers || "";
//   const displayProfileImg = profile?.profileImage || storedUser?.profileImage || "";
//   const displayCompany    = profile?.companyName || "";
//   const displayWebsite    = profile?.website || "";
//   const displayCreatedAt  = profile?.createdAt || storedUser?.createdAt || "";
//   const categories        = getCategories(profile?.categories || storedUser?.categories);
//   const initial           = getInitial(displayName);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
//         @keyframes spin   { to { transform:rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes imgFadeIn { from{opacity:0} to{opacity:1} }
//         .vp-fade   { animation:fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay:0.05s; }
//         .vp-fade-2 { animation-delay:0.12s; }
//         .vp-fade-3 { animation-delay:0.20s; }
//         .vp-fade-4 { animation-delay:0.28s; }
//         .vp-fade-5 { animation-delay:0.35s; }
//         .vp-edit-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:none; background:#111; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s,transform 0.15s; }
//         .vp-edit-btn:hover { background:#333; transform:translateY(-1px); }
//         .vp-bank-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:1.5px solid #ebebeb; background:#fff; color:#111; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
//         .vp-bank-btn:hover { border-color:#4f46e5; color:#4f46e5; transform:translateY(-1px); }
//         .vp-tag { display:inline-block; padding:5px 13px; border-radius:100px; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; text-transform:capitalize; }
//         .vp-stat { background:#fff; border-radius:14px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #ebebeb; display:flex; flex-direction:column; gap:4px; transition:transform 0.2s; }
//         .vp-stat:hover { transform:translateY(-2px); }
//         .vp-stat-val { font-size:20px; font-weight:600; color:#111; font-family:'DM Sans',sans-serif; }
//         .vp-stat-lbl { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
//         .vp-info-row { display:flex; align-items:flex-start; gap:12px; padding:14px 0; border-bottom:1px solid #f0f0f0; }
//         .vp-info-row:last-child { border-bottom:none; }
//         .vp-icon { width:34px; height:34px; border-radius:10px; background:#f5f5f0; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
//         .vp-info-label { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
//         .vp-info-val { font-size:14px; color:#222; font-weight:500; margin-top:3px; }
//         .vp-info-val.empty { color:#ccc; font-style:italic; font-weight:400; }
//         .vp-header-row { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
//         .vp-edit-desktop { display:inline-flex; }
//         .vp-banner-edit  { display:none; }
//         .vp-portfolio-btn { width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.25); }
//         .vp-portfolio-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.35); }
//         /* ✅ avatar click hover */
//         .vp-avatar-wrap { position:relative; cursor:pointer; }
//         .vp-avatar-hover-overlay { position:absolute; inset:0; border-radius:50%; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; font-weight:600; }
//         .vp-avatar-wrap:hover .vp-avatar-hover-overlay { opacity:1; }
//         /* ✅ img lightbox */
//         .vp-img-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; animation:imgFadeIn 0.2s ease; cursor:zoom-out; }
//         .vp-img-lightbox img { max-width:90vw; max-height:90vh; border-radius:50%; object-fit:cover; box-shadow:0 24px 80px rgba(0,0,0,0.8); }
//         .vp-img-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
//         @media(max-width:480px) {
//           .vp-edit-desktop { display:none !important; }
//           .vp-banner-edit  { display:inline-flex !important; }
//           .vp-stat-val { font-size:17px; }
//         }
//       `}</style>

//       {/* ✅ Profile image lightbox */}
//       {imgLightbox && displayProfileImg && (
//         <div className="vp-img-lightbox" onClick={() => setImgLightbox(false)}>
//           <button className="vp-img-lightbox-close" onClick={() => setImgLightbox(false)}>✕</button>
//           <img src={displayProfileImg} alt="profile" onClick={e => e.stopPropagation()} />
//         </div>
//       )}

//       <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", background:"#f5f5f0" }}>

//         {/* BANNER — dynamic color from profile image */}
//         <div style={{ background: bannerColor, height:160, position:"relative", transition:"background 0.5s ease" }}>
//           <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
//             <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
//               style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit
//             </button>
//             {!isBrand && (
//               <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/Bankdetails")}
//                 style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
//                 🏦 Bank
//               </button>
//             )}
//           </div>
//         </div>

//         <div style={{ maxWidth:680, margin:"0 auto", padding:"0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop:-56, marginBottom:20 }}>
//             {/* ✅ Avatar — image or letter initial, clickable */}
//             <div className="vp-avatar-wrap" onClick={() => displayProfileImg && setImgLightbox(true)}>
//               {displayProfileImg ? (
//                 <img
//                   src={displayProfileImg}
//                   alt="avatar"
//                   style={{ width:108, height:108, borderRadius:"50%", objectFit:"cover", border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)", display:"block" }}
//                 />
//               ) : (
//                 /* ✅ Letter avatar when no profile image */
//                 <div style={{
//                   width:108, height:108, borderRadius:"50%",
//                   background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
//                   border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)",
//                   display:"flex", alignItems:"center", justifyContent:"center",
//                   fontSize:42, fontWeight:700, color:"#fff",
//                   fontFamily:"'DM Sans',sans-serif",
//                 }}>
//                   {initial}
//                 </div>
//               )}
//               {displayProfileImg && (
//                 <div className="vp-avatar-hover-overlay">View</div>
//               )}
//               <div style={{ position:"absolute", bottom:5, right:5, width:16, height:16, borderRadius:"50%", background:isBrand?"#6366f1":"#10b981", border:"3px solid #f5f5f0" }} />
//             </div>

//             <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
//               <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>✏️ Edit Profile</button>
//               {!isBrand && (
//                 <button className="vp-bank-btn vp-edit-desktop" onClick={() => router.push("/Bankdetails")}>🏦 Bank Details</button>
//               )}
//             </div>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom:20 }}>
//             <h1 style={{ fontSize:"clamp(20px,5vw,26px)", fontWeight:600, color: displayName ? "#111" : "#bbb", lineHeight:1.2, fontFamily:"'DM Sans',sans-serif" }}>
//               {displayName || "Your Name"}
//             </h1>
//             <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
//               {displayRole && (
//                 <span className="vp-tag" style={{ background:isBrand?"#eef2ff":"#ecfdf5", color:isBrand?"#6366f1":"#10b981" }}>
//                   {capitalize(displayRole)}
//                 </span>
//               )}
//               {categories.length > 0
//                 ? categories.map((cat, i) => (
//                     <span key={i} className="vp-tag" style={{ background:"#fef3c7", color:"#d97706" }}>{capitalize(cat)}</span>
//                   ))
//                 : <span className="vp-tag" style={{ background:"#f5f5f3", color:"#ccc" }}>No category yet</span>
//               }
//               {displayLocation
//                 ? <span style={{ fontSize:13, color:"#888", display:"flex", alignItems:"center", gap:4 }}>📍 {capitalize(displayLocation)}</span>
//                 : <span style={{ fontSize:13, color:"#ccc", fontStyle:"italic" }}>📍 City not set</span>
//               }
//             </div>
//             {/* ✅ Always show email */}
//             <p style={{ fontSize:13, color: displayEmail ? "#aaa" : "#ddd", marginTop:6, fontStyle: displayEmail ? "normal" : "italic" }}>
//               {displayEmail || "Email not available"}
//             </p>
//           </div>

//           {/* BIO */}
//           <div className="vp-fade vp-fade-2" style={{ background:"#fff", borderRadius:14, padding:"18px 20px", marginBottom:16, border:"1px solid #ebebeb" }}>
//             <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>About</p>
//             <p style={{ fontSize:14, color: displayBio ? "#444" : "#ccc", lineHeight:1.7, fontWeight:400, fontStyle: displayBio ? "normal" : "italic" }}>
//               {displayBio || "No bio added yet. Edit your profile to add one."}
//             </p>
//           </div>

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:16 }}>
//             {!isBrand && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val" style={{ color: displayFollowers ? "#111" : "#ccc" }}>
//                   {displayFollowers ? getFollowerLabel(displayFollowers) : "—"}
//                 </span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{displayPlatform ? "🔗" : "—"}</span>
//                 <span className="vp-stat-lbl">Platform</span>
//               </div>
//             )}
//             <div className="vp-stat">
//               <span className="vp-stat-val" style={{ fontSize: categories.length > 1 ? 13 : 20, color: categories.length > 0 ? "#111" : "#ccc" }}>
//                 {categories.length > 0 ? categories.map(capitalize).join(", ") : "—"}
//               </span>
//               <span className="vp-stat-lbl">Categor{categories.length > 1 ? "ies" : "y"}</span>
//             </div>
//           </div>

//           {/* INFO CARD — always show all fields */}
//           <div className="vp-fade vp-fade-3" style={{ background:"#fff", borderRadius:14, padding:"8px 20px", border:"1px solid #ebebeb", marginBottom:20 }}>
//             <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", padding:"14px 0 4px" }}>Details</p>

//             {/* Name */}
//             <div className="vp-info-row">
//               <div className="vp-icon">👤</div>
//               <div>
//                 <p className="vp-info-label">Name</p>
//                 <p className={`vp-info-val ${!displayName ? "empty" : ""}`}>{displayName || "Not set"}</p>
//               </div>
//             </div>

//             {/* Email */}
//             <div className="vp-info-row">
//               <div className="vp-icon">📧</div>
//               <div>
//                 <p className="vp-info-label">Email</p>
//                 <p className={`vp-info-val ${!displayEmail ? "empty" : ""}`}>{displayEmail || "Not set"}</p>
//               </div>
//             </div>

//             {/* Phone */}
//             <div className="vp-info-row">
//               <div className="vp-icon">📞</div>
//               <div>
//                 <p className="vp-info-label">Phone</p>
//                 <p className={`vp-info-val ${!displayPhone ? "empty" : ""}`}>{displayPhone || "Not set"}</p>
//               </div>
//             </div>

//             {/* City */}
//             <div className="vp-info-row">
//               <div className="vp-icon">📍</div>
//               <div>
//                 <p className="vp-info-label">City</p>
//                 <p className={`vp-info-val ${!displayLocation ? "empty" : ""}`}>{displayLocation ? capitalize(displayLocation) : "Not set"}</p>
//               </div>
//             </div>

//             {/* Categories */}
//             <div className="vp-info-row">
//               <div className="vp-icon">🏷️</div>
//               <div>
//                 <p className="vp-info-label">Categories</p>
//                 {categories.length > 0 ? (
//                   <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:5 }}>
//                     {categories.map((cat, i) => (
//                       <span key={i} style={{ padding:"3px 10px", borderRadius:"100px", background:"#fef3c7", color:"#d97706", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
//                         {capitalize(cat)}
//                       </span>
//                     ))}
//                   </div>
//                 ) : (
//                   <p className="vp-info-val empty">Not set</p>
//                 )}
//               </div>
//             </div>

//             {/* Platform — influencer only */}
//             {!isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   {displayPlatform
//                     ? <a href={displayPlatform} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayPlatform}</a>
//                     : <p className="vp-info-val empty">Not set</p>
//                   }
//                 </div>
//               </div>
//             )}

//             {/* Company — brand only */}
//             {isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div>
//                   <p className="vp-info-label">Company</p>
//                   <p className={`vp-info-val ${!displayCompany ? "empty" : ""}`}>{displayCompany || "Not set"}</p>
//                 </div>
//               </div>
//             )}

//             {/* Website — brand only */}
//             {isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   {displayWebsite
//                     ? <a href={displayWebsite} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayWebsite}</a>
//                     : <p className="vp-info-val empty">Not set</p>
//                   }
//                 </div>
//               </div>
//             )}

//             {/* Member since */}
//             {displayCreatedAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">{new Date(displayCreatedAt).toLocaleDateString("en-IN", { year:"numeric", month:"long" })}</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* PORTFOLIO UPLOAD CTA */}
//           {!isBrand && (
//             <div className="vp-fade vp-fade-4" style={{ background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:14, padding:"22px 20px", border:"1.5px solid #e8e5ff", marginBottom:16 }}>
//               <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
//                 <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎬</div>
//                 <div>
//                   <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Your Portfolio</div>
//                   <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Showcase your best content to brands</div>
//                 </div>
//               </div>
//               <p style={{ fontSize:13, color:"#666", lineHeight:1.7, marginBottom:16, fontFamily:"'DM Sans',sans-serif" }}>
//                 Upload up to <strong style={{ color:"#4f46e5" }}>2 Reels</strong> and <strong style={{ color:"#f59e0b" }}>3 Posts</strong> to showcase your work.
//               </p>
//               <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>📤 Upload My Portfolio</button>
//             </div>
//           )}

//           {/* PORTFOLIO GRID */}
//           {!isBrand && <PortfolioSection />}

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-5" style={{ textAlign:"center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding:"12px 30px", fontSize:14 }}>✏️ Edit Profile</button>
//             <p style={{ fontSize:12, color:"#bbb", marginTop:10, fontWeight:400 }}>You can update this anytime from your profile settings</p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" },
//   spinner: { width:34, height:34, borderRadius:"50%", border:"3px solid #e5e7eb", borderTopColor:"#111", animation:"spin 0.7s linear infinite" },
//   btnMain: { marginTop:16, padding:"11px 26px", borderRadius:"100px", background:"#111", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14, border:"none", cursor:"pointer" },
// };



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// const FOLLOWER_LABELS: Record<string, string> = {
//   "1000":  "1K – 5K",
//   "5000":  "5K – 10K",
//   "10000": "10K – 20K",
//   "30000": "20K – 50K",
//   "50000": "50K – 75K",
//   "99000": "99K+",
// };

// function getFollowerLabel(val: string | number) {
//   return FOLLOWER_LABELS[String(val)] || (val ? `${Number(val).toLocaleString()}` : "—");
// }

// function capitalize(s: string) {
//   if (!s) return "";
//   return s.charAt(0).toUpperCase() + s.slice(1);
// }

// function getCategories(cats: any): string[] {
//   if (!cats) return [];
//   if (Array.isArray(cats)) return cats.filter(Boolean);
//   if (typeof cats === "string" && cats.trim()) return [cats];
//   return [];
// }

// // ✅ Get first letter of name for avatar
// function getInitial(name?: string): string {
//   if (!name) return "U";
//   return name.trim().charAt(0).toUpperCase();
// }

// type PortfolioPost = {
//   _id: string;
//   urls: string[];
//   images: string[];
//   caption: string;
//   createdAt: string;
//   user?: string;
//   userId?: string;
// };

// // ─── Portfolio Section ─────────────────────────────────────
// function PortfolioSection() {
//   const [posts, setPosts]         = useState<PortfolioPost[]>([]);
//   const [loading, setLoading]     = useState(true);
//   const [error, setError]         = useState("");
//   const [activeTab, setActiveTab] = useState<"all" | "reels" | "posts">("all");
//   const [lightbox, setLightbox]   = useState<{ type: "video" | "image"; src: string } | null>(null);
//   const [deletingId, setDeletingId]       = useState<string | null>(null);
//   const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   const getToken = () => {
//     const u = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     return localStorage.getItem("token") || u.token || "";
//   };

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = getToken();
//     const currentUserId = storedUser._id || storedUser.id || "";
//     if (!token) { setLoading(false); return; }
//     if (!currentUserId) { setLoading(false); return; }

//     fetch(`${API_BASE}/posts/${currentUserId}`, { headers: { Authorization: `Bearer ${token}` } })
//       .then(async (res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data: any) => {
//         if (data.success && Array.isArray(data.data)) setPosts(data.data);
//         else if (data.success && Array.isArray(data.posts)) setPosts(data.posts);
//       })
//       .catch(() => {})
//       .finally(() => setLoading(false));
//   }, []);

//   const handleDelete = async (postId: string) => {
//     setDeletingId(postId);
//     setConfirmDelete(null);
//     try {
//       const res = await fetch(`${API_BASE}/post/${postId}`, {
//         method: "DELETE",
//         headers: { Authorization: `Bearer ${getToken()}` },
//       });
//       if (!res.ok) throw new Error("Delete failed");
//       setPosts(prev => prev.filter(p => p._id !== postId));
//       showToast("Post deleted successfully", "success");
//     } catch {
//       showToast("Could not delete post", "error");
//     } finally {
//       setDeletingId(null);
//     }
//   };

//   const allItems = posts.flatMap((post) => [
//     ...post.urls.map((src) => ({ type: "video" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
//     ...post.images.map((src) => ({ type: "image" as const, src, caption: post.caption, postId: post._id, _id: post._id + src })),
//   ]);

//   const reels     = allItems.filter((i) => i.type === "video");
//   const imgs      = allItems.filter((i) => i.type === "image");
//   const displayed = activeTab === "reels" ? reels : activeTab === "posts" ? imgs : allItems;

//   return (
//     <>
//       <style>{`
//         @keyframes portfolioFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes pfToastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
//         @keyframes pfFadeIn  { from{opacity:0} to{opacity:1} }
//         @keyframes pfSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
//         .pf-item { position:relative; border-radius:14px; overflow:hidden; aspect-ratio:4/5; cursor:pointer; background:#1a1a2e; animation:portfolioFadeIn 0.3s ease both; border:1.5px solid rgba(255,255,255,0.06); transition:transform 0.2s,box-shadow 0.2s; }
//         .pf-item:hover { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(0,0,0,0.18); }
//         .pf-item:hover .pf-overlay { opacity:1; }
//         .pf-item:hover .pf-actions { opacity:1; }
//         .pf-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%); opacity:0; transition:opacity 0.2s; display:flex; align-items:flex-end; padding:12px; }
//         .pf-caption { font-size:11px; color:rgba(255,255,255,0.9); font-family:'DM Sans',sans-serif; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
//         .pf-badge { position:absolute; top:9px; left:9px; padding:3px 9px; border-radius:100px; font-size:10px; font-weight:600; font-family:'DM Sans',sans-serif; backdrop-filter:blur(6px); }
//         .pf-actions { position:absolute; top:9px; right:9px; display:flex; gap:5px; opacity:0; transition:opacity 0.2s; z-index:10; }
//         .pf-action-btn { width:28px; height:28px; border-radius:8px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:13px; backdrop-filter:blur(6px); transition:all 0.15s; }
//         .pf-action-delete { background:rgba(239,68,68,0.75); color:#fff; }
//         .pf-action-delete:hover { background:rgba(239,68,68,1); }
//         .pf-action-btn:disabled { opacity:0.5; cursor:not-allowed; }
//         .pf-tab { padding:7px 18px; border-radius:100px; border:none; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.18s; letter-spacing:0.02em; }
//         .pf-tab-active { background:#111; color:#fff; }
//         .pf-tab-idle { background:transparent; color:#999; }
//         .pf-tab:hover { color:#111; }
//         .pf-lightbox { position:fixed; inset:0; z-index:9998; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; animation:pfFadeIn 0.2s ease; }
//         .pf-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.12); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
//         .pf-lightbox-close:hover { background:rgba(255,255,255,0.25); }
//         .pf-lightbox-media { max-width:92vw; max-height:88vh; border-radius:16px; object-fit:contain; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
//         .pf-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:pfFadeIn 0.2s ease; }
//         .pf-modal-box { background:#fff; border-radius:20px; padding:32px 28px 24px; max-width:360px; width:100%; text-align:center; animation:pfSlideUp 0.22s ease; }
//         .pf-modal-icon { font-size:44px; margin-bottom:12px; }
//         .pf-modal-title { font-size:18px; font-weight:700; color:#111; margin-bottom:8px; font-family:'DM Sans',sans-serif; }
//         .pf-modal-sub { font-size:13px; color:#888; line-height:1.6; margin-bottom:22px; font-family:'DM Sans',sans-serif; }
//         .pf-modal-actions { display:flex; gap:10px; }
//         .pf-modal-cancel { flex:1; padding:12px; border-radius:10px; border:1.5px solid #ebebeb; background:#fff; color:#555; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s; }
//         .pf-modal-cancel:hover { background:#f5f5f3; }
//         .pf-modal-confirm { flex:1; padding:12px; border-radius:10px; border:none; background:#ef4444; color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:700; cursor:pointer; transition:all 0.2s; }
//         .pf-modal-confirm:hover { background:#dc2626; }
//         .pf-modal-confirm:disabled { opacity:0.6; cursor:not-allowed; }
//         .pf-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:11px 22px; border-radius:12px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; z-index:99999; white-space:nowrap; max-width:90vw; text-align:center; animation:pfToastIn 0.3s ease; box-shadow:0 4px 20px rgba(0,0,0,0.12); }
//         .pf-toast.success { background:#111; color:#fff; }
//         .pf-toast.error   { background:#ef4444; color:#fff; }
//         .pf-mini-spin { width:13px; height:13px; border:2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; display:inline-block; vertical-align:middle; margin-right:5px; }
//       `}</style>

//       {toast && <div className={`pf-toast ${toast.type}`}>{toast.msg}</div>}

//       {confirmDelete && (
//         <div className="pf-modal-overlay" onClick={() => setConfirmDelete(null)}>
//           <div className="pf-modal-box" onClick={e => e.stopPropagation()}>
//             <div className="pf-modal-icon">🗑️</div>
//             <div className="pf-modal-title">Delete this post?</div>
//             <div className="pf-modal-sub">This cannot be undone. The post will be permanently removed from your portfolio.</div>
//             <div className="pf-modal-actions">
//               <button className="pf-modal-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
//               <button className="pf-modal-confirm" disabled={deletingId !== null} onClick={() => handleDelete(confirmDelete)}>
//                 {deletingId === confirmDelete ? <><span className="pf-mini-spin" />Deleting...</> : "Yes, Delete"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {lightbox && (
//         <div className="pf-lightbox" onClick={() => setLightbox(null)}>
//           <button className="pf-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
//           {lightbox.type === "video"
//             ? <video src={lightbox.src} className="pf-lightbox-media" controls autoPlay onClick={(e) => e.stopPropagation()} />
//             : <img src={lightbox.src} className="pf-lightbox-media" alt="portfolio" onClick={(e) => e.stopPropagation()} />
//           }
//         </div>
//       )}

//       <div style={{ background:"#fff", borderRadius:16, border:"1px solid #ebebeb", overflow:"hidden", marginBottom:24, animation:"portfolioFadeIn 0.4s ease 0.32s both" }}>
//         <div style={{ padding:"20px 20px 0", borderBottom:"1px solid #f0f0f0" }}>
//           <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
//             <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🎬</div>
//             <div>
//               <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Portfolio</div>
//               <div style={{ fontSize:11, color:"#aaa", fontFamily:"'DM Sans',sans-serif" }}>
//                 {reels.length} reel{reels.length !== 1 ? "s" : ""} · {imgs.length} post{imgs.length !== 1 ? "s" : ""}
//               </div>
//             </div>
//           </div>
//           <div style={{ display:"flex", gap:4, paddingBottom:2 }}>
//             {(["all","reels","posts"] as const).map((tab) => (
//               <button key={tab} className={`pf-tab ${activeTab===tab?"pf-tab-active":"pf-tab-idle"}`} onClick={() => setActiveTab(tab)}>
//                 {tab==="all" ? `All (${allItems.length})` : tab==="reels" ? `Reels (${reels.length})` : `Posts (${imgs.length})`}
//               </button>
//             ))}
//           </div>
//         </div>

//         <div style={{ padding:"16px 20px 20px" }}>
//           {loading && (
//             <div style={{ textAlign:"center", padding:"32px 0" }}>
//               <div style={{ width:28, height:28, borderRadius:"50%", border:"2.5px solid #e5e7eb", borderTopColor:"#7c3aed", animation:"spin 0.7s linear infinite", margin:"0 auto 10px" }} />
//               <p style={{ fontSize:12, color:"#bbb", fontFamily:"'DM Sans',sans-serif" }}>Loading portfolio…</p>
//             </div>
//           )}
//           {!loading && displayed.length === 0 && (
//             <div style={{ textAlign:"center", padding:"32px 16px", background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:12, border:"1.5px dashed #d8d4ff" }}>
//               <div style={{ fontSize:36, marginBottom:10 }}>🎞️</div>
//               <p style={{ fontSize:14, fontWeight:600, color:"#4f46e5", fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>No portfolio yet</p>
//               <p style={{ fontSize:12, color:"#aaa", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>Upload reels & posts from the Portfolio section above.</p>
//             </div>
//           )}
//           {!loading && displayed.length > 0 && (
//             <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:10 }}>
//               {displayed.map((item, i) => (
//                 <div key={item._id} className="pf-item" style={{ animationDelay:`${i*0.05}s` }}
//                   onClick={() => setLightbox({ type: item.type, src: item.src })}>
//                   {item.type === "video"
//                     ? <video src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} muted playsInline
//                         onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//                         onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime=0; }}
//                       />
//                     : <img src={item.src} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt={item.caption||"post"} />
//                   }
//                   <span className="pf-badge" style={{ background:item.type==="video"?"rgba(79,70,229,0.82)":"rgba(245,158,11,0.82)", color:"#fff" }}>
//                     {item.type==="video" ? "🎬 Reel" : "📷 Post"}
//                   </span>
//                   <div className="pf-actions" onClick={e => e.stopPropagation()}>
//                     <button className="pf-action-btn pf-action-delete" title="Delete post"
//                       disabled={deletingId === item.postId} onClick={() => setConfirmDelete(item.postId)}>
//                       {deletingId === item.postId ? "⏳" : "🗑"}
//                     </button>
//                   </div>
//                   <div className="pf-overlay">
//                     {item.caption && <span className="pf-caption">{item.caption}</span>}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// // ─── Main ViewProfile ───────────────────────────────────────
// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile]     = useState<any>(null);
//   const [user, setUser]           = useState<any>(null);
//   const [loading, setLoading]     = useState(true);
//   // ✅ lightbox for profile image
//   const [imgLightbox, setImgLightbox] = useState(false);

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);

//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) {
//           setProfile(data.profile);
//         } else {
//           // ✅ fallback: use localStorage data as profile
//           setProfile(null);
//         }
//       })
//       .catch(() => {
//         // ✅ even on error, show localStorage data — don't block
//         setProfile(null);
//       })
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   // ✅ Build display data — merge API profile + localStorage fallback
//   const storedUser   = JSON.parse(typeof window !== "undefined" ? localStorage.getItem("cb_user") || "{}" : "{}");
//   const isBrand      = (profile?.role || storedUser?.role || "").toLowerCase() === "brand";
//   const displayName  = profile
//     ? (isBrand ? (profile.companyName || profile.name) : profile.name) || storedUser?.name || ""
//     : storedUser?.name || "";
//   const displayEmail      = storedUser?.email || "";
//   const displayRole       = profile?.role || storedUser?.role || "";
//   const displayBio        = profile?.bio || "";
//   const displayLocation   = profile?.location || profile?.city || "";
//   const displayPhone      = profile?.phone || "";
//   const displayPlatform   = profile?.platform || "";
//   const displayFollowers  = profile?.followers || "";
//   const displayProfileImg = profile?.profileImage || storedUser?.profileImage || "";
//   const displayCompany    = profile?.companyName || "";
//   const displayWebsite    = profile?.website || "";
//   const displayCreatedAt  = profile?.createdAt || storedUser?.createdAt || "";
//   const categories        = getCategories(profile?.categories || storedUser?.categories);
//   const initial           = getInitial(displayName);

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
//         @keyframes spin   { to { transform:rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
//         @keyframes imgFadeIn { from{opacity:0} to{opacity:1} }
//         .vp-fade   { animation:fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay:0.05s; }
//         .vp-fade-2 { animation-delay:0.12s; }
//         .vp-fade-3 { animation-delay:0.20s; }
//         .vp-fade-4 { animation-delay:0.28s; }
//         .vp-fade-5 { animation-delay:0.35s; }
//         .vp-edit-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:none; background:#111; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s,transform 0.15s; }
//         .vp-edit-btn:hover { background:#333; transform:translateY(-1px); }
//         .vp-bank-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:1.5px solid #ebebeb; background:#fff; color:#111; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.2s; }
//         .vp-bank-btn:hover { border-color:#4f46e5; color:#4f46e5; transform:translateY(-1px); }
//         .vp-tag { display:inline-block; padding:5px 13px; border-radius:100px; font-size:12px; font-weight:500; font-family:'DM Sans',sans-serif; text-transform:capitalize; }
//         .vp-stat { background:#fff; border-radius:14px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.05); border:1px solid #ebebeb; display:flex; flex-direction:column; gap:4px; transition:transform 0.2s; }
//         .vp-stat:hover { transform:translateY(-2px); }
//         .vp-stat-val { font-size:20px; font-weight:600; color:#111; font-family:'DM Sans',sans-serif; }
//         .vp-stat-lbl { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
//         .vp-info-row { display:flex; align-items:flex-start; gap:12px; padding:14px 0; border-bottom:1px solid #f0f0f0; }
//         .vp-info-row:last-child { border-bottom:none; }
//         .vp-icon { width:34px; height:34px; border-radius:10px; background:#f5f5f0; display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
//         .vp-info-label { font-size:11px; color:#aaa; font-weight:500; text-transform:uppercase; letter-spacing:0.05em; }
//         .vp-info-val { font-size:14px; color:#222; font-weight:500; margin-top:3px; }
//         .vp-info-val.empty { color:#ccc; font-style:italic; font-weight:400; }
//         .vp-header-row { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
//         .vp-edit-desktop { display:inline-flex; }
//         .vp-banner-edit  { display:none; }
//         .vp-portfolio-btn { width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.25); }
//         .vp-portfolio-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.35); }
//         /* ✅ avatar click hover */
//         .vp-avatar-wrap { position:relative; cursor:pointer; }
//         .vp-avatar-hover-overlay { position:absolute; inset:0; border-radius:50%; background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; font-weight:600; }
//         .vp-avatar-wrap:hover .vp-avatar-hover-overlay { opacity:1; }
//         /* ✅ img lightbox */
//         .vp-img-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.9); display:flex; align-items:center; justify-content:center; animation:imgFadeIn 0.2s ease; cursor:zoom-out; }
//         .vp-img-lightbox img { max-width:90vw; max-height:90vh; border-radius:50%; object-fit:cover; box-shadow:0 24px 80px rgba(0,0,0,0.8); }
//         .vp-img-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
//         @media(max-width:480px) {
//           .vp-edit-desktop { display:none !important; }
//           .vp-banner-edit  { display:inline-flex !important; }
//           .vp-stat-val { font-size:17px; }
//         }
//       `}</style>

//       {/* ✅ Profile image lightbox */}
//       {imgLightbox && displayProfileImg && (
//         <div className="vp-img-lightbox" onClick={() => setImgLightbox(false)}>
//           <button className="vp-img-lightbox-close" onClick={() => setImgLightbox(false)}>✕</button>
//           <img src={displayProfileImg} alt="profile" onClick={e => e.stopPropagation()} />
//         </div>
//       )}

//       <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", background:"#f5f5f0" }}>

//         {/* BANNER */}
//         <div style={{ background:"#111", height:160, position:"relative" }}>
//           <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
//             <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
//               style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit
//             </button>
//             {!isBrand && (
//               <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/Bankdetails")}
//                 style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
//                 🏦 Bank
//               </button>
//             )}
//           </div>
//         </div>

//         <div style={{ maxWidth:680, margin:"0 auto", padding:"0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop:-56, marginBottom:20 }}>
//             {/* ✅ Avatar — image or letter initial, clickable */}
//             <div className="vp-avatar-wrap" onClick={() => displayProfileImg && setImgLightbox(true)}>
//               {displayProfileImg ? (
//                 <img
//                   src={displayProfileImg}
//                   alt="avatar"
//                   style={{ width:108, height:108, borderRadius:"50%", objectFit:"cover", border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)", display:"block" }}
//                 />
//               ) : (
//                 /* ✅ Letter avatar when no profile image */
//                 <div style={{
//                   width:108, height:108, borderRadius:"50%",
//                   background:"linear-gradient(135deg,#4f46e5,#7c3aed)",
//                   border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)",
//                   display:"flex", alignItems:"center", justifyContent:"center",
//                   fontSize:42, fontWeight:700, color:"#fff",
//                   fontFamily:"'DM Sans',sans-serif",
//                 }}>
//                   {initial}
//                 </div>
//               )}
//               {displayProfileImg && (
//                 <div className="vp-avatar-hover-overlay">View</div>
//               )}
//               <div style={{ position:"absolute", bottom:5, right:5, width:16, height:16, borderRadius:"50%", background:isBrand?"#6366f1":"#10b981", border:"3px solid #f5f5f0" }} />
//             </div>

//             <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
//               <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>✏️ Edit Profile</button>
//               {!isBrand && (
//                 <button className="vp-bank-btn vp-edit-desktop" onClick={() => router.push("/Bankdetails")}>🏦 Bank Details</button>
//               )}
//             </div>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom:20 }}>
//             <h1 style={{ fontSize:"clamp(20px,5vw,26px)", fontWeight:600, color: displayName ? "#111" : "#bbb", lineHeight:1.2, fontFamily:"'DM Sans',sans-serif" }}>
//               {displayName || "Your Name"}
//             </h1>
//             <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
//               {displayRole && (
//                 <span className="vp-tag" style={{ background:isBrand?"#eef2ff":"#ecfdf5", color:isBrand?"#6366f1":"#10b981" }}>
//                   {capitalize(displayRole)}
//                 </span>
//               )}
//               {categories.length > 0
//                 ? categories.map((cat, i) => (
//                     <span key={i} className="vp-tag" style={{ background:"#fef3c7", color:"#d97706" }}>{capitalize(cat)}</span>
//                   ))
//                 : <span className="vp-tag" style={{ background:"#f5f5f3", color:"#ccc" }}>No category yet</span>
//               }
//               {displayLocation
//                 ? <span style={{ fontSize:13, color:"#888", display:"flex", alignItems:"center", gap:4 }}>📍 {capitalize(displayLocation)}</span>
//                 : <span style={{ fontSize:13, color:"#ccc", fontStyle:"italic" }}>📍 City not set</span>
//               }
//             </div>
//             {displayEmail && <p style={{ fontSize:13, color:"#aaa", marginTop:6 }}>{displayEmail}</p>}
//           </div>

//           {/* BIO */}
//           <div className="vp-fade vp-fade-2" style={{ background:"#fff", borderRadius:14, padding:"18px 20px", marginBottom:16, border:"1px solid #ebebeb" }}>
//             <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>About</p>
//             <p style={{ fontSize:14, color: displayBio ? "#444" : "#ccc", lineHeight:1.7, fontWeight:400, fontStyle: displayBio ? "normal" : "italic" }}>
//               {displayBio || "No bio added yet. Edit your profile to add one."}
//             </p>
//           </div>

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:16 }}>
//             {!isBrand && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val" style={{ color: displayFollowers ? "#111" : "#ccc" }}>
//                   {displayFollowers ? getFollowerLabel(displayFollowers) : "—"}
//                 </span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{displayPlatform ? "🔗" : "—"}</span>
//                 <span className="vp-stat-lbl">Platform</span>
//               </div>
//             )}
//             <div className="vp-stat">
//               <span className="vp-stat-val" style={{ fontSize: categories.length > 1 ? 13 : 20, color: categories.length > 0 ? "#111" : "#ccc" }}>
//                 {categories.length > 0 ? categories.map(capitalize).join(", ") : "—"}
//               </span>
//               <span className="vp-stat-lbl">Categor{categories.length > 1 ? "ies" : "y"}</span>
//             </div>
//           </div>

//           {/* INFO CARD — always show all fields */}
//           <div className="vp-fade vp-fade-3" style={{ background:"#fff", borderRadius:14, padding:"8px 20px", border:"1px solid #ebebeb", marginBottom:20 }}>
//             <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", padding:"14px 0 4px" }}>Details</p>

//             {/* Name */}
//             <div className="vp-info-row">
//               <div className="vp-icon">👤</div>
//               <div>
//                 <p className="vp-info-label">Name</p>
//                 <p className={`vp-info-val ${!displayName ? "empty" : ""}`}>{displayName || "Not set"}</p>
//               </div>
//             </div>

//             {/* Phone */}
//             <div className="vp-info-row">
//               <div className="vp-icon">📞</div>
//               <div>
//                 <p className="vp-info-label">Phone</p>
//                 <p className={`vp-info-val ${!displayPhone ? "empty" : ""}`}>{displayPhone || "Not set"}</p>
//               </div>
//             </div>

//             {/* City */}
//             <div className="vp-info-row">
//               <div className="vp-icon">📍</div>
//               <div>
//                 <p className="vp-info-label">City</p>
//                 <p className={`vp-info-val ${!displayLocation ? "empty" : ""}`}>{displayLocation ? capitalize(displayLocation) : "Not set"}</p>
//               </div>
//             </div>

//             {/* Categories */}
//             <div className="vp-info-row">
//               <div className="vp-icon">🏷️</div>
//               <div>
//                 <p className="vp-info-label">Categories</p>
//                 {categories.length > 0 ? (
//                   <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:5 }}>
//                     {categories.map((cat, i) => (
//                       <span key={i} style={{ padding:"3px 10px", borderRadius:"100px", background:"#fef3c7", color:"#d97706", fontSize:12, fontWeight:600, textTransform:"capitalize" }}>
//                         {capitalize(cat)}
//                       </span>
//                     ))}
//                   </div>
//                 ) : (
//                   <p className="vp-info-val empty">Not set</p>
//                 )}
//               </div>
//             </div>

//             {/* Platform — influencer only */}
//             {!isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   {displayPlatform
//                     ? <a href={displayPlatform} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayPlatform}</a>
//                     : <p className="vp-info-val empty">Not set</p>
//                   }
//                 </div>
//               </div>
//             )}

//             {/* Company — brand only */}
//             {isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div>
//                   <p className="vp-info-label">Company</p>
//                   <p className={`vp-info-val ${!displayCompany ? "empty" : ""}`}>{displayCompany || "Not set"}</p>
//                 </div>
//               </div>
//             )}

//             {/* Website — brand only */}
//             {isBrand && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   {displayWebsite
//                     ? <a href={displayWebsite} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{displayWebsite}</a>
//                     : <p className="vp-info-val empty">Not set</p>
//                   }
//                 </div>
//               </div>
//             )}

//             {/* Member since */}
//             {displayCreatedAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">{new Date(displayCreatedAt).toLocaleDateString("en-IN", { year:"numeric", month:"long" })}</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* PORTFOLIO UPLOAD CTA */}
//           {!isBrand && (
//             <div className="vp-fade vp-fade-4" style={{ background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:14, padding:"22px 20px", border:"1.5px solid #e8e5ff", marginBottom:16 }}>
//               <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
//                 <div style={{ width:44, height:44, borderRadius:12, background:"linear-gradient(135deg,#4f46e5,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>🎬</div>
//                 <div>
//                   <div style={{ fontSize:15, fontWeight:700, color:"#111", fontFamily:"'DM Sans',sans-serif" }}>Your Portfolio</div>
//                   <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Showcase your best content to brands</div>
//                 </div>
//               </div>
//               <p style={{ fontSize:13, color:"#666", lineHeight:1.7, marginBottom:16, fontFamily:"'DM Sans',sans-serif" }}>
//                 Upload up to <strong style={{ color:"#4f46e5" }}>2 Reels</strong> and <strong style={{ color:"#f59e0b" }}>3 Posts</strong> to showcase your work.
//               </p>
//               <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>📤 Upload My Portfolio</button>
//             </div>
//           )}

//           {/* PORTFOLIO GRID */}
//           {!isBrand && <PortfolioSection />}

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-5" style={{ textAlign:"center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding:"12px 30px", fontSize:14 }}>✏️ Edit Profile</button>
//             <p style={{ fontSize:12, color:"#bbb", marginTop:10, fontWeight:400 }}>You can update this anytime from your profile settings</p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center:  { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" },
//   spinner: { width:34, height:34, borderRadius:"50%", border:"3px solid #e5e7eb", borderTopColor:"#111", animation:"spin 0.7s linear infinite" },
//   btnMain: { marginTop:16, padding:"11px 26px", borderRadius:"100px", background:"#111", color:"#fff", fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14, border:"none", cursor:"pointer" },
// };


