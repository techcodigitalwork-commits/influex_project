"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = "http://54.252.201.93:5000/api";

export default function LandingPage() {
  const [cities, setCities] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const cityImages: Record<string, string> = {
    mumbai:    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&q=80&auto=format&fit=crop",
    delhi:     "https://images.unsplash.com/photo-1587474260584-1f20d4296c06?w=600&q=80&auto=format&fit=crop",
    bangalore: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80&auto=format&fit=crop",
    bengaluru: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80&auto=format&fit=crop",
    hyderabad: "https://images.unsplash.com/photo-1563448927898-d4d58a65db7c?w=600&q=80&auto=format&fit=crop",
    chennai:   "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80&auto=format&fit=crop",
    kolkata:   "https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80&auto=format&fit=crop",
    pune:      "https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=600&q=80&auto=format&fit=crop",
    ahmedabad: "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&q=80&auto=format&fit=crop",
    jaipur:    "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600&q=80&auto=format&fit=crop",
    indore:    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80&auto=format&fit=crop",
    surat:     "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&q=80&auto=format&fit=crop",
    lucknow:   "https://images.unsplash.com/photo-1582896911227-c966dc4f8587?w=600&q=80&auto=format&fit=crop",
    nagpur:    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop",
    bhopal:    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop",
    chandigarh:"https://images.unsplash.com/photo-1614607498069-7ae04e43a4a2?w=600&q=80&auto=format&fit=crop",
    kochi:     "https://images.unsplash.com/photo-1609920658906-8223bd289001?w=600&q=80&auto=format&fit=crop",
    goa:       "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80&auto=format&fit=crop",
  };
  const defaultCity = "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&q=80&auto=format&fit=crop";

  const catMeta: Record<string, { emoji: string; color: string; bg: string }> = {
    fashion:     { emoji:"👗", color:"#be185d", bg:"#fdf2f8" },
    beauty:      { emoji:"💄", color:"#9333ea", bg:"#faf5ff" },
    fitness:     { emoji:"💪", color:"#16a34a", bg:"#f0fdf4" },
    food:        { emoji:"🍕", color:"#ea580c", bg:"#fff7ed" },
    travel:      { emoji:"✈️", color:"#0284c7", bg:"#f0f9ff" },
    tech:        { emoji:"💻", color:"#4f46e5", bg:"#eef2ff" },
    lifestyle:   { emoji:"🌟", color:"#d97706", bg:"#fffbeb" },
    gaming:      { emoji:"🎮", color:"#7c3aed", bg:"#f5f3ff" },
    music:       { emoji:"🎵", color:"#0891b2", bg:"#ecfeff" },
    sports:      { emoji:"⚽", color:"#15803d", bg:"#f0fdf4" },
    education:   { emoji:"📚", color:"#1d4ed8", bg:"#eff6ff" },
    comedy:      { emoji:"😂", color:"#ca8a04", bg:"#fefce8" },
    dance:       { emoji:"💃", color:"#db2777", bg:"#fdf2f8" },
    photography: { emoji:"📷", color:"#374151", bg:"#f9fafb" },
    art:         { emoji:"🎨", color:"#7c3aed", bg:"#f5f3ff" },
    business:    { emoji:"💼", color:"#334155", bg:"#f8fafc" },
  };

  useEffect(() => {
    const user = localStorage.getItem("cb_user");
    if (user) setIsLoggedIn(true);

    Promise.all([
      fetch(`${API}/meta/cities`).then(r => r.json()).catch(() => ({})),
      fetch(`${API}/meta/categories`).then(r => r.json()).catch(() => ({})),
    ]).then(([cd, ctd]) => {
      const rawCities = cd.data || cd.cities || (Array.isArray(cd) ? cd : []);
      const rawCats   = ctd.data || ctd.categories || (Array.isArray(ctd) ? ctd : []);

      const seenC = new Set<string>();
      const uniqueCities = rawCities.filter((c: any) => {
        const nm = (typeof c === "string" ? c : c?.name || c?.city || "").toLowerCase().trim();
        if (!nm || seenC.has(nm)) return false;
        seenC.add(nm); return true;
      }).slice(0, 6);

      const seenCat = new Set<string>();
      const uniqueCats = rawCats.filter((c: any) => {
        const nm = (typeof c === "string" ? c : c?.name || c?.category || "").toLowerCase().trim();
        if (!nm || seenCat.has(nm)) return false;
        seenCat.add(nm); return true;
      });

      setCities(uniqueCities);
      setCategories(uniqueCats);
    }).finally(() => setLoadingMeta(false));
  }, []);

  const name  = (v: any) => typeof v === "string" ? v : v?.name || v?.city || v?.category || "";
  const count = (v: any) => typeof v === "string" ? null : v?.count || v?.creators || null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }

        /* ─── NAV — only for logged-out ─── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          height: 68px;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(0,0,0,0.07);
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 48px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        @media(max-width:600px){ .lp-nav{ padding: 0 20px; } }

        .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
        .nav-logo-box {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 900; font-size: 14px;
          box-shadow: 0 4px 12px rgba(79,70,229,0.35);
        }
        .nav-logo-text { font-size: 17px; font-weight: 800; color: #111; white-space: nowrap; }
        .nav-right { display: flex; align-items: center; gap: 8px; }
        .nav-login {
          padding: 8px 18px; border-radius: 10px;
          border: 1.5px solid #e5e7eb; color: #374151;
          font-size: 13px; font-weight: 600; text-decoration: none; transition: all 0.18s;
        }
        .nav-login:hover { border-color: #4f46e5; color: #4f46e5; background: #faf5ff; }
        .nav-signup {
          padding: 8px 18px; border-radius: 10px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff; font-size: 13px; font-weight: 700;
          text-decoration: none; transition: all 0.18s;
          box-shadow: 0 2px 10px rgba(79,70,229,0.3);
        }
        .nav-signup:hover { opacity: 0.9; transform: translateY(-1px); }

        /* ─── HERO ─── */
        /* ✅ KEY FIX: when logged in, no padding-top (app navbar handles it via sticky)
           when logged out, padding-top = 68px for our fixed lp-nav */
        .hero-logged-out {
          padding-top: 68px;
          background: #07070f;
          min-height: 100vh;
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .hero-logged-in {
          padding-top: 0;
          background: #07070f;
          min-height: 60vh;
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .hero-glow1 {
          position: absolute; top: 10%; left: -5%;
          width: 45vw; height: 45vw; max-width: 600px; max-height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 68%);
          pointer-events: none;
        }
        .hero-glow2 {
          position: absolute; bottom: 5%; right: -5%;
          width: 40vw; height: 40vw; max-width: 500px; max-height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 68%);
          pointer-events: none;
        }
        .hero-grid-lines {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 60px 60px;
          pointer-events: none;
        }

        .hero-body {
          flex: 1; max-width: 1200px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr;
          align-items: center; gap: 48px;
          padding: 72px 48px;
          position: relative; z-index: 2;
        }
        @media(max-width:960px){ .hero-body { grid-template-columns: 1fr; padding: 48px 24px; gap: 0; text-align: center; } }
        @media(max-width:480px){ .hero-body { padding: 36px 20px; } }

        .hero-badge {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(79,70,229,0.12);
          border: 1px solid rgba(99,102,241,0.3);
          color: #a5b4fc; font-size: 12px; font-weight: 700;
          padding: 6px 14px; border-radius: 100px; margin-bottom: 28px;
          letter-spacing: 0.02em;
        }
        .hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(0.8)} }

        .hero-h1 {
          font-size: 56px; font-weight: 900; line-height: 1.06;
          color: #f9fafb; margin-bottom: 22px; letter-spacing: -0.02em;
        }
        .hero-h1-grad {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        @media(max-width:1100px){ .hero-h1 { font-size: 44px; } }
        @media(max-width:960px) { .hero-h1 { font-size: 38px; } }
        @media(max-width:480px) { .hero-h1 { font-size: 30px; } }

        .hero-p {
          font-size: 16px; color: #9ca3af; line-height: 1.75;
          margin-bottom: 36px; max-width: 460px; font-weight: 400;
        }
        @media(max-width:960px){ .hero-p { margin: 0 auto 32px; } }
        @media(max-width:480px){ .hero-p { font-size: 14px; } }

        .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
        @media(max-width:960px){ .hero-btns { justify-content: center; } }

        .hbtn-primary {
          padding: 13px 26px; border-radius: 12px;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #fff; font-size: 14px; font-weight: 600;
          text-decoration: none; display: inline-block;
          box-shadow: 0 4px 20px rgba(79,70,229,0.45); transition: all 0.2s;
        }
        .hbtn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,70,229,0.55); }

        .hbtn-outline {
          padding: 13px 26px; border-radius: 12px;
          border: 1.5px solid rgba(255,255,255,0.12);
          color: #d1d5db; font-size: 14px; font-weight: 500;
          text-decoration: none; display: inline-block; transition: all 0.2s;
        }
        .hbtn-outline:hover { border-color: rgba(255,255,255,0.3); color: #fff; background: rgba(255,255,255,0.05); }

        .hero-stats { display: flex; gap: 32px; margin-top: 44px; flex-wrap: wrap; }
        @media(max-width:960px){ .hero-stats { justify-content: center; } }
        .hstat-n { font-size: 26px; font-weight: 800; color: #f9fafb; }
        .hstat-l { font-size: 12px; color: #6b7280; margin-top: 3px; font-weight: 500; }

        .hero-imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media(max-width:960px){ .hero-imgs { display: none; } }

        .hi-card { border-radius: 20px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .hi-card:nth-child(1){ margin-top: 48px; }
        .hi-card img { width: 100%; height: 260px; object-fit: cover; display: block; }

        .hi-overlay-card {
          background: rgba(15,14,30,0.9); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; padding: 12px 16px;
          margin-top: -16px; margin-left: 12px; margin-right: 12px;
          display: flex; align-items: center; gap: 10px;
        }
        .hi-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#c084fc); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:14px; flex-shrink:0; }
        .hi-name { font-size: 13px; font-weight: 700; color: #f9fafb; }
        .hi-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
        .hi-badge-green { background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; margin-left: auto; }

        /* Trust strip */
        .trust-strip {
          background: #0d0c1a; border-top: 1px solid #1e1b38;
          padding: 16px 48px;
          display: flex; align-items: center; justify-content: center;
          gap: 28px; flex-wrap: wrap; position: relative; z-index: 2;
        }
        @media(max-width:600px){ .trust-strip { padding: 14px 20px; gap: 14px; } }
        .trust-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #6b7280; font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif; }

        /* ─── LIGHT SECTIONS ─── */
        .sec { padding: 88px 48px; font-family: 'Plus Jakarta Sans', sans-serif; }
        @media(max-width:600px){ .sec { padding: 56px 20px; } }
        .sec-in { max-width: 1100px; margin: 0 auto; }

        .eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 700; color: #4f46e5;
          text-transform: uppercase; letter-spacing: 0.12em;
          margin-bottom: 12px; background: #eef2ff; padding: 5px 12px; border-radius: 100px;
        }
        .sec-h2 { font-size: 36px; font-weight: 800; color: #0f172a; line-height: 1.15; margin-bottom: 12px; letter-spacing: -0.02em; }
        @media(max-width:600px){ .sec-h2 { font-size: 26px; } }
        .sec-p { font-size: 15px; color: #64748b; line-height: 1.7; max-width: 520px; margin-bottom: 44px; font-weight: 400; }
        @media(max-width:600px){ .sec-p { font-size: 14px; margin-bottom: 32px; } }

        /* Steps */
        .steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
        @media(max-width:768px){ .steps-grid { grid-template-columns: 1fr; gap: 12px; } }

        .step-c { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 20px; padding: 28px 24px; position: relative; overflow: hidden; transition: all 0.25s; }
        .step-c:hover { border-color: #c7d2fe; box-shadow: 0 16px 48px rgba(79,70,229,0.1); transform: translateY(-4px); }
        .step-ghost { position: absolute; top: -16px; right: 14px; font-size: 80px; font-weight: 900; line-height: 1; color: rgba(79,70,229,0.05); pointer-events: none; }
        .step-num { width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; font-size: 17px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .step-t { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
        .step-d { font-size: 13px; color: #64748b; line-height: 1.75; font-weight: 400; }

        /* Features */
        .feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        @media(max-width:768px){ .feat-grid { grid-template-columns: 1fr; gap: 10px; } }

        .feat-c { background: linear-gradient(135deg, #fafafa 0%, #f8f5ff 100%); border: 1.5px solid #e2e8f0; border-radius: 18px; padding: 24px; transition: all 0.22s; }
        .feat-c:hover { border-color: #c7d2fe; transform: translateY(-3px); box-shadow: 0 12px 36px rgba(79,70,229,0.08); }
        .feat-ico { font-size: 28px; margin-bottom: 14px; }
        .feat-t { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 7px; }
        .feat-d { font-size: 13px; color: #64748b; line-height: 1.7; font-weight: 400; }

        /* Categories */
        .cats-g { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; }
        @media(max-width:480px){ .cats-g { grid-template-columns: repeat(3,1fr); gap: 8px; } }
        .cat-c { border-radius: 14px; padding: 18px 10px; display: flex; flex-direction: column; align-items: center; gap: 7px; text-decoration: none; transition: all 0.2s; border: 1.5px solid transparent; }
        .cat-c:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .cat-emo { font-size: 26px; }
        .cat-nm { font-size: 12px; font-weight: 600; text-align: center; }

        /* Cities */
        .cities-g { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; }
        @media(max-width:768px){ .cities-g { grid-template-columns: repeat(2,1fr); } }
        @media(max-width:420px){ .cities-g { gap: 8px; } }

        .city-c { position: relative; height: 200px; border-radius: 18px; overflow: hidden; text-decoration: none; display: block; box-shadow: 0 4px 24px rgba(0,0,0,0.12); transition: transform 0.25s; }
        .city-c:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.18); }
        @media(max-width:600px){ .city-c { height: 140px; border-radius: 14px; } }
        .city-img { width:100%; height:100%; object-fit:cover; display:block; transition: transform 0.55s ease; }
        .city-c:hover .city-img { transform: scale(1.07); }
        .city-ov { position:absolute; inset:0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 55%, transparent 100%); }
        .city-info { position:absolute; bottom:14px; left:14px; color:#fff; }
        .city-nm { font-size:16px; font-weight:700; line-height:1; }
        .city-ct { font-size:11px; opacity:.8; margin-top:3px; font-weight:500; }

        /* Testimonials */
        .test-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 18px; }
        @media(max-width:768px){ .test-grid { grid-template-columns: 1fr; gap: 12px; } }
        .test-c { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 18px; padding: 24px; transition: all 0.22s; }
        .test-c:hover { border-color: #c7d2fe; box-shadow: 0 12px 36px rgba(79,70,229,0.08); transform: translateY(-3px); }
        .test-stars { color: #f59e0b; font-size: 14px; margin-bottom: 12px; letter-spacing: 2px; }
        .test-q { font-size: 13px; color: #374151; line-height: 1.75; margin-bottom: 18px; font-style: italic; font-weight: 400; }
        .test-au { display: flex; align-items: center; gap: 10px; }
        .test-av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 14px; flex-shrink: 0; }
        .test-nm { font-size: 13px; font-weight: 700; color: #111; }
        .test-rl { font-size: 11px; color: #9ca3af; margin-top: 1px; }

        /* Skeleton */
        .skel { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 14px; }
        @keyframes shimmer { to { background-position: -200% 0; } }

        /* CTA */
        .cta-wrap { padding: 0 48px 88px; font-family: 'Plus Jakarta Sans', sans-serif; }
        @media(max-width:600px){ .cta-wrap { padding: 0 20px 56px; } }
        .cta-box { max-width: 1100px; margin: 0 auto; background: #07070f; border-radius: 24px; padding: 80px 48px; text-align: center; position: relative; overflow: hidden; border: 1px solid rgba(79,70,229,0.25); }
        @media(max-width:600px){ .cta-box { padding: 48px 20px; border-radius: 18px; } }
        .cta-glow { position: absolute; top: -80px; left: 50%; transform: translateX(-50%); width: 500px; height: 400px; background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 65%); pointer-events: none; }
        .cta-gl2 { position: absolute; bottom: -60px; left: 10%; width: 300px; height: 300px; background: radial-gradient(circle, rgba(192,132,252,0.12) 0%, transparent 65%); pointer-events: none; }
        .cta-grid-lines { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 50px 50px; pointer-events: none; }
        .cta-h2 { font-size: 40px; font-weight: 800; color: #f9fafb; line-height: 1.1; margin-bottom: 14px; position: relative; z-index: 1; letter-spacing: -0.02em; }
        @media(max-width:600px){ .cta-h2 { font-size: 26px; } }
        .cta-h2 span { background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .cta-p { font-size: 15px; color: #9ca3af; margin-bottom: 36px; position: relative; z-index: 1; font-weight: 400; }
        .cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; position: relative; z-index: 1; }
        .cta-btn-w { padding: 13px 28px; border-radius: 12px; background: #fff; color: #4f46e5; font-size: 14px; font-weight: 700; text-decoration: none; transition: all 0.2s; display: inline-block; }
        .cta-btn-w:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,255,255,0.2); }
        .cta-btn-b { padding: 13px 28px; border-radius: 12px; border: 1.5px solid rgba(255,255,255,0.15); color: #d1d5db; font-size: 14px; font-weight: 500; text-decoration: none; transition: all 0.2s; display: inline-block; }
        .cta-btn-b:hover { border-color: rgba(255,255,255,0.35); color: #fff; }

        /* Footer */
        .footer { background: #fafafa; border-top: 1px solid #e5e7eb; padding: 44px 48px 28px; font-family: 'Plus Jakarta Sans', sans-serif; }
        @media(max-width:600px){ .footer { padding: 32px 20px 20px; } }
        .footer-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 28px; margin-bottom: 36px; }
        .footer-brand { max-width: 240px; }
        .footer-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; margin-bottom: 10px; }
        .footer-logo-box { width: 30px; height: 30px; border-radius: 8px; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 12px; flex-shrink: 0; }
        .footer-logo-text { font-size: 15px; font-weight: 700; color: #111; }
        .footer-tagline { font-size: 12px; color: #9ca3af; line-height: 1.6; font-weight: 400; }
        .footer-links-col h4 { font-size: 12px; font-weight: 700; color: #111; margin-bottom: 12px; }
        .footer-links-col a { display: block; font-size: 13px; color: #9ca3af; text-decoration: none; margin-bottom: 9px; transition: color 0.15s; font-weight: 400; }
        .footer-links-col a:hover { color: #4f46e5; }
        .footer-bottom { border-top: 1px solid #e5e7eb; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .footer-copy { font-size: 12px; color: #9ca3af; font-weight: 400; }
      `}</style>

      {/* ✅ Landing page ka nav — ONLY when logged out */}
      {!isLoggedIn && (
        <nav className="lp-nav">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-box">CB</div>
            <span className="nav-logo-text">CreatorBridge</span>
          </Link>
          <div className="nav-right">
            <Link href="/login" className="nav-login">LogIn</Link>
            <Link href="/signup" className="nav-signup">SignUp →</Link>
          </div>
        </nav>
      )}

      {/* ✅ HERO — padding-top only when logged out (for fixed lp-nav) */}
      <section className={isLoggedIn ? "hero-logged-in" : "hero-logged-out"}>
        <div className="hero-glow1" />
        <div className="hero-glow2" />
        <div className="hero-grid-lines" />

        <div className="hero-body">
          <div>
            <div className="hero-badge">
              <span className="hero-badge-dot" />
              🇮🇳 India's #1 Creator Marketplace
            </div>
            <h1 className="hero-h1">
              Where Brands<br />
              Meet <span className="hero-h1-grad">Top Creators</span>
            </h1>
            <p className="hero-p">
              Connect with influencers, models & photographers across India. Launch campaigns, receive proposals, and grow — all in one platform.
            </p>
            <div className="hero-btns">
              {isLoggedIn ? (
                <>
                  <Link href="/discovery" className="hbtn-primary">Go to Dashboard →</Link>
                  <Link href="/discovery" className="hbtn-outline">Browse Campaigns</Link>
                </>
              ) : (
                <>
                  <Link href="/join" className="hbtn-primary">Start as a Brand →</Link>
                  <Link href="/join" className="hbtn-outline">Join as Creator</Link>
                </>
              )}
            </div>
            <div className="hero-stats">
              {[["10K+","Creators"],["500+","Campaigns"],["50+","Cities"],["₹2Cr+","Paid Out"]].map(([n,l]) => (
                <div key={l}>
                  <div className="hstat-n">{n}</div>
                  <div className="hstat-l">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-imgs">
            <div>
              <div className="hi-card">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80&auto=format&fit=crop" alt="Creator" />
              </div>
              <div className="hi-overlay-card">
                <div className="hi-av">R</div>
                <div>
                  <div className="hi-name">Riya Sharma</div>
                  <div className="hi-meta">Fashion · Mumbai · 45K followers</div>
                </div>
                <span className="hi-badge-green">Active</span>
              </div>
            </div>
            <div>
              <div className="hi-card" style={{marginTop:"40px"}}>
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80&auto=format&fit=crop" alt="Creator" />
              </div>
              <div className="hi-overlay-card">
                <div className="hi-av" style={{background:"linear-gradient(135deg,#0891b2,#7c3aed)"}}>A</div>
                <div>
                  <div className="hi-name">Arjun Mehta</div>
                  <div className="hi-meta">Tech · Delhi · 82K followers</div>
                </div>
                <span className="hi-badge-green">Active</span>
              </div>
            </div>
          </div>
        </div>

        <div className="trust-strip">
          {[["✓","Verified Creators"],["🔒","Secure Payments"],["💬","Real-time Chat"],["📊","Analytics"],["🌏","Pan-India"]].map(([ic,tx]) => (
            <div key={tx} className="trust-item"><span>{ic}</span><span>{tx}</span></div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="sec" style={{background:"#f8fafc"}}>
        <div className="sec-in">
          <div className="eyebrow">⚡ How It Works</div>
          <h2 className="sec-h2">From Signup to<br/>First Collab in Minutes</h2>
          <p className="sec-p">A seamless workflow designed for both brands and creators</p>
          <div className="steps-grid">
            {[
              {n:"1",t:"Create Your Profile",d:"Sign up, add your niche, city, followers & portfolio. Your profile is your brand — make it shine."},
              {n:"2",t:"Discover Campaigns",d:"Browse live campaigns filtered by category, budget & location. Find the perfect brand match."},
              {n:"3",t:"Apply & Get Paid",d:"Submit your bid & proposal. Get accepted, create content, and receive payment directly."},
            ].map(s => (
              <div key={s.n} className="step-c">
                <div className="step-ghost">{s.n}</div>
                <div className="step-num">{s.n}</div>
                <div className="step-t">{s.t}</div>
                <p className="step-d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="sec">
        <div className="sec-in">
          <div className="eyebrow">🛠 Features</div>
          <h2 className="sec-h2">Everything You Need<br/>to Collaborate</h2>
          <p className="sec-p">Built for the Indian creator economy</p>
          <div className="feat-grid">
            {[
              {i:"🎯",t:"Smart Matching",d:"AI-powered campaign matching based on your niche, location, and follower count."},
              {i:"💬",t:"Real-time Messaging",d:"WhatsApp-style chat between brands and creators. Discuss, negotiate, collaborate."},
              {i:"📋",t:"Campaign Board",d:"Manage all your active campaigns with applications, status tracking, and analytics."},
              {i:"🔒",t:"Secure Payments",d:"Bid-based system with transparent platform fees. Know exactly what you'll earn."},
              {i:"📊",t:"Analytics Dashboard",d:"Track campaign performance, application rates, and earnings in one place."},
              {i:"🌟",t:"Verified Profiles",d:"All creators are verified with real follower counts and authentic portfolios."},
            ].map(f => (
              <div key={f.t} className="feat-c">
                <div className="feat-ico">{f.i}</div>
                <div className="feat-t">{f.t}</div>
                <p className="feat-d">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="sec" style={{background:"#f8fafc"}}>
        <div className="sec-in">
          <div className="eyebrow">🎨 Browse by Niche</div>
          <h2 className="sec-h2">Every Category,<br/>Every Creator</h2>
          <p className="sec-p">From fashion to fintech — find creators across all industries</p>
          {loadingMeta ? (
            <div className="cats-g">{Array.from({length:12}).map((_,i)=><div key={i} className="skel" style={{height:"80px"}}/>)}</div>
          ) : (
            <div className="cats-g">
              {categories.map((cat:any) => {
                const nm = name(cat);
                const key = nm.toLowerCase();
                const m = catMeta[key] || {emoji:"✨", color:"#4f46e5", bg:"#eef2ff"};
                return (
                  <Link key={nm} href="/login" className="cat-c" style={{background:m.bg}}>
                    <span className="cat-emo">{m.emoji}</span>
                    <span className="cat-nm" style={{color:m.color}}>{nm.charAt(0).toUpperCase()+nm.slice(1)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CITIES */}
      <section className="sec">
        <div className="sec-in">
          <div className="eyebrow">📍 Local Talent</div>
          <h2 className="sec-h2">Creators Across<br/>Every City</h2>
          <p className="sec-p">Hyper-local campaigns with creators who know your market</p>
          {loadingMeta ? (
            <div className="cities-g">{Array.from({length:6}).map((_,i)=><div key={i} className="skel" style={{height:"200px"}}/>)}</div>
          ) : (
            <div className="cities-g">
              {cities.map((city:any) => {
                const nm = name(city);
                const ct = count(city);
                const img = cityImages[nm.toLowerCase()] || defaultCity;
                return (
                  <Link key={nm} href="/login" className="city-c">
                    <img src={img} className="city-img" alt={nm} />
                    <div className="city-ov" />
                    <div className="city-info">
                      <div className="city-nm">{nm.charAt(0).toUpperCase()+nm.slice(1)}</div>
                      {ct && <div className="city-ct">{ct} Creators</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="sec" style={{background:"#f8fafc"}}>
        <div className="sec-in">
          <div className="eyebrow">❤️ Loved By Creators</div>
          <h2 className="sec-h2">What They're Saying</h2>
          <p className="sec-p">Thousands of creators and brands trust CreatorBridge</p>
          <div className="test-grid">
            {[
              {q:"CreatorBridge helped me land my first brand deal within a week! The application process is so smooth.",au:"Priya Verma",rl:"Fashion Creator · Mumbai · 32K followers",av:"P",ac:"linear-gradient(135deg,#be185d,#9333ea)"},
              {q:"As a brand, we found 5 perfect creators for our campaign in just 2 days. The quality of applicants is amazing.",au:"Rahul Gupta",rl:"Marketing Head · TechCorp India",av:"R",ac:"linear-gradient(135deg,#4f46e5,#0891b2)"},
              {q:"The messaging feature makes collaboration so easy. I can negotiate and discuss deliverables all in one place.",au:"Ananya Singh",rl:"Lifestyle Creator · Delhi · 58K followers",av:"A",ac:"linear-gradient(135deg,#ea580c,#f59e0b)"},
            ].map(t => (
              <div key={t.au} className="test-c">
                <div className="test-stars">★★★★★</div>
                <p className="test-q">"{t.q}"</p>
                <div className="test-au">
                  <div className="test-av" style={{background:t.ac}}>{t.av}</div>
                  <div>
                    <div className="test-nm">{t.au}</div>
                    <div className="test-rl">{t.rl}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="cta-wrap">
        <div className="cta-box">
          <div className="cta-glow" /><div className="cta-gl2" /><div className="cta-grid-lines" />
          <h2 className="cta-h2">Ready to <span>Bridge the Gap?</span></h2>
          <p className="cta-p">Join 10,000+ creators and 500+ brands. Free to get started.</p>
          <div className="cta-btns">
            {isLoggedIn ? (
              <>
                <Link href="/campaigns" className="cta-btn-w">Go to Dashboard →</Link>
                <Link href="/discovery" className="cta-btn-b">Browse Campaigns</Link>
              </>
            ) : (
              <>
                <Link href="/join" className="cta-btn-w">Start for Free →</Link>
                <Link href="/login" className="cta-btn-b">Already have an account</Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand">
            <Link href="/" className="footer-logo">
              <div className="footer-logo-box">CB</div>
              <span className="footer-logo-text">CreatorBridge</span>
            </Link>
            <p className="footer-tagline">India's premier platform connecting brands with top creators.</p>
          </div>
          <div className="footer-links-col">
            <h4>Platform</h4>
            <Link href="/login">Browse Campaigns</Link>
            <Link href="/signup">For Creators</Link>
            <Link href="/signup">For Brands</Link>
          </div>
          <div className="footer-links-col">
            <h4>Account</h4>
            <Link href="/login">Log In</Link>
            <Link href="/signup">Sign Up Free</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 CreatorBridge. All rights reserved.</span>
          <span className="footer-copy">Made with ❤️ for Indian Creators</span>
        </div>
      </footer>
    </>
  );
}


// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API = "http://54.252.201.93:5000/api";

// export default function LandingPage() {
//   const [cities, setCities] = useState<any[]>([]);
//   const [categories, setCategories] = useState<any[]>([]);
//   const [loadingMeta, setLoadingMeta] = useState(true);

//   const cityImages: Record<string, string> = {
//     mumbai:    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=600&q=80&auto=format&fit=crop",
//     delhi:     "https://images.unsplash.com/photo-1587474260584-1f20d4296c06?w=600&q=80&auto=format&fit=crop",
//     bangalore: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80&auto=format&fit=crop",
//     bengaluru: "https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=600&q=80&auto=format&fit=crop",
//     hyderabad: "https://images.unsplash.com/photo-1563448927898-d4d58a65db7c?w=600&q=80&auto=format&fit=crop",
//     chennai:   "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=600&q=80&auto=format&fit=crop",
//     kolkata:   "https://images.unsplash.com/photo-1558431382-27e303142255?w=600&q=80&auto=format&fit=crop",
//     pune:      "https://images.unsplash.com/photo-1588416936097-41850ab3d86d?w=600&q=80&auto=format&fit=crop",
//     ahmedabad: "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&q=80&auto=format&fit=crop",
//     jaipur:    "https://images.unsplash.com/photo-1599661046289-e31897846e41?w=600&q=80&auto=format&fit=crop",
//     // ✅ Indian tier-2 cities with correct images
//     indore:    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=600&q=80&auto=format&fit=crop",
//     surat:     "https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=600&q=80&auto=format&fit=crop",
//     lucknow:   "https://images.unsplash.com/photo-1582896911227-c966dc4f8587?w=600&q=80&auto=format&fit=crop",
//     nagpur:    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop",
//     bhopal:    "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80&auto=format&fit=crop",
//     chandigarh:"https://images.unsplash.com/photo-1614607498069-7ae04e43a4a2?w=600&q=80&auto=format&fit=crop",
//     kochi:     "https://images.unsplash.com/photo-1609920658906-8223bd289001?w=600&q=80&auto=format&fit=crop",
//     goa:       "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=80&auto=format&fit=crop",
//   };
//   // Fallback: Taj Mahal / India skyline
//   const defaultCity = "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=600&q=80&auto=format&fit=crop";

//   const catMeta: Record<string, { emoji: string; color: string; bg: string }> = {
//     fashion:     { emoji:"👗", color:"#be185d", bg:"#fdf2f8" },
//     beauty:      { emoji:"💄", color:"#9333ea", bg:"#faf5ff" },
//     fitness:     { emoji:"💪", color:"#16a34a", bg:"#f0fdf4" },
//     food:        { emoji:"🍕", color:"#ea580c", bg:"#fff7ed" },
//     travel:      { emoji:"✈️", color:"#0284c7", bg:"#f0f9ff" },
//     tech:        { emoji:"💻", color:"#4f46e5", bg:"#eef2ff" },
//     lifestyle:   { emoji:"🌟", color:"#d97706", bg:"#fffbeb" },
//     gaming:      { emoji:"🎮", color:"#7c3aed", bg:"#f5f3ff" },
//     music:       { emoji:"🎵", color:"#0891b2", bg:"#ecfeff" },
//     sports:      { emoji:"⚽", color:"#15803d", bg:"#f0fdf4" },
//     education:   { emoji:"📚", color:"#1d4ed8", bg:"#eff6ff" },
//     comedy:      { emoji:"😂", color:"#ca8a04", bg:"#fefce8" },
//     dance:       { emoji:"💃", color:"#db2777", bg:"#fdf2f8" },
//     photography: { emoji:"📷", color:"#374151", bg:"#f9fafb" },
//     art:         { emoji:"🎨", color:"#7c3aed", bg:"#f5f3ff" },
//     business:    { emoji:"💼", color:"#334155", bg:"#f8fafc" },
//   };

//   const [isLoggedIn, setIsLoggedIn] = useState(false);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     if (user) {
//       setIsLoggedIn(true);
//       // ✅ No redirect — just hide nav, show rest of page
//     }
//     Promise.all([
//       fetch(`${API}/meta/cities`).then(r => r.json()).catch(() => ({})),
//       fetch(`${API}/meta/categories`).then(r => r.json()).catch(() => ({})),
//     ]).then(([cd, ctd]) => {
//       const rawCities = cd.data || cd.cities || (Array.isArray(cd) ? cd : []);
//       const rawCats   = ctd.data || ctd.categories || (Array.isArray(ctd) ? ctd : []);

//       // ✅ Deduplicate cities by lowercase name
//       const seenC = new Set<string>();
//       const uniqueCities = rawCities.filter((c: any) => {
//         const nm = (typeof c === "string" ? c : c?.name || c?.city || "").toLowerCase().trim();
//         if (!nm || seenC.has(nm)) return false;
//         seenC.add(nm);
//         return true;
//       }).slice(0, 6);

//       // ✅ Deduplicate categories by lowercase name
//       const seenCat = new Set<string>();
//       const uniqueCats = rawCats.filter((c: any) => {
//         const nm = (typeof c === "string" ? c : c?.name || c?.category || "").toLowerCase().trim();
//         if (!nm || seenCat.has(nm)) return false;
//         seenCat.add(nm);
//         return true;
//       });

//       setCities(uniqueCities);
//       setCategories(uniqueCats);
//     }).finally(() => setLoadingMeta(false));
//   }, []);

//   const name = (v: any) => typeof v === "string" ? v : v?.name || v?.city || v?.category || "";
//   const count = (v: any) => typeof v === "string" ? null : v?.count || v?.creators || null;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
//         *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
//         html { scroll-behavior: smooth; }

//         /* ─── NAV ─── */
//         .nav {
//           position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
//           height: 68px;
//           background: rgba(255,255,255,0.92);
//           backdrop-filter: blur(20px) saturate(180%);
//           border-bottom: 1px solid rgba(0,0,0,0.07);
//           display: flex; align-items: center; justify-content: space-between;
//           padding: 0 48px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         @media(max-width:600px){ .nav{ padding: 0 20px; } }

//         .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
//         .nav-logo-box {
//           width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
//           background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
//           display: flex; align-items: center; justify-content: center;
//           color: #fff; font-weight: 900; font-size: 14px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//           box-shadow: 0 4px 12px rgba(79,70,229,0.35);
//         }
//         .nav-logo-text { font-size: 17px; font-weight: 800; color: #111; white-space: nowrap; }

//         .nav-right { display: flex; align-items: center; gap: 8px; }
//         .nav-login {
//           padding: 8px 18px; border-radius: 10px;
//           border: 1.5px solid #e5e7eb; color: #374151;
//           font-size: 13px; font-weight: 600; text-decoration: none;
//           transition: all 0.18s;
//         }
//         .nav-login:hover { border-color: #4f46e5; color: #4f46e5; background: #faf5ff; }
//         .nav-signup {
//           padding: 8px 18px; border-radius: 10px;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           color: #fff; font-size: 13px; font-weight: 700;
//           text-decoration: none; transition: all 0.18s;
//           box-shadow: 0 2px 10px rgba(79,70,229,0.3);
//         }
//         .nav-signup:hover { opacity: 0.9; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(79,70,229,0.4); }

//         /* ─── HERO ─── */
//         .hero {
//           min-height: 100vh; padding-top: 68px;
//         }
//         .hero.no-nav {
//           padding-top: 0;
//           background: #07070f;
//           display: flex; flex-direction: column;
//           position: relative; overflow: hidden;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .hero-glow1 {
//           position: absolute; top: 10%; left: -5%;
//           width: 45vw; height: 45vw; max-width: 600px; max-height: 600px;
//           border-radius: 50%;
//           background: radial-gradient(circle, rgba(79,70,229,0.22) 0%, transparent 68%);
//           pointer-events: none;
//         }
//         .hero-glow2 {
//           position: absolute; bottom: 5%; right: -5%;
//           width: 40vw; height: 40vw; max-width: 500px; max-height: 500px;
//           border-radius: 50%;
//           background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 68%);
//           pointer-events: none;
//         }
//         .hero-grid-lines {
//           position: absolute; inset: 0;
//           background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
//                             linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
//           background-size: 60px 60px;
//           pointer-events: none;
//         }

//         .hero-body {
//           flex: 1; max-width: 1200px; margin: 0 auto; width: 100%;
//           display: grid; grid-template-columns: 1fr 1fr;
//           align-items: center; gap: 48px;
//           padding: 72px 48px;
//           position: relative; z-index: 2;
//         }
//         @media(max-width:960px){ .hero-body { grid-template-columns: 1fr; padding: 48px 24px; gap: 0; text-align: center; } }

//         .hero-badge {
//           display: inline-flex; align-items: center; gap: 7px;
//           background: rgba(79,70,229,0.12);
//           border: 1px solid rgba(99,102,241,0.3);
//           color: #a5b4fc; font-size: 12px; font-weight: 700;
//           padding: 6px 14px; border-radius: 100px; margin-bottom: 28px;
//           letter-spacing: 0.02em;
//         }
//         .hero-badge-dot { width: 6px; height: 6px; border-radius: 50%; background: #818cf8; animation: pulse 2s infinite; }
//         @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(0.8)} }

//         .hero-h1 {
//           font-size: 60px; font-weight: 900; line-height: 1.06;
//           color: #f9fafb; margin-bottom: 22px;
//           letter-spacing: -0.02em;
//         }
//         .hero-h1-grad {
//           background: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #f472b6 100%);
//           -webkit-background-clip: text; -webkit-text-fill-color: transparent;
//           background-clip: text;
//         }
//         @media(max-width:1100px){ .hero-h1 { font-size: 48px; } }
//         @media(max-width:960px){ .hero-h1 { font-size: 40px; } }
//         @media(max-width:480px){ .hero-h1 { font-size: 32px; } }

//         .hero-p {
//           font-size: 17px; color: #9ca3af; line-height: 1.75;
//           margin-bottom: 36px; max-width: 460px;
//         }
//         @media(max-width:960px){ .hero-p { margin: 0 auto 32px; } }
//         @media(max-width:480px){ .hero-p { font-size: 15px; } }

//         .hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
//         @media(max-width:960px){ .hero-btns { justify-content: center; } }

//         .hbtn-primary {
//           padding: 14px 28px; border-radius: 12px;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           color: #fff; font-size: 15px; font-weight: 700;
//           text-decoration: none; display: inline-block;
//           box-shadow: 0 4px 20px rgba(79,70,229,0.45);
//           transition: all 0.2s;
//         }
//         .hbtn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(79,70,229,0.55); }

//         .hbtn-outline {
//           padding: 14px 28px; border-radius: 12px;
//           border: 1.5px solid rgba(255,255,255,0.12);
//           color: #d1d5db; font-size: 15px; font-weight: 600;
//           text-decoration: none; display: inline-block;
//           transition: all 0.2s;
//         }
//         .hbtn-outline:hover { border-color: rgba(255,255,255,0.3); color: #fff; background: rgba(255,255,255,0.05); }

//         .hero-stats { display: flex; gap: 36px; margin-top: 48px; flex-wrap: wrap; }
//         @media(max-width:960px){ .hero-stats { justify-content: center; } }
//         .hstat-n { font-size: 28px; font-weight: 900; color: #f9fafb; }
//         .hstat-l { font-size: 12px; color: #6b7280; margin-top: 3px; font-weight: 500; }

//         /* Hero image mosaic */
//         .hero-imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
//         @media(max-width:960px){ .hero-imgs { display: none; } }

//         .hi-card {
//           border-radius: 20px; overflow: hidden;
//           border: 1px solid rgba(255,255,255,0.07);
//           box-shadow: 0 20px 60px rgba(0,0,0,0.5);
//         }
//         .hi-card:nth-child(1){ margin-top: 48px; }
//         .hi-card img { width: 100%; height: 270px; object-fit: cover; display: block; }

//         /* Creator badge overlay */
//         .hi-overlay-card {
//           background: rgba(15,14,30,0.9); backdrop-filter: blur(12px);
//           border: 1px solid rgba(255,255,255,0.1);
//           border-radius: 14px; padding: 12px 16px;
//           margin-top: -16px; margin-left: 12px; margin-right: 12px;
//           display: flex; align-items: center; gap: 10px;
//         }
//         .hi-av { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg,#4f46e5,#c084fc); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:800; font-size:14px; flex-shrink:0; }
//         .hi-name { font-size: 13px; font-weight: 700; color: #f9fafb; }
//         .hi-meta { font-size: 11px; color: #9ca3af; margin-top: 1px; }
//         .hi-badge-green { background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px; margin-left: auto; }

//         /* Trust strip */
//         .trust-strip {
//           background: #0d0c1a; border-top: 1px solid #1e1b38;
//           padding: 18px 48px;
//           display: flex; align-items: center; justify-content: center;
//           gap: 32px; flex-wrap: wrap;
//           position: relative; z-index: 2;
//         }
//         @media(max-width:600px){ .trust-strip { padding: 16px 20px; gap: 16px; } }
//         .trust-item {
//           display: flex; align-items: center; gap: 7px;
//           font-size: 12px; color: #6b7280; font-weight: 500;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .trust-icon { font-size: 14px; }

//         /* ─── LIGHT SECTIONS ─── */
//         .sec { padding: 96px 48px; font-family: 'Plus Jakarta Sans', sans-serif; }
//         @media(max-width:600px){ .sec { padding: 64px 20px; } }
//         .sec-in { max-width: 1100px; margin: 0 auto; }

//         .eyebrow {
//           display: inline-flex; align-items: center; gap: 6px;
//           font-size: 11px; font-weight: 700; color: #4f46e5;
//           text-transform: uppercase; letter-spacing: 0.12em;
//           margin-bottom: 12px;
//           background: #eef2ff; padding: 5px 12px; border-radius: 100px;
//         }
//         .sec-h2 {
//           font-size: 40px; font-weight: 800; color: #0f172a;
//           line-height: 1.15; margin-bottom: 14px;
//           letter-spacing: -0.02em;
//         }
//         @media(max-width:600px){ .sec-h2 { font-size: 28px; } }
//         .sec-p { font-size: 16px; color: #64748b; line-height: 1.7; max-width: 520px; margin-bottom: 52px; }
//         @media(max-width:600px){ .sec-p { font-size: 14px; margin-bottom: 36px; } }

//         /* Steps */
//         .steps-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
//         @media(max-width:768px){ .steps-grid { grid-template-columns: 1fr; gap: 14px; } }

//         .step-c {
//           background: #fff;
//           border: 1.5px solid #e2e8f0;
//           border-radius: 22px; padding: 32px 28px;
//           position: relative; overflow: hidden;
//           transition: all 0.25s;
//         }
//         .step-c:hover { border-color: #c7d2fe; box-shadow: 0 16px 48px rgba(79,70,229,0.1); transform: translateY(-4px); }
//         .step-ghost {
//           position: absolute; top: -16px; right: 14px;
//           font-size: 88px; font-weight: 900; line-height: 1;
//           color: rgba(79,70,229,0.05);
//           pointer-events: none;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         .step-num {
//           width: 46px; height: 46px; border-radius: 14px;
//           background: linear-gradient(135deg, #4f46e5, #7c3aed);
//           color: #fff; font-size: 18px; font-weight: 800;
//           display: flex; align-items: center; justify-content: center;
//           margin-bottom: 20px;
//           box-shadow: 0 4px 16px rgba(79,70,229,0.3);
//         }
//         .step-t { font-size: 17px; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
//         .step-d { font-size: 14px; color: #64748b; line-height: 1.75; }

//         /* Features row */
//         .feat-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
//         @media(max-width:768px){ .feat-grid { grid-template-columns: 1fr; gap: 12px; } }

//         .feat-c {
//           background: linear-gradient(135deg, #fafafa 0%, #f8f5ff 100%);
//           border: 1.5px solid #e2e8f0; border-radius: 20px;
//           padding: 28px 24px; transition: all 0.22s;
//         }
//         .feat-c:hover { border-color: #c7d2fe; transform: translateY(-3px); box-shadow: 0 12px 36px rgba(79,70,229,0.08); }
//         .feat-ico { font-size: 32px; margin-bottom: 16px; }
//         .feat-t { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
//         .feat-d { font-size: 13px; color: #64748b; line-height: 1.7; }

//         /* Categories */
//         .cats-g {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
//           gap: 12px;
//         }
//         @media(max-width:480px){ .cats-g { grid-template-columns: repeat(3,1fr); gap: 10px; } }

//         .cat-c {
//           border-radius: 16px; padding: 20px 12px;
//           display: flex; flex-direction: column; align-items: center; gap: 8px;
//           text-decoration: none; transition: all 0.2s;
//           border: 1.5px solid transparent;
//         }
//         .cat-c:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-color: rgba(0,0,0,0.04); }
//         .cat-emo { font-size: 28px; }
//         .cat-nm { font-size: 12px; font-weight: 600; text-align: center; }

//         /* Cities */
//         .cities-g { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; }
//         @media(max-width:768px){ .cities-g { grid-template-columns: repeat(2,1fr); } }
//         @media(max-width:420px){ .cities-g { gap: 10px; } }

//         .city-c {
//           position: relative; height: 210px;
//           border-radius: 20px; overflow: hidden;
//           text-decoration: none; display: block;
//           box-shadow: 0 4px 24px rgba(0,0,0,0.12);
//           transition: transform 0.25s;
//         }
//         .city-c:hover { transform: translateY(-4px); box-shadow: 0 16px 48px rgba(0,0,0,0.18); }
//         @media(max-width:600px){ .city-c { height: 150px; border-radius: 16px; } }

//         .city-img { width:100%; height:100%; object-fit:cover; display:block; transition: transform 0.55s ease; }
//         .city-c:hover .city-img { transform: scale(1.07); }
//         .city-ov { position:absolute; inset:0; background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 55%, transparent 100%); }
//         .city-info { position:absolute; bottom:16px; left:16px; color:#fff; }
//         .city-nm { font-size:17px; font-weight:800; line-height:1; }
//         .city-ct { font-size:11px; opacity:.8; margin-top:4px; font-weight:500; }

//         /* Testimonials */
//         .test-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 20px; }
//         @media(max-width:768px){ .test-grid { grid-template-columns: 1fr; gap: 14px; } }

//         .test-c {
//           background: #fff; border: 1.5px solid #e2e8f0;
//           border-radius: 20px; padding: 28px;
//           transition: all 0.22s;
//         }
//         .test-c:hover { border-color: #c7d2fe; box-shadow: 0 12px 36px rgba(79,70,229,0.08); transform: translateY(-3px); }
//         .test-stars { color: #f59e0b; font-size: 15px; margin-bottom: 14px; letter-spacing: 2px; }
//         .test-q { font-size: 14px; color: #374151; line-height: 1.75; margin-bottom: 20px; font-style: italic; }
//         .test-au { display: flex; align-items: center; gap: 10px; }
//         .test-av {
//           width: 38px; height: 38px; border-radius: 50%;
//           display: flex; align-items: center; justify-content: center;
//           color: #fff; font-weight: 800; font-size: 15px; flex-shrink: 0;
//         }
//         .test-nm { font-size: 13px; font-weight: 700; color: #111; }
//         .test-rl { font-size: 11px; color: #9ca3af; margin-top: 1px; }

//         /* Skeleton */
//         .skel {
//           background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
//           background-size: 200% 100%;
//           animation: shimmer 1.4s infinite;
//           border-radius: 16px;
//         }
//         @keyframes shimmer { to { background-position: -200% 0; } }

//         /* CTA section */
//         .cta-wrap { padding: 0 48px 96px; font-family: 'Plus Jakarta Sans', sans-serif; }
//         @media(max-width:600px){ .cta-wrap { padding: 0 20px 64px; } }

//         .cta-box {
//           max-width: 1100px; margin: 0 auto;
//           background: #07070f;
//           border-radius: 28px; padding: 88px 56px;
//           text-align: center; position: relative; overflow: hidden;
//           border: 1px solid rgba(79,70,229,0.25);
//         }
//         @media(max-width:600px){ .cta-box { padding: 52px 24px; border-radius: 20px; } }
//         .cta-glow {
//           position: absolute; top: -80px; left: 50%; transform: translateX(-50%);
//           width: 500px; height: 400px;
//           background: radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 65%);
//           pointer-events: none;
//         }
//         .cta-gl2 {
//           position: absolute; bottom: -60px; left: 10%;
//           width: 300px; height: 300px;
//           background: radial-gradient(circle, rgba(192,132,252,0.12) 0%, transparent 65%);
//           pointer-events: none;
//         }
//         .cta-grid-lines {
//           position: absolute; inset: 0;
//           background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
//                             linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
//           background-size: 50px 50px;
//           pointer-events: none;
//         }
//         .cta-h2 {
//           font-size: 44px; font-weight: 900; color: #f9fafb;
//           line-height: 1.1; margin-bottom: 16px;
//           position: relative; z-index: 1; letter-spacing: -0.02em;
//         }
//         @media(max-width:600px){ .cta-h2 { font-size: 28px; } }
//         .cta-h2 span {
//           background: linear-gradient(135deg, #818cf8, #c084fc);
//           -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
//         }
//         .cta-p { font-size: 16px; color: #9ca3af; margin-bottom: 40px; position: relative; z-index: 1; }
//         .cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; position: relative; z-index: 1; }
//         .cta-btn-w {
//           padding: 14px 30px; border-radius: 12px;
//           background: #fff; color: #4f46e5;
//           font-size: 15px; font-weight: 700; text-decoration: none;
//           transition: all 0.2s; display: inline-block;
//           box-shadow: 0 4px 20px rgba(255,255,255,0.15);
//         }
//         .cta-btn-w:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(255,255,255,0.2); }
//         .cta-btn-b {
//           padding: 14px 30px; border-radius: 12px;
//           border: 1.5px solid rgba(255,255,255,0.15); color: #d1d5db;
//           font-size: 15px; font-weight: 600; text-decoration: none;
//           transition: all 0.2s; display: inline-block;
//         }
//         .cta-btn-b:hover { border-color: rgba(255,255,255,0.35); color: #fff; background: rgba(255,255,255,0.05); }

//         /* Footer */
//         .footer {
//           background: #fafafa; border-top: 1px solid #e5e7eb;
//           padding: 48px 48px 32px;
//           font-family: 'Plus Jakarta Sans', sans-serif;
//         }
//         @media(max-width:600px){ .footer { padding: 36px 20px 24px; } }
//         .footer-top {
//           display: flex; justify-content: space-between; align-items: flex-start;
//           flex-wrap: wrap; gap: 32px; margin-bottom: 40px;
//         }
//         .footer-brand { max-width: 260px; }
//         .footer-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; margin-bottom: 12px; }
//         .footer-logo-box { width: 32px; height: 32px; border-radius: 9px; background: linear-gradient(135deg,#4f46e5,#7c3aed); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 13px; flex-shrink: 0; }
//         .footer-logo-text { font-size: 16px; font-weight: 800; color: #111; }
//         .footer-tagline { font-size: 13px; color: #9ca3af; line-height: 1.6; }
//         .footer-links-col h4 { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 14px; }
//         .footer-links-col a { display: block; font-size: 13px; color: #9ca3af; text-decoration: none; margin-bottom: 10px; transition: color 0.15s; }
//         .footer-links-col a:hover { color: #4f46e5; }
//         .footer-bottom {
//           border-top: 1px solid #e5e7eb; padding-top: 24px;
//           display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
//         }
//         .footer-copy { font-size: 13px; color: #9ca3af; }
//       `}</style>

//       {/* ── NAV ── hide when logged in */}
//       {!isLoggedIn && <nav className="nav">
//         <Link href="/" className="nav-logo">
//           <div className="nav-logo-box">CB</div>
//           <span className="nav-logo-text">CreatorBridge</span>
//         </Link>
//         <div className="nav-right">
//           <Link href="/login" className="nav-login">Log In</Link>
//           <Link href="/signup" className="nav-signup">Sign Up Free →</Link>
//         </div>
//       </nav>}

//       {/* ── HERO ── */}
//       <section className={isLoggedIn ? "hero no-nav" : "hero"}>
//         <div className="hero-glow1" />
//         <div className="hero-glow2" />
//         <div className="hero-grid-lines" />

//         <div className="hero-body">
//           {/* LEFT */}
//           <div>
//             <div className="hero-badge">
//               <span className="hero-badge-dot" />
//               🇮🇳 India's #1 Creator Marketplace
//             </div>
//             <h1 className="hero-h1">
//               Where Brands<br />
//               Meet <span className="hero-h1-grad">Top Creators</span>
//             </h1>
//             <p className="hero-p">
//               Connect with influencers, models & photographers across India. Launch campaigns, receive proposals, and grow — all in one platform.
//             </p>
//             <div className="hero-btns">
//               {isLoggedIn ? (
//                 <>
//                   <Link href="/campaigns" className="hbtn-primary">Go to Dashboard →</Link>
//                   <Link href="/discovery" className="hbtn-outline">Browse Campaigns</Link>
//                 </>
//               ) : (
//                 <>
//                   <Link href="/signup" className="hbtn-primary">Start as a Brand →</Link>
//                   <Link href="/signup" className="hbtn-outline">Join as Creator</Link>
//                 </>
//               )}
//             </div>
//             <div className="hero-stats">
//               {[["10K+","Creators"],["500+","Campaigns"],["50+","Cities"],["₹2Cr+","Paid Out"]].map(([n,l]) => (
//                 <div key={l}>
//                   <div className="hstat-n">{n}</div>
//                   <div className="hstat-l">{l}</div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* RIGHT — image mosaic */}
//           <div className="hero-imgs">
//             <div>
//               <div className="hi-card">
//                 <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&q=80&auto=format&fit=crop" alt="Creator" />
//               </div>
//               <div className="hi-overlay-card">
//                 <div className="hi-av">R</div>
//                 <div>
//                   <div className="hi-name">Riya Sharma</div>
//                   <div className="hi-meta">Fashion · Mumbai · 45K followers</div>
//                 </div>
//                 <span className="hi-badge-green">Active</span>
//               </div>
//             </div>
//             <div>
//               <div className="hi-card" style={{marginTop:"40px"}}>
//                 <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&q=80&auto=format&fit=crop" alt="Creator" />
//               </div>
//               <div className="hi-overlay-card">
//                 <div className="hi-av" style={{background:"linear-gradient(135deg,#0891b2,#7c3aed)"}}>A</div>
//                 <div>
//                   <div className="hi-name">Arjun Mehta</div>
//                   <div className="hi-meta">Tech · Delhi · 82K followers</div>
//                 </div>
//                 <span className="hi-badge-green">Active</span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Trust strip */}
//         <div className="trust-strip">
//           {[["✓","Verified Creators"],["🔒","Secure Payments"],["💬","Real-time Chat"],["📊","Campaign Analytics"],["🌏","Pan-India Network"]].map(([ic,tx]) => (
//             <div key={tx} className="trust-item"><span className="trust-icon">{ic}</span><span>{tx}</span></div>
//           ))}
//         </div>
//       </section>

//       {/* ── HOW IT WORKS ── */}
//       <section className="sec" style={{background:"#f8fafc"}}>
//         <div className="sec-in">
//           <div className="eyebrow">⚡ How It Works</div>
//           <h2 className="sec-h2">From Signup to<br/>First Collab in Minutes</h2>
//           <p className="sec-p">A seamless workflow designed for both brands and creators</p>
//           <div className="steps-grid">
//             {[
//               {n:"1",t:"Create Your Profile",d:"Sign up, add your niche, city, followers & portfolio. Your profile is your brand — make it shine."},
//               {n:"2",t:"Discover Campaigns",d:"Browse live campaigns filtered by category, budget & location. Find the perfect brand match."},
//               {n:"3",t:"Apply & Get Paid",d:"Submit your bid & proposal. Get accepted, create content, and receive payment directly."},
//             ].map(s => (
//               <div key={s.n} className="step-c">
//                 <div className="step-ghost">{s.n}</div>
//                 <div className="step-num">{s.n}</div>
//                 <div className="step-t">{s.t}</div>
//                 <p className="step-d">{s.d}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ── FEATURES ── */}
//       <section className="sec">
//         <div className="sec-in">
//           <div className="eyebrow">🛠 Features</div>
//           <h2 className="sec-h2">Everything You Need<br/>to Collaborate</h2>
//           <p className="sec-p">Built for the Indian creator economy</p>
//           <div className="feat-grid">
//             {[
//               {i:"🎯",t:"Smart Matching",d:"AI-powered campaign matching based on your niche, location, and follower count."},
//               {i:"💬",t:"Real-time Messaging",d:"WhatsApp-style chat between brands and creators. Discuss, negotiate, collaborate."},
//               {i:"📋",t:"Campaign Board",d:"Manage all your active campaigns with applications, status tracking, and analytics."},
//               {i:"🔒",t:"Secure Payments",d:"Bid-based system with transparent platform fees. Know exactly what you'll earn."},
//               {i:"📊",t:"Analytics Dashboard",d:"Track campaign performance, application rates, and earnings in one place."},
//               {i:"🌟",t:"Verified Profiles",d:"All creators are verified with real follower counts and authentic portfolios."},
//             ].map(f => (
//               <div key={f.t} className="feat-c">
//                 <div className="feat-ico">{f.i}</div>
//                 <div className="feat-t">{f.t}</div>
//                 <p className="feat-d">{f.d}</p>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ── CATEGORIES ── */}
//       <section className="sec" style={{background:"#f8fafc"}}>
//         <div className="sec-in">
//           <div className="eyebrow">🎨 Browse by Niche</div>
//           <h2 className="sec-h2">Every Category,<br/>Every Creator</h2>
//           <p className="sec-p">From fashion to fintech — find creators across all industries</p>
//           {loadingMeta ? (
//             <div className="cats-g">
//               {Array.from({length:12}).map((_,i)=><div key={i} className="skel" style={{height:"88px"}}/>)}
//             </div>
//           ) : (
//             <div className="cats-g">
//               {categories.map((cat:any) => {
//                 const nm = name(cat);
//                 const key = nm.toLowerCase();
//                 const m = catMeta[key] || {emoji:"✨", color:"#4f46e5", bg:"#eef2ff"};
//                 return (
//                   <Link key={nm} href="/login" className="cat-c" style={{background:m.bg}}>
//                     <span className="cat-emo">{m.emoji}</span>
//                     <span className="cat-nm" style={{color:m.color}}>{nm.charAt(0).toUpperCase()+nm.slice(1)}</span>
//                   </Link>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ── CITIES ── */}
//       <section className="sec">
//         <div className="sec-in">
//           <div className="eyebrow">📍 Local Talent</div>
//           <h2 className="sec-h2">Creators Across<br/>Every City</h2>
//           <p className="sec-p">Hyper-local campaigns with creators who know your market</p>
//           {loadingMeta ? (
//             <div className="cities-g">
//               {Array.from({length:6}).map((_,i)=><div key={i} className="skel" style={{height:"210px"}}/>)}
//             </div>
//           ) : (
//             <div className="cities-g">
//               {cities.map((city:any) => {
//                 const nm = name(city);
//                 const ct = count(city);
//                 const img = cityImages[nm.toLowerCase()] || defaultCity;
//                 return (
//                   <Link key={nm} href="/login" className="city-c">
//                     <img src={img} className="city-img" alt={nm} />
//                     <div className="city-ov" />
//                     <div className="city-info">
//                       <div className="city-nm">{nm.charAt(0).toUpperCase()+nm.slice(1)}</div>
//                       {ct && <div className="city-ct">{ct} Creators</div>}
//                     </div>
//                   </Link>
//                 );
//               })}
//             </div>
//           )}
//         </div>
//       </section>

//       {/* ── TESTIMONIALS ── */}
//       <section className="sec" style={{background:"#f8fafc"}}>
//         <div className="sec-in">
//           <div className="eyebrow">❤️ Loved By Creators</div>
//           <h2 className="sec-h2">What They're Saying</h2>
//           <p className="sec-p">Thousands of creators and brands trust CreatorBridge</p>
//           <div className="test-grid">
//             {[
//               {q:"CreatorBridge helped me land my first brand deal within a week! The application process is so smooth.",au:"Priya Verma",rl:"Fashion Creator · Mumbai · 32K followers",av:"P",ac:"linear-gradient(135deg,#be185d,#9333ea)"},
//               {q:"As a brand, we found 5 perfect creators for our campaign in just 2 days. The quality of applicants is amazing.",au:"Rahul Gupta",rl:"Marketing Head · TechCorp India",av:"R",ac:"linear-gradient(135deg,#4f46e5,#0891b2)"},
//               {q:"The messaging feature makes collaboration so easy. I can negotiate and discuss deliverables all in one place.",au:"Ananya Singh",rl:"Lifestyle Creator · Delhi · 58K followers",av:"A",ac:"linear-gradient(135deg,#ea580c,#f59e0b)"},
//             ].map(t => (
//               <div key={t.au} className="test-c">
//                 <div className="test-stars">★★★★★</div>
//                 <p className="test-q">"{t.q}"</p>
//                 <div className="test-au">
//                   <div className="test-av" style={{background:t.ac}}>{t.av}</div>
//                   <div>
//                     <div className="test-nm">{t.au}</div>
//                     <div className="test-rl">{t.rl}</div>
//                   </div>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* ── CTA ── */}
//       <div className="cta-wrap">
//         <div className="cta-box">
//           <div className="cta-glow" />
//           <div className="cta-gl2" />
//           <div className="cta-grid-lines" />
//           <h2 className="cta-h2">Ready to <span>Bridge the Gap?</span></h2>
//           <p className="cta-p">Join 10,000+ creators and 500+ brands. Free to get started.</p>
//           <div className="cta-btns">
//             {isLoggedIn ? (
//               <>
//                 <Link href="/campaigns" className="cta-btn-w">Go to Dashboard →</Link>
//                 <Link href="/discovery" className="cta-btn-b">Browse Campaigns</Link>
//               </>
//             ) : (
//               <>
//                 <Link href="/signup" className="cta-btn-w">Start for Free →</Link>
//                 <Link href="/login" className="cta-btn-b">Already have an account</Link>
//               </>
//             )}
//           </div>
//         </div>
//       </div>

//       {/* ── FOOTER ── */}
//       <footer className="footer">
//         <div className="footer-top">
//           <div className="footer-brand">
//             <Link href="/" className="footer-logo">
//               <div className="footer-logo-box">CB</div>
//               <span className="footer-logo-text">CreatorBridge</span>
//             </Link>
//             <p className="footer-tagline">India's premier platform connecting brands with top creators. Build campaigns, find talent, grow together.</p>
//           </div>
//           <div className="footer-links-col">
//             <h4>Platform</h4>
//             <Link href="/login">Browse Campaigns</Link>
//             <Link href="/signup">For Creators</Link>
//             <Link href="/signup">For Brands</Link>
//           </div>
//           <div className="footer-links-col">
//             <h4>Account</h4>
//             <Link href="/login">Log In</Link>
//             <Link href="/signup">Sign Up Free</Link>
//           </div>
//         </div>
//         <div className="footer-bottom">
//           <span className="footer-copy">© 2026 CreatorBridge. All rights reserved.</span>
//           <span className="footer-copy">Made with ❤️ for Indian Creators</span>
//         </div>
//       </footer>
//     </>
//   );
// }




// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { MOCK_USERS, CATEGORIES } from "@/lib/constants";

// export default function HomePage() {
//   const [isLoggedIn, setIsLoggedIn] = useState(false);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     setIsLoggedIn(!!user);
//   }, []);

//   const featuredCreators = MOCK_USERS.filter((u) => u.verified).slice(0, 3);

//   const topCities = [
//     {
//       name: "Mumbai",
//       count: "12k+",
//       image:
//         "https://images.unsplash.com/photo-1570160897040-30430ade2211?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Delhi",
//       count: "8k+",
//       image:
//         "https://images.unsplash.com/photo-1587474260584-1f20d4296c06?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Bangalore",
//       count: "10k+",
//       image:
//         "https://images.unsplash.com/photo-1596761309211-d9d072b83841?auto=format&fit=crop&w=300&q=80",
//     },
//   ];

//   return (
//     <div className="space-y-32 pb-32">

//       {/* HERO – Only when NOT logged in */}
//       {!isLoggedIn && (
//         <section className="relative overflow-hidden pt-16 pb-24 px-6">
//           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

//             <div>
//               <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-6">
//                 Empowering India's Creators
//               </span>

//               <h1 className="text-5xl lg:text-7xl font-extrabold mb-8">
//                 Bridge the Gap  <br />
                
//                 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
//                   Scale Your Brand.
//                 </span>
//                 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent inline-block"> Scale Your Brand.</span>
//               </h1>

//               <p className="text-xl text-slate-600 mb-10 max-w-lg">
//                 The premier marketplace connecting creators with brands.
//               </p>

//               <div className="flex gap-4">
//                 <Link
//                   href="/discovery"
//                   className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//                 >
//                   I'm a Brand
//                 </Link>
//                 <Link
//                   href="/discovery"
//                   className="px-8 py-4 bg-white border-2 rounded-2xl font-bold hover:border-indigo-600"
//                 >
//                   I'm a Creator
//                 </Link>
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <img
//                 src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
//                 className="rounded-3xl h-[350px] object-cover"
//                 alt=""
//               />
//               <img
//                 src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
//                 className="rounded-3xl h-[350px] object-cover"
//                 alt=""
//               />
//             </div>

//           </div>
//         </section>
//       )}

//       {/* FEATURED */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="flex justify-between mb-12">
//           <div>
//             <h2 className="text-3xl font-bold">Featured Talent</h2>
//             <p className="text-slate-500">
//               Vetted creators delivering quality.
//             </p>
//           </div>
//           <Link href="/discovery" className="text-indigo-600 font-bold">
//             View All →
//           </Link>
//         </div>

//         <div className="grid md:grid-cols-3 gap-8">
//           {featuredCreators.map((c) => (
//             <Link
//               key={c.id}
//               href={`/profile/${c.id}`}
//               className="bg-white rounded-3xl border overflow-hidden hover:shadow-xl"
//             >
//               <img
//                 src={c.avatar}
//                 className="h-72 w-full object-cover"
//                 alt={c.name}
//               />
//               <div className="p-6">
//                 <h3 className="font-bold text-lg">{c.name}</h3>
//                 <p className="text-slate-500 text-sm">
//                   {c.city} • {c.budgetRange}
//                 </p>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* CATEGORIES */}
//       <section className="bg-slate-900 py-24 px-6">
//         <div className="max-w-7xl mx-auto text-center">
//           <h2 className="text-3xl font-bold text-white mb-10">
//             Explore Categories
//           </h2>

//           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
//             {CATEGORIES.map((cat) => (
//               <Link
//                 key={cat}
//                 href="/discovery"
//                 className="p-6 bg-slate-800 rounded-2xl text-white hover:bg-indigo-600 transition"
//               >
//                 {cat}
//               </Link>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* CITIES */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="grid md:grid-cols-3 gap-8">
//           {topCities.map((city) => (
//             <Link
//               key={city.name}
//               href="/discovery"
//               className="relative h-64 rounded-3xl overflow-hidden"
//             >
//               <img
//                 src={city.image}
//                 className="w-full h-full object-cover"
//                 alt={city.name}
//               />
//               <div className="absolute inset-0 bg-black/40 flex items-end p-6">
//                 <div className="text-white">
//                   <h3 className="text-2xl font-bold">{city.name}</h3>
//                   <p>{city.count} Creators</p>
//                 </div>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>

//     </div>
//   );
// }


// "use client";

// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { MOCK_USERS, CATEGORIES } from "@/lib/constants";

// export default function HomePage() {
//   const [isLoggedIn, setIsLoggedIn] = useState(false);

//   useEffect(() => {
//     const user = localStorage.getItem("cb_user");
//     setIsLoggedIn(!!user);
//   }, []);

//   const featuredCreators = MOCK_USERS.filter((u) => u.verified).slice(0, 3);

//   const topCities = [
//     {
//       name: "Mumbai",
//       count: "12k+",
//       image:
//         "https://images.unsplash.com/photo-1570160897040-30430ade2211?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Delhi",
//       count: "8k+",
//       image:
//         "https://images.unsplash.com/photo-1587474260584-1f20d4296c06?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Bangalore",
//       count: "10k+",
//       image:
//         "https://images.unsplash.com/photo-1596761309211-d9d072b83841?auto=format&fit=crop&w=300&q=80",
//     },
//   ];

//   return (
//     <div className="space-y-32 pb-32">

//       {/* HERO – Only when NOT logged in */}
//       {!isLoggedIn && (
//         <section className="relative overflow-hidden pt-16 pb-24 px-6">
//           <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

//             <div>
//               <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-6">
//                 Empowering India's Creators
//               </span>

//               <h1 className="text-5xl lg:text-7xl font-extrabold mb-8">
//                 Bridge the Gap  <br />
                
//                 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
//                   Scale Your Brand.
//                 </span>
//                 <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent inline-block"> Scale Your Brand.</span>
//               </h1>

//               <p className="text-xl text-slate-600 mb-10 max-w-lg">
//                 The premier marketplace connecting creators with brands.
//               </p>

//               <div className="flex gap-4">
//                 <Link
//                   href="/discovery"
//                   className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//                 >
//                   I'm a Brand
//                 </Link>
//                 <Link
//                   href="/discovery"
//                   className="px-8 py-4 bg-white border-2 rounded-2xl font-bold hover:border-indigo-600"
//                 >
//                   I'm a Creator
//                 </Link>
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <img
//                 src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
//                 className="rounded-3xl h-[350px] object-cover"
//                 alt=""
//               />
//               <img
//                 src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
//                 className="rounded-3xl h-[350px] object-cover"
//                 alt=""
//               />
//             </div>

//           </div>
//         </section>
//       )}

//       {/* FEATURED */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="flex justify-between mb-12">
//           <div>
//             <h2 className="text-3xl font-bold">Featured Talent</h2>
//             <p className="text-slate-500">
//               Vetted creators delivering quality.
//             </p>
//           </div>
//           <Link href="/discovery" className="text-indigo-600 font-bold">
//             View All →
//           </Link>
//         </div>

//         <div className="grid md:grid-cols-3 gap-8">
//           {featuredCreators.map((c) => (
//             <Link
//               key={c.id}
//               href={`/profile/${c.id}`}
//               className="bg-white rounded-3xl border overflow-hidden hover:shadow-xl"
//             >
//               <img
//                 src={c.avatar}
//                 className="h-72 w-full object-cover"
//                 alt={c.name}
//               />
//               <div className="p-6">
//                 <h3 className="font-bold text-lg">{c.name}</h3>
//                 <p className="text-slate-500 text-sm">
//                   {c.city} • {c.budgetRange}
//                 </p>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* CATEGORIES */}
//       <section className="bg-slate-900 py-24 px-6">
//         <div className="max-w-7xl mx-auto text-center">
//           <h2 className="text-3xl font-bold text-white mb-10">
//             Explore Categories
//           </h2>

//           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
//             {CATEGORIES.map((cat) => (
//               <Link
//                 key={cat}
//                 href="/discovery"
//                 className="p-6 bg-slate-800 rounded-2xl text-white hover:bg-indigo-600 transition"
//               >
//                 {cat}
//               </Link>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* CITIES */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="grid md:grid-cols-3 gap-8">
//           {topCities.map((city) => (
//             <Link
//               key={city.name}
//               href="/discovery"
//               className="relative h-64 rounded-3xl overflow-hidden"
//             >
//               <img
//                 src={city.image}
//                 className="w-full h-full object-cover"
//                 alt={city.name}
//               />
//               <div className="absolute inset-0 bg-black/40 flex items-end p-6">
//                 <div className="text-white">
//                   <h3 className="text-2xl font-bold">{city.name}</h3>
//                   <p>{city.count} Creators</p>
//                 </div>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>

//     </div>
//   );
// }




// "use client";

// import Link from "next/link";
// import { MOCK_USERS, CATEGORIES } from "@/lib/constants";

// export default function HomePage() {
//   // Featured creators (verified)
//   const featuredCreators = MOCK_USERS.filter((u) => u.verified).slice(0, 3);

//   const topCities = [
//     {
//       name: "Mumbai",
//       count: "12k+",
//       image:
//         "https://images.unsplash.com/photo-1570160897040-30430ade2211?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Delhi",
//       count: "8k+",
//       image:
//         "https://images.unsplash.com/photo-1587474260584-1f20d4296c06?auto=format&fit=crop&w=300&q=80",
//     },
//     {
//       name: "Bangalore",
//       count: "10k+",
//       image:
//         "https://images.unsplash.com/photo-1596761309211-d9d072b83841?auto=format&fit=crop&w=300&q=80",
//     },
//   ];

//   return (
//     <div className="space-y-32 pb-32">
//       {/* HERO */}
//       <section className="relative overflow-hidden pt-16 pb-24 px-6">
//         <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
//           <div>
//             <span className="inline-block py-1 px-3 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mb-6">
//               Empowering India's Creators
//             </span>

//             <h1 className="text-5xl lg:text-7xl font-extrabold mb-8">
//               Bridge the Gap <br />
//               <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
//                 Scale Your Brand.
//               </span>
//             </h1>

//             <p className="text-xl text-slate-600 mb-10 max-w-lg">
//               The premier marketplace connecting creators with brands for
//               high-impact campaigns.
//             </p>

//             <div className="flex gap-4">
//               <Link
//                 href="/discovery"
//                 className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//               >
//                 I'm a Brand
//               </Link>
//               <Link
//                 href="/discovery"
//                 className="px-8 py-4 bg-white border-2 rounded-2xl font-bold hover:border-indigo-600"
//               >
//                 I'm a Creator
//               </Link>
//             </div>
//           </div>

//           <div className="grid grid-cols-2 gap-4">
//             <img
//               src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
//               className="rounded-3xl h-[350px] object-cover"
//               alt=""
//             />
//             <img
//               src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
//               className="rounded-3xl h-[350px] object-cover"
//               alt=""
//             />
//           </div>
//         </div>
//       </section>

//       {/* FEATURED */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="flex justify-between mb-12">
//           <div>
//             <h2 className="text-3xl font-bold">Featured Talent</h2>
//             <p className="text-slate-500">
//               Vetted creators delivering quality.
//             </p>
//           </div>
//           <Link href="/discovery" className="text-indigo-600 font-bold">
//             View All →
//           </Link>
//         </div>

//         <div className="grid md:grid-cols-3 gap-8">
//           {featuredCreators.map((c) => (
//             <Link
//               key={c.id}
//               href={`/profile/${c.id}`}
//               className="bg-white rounded-3xl border overflow-hidden hover:shadow-xl"
//             >
//               <img
//                 src={c.avatar}
//                 className="h-72 w-full object-cover"
//                 alt={c.name}
//               />
//               <div className="p-6">
//                 <h3 className="font-bold text-lg">{c.name}</h3>
//                 <p className="text-slate-500 text-sm">
//                   {c.city} • {c.budgetRange}
//                 </p>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* CATEGORIES */}
//       <section className="bg-slate-900 py-24 px-6">
//         <div className="max-w-7xl mx-auto text-center">
//           <h2 className="text-3xl font-bold text-white mb-10">
//             Explore Categories
//           </h2>

//           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
//             {CATEGORIES.map((cat) => (
//               <Link
//                 key={cat}
//                 href="/discovery"
//                 className="p-6 bg-slate-800 rounded-2xl text-white hover:bg-indigo-600 transition"
//               >
//                 {cat}
//               </Link>
//             ))}
//           </div>
//         </div>
//       </section>

//       {/* CITIES */}
//       <section className="max-w-7xl mx-auto px-6">
//         <div className="grid md:grid-cols-3 gap-8">
//           {topCities.map((city) => (
//             <Link
//               key={city.name}
//               href="/discovery"
//               className="relative h-64 rounded-3xl overflow-hidden"
//             >
//               <img
//                 src={city.image}
//                 className="w-full h-full object-cover"
//                 alt={city.name}
//               />
//               <div className="absolute inset-0 bg-black/40 flex items-end p-6">
//                 <div className="text-white">
//                   <h3 className="text-2xl font-bold">{city.name}</h3>
//                   <p>{city.count} Creators</p>
//                 </div>
//               </div>
//             </Link>
//           ))}
//         </div>
//       </section>
//     </div>
//   );
// }



// import Image from "next/image";

// export default function Home() {
//   return (
//     <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
//       <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
//         <Image
//           className="dark:invert"
//           src="/next.svg"
//           alt="Next.js logo"
//           width={100}
//           height={20}
//           priority
//         />
//         <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
//           <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
//             To get started, edit the page.tsx file.
//           </h1>
//           <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
//             Looking for a starting point or more instructions? Head over to{" "}
//             <a
//               href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Templates
//             </a>{" "}
//             or the{" "}
//             <a
//               href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//               className="font-medium text-zinc-950 dark:text-zinc-50"
//             >
//               Learning
//             </a>{" "}
//             center.
//           </p>
//         </div>
//         <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
//           <a
//             className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
//             href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             <Image
//               className="dark:invert"
//               src="/vercel.svg"
//               alt="Vercel logomark"
//               width={16}
//               height={16}
//             />
//             Deploy Now
//           </a>
//           <a
//             className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
//             href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
//             target="_blank"
//             rel="noopener noreferrer"
//           >
//             Documentation
//           </a>
//         </div>
//       </main>
//     </div>
//   );
// }
