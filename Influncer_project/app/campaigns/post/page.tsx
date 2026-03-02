"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api/campaigns";
const API_BASE = "http://54.252.201.93:5000/api";
const FREE_CAMPAIGN_LIMIT = 5;

const CITY_OPTIONS = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel", "beauty", "lifestyle", "gaming"];
const ROLE_OPTIONS = ["influencers", "brand"];

export default function PostCampaignPage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [campaignsCreated, setCampaignsCreated] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    budget: "",
    city: "",
    categories: [] as string[],
    roles: [] as string[],
  });

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const storedUser = localStorage.getItem("cb_user");
    if (!storedUser) { router.push("/login"); return; }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role?.toLowerCase() !== "brand") { router.push("/discovery"); return; }
    setUser(parsedUser);

    const token = parsedUser.token || localStorage.getItem("token");

    fetch(`${API_BASE}/profile/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.profile) {
          const sub = data.profile.isSubscribed ?? false;
          const created = data.profile.campaignsCreated ?? 0;
          setIsSubscribed(sub);
          setCampaignsCreated(created);
          if (!sub && created >= FREE_CAMPAIGN_LIMIT) setLimitReached(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const toggleChip = (field: "categories" | "roles", value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSubscribed && campaignsCreated >= FREE_CAMPAIGN_LIMIT) {
      showToast("Campaign limit reach! Upgrade karo 🚀", "error");
      setTimeout(() => router.push("/upgrade"), 1500);
      return;
    }
    if (!formData.title || !formData.description || !formData.budget || !formData.city) {
      showToast("Please fill all required fields", "error");
      return;
    }
    if (formData.roles.length === 0) {
      showToast("Select at least one role", "error");
      return;
    }
    try {
      setLoading(true);
      const token = user.token || localStorage.getItem("token");
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          budget: Number(formData.budget),
          city: formData.city,
          categories: formData.categories,
          roles: formData.roles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 403) {
          showToast(data.message || "Campaign limit reach! Upgrade karo", "error");
          setTimeout(() => router.push("/upgrade"), 1500);
          return;
        }
        throw new Error(data.message || "Failed to create campaign");
      }
      showToast("Campaign Created Successfully 🚀", "success");
      setTimeout(() => router.push("/campaigns"), 1200);
    } catch (err: any) {
      showToast(err.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "28px", height: "28px", border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (!user) return null;

  const usagePercent = Math.min(100, (campaignsCreated / FREE_CAMPAIGN_LIMIT) * 100);
  const usageColor = limitReached ? "#ef4444" : campaignsCreated >= 3 ? "#f59e0b" : "#4f46e5";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }

        .pcp { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }

        .pcp-inner {
          max-width: 720px; margin: 0 auto;
          padding: 40px 20px 80px;
        }
        @media(max-width:600px){ .pcp-inner{ padding: 24px 16px 60px; } }

        /* CARD */
        .pcp-card {
          background: #fff; border-radius: 24px;
          padding: 40px; border: 1px solid #ebebeb;
          box-shadow: 0 2px 20px rgba(0,0,0,0.05);
        }
        @media(max-width:600px){ .pcp-card{ padding: 24px 20px; border-radius: 18px; } }

        .pcp-head { margin-bottom: 32px; }
        .pcp-title { font-size: 26px; font-weight: 600; color: #111; margin: 0 0 6px; }
        .pcp-sub { font-size: 14px; color: #999; font-weight: 400; margin: 0; }

        /* Usage bar */
        .pcp-usage {
          display: flex; align-items: center; gap: 14px;
          background: #fafafa; border: 1.5px solid #ebebeb;
          border-radius: 12px; padding: 14px 16px; margin-bottom: 28px;
        }
        .pcp-usage.warn   { background: #fffbeb; border-color: #fde68a; }
        .pcp-usage.danger { background: #fff5f5; border-color: #fecaca; }
        .pcp-usage.pro    { background: #f0fdf4; border-color: #86efac; }
        .pcp-usage-info { flex: 1; }
        .pcp-usage-label { font-size: 11px; font-weight: 500; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .pcp-usage-track { height: 5px; background: #e8e8e8; border-radius: 100px; overflow: hidden; margin-bottom: 5px; }
        .pcp-usage-fill  { height: 100%; border-radius: 100px; transition: width 0.4s; }
        .pcp-usage-count { font-size: 12px; font-weight: 500; }
        .pcp-upgrade-link {
          font-size: 12px; font-weight: 600; color: #4f46e5;
          text-decoration: none; white-space: nowrap;
          background: #eef2ff; padding: 5px 12px; border-radius: 8px;
        }
        .pcp-upgrade-link:hover { background: #e0e7ff; }

        /* FORM */
        .pcp-form { display: flex; flex-direction: column; gap: 0; }

        .pcp-section { margin-bottom: 28px; }
        .pcp-section-label {
          font-size: 11px; font-weight: 600; color: #bbb;
          text-transform: uppercase; letter-spacing: 0.08em;
          margin-bottom: 18px; padding-bottom: 10px;
          border-bottom: 1px solid #f3f4f6;
        }

        .pcp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media(max-width:480px){ .pcp-row{ grid-template-columns: 1fr; } }

        .pcp-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .pcp-field:last-child { margin-bottom: 0; }

        .pcp-label { font-size: 13px; font-weight: 600; color: #374151; }
        .pcp-label .req { color: #ef4444; margin-left: 2px; }

        .pcp-input {
          width: 100%; padding: 12px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 400;
          color: #111; background: #fff; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .pcp-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }
        .pcp-input::placeholder { color: #9ca3af; }
        .pcp-textarea { resize: none; line-height: 1.6; }

        .pcp-select {
          width: 100%; padding: 12px 40px 12px 14px;
          border: 1.5px solid #e5e7eb; border-radius: 12px;
          font-size: 14px; font-family: 'DM Sans', sans-serif; font-weight: 400;
          color: #111; background: #fff; outline: none; appearance: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
          transition: border-color 0.2s;
        }
        .pcp-select:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.08); }

        /* CHIPS */
        .pcp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .pcp-chip {
          padding: 8px 16px; border-radius: 100px;
          border: 1.5px solid #e5e7eb; background: #fff;
          font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif;
          color: #6b7280; cursor: pointer; transition: all 0.15s;
          text-transform: capitalize;
        }
        .pcp-chip:hover { border-color: #4f46e5; color: #4f46e5; }
        .pcp-chip.sel { background: #4f46e5; border-color: #4f46e5; color: #fff; }

        /* ACTIONS */
        .pcp-actions { display: flex; justify-content: space-between; align-items: center; padding-top: 28px; border-top: 1px solid #f3f4f6; gap: 12px; }
        .pcp-btn-cancel {
          padding: 12px 24px; border-radius: 12px;
          font-size: 14px; font-weight: 500; font-family: 'DM Sans', sans-serif;
          color: #6b7280; background: #f3f4f6; border: none; cursor: pointer;
          transition: background 0.2s;
        }
        .pcp-btn-cancel:hover { background: #e5e7eb; }
        .pcp-btn-submit {
          padding: 12px 32px; border-radius: 12px;
          font-size: 14px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          color: #fff; background: #4f46e5; border: none; cursor: pointer;
          transition: all 0.2s; display: flex; align-items: center; gap: 8px;
        }
        .pcp-btn-submit:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); }
        .pcp-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .pcp-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

        /* BLOCKED */
        .pcp-blocked { text-align: center; padding: 56px 24px; }
        .pcp-blocked-icon { font-size: 52px; margin-bottom: 18px; }
        .pcp-blocked-title { font-size: 22px; font-weight: 600; color: #111; margin: 0 0 10px; }
        .pcp-blocked-sub { font-size: 14px; color: #888; line-height: 1.7; margin: 0 0 28px; font-weight: 400; }
        .pcp-blocked-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 13px 32px; border-radius: 12px; background: #4f46e5;
          color: #fff; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; border: none; cursor: pointer; transition: all 0.2s;
        }
        .pcp-blocked-btn:hover { background: #4338ca; transform: translateY(-1px); }

        /* TOAST */
        .pcp-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 12px 24px; border-radius: 12px; font-size: 13px; font-weight: 500; font-family: 'DM Sans', sans-serif; z-index: 99999; white-space: nowrap; max-width: 90vw; text-align: center; animation: toastIn 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.14); }
        .pcp-toast.success { background: #111; color: #fff; }
        .pcp-toast.error   { background: #ef4444; color: #fff; }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {toast && <div className={`pcp-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="pcp">
        <div className="pcp-inner">
          <div className="pcp-card">
            <div className="pcp-head">
              <h1 className="pcp-title">Create Campaign</h1>
              <p className="pcp-sub">Find the right creators for your brand</p>
            </div>

            {/* USAGE INDICATOR */}
            {isSubscribed ? (
              <div className="pcp-usage pro">
                <div className="pcp-usage-info">
                  <div className="pcp-usage-label">Campaign Usage</div>
                  <div className="pcp-usage-count" style={{ color: "#15803d" }}>✓ Pro — Unlimited campaigns</div>
                </div>
              </div>
            ) : (
              <div className={`pcp-usage ${limitReached ? "danger" : campaignsCreated >= 3 ? "warn" : ""}`}>
                <div className="pcp-usage-info">
                  <div className="pcp-usage-label">Campaigns Used</div>
                  <div className="pcp-usage-track">
                    <div className="pcp-usage-fill" style={{ width: `${usagePercent}%`, background: usageColor }} />
                  </div>
                  <div className="pcp-usage-count" style={{ color: usageColor }}>
                    {campaignsCreated} of {FREE_CAMPAIGN_LIMIT} used
                    {!limitReached && ` · ${FREE_CAMPAIGN_LIMIT - campaignsCreated} remaining`}
                  </div>
                </div>
                <a href="/upgrade" className="pcp-upgrade-link">Upgrade ✦</a>
              </div>
            )}

            {/* BLOCKED */}
            {limitReached ? (
              <div className="pcp-blocked">
                <div className="pcp-blocked-icon">🚫</div>
                <h2 className="pcp-blocked-title">Campaign Limit Reached</h2>
                <p className="pcp-blocked-sub">
                  Free plan allows only <strong>{FREE_CAMPAIGN_LIMIT} campaigns</strong>.<br />
                  Upgrade to Pro to post unlimited campaigns.
                </p>
                <button className="pcp-blocked-btn" onClick={() => router.push("/upgrade")}>
                  Upgrade to Pro →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="pcp-form">

                {/* Campaign Info */}
                <div className="pcp-section">
                  <div className="pcp-section-label">Campaign Info</div>

                  <div className="pcp-field">
                    <label className="pcp-label">Title <span className="req">*</span></label>
                    <input className="pcp-input" type="text" placeholder="e.g. Summer Fashion Shoot"
                      value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                  </div>

                  <div className="pcp-field">
                    <label className="pcp-label">Description <span className="req">*</span></label>
                    <textarea className="pcp-input pcp-textarea" rows={4}
                      placeholder="Describe your campaign, deliverables, requirements..."
                      value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required />
                  </div>

                  <div className="pcp-row">
                    <div className="pcp-field">
                      <label className="pcp-label">Budget (₹) <span className="req">*</span></label>
                      <input className="pcp-input" type="number" min={0} placeholder="e.g. 5000"
                        value={formData.budget} onChange={e => setFormData({ ...formData, budget: e.target.value })} required />
                    </div>
                    <div className="pcp-field">
                      <label className="pcp-label">City <span className="req">*</span></label>
                      <select className="pcp-select" value={formData.city}
                        onChange={e => setFormData({ ...formData, city: e.target.value })} required>
                        <option value="">Select City</option>
                        {CITY_OPTIONS.map(city => <option key={city} value={city}>{city}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Targeting */}
                <div className="pcp-section">
                  <div className="pcp-section-label">Targeting</div>

                  <div className="pcp-field">
                    <label className="pcp-label">Categories</label>
                    <div className="pcp-chips">
                      {CATEGORY_OPTIONS.map(cat => (
                        <button key={cat} type="button"
                          className={`pcp-chip ${formData.categories.includes(cat) ? "sel" : ""}`}
                          onClick={() => toggleChip("categories", cat)}>{cat}</button>
                      ))}
                    </div>
                  </div>

                  <div className="pcp-field" style={{ marginBottom: 0 }}>
                    <label className="pcp-label">Target Roles <span className="req">*</span></label>
                    <div className="pcp-chips">
                      {ROLE_OPTIONS.map(role => (
                        <button key={role} type="button"
                          className={`pcp-chip ${formData.roles.includes(role) ? "sel" : ""}`}
                          onClick={() => toggleChip("roles", role)}>{role}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pcp-actions">
                  <button type="button" className="pcp-btn-cancel" onClick={() => router.push("/campaigns")}>Cancel</button>
                  <button type="submit" className="pcp-btn-submit" disabled={loading}>
                    {loading ? <><span className="pcp-spinner" /> Creating...</> : "Create Campaign 🚀"}
                  </button>
                </div>

              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

//right code  "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api/campaigns";

// const ROLE_OPTIONS = ["influencers", "brand"];
// const CITY_OPTIONS = ["Indore", "Ujjain", "Bhopal", "Nagpur", "Delhi", "Bangalore", "Lucknow", "Kolkata"];
// const CATEGORY_OPTIONS = ["fashion", "fitness", "tech", "food", "travel"];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [] as string[],
//     roles: [] as string[],
//   });

//   // Check user auth & role
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) return router.push("/login");

//     const parsedUser = JSON.parse(storedUser);
//     if (parsedUser.role?.toLowerCase() !== "brand") return router.push("/discovery");

//     setUser(parsedUser);
//   }, [router]);

//   const toggleRole = (role: string) => {
//     setFormData(prev => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter(r => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const toggleCategory = (category: string) => {
//     setFormData(prev => ({
//       ...prev,
//       categories: prev.categories.includes(category)
//         ? prev.categories.filter(c => c !== category)
//         : [...prev.categories, category],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (!formData.title || !formData.description || !formData.budget || !formData.city) {
//       alert("Please fill all required fields");
//       return;
//     }

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       setLoading(true);
//       const token = user.token;

//       const res = await fetch(API, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({
//           title: formData.title.trim(),
//           description: formData.description.trim(),
//           budget: Number(formData.budget),
//           city: formData.city,
//           categories: formData.categories,
//           roles: formData.roles,
//         }),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed to create campaign");

//       alert("Campaign Created Successfully 🚀");
//       router.push("/campaigns");
//     } catch (err: any) {
//       alert(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-3xl p-10 shadow-xl border">
//         <h1 className="text-3xl font-bold mb-8">Create Campaign</h1>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           {/* Title */}
//           <div>
//             <label className="font-semibold block mb-2">Title</label>
//             <input
//               required
//               type="text"
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.title}
//               onChange={e => setFormData({ ...formData, title: e.target.value })}
//             />
//           </div>

//           {/* Description */}
//           <div>
//             <label className="font-semibold block mb-2">Description</label>
//             <textarea
//               required
//               rows={4}
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.description}
//               onChange={e => setFormData({ ...formData, description: e.target.value })}
//             />
//           </div>

//           {/* Budget */}
//           <div>
//             <label className="font-semibold block mb-2">Budget</label>
//             <input
//               required
//               type="number"
//               min={0}
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.budget}
//               onChange={e => setFormData({ ...formData, budget: e.target.value })}
//             />
//           </div>

//           {/* City */}
//           <div>
//             <label className="font-semibold block mb-2">City</label>
//             <select
//               required
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.city}
//               onChange={e => setFormData({ ...formData, city: e.target.value })}
//             >
//               <option value="">Select City</option>
//               {CITY_OPTIONS.map(city => (
//                 <option key={city} value={city}>{city}</option>
//               ))}
//             </select>
//           </div>

//           {/* Categories */}
//           <div>
//             <label className="font-semibold block mb-3">Categories</label>
//             <div className="flex flex-wrap gap-3">
//               {CATEGORY_OPTIONS.map(cat => (
//                 <button
//                   key={cat}
//                   type="button"
//                   onClick={() => toggleCategory(cat)}
//                   className={`px-4 py-2 rounded-xl border ${formData.categories.includes(cat)
//                     ? "bg-indigo-600 text-white border-indigo-600"
//                     : "border-gray-300"
//                   }`}
//                 >
//                   {cat}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Roles */}
//           <div>
//             <label className="font-semibold block mb-3">Target Roles</label>
//             <div className="flex gap-4">
//               {ROLE_OPTIONS.map(role => (
//                 <button
//                   key={role}
//                   type="button"
//                   onClick={() => toggleRole(role)}
//                   className={`px-6 py-2 rounded-xl border-2 font-semibold ${formData.roles.includes(role)
//                     ? "bg-indigo-600 text-white border-indigo-600"
//                     : "border-gray-300"
//                   }`}
//                 >
//                   {role}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* Buttons */}
//           <div className="flex justify-between pt-4">
//             <button
//               type="button"
//               onClick={() => router.push("/campaigns")}
//               className="px-6 py-3 rounded-xl border border-gray-400 font-semibold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
//             >
//               {loading ? "Creating..." : "Create Campaign"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }


// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api/campaigns";

// const ROLE_OPTIONS = ["influencers", "brand"];

// const CITY_OPTIONS = [
//   "Indore",
//    "Ujjain",
//     "Bhopal",
//      "Nagpur",
//   "delhi",
//   "bangalore",
//   "lucknow",
//   "kolkata",
// ];

// const CATEGORY_OPTIONS = [
//   "fashion",
//   "fitness",
//   "tech",
//   "food",
//   "travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [] as string[],
//     roles: [] as string[],
//   });

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);

//     if (parsedUser.role?.toLowerCase() !== "brand") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);
//   }, [router]);

//   const toggleRole = (role: string) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const toggleCategory = (category: string) => {
//     setFormData((prev) => ({
//       ...prev,
//       categories: prev.categories.includes(category)
//         ? prev.categories.filter((c) => c !== category)
//         : [...prev.categories, category],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       setLoading(true);

//       const storedUser = localStorage.getItem("cb_user");
//       const parsedUser = JSON.parse(storedUser!);

//       const res = await fetch(API, {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${parsedUser.token}`,
//         },
//         body: JSON.stringify({
//           title: formData.title.trim(),
//           description: formData.description.trim(),
//           budget: Number(formData.budget),
//           city: formData.city,
//           categories: formData.categories,
//           roles: formData.roles,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");
//       router.push("/campaigns");

//     } catch (error: any) {
//       alert(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-3xl p-10 shadow-xl border">

//         <h1 className="text-3xl font-bold mb-8">
//           Create Campaign
//         </h1>

//         <form onSubmit={handleSubmit} className="space-y-6">

//           {/* TITLE */}
//           <div>
//             <label className="font-semibold block mb-2">Title</label>
//             <input
//               required
//               type="text"
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.title}
//               onChange={(e) =>
//                 setFormData({ ...formData, title: e.target.value })
//               }
//             />
//           </div>

