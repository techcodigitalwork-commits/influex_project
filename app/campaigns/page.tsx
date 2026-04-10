"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

export default function CampaignBoard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [role, setRole]           = useState<string>("");
  const [toast, setToast]         = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

  // ── Confirm Complete Modal ──
  const [confirmCampaignId, setConfirmCampaignId] = useState<string | null>(null);
  const [completingId, setCompletingId]           = useState<string | null>(null);

  // ── Edit Modal ──
  const [editCampaign, setEditCampaign] = useState<any | null>(null);
  const [editForm, setEditForm]         = useState<any>({});
  const [editLoading, setEditLoading]   = useState(false);

  const fetchedRef = useRef(false);

  const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Init ──
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("cb_user");
    if (!raw) { router.push("/login"); return; }

    const parsed = JSON.parse(raw);
    const userRole = parsed?.role?.toLowerCase();
    setRole(userRole);

    if (userRole !== "brand" && userRole !== "admin") {
      router.push("/discovery");
      return;
    }

    const token = parsed.token || localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    fetchCampaigns(token);
  }, []);

  // ── FIX 1: No more fetchAllAppCounts — use applicationsCount from campaign object ──
  const fetchCampaigns = async (token: string) => {
    try {
      setLoading(true);
      const res  = await fetch(`${API_BASE}/campaigns/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.clear();
        router.push("/login");
        return;
      }

      if (!res.ok) {
        setCampaigns([]);
        return;
      }

      // FIX 2: Clean response parsing — backend returns { success, data: [] }
      const data = await res.json();
      const list: any[] = data?.data ?? [];
      setCampaigns(list);

      // FIX 3: Always sync bits regardless of subscription status
      if (typeof data.bits === "number") {
        const raw = localStorage.getItem("cb_user");
        if (raw) {
          const p = JSON.parse(raw);
          localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: data.bits }));
        }
      }
    } catch (err) {
      console.error("fetchCampaigns error:", err);
      setCampaigns([]);
      showToast("Failed to load campaigns", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Complete Campaign ──
  const completeCampaign = async (campaignId: string) => {
    const token = getToken();
    if (!token) return;
    setCompletingId(campaignId);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to complete campaign");

      // FIX 4: Optimistic UI update — no full refetch needed
      setCampaigns(prev =>
        prev.map(c => c._id === campaignId ? { ...c, status: "completed" } : c)
      );
      showToast("Campaign marked as completed ✓", "success");
      setConfirmCampaignId(null);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Something went wrong", "error");
      setConfirmCampaignId(null);
    } finally {
      setCompletingId(null);
    }
  };

  // ── Open Edit Modal ──
  const openEdit = (c: any) => {
    setEditCampaign(c);
    setEditForm({
      title:       c.title || "",
      description: c.description || "",
      budget:      c.budget || "",
      city:        c.city || "",
      categories:  Array.isArray(c.categories)
        ? c.categories.join(", ")
        : c.categories || "",
    });
  };

  // ── Save Edit ──
  const saveEdit = async () => {
    if (!editCampaign) return;
    const token = getToken();
    if (!token) return;
    setEditLoading(true);
    try {
      // FIX 5: Prevent NaN on empty budget
      const body = {
        title:       editForm.title,
        description: editForm.description,
        budget:      editForm.budget ? Number(editForm.budget) : 0,
        city:        editForm.city,
        categories:  editForm.categories
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean),
      };
      const res = await fetch(`${API_BASE}/campaigns/update/${editCampaign._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Update failed");
      }
      showToast("Campaign updated successfully ✓", "success");
      setEditCampaign(null);
      fetchCampaigns(token);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Helper ──
  const getToken = (): string | null => {
    const raw = localStorage.getItem("cb_user");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed.token || localStorage.getItem("token") || null;
  };

  // ── Derived stats ──
  const totalApps = campaigns.reduce(
    (sum, c) => sum + (c.applicationsCount ?? 0), 0
  );

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
        <p style={{ color: "#999", fontSize: "14px", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Loading campaigns...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .cb { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }

        /* HEADER */
        .cb-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
        @media(max-width:600px){ .cb-header{ padding: 14px 16px; } }
        .cb-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 2px; }
        .cb-sub   { color: #aaa; font-size: 13px; margin: 0; }
        .cb-header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        .cb-create-btn { padding: 10px 20px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); display: inline-flex; align-items: center; gap: 6px; }
        .cb-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

        /* STATS BAR */
        .cb-stats-bar { display: flex; gap: 14px; padding: 16px 32px 0; flex-wrap: wrap; }
        @media(max-width:600px){ .cb-stats-bar{ padding: 12px 16px 0; gap: 10px; } }
        .cb-stat-chip { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; gap: 8px; }
        .cb-stat-chip-val { font-size: 18px; font-weight: 800; color: #111; }
        .cb-stat-chip-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

        /* GRID */
        .cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; padding: 20px 32px 40px; }
        @media(max-width:768px){ .cb-grid{ grid-template-columns: 1fr; padding: 14px 16px 28px; gap: 12px; } }

        /* CARD */
        .cb-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 22px; transition: all 0.22s; position: relative; overflow: hidden; }
        .cb-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg,#4f46e5,#7c3aed); opacity: 0; transition: opacity 0.2s; }
        .cb-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
        .cb-card:hover::before { opacity: 1; }

        .cb-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
        .cb-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; flex: 1; line-height: 1.4; }
        .cb-badge { padding: 4px 11px; border-radius: 100px; font-size: 11px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em; }
        .cb-badge-open      { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .cb-badge-completed { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

        .cb-desc { color: #888; font-size: 13px; line-height: 1.65; margin: 6px 0 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 42px; }

        .cb-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
        .cb-meta-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
        .cb-meta-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
        .cb-meta-val { font-size: 13px; font-weight: 700; color: #111; }
        .cb-meta-item.apps-highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
        .cb-meta-item.apps-highlight .cb-meta-label { color: #6366f1; }
        .cb-meta-item.apps-highlight .cb-meta-val { color: #4f46e5; font-size: 16px; }

        .cb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .cb-btn { flex: 1; min-width: 70px; padding: 9px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; white-space: nowrap; gap: 4px; }
        .cb-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .cb-btn-view     { background: #f5f5f3; color: #555; }
        .cb-btn-view:hover     { background: #ebebeb; }
        .cb-btn-apps     { background: #eff6ff; color: #2563eb; }
        .cb-btn-apps:hover     { background: #dbeafe; }
        .cb-btn-edit     { background: #f5f3ff; color: #7c3aed; }
        .cb-btn-edit:hover     { background: #ede9fe; }
        .cb-btn-complete { background: #f0fdf4; color: #15803d; }
        .cb-btn-complete:hover:not(:disabled) { background: #dcfce7; }

        /* EMPTY */
        .cb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
        @media(max-width:600px){ .cb-empty{ margin: 14px 12px; padding: 48px 20px; } }
        .cb-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .cb-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
        .cb-empty-sub   { color: #aaa; font-size: 14px; margin: 0 0 24px; line-height: 1.6; max-width: 280px; }

        /* MODAL SHARED */
        .cm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
        .cm-box { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; padding: 36px 32px 28px; position: relative; text-align: center; animation: slideUp 0.25s ease; }
        .cm-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
        .cm-close:hover { background: #ebebeb; color: #333; }
        .cm-icon  { font-size: 52px; margin-bottom: 14px; line-height: 1; }
        .cm-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px; }
        .cm-sub   { font-size: 14px; color: #777; line-height: 1.65; margin-bottom: 24px; }

        /* CONFIRM MODAL BUTTONS */
        .cm-confirm-actions { display: flex; gap: 10px; }
        .cm-btn-cancel  { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #e5e5e5; background: #fff; color: #555; cursor: pointer; transition: all 0.2s; }
        .cm-btn-cancel:hover  { background: #f5f5f3; }
        .cm-btn-confirm { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(22,163,74,0.25); }
        .cm-btn-confirm:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(22,163,74,0.35); }
        .cm-btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

        /* EDIT MODAL */
        .cm-box-edit { background: #fff; border-radius: 24px; max-width: 480px; width: 100%; padding: 32px; position: relative; animation: slideUp 0.25s ease; max-height: 90vh; overflow-y: auto; text-align: left; }
        .cm-edit-title { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 20px; }
        .cm-field { margin-bottom: 14px; }
        .cm-field label { display: block; font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .cm-field input, .cm-field textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #ebebeb; border-radius: 10px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #111; outline: none; transition: border 0.2s; background: #fafaf9; }
        .cm-field input:focus, .cm-field textarea:focus { border-color: #4f46e5; background: #fff; }
        .cm-field textarea { min-height: 80px; resize: vertical; }
        .cm-edit-actions { display: flex; gap: 10px; margin-top: 20px; }
        .cm-btn-save { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
        .cm-btn-save:hover:not(:disabled) { transform: translateY(-1px); }
        .cm-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .cm-mini-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; margin-right: 6px; vertical-align: middle; }

        /* TOAST */
        .cb-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; text-align: center; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
        .cb-toast.success { background: #111; color: #fff; }
        .cb-toast.error   { background: #ef4444; color: #fff; }
        .cb-toast.warn    { background: #f59e0b; color: #fff; }
      `}</style>

      {toast && <div className={`cb-toast ${toast.type}`}>{toast.msg}</div>}

      {/* ── CONFIRM COMPLETE MODAL ── */}
      {confirmCampaignId && (
        <div className="cm-overlay">
          <div className="cm-box">
            <button className="cm-close" onClick={() => setConfirmCampaignId(null)}>✕</button>
            <div className="cm-icon">✅</div>
            <div className="cm-title">Are you sure?</div>
            <div className="cm-sub">
              Marking this campaign as <strong>completed</strong> cannot be undone.
            </div>
            <div className="cm-confirm-actions">
              <button className="cm-btn-cancel" onClick={() => setConfirmCampaignId(null)}>Cancel</button>
              <button
                className="cm-btn-confirm"
                disabled={!!completingId}
                onClick={() => completeCampaign(confirmCampaignId)}
              >
                {completingId ? <><span className="cm-mini-spin" />Completing...</> : "Yes, Complete It"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT CAMPAIGN MODAL ── */}
      {editCampaign && (
        <div className="cm-overlay">
          <div className="cm-box-edit">
            <button className="cm-close" onClick={() => setEditCampaign(null)}>✕</button>
            <div className="cm-edit-title">✏️ Edit Campaign</div>
            <div className="cm-field">
              <label>Title</label>
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Campaign title" />
            </div>
            <div className="cm-field">
              <label>Description</label>
              <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Campaign description" />
            </div>
            <div className="cm-field">
              <label>Budget (₹)</label>
              <input type="number" min="0" value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} placeholder="Budget amount" />
            </div>
            <div className="cm-field">
              <label>City</label>
              <input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" />
            </div>
            <div className="cm-field">
              <label>Categories (comma separated)</label>
              <input value={editForm.categories} onChange={e => setEditForm({ ...editForm, categories: e.target.value })} placeholder="e.g. Fashion, Lifestyle" />
            </div>
            <div className="cm-edit-actions">
              <button className="cm-btn-cancel" onClick={() => setEditCampaign(null)}>Cancel</button>
              <button className="cm-btn-save" onClick={saveEdit} disabled={editLoading}>
                {editLoading ? <><span className="cm-mini-spin" />Saving...</> : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cb">
        {/* HEADER */}
        <div className="cb-header">
          <div>
            <h1 className="cb-title">My Campaigns</h1>
            <p className="cb-sub">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total</p>
          </div>
          <div className="cb-header-right">
            {/* <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link> */}
            <Link href="/campaigns/post" prefetch={false} className="cb-create-btn">+ Create Campaign</Link>
          </div>
        </div>

        {/* STATS BAR */}
        {campaigns.length > 0 && (
          <div className="cb-stats-bar">
            <div className="cb-stat-chip">
              <span style={{ fontSize: 18 }}>📋</span>
              <div><div className="cb-stat-chip-val">{campaigns.length}</div><div className="cb-stat-chip-lbl">Total</div></div>
            </div>
            <div className="cb-stat-chip">
              <span style={{ fontSize: 18 }}>🟢</span>
              <div><div className="cb-stat-chip-val">{campaigns.filter(c => c.status === "open").length}</div><div className="cb-stat-chip-lbl">Open</div></div>
            </div>
            <div className="cb-stat-chip">
              <span style={{ fontSize: 18 }}>✅</span>
              <div><div className="cb-stat-chip-val">{campaigns.filter(c => c.status === "completed").length}</div><div className="cb-stat-chip-lbl">Completed</div></div>
            </div>
            <div className="cb-stat-chip">
              <span style={{ fontSize: 18 }}>👥</span>
              <div>
                {/* FIX 1: applicationsCount directly from campaign object — zero extra API calls */}
                <div className="cb-stat-chip-val">{totalApps}</div>
                <div className="cb-stat-chip-lbl">Total Apps</div>
              </div>
            </div>
          </div>
        )}

        {/* CAMPAIGNS */}
        {campaigns.length === 0 ? (
          <div className="cb-empty">
            <div className="cb-empty-icon">📋</div>
            <h3 className="cb-empty-title">No campaigns yet</h3>
            <p className="cb-empty-sub">Create your first campaign to start finding creators for your brand</p>
            {/* <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link> */}
            <Link href="/campaigns/post" prefetch={false} className="cb-create-btn">+ Create Campaign</Link>
          </div>
        ) : (
          <div className="cb-grid">
            {campaigns.map((c) => (
              <div key={c._id} className="cb-card">
                <div className="cb-card-top">
                  <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
                  <span className={`cb-badge ${c.status === "completed" ? "cb-badge-completed" : "cb-badge-open"}`}>
                    {c.status === "completed" ? "Completed" : "Open"}
                  </span>
                </div>
                {c.description && <p className="cb-desc">{c.description}</p>}
                <div className="cb-meta">
                  <div className="cb-meta-item">
                    <div className="cb-meta-label">Budget</div>
                    <div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div>
                  </div>
                  <div className="cb-meta-item">
                    <div className="cb-meta-label">City</div>
                    <div className="cb-meta-val">{c.city || "—"}</div>
                  </div>
                  <div className="cb-meta-item">
                    <div className="cb-meta-label">Category</div>
                    <div className="cb-meta-val" style={{ fontSize: "12px" }}>
                      {Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}
                    </div>
                  </div>
                  <div className="cb-meta-item apps-highlight">
                    <div className="cb-meta-label">Applications</div>
                    {/* FIX 1: use applicationsCount from campaign — no extra fetch */}
                    <div className="cb-meta-val">{c.applicationsCount ?? 0}</div>
                  </div>
                </div>
                <div className="cb-actions">
                  {/* <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">View</Link> */}
                  <Link href={`/campaigns/${c._id}`} prefetch={false} className="cb-btn cb-btn-view">View</Link>
                  <button className="cb-btn cb-btn-edit" onClick={() => openEdit(c)}>Edit</button>
                  {c.status !== "completed" && (
                    <button
                      className="cb-btn cb-btn-complete"
                      disabled={completingId === c._id}
                      onClick={() => setConfirmCampaignId(c._id)}
                    >
                      {completingId === c._id ? "..." : "✓ Complete"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}


// "use client";

// import { useState, useEffect , useRef } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API_BASE        = "https://api.collabzy.in/api";

// export default function CampaignBoard() {
//   const router = useRouter();
//   const [campaigns, setCampaigns]               = useState<any[]>([]);
//   const appCountsRef = useRef<Record<string, number>>({});
//   const [appCounts, setAppCounts]               = useState<Record<string, number>>({});
//   const [loading, setLoading]                   = useState(true);
//   const [role, setRole]                         = useState<string>("");
//   const [coins, setCoins]                       = useState<number | null>(null);
//   const [isSubscribed, setIsSubscribed]         = useState(false);
//   const [toast, setToast]                       = useState<{ msg: string; type: "success" | "error" | "warn" } | null>(null);

//   // ── Confirm Complete Modal ──
//   const [confirmCampaignId, setConfirmCampaignId] = useState<string | null>(null);

//   // ── Edit Modal ──
//   const [editCampaign, setEditCampaign]         = useState<any | null>(null);
//   const [editForm, setEditForm]                 = useState<any>({});
//   const [editLoading, setEditLoading]           = useState(false);

//   const showToast = (msg: string, type: "success" | "error" | "warn" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 4000);
//   };

//   // useEffect(() => {
//   //   if (typeof window === "undefined") return;
//   //   const raw = localStorage.getItem("cb_user");
//   //   if (!raw) { router.push("/login"); return; }
//   //   const parsed = JSON.parse(raw);
//   //   if (parsed.coins !== undefined) {
//   //     delete parsed.coins;
//   //     localStorage.setItem("cb_user", JSON.stringify(parsed));
//   //   }
//   //   const userRole = parsed?.role?.toLowerCase();
//   //   setRole(userRole);
//   //   if (userRole !== "brand" && userRole !== "admin") { router.push("/discovery"); return; }
//   //   const token = parsed.token || localStorage.getItem("token");
//   //   if (!token) { router.push("/login"); return; }
//   //   setIsSubscribed(parsed.isSubscribed ?? false);
//   //   fetchCampaigns(token, parsed);
//   // }, []);

 
// const fetchedRef = useRef(false);

// // ✅ reset counts once on mount
// useEffect(() => {
//   setAppCounts({});
// }, []);


// useEffect(() => {
//   if (fetchedRef.current) return;   // ✅ STOP duplicate call
//   fetchedRef.current = true;

//   if (typeof window === "undefined") return;

//   const raw = localStorage.getItem("cb_user");
//   if (!raw) { router.push("/login"); return; }

//   const parsed = JSON.parse(raw);
//   const userRole = parsed?.role?.toLowerCase();

//   setRole(userRole);

//   if (userRole !== "brand" && userRole !== "admin") {
//     router.push("/discovery");
//     return;
//   }

//   const token = parsed.token || localStorage.getItem("token");
//   if (!token) { router.push("/login"); return; }

//   setIsSubscribed(parsed.isSubscribed ?? false);

//   fetchCampaigns(token, parsed);

// }, []);

//   const fetchCampaigns = async (token: string, parsedUser?: any) => {
//     try {
//       setLoading(true);
//       const res  = await fetch(`${API_BASE}/campaigns/my`, { headers: { Authorization: `Bearer ${token}` } });
//       const data = await res.json();
//       if (!res.ok) {
//         if (res.status === 401) { localStorage.clear(); router.push("/login"); }
//         setCampaigns([]);
//         setCoins((parsedUser || JSON.parse(localStorage.getItem("cb_user") || "{}")).bits ?? 100);
//         return;
//       }
//       const list = data?.data || [] ? data : Array.isArray(data.campaigns) ? data.campaigns : Array.isArray(data.data) ? data.data : [];
//       setCampaigns(list);
//      setTimeout(() => {
//   fetchAllAppCounts(token, list);
// }, 0);
//       if (typeof data.bits === "number" && !data.isSubscribed) {
//         setCoins(data.bits);
//         const raw = localStorage.getItem("cb_user");
//         if (raw) {
//           const p = JSON.parse(raw);
//           localStorage.setItem("cb_user", JSON.stringify({ ...p, bits: data.bits }));
//         }
//       } else {
//         setCoins((parsedUser || JSON.parse(localStorage.getItem("cb_user") || "{}")).bits ?? 100);
//       }
//     } catch {
//       setCampaigns([]);
//       setCoins((parsedUser || JSON.parse(localStorage.getItem("cb_user") || "{}")).bits ?? 100);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // const fetchAllAppCounts = async (token: string, list: any[]) => {
//   //   const results = await Promise.allSettled(
//   //     list.map(async (c) => {
//   //       try {
//   //         const r = await fetch(`${API_BASE}/campaigns/${c._id}/applications`, { headers: { Authorization: `Bearer ${token}` } });
//   //         const d = await r.json();
//   //         const apps = d?.applications || d?.data || [];
//   //         return { id: c._id, count: Array.isArray(apps) ? apps.length : 0 };
//   //       } catch {
//   //         return { id: c._id, count: 0 };
//   //       }
//   //     })
//   //   );
//   //   const counts: Record<string, number> = {};
//   //   results.forEach((r) => {
//   //     if (r.status === "fulfilled") counts[r.value.id] = r.value.count;
//   //   });
//   //   setAppCounts(counts);
//   // };
     
// const fetchAllAppCounts = async (token: string, list: any[]) => {
//   const newCampaigns = list.filter(
//     c => appCountsRef.current[c._id] === undefined
//   );

//   if (newCampaigns.length === 0) return;

//   const results = await Promise.allSettled(
//     newCampaigns.map(async (c) => {
//       try {
//         const r = await fetch(`${API_BASE}/campaigns/${c._id}/applications`, {
//           headers: { Authorization: `Bearer ${token}` }
//         });
//         const d = await r.json();
//         const apps = d?.applications || d?.data || [];
//         return { id: c._id, count: apps.length };
//       } catch {
//         return { id: c._id, count: 0 };
//       }
//     })
//   );

//   const counts: Record<string, number> = {};

//   results.forEach((r) => {
//     if (r.status === "fulfilled") {
//       counts[r.value.id] = r.value.count;
//     }
//   });

//   setAppCounts(prev => {
//     const updated = { ...prev, ...counts };
//     appCountsRef.current = updated; // 🔥 IMPORTANT
//     return updated;
//   });
// };
//   // ── Complete Campaign (after confirm) ──
//   const completeCampaign = async (campaignId: string) => {
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = parsed.token || localStorage.getItem("token");
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${campaignId}/complete`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
//       if (!res.ok) throw new Error("Failed");
//       showToast("Campaign marked as completed ✓", "success");
//       setConfirmCampaignId(null);
//       fetchCampaigns(token);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//       setConfirmCampaignId(null);
//     }
//   };

//   // ── Open Edit Modal ──
//   const openEdit = (c: any) => {
//     setEditCampaign(c);
//     setEditForm({
//       title:       c.title || "",
//       description: c.description || "",
//       budget:      c.budget || "",
//       city:        c.city || "",
//       categories:  Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "",
//     });
//   };

//   // ── Save Edit ──
//   const saveEdit = async () => {
//     if (!editCampaign) return;
//     const parsed = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = parsed.token || localStorage.getItem("token");
//     setEditLoading(true);
//     try {
//       const body = {
//         title:       editForm.title,
//         description: editForm.description,
//         budget:      Number(editForm.budget),
//         city:        editForm.city,
//         categories:  editForm.categories.split(",").map((s: string) => s.trim()).filter(Boolean),
//       };
//       const res = await fetch(`${API_BASE}/campaigns/update/${editCampaign._id}`, {
//         method: "PUT",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify(body),
//       });
//       if (!res.ok) {
//         const err = await res.json().catch(() => ({}));
//         throw new Error(err.message || "Update failed");
//       }
//       showToast("Campaign updated successfully ✓", "success");
//       setEditCampaign(null);
//       fetchCampaigns(token);
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     } finally {
//       setEditLoading(false);
//     }
//   };

//   if (loading) return (
//     <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
//       <div style={{ textAlign: "center" }}>
//         <div style={{ width: "32px", height: "32px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
//         <p style={{ color: "#999", fontSize: "14px", fontFamily: "Plus Jakarta Sans, sans-serif" }}>Loading campaigns...</p>
//         <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
//       </div>
//     </div>
//   );

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         @keyframes spin    { to { transform: rotate(360deg); } }
//         @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
//         @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
//         @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
//         @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.5} }

//         .cb { font-family: 'Plus Jakarta Sans', sans-serif; background: #f7f7f5; min-height: 100vh; }

//         /* HEADER */
//         .cb-header { background: #fff; border-bottom: 1px solid #efefef; padding: 20px 32px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
//         @media(max-width:600px){ .cb-header{ padding: 14px 16px; } }
//         .cb-title { font-size: 22px; font-weight: 800; color: #111; margin: 0 0 2px; }
//         .cb-sub   { color: #aaa; font-size: 13px; margin: 0; }
//         .cb-header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

//         .cb-create-btn { padding: 10px 20px; background: linear-gradient(135deg,#4f46e5,#6366f1); color: #fff; border-radius: 12px; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); display: inline-flex; align-items: center; gap: 6px; }
//         .cb-create-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         /* STATS BAR */
//         .cb-stats-bar { display: flex; gap: 14px; padding: 16px 32px 0; flex-wrap: wrap; }
//         @media(max-width:600px){ .cb-stats-bar{ padding: 12px 16px 0; gap: 10px; } }
//         .cb-stat-chip { background: #fff; border: 1.5px solid #efefef; border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; gap: 8px; }
//         .cb-stat-chip-val { font-size: 18px; font-weight: 800; color: #111; }
//         .cb-stat-chip-lbl { font-size: 12px; color: #aaa; font-weight: 500; }

//         /* GRID */
//         .cb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; padding: 20px 32px 40px; }
//         @media(max-width:768px){ .cb-grid{ grid-template-columns: 1fr; padding: 14px 16px 28px; gap: 12px; } }

//         /* CARD */
//         .cb-card { background: #fff; border-radius: 18px; border: 1.5px solid #efefef; padding: 22px; transition: all 0.22s; position: relative; overflow: hidden; }
//         .cb-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg,#4f46e5,#7c3aed); opacity: 0; transition: opacity 0.2s; }
//         .cb-card:hover { border-color: #d4d0f7; box-shadow: 0 8px 32px rgba(79,70,229,0.08); transform: translateY(-2px); }
//         .cb-card:hover::before { opacity: 1; }

//         .cb-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
//         .cb-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; flex: 1; line-height: 1.4; }
//         .cb-badge { padding: 4px 11px; border-radius: 100px; font-size: 11px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.02em; }
//         .cb-badge-open      { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
//         .cb-badge-ongoing   { background: #fefce8; color: #b45309; border: 1px solid #fde68a; }
//         .cb-badge-completed { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }

//         .cb-desc { color: #888; font-size: 13px; line-height: 1.65; margin: 6px 0 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 42px; }

//         .cb-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
//         .cb-meta-item { background: #f9f9f8; border-radius: 10px; padding: 10px 12px; border: 1px solid #f0f0f0; }
//         .cb-meta-label { font-size: 10px; color: #c0c0c0; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 600; margin-bottom: 3px; }
//         .cb-meta-val { font-size: 13px; font-weight: 700; color: #111; }
//         .cb-meta-item.apps-highlight { background: linear-gradient(135deg,#eff6ff,#eef2ff); border-color: #c7d2fe; }
//         .cb-meta-item.apps-highlight .cb-meta-label { color: #6366f1; }
//         .cb-meta-item.apps-highlight .cb-meta-val { color: #4f46e5; font-size: 16px; }
//         .cb-meta-val.loading { animation: pulse 1.2s ease infinite; color: #ccc; }

//         .cb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
//         .cb-btn { flex: 1; min-width: 70px; padding: 9px 12px; border-radius: 10px; font-size: 12px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s; text-align: center; text-decoration: none; display: flex; align-items: center; justify-content: center; white-space: nowrap; gap: 4px; }
//         .cb-btn-view     { background: #f5f5f3; color: #555; }
//         .cb-btn-view:hover     { background: #ebebeb; }
//         .cb-btn-apps     { background: #eff6ff; color: #2563eb; }
//         .cb-btn-apps:hover     { background: #dbeafe; }
//         .cb-btn-edit     { background: #f5f3ff; color: #7c3aed; }
//         .cb-btn-edit:hover     { background: #ede9fe; }
//         .cb-btn-complete { background: #f0fdf4; color: #15803d; }
//         .cb-btn-complete:hover { background: #dcfce7; }

//         /* EMPTY */
//         .cb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 70px 24px; text-align: center; margin: 20px 32px; background: #fff; border-radius: 18px; border: 1.5px dashed #e0e0e0; }
//         @media(max-width:600px){ .cb-empty{ margin: 14px 12px; padding: 48px 20px; } }
//         .cb-empty-icon  { font-size: 48px; margin-bottom: 16px; }
//         .cb-empty-title { font-size: 20px; font-weight: 800; color: #111; margin: 0 0 8px; }
//         .cb-empty-sub   { color: #aaa; font-size: 14px; margin: 0 0 24px; line-height: 1.6; max-width: 280px; }

//         /* MODAL SHARED */
//         .cm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeIn 0.2s ease; }
//         .cm-box { background: #fff; border-radius: 24px; max-width: 420px; width: 100%; padding: 36px 32px 28px; position: relative; text-align: center; animation: slideUp 0.25s ease; }
//         .cm-close { position: absolute; top: 14px; right: 16px; background: #f5f5f3; border: none; font-size: 16px; cursor: pointer; color: #888; padding: 6px; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
//         .cm-close:hover { background: #ebebeb; color: #333; }
//         .cm-icon  { font-size: 52px; margin-bottom: 14px; line-height: 1; }
//         .cm-title { font-size: 22px; font-weight: 800; color: #111; margin-bottom: 8px; }
//         .cm-sub   { font-size: 14px; color: #777; line-height: 1.65; margin-bottom: 24px; }

//         /* CONFIRM MODAL BUTTONS */
//         .cm-confirm-actions { display: flex; gap: 10px; }
//         .cm-btn-cancel  { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: 1.5px solid #e5e5e5; background: #fff; color: #555; cursor: pointer; transition: all 0.2s; }
//         .cm-btn-cancel:hover  { background: #f5f5f3; }
//         .cm-btn-confirm { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; background: linear-gradient(135deg,#22c55e,#16a34a); color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(22,163,74,0.25); }
//         .cm-btn-confirm:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(22,163,74,0.35); }

//         /* EDIT MODAL */
//         .cm-box-edit { background: #fff; border-radius: 24px; max-width: 480px; width: 100%; padding: 32px; position: relative; animation: slideUp 0.25s ease; max-height: 90vh; overflow-y: auto; text-align: left; }
//         .cm-edit-title { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 20px; }
//         .cm-field { margin-bottom: 14px; }
//         .cm-field label { display: block; font-size: 11px; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
//         .cm-field input, .cm-field textarea { width: 100%; padding: 10px 14px; border: 1.5px solid #ebebeb; border-radius: 10px; font-size: 14px; font-family: 'Plus Jakarta Sans', sans-serif; color: #111; outline: none; transition: border 0.2s; background: #fafaf9; }
//         .cm-field input:focus, .cm-field textarea:focus { border-color: #4f46e5; background: #fff; }
//         .cm-field textarea { min-height: 80px; resize: vertical; }
//         .cm-edit-actions { display: flex; gap: 10px; margin-top: 20px; }
//         .cm-btn-save { flex: 1; padding: 13px; border-radius: 12px; font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif; border: none; background: linear-gradient(135deg,#4f46e5,#7c3aed); color: #fff; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 10px rgba(79,70,229,0.3); }
//         .cm-btn-save:hover:not(:disabled) { transform: translateY(-1px); }
//         .cm-btn-save:disabled { opacity: 0.6; cursor: not-allowed; }
//         .cm-mini-spin { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; margin-right: 6px; vertical-align: middle; }

//         /* TOAST */
//         .cb-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 22px; border-radius: 12px; font-size: 13px; font-weight: 600; font-family: 'Plus Jakarta Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; text-align: center; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
//         .cb-toast.success { background: #111; color: #fff; }
//         .cb-toast.error   { background: #ef4444; color: #fff; }
//         .cb-toast.warn    { background: #f59e0b; color: #fff; }
//       `}</style>

//       {toast && <div className={`cb-toast ${toast.type}`}>{toast.msg}</div>}

//       {/* ── CONFIRM COMPLETE MODAL ── */}
//       {confirmCampaignId && (
//         <div className="cm-overlay">
//           <div className="cm-box">
//             <button className="cm-close" onClick={() => setConfirmCampaignId(null)}>✕</button>
//             <div className="cm-icon">✅</div>
//             <div className="cm-title">Are you sure?</div>
//             <div className="cm-sub">
//               Are you sure you want to mark this campaign as <strong>completed</strong>? This action cannot be undone.
//             </div>
//             <div className="cm-confirm-actions">
//               <button className="cm-btn-cancel" onClick={() => setConfirmCampaignId(null)}>Cancel</button>
//               <button className="cm-btn-confirm" onClick={() => completeCampaign(confirmCampaignId)}>Yes, Complete It</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── EDIT CAMPAIGN MODAL ── */}
//       {editCampaign && (
//         <div className="cm-overlay">
//           <div className="cm-box-edit">
//             <button className="cm-close" onClick={() => setEditCampaign(null)}>✕</button>
//             <div className="cm-edit-title">✏️ Edit Campaign</div>
//             <div className="cm-field">
//               <label>Title</label>
//               <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Campaign title" />
//             </div>
//             <div className="cm-field">
//               <label>Description</label>
//               <textarea value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Campaign description" />
//             </div>
//             <div className="cm-field">
//               <label>Budget (₹)</label>
//               <input type="number" value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} placeholder="Budget amount" />
//             </div>
//             <div className="cm-field">
//               <label>City</label>
//               <input value={editForm.city} onChange={e => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" />
//             </div>
//             <div className="cm-field">
//               <label>Categories (comma separated)</label>
//               <input value={editForm.categories} onChange={e => setEditForm({ ...editForm, categories: e.target.value })} placeholder="e.g. Fashion, Lifestyle" />
//             </div>
//             <div className="cm-edit-actions">
//               <button className="cm-btn-cancel" onClick={() => setEditCampaign(null)}>Cancel</button>
//               <button className="cm-btn-save" onClick={saveEdit} disabled={editLoading}>
//                 {editLoading ? <><span className="cm-mini-spin" />Saving...</> : "Save Changes"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       <div className="cb">
//         {/* HEADER */}
//         <div className="cb-header">
//           <div>
//             <h1 className="cb-title">My Campaigns</h1>
//             <p className="cb-sub">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} total</p>
//           </div>
//           <div className="cb-header-right">
//             <Link href="/campaigns/post" className="cb-create-btn">
//               + Create Campaign
//             </Link>
//           </div>
//         </div>

//         {/* STATS BAR */}
//         {campaigns.length > 0 && (
//           <div className="cb-stats-bar">
//             <div className="cb-stat-chip">
//               <span style={{ fontSize: 18 }}>📋</span>
//               <div><div className="cb-stat-chip-val">{campaigns.length}</div><div className="cb-stat-chip-lbl">Total</div></div>
//             </div>
//             <div className="cb-stat-chip">
//               <span style={{ fontSize: 18 }}>🟢</span>
//               <div><div className="cb-stat-chip-val">{campaigns.filter(c => c.status === "open").length}</div><div className="cb-stat-chip-lbl">Open</div></div>
//             </div>
//             <div className="cb-stat-chip">
//               <span style={{ fontSize: 18 }}>✅</span>
//               <div><div className="cb-stat-chip-val">{campaigns.filter(c => c.status === "completed").length}</div><div className="cb-stat-chip-lbl">Completed</div></div>
//             </div>
//             <div className="cb-stat-chip">
//               <span style={{ fontSize: 18 }}>👥</span>
//               <div>
//                 <div className="cb-stat-chip-val">
//                   {Object.keys(appCounts).length === 0
//                     ? <span style={{ fontSize: 13, color: "#ccc", animation: "pulse 1.2s ease infinite" }}>...</span>
//                     : Object.values(appCounts).reduce((a, b) => a + b, 0)
//                   }
//                 </div>
//                 <div className="cb-stat-chip-lbl">Total Apps</div>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* CAMPAIGNS */}
//         {campaigns.length === 0 ? (
//           <div className="cb-empty">
//             <div className="cb-empty-icon">📋</div>
//             <h3 className="cb-empty-title">No campaigns yet</h3>
//             <p className="cb-empty-sub">Create your first campaign to start finding creators for your brand</p>
//             <Link href="/campaigns/post" className="cb-create-btn">+ Create Campaign</Link>
//           </div>
//         ) : (
//           <div className="cb-grid">
//             {campaigns.map((c) => {
//               const count = appCounts[c._id];
//               const countLoading = count === undefined;
//               return (
//                 <div key={c._id} className="cb-card">
//                   <div className="cb-card-top">
//                     <h3 className="cb-card-title">{c.title || "Untitled"}</h3>
//                     <span className={`cb-badge ${c.status === "completed" ? "cb-badge-completed" : "cb-badge-open"}`}>
//                        {c.status === "completed" ? "Completed" : "Open"}
//                     </span>
//                   </div>
//                   {c.description && <p className="cb-desc">{c.description}</p>}
//                   <div className="cb-meta">
//                     <div className="cb-meta-item">
//                       <div className="cb-meta-label">Budget</div>
//                       <div className="cb-meta-val">₹{(c.budget || 0).toLocaleString()}</div>
//                     </div>
//                     <div className="cb-meta-item">
//                       <div className="cb-meta-label">City</div>
//                       <div className="cb-meta-val">{c.city || "—"}</div>
//                     </div>
//                     <div className="cb-meta-item">
//                       <div className="cb-meta-label">Category</div>
//                       <div className="cb-meta-val" style={{ fontSize: "12px" }}>{Array.isArray(c.categories) ? c.categories.join(", ") : c.categories || "—"}</div>
//                     </div>
//                     <div className="cb-meta-item apps-highlight">
//                       <div className="cb-meta-label">Applications</div>
//                       <div className={`cb-meta-val ${countLoading ? "loading" : ""}`}>
//                         {countLoading ? "..." : count}
//                       </div>
//                     </div>
//                   </div>
//                   <div className="cb-actions">
//                     <Link href={`/campaigns/${c._id}`} className="cb-btn cb-btn-view">View</Link>
//                     <button className="cb-btn cb-btn-edit" onClick={() => openEdit(c)}>Edit</button>
//                     {c.status !== "completed" && (
//                       <button className="cb-btn cb-btn-complete" onClick={() => setConfirmCampaignId(c._id)}>✓ Complete</button>
//                     )}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </div>
//     </>
//   );
// }


