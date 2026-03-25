"use client";

import { useState } from "react";

interface FormData {
  name: string;
  phone: string;
  email: string;
  description: string;
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  description?: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    phone: "",
    email: "",
    description: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.phone.trim()) e.phone = "Phone number is required";
    else if (!/^\+?[\d\s\-(]{7,15}$/.test(formData.phone)) e.phone = "Enter a valid phone number";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = "Enter a valid email";
    if (!formData.description.trim()) e.description = "Description is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setStatus(res.ok ? "success" : "error");
      if (res.ok) setFormData({ name: "", phone: "", email: "", description: "" });
    } catch {
      setStatus("error");
    }
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: undefined }));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #060912; min-height: 100vh; color: #e8eaf0; }

        .page {
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 20px;
          position: relative; overflow: hidden;
        }

        .bg { position: fixed; inset: 0; z-index: 0; overflow: hidden; }
        .bg-gradient {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 70% at 15% 10%, rgba(88,28,235,0.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 60% at 85% 85%, rgba(6,182,212,0.18) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 60%),
            #060912;
        }
        .bg-orb1 {
          position: absolute; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%);
          top: -150px; left: -180px;
          animation: float1 9s ease-in-out infinite;
        }
        .bg-orb2 {
          position: absolute; width: 600px; height: 600px; border-radius: 50%;
          background: radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%);
          bottom: -100px; right: -140px;
          animation: float2 11s ease-in-out infinite;
        }
        .bg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .bg-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        @keyframes float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,20px) scale(1.05)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,-30px) scale(0.95)} }

        .card {
          position: relative; z-index: 1;
          width: 100%; max-width: 540px;
          background: rgba(8,12,24,0.82);
          border: 1px solid rgba(124,58,237,0.2);
          border-radius: 28px;
          padding: 52px 48px;
          backdrop-filter: blur(32px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 40px 80px rgba(0,0,0,0.6),
            0 0 100px rgba(88,28,235,0.1),
            inset 0 1px 0 rgba(255,255,255,0.06);
          animation: cardIn 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(28px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(124,58,237,0.22);
          border-radius: 100px; padding: 5px 14px;
          font-size: 10.5px; font-weight: 500; color: #a78bfa;
          letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 22px;
        }
        .bdot { width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; animation: pulse 2.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }

        .title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 42px; font-weight: 900;
          line-height: 1.05; letter-spacing: -1.5px; margin-bottom: 10px;
          background: linear-gradient(135deg, #ffffff 0%, #e0d7ff 30%, #a78bfa 60%, #22d3ee 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: shine 6s ease-in-out infinite;
        }
        .title em { font-style: italic; font-weight: 700; }
        @keyframes shine { 0%,100%{background-position:200% center} 50%{background-position:-200% center} }

        .subtitle { font-size: 13.5px; color: rgba(232,234,240,0.38); margin-bottom: 38px; line-height: 1.65; font-weight: 300; }

        .field { margin-bottom: 18px; }
        label { display: block; font-size: 11px; font-weight: 500; color: rgba(232,234,240,0.42); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 7px; }

        input, textarea {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 13px 15px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; color: #e8eaf0;
          outline: none;
          transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
          -webkit-appearance: none;
        }
        textarea { resize: none; height: 110px; }
        input::placeholder, textarea::placeholder { color: rgba(232,234,240,0.18); }
        input:focus, textarea:focus {
          border-color: rgba(124,58,237,0.55);
          background: rgba(124,58,237,0.06);
          box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
        }
        input.err, textarea.err { border-color: rgba(248,113,113,0.45) !important; background: rgba(248,113,113,0.04) !important; }
        .errt { font-size: 11px; color: #f87171; margin-top: 5px; display: flex; align-items: center; gap: 4px; animation: errIn 0.2s ease both; }
        @keyframes errIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }

        .btn {
          width: 100%; margin-top: 26px; padding: 15px; border: none; border-radius: 14px;
          font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; letter-spacing: 0.03em; cursor: pointer;
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 40%, #0891b2 100%);
          color: #fff;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          box-shadow: 0 4px 24px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.15);
        }
        .btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.14) 0%, transparent 50%); border-radius: inherit; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 32px rgba(124,58,237,0.5); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-in { display: flex; align-items: center; justify-content: center; gap: 10px; position: relative; z-index: 1; }
        .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }

        .success { text-align: center; padding: 16px 0 4px; animation: successPop 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes successPop { 0%{opacity:0;transform:scale(0.7)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
        .s-icon { width: 72px; height: 72px; background: linear-gradient(135deg, rgba(34,211,238,0.15), rgba(124,58,237,0.2)); border: 1px solid rgba(34,211,238,0.25); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 30px; }
        .s-title { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; background: linear-gradient(135deg, #fff, #22d3ee); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 8px; }
        .s-sub { font-size: 13px; color: rgba(232,234,240,0.38); line-height: 1.6; }
        .reset { margin-top: 24px; background: transparent; border: 1px solid rgba(124,58,237,0.2); border-radius: 10px; padding: 9px 22px; font-family: 'DM Sans', sans-serif; font-size: 12px; color: rgba(167,139,250,0.65); cursor: pointer; transition: border-color 0.2s, color 0.2s; }
        .reset:hover { border-color: rgba(124,58,237,0.5); color: #a78bfa; }

        .ebanner { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 10px; padding: 11px 14px; font-size: 12.5px; color: #fca5a5; margin-top: 14px; text-align: center; }
        .hr { border: none; border-top: 1px solid rgba(255,255,255,0.05); margin: 28px 0 22px; }
        .fnote { font-size: 10.5px; color: rgba(232,234,240,0.2); text-align: center; line-height: 1.6; }

        @media (max-width: 580px) { .card { padding: 36px 22px; } .title { font-size: 32px; } }
      `}</style>

      <div className="bg">
        <div className="bg-gradient" />
        <div className="bg-orb1" />
        <div className="bg-orb2" />
        <div className="bg-grid" />
        <div className="bg-dots" />
      </div>

      <div className="page">
        <div className="card">
          {status === "success" ? (
            <div className="success">
              <div className="s-icon">✓</div>
              <div className="s-title">Message Sent!</div>
              <p className="s-sub">Thanks for reaching out. Our team will get back to you soon.</p>
              <button className="reset" onClick={() => setStatus("idle")}>Send another message</button>
            </div>
          ) : (
            <>
              <div className="badge"><span className="bdot" /> Collabyz</div>
              <div className="title"><em>Let&rsquo;s</em> Connect.</div>
              <p className="subtitle">Have a project or idea? Drop us a message and we'll be in touch soon.</p>

              {[
                { id: "name", label: "Full Name", type: "text", placeholder: "Rahul Sharma" },
                { id: "phone", label: "Phone Number", type: "tel", placeholder: "+91 98765 43210" },
                { id: "email", label: "Email Address", type: "email", placeholder: "you@example.com" },
              ].map(({ id, label, type, placeholder }) => (
                <div className="field" key={id}>
                  <label htmlFor={id}>{label}</label>
                  <input
                    id={id} type={type} placeholder={placeholder}
                    value={formData[id as keyof FormData]}
                    onChange={(e) => handleChange(id as keyof FormData, e.target.value)}
                    className={errors[id as keyof FormErrors] ? "err" : ""}
                  />
                  {errors[id as keyof FormErrors] && <p className="errt">⚠ {errors[id as keyof FormErrors]}</p>}
                </div>
              ))}

              <div className="field">
                <label htmlFor="description">Your Message</label>
                <textarea
                  id="description" placeholder="Tell us about your project or idea..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  className={errors.description ? "err" : ""}
                />
                {errors.description && <p className="errt">⚠ {errors.description}</p>}
              </div>

              <button className="btn" onClick={handleSubmit} disabled={status === "loading"}>
                <span className="btn-in">
                  {status === "loading" ? <><span className="spinner" /> Sending...</> : "Send Message →"}
                </span>
              </button>

              {status === "error" && <p className="ebanner">Something went wrong. Please try again.</p>}

              <hr className="hr" />
              <p className="fnote">Your message goes directly to our team at collabzy.admin@gmail.com</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API = "https://api.collabzy.in/api";

// export default function ContactPage() {
//   const router = useRouter();
//   const [token,     setToken]     = useState("");
//   const [myId,      setMyId]      = useState("");
//   const [bits,      setBits]      = useState(0);
//   const [creators,  setCreators]  = useState<any[]>([]);
//   const [loading,   setLoading]   = useState(true);
//   const [unlocking, setUnlocking] = useState<string|null>(null);
//   const [unlocked,  setUnlocked]  = useState<Record<string,string>>({}); // id → email
//   const [toast,     setToast]     = useState<{msg:string;type:"success"|"error"|"warn"}|null>(null);
//   const [search,    setSearch]    = useState("");

//   const showToast = (msg:string, type:"success"|"error"|"warn"="success") => {
//     setToast({msg,type}); setTimeout(()=>setToast(null),4000);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const u = JSON.parse(raw);
//     if (u.role?.toLowerCase() !== "brand") { router.push("/dashboard"); return; }
//     setToken(u.token);
//     setMyId(u.user?._id || u._id || u.id || "");
//     setBits(u.bits ?? 0);
//     // Load previously unlocked contacts
//     const saved = JSON.parse(localStorage.getItem(`unlocked_contacts_${u.user?._id||u._id||""}`) || "{}");
//     setUnlocked(saved);
//     fetchCreators(u.token);
//   }, []);

//   const fetchCreators = async (t:string) => {
//     try {
//       const res  = await fetch(`${API}/profile/influencers`, { headers: { Authorization: `Bearer ${t}` } });
//       const data = await res.json();
//       setCreators(data.data || data.influencers || []);
//     } catch { showToast("Failed to load creators", "error"); }
//     finally { setLoading(false); }
//   };

//   const handleUnlock = async (creatorId:string) => {
//     if (unlocked[creatorId]) return; // already unlocked
//     if (bits < 50) {
//       showToast("Not enough bits! You need 50 bits to unlock a contact.", "error");
//       return;
//     }
//     setUnlocking(creatorId);
//     try {
//       const res  = await fetch(`${API}/contact/unlock`, {
//         method:  "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body:    JSON.stringify({ influencerId: creatorId }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Unlock failed");

//       // Save email
//       const email    = data.email || "";
//       const newBits  = bits - 50;
//       const newUnlocked = { ...unlocked, [creatorId]: email };

//       setUnlocked(newUnlocked);
//       setBits(newBits);

//       // Persist to localStorage
//       localStorage.setItem(`unlocked_contacts_${myId}`, JSON.stringify(newUnlocked));
//       const stored = localStorage.getItem("cb_user");
//       if (stored) {
//         const parsed = JSON.parse(stored);
//         localStorage.setItem("cb_user", JSON.stringify({ ...parsed, bits: newBits }));
//       }

//       showToast(`✅ Contact unlocked! Email: ${email}`, "success");
//     } catch(e:any) {
//       showToast(e.message || "Unlock failed", "error");
//     } finally {
//       setUnlocking(null);
//     }
//   };

//   const gName = (c:any) => c.name || c.username || "Creator";
//   const gImg  = (c:any) => c.profileImage || c.avatar || null;
//   const gCats = (c:any) => (Array.isArray(c.categories) ? c.categories : [c.categories]).filter(Boolean);
//   const gCity = (c:any) => c.city || c.location || "";
//   const cap   = (s:string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

//   const filtered = creators.filter(c => {
//     const q = search.toLowerCase();
//     return !q || gName(c).toLowerCase().includes(q) || gCity(c).toLowerCase().includes(q);
//   });

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
//         body{font-family:'Plus Jakarta Sans',sans-serif}
//         .cp{background:#f7f7f5;min-height:100vh;padding-bottom:60px}

//         /* HEADER */
//         .cp-hdr{background:#fff;border-bottom:1px solid #efefef;padding:20px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
//         .cp-hdr-left{display:flex;align-items:center;gap:14px}
//         .cp-back{background:#f5f5f3;border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;color:#555;text-decoration:none;font-family:inherit}
//         .cp-back:hover{background:#ebebeb}
//         .cp-title{font-size:20px;font-weight:800;color:#111}
//         .cp-bits{display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1.5px solid #fde68a;border-radius:12px;padding:8px 16px}
//         .cp-bits-val{font-size:18px;font-weight:800;color:#d97706}
//         .cp-bits-lbl{font-size:12px;color:#92400e;font-weight:600}

//         /* SEARCH + INFO */
//         .cp-top{max-width:760px;margin:24px auto;padding:0 20px;display:flex;flex-direction:column;gap:14px}
//         .cp-search{width:100%;padding:12px 16px;border-radius:12px;border:1.5px solid #ebebeb;font-size:14px;font-family:inherit;outline:none;background:#fff}
//         .cp-search:focus{border-color:#4f46e5}
//         .cp-info{background:#eef2ff;border:1.5px solid #c7d2fe;border-radius:14px;padding:14px 16px;font-size:13px;color:#4f46e5;font-weight:600;display:flex;align-items:center;gap:8px}

//         /* GRID */
//         .cp-grid{max-width:760px;margin:0 auto;padding:0 20px;display:flex;flex-direction:column;gap:12px;animation:fadeIn .3s ease}

//         /* CREATOR ROW */
//         .cr{background:#fff;border-radius:16px;border:1.5px solid #efefef;padding:16px 20px;display:flex;align-items:center;gap:14px;transition:all .2s}
//         .cr:hover{border-color:#c7d2fe;box-shadow:0 4px 16px rgba(79,70,229,.08)}
//         .cr-av{width:52px;height:52px;border-radius:50%;object-fit:cover;flex-shrink:0}
//         .cr-avph{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#4f46e5,#7c3aed);display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;flex-shrink:0}
//         .cr-info{flex:1;min-width:0}
//         .cr-name{font-size:15px;font-weight:700;color:#111;margin-bottom:3px}
//         .cr-meta{font-size:12px;color:#aaa;display:flex;gap:8px;flex-wrap:wrap}
//         .cr-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0}

//         /* UNLOCKED STATE */
//         .cr-email{background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;color:#16a34a;display:flex;align-items:center;gap:6px;animation:fadeIn .3s ease}
//         .cr-email-copy{background:none;border:none;cursor:pointer;font-size:14px;padding:0;color:#16a34a}
//         .cr-email-copy:hover{color:#15803d}

//         /* UNLOCK BUTTON */
//         .cr-unlock-btn{background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap}
//         .cr-unlock-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 12px rgba(79,70,229,.3)}
//         .cr-unlock-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
//         .cr-unlock-btn.no-bits{background:linear-gradient(135deg,#ef4444,#dc2626)}

//         /* EMPTY */
//         .cp-empty{text-align:center;padding:60px 20px;color:#aaa}
//         .cp-empty-ico{font-size:40px;margin-bottom:12px}

//         /* LOADING */
//         .cp-load{display:flex;align-items:center;justify-content:center;padding:60px}
//         .cp-spin{width:32px;height:32px;border:3px solid #f0f0f0;border-top-color:#4f46e5;border-radius:50%;animation:spin .8s linear infinite}

//         .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .toast.success{background:#111;color:#fff}
//         .toast.error{background:#ef4444;color:#fff}
//         .toast.warn{background:#f59e0b;color:#fff}
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="cp">
//         {/* HEADER */}
//         <div className="cp-hdr">
//           <div className="cp-hdr-left">
//             <a href="/browse" className="cp-back">← Back</a>
//             <div className="cp-title">🔓 Unlock Contacts</div>
//           </div>
//           <div className="cp-bits">
//             <span className="cp-bits-val">{bits}</span>
//             <span className="cp-bits-lbl">bits remaining</span>
//           </div>
//         </div>

//         <div className="cp-top">
//           <input
//             className="cp-search"
//             placeholder="🔍 Search by name or city..."
//             value={search}
//             onChange={e => setSearch(e.target.value)}
//           />
//           <div className="cp-info">
//             🪙 Each unlock costs <strong style={{margin:"0 4px"}}>50 bits</strong> — you get the creator's email address
//           </div>
//         </div>

//         {loading ? (
//           <div className="cp-load"><div className="cp-spin"/></div>
//         ) : filtered.length === 0 ? (
//           <div className="cp-empty">
//             <div className="cp-empty-ico">👥</div>
//             <div style={{fontWeight:700,color:"#555",marginBottom:6}}>No creators found</div>
//             <div style={{fontSize:13}}>Try a different search</div>
//           </div>
//         ) : (
//           <div className="cp-grid">
//             {filtered.map(c => {
//               const cid       = c._id;
//               const email     = unlocked[cid];
//               const isUnlocked= !!email;
//               const isLoading = unlocking === cid;
//               const noBits    = bits < 50;

//               return (
//                 <div key={cid} className="cr">
//                   {/* Avatar */}
//                   {gImg(c)
//                     ? <img src={gImg(c)} alt={gName(c)} className="cr-av"/>
//                     : <div className="cr-avph">{gName(c).charAt(0).toUpperCase()}</div>
//                   }

//                   {/* Info */}
//                   <div className="cr-info">
//                     <div className="cr-name">{gName(c)}</div>
//                     <div className="cr-meta">
//                       {gCity(c) && <span>📍 {cap(gCity(c))}</span>}
//                       {gCats(c)[0] && <span>✨ {cap(gCats(c)[0])}</span>}
//                       {c.followers && Number(c.followers) > 0 && (
//                         <span>👥 {Number(c.followers) >= 1000 ? `${(Number(c.followers)/1000).toFixed(0)}K` : c.followers}</span>
//                       )}
//                     </div>
//                   </div>

//                   {/* Right side */}
//                   <div className="cr-right">
//                     {isUnlocked ? (
//                       <div className="cr-email">
//                         ✉️ {email}
//                         <button
//                           className="cr-email-copy"
//                           title="Copy email"
//                           onClick={() => { navigator.clipboard.writeText(email); showToast("Email copied!", "success"); }}
//                         >📋</button>
//                       </div>
//                     ) : (
//                       <button
//                         className={`cr-unlock-btn ${noBits ? "no-bits" : ""}`}
//                         disabled={isLoading || noBits}
//                         onClick={() => handleUnlock(cid)}
//                       >
//                         {isLoading ? "Unlocking..." : noBits ? "❌ Need 50 bits" : "🔓 Unlock (50 bits)"}
//                       </button>
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