//           {/* DESCRIPTION */}
//           <div>
//             <label className="font-semibold block mb-2">Description</label>
//             <textarea
//               rows={4}
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.description}
//               onChange={(e) =>
//                 setFormData({ ...formData, description: e.target.value })
//               }
//             />
//           </div>

//           {/* BUDGET */}
//           <div>
//             <label className="font-semibold block mb-2">Budget</label>
//             <input
//               required
//               type="number"
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.budget}
//               onChange={(e) =>
//                 setFormData({ ...formData, budget: e.target.value })
//               }
//             />
//           </div>

//           {/* CITY DROPDOWN */}
//           <div>
//             <label className="font-semibold block mb-2">City</label>
//             <select
//               required
//               className="w-full px-4 py-3 border rounded-xl"
//               value={formData.city}
//               onChange={(e) =>
//                 setFormData({ ...formData, city: e.target.value })
//               }
//             >
//               <option value="">Select City</option>
//               {CITY_OPTIONS.map((city) => (
//                 <option key={city} value={city}>
//                   {city}
//                 </option>
//               ))}
//             </select>
//           </div>

//           {/* CATEGORY MULTI SELECT */}
//           <div>
//             <label className="font-semibold block mb-3">Categories</label>

//             <div className="flex flex-wrap gap-3">
//               {CATEGORY_OPTIONS.map((cat) => (
//                 <button
//                   key={cat}
//                   type="button"
//                   onClick={() => toggleCategory(cat)}
//                   className={`px-4 py-2 rounded-xl border ${
//                     formData.categories.includes(cat)
//                       ? "bg-indigo-600 text-white border-indigo-600"
//                       : "border-gray-300"
//                   }`}
//                 >
//                   {cat}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* ROLES */}
//           <div>
//             <label className="font-semibold block mb-3">Target Roles</label>

//             <div className="flex gap-4">
//               {ROLE_OPTIONS.map((role) => (
//                 <button
//                   key={role}
//                   type="button"
//                   onClick={() => toggleRole(role)}
//                   className={`px-6 py-2 rounded-xl border-2 font-semibold ${
//                     formData.roles.includes(role)
//                       ? "bg-indigo-600 text-white border-indigo-600"
//                       : "border-gray-300"
//                   }`}
//                 >
//                   {role}
//                 </button>
//               ))}
//             </div>
//           </div>

//           {/* BUTTONS */}
//           <div className="flex justify-between pt-4">
//             <button
//               type="button"
//               onClick={() => router.push("/campaigns")}
//               className="px-6 py-3 rounded-xl border border-gray-400 font-semibold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700"
//             >
//               {loading ? "Creating..." : "Create Campaign"}
//             </button>
//           </div>

//         </form>
//       </div>
//     </div>
//   );
// }
// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "influencer",
//   MODEL = "model",
//   PHOTOGRAPHER = "photographer",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [CATEGORIES[0]],
//     roles: [] as UserRole[],
//   });

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);

//     if (parsedUser.role?.toLowerCase() !== "brand") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);
//   }, [router]);

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       setLoading(true);

//       const storedUser = localStorage.getItem("cb_user");
//       if (!storedUser) {
//         alert("Please login first");
//         router.push("/login");
//         return;
//       }

//       const parsedUser = JSON.parse(storedUser);
//       const token = parsedUser.token;

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/campaigns",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: formData.title.trim(),
//             description: formData.description.trim(),
//             budget: Number(formData.budget),
//             city: formData.city.trim().toLowerCase(),
//             categories: formData.categories,
//             roles: formData.roles, // already lowercase
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");

//       router.push("/campaigns");
//       router.refresh();

//     } catch (error: any) {
//       alert(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-[40px] p-12 shadow-2xl border">

//         <div className="mb-10">
//           <h1 className="text-4xl font-extrabold mb-4">
//             Create New Campaign
//           </h1>
//           <p className="text-gray-500">
//             Share your requirements and find the best creators.
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-8">

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Campaign Title
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.title}
//                 onChange={(e) =>
//                   setFormData({ ...formData, title: e.target.value })
//                 }
//               />
//             </div>

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Description
//               </label>
//               <textarea
//                 required
//                 rows={5}
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.description}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     description: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 Budget (INR)
//               </label>
//               <input
//                 required
//                 type="number"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.budget}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     budget: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 City
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.city}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     city: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 Category
//               </label>
//               <select
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.categories[0]}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     categories: [e.target.value],
//                   })
//                 }
//               >
//                 {CATEGORIES.map((c) => (
//                   <option key={c}>{c}</option>
//                 ))}
//               </select>
//             </div>

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-4">
//                 Required Roles
//               </label>

