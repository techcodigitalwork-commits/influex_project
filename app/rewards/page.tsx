"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

const BADGES = [
  { id: "first_apply",     icon: "🚀", name: "First Step",      desc: "Apply to your first campaign",        points: 50,   color: "#6366f1" },
  { id: "first_deal",      icon: "🤝", name: "Deal Maker",      desc: "Complete your first deal",            points: 200,  color: "#8b5cf6" },
  { id: "verified",        icon: "✅", name: "Verified Creator", desc: "Get your profile verified",           points: 100,  color: "#10b981" },
  { id: "five_deals",      icon: "⭐", name: "Rising Star",      desc: "Complete 5 deals",                   points: 500,  color: "#f59e0b" },
  { id: "ten_deals",       icon: "🏆", name: "Pro Creator",      desc: "Complete 10 deals",                  points: 1000, color: "#ef4444" },
  { id: "first_contract",  icon: "📄", name: "Ink & Sign",       desc: "Sign your first contract",           points: 150,  color: "#3b82f6" },
  { id: "profile_complete",icon: "💎", name: "Diamond Profile",  desc: "Complete your full profile",         points: 100,  color: "#14b8a6" },
  { id: "top_earner",      icon: "💰", name: "Top Earner",       desc: "Earn ₹50,000+ across deals",         points: 2000, color: "#f97316" },
  { id: "streak_7",        icon: "🔥", name: "On Fire",          desc: "Login 7 days in a row",              points: 300,  color: "#ef4444" },
  { id: "social_share",    icon: "📣", name: "Megaphone",        desc: "Share a campaign on social media",   points: 75,   color: "#ec4899" },
  { id: "referral",        icon: "👥", name: "Connector",        desc: "Refer a friend to Influex",          points: 250,  color: "#6366f1" },
  { id: "century",         icon: "💯", name: "Century",          desc: "Earn 1000 points total",             points: 100,  color: "#84cc16" },
];

const LEVELS = [
  { name: "Newcomer",   min: 0,    max: 199,   color: "#9ca3af", bg: "#f5f5f5",   icon: "🌱" },
  { name: "Starter",    min: 200,  max: 499,   color: "#6366f1", bg: "#eef2ff",   icon: "⚡" },
  { name: "Creator",    min: 500,  max: 999,   color: "#8b5cf6", bg: "#f5f3ff",   icon: "🎨" },
  { name: "Influencer", min: 1000, max: 2499,  color: "#f59e0b", bg: "#fffbeb",   icon: "⭐" },
  { name: "Pro",        min: 2500, max: 4999,  color: "#ef4444", bg: "#fff5f5",   icon: "🏆" },
  { name: "Legend",     min: 5000, max: 999999, color: "#f97316", bg: "#fff7ed",  icon: "👑" },
];

const HOW_TO_EARN = [
  { icon: "📋", action: "Apply to a campaign",     points: 10  },
  { icon: "✅", action: "Get accepted for a deal",  points: 50  },
  { icon: "🤝", action: "Complete a deal",          points: 200 },
  { icon: "📄", action: "Sign a contract",          points: 150 },
  { icon: "⭐", action: "Get 5-star rating",        points: 100 },
  { icon: "👥", action: "Refer a creator",          points: 250 },
  { icon: "🔥", action: "7-day login streak",       points: 300 },
  { icon: "💎", action: "Complete profile",         points: 100 },
];

