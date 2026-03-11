"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function TermsPage() {
  const [agreed, setAgreed]   = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(()=>{
    const done = localStorage.getItem("terms_accepted");
    if (done) setAccepted(true);
  },[]);

  const handleAccept = () => {
    localStorage.setItem("terms_accepted", new Date().toISOString());
    setAccepted(true);
  };

  const RULES = [
    {
      icon:"🔒", title:"Platform-Only Deals",
      color:"#1e1b4b", border:"#3730a3", text:"#818cf8",
      body:"Any collaboration initiated on CreatorBridge — whether through campaigns, direct invites, or messages — must be executed and paid through the platform. Moving deals off-platform to avoid fees violates our Terms of Service.",
      badge:"MANDATORY",
    },
    {
      icon:"💰", title:"Escrow Payment Protection",
      color:"#052e16", border:"#166534", text:"#4ade80",
      body:"All brand payments are held in escrow until the creator delivers approved work. Platform commission of 10% is deducted before releasing funds to the creator. This protects both parties from fraud.",
      badge:"10% FEE",
    },
    {
      icon:"🚫", title:"Contact Info Restrictions",
      color:"#7c2d12", border:"#9a3412", text:"#fb923c",
      body:"Sharing phone numbers, WhatsApp IDs, Instagram handles, emails, or any off-platform contact information in chats is strictly prohibited. Our system monitors messages for violations. Repeat offenders will be suspended.",
      badge:"MONITORED",
    },
    {
      icon:"⚖️", title:"Dispute Resolution",
      color:"#1e3a5f", border:"#1d4ed8", text:"#60a5fa",
      body:"If a brand and creator disagree on deliverable quality, a dispute can be raised within 7 days of submission. CreatorBridge will review evidence and make a final decision on payment release or refund.",
      badge:"7 DAYS",
    },
    {
      icon:"📋", title:"Deliverable Requirements",
      color:"#2d1b69", border:"#7c3aed", text:"#c4b5fd",
      body:"Creators must submit proof of work (reel link, post URL, screenshot) through the platform before payment is released. Campaigns without submitted deliverables will remain 'In Progress' and payment held.",
      badge:"REQUIRED",
    },
    {
      icon:"🏆", title:"Reward & Ranking System",
      color:"#713f12", border:"#d97706", text:"#fbbf24",
      body:"Creators who complete deals on-platform earn reward points, profile boosts, and better ranking in search results. Off-platform deals forfeit all reward benefits and may result in account demotion.",
      badge:"POINTS",
    },
    {
      icon:"⚠️", title:"Violation Consequences",
      color:"#450a0a", border:"#dc2626", text:"#f87171",
      body:"First violation: Warning + 7-day message restriction. Second violation: 30-day account suspension. Third violation: Permanent ban. All active deals will be frozen during suspension periods.",
      badge:"STRICT",
    },
    {
      icon:"🔐", title:"Commission Protection Rule",
      color:"#1a1a2e", border:"#4f46e5", text:"#a5b4fc",
      body:"If a brand directly contacts a creator they met on this platform outside the platform and completes a deal without using our payment system — both accounts are subject to immediate suspension upon evidence.",
      badge:"ENFORCED",
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1}50%{opacity:0.6} }

        .tr { font-family:'Plus Jakarta Sans',sans-serif; background:#0a0a0f; min-height:100vh; color:#fff; }

        /* HERO */
        .tr-hero { background:linear-gradient(135deg,#0f0f1a 0%,#1a1030 50%,#0f1a0f 100%); padding:48px 32px 36px; text-align:center; border-bottom:1px solid #1a1a2e; position:relative; overflow:hidden; }
        .tr-hero::before { content:""; position:absolute; top:-60px; left:50%; transform:translateX(-50%); width:400px; height:400px; border-radius:50%; background:radial-gradient(circle,rgba(79,70,229,0.15),transparent 70%); pointer-events:none; }
        @media(max-width:600px){ .tr-hero{ padding:32px 16px 24px; } }
        .tr-hero-badge { display:inline-flex; align-items:center; gap:8px; padding:8px 18px; background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); border-radius:100px; font-size:12px; font-weight:700; color:#f87171; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:20px; }
        .tr-hero-title { font-size:36px; font-weight:800; color:#fff; margin-bottom:12px; }
        @media(max-width:600px){ .tr-hero-title{ font-size:26px; } }
        .tr-hero-sub   { font-size:15px; color:#888; max-width:520px; margin:0 auto 24px; line-height:1.7; }
        .tr-effective  { display:inline-flex; align-items:center; gap:8px; padding:6px 16px; background:#111; border:1px solid #222; border-radius:100px; font-size:12px; color:#666; }

        /* BODY */
        .tr-body { padding:36px 32px 60px; max-width:900px; margin:0 auto; }
        @media(max-width:600px){ .tr-body{ padding:24px 16px 48px; } }

        /* WARNING BANNER */
        .tr-warning-banner { background:#1a0a0a; border:2px solid #dc2626; border-radius:16px; padding:20px 24px; margin-bottom:32px; display:flex; gap:14px; align-items:flex-start; }
        .tr-warning-icon { font-size:28px; flex-shrink:0; }
        .tr-warning-title { font-size:16px; font-weight:800; color:#f87171; margin-bottom:6px; }
        .tr-warning-text  { font-size:13px; color:#fca5a5; line-height:1.7; }

        /* RULE CARDS */
        .tr-rules { display:flex; flex-direction:column; gap:14px; margin-bottom:36px; }
        .tr-rule { border-radius:16px; border:1.5px solid; padding:22px 24px; animation:fadeUp 0.3s ease both; }
        .tr-rule-header { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
        .tr-rule-icon { font-size:24px; }
        .tr-rule-title { font-size:16px; font-weight:800; color:#fff; flex:1; }
        .tr-rule-badge { padding:3px 10px; border-radius:100px; font-size:10px; font-weight:800; color:#fff; flex-shrink:0; text-transform:uppercase; letter-spacing:0.06em; }
        .tr-rule-body  { font-size:14px; line-height:1.75; color:#aaa; }

        /* COMMISSION TABLE */
        .tr-table-wrap { background:#111; border:1.5px solid #1f1f2e; border-radius:16px; overflow:hidden; margin-bottom:32px; }
        .tr-table-head { padding:16px 20px; background:#1a1a2e; border-bottom:1px solid #1f1f2e; font-size:14px; font-weight:800; color:#a5b4fc; }
        .tr-table-row  { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; padding:14px 20px; border-bottom:1px solid #1a1a24; font-size:13px; color:#bbb; align-items:center; }
        .tr-table-row:last-child { border-bottom:none; }
        .tr-table-row.header { background:#16162a; font-weight:700; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:0.06em; }
        @media(max-width:500px){ .tr-table-row{ grid-template-columns:2fr 1fr 1fr; } .tr-table-row>:last-child{ display:none; } }
        .tr-highlight { color:#4ade80; font-weight:800; }
        .tr-platform  { color:#a5b4fc; font-weight:700; }

        /* ACCEPT BOX */
        .tr-accept-box { background:#111; border:2px solid #2a2a3e; border-radius:18px; padding:28px 24px; text-align:center; }
        .tr-accept-title { font-size:18px; font-weight:800; color:#fff; margin-bottom:8px; }
        .tr-accept-sub   { font-size:13px; color:#666; margin-bottom:20px; line-height:1.6; }
        .tr-checkbox-row { display:flex; align-items:flex-start; gap:12px; text-align:left; margin-bottom:20px; cursor:pointer; }
        .tr-checkbox     { width:22px; height:22px; border-radius:6px; border:2px solid #3a3a4e; background:#1a1a2e; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; transition:all 0.2s; cursor:pointer; }
        .tr-checkbox.checked { background:#4f46e5; border-color:#4f46e5; }
        .tr-checkbox-label { font-size:13px; color:#aaa; line-height:1.6; }
        .tr-accept-btn  { width:100%; padding:14px; border-radius:14px; background:linear-gradient(135deg,#4f46e5,#7c3aed); border:none; color:#fff; font-size:15px; font-weight:800; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all 0.2s; }
        .tr-accept-btn:hover:not(:disabled){ transform:translateY(-1px); box-shadow:0 6px 20px rgba(79,70,229,0.4); }
        .tr-accept-btn:disabled{ opacity:0.4; cursor:not-allowed; }
        .tr-accepted-banner { display:flex; align-items:center; gap:10px; padding:16px 20px; background:#052e16; border:1.5px solid #166534; border-radius:14px; color:#4ade80; font-weight:700; font-size:15px; }
      `}</style>

      <div className="tr">

        {/* HERO */}
        <div className="tr-hero">
          <div className="tr-hero-badge">⚖️ Legal & Commission Rules</div>
          <h1 className="tr-hero-title">Platform Terms & Commission Policy</h1>
          <p className="tr-hero-sub">All users must read and agree to these rules. Violations result in account suspension or permanent ban.</p>
          <div className="tr-effective">📅 Effective from January 2025 · Version 2.1</div>
        </div>

        <div className="tr-body">

          {/* WARNING BANNER */}
          <div className="tr-warning-banner">
            <div className="tr-warning-icon">🚨</div>
            <div>
              <div className="tr-warning-title">Important — Read Before Using Platform</div>
              <div className="tr-warning-text">
                Moving deals off-platform, sharing contact info in chat, or bypassing our payment system are all <strong style={{color:"#f87171"}}>violations of our Terms of Service</strong> and will result in immediate account action. Our system actively monitors all activity.
              </div>
            </div>
          </div>

          {/* RULES */}
          <div className="tr-rules">
            {RULES.map((rule,i)=>(
              <div key={i} className="tr-rule"
                style={{background:rule.color+"22",borderColor:rule.border,animationDelay:`${i*0.06}s`}}>
                <div className="tr-rule-header">
                  <div className="tr-rule-icon">{rule.icon}</div>
                  <div className="tr-rule-title">{rule.title}</div>
                  <div className="tr-rule-badge" style={{background:rule.border}}>{rule.badge}</div>
                </div>
                <div className="tr-rule-body">{rule.body}</div>
              </div>
            ))}
          </div>

          {/* COMMISSION TABLE */}
          <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:14}}>💰 Commission Breakdown</div>
          <div className="tr-table-wrap">
            <div className="tr-table-head">How payments are split on every completed deal</div>
            <div className="tr-table-row header">
              <span>Deal Size</span>
              <span>Brand Pays</span>
              <span>Creator Gets</span>
              <span>Platform Fee</span>
            </div>
            {[
              ["₹1,000 deal",   "₹1,000", "₹900",  "₹100 (10%)"],
              ["₹5,000 deal",   "₹5,000", "₹4,500","₹500 (10%)"],
              ["₹10,000 deal",  "₹10,000","₹9,000","₹1,000 (10%)"],
              ["₹25,000 deal",  "₹25,000","₹22,500","₹2,500 (10%)"],
              ["₹1,00,000 deal","₹1,00,000","₹90,000","₹10,000 (10%)"],
            ].map(([size,brand,creator,fee],i)=>(
              <div key={i} className="tr-table-row">
                <span style={{color:"#fff",fontWeight:600}}>{size}</span>
                <span style={{color:"#f97316",fontWeight:700}}>{brand}</span>
                <span className="tr-highlight">{creator}</span>
                <span className="tr-platform">{fee}</span>
              </div>
            ))}
          </div>

          {/* ACCEPT */}
          <div className="tr-accept-box">
            {accepted ? (
              <div className="tr-accepted-banner">
                ✅ You have accepted CreatorBridge Terms & Commission Policy
              </div>
            ) : (
              <>
                <div className="tr-accept-title">Accept Terms to Continue</div>
                <div className="tr-accept-sub">You must agree to these terms to use all platform features including deals, contracts, and payments.</div>
                <div className="tr-checkbox-row" onClick={()=>setAgreed(!agreed)}>
                  <div className={`tr-checkbox ${agreed?"checked":""}`}>
                    {agreed && <span style={{color:"#fff",fontSize:13,fontWeight:800}}>✓</span>}
                  </div>
                  <div className="tr-checkbox-label">
                    I have read and agree to CreatorBridge's Terms of Service, Commission Policy, and Platform Rules. I understand that violations may result in account suspension or permanent ban.
                  </div>
                </div>
                <button className="tr-accept-btn" disabled={!agreed} onClick={handleAccept}>
                  ✅ Accept & Continue
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}