//               <div className="flex flex-wrap gap-4">
//                 {[
//                   UserRole.INFLUENCER,
//                   UserRole.MODEL,
//                   UserRole.PHOTOGRAPHER,
//                 ].map((role) => (
//                   <button
//                     key={role}
//                     type="button"
//                     onClick={() => toggleRole(role)}
//                     className={`px-6 py-3 rounded-xl font-bold border-2 transition ${
//                       formData.roles.includes(role)
//                         ? "bg-indigo-600 text-white border-indigo-600"
//                         : "bg-white border-gray-300 hover:border-indigo-400"
//                     }`}
//                   >
//                     {role}
//                   </button>
//                 ))}
//               </div>
//             </div>

//           </div>

//           <div className="flex justify-end space-x-4">
//             <button
//               type="button"
//               onClick={() => router.push("/campaigns")}
//               className="px-8 py-4 text-gray-500 font-bold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//             >
//               {loading ? "Publishing..." : "Publish Campaign"}
//             </button>
//           </div>

//         </form>
//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [CATEGORIES[0]], // ✅ FIXED (array)
//     deadline: "",
//     roles: [] as UserRole[],
//   });

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);

//     if (parsedUser.role?.toLowerCase() !== "brand") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);
//   }, [router]);

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       setLoading(true);

//       const storedUser = localStorage.getItem("cb_user");

//       if (!storedUser) {
//         alert("Please login first");
//         router.push("/login");
//         return;
//       }

//       const parsedUser = JSON.parse(storedUser);
//       const token = parsedUser.token;

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/campaigns",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: formData.title,
//             description: formData.description,
//             budget: Number(formData.budget),
//             city: formData.city,
//             categories: formData.categories, // ✅ now correct array
//             deadline: formData.deadline,
//             roles: formData.roles,
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");

//       router.push("/campaigns");
//       router.refresh();

//     } catch (error: any) {
//       alert(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-[40px] p-12 shadow-2xl border">

//         <div className="mb-10">
//           <h1 className="text-4xl font-extrabold mb-4">
//             Create New Campaign
//           </h1>
//           <p className="text-gray-500">
//             Share your requirements and find the best creators.
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-8">

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Campaign Title
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.title}
//                 onChange={(e) =>
//                   setFormData({ ...formData, title: e.target.value })
//                 }
//               />
//             </div>

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Description
//               </label>
//               <textarea
//                 required
//                 rows={5}
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.description}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     description: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 Budget (INR)
//               </label>
//               <input
//                 required
//                 type="number"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.budget}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     budget: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 City
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.city}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     city: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 Category
//               </label>
//               <select
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.categories[0]} // ✅ FIXED
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     categories: [e.target.value], // ✅ FIXED
//                   })
//                 }
//               >
//                 {CATEGORIES.map((c) => (
//                   <option key={c}>{c}</option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label className="block font-bold mb-3">
//                 Deadline
//               </label>
//               <input
//                 required
//                 type="date"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.deadline}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     deadline: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             <div className="md:col-span-2">
//               <label className="block font-bold mb-4">
//                 Required Roles
//               </label>

//               <div className="flex flex-wrap gap-4">
//                 {[
//                   UserRole.INFLUENCER,
//                   UserRole.MODEL,
//                   UserRole.PHOTOGRAPHER,
//                 ].map((role) => (
//                   <button
//                     key={role}
//                     type="button"
//                     onClick={() => toggleRole(role)}
//                     className={`px-6 py-3 rounded-xl font-bold border-2 transition ${
//                       formData.roles.includes(role)
//                         ? "bg-indigo-600 text-white border-indigo-600"
//                         : "bg-white border-gray-300 hover:border-indigo-400"
//                     }`}
//                   >
//                     {role}
//                   </button>
//                 ))}
//               </div>
//             </div>

//           </div>

//           <div className="flex justify-end space-x-4">
//             <button
//               type="button"
//               onClick={() => router.push("/campaigns")}
//               className="px-8 py-4 text-gray-500 font-bold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//             >
//               {loading ? "Publishing..." : "Publish Campaign"}
//             </button>
//           </div>

//         </form>
//       </div>
//     </div>
//   );
// }
// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//    categories: CATEGORIES[0],
//     deadline: "",
//     roles: [] as UserRole[],
//   });

//   // 🔒 Protect Page (Brand Only)
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const parsedUser = JSON.parse(storedUser);

//     if (parsedUser.role?.toLowerCase() !== "brand") {
//       router.push("/discovery");
//       return;
//     }

//     setUser(parsedUser);
//   }, [router]);

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       setLoading(true);

//       const storedUser = localStorage.getItem("cb_user");

//       if (!storedUser) {
//         alert("Please login first");
//         router.push("/login");
//         return;
//       }

//       const parsedUser = JSON.parse(storedUser);
//       const token = parsedUser.token;

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/campaigns",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: formData.title,
//             description: formData.description,
//             budget: Number(formData.budget),
//             category: formData.categories,
//             deadline: formData.deadline,
//             roles: formData.roles,
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");

//       router.push("/campaigns");
//       router.refresh();

//     } catch (error: any) {
//       alert(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-[40px] p-12 shadow-2xl border">

//         <div className="mb-10">
//           <h1 className="text-4xl font-extrabold mb-4">
//             Create New Campaign
//           </h1>
//           <p className="text-gray-500">
//             Share your requirements and find the best creators.
//           </p>
//         </div>

