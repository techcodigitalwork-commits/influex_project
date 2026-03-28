"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const API_BASE = "https://api.collabzy.in/api";

type MediaFile = {
  id: string;
  file: File;
  preview: string;
  type: "reel" | "post";
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
  progress: number;
};

const MAX_REELS = 2;
const MAX_POSTS = 3;
const MAX_REEL_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_POST_SIZE_BYTES = 10  * 1024 * 1024;

const getToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") ||
    JSON.parse(localStorage.getItem("cb_user") || "{}").token || "";
};

const getUserId = () => {
  if (typeof window === "undefined") return "";
  const u = JSON.parse(localStorage.getItem("cb_user") || "{}");
  return u._id || u.id || "";
};

const validateFile = (file: File, type: "reel" | "post"): string | null => {
  const maxSize  = type === "reel" ? MAX_REEL_SIZE_BYTES : MAX_POST_SIZE_BYTES;
  const maxLabel = type === "reel" ? "100MB" : "10MB";
  if (file.size > maxSize) return `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${maxLabel}.`;
  if (type === "reel" && !file.type.startsWith("video/")) return "Wrong format. Use MP4 or MOV.";
  return null;
};

export default function InfluencerPortfolio() {
  const [reels, setReels]           = useState<MediaFile[]>([]);
  const [posts, setPosts]           = useState<MediaFile[]>([]);
  // ✅ existing counts from DB
  const [existingReels, setExistingReels] = useState(0);
  const [existingPosts, setExistingPosts] = useState(0);
  const [loadingExisting, setLoadingExisting] = useState(true);

  const reelInputRef = useRef<HTMLInputElement>(null);
  const postInputRef = useRef<HTMLInputElement>(null);

  // ✅ fetch existing posts from DB on mount
  useEffect(() => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) { setLoadingExisting(false); return; }

    fetch(`${API_BASE}/posts/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then((data: any) => {
        const list = data.data || data.posts || [];
        let reelCount = 0;
        let postCount = 0;
        list.forEach((p: any) => {
          if (Array.isArray(p.urls)   && p.urls.length   > 0) reelCount++;
          if (Array.isArray(p.images) && p.images.length > 0) postCount++;
        });
        setExistingReels(reelCount);
        setExistingPosts(postCount);
      })
      .catch(() => {})
      .finally(() => setLoadingExisting(false));
  }, []);

  // ✅ remaining slots = DB limit - already in DB - currently being uploaded this session
  const reelSlotsRemaining = Math.max(0, MAX_REELS - existingReels - reels.length);
  const postSlotsRemaining = Math.max(0, MAX_POSTS - existingPosts - posts.length);

  const uploadFile = useCallback(
    async (
      mediaFile: MediaFile,
      setter: React.Dispatch<React.SetStateAction<MediaFile[]>>,
      type: "reel" | "post"
    ) => {
      const err = validateFile(mediaFile.file, type);
      if (err) {
        setter(prev => prev.map(f => f.id === mediaFile.id ? { ...f, uploading: false, error: err } : f));
        return;
      }

      setter(prev => prev.map(f => f.id === mediaFile.id ? { ...f, uploading: true, progress: 0, error: undefined } : f));

      const formData = new FormData();
      const isReel = type === "reel";
      formData.append(isReel ? "videos" : "image", mediaFile.file);

      try {
        const token = getToken();
        if (!token) throw new Error("Not logged in. Please login again.");

        const endpoint = isReel ? `${API_BASE}/create-post` : `${API_BASE}/upload/image`;

        const progressInterval = setInterval(() => {
          setter(prev => prev.map(f =>
            f.id === mediaFile.id && f.progress < 85
              ? { ...f, progress: f.progress + 8 }
              : f
          ));
        }, 400);

        let res: Response;
        try {
          res = await fetch(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
        } catch {
          clearInterval(progressInterval);
          throw new Error("Network error. Check your connection.");
        }

        clearInterval(progressInterval);

        let data: any = {};
        try { data = await res.json(); } catch { data = { success: false, message: `Server error (${res.status})` }; }

        if (!res.ok || !data.success) throw new Error(data.message || `Upload failed (${res.status})`);

        const url = isReel
          ? data.urls?.[0] || data.url || data.post?.videoUrl || ""
          : data.url || "";

        if (!isReel && url) {
          const postData = new FormData();
          postData.append("images", url);
          try {
            await fetch(`${API_BASE}/create-post`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              body: postData,
            });
            // ✅ update existing count after successful DB save
            setExistingPosts(prev => prev + 1);
          } catch {}
        }

        if (isReel) {
          // ✅ update existing reel count after upload
          setExistingReels(prev => prev + 1);
        }

        setter(prev => prev.map(f =>
          f.id === mediaFile.id
            ? { ...f, uploading: false, uploaded: true, url, progress: 100, error: undefined }
            : f
        ));
      } catch (err: any) {
        setter(prev => prev.map(f =>
          f.id === mediaFile.id
            ? { ...f, uploading: false, uploaded: false, error: err.message, progress: 0 }
            : f
        ));
      }
    },
    []
  );

  const handleReelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: MediaFile[] = files.slice(0, reelSlotsRemaining).map(file => ({
      id: `reel-${Date.now()}-${Math.random()}`,
      file, preview: URL.createObjectURL(file),
      type: "reel", uploading: false, uploaded: false, progress: 0,
    }));
    setReels(prev => [...prev, ...newItems]);
    newItems.forEach(r => uploadFile(r, setReels, "reel"));
    e.target.value = "";
  };

  const handlePostSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newItems: MediaFile[] = files.slice(0, postSlotsRemaining).map(file => ({
      id: `post-${Date.now()}-${Math.random()}`,
      file, preview: URL.createObjectURL(file),
      type: "post", uploading: false, uploaded: false, progress: 0,
    }));
    setPosts(prev => [...prev, ...newItems]);
    newItems.forEach(p => uploadFile(p, setPosts, "post"));
    e.target.value = "";
  };

  const retryUpload = (media: MediaFile, type: "reel" | "post") => {
    const setter = type === "reel" ? setReels : setPosts;
    setter(prev => prev.map(f => f.id === media.id ? { ...f, error: undefined, progress: 0 } : f));
    uploadFile(media, setter, type);
  };

  const removeReel = (id: string) => setReels(p => p.filter(f => f.id !== id));
  const removePost = (id: string) => setPosts(p => p.filter(f => f.id !== id));

  const isUploading = [...reels, ...posts].some(f => f.uploading);

  // total shown in stats = DB existing + this session
  const totalReels = existingReels + reels.filter(r => r.uploaded).length;
  const totalPosts = existingPosts + posts.filter(p => p.uploaded).length;

  if (loadingExisting) return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#7C3AED", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={s.titleArea}>
        <button style={s.backBtn} onClick={() => window.history.back()}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <h1 style={s.title}>My Portfolio</h1>
        <p style={s.subtitle}>Showcase your best work to brands</p>
      </div>

      {/* ✅ stats show DB-accurate counts */}
      <div style={s.statsBar}>
        <StatPill color="#7C3AED" label={`Reels: ${totalReels}/${MAX_REELS}`} />
        <StatPill color="#F59E0B" label={`Posts: ${totalPosts}/${MAX_POSTS}`} />
        <StatPill color="#22C55E" label="Reels: Max 100MB" />
        <StatPill color="#3B82F6" label="Posts: Max 10MB" />
      </div>

      {/* REELS */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitleRow}>
            <span style={s.emoji}>🎬</span>
            <span style={s.sectionLabel}>REELS</span>
          </div>
          <span style={s.countText}>{totalReels}/{MAX_REELS} added</span>
        </div>
        <input ref={reelInputRef} type="file" accept="video/mp4,video/quicktime,video/*" multiple style={{ display: "none" }} onChange={handleReelSelect} />
        <div style={s.grid}>
          {reels.map(r => (
            <MediaCard key={r.id} media={r} onRemove={removeReel} onRetry={() => retryUpload(r, "reel")} />
          ))}
          {/* ✅ Add Reel only if slots remaining in DB */}
          {reelSlotsRemaining > 0 && (
            <AddCard label="Add Reel" hint="MP4, MOV • Max 100MB" emoji="🎬" onClick={() => reelInputRef.current?.click()} />
          )}
          {reelSlotsRemaining === 0 && reels.length === 0 && (
            <div style={s.limitReached}>✅ Reel limit reached ({MAX_REELS}/{MAX_REELS})</div>
          )}
        </div>
      </div>

      {/* POSTS */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitleRow}>
            <span style={s.emoji}>📷</span>
            <span style={s.sectionLabel}>POSTS</span>
          </div>
          <span style={s.countText}>{totalPosts}/{MAX_POSTS} added</span>
        </div>
        <input ref={postInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePostSelect} />
        <div style={s.grid}>
          {posts.map(p => (
            <MediaCard key={p.id} media={p} onRemove={removePost} onRetry={() => retryUpload(p, "post")} />
          ))}
          {/* ✅ Add Post only if slots remaining in DB */}
          {postSlotsRemaining > 0 && (
            <AddCard label="Add Post" hint="JPG, PNG, WebP • Max 10MB" emoji="📷" onClick={() => postInputRef.current?.click()} />
          )}
          {postSlotsRemaining === 0 && posts.length === 0 && (
            <div style={s.limitReached}>✅ Post limit reached ({MAX_POSTS}/{MAX_POSTS})</div>
          )}
        </div>
      </div>

      <div style={s.footerRow}>
        <button
          style={{ ...s.saveBtn, opacity: isUploading ? 0.65 : 1 }}
          disabled={isUploading}
          onClick={() => window.history.back()}
        >
          {isUploading ? "Uploading…" : "Done ✓"}
        </button>
      </div>
    </div>
  );
}

function StatPill({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
      {label}
    </span>
  );
}

function AddCard({ label, hint, emoji, onClick }: { label: string; hint: string; emoji: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ border: `2px dashed ${hover ? "#7C3AED" : "#D1D5DB"}`, borderRadius: 14, aspectRatio: "4/5", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 8, background: hover ? "#F5F3FF" : "#F9FAFB", transition: "all 0.15s", padding: "16px 12px" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", background: hover ? "#EDE9FE" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{emoji}</div>
      <p style={{ fontSize: 13, fontWeight: 600, color: hover ? "#7C3AED" : "#374151", margin: 0 }}>{label}</p>
      <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, textAlign: "center", lineHeight: 1.4 }}>{hint}</p>
    </div>
  );
}

function MediaCard({ media, onRemove, onRetry }: { media: MediaFile; onRemove: (id: string) => void; onRetry: () => void; }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 14, overflow: "hidden", background: "#F3F4F6", border: media.error ? "2px solid #FCA5A5" : media.uploaded ? "2px solid #86EFAC" : "1px solid #E5E7EB" }}>
        {media.type === "reel"
          ? <video src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop playsInline onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()} onMouseLeave={e => (e.currentTarget as HTMLVideoElement).pause()} />
          : <img src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        }
        {media.uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{media.progress}%</span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
              <div style={{ height: "100%", width: `${media.progress}%`, background: "linear-gradient(90deg,#7C3AED,#EC4899)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}
        {media.uploaded && !media.error && (
          <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        )}
        {media.error && !media.uploading && (
          <div title={`${media.error} — Click to retry`} onClick={e => { e.stopPropagation(); onRetry(); }}
            style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ↺
          </div>
        )}
        <button onClick={() => onRemove(media.id)} style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 500, color: "#374151", margin: "0 0 1px" }}>
          {media.file.name.length > 18 ? media.file.name.slice(0, 16) + "…" : media.file.name}
        </p>
        <p title={media.error} style={{ fontSize: 11, margin: 0, fontWeight: 500, color: media.uploaded && !media.error ? "#16A34A" : media.error ? "#DC2626" : "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
          {media.uploading ? `Uploading ${media.progress}%` : media.uploaded && !media.error ? "Uploaded ✓" : media.error ? media.error : "Pending…"}
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#ffffff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: "#111827", padding: "28px 20px 80px", maxWidth: 760, margin: "0 auto" },
  titleArea: { marginBottom: 20 },
  backBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6B7280", margin: 0 },
  statsBar: { display: "flex", gap: 20, padding: "11px 18px", background: "#F9FAFB", borderRadius: 12, marginBottom: 16, border: "1px solid #E5E7EB", flexWrap: "wrap" },
  card: { background: "#fff", borderRadius: 16, padding: "22px", marginBottom: 14, border: "1px solid #E5E7EB" },
  cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  cardTitleRow: { display: "flex", alignItems: "center", gap: 7 },
  emoji: { fontSize: 17 },
  sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", color: "#374151" },
  countText: { fontSize: 12, color: "#9CA3AF", fontWeight: 500 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 14 },
  footerRow: { display: "flex", justifyContent: "flex-end", marginTop: 20 },
  saveBtn: { background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.1px" },
  limitReached: { display: "flex", alignItems: "center", justifyContent: "center", aspectRatio: "4/5", borderRadius: 14, background: "#F0FDF4", border: "1.5px solid #BBF7D0", fontSize: 12, fontWeight: 600, color: "#16A34A", textAlign: "center", padding: 12 },
};
// "use client";

// import { useState, useRef, useCallback } from "react";

// const API_BASE = "https://api.collabzy.in/api";

// type MediaFile = {
//   id: string;
//   file: File;
//   preview: string;
//   type: "reel" | "post";
//   uploading: boolean;
//   uploaded: boolean;
//   url?: string;
//   error?: string;
//   progress: number;
// };

// const MAX_REELS = 2;
// const MAX_POSTS = 3;
// const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// const getToken = () =>
//   typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

// const validateFile = (file: File, type: "reel" | "post"): string | null => {
//   if (file.size > MAX_FILE_SIZE_BYTES) {
//     return `Too large (${(file.size / 1024 / 1024).toFixed(50)}MB). Max 10MB.`;
//   }
//   if (type === "reel" && !file.type.startsWith("video/")) {
//     return `Wrong format. Use MP4 or MOV.`;
//   }
//   return null;
// };

// export default function InfluencerPortfolio() {
//   const [reels, setReels] = useState<MediaFile[]>([]);
//   const [posts, setPosts] = useState<MediaFile[]>([]);

//   const reelInputRef = useRef<HTMLInputElement>(null);
//   const postInputRef = useRef<HTMLInputElement>(null);

//   const uploadFile = useCallback(
//     async (
//       mediaFile: MediaFile,
//       setter: React.Dispatch<React.SetStateAction<MediaFile[]>>,
//       type: "reel" | "post"
//     ) => {
//       // Validate before API call
//       const err = validateFile(mediaFile.file, type);
//       if (err) {
//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id ? { ...f, uploading: false, error: err } : f
//           )
//         );
//         return;
//       }

//       setter((prev) =>
//         prev.map((f) =>
//           f.id === mediaFile.id ? { ...f, uploading: true, progress: 0 } : f
//         )
//       );

//       const formData = new FormData();
//       const isReel = type === "reel";

//       if (isReel) {
//         // ✅ /create-post endpoint for videos
//         formData.append("videos", mediaFile.file);
//       } else {
//         // ✅ /upload/image endpoint for images
//         formData.append("image", mediaFile.file);
//       }

//       try {
//         const endpoint = isReel
//           ? `${API_BASE}/create-post`   // video
//           : `${API_BASE}/upload/image`; // image

//         const progressInterval = setInterval(() => {
//           setter((prev) =>
//             prev.map((f) =>
//               f.id === mediaFile.id && f.progress < 85
//                 ? { ...f, progress: f.progress + 12 }
//                 : f
//             )
//           );
//         }, 300);

//         const res = await fetch(endpoint, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${getToken()}` },
//           body: formData,
//         });

//         clearInterval(progressInterval);

//         let data: any = {};
//         try { data = await res.json(); } catch { data = { success: false, message: `Server error (${res.status})` }; }

//         if (!res.ok || !data.success) throw new Error(data.message || `Upload failed (${res.status})`);

//         // Reel: urls array, Post: url string
//         const url = isReel
//           ? data.urls?.[0] || data.url || data.post?.videoUrl || ""
//           : data.url || "";

//           // ✅ IMPORTANT: image ko DB me save karna
// if (!isReel && url) {
//   const postData = new FormData();
//   postData.append("images", url);

//   await fetch(`${API_BASE}/create-post`, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${getToken()}`,
//     },
//     body: postData,
//   });
// }

//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id
//               ? { ...f, uploading: false, uploaded: true, url, progress: 100 }
//               : f
//           )
//         );
//       } catch (err: any) {
//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id
//               ? { ...f, uploading: false, error: err.message, progress: 0 }
//               : f
//           )
//         );
//       }
//     },
//     []
//   );

//   const handleReelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_REELS - reels.length;
//     const newItems: MediaFile[] = files.slice(0, remaining).map((file) => ({
//       id: `reel-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "reel",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));
//     // ✅ setter ke BAHAR uploadFile — double API call nahi hoga
//     setReels((prev) => [...prev, ...newItems]);
//     newItems.forEach((r) => uploadFile(r, setReels, "reel"));
//     e.target.value = "";
//   };

//   const handlePostSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_POSTS - posts.length;
//     const newItems: MediaFile[] = files.slice(0, remaining).map((file) => ({
//       id: `post-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "post",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));
//     setPosts((prev) => [...prev, ...newItems]);
//     newItems.forEach((p) => uploadFile(p, setPosts, "post"));
//     e.target.value = "";
//   };

//   const removeReel = (id: string) => setReels((p) => p.filter((f) => f.id !== id));
//   const removePost = (id: string) => setPosts((p) => p.filter((f) => f.id !== id));

//   const isUploading = [...reels, ...posts].some((f) => f.uploading);

//   return (
//     <div style={s.page}>
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

//       <div style={s.titleArea}>
//         <button style={s.backBtn} onClick={() => window.history.back()}>
//           <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//             <path d="M10 12L6 8l4-4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//           </svg>
//           Back
//         </button>
//         <h1 style={s.title}>My Portfolio</h1>
//         <p style={s.subtitle}>Showcase your best work to brands</p>
//       </div>

//       <div style={s.statsBar}>
//         <StatPill color="#7C3AED" label={`Reels: ${reels.length}/${MAX_REELS}`} />
//         <StatPill color="#F59E0B" label={`Posts: ${posts.length}/${MAX_POSTS}`} />
//         <StatPill color="#22C55E" label="Max 10MB per file" />
//       </div>

//       {/* REELS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>🎬</span>
//             <span style={s.sectionLabel}>REELS</span>
//           </div>
//           <span style={s.countText}>{reels.length}/{MAX_REELS} added</span>
//         </div>
//         <input ref={reelInputRef} type="file" accept="video/mp4,video/quicktime,video/*" multiple style={{ display: "none" }} onChange={handleReelSelect} />
//         <div style={s.grid}>
//           {reels.map((r) => <MediaCard key={r.id} media={r} onRemove={removeReel} />)}
//           {reels.length < MAX_REELS && (
//             <AddCard label="Add Reel" hint="MP4, MOV • Max 20MB" emoji="🎬" onClick={() => reelInputRef.current?.click()} />
//           )}
//         </div>
//       </div>

//       {/* POSTS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>📷</span>
//             <span style={s.sectionLabel}>POSTS</span>
//           </div>
//           <span style={s.countText}>{posts.length}/{MAX_POSTS} added</span>
//         </div>
//         <input ref={postInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePostSelect} />
//         <div style={s.grid}>
//           {posts.map((p) => <MediaCard key={p.id} media={p} onRemove={removePost} />)}
//           {posts.length < MAX_POSTS && (
//             <AddCard label="Add Post" hint="JPG, PNG, WebP • Max 10MB" emoji="📷" onClick={() => postInputRef.current?.click()} />
//           )}
//         </div>
//       </div>

//       <div style={s.footerRow}>
//         <button
//           style={{ ...s.saveBtn, opacity: isUploading ? 0.65 : 1 }}
//           disabled={isUploading}
//           onClick={() => alert("Portfolio saved! 🎉")}
//         >
//           {isUploading ? "Uploading…" : "Save Portfolio"}
//         </button>
//       </div>
//     </div>
//   );
// }

// function StatPill({ color, label }: { color: string; label: string }) {
//   return (
//     <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
//       <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
//       {label}
//     </span>
//   );
// }

// function AddCard({ label, hint, emoji, onClick }: { label: string; hint: string; emoji: string; onClick: () => void }) {
//   const [hover, setHover] = useState(false);
//   return (
//     <div
//       onClick={onClick}
//       onMouseEnter={() => setHover(true)}
//       onMouseLeave={() => setHover(false)}
//       style={{
//         border: `2px dashed ${hover ? "#7C3AED" : "#D1D5DB"}`,
//         borderRadius: 14, aspectRatio: "4/5",
//         display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
//         cursor: "pointer", gap: 8,
//         background: hover ? "#F5F3FF" : "#F9FAFB",
//         transition: "all 0.15s", padding: "16px 12px",
//       }}
//     >
//       <div style={{ width: 52, height: 52, borderRadius: "50%", background: hover ? "#EDE9FE" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
//         {emoji}
//       </div>
//       <p style={{ fontSize: 13, fontWeight: 600, color: hover ? "#7C3AED" : "#374151", margin: 0 }}>{label}</p>
//       <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, textAlign: "center", lineHeight: 1.4 }}>{hint}</p>
//     </div>
//   );
// }

// function MediaCard({ media, onRemove }: { media: MediaFile; onRemove: (id: string) => void }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <div style={{ position: "relative", aspectRatio: "4/5", borderRadius: 14, overflow: "hidden", background: "#F3F4F6", border: "1px solid #E5E7EB" }}>
//         {media.type === "reel" ? (
//           <video src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted loop playsInline
//             onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//             onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()} />
//         ) : (
//           <img src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
//         )}

//         {media.uploading && (
//           <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
//             <div style={{ width: 46, height: 46, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
//               <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{media.progress}%</span>
//             </div>
//             <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
//               <div style={{ height: "100%", width: `${media.progress}%`, background: "linear-gradient(90deg,#7C3AED,#EC4899)", transition: "width 0.3s" }} />
//             </div>
//           </div>
//         )}

//         {media.uploaded && (
//           <div style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
//             <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
//               <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//             </svg>
//           </div>
//         )}

//         {media.error && (
//           <div title={media.error} style={{ position: "absolute", top: 8, right: 8, width: 22, height: 22, borderRadius: "50%", background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "help" }}>!</div>
//         )}

//         <button onClick={() => onRemove(media.id)} style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
//           <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
//             <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
//           </svg>
//         </button>
//       </div>

//       <div>
//         <p style={{ fontSize: 11, fontWeight: 500, color: "#374151", margin: "0 0 1px" }}>
//           {media.file.name.length > 18 ? media.file.name.slice(0, 16) + "…" : media.file.name}
//         </p>
//         <p title={media.error} style={{ fontSize: 11, margin: 0, fontWeight: 500, color: media.uploaded ? "#16A34A" : media.error ? "#DC2626" : "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
//           {media.uploading ? `Uploading ${media.progress}%` : media.uploaded ? "Uploaded ✓" : media.error ? media.error : "Pending…"}
//         </p>
//       </div>
//     </div>
//   );
// }

// const s: Record<string, React.CSSProperties> = {
//   page: { minHeight: "100vh", background: "#ffffff", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: "#111827", padding: "28px 20px 80px", maxWidth: 760, margin: "0 auto" },
//   titleArea: { marginBottom: 20 },
//   backBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", marginBottom: 16 },
//   title: { fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: "#111827" },
//   subtitle: { fontSize: 13, color: "#6B7280", margin: 0 },
//   statsBar: { display: "flex", gap: 20, padding: "11px 18px", background: "#F9FAFB", borderRadius: 12, marginBottom: 16, border: "1px solid #E5E7EB", flexWrap: "wrap" },
//   card: { background: "#fff", borderRadius: 16, padding: "22px", marginBottom: 14, border: "1px solid #E5E7EB" },
//   cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
//   cardTitleRow: { display: "flex", alignItems: "center", gap: 7 },
//   emoji: { fontSize: 17 },
//   sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", color: "#374151" },
//   countText: { fontSize: 12, color: "#9CA3AF", fontWeight: 500 },
//   grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 14 },
//   footerRow: { display: "flex", justifyContent: "flex-end", marginTop: 20 },
//   saveBtn: { background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 30px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.1px" },
// };


// "use client";

// import { useState, useRef, useCallback, useEffect } from "react";

// const API_BASE = "https://api.collabzy.in/api";

// type MediaFile = {
//   id: string;
//   file: File;
//   preview: string;
//   type: "reel" | "post";
//   uploading: boolean;
//   uploaded: boolean;
//   url?: string;
//   error?: string;
//   progress: number;
// };

// const MAX_REELS = 2;
// const MAX_POSTS = 3;
// const LS_KEY = "collabzy_portfolio"; // localStorage key

// const getToken = () =>
//   typeof window !== "undefined" ? localStorage.getItem("token") || "" : "";

// // localStorage helpers
// const saveToLS = (reels: MediaFile[], posts: MediaFile[]) => {
//   const reelUrls = reels.filter((f) => f.uploaded && f.url).map((f) => f.url!);
//   const postUrls = posts.filter((f) => f.uploaded && f.url).map((f) => f.url!);
//   localStorage.setItem(LS_KEY, JSON.stringify({ reels: reelUrls, posts: postUrls }));
// };

// const loadFromLS = (): { reels: string[]; posts: string[] } => {
//   try {
//     const raw = localStorage.getItem(LS_KEY);
//     if (!raw) return { reels: [], posts: [] };
//     return JSON.parse(raw);
//   } catch {
//     return { reels: [], posts: [] };
//   }
// };

// const urlToMediaFile = (url: string, type: "reel" | "post", index: number): MediaFile => ({
//   id: `${type}-saved-${index}-${Date.now()}`,
//   file: new File([], url.split("/").pop() || "saved"),
//   preview: url,
//   type,
//   uploading: false,
//   uploaded: true,
//   url,
//   progress: 100,
// });

// export default function InfluencerPortfolio() {
//   const [reels, setReels] = useState<MediaFile[]>([]);
//   const [posts, setPosts] = useState<MediaFile[]>([]);
//   const [initialLoading, setInitialLoading] = useState(true);

//   const reelInputRef = useRef<HTMLInputElement>(null);
//   const postInputRef = useRef<HTMLInputElement>(null);

//   // ✅ Page load pe localStorage se restore karo
//   useEffect(() => {
//     const { reels: savedReels, posts: savedPosts } = loadFromLS();
//     if (savedReels.length) setReels(savedReels.map((url, i) => urlToMediaFile(url, "reel", i)));
//     if (savedPosts.length) setPosts(savedPosts.map((url, i) => urlToMediaFile(url, "post", i)));
//     setInitialLoading(false);
//   }, []);

//   const uploadFile = useCallback(
//     async (
//       mediaFile: MediaFile,
//       setter: React.Dispatch<React.SetStateAction<MediaFile[]>>,
//       type: "reel" | "post"
//     ) => {
//       setter((prev) =>
//         prev.map((f) => (f.id === mediaFile.id ? { ...f, uploading: true, progress: 0 } : f))
//       );

//       const formData = new FormData();
//       const isReel = type === "reel";
//       if (isReel) formData.append("videos", mediaFile.file);
//       else formData.append("image", mediaFile.file);

//       try {
//         const endpoint = isReel ? `${API_BASE}/upload/videos` : `${API_BASE}/upload/image`;

//         const progressInterval = setInterval(() => {
//           setter((prev) =>
//             prev.map((f) =>
//               f.id === mediaFile.id && f.progress < 85
//                 ? { ...f, progress: f.progress + 12 }
//                 : f
//             )
//           );
//         }, 300);

//         const res = await fetch(endpoint, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${getToken()}` },
//           body: formData,
//         });

//         clearInterval(progressInterval);
//         const data = await res.json();

//         if (!res.ok || !data.success) throw new Error(data.message || "Upload failed");

//         const url = isReel ? data.urls?.[0] || data.url || "" : data.url || "";

//         // ✅ Upload hone ke baad state update karo + localStorage save karo
//         if (isReel) {
//           setReels((prev) => {
//             const updated = prev.map((f) =>
//               f.id === mediaFile.id
//                 ? { ...f, uploading: false, uploaded: true, url, progress: 100 }
//                 : f
//             );
//             // posts ki current value chahiye — dono ek saath save
//             setPosts((currentPosts) => {
//               saveToLS(updated, currentPosts);
//               return currentPosts;
//             });
//             return updated;
//           });
//         } else {
//           setPosts((prev) => {
//             const updated = prev.map((f) =>
//               f.id === mediaFile.id
//                 ? { ...f, uploading: false, uploaded: true, url, progress: 100 }
//                 : f
//             );
//             setReels((currentReels) => {
//               saveToLS(currentReels, updated);
//               return currentReels;
//             });
//             return updated;
//           });
//         }
//       } catch (err: any) {
//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id
//               ? { ...f, uploading: false, error: err.message, progress: 0 }
//               : f
//           )
//         );
//       }
//     },
//     []
//   );

//   const handleReelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_REELS - reels.length;
//     const selected = files.slice(0, remaining);
//     const newItems: MediaFile[] = selected.map((file) => ({
//       id: `reel-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "reel",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));

//     // ✅ setter ke BAHAR uploadFile — double API call nahi hoga
//     setReels((prev) => [...prev, ...newItems]);
//     newItems.forEach((r) => uploadFile(r, setReels, "reel"));
//     e.target.value = "";
//   };

//   const handlePostSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_POSTS - posts.length;
//     const selected = files.slice(0, remaining);
//     const newItems: MediaFile[] = selected.map((file) => ({
//       id: `post-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "post",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));

//     // ✅ setter ke BAHAR uploadFile
//     setPosts((prev) => [...prev, ...newItems]);
//     newItems.forEach((p) => uploadFile(p, setPosts, "post"));
//     e.target.value = "";
//   };

//   const removeReel = (id: string) => {
//     setReels((prev) => {
//       const updated = prev.filter((f) => f.id !== id);
//       setPosts((currentPosts) => { saveToLS(updated, currentPosts); return currentPosts; });
//       return updated;
//     });
//   };

//   const removePost = (id: string) => {
//     setPosts((prev) => {
//       const updated = prev.filter((f) => f.id !== id);
//       setReels((currentReels) => { saveToLS(currentReels, updated); return currentReels; });
//       return updated;
//     });
//   };

//   const uploading = [...reels, ...posts].some((f) => f.uploading);

//   const handleSave = () => {
//     saveToLS(reels, posts);
//     alert("Portfolio saved! 🎉");
//   };

//   if (initialLoading) {
//     return (
//       <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
//         <p style={{ color: "#6B7280", fontSize: 14 }}>Loading portfolio…</p>
//       </div>
//     );
//   }

//   return (
//     <div style={s.page}>
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

//       {/* Back + Title */}
//       <div style={s.titleArea}>
//         <button style={s.backBtn} onClick={() => window.history.back()}>
//           <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//             <path d="M10 12L6 8l4-4" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//           </svg>
//           Back
//         </button>
//         <h1 style={s.title}>My Portfolio</h1>
//         <p style={s.subtitle}>Showcase your best work to brands</p>
//       </div>

//       {/* Stats */}
//       <div style={s.statsBar}>
//         <StatPill color="#7C3AED" label={`Reels: ${reels.length}/${MAX_REELS}`} />
//         <StatPill color="#F59E0B" label={`Posts: ${posts.length}/${MAX_POSTS}`} />
//         <StatPill color="#22C55E" label="Max 10MB per file" />
//       </div>

//       {/* REELS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>🎬</span>
//             <span style={s.sectionLabel}>REELS</span>
//           </div>
//           <span style={s.countText}>{reels.length}/{MAX_REELS} added</span>
//         </div>
//         <input ref={reelInputRef} type="file" accept="video/*" multiple style={{ display: "none" }} onChange={handleReelSelect} />
//         <div style={s.grid}>
//           {reels.map((r) => <MediaCard key={r.id} media={r} onRemove={removeReel} />)}
//           {reels.length < MAX_REELS && (
//             <AddCard label="Add Reel" hint="MP4, MOV • Max 10MB" emoji="🎬" onClick={() => reelInputRef.current?.click()} />
//           )}
//         </div>
//       </div>

//       {/* POSTS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>📷</span>
//             <span style={s.sectionLabel}>POSTS</span>
//           </div>
//           <span style={s.countText}>{posts.length}/{MAX_POSTS} added</span>
//         </div>
//         <input ref={postInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePostSelect} />
//         <div style={s.grid}>
//           {posts.map((p) => <MediaCard key={p.id} media={p} onRemove={removePost} />)}
//           {posts.length < MAX_POSTS && (
//             <AddCard label="Add Post" hint="JPG, PNG, WebP • Max 10MB" emoji="📷" onClick={() => postInputRef.current?.click()} />
//           )}
//         </div>
//       </div>

//       {/* Save */}
//       <div style={s.footerRow}>
//         <button
//           style={{ ...s.saveBtn, opacity: uploading ? 0.65 : 1 }}
//           disabled={uploading}
//           onClick={handleSave}
//         >
//           {uploading ? "Uploading…" : "Save Portfolio"}
//         </button>
//       </div>
//     </div>
//   );
// }

// function StatPill({ color, label }: { color: string; label: string }) {
//   return (
//     <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#374151" }}>
//       <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
//       {label}
//     </span>
//   );
// }

// function AddCard({ label, hint, emoji, onClick }: { label: string; hint: string; emoji: string; onClick: () => void }) {
//   const [hover, setHover] = useState(false);
//   return (
//     <div
//       onClick={onClick}
//       onMouseEnter={() => setHover(true)}
//       onMouseLeave={() => setHover(false)}
//       style={{
//         border: `2px dashed ${hover ? "#7C3AED" : "#D1D5DB"}`,
//         borderRadius: 14,
//         aspectRatio: "4/5",
//         display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
//         cursor: "pointer", gap: 8,
//         background: hover ? "#F5F3FF" : "#F9FAFB",
//         transition: "all 0.15s", padding: "16px 12px",
//       }}
//     >
//       <div style={{
//         width: 52, height: 52, borderRadius: "50%",
//         background: hover ? "#EDE9FE" : "#F3F4F6",
//         display: "flex", alignItems: "center", justifyContent: "center",
//         fontSize: 22, transition: "background 0.15s",
//       }}>
//         {emoji}
//       </div>
//       <p style={{ fontSize: 13, fontWeight: 600, color: hover ? "#7C3AED" : "#374151", margin: 0, transition: "color 0.15s" }}>
//         {label}
//       </p>
//       <p style={{ fontSize: 11, color: "#9CA3AF", margin: 0, textAlign: "center", lineHeight: 1.4 }}>
//         {hint}
//       </p>
//     </div>
//   );
// }

// function MediaCard({ media, onRemove }: { media: MediaFile; onRemove: (id: string) => void }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <div style={{
//         position: "relative", aspectRatio: "4/5", borderRadius: 14,
//         overflow: "hidden", background: "#F3F4F6", border: "1px solid #E5E7EB",
//       }}>
//         {media.type === "reel" ? (
//           <video
//             src={media.preview}
//             style={{ width: "100%", height: "100%", objectFit: "cover" }}
//             muted loop playsInline
//             onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//             onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
//           />
//         ) : (
//           <img src={media.preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
//         )}

//         {media.uploading && (
//           <div style={{
//             position: "absolute", inset: 0, background: "rgba(0,0,0,0.52)",
//             display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
//           }}>
//             <div style={{
//               width: 46, height: 46, borderRadius: "50%",
//               border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff",
//               animation: "spin 0.8s linear infinite",
//               display: "flex", alignItems: "center", justifyContent: "center",
//             }}>
//               <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{media.progress}%</span>
//             </div>
//             <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.15)" }}>
//               <div style={{ height: "100%", width: `${media.progress}%`, background: "linear-gradient(90deg,#7C3AED,#EC4899)", transition: "width 0.3s" }} />
//             </div>
//           </div>
//         )}

//         {media.uploaded && (
//           <div style={{
//             position: "absolute", top: 8, right: 8, width: 22, height: 22,
//             borderRadius: "50%", background: "#16A34A",
//             display: "flex", alignItems: "center", justifyContent: "center",
//           }}>
//             <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
//               <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
//             </svg>
//           </div>
//         )}

//         {media.error && (
//           <div style={{
//             position: "absolute", top: 8, right: 8, width: 22, height: 22,
//             borderRadius: "50%", background: "#DC2626",
//             display: "flex", alignItems: "center", justifyContent: "center",
//             color: "#fff", fontSize: 12, fontWeight: 700,
//           }}>!</div>
//         )}

//         <button
//           onClick={() => onRemove(media.id)}
//           style={{
//             position: "absolute", top: 8, left: 8, width: 24, height: 24,
//             borderRadius: "50%", background: "rgba(0,0,0,0.5)",
//             border: "none", cursor: "pointer",
//             display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
//           }}
//         >
//           <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
//             <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
//           </svg>
//         </button>
//       </div>

//       <div>
//         <p style={{ fontSize: 11, fontWeight: 500, color: "#374151", margin: "0 0 1px" }}>
//           {media.file.name.length > 18 ? media.file.name.slice(0, 16) + "…" : media.file.name}
//         </p>
//         <p style={{ fontSize: 11, margin: 0, fontWeight: 500, color: media.uploaded ? "#16A34A" : media.error ? "#DC2626" : "#9CA3AF" }}>
//           {media.uploading ? `Uploading ${media.progress}%` : media.uploaded ? "Uploaded ✓" : media.error ? "Failed" : "Pending…"}
//         </p>
//       </div>
//     </div>
//   );
// }

// const s: Record<string, React.CSSProperties> = {
//   page: {
//     minHeight: "100vh", background: "#ffffff",
//     fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
//     color: "#111827", padding: "28px 20px 80px",
//     maxWidth: 760, margin: "0 auto",
//   },
//   titleArea: { marginBottom: 20 },
//   backBtn: {
//     display: "inline-flex", alignItems: "center", gap: 5,
//     background: "none", border: "1px solid #E5E7EB", borderRadius: 8,
//     padding: "6px 12px", fontSize: 13, fontWeight: 500, color: "#374151",
//     cursor: "pointer", marginBottom: 16,
//   },
//   title: { fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: "#111827" },
//   subtitle: { fontSize: 13, color: "#6B7280", margin: 0 },
//   statsBar: {
//     display: "flex", gap: 20, padding: "11px 18px",
//     background: "#F9FAFB", borderRadius: 12, marginBottom: 16,
//     border: "1px solid #E5E7EB", flexWrap: "wrap",
//   },
//   card: { background: "#fff", borderRadius: 16, padding: "22px", marginBottom: 14, border: "1px solid #E5E7EB" },
//   cardHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
//   cardTitleRow: { display: "flex", alignItems: "center", gap: 7 },
//   emoji: { fontSize: 17 },
//   sectionLabel: { fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", color: "#374151" },
//   countText: { fontSize: 12, color: "#9CA3AF", fontWeight: 500 },
//   grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))", gap: 14 },
//   footerRow: { display: "flex", justifyContent: "flex-end", marginTop: 20 },
//   saveBtn: {
//     background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff",
//     border: "none", borderRadius: 10, padding: "11px 30px",
//     fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "-0.1px",
//   },
// };


// "use client";

// import { useState, useRef, useCallback, useEffect } from "react";

// const API_BASE = "https://api.collabzy.in/api";

// type MediaFile = {
//   id: string;
//   file: File;
//   preview: string;
//   type: "reel" | "post";
//   uploading: boolean;
//   uploaded: boolean;
//   url?: string;
//   error?: string;
//   progress: number;
// };

// const MAX_REELS = 2;
// const MAX_POSTS = 3;

// export default function InfluencerPortfolio() {
//   const [reels, setReels] = useState<MediaFile[]>([]);
//   const [posts, setPosts] = useState<MediaFile[]>([]);
//   const [initialLoading, setInitialLoading] = useState(true);

//   const reelInputRef = useRef<HTMLInputElement>(null);
//   const postInputRef = useRef<HTMLInputElement>(null);

//   const getToken = () => localStorage.getItem("token") || "";

//   // ✅ Bug 2 Fix: Page load pe existing portfolio fetch karo
//   useEffect(() => {
//     const fetchPortfolio = async () => {
//       try {
//         const res = await fetch(`${API_BASE}/portfolio`, {
//           headers: { Authorization: `Bearer ${getToken()}` },
//         });
//         const data = await res.json();
//         if (res.ok && data.success) {
//           if (data.reels?.length) {
//             setReels(
//               data.reels.map((url: string, i: number) => ({
//                 id: `reel-saved-${i}`,
//                 file: new File([], "saved"),
//                 preview: url,
//                 type: "reel" as const,
//                 uploading: false,
//                 uploaded: true,
//                 url,
//                 progress: 100,
//               }))
//             );
//           }
//           if (data.posts?.length) {
//             setPosts(
//               data.posts.map((url: string, i: number) => ({
//                 id: `post-saved-${i}`,
//                 file: new File([], "saved"),
//                 preview: url,
//                 type: "post" as const,
//                 uploading: false,
//                 uploaded: true,
//                 url,
//                 progress: 100,
//               }))
//             );
//           }
//         }
//       } catch (e) {
//         console.error("Portfolio fetch failed", e);
//       } finally {
//         setInitialLoading(false);
//       }
//     };
//     fetchPortfolio();
//   }, []);

//   const uploadFile = useCallback(
//     async (
//       mediaFile: MediaFile,
//       setter: React.Dispatch<React.SetStateAction<MediaFile[]>>
//     ) => {
//       setter((prev) =>
//         prev.map((f) =>
//           f.id === mediaFile.id ? { ...f, uploading: true, progress: 0 } : f
//         )
//       );

//       const formData = new FormData();
//       const isReel = mediaFile.type === "reel";
//       if (isReel) formData.append("videos", mediaFile.file);
//       else formData.append("image", mediaFile.file);

//       try {
//         const endpoint = isReel
//           ? `${API_BASE}/upload/videos`
//           : `${API_BASE}/upload/image`;

//         const progressInterval = setInterval(() => {
//           setter((prev) =>
//             prev.map((f) =>
//               f.id === mediaFile.id && f.progress < 85
//                 ? { ...f, progress: f.progress + 12 }
//                 : f
//             )
//           );
//         }, 300);

//         const res = await fetch(endpoint, {
//           method: "POST",
//           headers: { Authorization: `Bearer ${getToken()}` },
//           body: formData,
//         });

//         clearInterval(progressInterval);
//         const data = await res.json();

//         if (!res.ok || !data.success)
//           throw new Error(data.message || "Upload failed");

//         const url = isReel
//           ? data.urls?.[0] || data.url || ""
//           : data.url || "";

//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id
//               ? { ...f, uploading: false, uploaded: true, url, progress: 100 }
//               : f
//           )
//         );
//       } catch (err: any) {
//         setter((prev) =>
//           prev.map((f) =>
//             f.id === mediaFile.id
//               ? { ...f, uploading: false, error: err.message, progress: 0 }
//               : f
//           )
//         );
//       }
//     },
//     []
//   );

//   const handleReelSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_REELS - reels.length;
//     const selected = files.slice(0, remaining);
//     const newItems: MediaFile[] = selected.map((file) => ({
//       id: `reel-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "reel",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));

//     // ✅ Bug 1 Fix: setReels aur uploadFile alag alag — setter ke andar side effect nahi
//     setReels((prev) => [...prev, ...newItems]);
//     newItems.forEach((r) => uploadFile(r, setReels));

//     e.target.value = "";
//   };

//   const handlePostSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const files = Array.from(e.target.files || []);
//     const remaining = MAX_POSTS - posts.length;
//     const selected = files.slice(0, remaining);
//     const newItems: MediaFile[] = selected.map((file) => ({
//       id: `post-${Date.now()}-${Math.random()}`,
//       file,
//       preview: URL.createObjectURL(file),
//       type: "post",
//       uploading: false,
//       uploaded: false,
//       progress: 0,
//     }));

//     // ✅ Bug 1 Fix: setPosts aur uploadFile alag alag
//     setPosts((prev) => [...prev, ...newItems]);
//     newItems.forEach((p) => uploadFile(p, setPosts));

//     e.target.value = "";
//   };

//   const removeReel = (id: string) =>
//     setReels((p) => p.filter((f) => f.id !== id));
//   const removePost = (id: string) =>
//     setPosts((p) => p.filter((f) => f.id !== id));

//   const uploading = [...reels, ...posts].some((f) => f.uploading);

//   const handleSave = async () => {
//     const uploadedReels = reels.filter((r) => r.uploaded).map((r) => r.url);
//     const uploadedPosts = posts.filter((p) => p.uploaded).map((p) => p.url);

//     try {
//       const res = await fetch(`${API_BASE}/portfolio`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${getToken()}`,
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({ reels: uploadedReels, posts: uploadedPosts }),
//       });
//       const data = await res.json();
//       if (res.ok && data.success) alert("Portfolio saved! 🎉");
//       else alert("Save failed: " + data.message);
//     } catch (e) {
//       alert("Save failed!");
//     }
//   };

//   if (initialLoading) {
//     return (
//       <div style={{ ...s.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
//         <p style={{ color: "#6B7280", fontSize: 14 }}>Loading portfolio…</p>
//       </div>
//     );
//   }

//   return (
//     <div style={s.page}>
//       <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

//       {/* Back button + Title */}
//       <div style={s.titleArea}>
//         <button style={s.backBtn} onClick={() => window.history.back()}>
//           <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
//             <path
//               d="M10 12L6 8l4-4"
//               stroke="#374151"
//               strokeWidth="1.8"
//               strokeLinecap="round"
//               strokeLinejoin="round"
//             />
//           </svg>
//           Back
//         </button>
//         <h1 style={s.title}>My Portfolio</h1>
//         <p style={s.subtitle}>Showcase your best work to brands</p>
//       </div>

//       {/* Stats pill bar */}
//       <div style={s.statsBar}>
//         <StatPill color="#7C3AED" label={`Reels: ${reels.length}/${MAX_REELS}`} />
//         <StatPill color="#F59E0B" label={`Posts: ${posts.length}/${MAX_POSTS}`} />
//         <StatPill color="#22C55E" label="Max 10MB per file" />
//       </div>

//       {/* REELS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>🎬</span>
//             <span style={s.sectionLabel}>REELS</span>
//           </div>
//           <span style={s.countText}>{reels.length}/{MAX_REELS} added</span>
//         </div>

//         <input
//           ref={reelInputRef}
//           type="file"
//           accept="video/*"
//           multiple
//           style={{ display: "none" }}
//           onChange={handleReelSelect}
//         />

//         <div style={s.grid}>
//           {reels.map((r) => (
//             <MediaCard key={r.id} media={r} onRemove={removeReel} />
//           ))}
//           {reels.length < MAX_REELS && (
//             <AddCard
//               label="Add Reel"
//               hint="MP4, MOV • Max 10MB"
//               emoji="🎬"
//               onClick={() => reelInputRef.current?.click()}
//             />
//           )}
//         </div>
//       </div>

//       {/* POSTS */}
//       <div style={s.card}>
//         <div style={s.cardHeader}>
//           <div style={s.cardTitleRow}>
//             <span style={s.emoji}>📷</span>
//             <span style={s.sectionLabel}>POSTS</span>
//           </div>
//           <span style={s.countText}>{posts.length}/{MAX_POSTS} added</span>
//         </div>

//         <input
//           ref={postInputRef}
//           type="file"
//           accept="image/*"
//           multiple
//           style={{ display: "none" }}
//           onChange={handlePostSelect}
//         />

//         <div style={s.grid}>
//           {posts.map((p) => (
//             <MediaCard key={p.id} media={p} onRemove={removePost} />
//           ))}
//           {posts.length < MAX_POSTS && (
//             <AddCard
//               label="Add Post"
//               hint="JPG, PNG, WebP • Max 10MB"
//               emoji="📷"
//               onClick={() => postInputRef.current?.click()}
//             />
//           )}
//         </div>
//       </div>

//       {/* Save */}
//       <div style={s.footerRow}>
//         <button
//           style={{ ...s.saveBtn, opacity: uploading ? 0.65 : 1 }}
//           disabled={uploading}
//           onClick={handleSave}
//         >
//           {uploading ? "Uploading…" : "Save Portfolio"}
//         </button>
//       </div>
//     </div>
//   );
// }

// function StatPill({ color, label }: { color: string; label: string }) {
//   return (
//     <span
//       style={{
//         display: "flex",
//         alignItems: "center",
//         gap: 6,
//         fontSize: 13,
//         fontWeight: 500,
//         color: "#374151",
//       }}
//     >
//       <span
//         style={{
//           width: 8,
//           height: 8,
//           borderRadius: "50%",
//           background: color,
//           display: "inline-block",
//           flexShrink: 0,
//         }}
//       />
//       {label}
//     </span>
//   );
// }

// function AddCard({
//   label,
//   hint,
//   emoji,
//   onClick,
// }: {
//   label: string;
//   hint: string;
//   emoji: string;
//   onClick: () => void;
// }) {
//   const [hover, setHover] = useState(false);
//   return (
//     <div
//       onClick={onClick}
//       onMouseEnter={() => setHover(true)}
//       onMouseLeave={() => setHover(false)}
//       style={{
//         border: `2px dashed ${hover ? "#7C3AED" : "#D1D5DB"}`,
//         borderRadius: 14,
//         aspectRatio: "4/5",
//         display: "flex",
//         flexDirection: "column",
//         alignItems: "center",
//         justifyContent: "center",
//         cursor: "pointer",
//         gap: 8,
//         background: hover ? "#F5F3FF" : "#F9FAFB",
//         transition: "all 0.15s",
//         padding: "16px 12px",
//       }}
//     >
//       <div
//         style={{
//           width: 52,
//           height: 52,
//           borderRadius: "50%",
//           background: hover ? "#EDE9FE" : "#F3F4F6",
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           fontSize: 22,
//           transition: "background 0.15s",
//         }}
//       >
//         {emoji}
//       </div>
//       <p
//         style={{
//           fontSize: 13,
//           fontWeight: 600,
//           color: hover ? "#7C3AED" : "#374151",
//           margin: 0,
//           transition: "color 0.15s",
//         }}
//       >
//         {label}
//       </p>
//       <p
//         style={{
//           fontSize: 11,
//           color: "#9CA3AF",
//           margin: 0,
//           textAlign: "center",
//           lineHeight: 1.4,
//         }}
//       >
//         {hint}
//       </p>
//     </div>
//   );
// }

// function MediaCard({
//   media,
//   onRemove,
// }: {
//   media: MediaFile;
//   onRemove: (id: string) => void;
// }) {
//   return (
//     <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
//       <div
//         style={{
//           position: "relative",
//           aspectRatio: "4/5",
//           borderRadius: 14,
//           overflow: "hidden",
//           background: "#F3F4F6",
//           border: "1px solid #E5E7EB",
//         }}
//       >
//         {media.type === "reel" ? (
//           <video
//             src={media.preview}
//             style={{ width: "100%", height: "100%", objectFit: "cover" }}
//             muted
//             loop
//             playsInline
//             onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play()}
//             onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
//           />
//         ) : (
//           <img
//             src={media.preview}
//             style={{ width: "100%", height: "100%", objectFit: "cover" }}
//             alt=""
//           />
//         )}

//         {media.uploading && (
//           <div
//             style={{
//               position: "absolute",
//               inset: 0,
//               background: "rgba(0,0,0,0.52)",
//               display: "flex",
//               flexDirection: "column",
//               alignItems: "center",
//               justifyContent: "center",
//               gap: 10,
//             }}
//           >
//             <div
//               style={{
//                 width: 46,
//                 height: 46,
//                 borderRadius: "50%",
//                 border: "3px solid rgba(255,255,255,0.2)",
//                 borderTopColor: "#fff",
//                 animation: "spin 0.8s linear infinite",
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>
//                 {media.progress}%
//               </span>
//             </div>
//             <div
//               style={{
//                 position: "absolute",
//                 bottom: 0,
//                 left: 0,
//                 right: 0,
//                 height: 3,
//                 background: "rgba(255,255,255,0.15)",
//               }}
//             >
//               <div
//                 style={{
//                   height: "100%",
//                   width: `${media.progress}%`,
//                   background: "linear-gradient(90deg,#7C3AED,#EC4899)",
//                   transition: "width 0.3s",
//                 }}
//               />
//             </div>
//           </div>
//         )}

//         {media.uploaded && (
//           <div
//             style={{
//               position: "absolute",
//               top: 8,
//               right: 8,
//               width: 22,
//               height: 22,
//               borderRadius: "50%",
//               background: "#16A34A",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//             }}
//           >
//             <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
//               <path
//                 d="M2 6l3 3 5-5"
//                 stroke="#fff"
//                 strokeWidth="1.8"
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//               />
//             </svg>
//           </div>
//         )}

//         {media.error && (
//           <div
//             style={{
//               position: "absolute",
//               top: 8,
//               right: 8,
//               width: 22,
//               height: 22,
//               borderRadius: "50%",
//               background: "#DC2626",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               color: "#fff",
//               fontSize: 12,
//               fontWeight: 700,
//             }}
//           >
//             !
//           </div>
//         )}

//         <button
//           onClick={() => onRemove(media.id)}
//           style={{
//             position: "absolute",
//             top: 8,
//             left: 8,
//             width: 24,
//             height: 24,
//             borderRadius: "50%",
//             background: "rgba(0,0,0,0.5)",
//             border: "none",
//             cursor: "pointer",
//             display: "flex",
//             alignItems: "center",
//             justifyContent: "center",
//             padding: 0,
//           }}
//         >
//           <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
//             <path
//               d="M1 1l8 8M9 1L1 9"
//               stroke="#fff"
//               strokeWidth="1.6"
//               strokeLinecap="round"
//             />
//           </svg>
//         </button>
//       </div>

//       <div>
//         <p
//           style={{
//             fontSize: 11,
//             fontWeight: 500,
//             color: "#374151",
//             margin: "0 0 1px",
//           }}
//         >
//           {media.file.name.length > 18
//             ? media.file.name.slice(0, 16) + "…"
//             : media.file.name}
//         </p>
//         <p
//           style={{
//             fontSize: 11,
//             margin: 0,
//             fontWeight: 500,
//             color: media.uploaded
//               ? "#16A34A"
//               : media.error
//               ? "#DC2626"
//               : "#9CA3AF",
//           }}
//         >
//           {media.uploading
//             ? `Uploading ${media.progress}%`
//             : media.uploaded
//             ? "Uploaded ✓"
//             : media.error
//             ? "Failed"
//             : "Pending…"}
//         </p>
//       </div>
//     </div>
//   );
// }

// const s: Record<string, React.CSSProperties> = {
//   page: {
//     minHeight: "100vh",
//     background: "#ffffff",
//     fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
//     color: "#111827",
//     padding: "28px 20px 80px",
//     maxWidth: 760,
//     margin: "0 auto",
//   },
//   titleArea: { marginBottom: 20 },
//   backBtn: {
//     display: "inline-flex",
//     alignItems: "center",
//     gap: 5,
//     background: "none",
//     border: "1px solid #E5E7EB",
//     borderRadius: 8,
//     padding: "6px 12px",
//     fontSize: 13,
//     fontWeight: 500,
//     color: "#374151",
//     cursor: "pointer",
//     marginBottom: 16,
//   },
//   title: { fontSize: 22, fontWeight: 700, margin: "0 0 3px", color: "#111827" },
//   subtitle: { fontSize: 13, color: "#6B7280", margin: 0 },
//   statsBar: {
//     display: "flex",
//     gap: 20,
//     padding: "11px 18px",
//     background: "#F9FAFB",
//     borderRadius: 12,
//     marginBottom: 16,
//     border: "1px solid #E5E7EB",
//     flexWrap: "wrap",
//   },
//   card: {
//     background: "#fff",
//     borderRadius: 16,
//     padding: "22px",
//     marginBottom: 14,
//     border: "1px solid #E5E7EB",
//   },
//   cardHeader: {
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "space-between",
//     marginBottom: 18,
//   },
//   cardTitleRow: { display: "flex", alignItems: "center", gap: 7 },
//   emoji: { fontSize: 17 },
//   sectionLabel: {
//     fontSize: 12,
//     fontWeight: 700,
//     letterSpacing: "0.07em",
//     color: "#374151",
//   },
//   countText: { fontSize: 12, color: "#9CA3AF", fontWeight: 500 },
//   grid: {
//     display: "grid",
//     gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
//     gap: 14,
//   },
//   footerRow: { display: "flex", justifyContent: "flex-end", marginTop: 20 },
//   saveBtn: {
//     background: "linear-gradient(135deg,#7C3AED,#6D28D9)",
//     color: "#fff",
//     border: "none",
//     borderRadius: 10,
//     padding: "11px 30px",
//     fontSize: 14,
//     fontWeight: 600,
//     cursor: "pointer",
//     letterSpacing: "-0.1px",
//   },
// };



// "use client";

// import { useEffect, useState, useRef } from "react";
// import { useRouter } from "next/navigation";

// const API = "https://api.collabzy.in/api";

// interface MediaItem {
//   id: string;
//   file: File | null;
//   preview: string;
//   type: "reel" | "post";
//   caption: string;
//   uploading: boolean;
//   uploaded: boolean;
//   url: string;
//   error: string;
// }

// const MAX_REELS = 2;
// const MAX_POSTS = 3;
// const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// export default function PortfolioUploadPage() {
//   const router = useRouter();
//   const [token, setToken] = useState("");
//   const [userId, setUserId] = useState("");
//   const [items, setItems] = useState<MediaItem[]>([]);
//   const [saving, setSaving] = useState(false);
//   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
//   const reelInputRef = useRef<HTMLInputElement>(null);
//   const postInputRef = useRef<HTMLInputElement>(null);

//   const showToast = (msg: string, type: "success" | "error" = "success") => {
//     setToast({ msg, type });
//     setTimeout(() => setToast(null), 3500);
//   };

//   useEffect(() => {
//     const raw = localStorage.getItem("cb_user");
//     if (!raw) { router.push("/login"); return; }
//     const u = JSON.parse(raw);
//     if (u.role?.toLowerCase() !== "influencer") { router.push("/discovery"); return; }
//     setToken(u.token);
//     setUserId(u.id || u._id || "");

//     // Load existing portfolio
//     fetch(`${API}/portfolio/my`, { headers: { Authorization: `Bearer ${u.token}` } })
//       .then(r => r.json())
//       .then(data => {
//         const portfolio = data?.portfolio || data?.data || [];
//         if (Array.isArray(portfolio) && portfolio.length > 0) {
//           const loaded: MediaItem[] = portfolio.map((p: any) => ({
//             id: p._id || Math.random().toString(36),
//             file: null,
//             preview: p.url || "",
//             type: p.type || "post",
//             caption: p.caption || "",
//             uploading: false,
//             uploaded: true,
//             url: p.url || "",
//             error: "",
//           }));
//           setItems(loaded);
//         }
//       })
//       .catch(() => {});
//   }, []);

//   const reels = items.filter(i => i.type === "reel");
//   const posts = items.filter(i => i.type === "post");
//   const canAddReel = reels.length < MAX_REELS;
//   const canAddPost = posts.length < MAX_POSTS;

//   const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "reel" | "post") => {
//     const files = Array.from(e.target.files || []);
//     if (!files.length) return;

//     const limit = type === "reel" ? MAX_REELS - reels.length : MAX_POSTS - posts.length;
//     const selected = files.slice(0, limit);

//     const newItems: MediaItem[] = selected.map(file => {
//       if (file.size > MAX_FILE_SIZE) {
//         showToast(`${file.name} is too large. Max 10MB.`, "error");
//         return null as any;
//       }
//       const preview = URL.createObjectURL(file);
//       return {
//         id: Math.random().toString(36),
//         file,
//         preview,
//         type,
//         caption: "",
//         uploading: false,
//         uploaded: false,
//         url: "",
//         error: "",
//       };
//     }).filter(Boolean);

//     setItems(prev => [...prev, ...newItems]);
//     e.target.value = "";
//   };

//   const removeItem = (id: string) => {
//     setItems(prev => {
//       const item = prev.find(i => i.id === id);
//       if (item?.preview && item.file) URL.revokeObjectURL(item.preview);
//       return prev.filter(i => i.id !== id);
//     });
//   };

//   const updateCaption = (id: string, caption: string) => {
//     setItems(prev => prev.map(i => i.id === id ? { ...i, caption } : i));
//   };


//   const uploadFile = async (item: MediaItem): Promise<string> => {
//   if (!item.file) return item.url;

//   let endpoint = "";
//   const formData = new FormData();

//   // 🔥 Correct endpoint + key mapping
//   if (item.type === "reel") {
//     endpoint = `${API}/upload/videos`;
//     formData.append("videos", item.file); // ⚠️ backend expects "videos"
//   } else {
//     endpoint = `${API}/upload/image`;
//     formData.append("image", item.file); // ⚠️ backend expects "image"
//   }

//   formData.append("caption", item.caption);

//   const res = await fetch(endpoint, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${token}`,
//     },
//     body: formData,
//   });

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(data.message || "Upload failed");
//   }

//   // 🔥 Handle different response formats
//   if (item.type === "reel") {
//     return data.urls?.[0] || data.url || data.data?.[0] || "";
//   } else {
//     return data.url || data.data?.url || "";
//   }
// };

//   const handleSave = async () => {
//     if (items.length === 0) {
//       showToast("Please add at least one reel or post", "error");
//       return;
//     }

//     setSaving(true);
//     const updated = [...items];

//     try {
//       // Upload all new files
//       for (let i = 0; i < updated.length; i++) {
//         if (!updated[i].uploaded && updated[i].file) {
//           updated[i] = { ...updated[i], uploading: true };
//           setItems([...updated]);
//           try {
//             const url = await uploadFile(updated[i]);
//             updated[i] = { ...updated[i], uploading: false, uploaded: true, url, error: "" };
//           } catch (err: any) {
//             updated[i] = { ...updated[i], uploading: false, error: err.message || "Upload failed" };
//           }
//           setItems([...updated]);
//         }
//       }

//       // Save portfolio metadata to backend
//       const portfolioData = updated.filter(i => i.uploaded).map(i => ({
//         url: i.url,
//         type: i.type,
//         caption: i.caption,
//         ...(i.url && { _id: i.id }),
//       }));

//       await fetch(`${API}/portfolio/save`, {
//         method: "POST",
//         headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
//         body: JSON.stringify({ portfolio: portfolioData }),
//       });

//       showToast("Portfolio saved successfully! 🎉", "success");
//     } catch (err: any) {
//       showToast(err.message || "Something went wrong", "error");
//     } finally {
//       setSaving(false);
//     }
//   };

//   const totalUploading = items.filter(i => i.uploading).length;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
//         body{font-family:'Plus Jakarta Sans',sans-serif}
//         @keyframes spin{to{transform:rotate(360deg)}}
//         @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
//         @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
//         .pp{background:#f7f7f5;min-height:100vh;padding-bottom:60px;font-family:'Plus Jakarta Sans',sans-serif}
//         .pp-hdr{background:#fff;border-bottom:1px solid #efefef;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
//         .pp-hdr-left h1{font-size:20px;font-weight:800;color:#111;margin:0 0 3px}
//         .pp-hdr-left p{font-size:13px;color:#aaa;margin:0}
//         .pp-back{padding:8px 16px;background:#f5f5f3;border:none;border-radius:10px;font-size:13px;font-weight:600;color:#555;cursor:pointer;font-family:inherit;text-decoration:none;display:inline-flex;align-items:center;gap:6px}
//         .pp-back:hover{background:#ebebeb}
//         .pp-body{max-width:680px;margin:24px auto;padding:0 16px;display:flex;flex-direction:column;gap:20px;animation:fadeIn .3s ease}
//         .pp-section{background:#fff;border-radius:18px;border:1.5px solid #efefef;padding:22px}
//         .pp-section-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
//         .pp-section-title{font-size:13px;font-weight:700;color:#4f46e5;text-transform:uppercase;letter-spacing:.08em}
//         .pp-section-count{font-size:12px;color:#aaa;font-weight:600}
//         .pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}
//         .pp-card{border-radius:14px;border:1.5px solid #efefef;overflow:hidden;position:relative;background:#f9f9f8;transition:all .2s}
//         .pp-card:hover{border-color:#c7d2fe;box-shadow:0 4px 16px rgba(79,70,229,.08)}
//         .pp-media{width:100%;aspect-ratio:9/16;object-fit:cover;display:block;background:#e8e8e8}
//         .pp-media-post{aspect-ratio:1/1}
//         .pp-card-body{padding:10px}
//         .pp-caption{width:100%;border:1.5px solid #e8e8e8;border-radius:8px;padding:7px 10px;font-size:12px;font-family:inherit;outline:none;resize:none;line-height:1.5;color:#333;background:#fff}
//         .pp-caption:focus{border-color:#4f46e5}
//         .pp-remove{position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);border:none;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2}
//         .pp-remove:hover{background:rgba(239,68,68,.8)}
//         .pp-uploading-overlay{position:absolute;inset:0;background:rgba(255,255,255,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;z-index:3}
//         .pp-spinner{width:24px;height:24px;border:2.5px solid #e0e0e0;border-top-color:#4f46e5;border-radius:50%;animation:spin .8s linear infinite}
//         .pp-upload-text{font-size:11px;font-weight:600;color:#4f46e5}
//         .pp-error-badge{position:absolute;bottom:8px;left:8px;right:8px;background:#ef4444;color:#fff;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:600;text-align:center}
//         .pp-add-btn{border-radius:14px;border:2px dashed #d4d0f7;background:#fafbff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;padding:24px;transition:all .2s;min-height:160px}
//         .pp-add-btn:hover{border-color:#4f46e5;background:#f0f0ff}
//         .pp-add-btn.disabled{opacity:.4;cursor:not-allowed;pointer-events:none}
//         .pp-add-icon{width:40px;height:40px;border-radius:50%;background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:20px}
//         .pp-add-text{font-size:12px;font-weight:600;color:#4f46e5;text-align:center}
//         .pp-add-sub{font-size:10px;color:#aaa;text-align:center}
//         .pp-limits{display:flex;gap:10px;flex-wrap:wrap}
//         .pp-limit-chip{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:600;background:#f9f9f8;border:1.5px solid #efefef}
//         .pp-limit-dot{width:8px;height:8px;border-radius:50%}
//         .pp-save-btn{width:100%;padding:15px;border-radius:14px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;font-size:15px;font-weight:700;font-family:inherit;border:none;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(79,70,229,.28)}
//         .pp-save-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(79,70,229,.36)}
//         .pp-save-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
//         .pp-type-badge{position:absolute;top:8px;left:8px;padding:3px 8px;border-radius:6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;z-index:2}
//         .pp-type-reel{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff}
//         .pp-type-post{background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff}
//         .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;z-index:9999;animation:toastIn .3s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.12)}
//         .toast.success{background:#111;color:#fff}
//         .toast.error{background:#ef4444;color:#fff}
//         .pp-empty{text-align:center;padding:32px 16px;color:#aaa;font-size:13px}
//         @media(max-width:480px){.pp-grid{grid-template-columns:1fr 1fr}}
//       `}</style>

//       {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

//       <div className="pp">
//         <div className="pp-hdr">
//           <div className="pp-hdr-left">
//             <h1>My Portfolio</h1>
//             <p>Showcase your best work to brands</p>
//           </div>
//           <a href="/my-profile" className="pp-back">← Back</a>
//         </div>

//         <div className="pp-body">

//           {/* Limits info */}
//           <div className="pp-limits">
//             <div className="pp-limit-chip">
//               <div className="pp-limit-dot" style={{ background: reels.length >= MAX_REELS ? "#ef4444" : "#4f46e5" }} />
//               <span style={{ color: reels.length >= MAX_REELS ? "#ef4444" : "#555" }}>
//                 Reels: {reels.length}/{MAX_REELS}
//               </span>
//             </div>
//             <div className="pp-limit-chip">
//               <div className="pp-limit-dot" style={{ background: posts.length >= MAX_POSTS ? "#ef4444" : "#f59e0b" }} />
//               <span style={{ color: posts.length >= MAX_POSTS ? "#ef4444" : "#555" }}>
//                 Posts: {posts.length}/{MAX_POSTS}
//               </span>
//             </div>
//             <div className="pp-limit-chip">
//               <div className="pp-limit-dot" style={{ background: "#16a34a" }} />
//               <span style={{ color: "#555" }}>Max 10MB per file</span>
//             </div>
//           </div>

//           {/* REELS */}
//           <div className="pp-section">
//             <div className="pp-section-hdr">
//               <div className="pp-section-title">🎬 Reels</div>
//               <div className="pp-section-count">{reels.length}/{MAX_REELS} added</div>
//             </div>
//             <div className="pp-grid">
//               {reels.map(item => (
//                 <div key={item.id} className="pp-card">
//                   <div className="pp-type-badge pp-type-reel">Reel</div>
//                   {item.uploading && (
//                     <div className="pp-uploading-overlay">
//                       <div className="pp-spinner" />
//                       <div className="pp-upload-text">Uploading...</div>
//                     </div>
//                   )}
//                   {item.error && <div className="pp-error-badge">⚠️ {item.error}</div>}
//                   <button className="pp-remove" onClick={() => removeItem(item.id)}>✕</button>
//                   {item.preview && (
//                     item.file?.type.startsWith("video") || item.url?.includes(".mp4") || item.url?.includes("video") ? (
//                       <video className="pp-media" src={item.preview} controls muted playsInline style={{aspectRatio:"9/16"}} />
//                     ) : (
//                       <img className="pp-media" src={item.preview} alt="reel" />
//                     )
//                   )}
//                   <div className="pp-card-body">
//                     <textarea
//                       className="pp-caption"
//                       rows={2}
//                       placeholder="Add caption..."
//                       value={item.caption}
//                       onChange={e => updateCaption(item.id, e.target.value)}
//                     />
//                   </div>
//                 </div>
//               ))}

//               {/* Add reel button */}
//               <div
//                 className={`pp-add-btn ${!canAddReel ? "disabled" : ""}`}
//                 onClick={() => canAddReel && reelInputRef.current?.click()}
//               >
//                 <div className="pp-add-icon">🎬</div>
//                 <div className="pp-add-text">{canAddReel ? "Add Reel" : "Limit Reached"}</div>
//                 <div className="pp-add-sub">MP4, MOV • Max 10MB</div>
//               </div>
//             </div>
//             <input
//               ref={reelInputRef}
//               type="file"
//               accept="video/*,image/*"
//               multiple
//               style={{ display: "none" }}
//               onChange={e => handleFileSelect(e, "reel")}
//             />
//           </div>

//           {/* POSTS */}
//           <div className="pp-section">
//             <div className="pp-section-hdr">
//               <div className="pp-section-title">📸 Posts</div>
//               <div className="pp-section-count">{posts.length}/{MAX_POSTS} added</div>
//             </div>
//             <div className="pp-grid">
//               {posts.map(item => (
//                 <div key={item.id} className="pp-card">
//                   <div className="pp-type-badge pp-type-post">Post</div>
//                   {item.uploading && (
//                     <div className="pp-uploading-overlay">
//                       <div className="pp-spinner" />
//                       <div className="pp-upload-text">Uploading...</div>
//                     </div>
//                   )}
//                   {item.error && <div className="pp-error-badge">⚠️ {item.error}</div>}
//                   <button className="pp-remove" onClick={() => removeItem(item.id)}>✕</button>
//                   {item.preview && (
//                     <img className={`pp-media pp-media-post`} src={item.preview} alt="post" />
//                   )}
//                   <div className="pp-card-body">
//                     <textarea
//                       className="pp-caption"
//                       rows={2}
//                       placeholder="Add caption..."
//                       value={item.caption}
//                       onChange={e => updateCaption(item.id, e.target.value)}
//                     />
//                   </div>
//                 </div>
//               ))}

//               {/* Add post button */}
//               <div
//                 className={`pp-add-btn ${!canAddPost ? "disabled" : ""}`}
//                 onClick={() => canAddPost && postInputRef.current?.click()}
//               >
//                 <div className="pp-add-icon">📸</div>
//                 <div className="pp-add-text">{canAddPost ? "Add Post" : "Limit Reached"}</div>
//                 <div className="pp-add-sub">JPG, PNG, WebP • Max 10MB</div>
//               </div>
//             </div>
//             <input
//               ref={postInputRef}
//               type="file"
//               accept="image/*"
//               multiple
//               style={{ display: "none" }}
//               onChange={e => handleFileSelect(e, "post")}
//             />
//           </div>

//           {/* Save button */}
//           <button
//             className="pp-save-btn"
//             disabled={saving || items.length === 0}
//             onClick={handleSave}
//           >
//             {saving ? (
//               <>
//                 <div style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
//                 {totalUploading > 0 ? `Uploading ${totalUploading} file${totalUploading > 1 ? "s" : ""}...` : "Saving..."}
//               </>
//             ) : "💾 Save Portfolio"}
//           </button>

//           <div style={{ textAlign: "center", fontSize: 12, color: "#bbb", paddingBottom: 8 }}>
//             Brands will see your portfolio when viewing your profile
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }