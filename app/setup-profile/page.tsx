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

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token || "";
    const currentUserId = storedUser._id || storedUser.id || "";
    if (!token) { setLoading(false); return; }

    fetch(`${API_BASE}/posts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (res.status === 404 || res.status === 405 || res.status === 400) {
          const fallback = await fetch(`${API_BASE}/posts`, { headers: { Authorization: `Bearer ${token}` } });
          const d = await fallback.json();
          const allPosts: PortfolioPost[] = d.data || d.posts || [];
          // const mine = currentUserId ? allPosts.filter(p => (p.user || p.userId) === currentUserId) : allPosts;
          const mine = currentUserId
  ? allPosts.filter(p => 
      (typeof p.user === "object" ? p.user._id : p.user || p.userId) === currentUserId
    )
  : allPosts;
          return { success: true, data: mine };
        }
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: any) => {
        if (data.success && Array.isArray(data.data)) setPosts(data.data);
        else if (data.success && Array.isArray(data.posts)) setPosts(data.posts);
        else setError("Could not load portfolio.");
      })
      .catch(() => setError("Could not load portfolio."))
      .finally(() => setLoading(false));
  }, []);

  const allItems = posts.flatMap((post) => [
    ...post.urls.map((src) => ({ type: "video" as const, src, caption: post.caption, _id: post._id + src })),
    ...post.images.map((src) => ({ type: "image" as const, src, caption: post.caption, _id: post._id + src })),
  ]);

  const reels = allItems.filter((i) => i.type === "video");
  const imgs  = allItems.filter((i) => i.type === "image");
  const displayed = activeTab === "reels" ? reels : activeTab === "posts" ? imgs : allItems;

  return (
    <>
      <style>{`
        @keyframes portfolioFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .pf-item { position:relative; border-radius:14px; overflow:hidden; aspect-ratio:4/5; cursor:pointer; background:#1a1a2e; animation:portfolioFadeIn 0.3s ease both; border:1.5px solid rgba(255,255,255,0.06); transition:transform 0.2s,box-shadow 0.2s; }
        .pf-item:hover { transform:translateY(-3px) scale(1.01); box-shadow:0 12px 32px rgba(0,0,0,0.18); }
        .pf-item:hover .pf-overlay { opacity:1; }
        .pf-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.72) 0%,transparent 55%); opacity:0; transition:opacity 0.2s; display:flex; align-items:flex-end; padding:12px; }
        .pf-caption { font-size:11px; color:rgba(255,255,255,0.9); font-family:'DM Sans',sans-serif; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; }
        .pf-badge { position:absolute; top:9px; left:9px; padding:3px 9px; border-radius:100px; font-size:10px; font-weight:600; font-family:'DM Sans',sans-serif; backdrop-filter:blur(6px); }
        .pf-tab { padding:7px 18px; border-radius:100px; border:none; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.18s; letter-spacing:0.02em; }
        .pf-tab-active { background:#111; color:#fff; }
        .pf-tab-idle { background:transparent; color:#999; }
        .pf-tab:hover { color:#111; }
        .pf-lightbox { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.92); display:flex; align-items:center; justify-content:center; animation:portfolioFadeIn 0.2s ease; }
        .pf-lightbox-close { position:fixed; top:20px; right:20px; width:40px; height:40px; border-radius:50%; background:rgba(255,255,255,0.12); border:none; color:#fff; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s; }
        .pf-lightbox-close:hover { background:rgba(255,255,255,0.25); }
        .pf-lightbox-media { max-width:92vw; max-height:88vh; border-radius:16px; object-fit:contain; box-shadow:0 24px 80px rgba(0,0,0,0.6); }
      `}</style>

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
          {!loading && error && <div style={{ textAlign:"center", padding:"24px 0" }}><p style={{ fontSize:13, color:"#dc2626", fontFamily:"'DM Sans',sans-serif" }}>{error}</p></div>}
          {!loading && !error && displayed.length === 0 && (
            <div style={{ textAlign:"center", padding:"32px 16px", background:"linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius:12, border:"1.5px dashed #d8d4ff" }}>
              <div style={{ fontSize:36, marginBottom:10 }}>🎞️</div>
              <p style={{ fontSize:14, fontWeight:600, color:"#4f46e5", fontFamily:"'DM Sans',sans-serif", marginBottom:4 }}>No portfolio yet</p>
              <p style={{ fontSize:12, color:"#aaa", fontFamily:"'DM Sans',sans-serif", lineHeight:1.6 }}>Upload reels & posts from the Portfolio section above to showcase your work to brands.</p>
            </div>
          )}
          {!loading && !error && displayed.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))", gap:10 }}>
              {displayed.map((item, i) => (
                <div key={item._id} className="pf-item" style={{ animationDelay:`${i*0.05}s` }} onClick={() => setLightbox({ type:item.type, src:item.src })}>
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
                  <div className="pf-overlay">{item.caption && <span className="pf-caption">{item.caption}</span>}</div>
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
  const [profile, setProfile] = useState<any>(null);
  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token;
    if (!token) { router.push("/login"); return; }
    setUser(storedUser);
    fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
      .then((data) => {
        if (data.success && data.profile) setProfile(data.profile);
        else setError("Profile not found. Please set up your profile first.");
      })
      .catch(() => setError("Could not load profile. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={styles.center}>
      <div style={styles.spinner} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={styles.center}>
      <div style={{ textAlign:"center", padding:"0 24px" }}>
        <div style={{ fontSize:48, marginBottom:12 }}>😕</div>
        <p style={{ color:"#666", fontFamily:"DM Sans, sans-serif", fontSize:15 }}>{error}</p>
        <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
      </div>
    </div>
  );

  const isBrand  = profile.role === "brand";
  const name     = isBrand ? profile.companyName : profile.name;
  const category = Array.isArray(profile.categories) ? profile.categories[0] : profile.categories;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin   { to { transform:rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .vp-fade   { animation:fadeUp 0.4s ease both; }
        .vp-fade-1 { animation-delay:0.05s; }
        .vp-fade-2 { animation-delay:0.12s; }
        .vp-fade-3 { animation-delay:0.20s; }
        .vp-fade-4 { animation-delay:0.28s; }
        .vp-fade-5 { animation-delay:0.35s; }
        .vp-edit-btn { display:inline-flex; align-items:center; gap:6px; padding:10px 20px; border-radius:100px; border:none; background:#111; color:#fff; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; cursor:pointer; transition:background 0.2s,transform 0.15s; }
        .vp-edit-btn:hover { background:#333; transform:translateY(-1px); }
        /* ✅ Bank button */
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
        .vp-header-row { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; }
        .vp-edit-desktop { display:inline-flex; }
        .vp-banner-edit  { display:none; }
        .vp-portfolio-btn { width:100%; padding:14px; border-radius:12px; border:none; cursor:pointer; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-family:'DM Sans',sans-serif; font-size:14px; font-weight:600; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 16px rgba(79,70,229,0.25); }
        .vp-portfolio-btn:hover { transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.35); }
        @media(max-width:480px) {
          .vp-edit-desktop { display:none !important; }
          .vp-banner-edit  { display:inline-flex !important; }
          .vp-stat-val { font-size:17px; }
        }
      `}</style>

      <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh", background:"#f5f5f0" }}>

        {/* BANNER */}
        <div style={{ background:"#111", height:160, position:"relative" }}>
          {/* ✅ Mobile: Edit + Bank buttons */}
          <div style={{ position:"absolute", top:16, right:16, display:"flex", gap:8 }}>
            <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
              style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
              ✏️ Edit
            </button>
            {!isBrand && (
              <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/bank-details")}
                style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
                🏦 Bank
              </button>
            )}
          </div>
        </div>

        <div style={{ maxWidth:680, margin:"0 auto", padding:"0 16px 60px" }}>

          {/* AVATAR ROW */}
          <div className="vp-fade vp-header-row" style={{ marginTop:-56, marginBottom:20 }}>
            <div style={{ position:"relative" }}>
              <img
                src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
                alt="avatar"
                style={{ width:108, height:108, borderRadius:"50%", objectFit:"cover", border:"4px solid #f5f5f0", boxShadow:"0 4px 16px rgba(0,0,0,0.14)" }}
              />
              <div style={{ position:"absolute", bottom:5, right:5, width:16, height:16, borderRadius:"50%", background:isBrand?"#6366f1":"#10b981", border:"3px solid #f5f5f0" }} />
            </div>

            {/* ✅ Desktop: Edit Profile + Bank Details side by side */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>
                ✏️ Edit Profile
              </button>
              {!isBrand && (
                <button className="vp-bank-btn vp-edit-desktop" onClick={() => router.push("/Bankdetails")}>
                  🏦 Bank Details
                </button>
              )}
            </div>
          </div>

          {/* NAME & BADGES */}
          <div className="vp-fade vp-fade-1" style={{ marginBottom:20 }}>
            <h1 style={{ fontSize:"clamp(20px,5vw,26px)", fontWeight:600, color:"#111", lineHeight:1.2, fontFamily:"'DM Sans',sans-serif" }}>
              {name || user?.name || "Your Name"}
            </h1>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:8, flexWrap:"wrap" }}>
              <span className="vp-tag" style={{ background:isBrand?"#eef2ff":"#ecfdf5", color:isBrand?"#6366f1":"#10b981" }}>
                {capitalize(profile.role || "")}
              </span>
              {category && <span className="vp-tag" style={{ background:"#fef3c7", color:"#d97706" }}>{capitalize(category)}</span>}
              {profile.location && <span style={{ fontSize:13, color:"#888", display:"flex", alignItems:"center", gap:4 }}>📍 {capitalize(profile.location)}</span>}
            </div>
            {user?.email && <p style={{ fontSize:13, color:"#aaa", marginTop:6 }}>{user.email}</p>}
          </div>

          {/* BIO */}
          {profile.bio && (
            <div className="vp-fade vp-fade-2" style={{ background:"#fff", borderRadius:14, padding:"18px 20px", marginBottom:16, border:"1px solid #ebebeb" }}>
              <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>About</p>
              <p style={{ fontSize:14, color:"#444", lineHeight:1.7, fontWeight:400 }}>{profile.bio}</p>
            </div>
          )}

          {/* STATS */}
          <div className="vp-fade vp-fade-2" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(130px, 1fr))", gap:10, marginBottom:16 }}>
            {!isBrand && profile.followers && (
              <div className="vp-stat"><span className="vp-stat-val">{getFollowerLabel(profile.followers)}</span><span className="vp-stat-lbl">Followers</span></div>
            )}
            {!isBrand && profile.platform && (
              <div className="vp-stat"><span className="vp-stat-val">🔗</span><span className="vp-stat-lbl">Platform Linked</span></div>
            )}
            {category && (
              <div className="vp-stat"><span className="vp-stat-val">{capitalize(category)}</span><span className="vp-stat-lbl">Category</span></div>
            )}
          </div>

          {/* INFO CARD */}
          <div className="vp-fade vp-fade-3" style={{ background:"#fff", borderRadius:14, padding:"8px 20px", border:"1px solid #ebebeb", marginBottom:20 }}>
            <p style={{ fontSize:11, fontWeight:500, color:"#aaa", textTransform:"uppercase", letterSpacing:"0.06em", padding:"14px 0 4px" }}>Details</p>
            {profile.phone && String(profile.phone).trim() !== "" && (
              <div className="vp-info-row"><div className="vp-icon">📞</div><div><p className="vp-info-label">Phone</p><p className="vp-info-val">{String(profile.phone)}</p></div></div>
            )}
            {profile.location && (
              <div className="vp-info-row"><div className="vp-icon">📍</div><div><p className="vp-info-label">City</p><p className="vp-info-val">{capitalize(profile.location)}</p></div></div>
            )}
            {!isBrand && profile.platform && (
              <div className="vp-info-row">
                <div className="vp-icon">🔗</div>
                <div><p className="vp-info-label">Platform</p><a href={profile.platform} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{profile.platform}</a></div>
              </div>
            )}
            {isBrand && profile.companyName && (
              <div className="vp-info-row"><div className="vp-icon">🏢</div><div><p className="vp-info-label">Company</p><p className="vp-info-val">{profile.companyName}</p></div></div>
            )}
            {isBrand && profile.website && (
              <div className="vp-info-row">
                <div className="vp-icon">🌐</div>
                <div><p className="vp-info-label">Website</p><a href={profile.website} target="_blank" rel="noreferrer" style={{ fontSize:14, color:"#6366f1", fontWeight:500, marginTop:3, display:"block", wordBreak:"break-all", textDecoration:"none" }}>{profile.website}</a></div>
              </div>
            )}
            {isBrand && profile.industry && (
              <div className="vp-info-row"><div className="vp-icon">🏭</div><div><p className="vp-info-label">Industry</p><p className="vp-info-val">{capitalize(profile.industry)}</p></div></div>
            )}
            {profile.createdAt && (
              <div className="vp-info-row"><div className="vp-icon">📅</div><div><p className="vp-info-label">Member Since</p><p className="vp-info-val">{new Date(profile.createdAt).toLocaleDateString("en-IN", { year:"numeric", month:"long" })}</p></div></div>
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
  center: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f0", fontFamily:"'DM Sans',sans-serif" },
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

// // ─── Portfolio Types ───────────────────────────────────────
// type PortfolioPost = {
//   _id: string;
//   urls: string[];    // video reels
//   images: string[];  // post images
//   caption: string;
//   createdAt: string;
// };

// // ─── Portfolio Section Component ───────────────────────────
// function PortfolioSection() {
//   const [posts, setPosts]     = useState<PortfolioPost[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");
//   const [activeTab, setActiveTab] = useState<"all" | "reels" | "posts">("all");
//   const [lightbox, setLightbox] = useState<{ type: "video" | "image"; src: string } | null>(null);

//   useEffect(() => {
//     const token = localStorage.getItem("token") || "";
//     if (!token) { setLoading(false); return; }

//     fetch(`${API_BASE}/posts`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       // .then((data) => {
//       //   if (data.success && Array.isArray(data.posts)) setPosts(data.posts);
//       //   else setError("Could not load portfolio.");
//       // })
//       .then((data) => {
//   if (data.success && Array.isArray(data.data)) {
//     setPosts(data.data); // ✅ FIX
//   } else {
//     setError("Could not load portfolio.");
//   }
// })
//       .catch(() => setError("Could not load portfolio."))
//       .finally(() => setLoading(false));
//   }, []);

//   // Flatten into grid items
//   const allItems = posts.flatMap((post) => [
//     ...post.urls.map((src) => ({ type: "video" as const, src, caption: post.caption, _id: post._id + src })),
//     ...post.images.map((src) => ({ type: "image" as const, src, caption: post.caption, _id: post._id + src })),
//   ]);

//   const reels = allItems.filter((i) => i.type === "video");
//   const imgs  = allItems.filter((i) => i.type === "image");

//   const displayed =
//     activeTab === "reels" ? reels :
//     activeTab === "posts" ? imgs  :
//     allItems;

//   return (
//     <>
//       <style>{`
//         @keyframes portfolioFadeIn {
//           from { opacity: 0; transform: translateY(10px); }
//           to   { opacity: 1; transform: translateY(0); }
//         }
//         .pf-item {
//           position: relative; border-radius: 14px; overflow: hidden;
//           aspect-ratio: 4/5; cursor: pointer;
//           background: #1a1a2e;
//           animation: portfolioFadeIn 0.3s ease both;
//           border: 1.5px solid rgba(255,255,255,0.06);
//           transition: transform 0.2s, box-shadow 0.2s;
//         }
//         .pf-item:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 12px 32px rgba(0,0,0,0.18); }
//         .pf-item:hover .pf-overlay { opacity: 1; }
//         .pf-overlay {
//           position: absolute; inset: 0;
//           background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 55%);
//           opacity: 0; transition: opacity 0.2s;
//           display: flex; align-items: flex-end; padding: 12px;
//         }
//         .pf-caption {
//           font-size: 11px; color: rgba(255,255,255,0.9);
//           font-family: 'DM Sans', sans-serif; font-weight: 500;
//           white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
//           max-width: 100%;
//         }
//         .pf-badge {
//           position: absolute; top: 9px; left: 9px;
//           padding: 3px 9px; border-radius: 100px;
//           font-size: 10px; font-weight: 600;
//           font-family: 'DM Sans', sans-serif;
//           backdrop-filter: blur(6px);
//         }
//         .pf-tab {
//           padding: 7px 18px; border-radius: 100px; border: none;
//           font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600;
//           cursor: pointer; transition: all 0.18s; letter-spacing: 0.02em;
//         }
//         .pf-tab-active  { background: #111; color: #fff; }
//         .pf-tab-idle    { background: transparent; color: #999; }
//         .pf-tab:hover   { color: #111; }

//         /* Lightbox */
//         .pf-lightbox {
//           position: fixed; inset: 0; z-index: 9999;
//           background: rgba(0,0,0,0.92); display: flex;
//           align-items: center; justify-content: center;
//           animation: portfolioFadeIn 0.2s ease;
//         }
//         .pf-lightbox-close {
//           position: fixed; top: 20px; right: 20px;
//           width: 40px; height: 40px; border-radius: 50%;
//           background: rgba(255,255,255,0.12); border: none;
//           color: #fff; font-size: 18px; cursor: pointer;
//           display: flex; align-items: center; justify-content: center;
//           transition: background 0.2s;
//         }
//         .pf-lightbox-close:hover { background: rgba(255,255,255,0.25); }
//         .pf-lightbox-media {
//           max-width: 92vw; max-height: 88vh;
//           border-radius: 16px; object-fit: contain;
//           box-shadow: 0 24px 80px rgba(0,0,0,0.6);
//         }
//       `}</style>

//       {/* Lightbox */}
//       {lightbox && (
//         <div className="pf-lightbox" onClick={() => setLightbox(null)}>
//           <button className="pf-lightbox-close" onClick={() => setLightbox(null)}>✕</button>
//           {lightbox.type === "video" ? (
//             <video
//               src={lightbox.src}
//               className="pf-lightbox-media"
//               controls autoPlay
//               onClick={(e) => e.stopPropagation()}
//             />
//           ) : (
//             <img
//               src={lightbox.src}
//               className="pf-lightbox-media"
//               alt="portfolio"
//               onClick={(e) => e.stopPropagation()}
//             />
//           )}
//         </div>
//       )}

//       {/* Section wrapper */}
//       <div style={{
//         background: "#fff",
//         borderRadius: 16,
//         border: "1px solid #ebebeb",
//         overflow: "hidden",
//         marginBottom: 24,
//         animation: "portfolioFadeIn 0.4s ease 0.32s both",
//       }}>
//         {/* Header */}
//         <div style={{
//           padding: "20px 20px 0",
//           borderBottom: "1px solid #f0f0f0",
//           marginBottom: 0,
//         }}>
//           <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
//             <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//               <div style={{
//                 width: 36, height: 36, borderRadius: 10,
//                 background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
//                 display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
//               }}>🎬</div>
//               <div>
//                 <div style={{ fontSize: 15, fontWeight: 700, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>Portfolio</div>
//                 <div style={{ fontSize: 11, color: "#aaa", fontFamily: "'DM Sans', sans-serif" }}>
//                   {reels.length} reel{reels.length !== 1 ? "s" : ""} · {imgs.length} post{imgs.length !== 1 ? "s" : ""}
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Tabs */}
//           <div style={{ display: "flex", gap: 4, paddingBottom: 2 }}>
//             {(["all", "reels", "posts"] as const).map((tab) => (
//               <button
//                 key={tab}
//                 className={`pf-tab ${activeTab === tab ? "pf-tab-active" : "pf-tab-idle"}`}
//                 onClick={() => setActiveTab(tab)}
//               >
//                 {tab === "all"   ? `All (${allItems.length})`   : ""}
//                 {tab === "reels" ? `Reels (${reels.length})`    : ""}
//                 {tab === "posts" ? `Posts (${imgs.length})`     : ""}
//               </button>
//             ))}
//           </div>
//         </div>

//         {/* Content */}
//         <div style={{ padding: "16px 20px 20px" }}>
//           {loading && (
//             <div style={{ textAlign: "center", padding: "32px 0" }}>
//               <div style={{
//                 width: 28, height: 28, borderRadius: "50%",
//                 border: "2.5px solid #e5e7eb", borderTopColor: "#7c3aed",
//                 animation: "spin 0.7s linear infinite", margin: "0 auto 10px",
//               }} />
//               <p style={{ fontSize: 12, color: "#bbb", fontFamily: "'DM Sans', sans-serif" }}>Loading portfolio…</p>
//             </div>
//           )}

//           {!loading && error && (
//             <div style={{ textAlign: "center", padding: "24px 0" }}>
//               <p style={{ fontSize: 13, color: "#dc2626", fontFamily: "'DM Sans', sans-serif" }}>{error}</p>
//             </div>
//           )}

//           {!loading && !error && displayed.length === 0 && (
//             <div style={{
//               textAlign: "center", padding: "32px 16px",
//               background: "linear-gradient(135deg,#fafbff,#f5f0ff)",
//               borderRadius: 12, border: "1.5px dashed #d8d4ff",
//             }}>
//               <div style={{ fontSize: 36, marginBottom: 10 }}>🎞️</div>
//               <p style={{ fontSize: 14, fontWeight: 600, color: "#4f46e5", fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
//                 No portfolio yet
//               </p>
//               <p style={{ fontSize: 12, color: "#aaa", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
//                 Upload reels & posts from the Portfolio section above to showcase your work to brands.
//               </p>
//             </div>
//           )}

//           {!loading && !error && displayed.length > 0 && (
//             <div style={{
//               display: "grid",
//               gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
//               gap: 10,
//             }}>
//               {displayed.map((item, i) => (
//                 <div
//                   key={item._id}
//                   className="pf-item"
//                   style={{ animationDelay: `${i * 0.05}s` }}
//                   onClick={() => setLightbox({ type: item.type, src: item.src })}
//                 >
//                   {item.type === "video" ? (
//                     <video
//                       src={item.src}
//                       style={{ width: "100%", height: "100%", objectFit: "cover" }}
//                       muted playsInline
//                       onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//                       onMouseLeave={(e) => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
//                     />
//                   ) : (
//                     <img
//                       src={item.src}
//                       style={{ width: "100%", height: "100%", objectFit: "cover" }}
//                       alt={item.caption || "post"}
//                     />
//                   )}

//                   {/* Type badge */}
//                   <span
//                     className="pf-badge"
//                     style={{
//                       background: item.type === "video" ? "rgba(79,70,229,0.82)" : "rgba(245,158,11,0.82)",
//                       color: "#fff",
//                     }}
//                   >
//                     {item.type === "video" ? "🎬 Reel" : "📷 Post"}
//                   </span>

//                   {/* Hover overlay with caption */}
//                   <div className="pf-overlay">
//                     {item.caption && (
//                       <span className="pf-caption">{item.caption}</span>
//                     )}
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
//   const [profile, setProfile] = useState<any>(null);
//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);
//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) setProfile(data.profile);
//         else setError("Profile not found. Please set up your profile first.");
//       })
//       .catch(() => setError("Could not load profile. Check your connection."))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   if (error) return (
//     <div style={styles.center}>
//       <div style={{ textAlign: "center", padding: "0 24px" }}>
//         <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//         <p style={{ color: "#666", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>{error}</p>
//         <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
//       </div>
//     </div>
//   );

//   const isBrand  = profile.role === "brand";
//   const name     = isBrand ? profile.companyName : profile.name;
//   const category = Array.isArray(profile.categories) ? profile.categories[0] : profile.categories;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin   { to { transform: rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
//         .vp-fade   { animation: fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay: 0.05s; }
//         .vp-fade-2 { animation-delay: 0.12s; }
//         .vp-fade-3 { animation-delay: 0.20s; }
//         .vp-fade-4 { animation-delay: 0.28s; }
//         .vp-fade-5 { animation-delay: 0.35s; }
//         .vp-edit-btn {
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 10px 20px; border-radius: 100px; border: none;
//           background: #111; color: #fff;
//           font-family: 'DM Sans', sans-serif;
//           font-size: 13px; font-weight: 500; cursor: pointer;
//           transition: background 0.2s, transform 0.15s;
//         }
//         .vp-edit-btn:hover { background: #333; transform: translateY(-1px); }
//         .vp-tag {
//           display: inline-block; padding: 5px 13px; border-radius: 100px;
//           font-size: 12px; font-weight: 500;
//           font-family: 'DM Sans', sans-serif;
//           text-transform: capitalize;
//         }
//         .vp-stat {
//           background: #fff; border-radius: 14px; padding: 18px 20px;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
//           border: 1px solid #ebebeb;
//           display: flex; flex-direction: column; gap: 4px;
//           transition: transform 0.2s;
//         }
//         .vp-stat:hover { transform: translateY(-2px); }
//         .vp-stat-val { font-size: 20px; font-weight: 600; color: #111; font-family: 'DM Sans', sans-serif; }
//         .vp-stat-lbl { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-row {
//           display: flex; align-items: flex-start; gap: 12px;
//           padding: 14px 0; border-bottom: 1px solid #f0f0f0;
//         }
//         .vp-info-row:last-child { border-bottom: none; }
//         .vp-icon { width: 34px; height: 34px; border-radius: 10px; background: #f5f5f0; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
//         .vp-info-label { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-val { font-size: 14px; color: #222; font-weight: 500; margin-top: 3px; }
//         .vp-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
//         .vp-edit-desktop { display: inline-flex; }
//         .vp-banner-edit  { display: none; }
//         .vp-portfolio-btn {
//           width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer;
//           background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff;
//           font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
//           display: flex; align-items: center; justify-content: center; gap: 8px;
//           transition: all 0.2s; box-shadow: 0 4px 16px rgba(79,70,229,0.25);
//         }
//         .vp-portfolio-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35); }
//         @media(max-width: 480px) {
//           .vp-edit-desktop { display: none !important; }
//           .vp-banner-edit  { display: inline-flex !important; }
//           .vp-stat-val     { font-size: 17px; }
//         }
//       `}</style>

//       <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f5f0" }}>

//         {/* BANNER */}
//         <div style={{ background: "#111", height: 160, position: "relative" }}>
//           <div style={{ position: "absolute", top: 16, right: 16 }}>
//             <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
//               style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit
//             </button>
//           </div>
//         </div>

//         <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop: -56, marginBottom: 20 }}>
//             <div style={{ position: "relative" }}>
//               <img
//                 src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
//                 alt="avatar"
//                 style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #f5f5f0", boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}
//               />
//               <div style={{ position: "absolute", bottom: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: isBrand ? "#6366f1" : "#10b981", border: "3px solid #f5f5f0" }} />
//             </div>
//             <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>
//               ✏️ Edit Profile
//             </button>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom: 20 }}>
//             <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 600, color: "#111", lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>
//               {name || user?.name || "Your Name"}
//             </h1>
//             <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
//               <span className="vp-tag" style={{ background: isBrand ? "#eef2ff" : "#ecfdf5", color: isBrand ? "#6366f1" : "#10b981" }}>
//                 {capitalize(profile.role || "")}
//               </span>
//               {category && (
//                 <span className="vp-tag" style={{ background: "#fef3c7", color: "#d97706" }}>
//                   {capitalize(category)}
//                 </span>
//               )}
//               {profile.location && (
//                 <span style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
//                   📍 {capitalize(profile.location)}
//                 </span>
//               )}
//             </div>
//             {user?.email && <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>{user.email}</p>}
//           </div>

//           {/* BIO */}
//           {profile.bio && (
//             <div className="vp-fade vp-fade-2" style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #ebebeb" }}>
//               <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>About</p>
//               <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, fontWeight: 400 }}>{profile.bio}</p>
//             </div>
//           )}

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
//             {!isBrand && profile.followers && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{getFollowerLabel(profile.followers)}</span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">🔗</span>
//                 <span className="vp-stat-lbl">Platform Linked</span>
//               </div>
//             )}
//             {category && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{capitalize(category)}</span>
//                 <span className="vp-stat-lbl">Category</span>
//               </div>
//             )}
//           </div>

//           {/* INFO CARD */}
//           <div className="vp-fade vp-fade-3" style={{ background: "#fff", borderRadius: 14, padding: "8px 20px", border: "1px solid #ebebeb", marginBottom: 20 }}>
//             <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "14px 0 4px" }}>Details</p>
//             {profile.phone && String(profile.phone).trim() !== "" && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📞</div>
//                 <div><p className="vp-info-label">Phone</p><p className="vp-info-val">{String(profile.phone)}</p></div>
//               </div>
//             )}
//             {profile.location && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📍</div>
//                 <div><p className="vp-info-label">City</p><p className="vp-info-val">{capitalize(profile.location)}</p></div>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   <a href={profile.platform} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.platform}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.companyName && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div><p className="vp-info-label">Company</p><p className="vp-info-val">{profile.companyName}</p></div>
//               </div>
//             )}
//             {isBrand && profile.website && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   <a href={profile.website} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.website}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.industry && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏭</div>
//                 <div><p className="vp-info-label">Industry</p><p className="vp-info-val">{capitalize(profile.industry)}</p></div>
//               </div>
//             )}
//             {profile.createdAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">{new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ✅ PORTFOLIO UPLOAD CTA — only for influencer */}
//           {!isBrand && (
//             <div className="vp-fade vp-fade-4" style={{ background: "linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius: 14, padding: "22px 20px", border: "1.5px solid #e8e5ff", marginBottom: 16 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
//                 <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎬</div>
//                 <div>
//                   <div style={{ fontSize: 15, fontWeight: 700, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>Your Portfolio</div>
//                   <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Showcase your best content to brands</div>
//                 </div>
//               </div>
//               <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
//                 Upload up to <strong style={{ color: "#4f46e5" }}>2 Reels</strong> and <strong style={{ color: "#f59e0b" }}>3 Posts</strong> to showcase your work. Brands will see your portfolio when they view your profile during campaign applications.
//               </p>
//               <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>
//                 📤 Upload My Portfolio
//               </button>
//             </div>
//           )}

//           {/* ✅ PORTFOLIO GRID — influencer only, loaded from GET /posts */}
//           {!isBrand && <PortfolioSection />}

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-5" style={{ textAlign: "center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding: "12px 30px", fontSize: 14 }}>
//               ✏️ Edit Profile
//             </button>
//             <p style={{ fontSize: 12, color: "#bbb", marginTop: 10, fontWeight: 400 }}>
//               You can update this anytime from your profile settings
//             </p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center: {
//     minHeight: "100vh", display: "flex", alignItems: "center",
//     justifyContent: "center", background: "#f5f5f0",
//     fontFamily: "'DM Sans', sans-serif",
//   },
//   spinner: {
//     width: 34, height: 34, borderRadius: "50%",
//     border: "3px solid #e5e7eb", borderTopColor: "#111",
//     animation: "spin 0.7s linear infinite",
//   },
//   btnMain: {
//     marginTop: 16, padding: "11px 26px", borderRadius: "100px",
//     background: "#111", color: "#fff",
//     fontFamily: "'DM Sans', sans-serif",
//     fontWeight: 500, fontSize: 14, border: "none", cursor: "pointer",
//   },
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

// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile] = useState<any>(null);
//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);
//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) setProfile(data.profile);
//         else setError("Profile not found. Please set up your profile first.");
//       })
//       .catch(() => setError("Could not load profile. Check your connection."))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   if (error) return (
//     <div style={styles.center}>
//       <div style={{ textAlign: "center", padding: "0 24px" }}>
//         <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//         <p style={{ color: "#666", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>{error}</p>
//         <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
//       </div>
//     </div>
//   );

//   const isBrand  = profile.role === "brand";
//   const name     = isBrand ? profile.companyName : profile.name;
//   const category = Array.isArray(profile.categories) ? profile.categories[0] : profile.categories;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin   { to { transform: rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
//         .vp-fade   { animation: fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay: 0.05s; }
//         .vp-fade-2 { animation-delay: 0.12s; }
//         .vp-fade-3 { animation-delay: 0.20s; }
//         .vp-fade-4 { animation-delay: 0.28s; }
//         .vp-fade-5 { animation-delay: 0.35s; }
//         .vp-edit-btn {
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 10px 20px; border-radius: 100px; border: none;
//           background: #111; color: #fff;
//           font-family: 'DM Sans', sans-serif;
//           font-size: 13px; font-weight: 500; cursor: pointer;
//           transition: background 0.2s, transform 0.15s;
//         }
//         .vp-edit-btn:hover { background: #333; transform: translateY(-1px); }
//         .vp-tag {
//           display: inline-block; padding: 5px 13px; border-radius: 100px;
//           font-size: 12px; font-weight: 500;
//           font-family: 'DM Sans', sans-serif;
//           text-transform: capitalize;
//         }
//         .vp-stat {
//           background: #fff; border-radius: 14px; padding: 18px 20px;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
//           border: 1px solid #ebebeb;
//           display: flex; flex-direction: column; gap: 4px;
//           transition: transform 0.2s;
//         }
//         .vp-stat:hover { transform: translateY(-2px); }
//         .vp-stat-val { font-size: 20px; font-weight: 600; color: #111; font-family: 'DM Sans', sans-serif; }
//         .vp-stat-lbl { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-row {
//           display: flex; align-items: flex-start; gap: 12px;
//           padding: 14px 0; border-bottom: 1px solid #f0f0f0;
//         }
//         .vp-info-row:last-child { border-bottom: none; }
//         .vp-icon { width: 34px; height: 34px; border-radius: 10px; background: #f5f5f0; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
//         .vp-info-label { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-val { font-size: 14px; color: #222; font-weight: 500; margin-top: 3px; }
//         .vp-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
//         .vp-edit-desktop { display: inline-flex; }
//         .vp-banner-edit  { display: none; }
//         .vp-portfolio-btn {
//           width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer;
//           background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff;
//           font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
//           display: flex; align-items: center; justify-content: center; gap: 8px;
//           transition: all 0.2s; box-shadow: 0 4px 16px rgba(79,70,229,0.25);
//         }
//         .vp-portfolio-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35); }
//         @media(max-width: 480px) {
//           .vp-edit-desktop { display: none !important; }
//           .vp-banner-edit  { display: inline-flex !important; }
//           .vp-stat-val     { font-size: 17px; }
//         }
//       `}</style>

//       <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f5f0" }}>

//         {/* BANNER */}
//         <div style={{ background: "#111", height: 160, position: "relative" }}>
//           <div style={{ position: "absolute", top: 16, right: 16 }}>
//             <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
//               style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit
//             </button>
//           </div>
//         </div>

//         <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop: -56, marginBottom: 20 }}>
//             <div style={{ position: "relative" }}>
//               <img
//                 src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
//                 alt="avatar"
//                 style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #f5f5f0", boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}
//               />
//               <div style={{ position: "absolute", bottom: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: isBrand ? "#6366f1" : "#10b981", border: "3px solid #f5f5f0" }} />
//             </div>
//             <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>
//               ✏️ Edit Profile
//             </button>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom: 20 }}>
//             <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 600, color: "#111", lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>
//               {name || user?.name || "Your Name"}
//             </h1>
//             <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
//               <span className="vp-tag" style={{ background: isBrand ? "#eef2ff" : "#ecfdf5", color: isBrand ? "#6366f1" : "#10b981" }}>
//                 {capitalize(profile.role || "")}
//               </span>
//               {category && (
//                 <span className="vp-tag" style={{ background: "#fef3c7", color: "#d97706" }}>
//                   {capitalize(category)}
//                 </span>
//               )}
//               {profile.location && (
//                 <span style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
//                   📍 {capitalize(profile.location)}
//                 </span>
//               )}
//             </div>
//             {user?.email && <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>{user.email}</p>}
//           </div>