//         <form onSubmit={handleSubmit} className="space-y-8">

//           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

//             {/* TITLE */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Campaign Title
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.title}
//                 onChange={(e) =>
//                   setFormData({ ...formData, title: e.target.value })
//                 }
//               />
//             </div>

//             {/* DESCRIPTION */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Description
//               </label>
//               <textarea
//                 required
//                 rows={5}
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.description}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     description: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* BUDGET */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Budget (INR)
//               </label>
//               <input
//                 required
//                 type="number"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.budget}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     budget: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* CATEGORY */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Category
//               </label>
//               <select
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.categories}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     categories: e.target.value,
//                   })
//                 }
//               >
//                 {CATEGORIES.map((c) => (
//                   <option key={c}>{c}</option>
//                 ))}
//               </select>
//             </div>

//             {/* DEADLINE */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Deadline
//               </label>
//               <input
//                 required
//                 type="date"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={formData.deadline}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     deadline: e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* ROLES */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-4">
//                 Required Roles
//               </label>

//               <div className="flex flex-wrap gap-4">
//                 {[
//                   UserRole.INFLUENCER,
//                   UserRole.MODEL,
//                   UserRole.PHOTOGRAPHER,
//                 ].map((role) => (
//                   <button
//                     key={role}
//                     type="button"
//                     onClick={() => toggleRole(role)}
//                     className={`px-6 py-3 rounded-xl font-bold border-2 transition ${
//                       formData.roles.includes(role)
//                         ? "bg-indigo-600 text-white border-indigo-600"
//                         : "bg-white border-gray-300 hover:border-indigo-400"
//                     }`}
//                   >
//                     {role}
//                   </button>
//                 ))}
//               </div>
//             </div>

//           </div>

//           <div className="flex justify-end space-x-4">
//             <button
//               type="button"
//               onClick={() => router.push("/campaigns")}
//               className="px-8 py-4 text-gray-500 font-bold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//             >
//               {loading ? "Publishing..." : "Publish Campaign"}
//             </button>
//           </div>

//         </form>
//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, useEffect, FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [user, setUser] = useState<any>(null);
//   const [loading, setLoading] = useState(false);

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     category: CATEGORIES[0],
//     deadline: "",
//     roles: [] as UserRole[],
//   });

//   useEffect(() => {
//     const storedUser =
//       localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     setUser(JSON.parse(storedUser));
//   }, [router]);

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter(
//             (r) => r !== role
//           )
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (
//     e: FormEvent
//   ) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert(
//         "Select at least one role"
//       );
//       return;
//     }

//     try {
//       setLoading(true);

//       const token =
//         localStorage.getItem("token");

//       if (!token) {
//         alert(
//           "Please login first"
//         );
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/campaigns",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type":
//               "application/json",
//             Authorization: `Bearer ${token}`,
//           },
//           body: JSON.stringify({
//             title: formData.title,
//             description:
//               formData.description,
//             budget: Number(
//               formData.budget
//             ),
//             category:
//               formData.category,
//             deadline:
//               formData.deadline,
//             roles: formData.roles,
//           }),
//         }
//       );

//       const data =
//         await res.json();

//       if (!res.ok) {
//         throw new Error(
//           data.message ||
//             "Failed to create campaign"
//         );
//       }

//       alert(
//         "Campaign Created Successfully 🚀"
//       );

//       router.push("/campaigns");
//     } catch (error: any) {
//       alert(error.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (!user) return null;

//   return (
//     <div className="max-w-4xl mx-auto px-6 py-12">
//       <div className="bg-white rounded-[40px] p-12 shadow-2xl border">
//         <div className="mb-10">
//           <h1 className="text-4xl font-extrabold mb-4">
//             Create New Campaign
//           </h1>
//           <p className="text-gray-500">
//             Share your requirements and
//             find the best creators.
//           </p>
//         </div>

//         <form
//           onSubmit={handleSubmit}
//           className="space-y-8"
//         >
//           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//             {/* TITLE */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Campaign Title
//               </label>
//               <input
//                 required
//                 type="text"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 placeholder="Summer Shoot 2024"
//                 value={
//                   formData.title
//                 }
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     title:
//                       e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* DESCRIPTION */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-3">
//                 Description
//               </label>
//               <textarea
//                 required
//                 rows={5}
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={
//                   formData.description
//                 }
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     description:
//                       e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* BUDGET */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Budget (INR)
//               </label>
//               <input
//                 required
//                 type="number"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={
//                   formData.budget
//                 }
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     budget:
//                       e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* CATEGORY */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Category
//               </label>
//               <select
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={
//                   formData.category
//                 }
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     category:
//                       e.target.value,
//                   })
//                 }
//               >
//                 {CATEGORIES.map(
//                   (c) => (
//                     <option
//                       key={c}
//                     >
//                       {c}
//                     </option>
//                   )
//                 )}
//               </select>
//             </div>

//             {/* DEADLINE */}
//             <div>
//               <label className="block font-bold mb-3">
//                 Deadline
//               </label>
//               <input
//                 required
//                 type="date"
//                 className="w-full px-6 py-4 border rounded-2xl"
//                 value={
//                   formData.deadline
//                 }
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     deadline:
//                       e.target.value,
//                   })
//                 }
//               />
//             </div>

//             {/* ROLES */}
//             <div className="md:col-span-2">
//               <label className="block font-bold mb-4">
//                 Required Roles
//               </label>

//               <div className="flex flex-wrap gap-4">
//                 {[
//                   UserRole.INFLUENCER,
//                   UserRole.MODEL,
//                   UserRole.PHOTOGRAPHER,
//                 ].map((role) => (
//                   <button
//                     key={role}
//                     type="button"
//                     onClick={() =>
//                       toggleRole(
//                         role
//                       )
//                     }
//                     className={`px-6 py-3 rounded-xl font-bold border-2 ${
//                       formData.roles.includes(
//                         role
//                       )
//                         ? "bg-indigo-600 text-white border-indigo-600"
//                         : "bg-white border-gray-300"
//                     }`}
//                   >
//                     {role}
//                   </button>
//                 ))}
//               </div>
//             </div>
//           </div>

//           <div className="flex justify-end space-x-4">
//             <button
//               type="button"
//               onClick={() =>
//                 router.push(
//                   "/campaigns"
//                 )
//               }
//               className="px-8 py-4 text-gray-500 font-bold"
//             >
//               Cancel
//             </button>

//             <button
//               type="submit"
//               disabled={loading}
//               className="px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold"
//             >
//               {loading
//                 ? "Publishing..."
//                 : "Publish Campaign"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }



// 'use client';

// import { useState, type FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// const CITIES = [
//   "Mumbai",
//   "Delhi",
//   "Bangalore",
//   "Hyderabad",
//   "Chennai",
//   "Pune",
//   "Kolkata",
//   "Ahmedabad",
//   "Jaipur",
//   "Chandigarh",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: CITIES[0],
//     categories: [CATEGORIES[0]],
//     roles: [] as UserRole[],
//   });

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }

//     try {
//       const token = localStorage.getItem("token");
     


//       if (!token) {
//         alert("Please login first to post a campaign");
//         router.push("/login");
//         return;
//       }

//       const res = await fetch("http://13.210.109.234:5000/api/campaigns", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`, // ✅ Send token
//         },
//         body: JSON.stringify({
//           title: formData.title,
//           description: formData.description,
//           budget: Number(formData.budget),
//           city: formData.city.toLowerCase(),
//           categories: formData.categories,
//           roles: formData.roles,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");
//       router.push("/campaigns");
//     } catch (error: any) {
//       alert(error.message);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 py-12 px-6">
//       <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-lg space-y-6">
//         <h1 className="text-3xl font-bold">Post a Campaign</h1>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           <input
//             required
//             placeholder="Campaign Title"
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.title}
//             onChange={(e) =>
//               setFormData({ ...formData, title: e.target.value })
//             }
//           />

//           <textarea
//             required
//             placeholder="Description"
//             className="w-full px-4 py-3 border rounded-xl"
//             rows={4}
//             value={formData.description}
//             onChange={(e) =>
//               setFormData({ ...formData, description: e.target.value })
//             }
//           />

//           <input
//             required
//             type="number"
//             placeholder="Budget (₹)"
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.budget}
//             onChange={(e) =>
//               setFormData({ ...formData, budget: e.target.value })
//             }
//           />

//           {/* ✅ CITY DROPDOWN */}
//           <select
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.city}
//             onChange={(e) =>
//               setFormData({ ...formData, city: e.target.value })
//             }
//           >
//             {CITIES.map((city) => (
//               <option key={city} value={city}>
//                 {city}
//               </option>
//             ))}
//           </select>

