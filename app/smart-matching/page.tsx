"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

const CATEGORIES = ["Fashion","Beauty","Tech","Food","Travel","Fitness","Gaming","Lifestyle","Finance","Education","Entertainment","Sports"];

export default function SmartMatchingPage() {
  const router = useRouter();
  const [token, setToken]       = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creators, setCreators]   = useState<any[]>([]);
  const [selectedCamp, setSelectedCamp] = useState<any>(null);
  const [matches, setMatches]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [inviting, setInviting]   = useState<string|null>(null);
  const [invited, setInvited]     = useState<Record<string,boolean>>({});
  const [toast, setToast]         = useState<{msg:string;type:"success"|"error"}|null>(null);

  const showToast = (msg:string,type:"success"|"error"="success") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  };

  useEffect(()=>{
    const raw = localStorage.getItem("cb_user");
    if (!raw){ router.push("/login"); return; }
    const p = JSON.parse(raw);
    if (p.role?.toLowerCase()!=="brand"){ router.push("/"); return; }
    setToken(p.token);
    fetchAll(p.token);
    const saved = localStorage.getItem(`invites_${p._id||p.id||""}`);
    if (saved) setInvited(JSON.parse(saved));
  },[]);

  const fetchAll = async (t:string) => {
    try {
      const [cRes, crRes] = await Promise.all([
        fetch(`${API}/campaigns/my`,        { headers:{ Authorization:`Bearer ${t}` } }),
        fetch(`${API}/profile/influencers`, { headers:{ Authorization:`Bearer ${t}` } }),
      ]);
      const cData  = await cRes.json();
      const crData = await crRes.json();
      const camps  = cData.data || cData.campaigns || [];
      const crs    = crData.data || crData.influencers || crData.profiles || [];
      setCampaigns(camps);
      setCreators(crs);
      if (camps.length>0){ setSelectedCamp(camps[0]); computeMatches(camps[0],crs); }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  const computeMatches = (camp:any, crs:any[]) => {
    if (!camp || !crs.length){ setMatches([]); return; }
    const campCat = (camp.category||"").toLowerCase();
    const campBudget = Number(camp.budget||0);

    const scored = crs.map((cr:any)=>{
      let score = 0;
      const reasons:string[] = [];
      const crCat = (cr.category||cr.niche||"").toLowerCase();

      // Category match — highest weight
      if (crCat && campCat && crCat.includes(campCat)){
        score += 40; reasons.push("✅ Category match");
      } else if (crCat && campCat && campCat.includes(crCat)){
        score += 25; reasons.push("🔸 Partial category match");
      }

      // Followers match with budget
      const followers = Number(cr.followers||0);
      if (campBudget >= 50000 && followers >= 100000){ score += 20; reasons.push("🌟 Macro influencer"); }
      else if (campBudget >= 10000 && followers >= 10000){ score += 20; reasons.push("📈 Mid-tier creator"); }
      else if (followers >= 1000){ score += 15; reasons.push("🌱 Micro influencer"); }

      // Engagement rate
      const eng = parseFloat(cr.engagementRate||cr.engagement||"0");
      if (eng >= 5){ score += 20; reasons.push("🔥 High engagement"); }
      else if (eng >= 3){ score += 12; reasons.push("👍 Good engagement"); }

      // Has portfolio
      if (cr.portfolio||cr.portfolioLink){ score += 10; reasons.push("📁 Has portfolio"); }

      // Verified
      if (cr.verified||cr.isVerified){ score += 10; reasons.push("✔️ Verified"); }

      // Has worked before (completed campaigns)
      if ((cr.completedCampaigns||0) > 0){ score += 5; reasons.push(`🏆 ${cr.completedCampaigns} campaigns done`); }

      return { ...cr, _score:score, _reasons:reasons };
    });

    const top = scored
      .filter(c=>c._score > 0)
      .sort((a,b)=>b._score-a._score)
      .slice(0,20);
    setMatches(top);
  };

  const handleCampSelect = (camp:any) => {
    setSelectedCamp(camp);
    computeMatches(camp, creators);
  };

  const handleInvite = async (creatorId:string) => {
    if (!selectedCamp) return;
    setInviting(creatorId);
    try {
      await fetch(`${API}/invite/send`, {
        method:"POST",
        headers:{ Authorization:`Bearer ${token}`, "Content-Type":"application/json" },
        body: JSON.stringify({ creatorId, campaignId: selectedCamp._id }),
      });
      const newInvited = { ...invited, [creatorId]: true };
      setInvited(newInvited);
      const raw = localStorage.getItem("cb_user");
      const p   = raw ? JSON.parse(raw) : {};
      localStorage.setItem(`invites_${p._id||p.id||""}`, JSON.stringify(newInvited));
      showToast("✅ Invite sent!");
    } catch { showToast("Failed to send invite","error"); }
    finally { setInviting(null); }
  };

  const getMatchColor = (score:number) => {
    if (score>=60) return { bg:"#f0fdf4", border:"#86efac", badge:"#16a34a", label:"🔥 Top Match" };
    if (score>=40) return { bg:"#eff6ff", border:"#93c5fd", badge:"#2563eb", label:"⭐ Good Match" };
    if (score>=20) return { bg:"#fefce8", border:"#fde047", badge:"#ca8a04", label:"👍 Fair Match" };
    return        { bg:"#f9fafb", border:"#e5e7eb", badge:"#6b7280", label:"Match" };
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }

        .sm { font-family:'Plus Jakarta Sans',sans-serif; background:#f7f7f5; min-height:100vh; }
        .sm-header { background:linear-gradient(135deg,#1e1b4b 0%,#4338ca 100%); padding:32px; color:#fff; }
        @media(max-width:600px){ .sm-header{ padding:20px 16px; } }
        .sm-header-top { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:20px; }
        .sm-title { font-size:26px; font-weight:800; }
        .sm-sub   { font-size:14px; opacity:0.75; margin-top:4px; }
        .sm-ai-badge { display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.2); padding:8px 16px; border-radius:100px; font-size:13px; font-weight:700; }

        /* CAMPAIGN SELECTOR */
        .sm-camp-row { display:flex; gap:10px; overflow-x:auto; padding-bottom:4px; }
        .sm-camp-chip { padding:8px 16px; border-radius:100px; font-size:13px; font-weight:700; cursor:pointer; border:2px solid rgba(255,255,255,0.25); background:rgba(255,255,255,0.1); color:#fff; transition:all 0.2s; white-space:nowrap; font-family:'Plus Jakarta Sans',sans-serif; }
        .sm-camp-chip.active { background:#fff; color:#4338ca; border-color:#fff; }
        .sm-camp-chip:hover:not(.active) { background:rgba(255,255,255,0.2); }

        /* BODY */
        .sm-body { padding:28px 32px; }
        @media(max-width:600px){ .sm-body{ padding:16px; } }

        /* CAMPAIGN INFO */
        .sm-camp-info { background:#fff; border-radius:16px; border:1.5px solid #e5e7eb; padding:20px 24px; margin-bottom:24px; display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap; }
        .sm-camp-info-title { font-size:17px; font-weight:800; color:#111; margin-bottom:6px; }
        .sm-info-chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
        .sm-info-chip { padding:4px 12px; border-radius:100px; font-size:12px; font-weight:600; background:#f0f0f0; color:#555; }

        /* STATS */
        .sm-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
        @media(max-width:700px){ .sm-stats{ grid-template-columns:repeat(2,1fr); } }
        .sm-stat { background:#fff; border:1.5px solid #e5e7eb; border-radius:14px; padding:16px; text-align:center; }
        .sm-stat-val { font-size:24px; font-weight:800; color:#111; }
        .sm-stat-lbl { font-size:11px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.06em; margin-top:3px; }

        /* MATCH GRID */
        .sm-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
        @media(max-width:480px){ .sm-grid{ grid-template-columns:1fr; } }
        .sm-card { border-radius:18px; border:2px solid; padding:20px; animation:fadeUp 0.3s ease both; transition:all 0.2s; }
        .sm-card:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,0.07); }

        .sm-card-top { display:flex; align-items:flex-start; gap:14px; margin-bottom:14px; }
        .sm-av { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px; font-weight:800; flex-shrink:0; overflow:hidden; }
        .sm-av img { width:100%; height:100%; object-fit:cover; }
        .sm-name  { font-size:16px; font-weight:800; color:#111; }
        .sm-niche { font-size:12px; color:#888; margin-top:2px; }
        .sm-match-badge { margin-left:auto; padding:4px 12px; border-radius:100px; font-size:11px; font-weight:800; color:#fff; flex-shrink:0; }

        .sm-score-bar-wrap { margin-bottom:14px; }
        .sm-score-label { display:flex; justify-content:space-between; font-size:12px; font-weight:600; color:#555; margin-bottom:5px; }
        .sm-score-bar { height:6px; border-radius:100px; background:#f0f0f0; overflow:hidden; }
        .sm-score-fill { height:100%; border-radius:100px; transition:width 0.6s ease; }

        .sm-reasons { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
        .sm-reason  { padding:3px 10px; border-radius:100px; font-size:11px; font-weight:600; background:#f5f5f5; color:#555; }

        .sm-metrics { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:16px; }
        .sm-metric  { background:rgba(0,0,0,0.03); border-radius:10px; padding:8px; text-align:center; }
        .sm-metric-val { font-size:14px; font-weight:800; color:#111; }
        .sm-metric-lbl { font-size:10px; color:#aaa; font-weight:600; text-transform:uppercase; }

        .sm-invite-btn { width:100%; padding:11px; border-radius:12px; font-size:13px; font-weight:700; border:none; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.2s; }
        .sm-invite-btn.send    { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 2px 10px rgba(79,70,229,0.25); }
        .sm-invite-btn.send:hover { transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,70,229,0.35); }
        .sm-invite-btn.sent    { background:#dcfce7; color:#16a34a; cursor:default; }
        .sm-invite-btn.loading { opacity:0.7; cursor:not-allowed; }

        .sm-empty { text-align:center; padding:60px 20px; color:#aaa; }
        .sm-empty-icon  { font-size:52px; margin-bottom:12px; }
        .sm-empty-title { font-size:18px; font-weight:800; color:#555; margin-bottom:6px; }

        .spinner { width:24px; height:24px; border:3px solid #e0e0e0; border-top-color:#4f46e5; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; display:block; }
        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:9999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.15); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#22c55e; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <div className="sm">
        {/* HEADER */}
        <div className="sm-header">
          <div className="sm-header-top">
            <div>
              <div className="sm-title">🎯 Smart Matching</div>
              <div className="sm-sub">AI-powered creator recommendations for your campaigns</div>
            </div>
            <div className="sm-ai-badge">✨ AI Powered</div>
          </div>
          {/* CAMPAIGN SELECTOR */}
          {campaigns.length > 0 && (
            <div className="sm-camp-row">
              {campaigns.map(c=>(
                <button key={c._id} className={`sm-camp-chip ${selectedCamp?._id===c._id?"active":""}`}
                  onClick={()=>handleCampSelect(c)}>
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="sm-body">
          {loading ? <div className="spinner" /> : (
            <>
              {/* CAMPAIGN INFO */}
              {selectedCamp && (
                <div className="sm-camp-info">
                  <div style={{flex:1}}>
                    <div className="sm-camp-info-title">{selectedCamp.title}</div>
                    <div style={{fontSize:13,color:"#888",marginTop:2}}>{selectedCamp.description?.slice(0,120)}{selectedCamp.description?.length>120?"...":""}</div>
                    <div className="sm-info-chips">
                      {selectedCamp.category  && <span className="sm-info-chip">📂 {selectedCamp.category}</span>}
                      {selectedCamp.budget    && <span className="sm-info-chip">💰 ₹{Number(selectedCamp.budget).toLocaleString()}</span>}
                      {selectedCamp.platform  && <span className="sm-info-chip">📱 {selectedCamp.platform}</span>}
                      {selectedCamp.deadline  && <span className="sm-info-chip">📅 {new Date(selectedCamp.deadline).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:28,fontWeight:800,color:"#4f46e5"}}>{matches.length}</div>
                    <div style={{fontSize:12,color:"#aaa",fontWeight:600}}>Matches Found</div>
                  </div>
                </div>
              )}

              {/* STATS */}
              <div className="sm-stats">
                {[
                  { icon:"🎯", val:matches.length,                                                    lbl:"Total Matches" },
                  { icon:"🔥", val:matches.filter(m=>m._score>=60).length,                           lbl:"Top Matches" },
                  { icon:"📨", val:Object.values(invited).filter(Boolean).length,                    lbl:"Invited" },
                  { icon:"👥", val:creators.length,                                                   lbl:"Total Creators" },
                ].map((s,i)=>(
                  <div key={i} className="sm-stat">
                    <div style={{fontSize:22,marginBottom:4}}>{s.icon}</div>
                    <div className="sm-stat-val">{s.val}</div>
                    <div className="sm-stat-lbl">{s.lbl}</div>
                  </div>
                ))}
              </div>

              {/* MATCHES */}
              {matches.length===0 ? (
                <div className="sm-empty">
                  <div className="sm-empty-icon">🔍</div>
                  <div className="sm-empty-title">No matches found</div>
                  <div>Try selecting a campaign with a category, or add more creator profiles</div>
                </div>
              ) : (
                <div className="sm-grid">
                  {matches.map((cr,i)=>{
                    const mc     = getMatchColor(cr._score);
                    const pct    = Math.min(100, Math.round((cr._score/80)*100));
                    const isInv  = invited[cr._id];
                    const isLoading = inviting===cr._id;
                    return (
                      <div key={cr._id} className="sm-card"
                        style={{background:mc.bg,borderColor:mc.border,animationDelay:`${i*0.05}s`}}>
                        {/* TOP */}
                        <div className="sm-card-top">
                          <div className="sm-av">
                            {cr.profileImage ? <img src={cr.profileImage} alt="" /> : (cr.name||"C").charAt(0).toUpperCase()}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div className="sm-name">{cr.name||cr.username||"Creator"}</div>
                            <div className="sm-niche">{cr.category||cr.niche||"Creator"}</div>
                          </div>
                          <div className="sm-match-badge" style={{background:mc.badge}}>{mc.label}</div>
                        </div>

                        {/* SCORE BAR */}
                        <div className="sm-score-bar-wrap">
                          <div className="sm-score-label">
                            <span>Match Score</span>
                            <span style={{color:mc.badge,fontWeight:800}}>{cr._score}/80</span>
                          </div>
                          <div className="sm-score-bar">
                            <div className="sm-score-fill" style={{width:`${pct}%`,background:mc.badge}} />
                          </div>
                        </div>

                        {/* REASONS */}
                        <div className="sm-reasons">
                          {cr._reasons.map((r:string,j:number)=>(
                            <span key={j} className="sm-reason">{r}</span>
                          ))}
                        </div>

                        {/* METRICS */}
                        <div className="sm-metrics">
                          <div className="sm-metric">
                            <div className="sm-metric-val">{cr.followers?Number(cr.followers).toLocaleString():"—"}</div>
                            <div className="sm-metric-lbl">Followers</div>
                          </div>
                          <div className="sm-metric">
                            <div className="sm-metric-val">{cr.engagementRate||cr.engagement||"—"}{cr.engagementRate?"%":""}</div>
                            <div className="sm-metric-lbl">Engagement</div>
                          </div>
                          <div className="sm-metric">
                            <div className="sm-metric-val">{cr.completedCampaigns||0}</div>
                            <div className="sm-metric-lbl">Campaigns</div>
                          </div>
                        </div>

                        {/* INVITE */}
                        <button
                          className={`sm-invite-btn ${isInv?"sent":isLoading?"loading":"send"}`}
                          onClick={()=>!isInv && !isLoading && handleInvite(cr._id)}
                          disabled={isInv||isLoading}>
                          {isInv ? "✅ Invite Sent" : isLoading ? "Sending..." : "📨 Invite to Campaign"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}