//           {/* BIO */}
//           {profile.bio && (
//             <div className="vp-fade vp-fade-2" style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #ebebeb" }}>
//               <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>About</p>
//               <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, fontWeight: 400 }}>{profile.bio}</p>
//             </div>
//           )}

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
//             {!isBrand && profile.followers && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{getFollowerLabel(profile.followers)}</span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">🔗</span>
//                 <span className="vp-stat-lbl">Platform Linked</span>
//               </div>
//             )}
//             {category && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{capitalize(category)}</span>
//                 <span className="vp-stat-lbl">Category</span>
//               </div>
//             )}
//           </div>

//           {/* INFO CARD */}
//           <div className="vp-fade vp-fade-3" style={{ background: "#fff", borderRadius: 14, padding: "8px 20px", border: "1px solid #ebebeb", marginBottom: 20 }}>
//             <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "14px 0 4px" }}>Details</p>
//             {profile.phone && String(profile.phone).trim() !== "" && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📞</div>
//                 <div><p className="vp-info-label">Phone</p><p className="vp-info-val">{String(profile.phone)}</p></div>
//               </div>
//             )}
//             {profile.location && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📍</div>
//                 <div><p className="vp-info-label">City</p><p className="vp-info-val">{capitalize(profile.location)}</p></div>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   <a href={profile.platform} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.platform}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.companyName && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div><p className="vp-info-label">Company</p><p className="vp-info-val">{profile.companyName}</p></div>
//               </div>
//             )}
//             {isBrand && profile.website && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   <a href={profile.website} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.website}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.industry && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏭</div>
//                 <div><p className="vp-info-label">Industry</p><p className="vp-info-val">{capitalize(profile.industry)}</p></div>
//               </div>
//             )}
//             {profile.createdAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">{new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ✅ PORTFOLIO SECTION — only for influencer */}
//           {!isBrand && (
//             <div className="vp-fade vp-fade-4" style={{ background: "linear-gradient(135deg,#fafbff,#f5f0ff)", borderRadius: 14, padding: "22px 20px", border: "1.5px solid #e8e5ff", marginBottom: 16 }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
//                 <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎬</div>
//                 <div>
//                   <div style={{ fontSize: 15, fontWeight: 700, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>Your Portfolio</div>
//                   <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Showcase your best content to brands</div>
//                 </div>
//               </div>
//               <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
//                 Upload up to <strong style={{ color: "#4f46e5" }}>2 Reels</strong> and <strong style={{ color: "#f59e0b" }}>3 Posts</strong> to showcase your work. Brands will see your portfolio when they view your profile during campaign applications.
//               </p>
//               <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>
//                 📤 Upload My Portfolio
//               </button>
//             </div>
//           )}

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-5" style={{ textAlign: "center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding: "12px 30px", fontSize: 14 }}>
//               ✏️ Edit Profile
//             </button>
//             <p style={{ fontSize: 12, color: "#bbb", marginTop: 10, fontWeight: 400 }}>
//               You can update this anytime from your profile settings
//             </p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center: {
//     minHeight: "100vh", display: "flex", alignItems: "center",
//     justifyContent: "center", background: "#f5f5f0",
//     fontFamily: "'DM Sans', sans-serif",
//   },
//   spinner: {
//     width: 34, height: 34, borderRadius: "50%",
//     border: "3px solid #e5e7eb", borderTopColor: "#111",
//     animation: "spin 0.7s linear infinite",
//   },
//   btnMain: {
//     marginTop: 16, padding: "11px 26px", borderRadius: "100px",
//     background: "#111", color: "#fff",
//     fontFamily: "'DM Sans', sans-serif",
//     fontWeight: 500, fontSize: 14, border: "none", cursor: "pointer",
//   },
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

// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile] = useState<any>(null);
//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);
//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) setProfile(data.profile);
//         else setError("Profile not found. Please set up your profile first.");
//       })
//       .catch(() => setError("Could not load profile. Check your connection."))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   if (error) return (
//     <div style={styles.center}>
//       <div style={{ textAlign: "center", padding: "0 24px" }}>
//         <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//         <p style={{ color: "#666", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>{error}</p>
//         <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
//       </div>
//     </div>
//   );

//   const isBrand  = profile.role === "brand";
//   const name     = isBrand ? profile.companyName : profile.name;
//   const category = Array.isArray(profile.categories) ? profile.categories[0] : profile.categories;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin   { to { transform: rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }
//         .vp-fade   { animation: fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay: 0.05s; }
//         .vp-fade-2 { animation-delay: 0.12s; }
//         .vp-fade-3 { animation-delay: 0.20s; }
//         .vp-fade-4 { animation-delay: 0.28s; }
//         .vp-fade-5 { animation-delay: 0.35s; }
//         .vp-edit-btn {
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 10px 20px; border-radius: 100px; border: none;
//           background: #111; color: #fff;
//           font-family: 'DM Sans', sans-serif;
//           font-size: 13px; font-weight: 500; cursor: pointer;
//           transition: background 0.2s, transform 0.15s;
//         }
//         .vp-edit-btn:hover { background: #333; transform: translateY(-1px); }
//         .vp-tag {
//           display: inline-block; padding: 5px 13px; border-radius: 100px;
//           font-size: 12px; font-weight: 500;
//           font-family: 'DM Sans', sans-serif;
//           text-transform: capitalize;
//         }
//         .vp-stat {
//           background: #fff; border-radius: 14px; padding: 18px 20px;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
//           border: 1px solid #ebebeb;
//           display: flex; flex-direction: column; gap: 4px;
//           transition: transform 0.2s;
//         }
//         .vp-stat:hover { transform: translateY(-2px); }
//         .vp-stat-val { font-size: 20px; font-weight: 600; color: #111; font-family: 'DM Sans', sans-serif; }
//         .vp-stat-lbl { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-row {
//           display: flex; align-items: flex-start; gap: 12px;
//           padding: 14px 0; border-bottom: 1px solid #f0f0f0;
//         }
//         .vp-info-row:last-child { border-bottom: none; }
//         .vp-icon { width: 34px; height: 34px; border-radius: 10px; background: #f5f5f0; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
//         .vp-info-label { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-val { font-size: 14px; color: #222; font-weight: 500; margin-top: 3px; }
//         .vp-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
//         .vp-edit-desktop { display: inline-flex; }
//         .vp-banner-edit  { display: none; }
//         .vp-portfolio-btn {
//           width: 100%; padding: 14px; border-radius: 12px; border: none; cursor: pointer;
//           background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff;
//           font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
//           display: flex; align-items: center; justify-content: center; gap: 8px;
//           transition: all 0.2s; box-shadow: 0 4px 16px rgba(79,70,229,0.25);
//         }
//         .vp-portfolio-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35); }
//         @media(max-width: 480px) {
//           .vp-edit-desktop { display: none !important; }
//           .vp-banner-edit  { display: inline-flex !important; }
//           .vp-stat-val     { font-size: 17px; }
//         }
//       `}</style>

//       <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f5f0" }}>

//         {/* BANNER */}
//         <div style={{ background: "#111", height: 160, position: "relative" }}>
//           <div style={{ position: "absolute", top: 16, right: 16 }}>
//             <button className="vp-edit-btn vp-banner-edit" onClick={() => router.push("/my-profile")}
//               style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit
//             </button>
//           </div>
//         </div>

//         <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop: -56, marginBottom: 20 }}>
//             <div style={{ position: "relative" }}>
//               <img
//                 src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
//                 alt="avatar"
//                 style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #f5f5f0", boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}
//               />
//               <div style={{ position: "absolute", bottom: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: isBrand ? "#6366f1" : "#10b981", border: "3px solid #f5f5f0" }} />
//             </div>
//             <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>
//               ✏️ Edit Profile
//             </button>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom: 20 }}>
//             <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 600, color: "#111", lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>
//               {name || user?.name || "Your Name"}
//             </h1>
//             <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
//               <span className="vp-tag" style={{ background: isBrand ? "#eef2ff" : "#ecfdf5", color: isBrand ? "#6366f1" : "#10b981" }}>
//                 {capitalize(profile.role || "")}
//               </span>
//               {category && (
//                 <span className="vp-tag" style={{ background: "#fef3c7", color: "#d97706" }}>
//                   {capitalize(category)}
//                 </span>
//               )}
//               {profile.location && (
//                 <span style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
//                   📍 {capitalize(profile.location)}
//                 </span>
//               )}
//             </div>
//             {user?.email && <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>{user.email}</p>}
//           </div>

//           {/* BIO */}
//           {profile.bio && (
//             <div className="vp-fade vp-fade-2" style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #ebebeb" }}>
//               <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>About</p>
//               <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, fontWeight: 400 }}>{profile.bio}</p>
//             </div>
//           )}

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
//             {!isBrand && profile.followers && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{getFollowerLabel(profile.followers)}</span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">🔗</span>
//                 <span className="vp-stat-lbl">Platform Linked</span>
//               </div>
//             )}
//             {category && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{capitalize(category)}</span>
//                 <span className="vp-stat-lbl">Niche</span>
//               </div>
//             )}
//           </div>

//           {/* INFO CARD */}
//           <div className="vp-fade vp-fade-3" style={{ background: "#fff", borderRadius: 14, padding: "8px 20px", border: "1px solid #ebebeb", marginBottom: 20 }}>
//             <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "14px 0 4px" }}>Details</p>
//             {profile.phone && String(profile.phone).trim() !== "" && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📞</div>
//                 <div><p className="vp-info-label">Phone</p><p className="vp-info-val">{String(profile.phone)}</p></div>
//               </div>
//             )}
//             {profile.location && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📍</div>
//                 <div><p className="vp-info-label">City</p><p className="vp-info-val">{capitalize(profile.location)}</p></div>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   <a href={profile.platform} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.platform}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.companyName && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div><p className="vp-info-label">Company</p><p className="vp-info-val">{profile.companyName}</p></div>
//               </div>
//             )}
//             {isBrand && profile.website && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   <a href={profile.website} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.website}
//                   </a>
//                 </div>
//               </div>
//             )}
//             {isBrand && profile.industry && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏭</div>
//                 <div><p className="vp-info-label">Industry</p><p className="vp-info-val">{capitalize(profile.industry)}</p></div>
//               </div>
//             )}
//             {profile.createdAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">{new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}</p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ✅ PORTFOLIO SECTION — only for influencer */}
//           {!isBrand && (
//             <div className="vp-fade vp-fade-4" style={{ background: "#fff", borderRadius: 14, padding: "22px 20px", border: "1.5px solid #e8e5ff", marginBottom: 16, background: "linear-gradient(135deg,#fafbff,#f5f0ff)" }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
//                 <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎬</div>
//                 <div>
//                   <div style={{ fontSize: 15, fontWeight: 700, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>Your Portfolio</div>
//                   <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Showcase your best content to brands</div>
//                 </div>
//               </div>
//               <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, marginBottom: 16, fontFamily: "'DM Sans', sans-serif" }}>
//                 Upload up to <strong style={{ color: "#4f46e5" }}>2 Reels</strong> and <strong style={{ color: "#f59e0b" }}>3 Posts</strong> to showcase your work. Brands will see your portfolio when they view your profile during campaign applications.
//               </p>
//               <button className="vp-portfolio-btn" onClick={() => router.push("/portfolio")}>
//                 📤 Upload My Portfolio
//               </button>
//             </div>
//           )}

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-5" style={{ textAlign: "center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding: "12px 30px", fontSize: 14 }}>
//               ✏️ Edit Profile
//             </button>
//             <p style={{ fontSize: 12, color: "#bbb", marginTop: 10, fontWeight: 400 }}>
//               You can update this anytime from your profile settings
//             </p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center: {
//     minHeight: "100vh", display: "flex", alignItems: "center",
//     justifyContent: "center", background: "#f5f5f0",
//     fontFamily: "'DM Sans', sans-serif",
//   },
//   spinner: {
//     width: 34, height: 34, borderRadius: "50%",
//     border: "3px solid #e5e7eb", borderTopColor: "#111",
//     animation: "spin 0.7s linear infinite",
//   },
//   btnMain: {
//     marginTop: 16, padding: "11px 26px", borderRadius: "100px",
//     background: "#111", color: "#fff",
//     fontFamily: "'DM Sans', sans-serif",
//     fontWeight: 500, fontSize: 14, border: "none", cursor: "pointer",
//   },
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

// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile] = useState<any>(null);
//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     if (!token) { router.push("/login"); return; }
//     setUser(storedUser);
//     fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
//       .then((res) => { if (!res.ok) throw new Error("Failed"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) setProfile(data.profile);
//         else setError("Profile not found. Please set up your profile first.");
//       })
//       .catch(() => setError("Could not load profile. Check your connection."))
//       .finally(() => setLoading(false));
//   }, []);

//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//     </div>
//   );

//   if (error) return (
//     <div style={styles.center}>
//       <div style={{ textAlign: "center", padding: "0 24px" }}>
//         <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//         <p style={{ color: "#666", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>{error}</p>
//         <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
//       </div>
//     </div>
//   );

//   const isBrand  = profile.role === "brand";
//   const name     = isBrand ? profile.companyName : profile.name;
//   const category = Array.isArray(profile.categories) ? profile.categories[0] : profile.categories;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }

//         @keyframes spin   { to { transform: rotate(360deg); } }
//         @keyframes fadeUp { from { opacity:0; transform:translateY(16px);} to { opacity:1; transform:translateY(0);} }

//         .vp-fade   { animation: fadeUp 0.4s ease both; }
//         .vp-fade-1 { animation-delay: 0.05s; }
//         .vp-fade-2 { animation-delay: 0.12s; }
//         .vp-fade-3 { animation-delay: 0.20s; }
//         .vp-fade-4 { animation-delay: 0.28s; }

//         .vp-edit-btn {
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 10px 20px; border-radius: 100px; border: none;
//           background: #111; color: #fff;
//           font-family: 'DM Sans', sans-serif;
//           font-size: 13px; font-weight: 500; cursor: pointer;
//           transition: background 0.2s, transform 0.15s;
//         }
//         .vp-edit-btn:hover { background: #333; transform: translateY(-1px); }

//         .vp-tag {
//           display: inline-block; padding: 5px 13px; border-radius: 100px;
//           font-size: 12px; font-weight: 500;
//           font-family: 'DM Sans', sans-serif;
//           text-transform: capitalize;
//         }

//         .vp-stat {
//           background: #fff; border-radius: 14px; padding: 18px 20px;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
//           border: 1px solid #ebebeb;
//           display: flex; flex-direction: column; gap: 4px;
//           transition: transform 0.2s;
//         }
//         .vp-stat:hover { transform: translateY(-2px); }
//         .vp-stat-val { font-size: 20px; font-weight: 600; color: #111; font-family: 'DM Sans', sans-serif; }
//         .vp-stat-lbl { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }

//         .vp-info-row {
//           display: flex; align-items: flex-start; gap: 12px;
//           padding: 14px 0; border-bottom: 1px solid #f0f0f0;
//         }
//         .vp-info-row:last-child { border-bottom: none; }
//         .vp-icon { width: 34px; height: 34px; border-radius: 10px; background: #f5f5f0; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
//         .vp-info-label { font-size: 11px; color: #aaa; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
//         .vp-info-val { font-size: 14px; color: #222; font-weight: 500; margin-top: 3px; }

//         /* Responsive */
//         .vp-header-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
//         .vp-edit-desktop { display: inline-flex; }
//         .vp-banner-edit  { display: none; }

//         @media(max-width: 480px) {
//           .vp-edit-desktop { display: none !important; }
//           .vp-banner-edit  { display: inline-flex !important; }
//           .vp-stat-val     { font-size: 17px; }
//         }
//       `}</style>

//       <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f5f0" }}>

//         {/* BANNER */}
//         <div style={{ background: "#111", height: 160, position: "relative" }}>
//           {/* Mobile edit btn on banner */}
//           <div style={{ position: "absolute", top: 16, right: 16 }}>
//             <button
//               className="vp-edit-btn vp-banner-edit"
//               onClick={() => router.push("/my-profile")}
//               style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}
//             >
//               ✏️ Edit
//             </button>
//           </div>
//         </div>