//           {/* ✅ CATEGORY DROPDOWN */}
//           <select
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.categories[0]}
//             onChange={(e) =>
//               setFormData({ ...formData, categories: [e.target.value] })
//             }
//           >
//             {CATEGORIES.map((cat) => (
//               <option key={cat} value={cat}>
//                 {cat}
//               </option>
//             ))}
//           </select>

//           {/* ✅ ROLES */}
//           <div>
//             <p className="font-semibold mb-2">Select Roles:</p>
//             <div className="flex gap-4 flex-wrap">
//               {Object.values(UserRole).map((role) => (
//                 <button
//                   key={role}
//                   type="button"
//                   onClick={() => toggleRole(role)}
//                   className={`px-4 py-2 rounded-lg border font-bold transition ${
//                     formData.roles.includes(role)
//                       ? "bg-indigo-600 text-white border-indigo-600"
//                       : "bg-gray-100 border-gray-300"
//                   }`}
//                 >
//                   {role}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <button
//             type="submit"
//             className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold"
//           >
//             Launch Campaign
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }





// "use client";

// import { useState, type FormEvent } from "react";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
// }

// const CATEGORIES = [
//   "Fashion",
//   "Fitness",
//   "Tech",
//   "Food",
//   "Travel",
// ];

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     city: "",
//     categories: [CATEGORIES[0]],
//     roles: [] as UserRole[],
//   });

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       roles: prev.roles.includes(role)
//         ? prev.roles.filter((r) => r !== role)
//         : [...prev.roles, role],
//     }));
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     if (formData.roles.length === 0) {
//       alert("Select at least one role");
//       return;
//     }
//       const token = localStorage.getItem("token");

//     try {
//       const res = await fetch(
//         "http://13.210.109.234:5000/api/campaigns",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json" ,
//             Authorization: `Bearer ${token}`
//           },
//           body: JSON.stringify({
//             title: formData.title,
//             description: formData.description,
//             budget: Number(formData.budget),
//             city: formData.city,
//             categories: formData.categories,
//             roles: formData.roles,
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Failed to create campaign");
//       }

//       alert("Campaign Created Successfully 🚀");
//       router.push("/campaigns");
//     } catch (error: any) {
//       alert(error.message);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 py-12 px-6">
//       <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-lg space-y-6">
//         <h1 className="text-3xl font-bold">Post a Campaign</h1>

//         <form onSubmit={handleSubmit} className="space-y-6">
//           <input
//             required
//             placeholder="Campaign Title"
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.title}
//             onChange={(e) =>
//               setFormData({ ...formData, title: e.target.value })
//             }
//           />

//           <textarea
//             required
//             placeholder="Description"
//             className="w-full px-4 py-3 border rounded-xl"
//             rows={4}
//             value={formData.description}
//             onChange={(e) =>
//               setFormData({ ...formData, description: e.target.value })
//             }
//           />

//           <input
//             required
//             type="number"
//             placeholder="Budget (₹)"
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.budget}
//             onChange={(e) =>
//               setFormData({ ...formData, budget: e.target.value })
//             }
//           />

