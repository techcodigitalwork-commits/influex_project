"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

// ── Simple circular crop modal ──────────────────────────────────
function CropModal({ src, onDone, onCancel }: { src: string; onDone: (blob: Blob) => void; onCancel: () => void }) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgRef     = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // crop circle position & size (in container px)
  const [circle, setCircle] = useState({ x: 0, y: 0, r: 100 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0, naturalW: 0, naturalH: 0 });
  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  const CONTAINER = 320; // fixed square container px

  // once image loads, center circle
  const onImgLoad = () => {
    const img = imgRef.current!;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    // fit image into CONTAINER keeping aspect
    const scale = Math.min(CONTAINER / naturalW, CONTAINER / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    setImgSize({ w, h, naturalW, naturalH });
    const r = Math.min(w, h) / 2 * 0.85;
    setCircle({ x: w / 2, y: h / 2, r });
  };

  // drag to move circle
  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    dragging.current = true;
    const pos = "touches" in e ? e.touches[0] : e;
    const rect = containerRef.current!.getBoundingClientRect();
    lastPos.current = { x: pos.clientX - rect.left, y: pos.clientY - rect.top };
  };
  const onMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!dragging.current) return;
    const pos = "touches" in e ? (e as TouchEvent).touches[0] : e as MouseEvent;
    const rect = containerRef.current!.getBoundingClientRect();
    const nx = pos.clientX - rect.left;
    const ny = pos.clientY - rect.top;
    const dx = nx - lastPos.current.x;
    const dy = ny - lastPos.current.y;
    lastPos.current = { x: nx, y: ny };
    setCircle(c => {
      const newX = Math.max(c.r, Math.min(imgSize.w - c.r, c.x + dx));
      const newY = Math.max(c.r, Math.min(imgSize.h - c.r, c.y + dy));
      return { ...c, x: newX, y: newY };
    });
  }, [imgSize]);
  const onMouseUp = () => { dragging.current = false; };

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onMouseMove);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onMouseMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [onMouseMove]);

  // zoom slider
  const onZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = Number(e.target.value);
    setCircle(c => {
      const newX = Math.max(r, Math.min(imgSize.w - r, c.x));
      const newY = Math.max(r, Math.min(imgSize.h - r, c.y));
      return { x: newX, y: newY, r };
    });
  };

  const handleCrop = () => {
    const img = imgRef.current!;
    const canvas = canvasRef.current!;
    const OUT = 400;
    canvas.width  = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;

    // map circle back to natural image coords
    const scaleX = imgSize.naturalW / imgSize.w;
    const scaleY = imgSize.naturalH / imgSize.h;
    const sx = (circle.x - circle.r) * scaleX;
    const sy = (circle.y - circle.r) * scaleY;
    const sw = circle.r * 2 * scaleX;
    const sh = circle.r * 2 * scaleY;

    ctx.clearRect(0, 0, OUT, OUT);
    ctx.save();
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);
    ctx.restore();

    canvas.toBlob(blob => { if (blob) onDone(blob); }, "image/jpeg", 0.92);
  };

  const minR = 40;
  const maxR = imgSize.w ? Math.min(imgSize.w, imgSize.h) / 2 : 150;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, padding: "24px 20px 20px",
        width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111", fontFamily: "DM Sans, sans-serif" }}>
          Crop Photo
        </div>
        <div style={{ fontSize: 12, color: "#aaa", marginTop: -8, fontFamily: "DM Sans, sans-serif" }}>
          Drag to reposition · Slider to zoom
        </div>

        {/* Image + crop overlay */}
        <div
          ref={containerRef}
          style={{
            width: CONTAINER, height: CONTAINER,
            position: "relative", overflow: "hidden",
            background: "#f0f0f0", borderRadius: 12, cursor: "move", userSelect: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onMouseDown={onMouseDown}
          onTouchStart={onMouseDown}
        >
          {/* actual image */}
          <img
            ref={imgRef}
            src={src}
            alt="crop"
            onLoad={onImgLoad}
            style={{
              width: imgSize.w || "auto", height: imgSize.h || "auto",
              display: "block", pointerEvents: "none",
              position: "absolute",
              left: (CONTAINER - imgSize.w) / 2,
              top:  (CONTAINER - imgSize.h) / 2,
            }}
            draggable={false}
          />

          {/* dark overlay with circle cutout via SVG */}
          {imgSize.w > 0 && (
            <svg
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              width={CONTAINER} height={CONTAINER}
            >
              <defs>
                <mask id="hole">
                  <rect width={CONTAINER} height={CONTAINER} fill="white"/>
                  <circle
                    cx={circle.x + (CONTAINER - imgSize.w) / 2}
                    cy={circle.y + (CONTAINER - imgSize.h) / 2}
                    r={circle.r} fill="black"
                  />
                </mask>
              </defs>
              <rect width={CONTAINER} height={CONTAINER} fill="rgba(0,0,0,0.5)" mask="url(#hole)"/>
              {/* circle border */}
              <circle
                cx={circle.x + (CONTAINER - imgSize.w) / 2}
                cy={circle.y + (CONTAINER - imgSize.h) / 2}
                r={circle.r}
                fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2}
              />
            </svg>
          )}
        </div>

        {/* Zoom slider */}
        <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "#aaa" }}>−</span>
          <input
            type="range" min={minR} max={maxR} step={1}
            value={circle.r}
            onChange={onZoom}
            style={{ flex: 1, accentColor: "#4f46e5" }}
          />
          <span style={{ fontSize: 12, color: "#aaa" }}>+</span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #ebebeb",
            background: "#fff", color: "#777", fontSize: 14, fontWeight: 500,
            fontFamily: "DM Sans, sans-serif", cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={handleCrop} style={{
            flex: 1, padding: "12px", borderRadius: 10, border: "none",
            background: "#111", color: "#fff", fontSize: 14, fontWeight: 600,
            fontFamily: "DM Sans, sans-serif", cursor: "pointer",
          }}>
            Apply Crop ✓
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
export default function SetupProfile() {
  const router = useRouter();

  const [step, setStep]               = useState(1);
  const [role, setRole]               = useState("");
  const [form, setForm]               = useState<any>({});
  const [preview, setPreview]         = useState<string | null>(null);
  const [isEdit, setIsEdit]           = useState(false);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [imageError, setImageError]   = useState("");
  const [imageSuccess, setImageSuccess] = useState(false);

  // ── crop state ──
  const [cropSrc, setCropSrc]         = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("cb_user");
    const storedUser = JSON.parse(user || "{}");
    const token = localStorage.getItem("token") || storedUser.token;

    if (!user || !token) { router.push("/login"); return; }

    setRole(storedUser.role?.toUpperCase());
    setForm({ name: storedUser.name || "", email: storedUser.email || "" });

    fetch(`${API_BASE}/profile/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => { if (!res.ok) throw new Error("fail"); return res.json(); })
      .then((data) => {
        if (data.success && data.profile) {
          // ── support multiple categories ──
          const existingCategories = Array.isArray(data.profile.categories)
            ? data.profile.categories
            : data.profile.categories
              ? [data.profile.categories]
              : [];
          setForm((prev: any) => ({
            ...prev, ...data.profile,
            name: data.profile.name || storedUser.name || "",
            city: data.profile.city || data.profile.location || "",
            categories: existingCategories,
            platformLink: data.profile.platform || "",
            websiteLink: data.profile.website || "",
            followers: data.profile.followers || "",
          }));
          setPreview(data.profile.profileImage || null);
          setIsEdit(true);
        }
      })
      .catch((err) => console.warn("New user:", err.message));
  }, []);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  // ── toggle category in array ──
  const toggleCategory = (cat: string) => {
    setForm((prev: any) => {
      const current: string[] = Array.isArray(prev.categories) ? prev.categories : [];
      const lower = cat.toLowerCase();
      return {
        ...prev,
        categories: current.includes(lower)
          ? current.filter(c => c !== lower)
          : [...current, lower],
      };
    });
  };

  // ── file picked → show crop modal ──
  const handleFileSelect = (file: File) => {
    setImageError(""); setImageSuccess(false);
    if (file.size > 5 * 1024 * 1024) { setImageError("The image must be smaller than 5MB."); return; }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── after crop → upload blob ──
  const handleCropDone = async (blob: Blob) => {
    setCropSrc(null);
    const objectUrl = URL.createObjectURL(blob);
    setPreview(objectUrl);

    try {
      setUploading(true);
      const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
      const token = localStorage.getItem("token") || storedUser.token;
      const formData = new FormData();
      formData.append("image", blob, "avatar.jpg");

      const res = await fetch(`${API_BASE}/upload/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); }
      catch {
        setImageError(`Server error (${res.status})`);
        setPreview(null); return;
      }

      if (data.success && data.url) {
        handleChange("profileImage", data.url);
        setPreview(data.url);
        setImageSuccess(true);
      } else {
        setImageError(data.message || "Upload fail hua");
        setPreview(null);
        handleChange("profileImage", "");
      }
    } catch {
      setImageError("Network error — The app is unable to connect to the server.");
      setPreview(null);
      handleChange("profileImage", "");
    } finally { setUploading(false); }
  };

  const handleSkip = () => {
    const isBrand  = role === "BRAND";
    const isLastStep = (isBrand && step === 3) || (!isBrand && step === 2);
    if (isLastStep) { router.push(isBrand ? "/campaigns" : "/discovery"); }
    else { setStep(step + 1); }
  };

  const nextStep = () => {
    if (role !== "BRAND" && step === 2) { handleSubmit(); }
    else { setStep(step + 1); }
  };

  const handleSubmit = async () => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token;
    setSaving(true);
    const cityValue = (form.city || "").toLowerCase().trim();
    const cats: string[] = Array.isArray(form.categories) ? form.categories : (form.categories ? [form.categories] : []);
    const payload: any = {
      role: storedUser.role?.toLowerCase(),
      name: form.name || "",
      phone: String(form.phone || ""),
      bio: form.bio || "",
      location: cityValue,
      followers: String(form.followers || "0"),
      categories: cats.map(c => c.toLowerCase()),
      platform: form.platformLink || "",
      companyName: storedUser.role?.toLowerCase() === "brand" ? form.companyName || "" : "",
      website: storedUser.role?.toLowerCase() === "brand" ? form.websiteLink || "" : "",
    };
    if (form.profileImage && form.profileImage.startsWith("http")) {
      payload.profileImage = form.profileImage;
    }
    try {
      const res = await fetch(`${API_BASE}/profile`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updatedUser = { ...storedUser, hasProfile: true };
        localStorage.setItem("cb_user", JSON.stringify(updatedUser));
        router.push(storedUser.role?.toLowerCase() === "brand" ? "/campaigns" : "/discovery");
      } else {
        const err = await res.json();
        alert("Error: " + (err.message || "Something went wrong"));
      }
    } finally { setSaving(false); }
  };

  const totalSteps = role === "BRAND" ? 3 : 2;
  const cats: string[] = Array.isArray(form.categories) ? form.categories : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .pp-wrap { font-family:'DM Sans',sans-serif; background:#f5f5f0; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 16px; }
        .pp-title { font-family:'DM Sans',sans-serif; font-size:clamp(20px,5vw,26px); font-weight:600; color:#111; margin:0 0 4px; text-align:center; }
        .pp-sub { color:#999; font-size:14px; font-weight:400; margin:0 0 24px; text-align:center; }
        .pp-card { background:#fff; border-radius:20px; box-shadow:0 2px 24px rgba(0,0,0,0.06); border:1px solid #ebebeb; width:100%; max-width:460px; padding:28px 24px; }
        @media(max-width:480px){ .pp-card{ padding:22px 16px; border-radius:16px; } }
        .pp-step-title { font-family:'DM Sans',sans-serif; font-size:16px; font-weight:600; color:#111; margin:0 0 22px; }
        .pp-field { display:flex; flex-direction:column; gap:6px; }
        .pp-label { font-size:11px; font-weight:500; color:#aaa; text-transform:uppercase; letter-spacing:0.06em; }
        .pp-input { padding:12px 14px; border-radius:10px; border:1.5px solid #ebebeb; background:#fafafa; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:400; color:#111; outline:none; width:100%; transition:border-color 0.2s,box-shadow 0.2s; }
        .pp-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.08); background:#fff; }
        .pp-input::placeholder { color:#c0c0c0; }
        .pp-textarea { resize:none; }
        .pp-select { padding:12px 40px 12px 14px; border-radius:10px; border:1.5px solid #ebebeb; background:#fafafa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 14px center; font-size:14px; font-family:'DM Sans',sans-serif; font-weight:400; color:#111; outline:none; width:100%; appearance:none; cursor:pointer; transition:border-color 0.2s; }
        .pp-select:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.08); background-color:#fff; }
        .pp-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:380px){ .pp-grid2{ grid-template-columns:1fr; } }
        .pp-avatar-wrap { display:flex; justify-content:center; flex-direction:column; align-items:center; gap:8px; margin-bottom:4px; }
        .pp-avatar { width:88px; height:88px; border-radius:50%; border:2px dashed #ddd; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:pointer; position:relative; transition:border-color 0.2s; }
        .pp-avatar:hover { border-color:#4f46e5; }
        .pp-avatar img { width:100%; height:100%; object-fit:cover; }
        .pp-avatar-placeholder { text-align:center; color:#ccc; }
        .pp-avatar-placeholder div:first-child { font-size:22px; line-height:1; }
        .pp-avatar-placeholder div:last-child { font-size:10px; margin-top:4px; font-weight:400; }
        .pp-avatar-hover { position:absolute; inset:0; background:rgba(0,0,0,0.45); display:flex; align-items:center; justify-content:center; border-radius:50%; opacity:0; transition:opacity 0.2s; color:#fff; font-size:11px; font-weight:500; }
        .pp-avatar:hover .pp-avatar-hover { opacity:1; }
        .pp-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:6px; }
        .pp-chip { padding:8px 14px; border-radius:100px; border:1.5px solid #ebebeb; background:#fafafa; font-size:13px; font-weight:400; cursor:pointer; transition:all 0.15s; color:#666; font-family:'DM Sans',sans-serif; }
        .pp-chip:hover { border-color:#4f46e5; color:#4f46e5; }
        .pp-chip.sel { background:#4f46e5; border-color:#4f46e5; color:#fff; }
        .pp-btns { display:flex; gap:10px; margin-top:8px; }
        .pp-btn-main { flex:1; padding:13px; border-radius:10px; font-weight:500; font-size:14px; color:#fff; background:#111; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; }
        .pp-btn-main:hover { background:#333; }
        .pp-btn-main:disabled { opacity:0.4; cursor:not-allowed; }
        .pp-btn-skip { flex:1; padding:13px; border-radius:10px; font-size:14px; font-weight:400; color:#999; background:#f4f4f4; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; }
        .pp-btn-skip:hover { color:#555; background:#eee; }
        .pp-dots { display:flex; gap:6px; margin-bottom:20px; }
        .pp-dot { height:6px; border-radius:3px; background:#e0e0e0; transition:all 0.3s; width:6px; }
        .pp-dot.active { background:#4f46e5; width:20px; }
        .pp-dot.done { background:#a5b4fc; }
        .pp-footer { color:#ccc; font-size:12px; margin-top:14px; text-align:center; font-weight:400; }
        .pp-section-gap { display:flex; flex-direction:column; gap:16px; }
        .pp-error { color:#ef4444; font-size:12px; text-align:center; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:8px 12px; font-weight:400; }
        .pp-success { color:#16a34a; font-size:12px; text-align:center; font-weight:400; }
        .pp-hint { font-size:11px; color:#bbb; text-align:center; font-weight:400; }
      `}</style>

      {/* ── CROP MODAL ── */}
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onDone={handleCropDone}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="pp-wrap">
        <div style={{ textAlign: "center" }}>
          <h1 className="pp-title">{isEdit ? "Edit Profile" : "Set Up Profile"}</h1>
          <p className="pp-sub">{isEdit ? "Update your information anytime" : "Complete your profile to get started"}</p>
        </div>

        <div className="pp-dots">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`pp-dot ${i + 1 === step ? "active" : i + 1 < step ? "done" : ""}`} />
          ))}
        </div>

        <div className="pp-card">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="pp-section-gap">
              <p className="pp-step-title">Basic Info</p>

              <div className="pp-avatar-wrap">
                <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
                  <div className="pp-avatar" style={{ opacity: uploading ? 0.7 : 1 }}>
                    {preview
                      ? <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div className="pp-avatar-placeholder"><div>📷</div><div>Add Photo</div></div>
                    }
                    <div className="pp-avatar-hover">{uploading ? "Uploading..." : "Change"}</div>
                  </div>
                  <input type="file" hidden accept="image/*" disabled={uploading}
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
                </label>
                <span className="pp-hint">JPG, PNG · Max 5MB</span>
                {uploading && <span style={{ fontSize: "12px", color: "#4f46e5" }}>⏳ Uploading...</span>}
                {imageSuccess && !uploading && <span className="pp-success">✅ Image uploaded</span>}
                {imageError && <span className="pp-error">{imageError}</span>}
              </div>

              <div className="pp-field">
                <label className="pp-label">Full Name</label>
                <input className="pp-input" placeholder="Your name"
                  value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
              </div>

              <div className="pp-field">
                <label className="pp-label">Bio</label>
                <textarea className="pp-input pp-textarea" placeholder="Tell brands about yourself..." rows={3}
                  value={form.bio || ""} onChange={(e) => handleChange("bio", e.target.value)} />
              </div>

              <div className="pp-grid2">
                <div className="pp-field">
                  <label className="pp-label">Phone</label>
                  <input
                    type="tel" inputMode="numeric" pattern="[0-9+]*"
                    className="pp-input" placeholder="9876543210"
                    value={form.phone || ""} maxLength={15}
                    onChange={(e) => handleChange("phone", e.target.value.replace(/[^0-9+]/g, ""))}
                  />
                </div>
                <div className="pp-field">
                  <label className="pp-label">City</label>
                  <input className="pp-input" placeholder="Mumbai"
                    value={form.city || ""} onChange={(e) => handleChange("city", e.target.value)} />
                </div>
              </div>

              <div className="pp-btns">
                <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="pp-btn-main" onClick={nextStep} disabled={uploading}>
                  {uploading ? "Wait..." : "Continue →"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 — Creator ── */}
          {step === 2 && role !== "BRAND" && (
            <div className="pp-section-gap">
              <p className="pp-step-title">Creator Details</p>

              <div className="pp-field">
                <label className="pp-label">Your Categories <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select multiple)</span></label>
                <div className="pp-chips">
                  {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
                    <button key={cat}
                      className={`pp-chip ${cats.includes(cat.toLowerCase()) ? "sel" : ""}`}
                      onClick={() => toggleCategory(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pp-field">
                <label className="pp-label">Followers Count</label>
                <select className="pp-select" value={form.followers || ""} onChange={(e) => handleChange("followers", e.target.value)}>
                  <option value="">Select Followers</option>
                  <option value="1000">1K – 5K</option>
                  <option value="5000">5K – 10K</option>
                  <option value="10000">10K – 20K</option>
                  <option value="30000">20K – 50K</option>
                  <option value="50000">50K – 75K</option>
                  <option value="75000">75K – 99K</option>
                  <option value="99000">99K+</option>
                </select>
              </div>

              <div className="pp-field">
                <label className="pp-label">Instagram / Platform Link</label>
                <input className="pp-input" placeholder="https://instagram.com/yourhandle"
                  value={form.platformLink || ""} onChange={(e) => handleChange("platformLink", e.target.value)} />
              </div>

              <div className="pp-btns">
                <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : "Save Profile ✓"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2 — Brand ── */}
          {step === 2 && role === "BRAND" && (
            <div className="pp-section-gap">
              <p className="pp-step-title">Brand Details</p>

              <div className="pp-field">
                <label className="pp-label">Company Name</label>
                <input className="pp-input" placeholder="Your company name"
                  value={form.companyName || ""} onChange={(e) => handleChange("companyName", e.target.value)} />
              </div>

              <div className="pp-field">
                <label className="pp-label">Industry <span style={{ color: "#bbb", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select multiple)</span></label>
                <div className="pp-chips">
                  {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
                    <button key={cat}
                      className={`pp-chip ${cats.includes(cat.toLowerCase()) ? "sel" : ""}`}
                      onClick={() => toggleCategory(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pp-btns">
                <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="pp-btn-main" onClick={nextStep}>Continue →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3 — Brand ── */}
          {step === 3 && role === "BRAND" && (
            <div className="pp-section-gap">
              <p className="pp-step-title">Online Presence</p>

              <div className="pp-field">
                <label className="pp-label">Website</label>
                <input className="pp-input" placeholder="https://yourbrand.com"
                  value={form.websiteLink || ""} onChange={(e) => handleChange("websiteLink", e.target.value)} />
              </div>

              <div className="pp-btns">
                <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
                <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
                  {saving ? "Saving..." : "Launch Profile 🚀"}
                </button>
              </div>
            </div>
          )}

        </div>

        <p className="pp-footer">You can update this anytime from your profile settings</p>
      </div>
    </>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "https://api.collabzy.in/api";

// export default function SetupProfile() {
//   const router = useRouter();

//   const [step, setStep] = useState(1);
//   const [role, setRole] = useState("");
//   const [form, setForm] = useState<any>({});
//   const [preview, setPreview] = useState<string | null>(null);
//   const [isEdit, setIsEdit] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [uploading, setUploading] = useState(false);
//   const [imageError, setImageError] = useState("");
//   const [imageSuccess, setImageSuccess] = useState(false);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     const storedUser = JSON.parse(user || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;

//     if (!user || !token) { router.push("/login"); return; }

//     setRole(storedUser.role?.toUpperCase());
//     setForm({ name: storedUser.name || "", email: storedUser.email || "" });

//     fetch(`${API_BASE}/profile/me`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then((res) => { if (!res.ok) throw new Error("fail"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) {
//           const existingCategory = Array.isArray(data.profile.categories)
//             ? data.profile.categories[0] || ""
//             : data.profile.categories || "";
//           setForm((prev: any) => ({
//             ...prev, ...data.profile,
//             name: data.profile.name || storedUser.name || "",
//             city: data.profile.city || data.profile.location || "",
//             categories: existingCategory,
//             platformLink: data.profile.platform || "",
//             websiteLink: data.profile.website || "",
//             followers: data.profile.followers || "",
//           }));
//           setPreview(data.profile.profileImage || null);
//           setIsEdit(true);
//         }
//       })
//       .catch((err) => console.warn("New user:", err.message));
//   }, []);

//   const handleChange = (field: string, value: string) => {
//     setForm((prev: any) => ({ ...prev, [field]: value }));
//   };

//   const handleImage = async (file: File) => {
//     setImageError(""); setImageSuccess(false);
//     if (file.size > 5 * 1024 * 1024) { setImageError("The image must be smaller than 5MB."); return; }

//     const reader = new FileReader();
//     reader.onload = () => setPreview(reader.result as string);
//     reader.readAsDataURL(file);

//     try {
//       setUploading(true);
//       const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//       const token = localStorage.getItem("token") || storedUser.token;
//       const formData = new FormData();
//       formData.append("image", file);

//       const res = await fetch(`${API_BASE}/upload/image`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//         body: formData,
//       });

//       const text = await res.text();
//       let data: any = {};
//       try { data = JSON.parse(text); }
//       catch {
//         setImageError(`Server error (${res.status})`);
//         setPreview(null); return;
//       }

//       if (data.success && data.url) {
//         handleChange("profileImage", data.url);
//         setPreview(data.url);
//         setImageSuccess(true);
//       } else {
//         setImageError(data.message || "Upload fail hua");
//         setPreview(null);
//         handleChange("profileImage", "");
//       }
//     } catch {
//       setImageError("Network error — The app is unable to connect to the server.");
//       setPreview(null);
//       handleChange("profileImage", "");
//     } finally { setUploading(false); }
//   };

//   const handleSkip = () => {
//     const isBrand = role === "BRAND";
//     const isLastStep = (isBrand && step === 3) || (!isBrand && step === 2);
//     if (isLastStep) { router.push(isBrand ? "/campaigns" : "/discovery"); }
//     else { setStep(step + 1); }
//   };

//   const nextStep = () => {
//     if (role !== "BRAND" && step === 2) { handleSubmit(); }
//     else { setStep(step + 1); }
//   };

//   const handleSubmit = async () => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     setSaving(true);
//     const cityValue = (form.city || "").toLowerCase().trim();
//     const payload: any = {
//       role: storedUser.role?.toLowerCase(),
//       name: form.name || "",
//       phone: String(form.phone || ""),
//       bio: form.bio || "",
//       location: cityValue,
//       followers: String(form.followers || "0"),
//       categories: form.categories ? [form.categories.toLowerCase()] : [],
//       platform: form.platformLink || "",
//       companyName: storedUser.role?.toLowerCase() === "brand" ? form.companyName || "" : "",
//       website: storedUser.role?.toLowerCase() === "brand" ? form.websiteLink || "" : "",
//     };
//     if (form.profileImage && form.profileImage.startsWith("http")) {
//       payload.profileImage = form.profileImage;
//     }
//     try {
//       const res = await fetch(`${API_BASE}/profile`, {
//         method: isEdit ? "PUT" : "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify(payload),
//       });
//       if (res.ok) {
//         const updatedUser = { ...storedUser, hasProfile: true };
//         localStorage.setItem("cb_user", JSON.stringify(updatedUser));
//         router.push(storedUser.role?.toLowerCase() === "brand" ? "/campaigns" : "/discovery");
//       } else {
//         const err = await res.json();
//         alert("Error: " + (err.message || "Something went wrong"));
//       }
//     } finally { setSaving(false); }
//   };

//   const totalSteps = role === "BRAND" ? 3 : 2;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

//         * { box-sizing: border-box; margin: 0; padding: 0; }

//         .pp-wrap {
//           font-family: 'DM Sans', sans-serif;
//           background: #f5f5f0;
//           min-height: 100vh;
//           display: flex;
//           flex-direction: column;
//           align-items: center;
//           justify-content: center;
//           padding: 40px 16px;
//         }

//         .pp-title {
//           font-family: 'DM Sans', sans-serif;
//           font-size: clamp(20px, 5vw, 26px);
//           font-weight: 600;
//           color: #111;
//           margin: 0 0 4px;
//           text-align: center;
//         }

//         .pp-sub {
//           color: #999;
//           font-size: 14px;
//           font-weight: 400;
//           margin: 0 0 24px;
//           text-align: center;
//         }

//         .pp-card {
//           background: #fff;
//           border-radius: 20px;
//           box-shadow: 0 2px 24px rgba(0,0,0,0.06);
//           border: 1px solid #ebebeb;
//           width: 100%;
//           max-width: 460px;
//           padding: 28px 24px;
//         }

//         @media(max-width: 480px) {
//           .pp-card { padding: 22px 16px; border-radius: 16px; }
//         }

//         .pp-step-title {
//           font-family: 'DM Sans', sans-serif;
//           font-size: 16px;
//           font-weight: 600;
//           color: #111;
//           margin: 0 0 22px;
//         }

//         .pp-field { display: flex; flex-direction: column; gap: 6px; }

//         .pp-label {
//           font-size: 11px;
//           font-weight: 500;
//           color: #aaa;
//           text-transform: uppercase;
//           letter-spacing: 0.06em;
//         }

//         .pp-input {
//           padding: 12px 14px;
//           border-radius: 10px;
//           border: 1.5px solid #ebebeb;
//           background: #fafafa;
//           font-size: 14px;
//           font-family: 'DM Sans', sans-serif;
//           font-weight: 400;
//           color: #111;
//           outline: none;
//           width: 100%;
//           transition: border-color 0.2s, box-shadow 0.2s;
//         }
//         .pp-input:focus {
//           border-color: #4f46e5;
//           box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
//           background: #fff;
//         }
//         .pp-input::placeholder { color: #c0c0c0; }
//         .pp-textarea { resize: none; }

//         .pp-select {
//           padding: 12px 40px 12px 14px;
//           border-radius: 10px;
//           border: 1.5px solid #ebebeb;
//           background: #fafafa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 14px center;
//           font-size: 14px;
//           font-family: 'DM Sans', sans-serif;
//           font-weight: 400;
//           color: #111;
//           outline: none;
//           width: 100%;
//           appearance: none;
//           cursor: pointer;
//           transition: border-color 0.2s;
//         }
//         .pp-select:focus {
//           border-color: #4f46e5;
//           box-shadow: 0 0 0 3px rgba(79,70,229,0.08);
//           background-color: #fff;
//         }

//         .pp-grid2 {
//           display: grid;
//           grid-template-columns: 1fr 1fr;
//           gap: 12px;
//         }
//         @media(max-width: 380px) {
//           .pp-grid2 { grid-template-columns: 1fr; }
//         }

//         .pp-avatar-wrap {
//           display: flex;
//           justify-content: center;
//           flex-direction: column;
//           align-items: center;
//           gap: 8px;
//           margin-bottom: 4px;
//         }

//         .pp-avatar {
//           width: 88px;
//           height: 88px;
//           border-radius: 50%;
//           border: 2px dashed #ddd;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           overflow: hidden;
//           cursor: pointer;
//           position: relative;
//           transition: border-color 0.2s;
//         }
//         .pp-avatar:hover { border-color: #4f46e5; }
//         .pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
//         .pp-avatar-placeholder { text-align: center; color: #ccc; }
//         .pp-avatar-placeholder div:first-child { font-size: 22px; line-height: 1; }
//         .pp-avatar-placeholder div:last-child { font-size: 10px; margin-top: 4px; font-weight: 400; }
//         .pp-avatar-hover {
//           position: absolute; inset: 0;
//           background: rgba(0,0,0,0.45);
//           display: flex; align-items: center; justify-content: center;
//           border-radius: 50%; opacity: 0; transition: opacity 0.2s;
//           color: #fff; font-size: 11px; font-weight: 500;
//         }
//         .pp-avatar:hover .pp-avatar-hover { opacity: 1; }

//         .pp-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
//         .pp-chip {
//           padding: 8px 14px;
//           border-radius: 100px;
//           border: 1.5px solid #ebebeb;
//           background: #fafafa;
//           font-size: 13px;
//           font-weight: 400;
//           cursor: pointer;
//           transition: all 0.15s;
//           color: #666;
//           font-family: 'DM Sans', sans-serif;
//         }
//         .pp-chip:hover { border-color: #4f46e5; color: #4f46e5; }
//         .pp-chip.sel { background: #4f46e5; border-color: #4f46e5; color: #fff; }

//         .pp-btns { display: flex; gap: 10px; margin-top: 8px; }

//         .pp-btn-main {
//           flex: 1; padding: 13px;
//           border-radius: 10px;
//           font-weight: 500;
//           font-size: 14px;
//           color: #fff;
//           background: #111;
//           border: none;
//           cursor: pointer;
//           font-family: 'DM Sans', sans-serif;
//           transition: all 0.2s;
//         }
//         .pp-btn-main:hover { background: #333; }
//         .pp-btn-main:disabled { opacity: 0.4; cursor: not-allowed; }

//         .pp-btn-skip {
//           flex: 1; padding: 13px;
//           border-radius: 10px;
//           font-size: 14px;
//           font-weight: 400;
//           color: #999;
//           background: #f4f4f4;
//           border: none;
//           cursor: pointer;
//           font-family: 'DM Sans', sans-serif;
//           transition: all 0.2s;
//         }
//         .pp-btn-skip:hover { color: #555; background: #eee; }

//         .pp-dots { display: flex; gap: 6px; margin-bottom: 20px; }
//         .pp-dot { height: 6px; border-radius: 3px; background: #e0e0e0; transition: all 0.3s; width: 6px; }
//         .pp-dot.active { background: #4f46e5; width: 20px; }
//         .pp-dot.done { background: #a5b4fc; }

//         .pp-footer { color: #ccc; font-size: 12px; margin-top: 14px; text-align: center; font-weight: 400; }

//         .pp-section-gap { display: flex; flex-direction: column; gap: 16px; }

//         .pp-error {
//           color: #ef4444; font-size: 12px; text-align: center;
//           background: #fef2f2; border: 1px solid #fecaca;
//           border-radius: 8px; padding: 8px 12px; font-weight: 400;
//         }
//         .pp-success { color: #16a34a; font-size: 12px; text-align: center; font-weight: 400; }
//         .pp-hint { font-size: 11px; color: #bbb; text-align: center; font-weight: 400; }
//       `}</style>

//       <div className="pp-wrap">
//         <div style={{ textAlign: "center" }}>
//           <h1 className="pp-title">{isEdit ? "Edit Profile" : "Set Up Profile"}</h1>
//           <p className="pp-sub">{isEdit ? "Update your information anytime" : "Complete your profile to get started"}</p>
//         </div>

//         <div className="pp-dots">
//           {Array.from({ length: totalSteps }).map((_, i) => (
//             <div key={i} className={`pp-dot ${i + 1 === step ? "active" : i + 1 < step ? "done" : ""}`} />
//           ))}
//         </div>

//         <div className="pp-card">

//           {/* ── STEP 1 ── */}
//           {step === 1 && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Basic Info</p>

//               <div className="pp-avatar-wrap">
//                 <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
//                   <div className="pp-avatar" style={{ opacity: uploading ? 0.7 : 1 }}>
//                     {preview
//                       ? <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                       : <div className="pp-avatar-placeholder"><div>📷</div><div>Add Photo</div></div>
//                     }
//                     <div className="pp-avatar-hover">{uploading ? "Uploading..." : "Change"}</div>
//                   </div>
//                   <input type="file" hidden accept="image/*" disabled={uploading}
//                     onChange={(e) => e.target.files && handleImage(e.target.files[0])} />
//                 </label>
//                 <span className="pp-hint">JPG, PNG · Max 5MB</span>
//                 {uploading && <span style={{ fontSize: "12px", color: "#4f46e5" }}>⏳ Uploading...</span>}
//                 {imageSuccess && !uploading && <span className="pp-success">✅ Image uploaded</span>}
//                 {imageError && <span className="pp-error">{imageError}</span>}
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Full Name</label>
//                 <input className="pp-input" placeholder="Your name"
//                   value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Bio</label>
//                 <textarea className="pp-input pp-textarea" placeholder="Tell brands about yourself..." rows={3}
//                   value={form.bio || ""} onChange={(e) => handleChange("bio", e.target.value)} />
//               </div>

//               <div className="pp-grid2">
//                 <div className="pp-field">
//                   <label className="pp-label">Phone</label>
//                   <input
//                     type="tel"
//                     inputMode="numeric"
//                     pattern="[0-9+]*"
//                     className="pp-input"
//                     placeholder="9876543210"
//                     value={form.phone || ""}
//                     maxLength={15}
//                     onChange={(e) => handleChange("phone", e.target.value.replace(/[^0-9+]/g, ""))}
//                   />
//                 </div>
//                 <div className="pp-field">
//                   <label className="pp-label">City</label>
//                   <input className="pp-input" placeholder="Mumbai"
//                     value={form.city || ""} onChange={(e) => handleChange("city", e.target.value)} />
//                 </div>
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={nextStep} disabled={uploading}>
//                   {uploading ? "Wait..." : "Continue →"}
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 2 — Creator ── */}
//           {step === 2 && role !== "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Creator Details</p>

//               <div className="pp-field">
//                 <label className="pp-label">Your Categories</label>
//                 <div className="pp-chips">
//                   {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
//                     <button key={cat}
//                       className={`pp-chip ${form.categories === cat.toLowerCase() ? "sel" : ""}`}
//                       onClick={() => handleChange("categories", cat.toLowerCase())}>
//                       {cat}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Followers Count</label>
//                 <select
//                   className="pp-select"
//                   value={form.followers || ""}
//                   onChange={(e) => handleChange("followers", e.target.value)}
//                 >
//                   <option value="">Select Followers</option>
//                   <option value="1000">1K – 5K</option>
//                   <option value="5000">5K – 10K</option>
//                   <option value="10000">10K – 20K</option>
//                   <option value="30000">20K – 50K</option>
//                   <option value="50000">50K – 75K</option>
//                   <option value="75000">75K – 99K</option>
//                   <option value="99000">99K+</option>
//                 </select>
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Instagram / Platform Link</label>
//                 <input className="pp-input" placeholder="https://instagram.com/yourhandle"
//                   value={form.platformLink || ""} onChange={(e) => handleChange("platformLink", e.target.value)} />
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
//                   {saving ? "Saving..." : "Save Profile ✓"}
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 2 — Brand ── */}
//           {step === 2 && role === "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Brand Details</p>

//               <div className="pp-field">
//                 <label className="pp-label">Company Name</label>
//                 <input className="pp-input" placeholder="Your company name"
//                   value={form.companyName || ""} onChange={(e) => handleChange("companyName", e.target.value)} />
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Industry</label>
//                 <div className="pp-chips">
//                   {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
//                     <button key={cat}
//                       className={`pp-chip ${form.categories === cat.toLowerCase() ? "sel" : ""}`}
//                       onClick={() => handleChange("categories", cat.toLowerCase())}>
//                       {cat}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={nextStep}>Continue →</button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 3 — Brand ── */}
//           {step === 3 && role === "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Online Presence</p>

//               <div className="pp-field">
//                 <label className="pp-label">Website</label>
//                 <input className="pp-input" placeholder="https://yourbrand.com"
//                   value={form.websiteLink || ""} onChange={(e) => handleChange("websiteLink", e.target.value)} />
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
//                   {saving ? "Saving..." : "Launch Profile 🚀"}
//                 </button>
//               </div>
//             </div>
//           )}

//         </div>

//         <p className="pp-footer">You can update this anytime from your profile settings</p>
//       </div>
//     </>
//   );
// }




// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function SetupProfile() {
//   const router = useRouter();

//   const [step, setStep] = useState(1);
//   const [role, setRole] = useState("");
//   const [form, setForm] = useState<any>({});
//   const [preview, setPreview] = useState<string | null>(null);
//   const [isEdit, setIsEdit] = useState(false);
//   const [saving, setSaving] = useState(false);
//   const [uploading, setUploading] = useState(false);
//   const [imageError, setImageError] = useState("");
//   const [imageSuccess, setImageSuccess] = useState(false);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     const storedUser = JSON.parse(user || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;

//     if (!user || !token) { router.push("/login"); return; }

//     setRole(storedUser.role?.toUpperCase());
//     setForm({ name: storedUser.name || "", email: storedUser.email || "" });

//     fetch(`${API_BASE}/profile/me`, {
//       headers: { Authorization: `Bearer ${token}` },
//     })
//       .then((res) => { if (!res.ok) throw new Error("fail"); return res.json(); })
//       .then((data) => {
//         if (data.success && data.profile) {
//           const existingCategory = Array.isArray(data.profile.categories)
//             ? data.profile.categories[0] || ""
//             : data.profile.categories || "";
//           setForm((prev: any) => ({
//             ...prev, ...data.profile,
//             name: data.profile.name || storedUser.name || "",
//             city: data.profile.city || data.profile.location || "",
//             categories: existingCategory,
//             platformLink: data.profile.platform || "",
//             websiteLink: data.profile.website || "",
//             followers: data.profile.followers || "",
//           }));
//           setPreview(data.profile.profileImage || null);
//           setIsEdit(true);
//         }
//       })
//       .catch((err) => console.warn("New user:", err.message));
//   }, []);

//   const handleChange = (field: string, value: string) => {
//     setForm((prev: any) => ({ ...prev, [field]: value }));
//   };

//   const handleImage = async (file: File) => {
//     setImageError(""); setImageSuccess(false);
//     if (file.size > 5 * 1024 * 1024) { setImageError("Image 5MB se choti honi chahiye"); return; }

//     // Local preview
//     const reader = new FileReader();
//     reader.onload = () => setPreview(reader.result as string);
//     reader.readAsDataURL(file);

//     try {
//       setUploading(true);
//       const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//       const token = localStorage.getItem("token") || storedUser.token;
//       const formData = new FormData();
//       formData.append("image", file);

//       const res = await fetch(`${API_BASE}/upload/image`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}` },
//         body: formData,
//       });

//       // Safe JSON parse — 500 pe HTML aata hai
//       const text = await res.text();
//       let data: any = {};
//       try { data = JSON.parse(text); }
//       catch {
//         setImageError(`Server error (${res.status}) — backend mein S3 credentials check karo`);
//         setPreview(null); return;
//       }

//       if (data.success && data.url) {
//         handleChange("profileImage", data.url);
//         setPreview(data.url);
//         setImageSuccess(true);
//       } else {
//         setImageError(data.message || "Upload fail hua");
//         setPreview(null);
//         handleChange("profileImage", "");
//       }
//     } catch {
//       setImageError("Network error — server se connect nahi ho raha");
//       setPreview(null);
//       handleChange("profileImage", "");
//     } finally { setUploading(false); }
//   };

//   const handleSkip = () => {
//     const isBrand = role === "BRAND";
//     const isLastStep = (isBrand && step === 3) || (!isBrand && step === 2);
//     if (isLastStep) { router.push(isBrand ? "/campaigns" : "/discovery"); }
//     else { setStep(step + 1); }
//   };

//   const nextStep = () => {
//     if (role !== "BRAND" && step === 2) { handleSubmit(); }
//     else { setStep(step + 1); }
//   };

//   const handleSubmit = async () => {
//     const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
//     const token = localStorage.getItem("token") || storedUser.token;
//     setSaving(true);
//     const cityValue = (form.city || "").toLowerCase().trim();
//     const payload: any = {
//       role: storedUser.role?.toLowerCase(),
//       name: form.name || "",
//       phone: String(form.phone || ""),
//       bio: form.bio || "",
//       location: cityValue,
//       followers: String(form.followers || "0"),
//       categories: form.categories ? [form.categories.toLowerCase()] : [],
//       platform: form.platformLink || "",
//       companyName: storedUser.role?.toLowerCase() === "brand" ? form.companyName || "" : "",
//       website: storedUser.role?.toLowerCase() === "brand" ? form.websiteLink || "" : "",
//     };
//     // ✅ Sirf S3 URL — no base64
//     if (form.profileImage && form.profileImage.startsWith("http")) {
//       payload.profileImage = form.profileImage;
//     }
//     try {
//       const res = await fetch(`${API_BASE}/profile`, {
//         method: isEdit ? "PUT" : "POST",
//         headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
//         body: JSON.stringify(payload),
//       });
//       if (res.ok) {
//         const updatedUser = { ...storedUser, hasProfile: true };
//         localStorage.setItem("cb_user", JSON.stringify(updatedUser));
//         router.push(storedUser.role?.toLowerCase() === "brand" ? "/campaigns" : "/discovery");
//       } else {
//         const err = await res.json();
//         alert("Error: " + (err.message || "Something went wrong"));
//       }
//     } finally { setSaving(false); }
//   };

//   const totalSteps = role === "BRAND" ? 3 : 2;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&display=swap');
//         .pp-wrap { font-family: 'DM Sans', sans-serif; background: #f5f5f0; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 16px; }
//         .pp-title { font-family: 'Syne', sans-serif; font-size: 28px; font-weight: 800; color: #111; margin: 0 0 4px; }
//         .pp-sub { color: #999; font-size: 14px; margin: 0 0 28px; }
//         .pp-card { background: #fff; border-radius: 24px; box-shadow: 0 2px 30px rgba(0,0,0,0.06); border: 1px solid #ebebeb; width: 100%; max-width: 480px; padding: 36px; }
//         .pp-step-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 700; color: #111; margin: 0 0 24px; }
//         .pp-field { display: flex; flex-direction: column; gap: 6px; }
//         .pp-label { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.06em; }
//         .pp-input { padding: 13px 16px; border-radius: 12px; border: 1.5px solid #ebebeb; background: #fafafa; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #111; outline: none; width: 100%; box-sizing: border-box; transition: border-color 0.2s, box-shadow 0.2s; }
//         .pp-input:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(0,0,0,0.05); background: #fff; }
//         .pp-input::placeholder { color: #c0c0c0; }
//         .pp-textarea { resize: none; }
//         .pp-select { padding: 13px 16px; border-radius: 12px; border: 1.5px solid #ebebeb; background: #fafafa url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") no-repeat right 14px center; font-size: 14px; font-family: 'DM Sans', sans-serif; color: #111; outline: none; width: 100%; box-sizing: border-box; appearance: none; cursor: pointer; padding-right: 40px; transition: border-color 0.2s, box-shadow 0.2s; }
//         .pp-select:focus { border-color: #111; box-shadow: 0 0 0 3px rgba(0,0,0,0.05); background-color: #fff; }
//         .pp-select option[value=""] { color: #c0c0c0; }
//         .pp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
//         .pp-avatar-wrap { display: flex; justify-content: center; margin-bottom: 8px; }
//         .pp-avatar { width: 96px; height: 96px; border-radius: 50%; border: 2px dashed #ddd; display: flex; align-items: center; justify-content: center; overflow: hidden; cursor: pointer; position: relative; transition: border-color 0.2s; }
//         .pp-avatar:hover { border-color: #111; }
//         .pp-avatar img { width: 100%; height: 100%; object-fit: cover; }
//         .pp-avatar-placeholder { text-align: center; color: #ccc; }
//         .pp-avatar-placeholder div:first-child { font-size: 24px; line-height: 1; }
//         .pp-avatar-placeholder div:last-child { font-size: 10px; margin-top: 4px; }
//         .pp-avatar-hover { position: absolute; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; border-radius: 50%; opacity: 0; transition: opacity 0.2s; color: #fff; font-size: 11px; }
//         .pp-avatar:hover .pp-avatar-hover { opacity: 1; }
//         .pp-chips { display: flex; flex-wrap: wrap; gap: 8px; }
//         .pp-chip { padding: 9px 16px; border-radius: 100px; border: 1.5px solid #ebebeb; background: #fafafa; font-size: 13px; cursor: pointer; transition: all 0.15s; color: #666; font-family: 'DM Sans', sans-serif; }
//         .pp-chip:hover { border-color: #111; color: #111; }
//         .pp-chip.sel { background: #111; border-color: #111; color: #fff; }
//         .pp-btns { display: flex; gap: 10px; margin-top: 8px; }
//         .pp-btn-main { flex: 1; padding: 14px; border-radius: 12px; font-weight: 700; font-size: 14px; color: #fff; background: #111; border: none; cursor: pointer; font-family: 'Syne', sans-serif; letter-spacing: 0.02em; transition: all 0.2s; }
//         .pp-btn-main:hover { background: #333; }
//         .pp-btn-main:disabled { opacity: 0.4; cursor: not-allowed; }
//         .pp-btn-skip { flex: 1; padding: 14px; border-radius: 12px; font-size: 14px; color: #999; background: #f4f4f4; border: none; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: all 0.2s; }
//         .pp-btn-skip:hover { color: #555; background: #eee; }
//         .pp-dots { display: flex; gap: 6px; margin-bottom: 24px; }
//         .pp-dot { height: 6px; border-radius: 3px; background: #e0e0e0; transition: all 0.3s; width: 6px; }
//         .pp-dot.active { background: #111; width: 20px; }
//         .pp-dot.done { background: #6366f1; }
//         .pp-footer { color: #ccc; font-size: 12px; margin-top: 16px; text-align: center; }
//         .pp-section-gap { display: flex; flex-direction: column; gap: 18px; }
//         .pp-error { color: #ef4444; font-size: 12px; text-align: center; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 8px 12px; }
//         .pp-success { color: #16a34a; font-size: 12px; text-align: center; }
//         .pp-hint { font-size: 11px; color: #bbb; text-align: center; }
//       `}</style>

//       <div className="pp-wrap">
//         <div style={{ textAlign: "center" }}>
//           <h1 className="pp-title">{isEdit ? "Edit Profile" : "Set Up Profile"}</h1>
//           <p className="pp-sub">{isEdit ? "Update your information anytime" : "Complete your profile to get started"}</p>
//         </div>

//         <div className="pp-dots">
//           {Array.from({ length: totalSteps }).map((_, i) => (
//             <div key={i} className={`pp-dot ${i + 1 === step ? "active" : i + 1 < step ? "done" : ""}`} />
//           ))}
//         </div>

//         <div className="pp-card">

//           {/* ── STEP 1 ── */}
//           {step === 1 && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Basic Info</p>

//               <div className="pp-avatar-wrap" style={{ flexDirection: "column", alignItems: "center", gap: "8px" }}>
//                 <label style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
//                   <div className="pp-avatar" style={{ opacity: uploading ? 0.7 : 1 }}>
//                     {preview
//                       ? /* eslint-disable-next-line @next/next/no-img-element */
//                         <img src={preview} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
//                       : <div className="pp-avatar-placeholder"><div>📷</div><div>Add Photo</div></div>
//                     }
//                     <div className="pp-avatar-hover">{uploading ? "Uploading..." : "Change"}</div>
//                   </div>
//                   <input type="file" hidden accept="image/*" disabled={uploading}
//                     onChange={(e) => e.target.files && handleImage(e.target.files[0])} />
//                 </label>
//                 <span className="pp-hint">JPG, PNG · Max 5MB</span>
//                 {uploading && <span style={{ fontSize: "12px", color: "#6366f1" }}>⏳ Upload ho raha hai...</span>}
//                 {imageSuccess && !uploading && <span className="pp-success">✅ Image upload ho gayi</span>}
//                 {imageError && <span className="pp-error">{imageError}</span>}
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Full Name</label>
//                 <input className="pp-input" placeholder="Your name"
//                   value={form.name || ""} onChange={(e) => handleChange("name", e.target.value)} />
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Bio</label>
//                 <textarea className="pp-input pp-textarea" placeholder="Tell brands about yourself..." rows={3}
//                   value={form.bio || ""} onChange={(e) => handleChange("bio", e.target.value)} />
//               </div>

//               <div className="pp-grid2">
//                 {/* <div className="pp-field">
//                   <label className="pp-label">Phone</label>
//                   <input className="pp-input" placeholder="9876543210"
//                     value={form.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} />
//                 </div> */}
//                 <div className="pp-grid2">
//   <div className="pp-field">
//     <label className="pp-label">Phone</label>
//     <input
//       type="tel"
//       inputMode="numeric"
//       pattern="[0-9+]*"
//       className="pp-input"
//       placeholder="9876543210"
//       value={form.phone || ""}
//       maxLength={15}
//       onChange={(e) =>
//         handleChange(
//           "phone",
//           e.target.value.replace(/[^0-9+]/g, "")
//         )
//       }
//     />
//   </div>
// </div>
//                 <div className="pp-field">
//                   <label className="pp-label">City</label>
//                   <input className="pp-input" placeholder="Mumbai"
//                     value={form.city || ""} onChange={(e) => handleChange("city", e.target.value)} />
//                 </div>
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={nextStep} disabled={uploading}>
//                   {uploading ? "Wait..." : "Continue →"}
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 2 — Creator ── */}
//           {step === 2 && role !== "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Creator Details</p>

//               <div className="pp-field">
//                 <label className="pp-label">Your Niche</label>
//                 <div className="pp-chips" style={{ marginTop: "6px" }}>
//                   {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
//                     <button key={cat}
//                       className={`pp-chip ${form.categories === cat.toLowerCase() ? "sel" : ""}`}
//                       onClick={() => handleChange("categories", cat.toLowerCase())}>
//                       {cat}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               {/* ✅ FOLLOWERS — DROPDOWN SELECT */}
//               <div className="pp-field">
//                 <label className="pp-label">Followers Count</label>
//                 <select
//                   className="pp-select"
//                   value={form.followers || ""}
//                   onChange={(e) => handleChange("followers", e.target.value)}
//                 >
//                   <option value="">Select Followers</option>
//                   <option value="1000">1K – 5K</option>
//                   <option value="5000">5K – 10K</option>
//                   <option value="10000">10K – 20K</option>
//                   <option value="30000">20K – 50K</option>
//                   <option value="50000">50K – 75K</option>
//                   <option value="75000">75K – 99K</option>
//                   <option value="99000">99K+</option>
//                 </select>
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Instagram / Platform Link</label>
//                 <input className="pp-input" placeholder="https://instagram.com/yourhandle"
//                   value={form.platformLink || ""} onChange={(e) => handleChange("platformLink", e.target.value)} />
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
//                   {saving ? "Saving..." : "Save Profile ✓"}
//                 </button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 2 — Brand ── */}
//           {step === 2 && role === "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Brand Details</p>

//               <div className="pp-field">
//                 <label className="pp-label">Company Name</label>
//                 <input className="pp-input" placeholder="Your company name"
//                   value={form.companyName || ""} onChange={(e) => handleChange("companyName", e.target.value)} />
//               </div>

//               <div className="pp-field">
//                 <label className="pp-label">Industry</label>
//                 <div className="pp-chips" style={{ marginTop: "6px" }}>
//                   {["Fashion", "Beauty", "Fitness", "Food", "Travel", "Tech"].map((cat) => (
//                     <button key={cat}
//                       className={`pp-chip ${form.categories === cat.toLowerCase() ? "sel" : ""}`}
//                       onClick={() => handleChange("categories", cat.toLowerCase())}>
//                       {cat}
//                     </button>
//                   ))}
//                 </div>
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={nextStep}>Continue →</button>
//               </div>
//             </div>
//           )}

//           {/* ── STEP 3 — Brand ── */}
//           {step === 3 && role === "BRAND" && (
//             <div className="pp-section-gap">
//               <p className="pp-step-title">Online Presence</p>

//               <div className="pp-field">
//                 <label className="pp-label">Website</label>
//                 <input className="pp-input" placeholder="https://yourbrand.com"
//                   value={form.websiteLink || ""} onChange={(e) => handleChange("websiteLink", e.target.value)} />
//               </div>

//               <div className="pp-btns">
//                 <button className="pp-btn-skip" onClick={handleSkip}>Skip</button>
//                 <button className="pp-btn-main" onClick={handleSubmit} disabled={saving}>
//                   {saving ? "Saving..." : "Launch Profile 🚀"}
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>

//         <p className="pp-footer">You can update this anytime from your profile settings</p>
//       </div>
//     </>
//   );
// }