//         {/* BODY */}
//         <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

//           {/* AVATAR ROW */}
//           <div className="vp-fade vp-header-row" style={{ marginTop: -56, marginBottom: 20 }}>
//             <div style={{ position: "relative" }}>
//               <img
//                 src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
//                 alt="avatar"
//                 style={{ width: 108, height: 108, borderRadius: "50%", objectFit: "cover", border: "4px solid #f5f5f0", boxShadow: "0 4px 16px rgba(0,0,0,0.14)" }}
//               />
//               <div style={{ position: "absolute", bottom: 5, right: 5, width: 16, height: 16, borderRadius: "50%", background: isBrand ? "#6366f1" : "#10b981", border: "3px solid #f5f5f0" }} />
//             </div>

//             {/* Desktop edit btn */}
//             <button className="vp-edit-btn vp-edit-desktop" onClick={() => router.push("/my-profile")}>
//               ✏️ Edit Profile
//             </button>
//           </div>

//           {/* NAME & BADGES */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom: 20 }}>
//             <h1 style={{ fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 600, color: "#111", lineHeight: 1.2, fontFamily: "'DM Sans', sans-serif" }}>
//               {name || user?.name || "Your Name"}
//             </h1>

//             <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
//               <span className="vp-tag" style={{ background: isBrand ? "#eef2ff" : "#ecfdf5", color: isBrand ? "#6366f1" : "#10b981" }}>
//                 {capitalize(profile.role || "")}
//               </span>
//               {category && (
//                 <span className="vp-tag" style={{ background: "#fef3c7", color: "#d97706" }}>
//                   {capitalize(category)}
//                 </span>
//               )}
//               {profile.location && (
//                 <span style={{ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4 }}>
//                   📍 {capitalize(profile.location)}
//                 </span>
//               )}
//             </div>

//             {user?.email && (
//               <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>{user.email}</p>
//             )}
//           </div>

//           {/* BIO */}
//           {profile.bio && (
//             <div className="vp-fade vp-fade-2" style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 16, border: "1px solid #ebebeb" }}>
//               <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>About</p>
//               <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, fontWeight: 400 }}>{profile.bio}</p>
//             </div>
//           )}

//           {/* STATS */}
//           <div className="vp-fade vp-fade-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 16 }}>
//             {!isBrand && profile.followers && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{getFollowerLabel(profile.followers)}</span>
//                 <span className="vp-stat-lbl">Followers</span>
//               </div>
//             )}
//             {!isBrand && profile.platform && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">🔗</span>
//                 <span className="vp-stat-lbl">Platform Linked</span>
//               </div>
//             )}
//             {category && (
//               <div className="vp-stat">
//                 <span className="vp-stat-val">{capitalize(category)}</span>
//                 <span className="vp-stat-lbl">Niche</span>
//               </div>
//             )}
//           </div>

//           {/* INFO CARD */}
//           <div className="vp-fade vp-fade-3" style={{ background: "#fff", borderRadius: 14, padding: "8px 20px", border: "1px solid #ebebeb", marginBottom: 20 }}>
//             <p style={{ fontSize: 11, fontWeight: 500, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "14px 0 4px" }}>Details</p>

//             {profile.phone && String(profile.phone).trim() !== "" && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📞</div>
//                 <div>
//                   <p className="vp-info-label">Phone</p>
//                   <p className="vp-info-val">{String(profile.phone)}</p>
//                 </div>
//               </div>
//             )}

//             {profile.location && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📍</div>
//                 <div>
//                   <p className="vp-info-label">City</p>
//                   <p className="vp-info-val">{capitalize(profile.location)}</p>
//                 </div>
//               </div>
//             )}

//             {!isBrand && profile.platform && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p className="vp-info-label">Platform</p>
//                   <a href={profile.platform} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.platform}
//                   </a>
//                 </div>
//               </div>
//             )}

//             {isBrand && profile.companyName && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div>
//                   <p className="vp-info-label">Company</p>
//                   <p className="vp-info-val">{profile.companyName}</p>
//                 </div>
//               </div>
//             )}

//             {isBrand && profile.website && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p className="vp-info-label">Website</p>
//                   <a href={profile.website} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 14, color: "#6366f1", fontWeight: 500, marginTop: 3, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.website}
//                   </a>
//                 </div>
//               </div>
//             )}

//             {isBrand && profile.industry && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏭</div>
//                 <div>
//                   <p className="vp-info-label">Industry</p>
//                   <p className="vp-info-val">{capitalize(profile.industry)}</p>
//                 </div>
//               </div>
//             )}

//             {profile.createdAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p className="vp-info-label">Member Since</p>
//                   <p className="vp-info-val">
//                     {new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* BOTTOM CTA */}
//           <div className="vp-fade vp-fade-4" style={{ textAlign: "center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding: "12px 30px", fontSize: 14 }}>
//               ✏️ Edit Profile
//             </button>
//             <p style={{ fontSize: 12, color: "#bbb", marginTop: 10, fontWeight: 400 }}>
//               You can update this anytime from your profile settings
//             </p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// const styles: Record<string, React.CSSProperties> = {
//   center: {
//     minHeight: "100vh", display: "flex", alignItems: "center",
//     justifyContent: "center", background: "#f5f5f0",
//     fontFamily: "'DM Sans', sans-serif",
//   },
//   spinner: {
//     width: 34, height: 34, borderRadius: "50%",
//     border: "3px solid #e5e7eb", borderTopColor: "#111",
//     animation: "spin 0.7s linear infinite",
//   },
//   btnMain: {
//     marginTop: 16, padding: "11px 26px", borderRadius: "100px",
//     background: "#111", color: "#fff",
//     fontFamily: "'DM Sans', sans-serif",
//     fontWeight: 500, fontSize: 14, border: "none", cursor: "pointer",
//   },
// };



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";  

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

// export default function ViewProfile() {
//   const router = useRouter();
//   const [profile, setProfile] = useState<any>(null);
//   const [user, setUser]       = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError]     = useState("");

//   useEffect(() => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;

//     if (!token) { router.push("/login"); return; }

//     setUser(storedUser);

//     fetch(`${API_BASE}/profile/me`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then((res) => {
//         if (!res.ok) throw new Error("Failed");
//         return res.json();
//       })
//       .then((data) => {
//         if (data.success && data.profile) {
//           setProfile(data.profile);
//         } else {
//           setError("Profile not found. Please set up your profile first.");
//         }
//       })
//       .catch(() => setError("Could not load profile. Check your connection."))
//       .finally(() => setLoading(false));
//   }, []);

//   /* ── Loading ── */
//   if (loading) return (
//     <div style={styles.center}>
//       <div style={styles.spinner} />
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(20px);} to { opacity:1; transform:translateY(0);} }`}</style>
//     </div>
//   );

//   /* ── Error ── */
//   if (error) return (
//     <div style={styles.center}>
//       <div style={{ textAlign: "center" }}>
//         <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
//         <p style={{ color: "#666", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>{error}</p>
//         <button style={styles.btnMain} onClick={() => router.push("/setup-profile")}>Set Up Profile</button>
//       </div>
//     </div>
//   );

//   const isBrand   = profile.role === "brand";
//   const name      = isBrand ? profile.companyName : profile.name;
//   const category  = Array.isArray(profile.categories)
//     ? profile.categories[0]
//     : profile.categories;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         body { background: #f5f5f0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeUp  { from { opacity:0; transform:translateY(18px);} to { opacity:1; transform:translateY(0);} }
//         @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
//         .vp-fade { animation: fadeUp 0.45s ease both; }
//         .vp-fade-1 { animation-delay: 0.05s; }
//         .vp-fade-2 { animation-delay: 0.12s; }
//         .vp-fade-3 { animation-delay: 0.20s; }
//         .vp-fade-4 { animation-delay: 0.28s; }
//         .vp-edit-btn { 
//           display: inline-flex; align-items: center; gap: 6px;
//           padding: 11px 22px; border-radius: 100px; border: none;
//           background: #111; color: #fff; font-family: 'Syne', sans-serif;
//           font-size: 13px; font-weight: 700; cursor: pointer;
//           transition: background 0.2s, transform 0.15s;
//           letter-spacing: 0.03em;
//         }
//         .vp-edit-btn:hover { background: #333; transform: translateY(-1px); }
//         .vp-tag {
//           display: inline-block; padding: 5px 14px; border-radius: 100px;
//           font-size: 12px; font-weight: 600; font-family: 'DM Sans', sans-serif;
//           text-transform: capitalize; letter-spacing: 0.02em;
//         }
//         .vp-stat { 
//           background: #fff; border-radius: 16px; padding: 20px 24px;
//           box-shadow: 0 1px 3px rgba(0,0,0,0.05);
//           border: 1px solid #ebebeb;
//           display: flex; flex-direction: column; gap: 4px;
//           transition: transform 0.2s;
//         }
//         .vp-stat:hover { transform: translateY(-2px); }
//         .vp-info-row {
//           display: flex; align-items: flex-start; gap: 12px;
//           padding: 14px 0; border-bottom: 1px solid #f0f0f0;
//         }
//         .vp-info-row:last-child { border-bottom: none; }
//         .vp-icon { width: 36px; height: 36px; border-radius: 10px; background: #f5f5f0; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
//       `}</style>