export default function RewardsPage() {
  const router = useRouter();
  const [token, setToken]   = useState("");
  const [role, setRole]     = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<"overview"|"badges"|"leaderboard"|"earn">("overview");
  const [toast, setToast]   = useState<{msg:string;type:"success"|"error"}|null>(null);

  const showToast = (msg:string, type:"success"|"error"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    setToken(p.token);
    setRole(p.role?.toLowerCase()||"");
    fetchData(p.token);
  }, []);

  const fetchData = async (t:string) => {
    try {
      const [profRes, lbRes] = await Promise.allSettled([
        fetch(`${API}/profile/me`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/profile/leaderboard`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (profRes.status === "fulfilled") {
        const d = await profRes.value.json();
        setProfile(d.data || d.profile || d);
      }
      if (lbRes.status === "fulfilled") {
        const d = await lbRes.value.json();
        setLeaderboard(d.data || d.leaderboard || []);
      }
    } catch {}
    finally { setLoading(false); }
  };

  const points      = profile?.points || profile?.rewardPoints || 0;
  const earnedBadges: string[] = profile?.badges || [];
  const currentLevel = LEVELS.find(l => points >= l.min && points <= l.max) || LEVELS[0];
  const nextLevel    = LEVELS[LEVELS.indexOf(currentLevel) + 1];
  const levelPct     = nextLevel ? Math.round(((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100) : 100;

  if (loading) return (
    <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:28,height:28,border:"3px solid #e0e0e0",borderTopColor:"#4f46e5",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        @keyframes shimmer  { from{left:-100%}to{left:200%} }
        @keyframes popIn    { 0%{transform:scale(0.8);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1} }
        @keyframes glow     { 0%,100%{box-shadow:0 0 12px rgba(99,102,241,0.3)}50%{box-shadow:0 0 24px rgba(99,102,241,0.6)} }
        @keyframes toastIn  { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }

        .rw { font-family:'Plus Jakarta Sans',sans-serif; background:#f7f7f5; min-height:100vh; }

        /* HEADER */
        .rw-header { background:linear-gradient(135deg,#1e1b4b 0%,#4f46e5 60%,#7c3aed 100%); padding:28px 32px 0; }
        @media(max-width:600px){ .rw-header{ padding:20px 16px 0; } }
        .rw-header-top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; }
        .rw-header-title { font-size:24px; font-weight:800; color:#fff; }
        .rw-header-sub   { font-size:13px; color:rgba(255,255,255,0.65); margin-top:3px; }
        .rw-pts-badge { background:rgba(255,255,255,0.15); border:1.5px solid rgba(255,255,255,0.25); border-radius:16px; padding:12px 18px; text-align:center; backdrop-filter:blur(10px); }
        .rw-pts-val  { font-size:28px; font-weight:800; color:#fff; }
        .rw-pts-lbl  { font-size:11px; color:rgba(255,255,255,0.7); font-weight:600; text-transform:uppercase; letter-spacing:0.07em; }

        /* LEVEL CARD */
        .rw-level-card { background:rgba(255,255,255,0.12); border:1.5px solid rgba(255,255,255,0.2); border-radius:16px; padding:18px 20px; margin-bottom:0; backdrop-filter:blur(10px); }
        .rw-level-row  { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
        .rw-level-info { display:flex; align-items:center; gap:10px; }
        .rw-level-icon { font-size:28px; }
        .rw-level-name { font-size:18px; font-weight:800; color:#fff; }
        .rw-level-sub  { font-size:12px; color:rgba(255,255,255,0.65); }
        .rw-level-next { font-size:12px; color:rgba(255,255,255,0.7); font-weight:600; }
        .rw-bar-bg   { height:8px; background:rgba(255,255,255,0.2); border-radius:100px; overflow:hidden; margin-bottom:6px; }
        .rw-bar-fill { height:100%; border-radius:100px; background:linear-gradient(90deg,#a5f3fc,#818cf8); position:relative; overflow:hidden; transition:width 1s ease; }
        .rw-bar-fill::after { content:""; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent); animation:shimmer 2s infinite; }
        .rw-bar-labels { display:flex; justify-content:space-between; font-size:11px; color:rgba(255,255,255,0.55); }

        /* TABS */
        .rw-tabs { display:flex; gap:2px; padding:0 32px; background:linear-gradient(135deg,#1e1b4b,#4f46e5 60%,#7c3aed); padding-top:20px; }
        @media(max-width:600px){ .rw-tabs{ padding:20px 16px 0; gap:0; overflow-x:auto; } }
        .rw-tab { padding:12px 20px; font-size:13px; font-weight:700; color:rgba(255,255,255,0.6); background:none; border:none; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; border-radius:12px 12px 0 0; transition:all 0.2s; white-space:nowrap; }
        .rw-tab.active { background:#f7f7f5; color:#4f46e5; }
        .rw-tab:hover:not(.active) { color:#fff; background:rgba(255,255,255,0.1); }

        /* BODY */
        .rw-body { padding:24px 32px 48px; }
        @media(max-width:600px){ .rw-body{ padding:16px 16px 36px; } }

        /* OVERVIEW */
        .rw-overview-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }
        .rw-ov-card { background:#fff; border-radius:16px; border:1.5px solid #efefef; padding:18px; text-align:center; animation:fadeUp 0.3s ease both; }
        .rw-ov-icon { font-size:28px; margin-bottom:8px; }
        .rw-ov-val  { font-size:24px; font-weight:800; color:#111; }
        .rw-ov-lbl  { font-size:12px; color:#aaa; font-weight:500; margin-top:2px; }

        /* RECENT ACTIVITY */
        .rw-section-title { font-size:16px; font-weight:800; color:#111; margin-bottom:14px; display:flex; align-items:center; gap:8px; }
        .rw-activity-list { background:#fff; border-radius:16px; border:1.5px solid #efefef; overflow:hidden; }
        .rw-activity-item { display:flex; align-items:center; gap:14px; padding:14px 18px; border-bottom:1px solid #f5f5f5; animation:fadeUp 0.3s ease both; }
        .rw-activity-item:last-child { border-bottom:none; }
        .rw-act-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
        .rw-act-name { font-size:14px; font-weight:600; color:#111; }
        .rw-act-time { font-size:12px; color:#aaa; margin-top:2px; }
        .rw-act-pts  { font-size:15px; font-weight:800; color:#16a34a; margin-left:auto; white-space:nowrap; }

        /* BADGES */
        .rw-badges-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:14px; }
        @media(max-width:480px){ .rw-badges-grid{ grid-template-columns:repeat(2,1fr); gap:10px; } }
        .rw-badge-card { background:#fff; border-radius:18px; border:1.5px solid #efefef; padding:20px 16px; text-align:center; transition:all 0.22s; animation:popIn 0.4s ease both; position:relative; overflow:hidden; }
        .rw-badge-card.earned { border-color:transparent; animation:popIn 0.4s ease both; }
        .rw-badge-card.earned::before { content:""; position:absolute; inset:0; border-radius:18px; padding:1.5px; background:linear-gradient(135deg,var(--bc),transparent); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
        .rw-badge-card.locked { opacity:0.55; filter:grayscale(0.6); }
        .rw-badge-icon-wrap { width:60px; height:60px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; margin:0 auto 12px; position:relative; }
        .rw-badge-icon-wrap.earned { animation:glow 2s infinite; }
        .rw-badge-lock { position:absolute; bottom:-2px; right:-2px; width:20px; height:20px; border-radius:50%; background:#f5f5f5; border:2px solid #fff; font-size:10px; display:flex; align-items:center; justify-content:center; }
        .rw-badge-name { font-size:13px; font-weight:700; color:#111; margin-bottom:4px; }
        .rw-badge-desc { font-size:11px; color:#aaa; line-height:1.5; margin-bottom:8px; }
        .rw-badge-pts  { font-size:12px; font-weight:700; padding:3px 10px; border-radius:100px; display:inline-block; }
        .rw-badge-earned-ribbon { position:absolute; top:10px; right:-8px; background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; font-size:9px; font-weight:700; padding:3px 14px 3px 8px; clip-path:polygon(0 0,100% 0,90% 50%,100% 100%,0 100%); }

        /* LEADERBOARD */
        .rw-lb-list { background:#fff; border-radius:18px; border:1.5px solid #efefef; overflow:hidden; }
        .rw-lb-item { display:flex; align-items:center; gap:14px; padding:14px 20px; border-bottom:1px solid #f5f5f5; animation:fadeUp 0.3s ease both; transition:background 0.15s; }
        .rw-lb-item:last-child { border-bottom:none; }
        .rw-lb-item:hover { background:#fafafa; }
        .rw-lb-item.top1 { background:linear-gradient(135deg,#fffbeb,#fef3c7); }
        .rw-lb-item.top2 { background:linear-gradient(135deg,#f8fafc,#f1f5f9); }
        .rw-lb-item.top3 { background:linear-gradient(135deg,#fff7ed,#ffedd5); }
        .rw-lb-rank { width:32px; text-align:center; font-size:18px; font-weight:800; color:#aaa; flex-shrink:0; }
        .rw-lb-rank.top { font-size:22px; }
        .rw-lb-av { width:44px; height:44px; border-radius:50%; object-fit:cover; flex-shrink:0; }
        .rw-lb-av-fb { width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:16px; font-weight:800; flex-shrink:0; }
        .rw-lb-name  { font-size:14px; font-weight:700; color:#111; flex:1; }
        .rw-lb-cat   { font-size:12px; color:#aaa; }
        .rw-lb-pts   { font-size:16px; font-weight:800; color:#4f46e5; }
        .rw-lb-level { font-size:11px; color:#aaa; text-align:right; }
        .rw-lb-me    { background:linear-gradient(135deg,#eef2ff,#f5f3ff) !important; border-left:3px solid #4f46e5; }

        /* HOW TO EARN */
        .rw-earn-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
        @media(max-width:480px){ .rw-earn-grid{ grid-template-columns:1fr; } }
        .rw-earn-card { background:#fff; border-radius:16px; border:1.5px solid #efefef; padding:16px 18px; display:flex; align-items:center; gap:14px; animation:fadeUp 0.3s ease both; }
        .rw-earn-icon { width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg,#eef2ff,#f5f3ff); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
        .rw-earn-action { font-size:13px; font-weight:600; color:#111; flex:1; }
        .rw-earn-pts { font-size:14px; font-weight:800; color:#16a34a; white-space:nowrap; }

        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:9999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#111; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="rw">

        {/* HEADER */}
        <div className="rw-header">
          <div className="rw-header-top">
            <div>
              <div className="rw-header-title">🏆 Rewards</div>
              <div className="rw-header-sub">Earn points, unlock badges, climb the leaderboard</div>
            </div>
            <div className="rw-pts-badge">
              <div className="rw-pts-val">{points.toLocaleString()}</div>
              <div className="rw-pts-lbl">Total Points</div>
            </div>
          </div>

          {/* LEVEL PROGRESS */}
          <div className="rw-level-card">
            <div className="rw-level-row">
              <div className="rw-level-info">
                <div className="rw-level-icon">{currentLevel.icon}</div>
                <div>
                  <div className="rw-level-name">{currentLevel.name}</div>
                  <div className="rw-level-sub">{points} / {nextLevel?.min || "MAX"} points</div>
                </div>
              </div>
              {nextLevel && <div className="rw-level-next">Next: {nextLevel.icon} {nextLevel.name}</div>}
            </div>
            <div className="rw-bar-bg">
              <div className="rw-bar-fill" style={{width:`${levelPct}%`}} />
            </div>
            <div className="rw-bar-labels">
              <span>{currentLevel.name}</span>
              <span>{levelPct}%</span>
              {nextLevel && <span>{nextLevel.name}</span>}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="rw-tabs">
          {(["overview","badges","leaderboard","earn"] as const).map(t => (
            <button key={t} className={`rw-tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>
              {t==="overview"?"📊 Overview":t==="badges"?"🏅 Badges":t==="leaderboard"?"🥇 Leaderboard":"💡 How to Earn"}
            </button>
          ))}
        </div>

        <div className="rw-body">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <>
              <div className="rw-overview-grid">
                {[
                  {icon:"🏅",val:earnedBadges.length,     lbl:"Badges Earned"},
                  {icon:"⭐",val:points,                   lbl:"Total Points"},
                  {icon:currentLevel.icon,val:currentLevel.name, lbl:"Current Level"},
                  {icon:"🎯",val:`${levelPct}%`,           lbl:"To Next Level"},
                  {icon:"🤝",val:profile?.completedDeals||0, lbl:"Deals Done"},
                  {icon:"📋",val:profile?.totalApplications||0,lbl:"Applications"},
                ].map((s,i)=>(
                  <div key={i} className="rw-ov-card" style={{animationDelay:`${i*0.07}s`}}>
                    <div className="rw-ov-icon">{s.icon}</div>
                    <div className="rw-ov-val">{s.val}</div>
                    <div className="rw-ov-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* LEVEL ROADMAP */}
              <div className="rw-section-title">🗺️ Level Roadmap</div>
              <div style={{background:"#fff",borderRadius:18,border:"1.5px solid #efefef",padding:"20px 24px",marginBottom:24}}>
                <div style={{display:"flex",gap:0,overflowX:"auto",paddingBottom:8}}>
                  {LEVELS.map((lv,i)=>{
                    const isReached  = points >= lv.min;
                    const isCurrent  = currentLevel.name === lv.name;
                    return (
                      <div key={i} style={{display:"flex",alignItems:"center",flexShrink:0}}>
                        <div style={{textAlign:"center",padding:"0 4px"}}>
                          <div style={{width:48,height:48,borderRadius:"50%",background:isReached?lv.color:"#f0f0f0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 6px",border:isCurrent?`3px solid ${lv.color}`:undefined,boxShadow:isCurrent?`0 0 0 4px ${lv.color}22`:undefined,transition:"all 0.3s"}}>{lv.icon}</div>
                          <div style={{fontSize:11,fontWeight:700,color:isReached?lv.color:"#bbb",whiteSpace:"nowrap"}}>{lv.name}</div>
                          <div style={{fontSize:10,color:"#ccc"}}>{lv.min}+</div>
                        </div>
                        {i < LEVELS.length-1 && (
                          <div style={{width:24,height:3,background:points>=LEVELS[i+1].min?lv.color:"#f0f0f0",flexShrink:0,borderRadius:2,transition:"background 0.3s"}} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RECENT ACTIVITY */}
              <div className="rw-section-title">📈 Recent Activity</div>
              {(profile?.recentActivity || profile?.activityLog || []).length === 0 ? (
                <div style={{background:"#fff",borderRadius:16,border:"1.5px dashed #e0e0e0",padding:"40px 24px",textAlign:"center",color:"#aaa"}}>
                  <div style={{fontSize:36,marginBottom:12}}>📭</div>
                  <div style={{fontWeight:700,fontSize:15,color:"#555",marginBottom:6}}>No activity yet</div>
                  <div style={{fontSize:13}}>Start applying to campaigns to earn points!</div>
                </div>
              ) : (
                <div className="rw-activity-list">
                  {(profile.recentActivity || profile.activityLog).slice(0,8).map((a:any,i:number)=>(
                    <div key={i} className="rw-activity-item" style={{animationDelay:`${i*0.06}s`}}>
                      <div className="rw-act-icon" style={{background:`${a.color||"#eef2ff"}`}}>{a.icon||"⭐"}</div>
                      <div>
                        <div className="rw-act-name">{a.action||a.description||"Action"}</div>
                        <div className="rw-act-time">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short"}) : ""}</div>
                      </div>
                      <div className="rw-act-pts">+{a.points||0}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── BADGES ── */}
          {tab === "badges" && (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div className="rw-section-title" style={{margin:0}}>🏅 All Badges</div>
                <div style={{fontSize:13,color:"#888",fontWeight:600}}>{earnedBadges.length} / {BADGES.length} earned</div>
              </div>
              {/* PROGRESS */}
              <div style={{background:"#fff",borderRadius:14,border:"1.5px solid #efefef",padding:"14px 18px",marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:8,fontSize:13,fontWeight:600,color:"#555"}}>
                  <span>Badge Progress</span>
                  <span style={{color:"#4f46e5"}}>{Math.round((earnedBadges.length/BADGES.length)*100)}%</span>
                </div>
                <div style={{height:8,background:"#f0f0f0",borderRadius:100,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(earnedBadges.length/BADGES.length)*100}%`,background:"linear-gradient(90deg,#4f46e5,#7c3aed)",borderRadius:100,transition:"width 1s ease"}} />
                </div>
              </div>
              <div className="rw-badges-grid">
                {BADGES.map((b,i)=>{
                  const isEarned = earnedBadges.includes(b.id);
                  return (
                    <div key={b.id} className={`rw-badge-card ${isEarned?"earned":"locked"}`}
                      style={{"--bc":b.color, animationDelay:`${i*0.05}s`} as any}>
                      {isEarned && <div className="rw-badge-earned-ribbon">EARNED</div>}
                      <div className={`rw-badge-icon-wrap ${isEarned?"earned":""}`} style={{background:`${b.color}18`}}>
                        <span style={{fontSize:28}}>{b.icon}</span>
                        {!isEarned && <div className="rw-badge-lock">🔒</div>}
                      </div>
                      <div className="rw-badge-name">{b.name}</div>
                      <div className="rw-badge-desc">{b.desc}</div>
                      <div className="rw-badge-pts" style={{background:`${b.color}18`,color:b.color}}>+{b.points} pts</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── LEADERBOARD ── */}
          {tab === "leaderboard" && (
            <>
              <div className="rw-section-title">🥇 Top Creators</div>
              {leaderboard.length === 0 ? (
                <div style={{background:"#fff",borderRadius:18,border:"1.5px dashed #e0e0e0",padding:"50px 24px",textAlign:"center",color:"#aaa"}}>
                  <div style={{fontSize:40,marginBottom:12}}>🏆</div>
                  <div style={{fontWeight:700,fontSize:16,color:"#555",marginBottom:6}}>Leaderboard coming soon</div>
                  <div style={{fontSize:13}}>Start earning points to be on top!</div>
                </div>
              ) : (
                <div className="rw-lb-list">
                  {leaderboard.slice(0,20).map((u:any,i:number)=>{
                    const rankEmoji = i===0?"🥇":i===1?"🥈":i===2?"🥉":null;
                    const lv = LEVELS.find(l=>u.points>=l.min&&u.points<=l.max)||LEVELS[0];
                    const isMe = u._id === (profile?._id || profile?.id);
                    return (
                      <div key={u._id} className={`rw-lb-item ${i===0?"top1":i===1?"top2":i===2?"top3":""} ${isMe?"rw-lb-me":""}`}
                        style={{animationDelay:`${i*0.04}s`}}>
                        <div className={`rw-lb-rank ${i<3?"top":""}`}>{rankEmoji||`#${i+1}`}</div>
                        {u.profileImage
                          ? <img src={u.profileImage} className="rw-lb-av" alt="" />
                          : <div className="rw-lb-av-fb" style={{background:`linear-gradient(135deg,${lv.color},#7c3aed)`}}>{(u.name||"C").charAt(0).toUpperCase()}</div>
                        }
                        <div style={{flex:1}}>
                          <div className="rw-lb-name">{u.name||u.username||"Creator"}{isMe&&<span style={{fontSize:11,background:"#eef2ff",color:"#4f46e5",padding:"2px 8px",borderRadius:100,marginLeft:8,fontWeight:700}}>You</span>}</div>
                          <div className="rw-lb-cat">{u.category||u.niche||""}</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div className="rw-lb-pts">{(u.points||0).toLocaleString()}</div>
                          <div className="rw-lb-level">{lv.icon} {lv.name}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── HOW TO EARN ── */}
          {tab === "earn" && (
            <>
              <div className="rw-section-title">💡 How to Earn Points</div>
              <div className="rw-earn-grid">
                {HOW_TO_EARN.map((e,i)=>(
                  <div key={i} className="rw-earn-card" style={{animationDelay:`${i*0.06}s`}}>
                    <div className="rw-earn-icon">{e.icon}</div>
                    <div className="rw-earn-action">{e.action}</div>
                    <div className="rw-earn-pts">+{e.points}</div>
                  </div>
                ))}
              </div>

              {/* LEVEL PERKS */}
              <div className="rw-section-title" style={{marginTop:28}}>🎁 Level Perks</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[
                  {level:"⚡ Starter",   perk:"Access to basic campaign filters",         color:"#6366f1"},
                  {level:"🎨 Creator",   perk:"Profile badge + priority in search results", color:"#8b5cf6"},
                  {level:"⭐ Influencer",perk:"Verified tick + featured on browse page",   color:"#f59e0b"},
                  {level:"🏆 Pro",       perk:"Direct brand invite access + higher deal limits", color:"#ef4444"},
                  {level:"👑 Legend",    perk:"Exclusive deals + dedicated account manager", color:"#f97316"},
                ].map((p,i)=>(
                  <div key={i} style={{background:"#fff",borderRadius:14,border:`1.5px solid ${p.color}22`,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,animationDelay:`${i*0.07}s`}} className="rw-earn-card">
                    <div style={{fontSize:22,flexShrink:0}}>{p.level.split(" ")[0]}</div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:p.color}}>{p.level}</div>
                      <div style={{fontSize:13,color:"#666",marginTop:2}}>{p.perk}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}