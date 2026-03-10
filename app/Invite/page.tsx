"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function InvitePage() {
  const router = useRouter();
  const [token, setToken]       = useState("");
  const [role, setRole]         = useState("");
  const [campaigns, setCampaigns]   = useState<any[]>([]);
  const [creators, setCreators]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("all");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [inviting, setInviting]     = useState<string | null>(null);
  const [invited, setInvited]       = useState<Record<string, string>>({});  // creatorId -> campaignId
  const [toast, setToast] = useState<{ msg: string; type: "success"|"error"|"warn" }|null>(null);
  const [selectedCreator, setSelectedCreator] = useState<any>(null);

  const showToast = (msg: string, type: "success"|"error"|"warn" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }
    const p = JSON.parse(raw);
    if (p.role?.toLowerCase() !== "brand") { router.push("/"); return; }
    setToken(p.token);
    setRole(p.role?.toLowerCase());
    const saved = localStorage.getItem(`invites_${p.user?._id||p._id||p.id}`);
    if (saved) setInvited(JSON.parse(saved));
    fetchAll(p.token);
  }, []);

  const fetchAll = async (t: string) => {
    try {
      const [campRes, creatorRes] = await Promise.all([
        fetch(`${API}/campaigns/my`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      const campData   = await campRes.json();
      const creatorData= await creatorRes.json();
      setCampaigns(campData.data || campData.campaigns || []);
      setCreators(creatorData.data || creatorData.influencers || creatorData || []);
    } catch {}
    finally { setLoading(false); }
  };

  const handleInvite = async (creator: any) => {
    if (!selectedCampaign) { showToast("Select a campaign first!", "error"); return; }
    const cid = creator._id || creator.id;
    setInviting(cid);
    try {
      const res = await fetch(`${API}/invite/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: cid, campaignId: selectedCampaign }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send invite");
      const raw = localStorage.getItem("cb_user");
      const uid = raw ? (JSON.parse(raw).user?._id || JSON.parse(raw)._id) : "";
      const newInvited = { ...invited, [cid]: selectedCampaign };
      setInvited(newInvited);
      localStorage.setItem(`invites_${uid}`, JSON.stringify(newInvited));
      showToast(`✅ Invite sent to ${creator.name || "creator"}!`, "success");
    } catch (err: any) { showToast(err.message || "Invite failed", "error"); }
    finally { setInviting(null); }
  };

  const categories = ["all", ...Array.from(new Set(creators.map(c => c.category || c.niche).filter(Boolean))) as string[]];

  const filtered = creators.filter(c => {
    const name = (c.name || c.username || "").toLowerCase();
    const cat  = (c.category || c.niche || "").toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || cat.includes(search.toLowerCase());
    const matchCat    = filterCat === "all" || cat === filterCat.toLowerCase();
    return matchSearch && matchCat;
  });

  const selectedCamp = campaigns.find(c => c._id === selectedCampaign);
  const invitedThisCampaign = Object.values(invited).filter(v => v === selectedCampaign).length;

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
        @keyframes pulse   { 0%,100%{transform:scale(1)}50%{transform:scale(1.04)} }

        .iv { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }

        /* HEADER */
        .iv-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; }
        @media(max-width:600px){ .iv-header{ padding:14px 16px; } }
        .iv-title { font-size: 22px; font-weight: 800; color: #111; }
        .iv-sub   { font-size: 13px; color: #aaa; margin-top: 2px; }

        /* CAMPAIGN SELECT BANNER */
        .iv-camp-banner { margin: 20px 32px 0; padding: 18px 22px; background: #fff; border-radius: 18px; border: 1.5px solid #efefef; }
        @media(max-width:600px){ .iv-camp-banner{ margin:14px 16px 0; padding:14px 16px; } }
        .iv-camp-label { font-size: 12px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 10px; }
        .iv-camp-select { width: 100%; padding: 12px 16px; border-radius: 12px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; cursor: pointer; color: #111; background: #fff; }
        .iv-camp-select:focus { border-color: #4f46e5; }
        .iv-camp-info { display: flex; gap: 16px; margin-top: 14px; flex-wrap: wrap; }
        .iv-camp-chip { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; }
        .iv-camp-chip.blue   { background: #eef2ff; color: #4f46e5; border: 1px solid #c7d2fe; }
        .iv-camp-chip.green  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .iv-camp-chip.orange { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
        .iv-no-camp { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; margin-top: 12px; font-size: 13px; color: #92400e; font-weight: 600; }

        /* TOOLBAR */
        .iv-toolbar { padding: 16px 32px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        @media(max-width:600px){ .iv-toolbar{ padding:12px 16px; gap:8px; } }
        .iv-search { flex: 1; min-width: 200px; position: relative; }
        .iv-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 15px; pointer-events: none; }
        .iv-search-input { width: 100%; padding: 10px 14px 10px 36px; border-radius: 12px; border: 1.5px solid #ebebeb; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; outline: none; background: #fff; }
        .iv-search-input:focus { border-color: #4f46e5; }
        .iv-cats { display: flex; gap: 6px; flex-wrap: wrap; }
        .iv-cat-btn { padding: 7px 14px; border-radius: 10px; font-size: 12px; font-weight: 600; border: 1.5px solid #ebebeb; background: #fff; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; color: #555; transition: all 0.15s; white-space: nowrap; }
        .iv-cat-btn.active { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }

        /* STATS */
        .iv-stats { display: flex; gap: 12px; padding: 0 32px 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .iv-stats{ padding:0 16px 12px; gap:10px; } }
        .iv-stat { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 12px 18px; display: flex; align-items: center; gap: 10px; }
        .iv-stat-val { font-size: 20px; font-weight: 800; color: #111; }
        .iv-stat-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

        /* GRID */
        .iv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; padding: 0 32px 40px; }
        @media(max-width:768px){ .iv-grid{ grid-template-columns:1fr; padding:0 16px 28px; gap:10px; } }

        /* CARD */
        .iv-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 20px; transition: all 0.22s; animation: fadeUp 0.3s ease both; cursor: pointer; }
        .iv-card.invited { border-color: #bbf7d0; background: #fafffe; }
        .iv-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.07); transform: translateY(-2px); }
        .iv-card-top { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
        .iv-avatar { width: 56px; height: 56px; border-radius: 14px; object-fit: cover; flex-shrink: 0; }
        .iv-avatar-fb { width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 22px; font-weight: 800; flex-shrink: 0; }
        .iv-name     { font-size: 15px; font-weight: 700; color: #111; margin-bottom: 3px; }
        .iv-category { font-size: 12px; color: #9ca3af; }
        .iv-followers{ font-size: 13px; color: #4f46e5; font-weight: 700; margin-top: 4px; }
        .iv-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
        .iv-tag { padding: 3px 10px; background: #f5f5f3; border-radius: 100px; font-size: 11px; color: #666; font-weight: 600; border: 1px solid #ebebeb; }
        .iv-tag.match { background: #eef2ff; color: #4f46e5; border-color: #c7d2fe; }
        .iv-stats-row { display: flex; gap: 10px; margin-bottom: 14px; }
        .iv-stat-mini { flex: 1; background: #f9f9f8; border-radius: 10px; padding: 8px 10px; text-align: center; border: 1px solid #f0f0f0; }
        .iv-stat-mini-val { font-size: 14px; font-weight: 800; color: #111; }
        .iv-stat-mini-lbl { font-size: 10px; color: #bbb; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
        .iv-invite-btn { width: 100%; padding: 11px; border-radius: 12px; font-size: 13px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .iv-invite-btn.send { background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; box-shadow: 0 3px 10px rgba(79,70,229,0.25); }
        .iv-invite-btn.send:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(79,70,229,0.35); }
        .iv-invite-btn.sent { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; cursor: default; }
        .iv-invite-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* DETAIL MODAL */
        .dm-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.2s; }
        .dm-box { background:#fff; border-radius:24px; max-width:460px; width:100%; max-height:90vh; overflow-y:auto; animation:slideUp 0.25s ease; }
        .dm-head { background:linear-gradient(135deg,#1e1b4b,#4f46e5); padding:28px 28px 24px; border-radius:24px 24px 0 0; position:relative; }
        .dm-close { position:absolute; top:16px; right:16px; width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.15); border:none; color:#fff; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .dm-av { width:72px; height:72px; border-radius:16px; border:3px solid rgba(255,255,255,0.3); object-fit:cover; margin-bottom:12px; }
        .dm-av-fb { width:72px; height:72px; border-radius:16px; border:3px solid rgba(255,255,255,0.3); background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:800; margin-bottom:12px; }
        .dm-name { font-size:24px; font-weight:800; color:#fff; margin-bottom:4px; }
        .dm-cat  { font-size:13px; color:rgba(255,255,255,0.7); }
        .dm-body { padding:24px; }
        .dm-row  { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f5f5f5; font-size:14px; }
        .dm-row:last-child { border-bottom:none; }
        .dm-lbl  { color:#888; font-weight:500; }
        .dm-val  { font-weight:700; color:#111; }
        .dm-bio  { font-size:13px; color:#555; line-height:1.7; padding:12px 14px; background:#f9f9f8; border-radius:10px; margin-bottom:16px; }
        .dm-sect { font-size:11px; font-weight:700; color:#aaa; text-transform:uppercase; letter-spacing:0.07em; margin:16px 0 10px; }
        .dm-invite-btn { width:100%; padding:14px; border-radius:14px; font-size:15px; font-weight:700; font-family:'Plus Jakarta Sans',sans-serif; border:none; cursor:pointer; transition:all 0.2s; margin-top:4px; }
        .dm-invite-btn.send { background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; box-shadow:0 4px 16px rgba(79,70,229,0.3); }
        .dm-invite-btn.send:hover:not(:disabled) { transform:translateY(-1px); }
        .dm-invite-btn.sent { background:#f0fdf4; color:#16a34a; border:1.5px solid #bbf7d0; cursor:default; }
        .dm-invite-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .dm-camp-select { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid #ebebeb; font-size:14px; font-family:'Plus Jakarta Sans',sans-serif; outline:none; cursor:pointer; color:#111; margin-bottom:10px; }
        .dm-camp-select:focus { border-color:#4f46e5; }

        .spinner { width:28px; height:28px; border:3px solid #e0e0e0; border-top-color:#4f46e5; border-radius:50%; animation:spin 0.8s linear infinite; margin:60px auto; display:block; }
        .toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; z-index:99999; animation:toastIn 0.3s ease; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.12); font-family:'Plus Jakarta Sans',sans-serif; }
        .toast.success { background:#111; color:#fff; }
        .toast.error   { background:#ef4444; color:#fff; }
        .toast.warn    { background:#f59e0b; color:#fff; }
      `}</style>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* CREATOR DETAIL MODAL */}
      {selectedCreator && (() => {
        const cid = selectedCreator._id || selectedCreator.id;
        const isInvited = !!invited[cid];
        return (
          <div className="dm-overlay" onClick={e => e.target === e.currentTarget && setSelectedCreator(null)}>
            <div className="dm-box">
              <div className="dm-head">
                <button className="dm-close" onClick={() => setSelectedCreator(null)}>✕</button>
                {selectedCreator.profileImage
                  ? <img src={selectedCreator.profileImage} className="dm-av" alt="" />
                  : <div className="dm-av-fb">{(selectedCreator.name||"C").charAt(0).toUpperCase()}</div>}
                <div className="dm-name">{selectedCreator.name || selectedCreator.username}</div>
                <div className="dm-cat">{selectedCreator.category || selectedCreator.niche || "Creator"}</div>
              </div>
              <div className="dm-body">
                {selectedCreator.bio && <div className="dm-bio">{selectedCreator.bio}</div>}
                <div className="dm-sect">Stats</div>
                <div className="dm-row"><span className="dm-lbl">Followers</span><span className="dm-val">{selectedCreator.followers ? Number(selectedCreator.followers).toLocaleString() : "—"}</span></div>
                {selectedCreator.engagementRate && <div className="dm-row"><span className="dm-lbl">Engagement</span><span className="dm-val">{selectedCreator.engagementRate}%</span></div>}
                {selectedCreator.location && <div className="dm-row"><span className="dm-lbl">Location</span><span className="dm-val">{selectedCreator.location}</span></div>}
                {selectedCreator.avgViews && <div className="dm-row"><span className="dm-lbl">Avg Views</span><span className="dm-val">{Number(selectedCreator.avgViews).toLocaleString()}</span></div>}

                <div className="dm-sect">Send Invite</div>
                <select className="dm-camp-select" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                  <option value="">Select campaign...</option>
                  {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                </select>
                <button
                  className={`dm-invite-btn ${isInvited ? "sent" : "send"}`}
                  disabled={inviting === cid || isInvited}
                  onClick={() => !isInvited && handleInvite(selectedCreator)}>
                  {isInvited ? "✅ Invite Sent" : inviting === cid ? "Sending..." : "📨 Send Invite"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="iv">
        <div className="iv-header">
          <div>
            <div className="iv-title">Invite Influencers</div>
            <div className="iv-sub">Find & invite creators directly to your campaigns</div>
          </div>
        </div>

        {/* CAMPAIGN SELECTOR */}
        <div className="iv-camp-banner">
          <div className="iv-camp-label">Select Campaign to Invite For</div>
          <select className="iv-camp-select" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
            <option value="">Choose a campaign...</option>
            {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
          {selectedCampaign && selectedCamp ? (
            <div className="iv-camp-info">
              <div className="iv-camp-chip blue">📋 {selectedCamp.title}</div>
              {selectedCamp.budget && <div className="iv-camp-chip green">💰 ₹{Number(selectedCamp.budget).toLocaleString()}</div>}
              {selectedCamp.category && <div className="iv-camp-chip orange">🏷️ {selectedCamp.category}</div>}
              <div className="iv-camp-chip blue">📨 {invitedThisCampaign} invited</div>
            </div>
          ) : (
            <div className="iv-no-camp">⚠️ Select a campaign above to start inviting creators</div>
          )}
        </div>

        {/* TOOLBAR */}
        <div className="iv-toolbar">
          <div className="iv-search">
            <span className="iv-search-icon">🔍</span>
            <input className="iv-search-input" placeholder="Search by name or category..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="iv-cats">
            {categories.slice(0, 6).map(cat => (
              <button key={cat} className={`iv-cat-btn ${filterCat === cat ? "active" : ""}`} onClick={() => setFilterCat(cat)}>
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>
        </div>

        {/* STATS */}
        <div className="iv-stats">
          <div className="iv-stat"><span style={{fontSize:18}}>👥</span><div><div className="iv-stat-val">{creators.length}</div><div className="iv-stat-lbl">Creators</div></div></div>
          <div className="iv-stat"><span style={{fontSize:18}}>📨</span><div><div className="iv-stat-val">{Object.keys(invited).length}</div><div className="iv-stat-lbl">Invited</div></div></div>
          <div className="iv-stat"><span style={{fontSize:18}}>🎯</span><div><div className="iv-stat-val">{filtered.length}</div><div className="iv-stat-lbl">Showing</div></div></div>
          {selectedCampaign && <div className="iv-stat"><span style={{fontSize:18}}>📋</span><div><div className="iv-stat-val">{invitedThisCampaign}</div><div className="iv-stat-lbl">This Campaign</div></div></div>}
        </div>

        {/* GRID */}
        {loading ? <div className="spinner" /> :
          filtered.length === 0 ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 24px",textAlign:"center",margin:"0 32px",background:"#fff",borderRadius:18,border:"1.5px dashed #e0e0e0"}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <div style={{fontSize:18,fontWeight:800,color:"#111",marginBottom:8}}>No creators found</div>
              <div style={{fontSize:14,color:"#aaa"}}>Try a different search or category</div>
            </div>
          ) : (
            <div className="iv-grid">
              {filtered.map((c, idx) => {
                const cid = c._id || c.id;
                const isInvited = !!invited[cid];
                const campMatch = selectedCamp && (
                  (c.category || c.niche || "").toLowerCase() === (selectedCamp.category || "").toLowerCase()
                );
                return (
                  <div key={cid} className={`iv-card ${isInvited ? "invited" : ""}`}
                    style={{ animationDelay: `${idx * 0.04}s` }}
                    onClick={() => setSelectedCreator(c)}>

                    <div className="iv-card-top">
                      {c.profileImage
                        ? <img src={c.profileImage} className="iv-avatar" alt="" />
                        : <div className="iv-avatar-fb">{(c.name||"C").charAt(0).toUpperCase()}</div>}
                      <div style={{flex:1}}>
                        <div className="iv-name">{c.name || c.username || "Creator"}</div>
                        <div className="iv-category">{c.category || c.niche || "Creator"}</div>
                        <div className="iv-followers">👥 {c.followers ? Number(c.followers).toLocaleString() : "—"}</div>
                      </div>
                    </div>

                    {/* TAGS */}
                    <div className="iv-tags">
                      {c.category && <span className={`iv-tag ${campMatch ? "match" : ""}`}>{c.category}</span>}
                      {c.location  && <span className="iv-tag">📍 {c.location}</span>}
                      {c.engagementRate && <span className="iv-tag">⚡ {c.engagementRate}% ER</span>}
                      {campMatch && <span className="iv-tag match">✓ Category Match</span>}
                    </div>

                    {/* MINI STATS */}
                    <div className="iv-stats-row">
                      <div className="iv-stat-mini">
                        <div className="iv-stat-mini-val">{c.followers ? (c.followers >= 1000000 ? (c.followers/1000000).toFixed(1)+"M" : c.followers >= 1000 ? (c.followers/1000).toFixed(0)+"K" : c.followers) : "—"}</div>
                        <div className="iv-stat-mini-lbl">Followers</div>
                      </div>
                      <div className="iv-stat-mini">
                        <div className="iv-stat-mini-val">{c.engagementRate ? c.engagementRate+"%" : "—"}</div>
                        <div className="iv-stat-mini-lbl">Eng. Rate</div>
                      </div>
                      <div className="iv-stat-mini">
                        <div className="iv-stat-mini-val">{c.completedDeals || c.totalCampaigns || "—"}</div>
                        <div className="iv-stat-mini-lbl">Campaigns</div>
                      </div>
                    </div>

                    {/* INVITE BUTTON */}
                    <div onClick={e => e.stopPropagation()}>
                      <button
                        className={`iv-invite-btn ${isInvited ? "sent" : "send"}`}
                        disabled={inviting === cid || isInvited || !selectedCampaign}
                        onClick={() => handleInvite(c)}>
                        {isInvited
                          ? "✅ Invite Sent"
                          : inviting === cid
                          ? "Sending..."
                          : !selectedCampaign
                          ? "Select campaign first"
                          : "📨 Send Invite"}
                      </button>
                    </div>
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