//       <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", background: "#f5f5f0" }}>

//         {/* ── TOP BANNER ── */}
//         <div style={{ background: "#111", height: 180, position: "relative" }}>
//           {/* subtle grain texture */}
//           <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")", opacity: 0.4 }} />
//           {/* Edit button top-right */}
//           <div style={{ position: "absolute", top: 20, right: 24 }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
//               ✏️ Edit Profile
//             </button>
//           </div>
//         </div>

//         {/* ── PAGE BODY ── */}
//         <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px 60px" }}>

//           {/* ── AVATAR overlapping banner ── */}
//           <div className="vp-fade" style={{ marginTop: -64, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
//             <div style={{ position: "relative" }}>
//               <img
//                 src={profile.profileImage || "https://image.shutterstock.com/image-vector/default-avatar-profile-icon-transparent-260nw-2534623311.jpg"}
//                 alt="avatar"
//                 style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover", border: "4px solid #f5f5f0", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}
//               />
//               {/* role dot */}
//               <div style={{ position: "absolute", bottom: 6, right: 6, width: 18, height: 18, borderRadius: "50%", background: isBrand ? "#6366f1" : "#10b981", border: "3px solid #f5f5f0" }} title={profile.role} />
//             </div>

//             {/* desktop edit btn */}
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")}>
//               ✏️ Edit Profile
//             </button>
//           </div>

//           {/* ── NAME & ROLE ── */}
//           <div className="vp-fade vp-fade-1" style={{ marginBottom: 24 }}>
//             <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color: "#111", lineHeight: 1.15 }}>
//               {name || user?.name || "Your Name"}
//             </h1>

//             <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
//               {/* Role badge */}
//               <span className="vp-tag" style={{ background: isBrand ? "#eef2ff" : "#ecfdf5", color: isBrand ? "#6366f1" : "#10b981" }}>
//                 {capitalize(profile.role || "")}
//               </span>

//               {/* Category badge */}
//               {category && (
//                 <span className="vp-tag" style={{ background: "#fef3c7", color: "#d97706" }}>
//                   {capitalize(category)}
//                 </span>
//               )}

//               {/* Location */}
//               {profile.location && (
//                 <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#888" }}>
//                   📍 {capitalize(profile.location)}
//                 </span>
//               )}
//             </div>

//             {/* Email from localStorage */}
//             {user?.email && (
//               <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>{user.email}</p>
//             )}
//           </div>

//           {/* ── BIO ── */}
//           {profile.bio && (
//             <div className="vp-fade vp-fade-2" style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", marginBottom: 20, border: "1px solid #ebebeb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
//               <p style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>About</p>
//               <p style={{ fontSize: 15, color: "#444", lineHeight: 1.75 }}>{profile.bio}</p>
//             </div>
//           )}

//           {/* ── STATS ROW ── */}
//           <div className="vp-fade vp-fade-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
//             {/* Followers — only influencer */}
//             {!isBrand && profile.followers && (
//               <div className="vp-stat">
//                 <span style={{ fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#111" }}>
//                   {getFollowerLabel(profile.followers)}
//                 </span>
//                 <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Followers</span>
//               </div>
//             )}

//             {/* Platform */}
//             {!isBrand && profile.platform && (
//               <div className="vp-stat">
//                 <span style={{ fontSize: 18, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#111", wordBreak: "break-all" }}>
//                   🔗
//                 </span>
//                 <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform Linked</span>
//               </div>
//             )}

//             {/* Category count */}
//             {category && (
//               <div className="vp-stat">
//                 <span style={{ fontSize: 22, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#111" }}>
//                   {capitalize(category)}
//                 </span>
//                 <span style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Niche</span>
//               </div>
//             )}
//           </div>

//           {/* ── INFO CARD ── */}
//           <div className="vp-fade vp-fade-3" style={{ background: "#fff", borderRadius: 16, padding: "8px 24px", border: "1px solid #ebebeb", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20 }}>
//             <p style={{ fontSize: 11, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em", padding: "16px 0 4px" }}>Details</p>

//             {/* Phone */}
//             {/* {profile.phone && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📞</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Phone</p>
//                   <p style={{ fontSize: 15, color: "#222", fontWeight: 500, marginTop: 2 }}>{profile.phone}</p>
//                 </div>
//               </div>
//             )} */}


//             {profile.phone && String(profile.phone).trim() !== "" && (
//   <div className="vp-info-row">
//     <div className="vp-icon">📞</div>
//     <div>
//       <p
//         style={{
//           fontSize: 11,
//           color: "#aaa",
//           fontWeight: 600,
//           textTransform: "uppercase",
//           letterSpacing: "0.05em",
//         }}
//       >
//         Phone
//       </p>

//       <p
//         style={{
//           fontSize: 15,
//           color: "#222",
//           fontWeight: 500,
//           marginTop: 2,
//         }}
//       >
//         {String(profile.phone)}
//       </p>
//     </div>
//   </div>
// )}

//             {/* Location */}
//             {profile.location && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📍</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>City</p>
//                   <p style={{ fontSize: 15, color: "#222", fontWeight: 500, marginTop: 2 }}>{capitalize(profile.location)}</p>
//                 </div>
//               </div>
//             )}

//             {/* Platform link — influencer */}
//             {!isBrand && profile.platform && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🔗</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Platform</p>
//                   <a href={profile.platform} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 15, color: "#6366f1", fontWeight: 500, marginTop: 2, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.platform}
//                   </a>
//                 </div>
//               </div>
//             )}

//             {/* Company name — brand */}
//             {isBrand && profile.companyName && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏢</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Company</p>
//                   <p style={{ fontSize: 15, color: "#222", fontWeight: 500, marginTop: 2 }}>{profile.companyName}</p>
//                 </div>
//               </div>
//             )}

//             {/* Website — brand */}
//             {isBrand && profile.website && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🌐</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Website</p>
//                   <a href={profile.website} target="_blank" rel="noreferrer"
//                     style={{ fontSize: 15, color: "#6366f1", fontWeight: 500, marginTop: 2, display: "block", wordBreak: "break-all", textDecoration: "none" }}>
//                     {profile.website}
//                   </a>
//                 </div>
//               </div>
//             )}

//             {/* Industry — brand */}
//             {isBrand && profile.industry && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">🏭</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Industry</p>
//                   <p style={{ fontSize: 15, color: "#222", fontWeight: 500, marginTop: 2 }}>{capitalize(profile.industry)}</p>
//                 </div>
//               </div>
//             )}

//             {/* Member since */}
//             {profile.createdAt && (
//               <div className="vp-info-row">
//                 <div className="vp-icon">📅</div>
//                 <div>
//                   <p style={{ fontSize: 11, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Member Since</p>
//                   <p style={{ fontSize: 15, color: "#222", fontWeight: 500, marginTop: 2 }}>
//                     {new Date(profile.createdAt).toLocaleDateString("en-IN", { year: "numeric", month: "long" })}
//                   </p>
//                 </div>
//               </div>
//             )}
//           </div>

//           {/* ── BOTTOM EDIT CTA ── */}
//           <div className="vp-fade vp-fade-4" style={{ textAlign: "center" }}>
//             <button className="vp-edit-btn" onClick={() => router.push("/my-profile")} style={{ padding: "13px 32px", fontSize: 14 }}>
//               ✏️ Edit Profile
//             </button>
//             <p style={{ fontSize: 12, color: "#bbb", marginTop: 10 }}>You can update this anytime from your profile settings</p>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }

// /* ─── inline style objects ─── */
// const styles: Record<string, React.CSSProperties> = {
//   center: {
//     minHeight: "100vh",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     background: "#f5f5f0",
//     fontFamily: "'DM Sans', sans-serif",
//   },
//   spinner: {
//     width: 36,
//     height: 36,
//     borderRadius: "50%",
//     border: "3px solid #e5e7eb",
//     borderTopColor: "#111",
//     animation: "spin 0.7s linear infinite",
//   },
//   btnMain: {
//     marginTop: 16,
//     padding: "12px 28px",
//     borderRadius: "100px",
//     background: "#111",
//     color: "#fff",
//     fontFamily: "'Syne', sans-serif",
//     fontWeight: 700,
//     fontSize: 14,
//     border: "none",
//     cursor: "pointer",
//   },
// };