//           <input
//             placeholder="City"
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.city}
//             onChange={(e) =>
//               setFormData({ ...formData, city: e.target.value })
//             }
//           />

//           <select
//             className="w-full px-4 py-3 border rounded-xl"
//             value={formData.categories[0]}
//             onChange={(e) =>
//               setFormData({
//                 ...formData,
//                 categories: [e.target.value],
//               })
//             }
//           >
//             {CATEGORIES.map((cat) => (
//               <option key={cat} value={cat}>
//                 {cat}
//               </option>
//             ))}
//           </select>

//           <div>
//             <p className="font-semibold mb-2">Select Roles:</p>
//             <div className="flex gap-4 flex-wrap">
//               {Object.values(UserRole).map((role) => (
//                 <button
//                   key={role}
//                   type="button"
//                   onClick={() => toggleRole(role)}
//                   className={`px-4 py-2 rounded-lg border ${
//                     formData.roles.includes(role)
//                       ? "bg-indigo-600 text-white"
//                       : "bg-gray-100"
//                   }`}
//                 >
//                   {role}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <button
//             type="submit"
//             className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold"
//           >
//             Launch Campaign
//           </button>
//         </form>
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { UserRole } from "@/lib/types";
// import { CATEGORIES } from "@/lib/constants";

// export default function PostCampaignPage() {
//   const router = useRouter();

//   const [formData, setFormData] = useState({
//     title: "",
//     description: "",
//     budget: "",
//     category: CATEGORIES[0],
//     deadline: "",
//     requiredRoles: [] as UserRole[],
//   });

//   const toggleRole = (role: UserRole) => {
//     setFormData((prev) => ({
//       ...prev,
//       requiredRoles: prev.requiredRoles.includes(role)
//         ? prev.requiredRoles.filter((r) => r !== role)
//         : [...prev.requiredRoles, role],
//     }));
//   };

//   const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();

//     console.log("Posting Campaign:", formData);
//     alert("Campaign posted successfully!");

//     router.push("/campaigns");
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 py-12 px-6">
//       <div className="max-w-3xl mx-auto">
//         {/* Header */}
//         <div className="mb-8">
//           <Link
//             href="/campaigns"
//             className="text-sm font-bold text-indigo-600 hover:underline"
//           >
//             ← Back to Campaigns
//           </Link>

//           <h1 className="text-4xl font-extrabold text-slate-900 mt-4">
//             Post a Campaign
//           </h1>
//           <p className="text-slate-500 mt-2">
//             Reach out to thousands of creators and find your perfect match.
//           </p>
//         </div>

//         {/* Form */}
//         <div className="bg-white rounded-3xl border border-slate-200 shadow-xl">
//           <form onSubmit={handleSubmit} className="p-8 space-y-8">
//             {/* Overview */}
//             <section className="space-y-6">
//               <h3 className="text-lg font-bold border-b pb-2">
//                 1. Campaign Overview
//               </h3>

//               <input
//                 required
//                 placeholder="Campaign Title"
//                 className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
//                 value={formData.title}
//                 onChange={(e) =>
//                   setFormData({ ...formData, title: e.target.value })
//                 }
//               />

//               <textarea
//                 required
//                 rows={4}
//                 placeholder="Description & deliverables"
//                 className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
//                 value={formData.description}
//                 onChange={(e) =>
//                   setFormData({ ...formData, description: e.target.value })
//                 }
//               />
//             </section>

//             {/* Budget */}
//             <section className="space-y-6">
//               <h3 className="text-lg font-bold border-b pb-2">
//                 2. Budget & Timeline
//               </h3>

//               <div className="grid md:grid-cols-2 gap-6">
//                 <input
//                   required
//                   placeholder="Total Budget (₹)"
//                   className="px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
//                   value={formData.budget}
//                   onChange={(e) =>
//                     setFormData({ ...formData, budget: e.target.value })
//                   }
//                 />

//                 <input
//                   type="date"
//                   required
//                   className="px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
//                   value={formData.deadline}
//                   onChange={(e) =>
//                     setFormData({ ...formData, deadline: e.target.value })
//                   }
//                 />
//               </div>

//               <select
//                 className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-500 outline-none"
//                 value={formData.category}
//                 onChange={(e) =>
//                   setFormData({ ...formData, category: e.target.value })
//                 }
//               >
//                 {CATEGORIES.map((cat) => (
//                   <option key={cat}>{cat}</option>
//                 ))}
//               </select>
//             </section>

//             {/* Roles */}
//             <section className="space-y-6">
//               <h3 className="text-lg font-bold border-b pb-2">
//                 3. Required Talent
//               </h3>

//               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//                 {[UserRole.INFLUENCER, UserRole.MODEL, UserRole.PHOTOGRAPHER].map(
//                   (role) => (
//                     <button
//                       key={role}
//                       type="button"
//                       onClick={() => toggleRole(role)}
//                       className={`p-4 rounded-2xl border-2 font-bold transition ${
//                         formData.requiredRoles.includes(role)
//                           ? "border-indigo-600 bg-indigo-50 text-indigo-700"
//                           : "border-slate-200 bg-slate-50 text-slate-500"
//                       }`}
//                     >
//                       {role}
//                     </button>
//                   )
//                 )}
//               </div>

//               {formData.requiredRoles.length === 0 && (
//                 <p className="text-xs text-amber-600">
//                   Select at least one role
//                 </p>
//               )}
//             </section>

//             {/* Submit */}
//             <button
//               type="submit"
//               disabled={formData.requiredRoles.length === 0}
//               className={`w-full py-4 rounded-2xl font-bold text-lg transition ${
//                 formData.requiredRoles.length
//                   ? "bg-indigo-600 text-white hover:bg-indigo-700"
//                   : "bg-slate-200 text-slate-400 cursor-not-allowed"
//               }`}
//             >
//               Launch Campaign
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }
