"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const API_BASE = "https://api.collabzy.in/api";

export default function BankDetailsPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", email: "", account_number: "", ifsc: "",
  });
  const [loading, setLoading]         = useState(false);
  const [checking, setChecking]       = useState(true);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [maskedAccount, setMaskedAccount] = useState("");
  const [toast, setToast]             = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [confirmAccount, setConfirmAccount] = useState("");
  const [step, setStep]               = useState<"form" | "success">("form");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token;
    if (!token) { router.push("/login"); return; }

    // prefill email + name from stored user
    setForm(prev => ({
      ...prev,
      name:  storedUser.name  || "",
      email: storedUser.email || "",
    }));

    // check if bank already linked
    if (storedUser.fund_account_id) {
      setAlreadyLinked(true);
      setMaskedAccount(storedUser.masked_account || "");
      setStep("success");
    }
    setChecking(false);
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.account_number !== confirmAccount) {
      showToast("Account numbers do not match.", "error"); return;
    }
    if (!form.name || !form.email || !form.account_number || !form.ifsc) {
      showToast("Please fill all fields.", "error"); return;
    }

    const storedUser = JSON.parse(localStorage.getItem("cb_user") || "{}");
    const token = localStorage.getItem("token") || storedUser.token;
    setLoading(true);

    try {
      // STEP 1: create contact
      const contactRes = await fetch(`${API_BASE}/payment/create-contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, email: form.email }),
      });
      const contactData = await contactRes.json();
      if (!contactRes.ok) throw new Error(contactData.message || "Contact creation failed.");

      // STEP 2: create fund account
      const fundRes = await fetch(`${API_BASE}/payment/create-fund-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, account_number: form.account_number, ifsc: form.ifsc.toUpperCase() }),
      });
      const fundData = await fundRes.json();
      if (!fundRes.ok) throw new Error(fundData.message || "Fund account creation failed.");

      // mask account number for display
      const masked = "XXXXXX" + form.account_number.slice(-4);
      setMaskedAccount(masked);

      // save to localStorage
      const updated = { ...storedUser, fund_account_id: fundData.fund_account_id || true, masked_account: masked };
      localStorage.setItem("cb_user", JSON.stringify(updated));

      setAlreadyLinked(true);
      setStep("success");
      showToast("Bank account linked successfully! 🎉", "success");
    } catch (err: any) {
      showToast(err.message || "Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
      <div style={{ width: 28, height: 28, border: "3px solid #e0e0e0", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes checkPop { 0%{transform:scale(0)} 70%{transform:scale(1.15)} 100%{transform:scale(1)} }

        .bd-wrap { font-family:'DM Sans',sans-serif; background:#f5f5f0; min-height:100vh; padding:40px 16px 80px; }
        .bd-inner { max-width:520px; margin:0 auto; }

        /* back button */
        .bd-back { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; margin-bottom:28px; padding:0; transition:color 0.2s; }
        .bd-back:hover { color:#111; }

        /* header */
        .bd-header { margin-bottom:28px; animation:fadeUp 0.4s ease both; }
        .bd-header-top { display:flex; align-items:center; gap:14px; margin-bottom:8px; }
        .bd-header-icon { width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
        .bd-title { font-size:22px; font-weight:700; color:#111; }
        .bd-sub   { font-size:14px; color:#999; line-height:1.6; }

        /* card */
        .bd-card { background:#fff; border-radius:20px; border:1px solid #ebebeb; padding:32px; box-shadow:0 2px 20px rgba(0,0,0,0.05); animation:fadeUp 0.4s ease 0.08s both; }
        @media(max-width:480px){ .bd-card{ padding:22px 18px; border-radius:16px; } }

        /* security badge */
        .bd-secure { display:flex; align-items:center; gap:8px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:10px 14px; margin-bottom:24px; }
        .bd-secure-text { font-size:12px; color:#15803d; font-weight:500; }

        /* form */
        .bd-field { display:flex; flex-direction:column; gap:6px; margin-bottom:16px; }
        .bd-label { font-size:11px; font-weight:600; color:#aaa; text-transform:uppercase; letter-spacing:0.07em; }
        .bd-input { padding:12px 14px; border:1.5px solid #ebebeb; border-radius:12px; font-size:14px; font-family:'DM Sans',sans-serif; color:#111; background:#fafafa; outline:none; transition:border-color 0.2s,box-shadow 0.2s; width:100%; }
        .bd-input:focus { border-color:#4f46e5; box-shadow:0 0 0 3px rgba(79,70,229,0.08); background:#fff; }
        .bd-input::placeholder { color:#c0c0c0; }
        .bd-input.error { border-color:#ef4444; }
        .bd-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        @media(max-width:400px){ .bd-row{ grid-template-columns:1fr; } }

        /* divider */
        .bd-divider { height:1px; background:#f0f0f0; margin:20px 0; }

        /* ifsc hint */
        .bd-hint { font-size:11px; color:#bbb; margin-top:4px; }

        /* submit */
        .bd-submit { width:100%; padding:14px; border-radius:12px; border:none; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; font-size:15px; font-weight:700; font-family:'DM Sans',sans-serif; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 16px rgba(79,70,229,0.28); margin-top:24px; }
        .bd-submit:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 24px rgba(79,70,229,0.38); }
        .bd-submit:disabled { opacity:0.6; cursor:not-allowed; transform:none; }
        .bd-spinner { width:14px; height:14px; border:2px solid rgba(255,255,255,0.35); border-top-color:#fff; border-radius:50%; animation:spin 0.7s linear infinite; }

        /* success state */
        .bd-success { text-align:center; padding:16px 0 8px; animation:fadeUp 0.4s ease both; }
        .bd-check { width:72px; height:72px; border-radius:50%; background:linear-gradient(135deg,#22c55e,#16a34a); display:flex; align-items:center; justify-content:center; font-size:32px; margin:0 auto 20px; animation:checkPop 0.5s ease both; box-shadow:0 8px 24px rgba(34,197,94,0.3); }
        .bd-success-title { font-size:20px; font-weight:700; color:#111; margin-bottom:8px; }
        .bd-success-sub   { font-size:14px; color:#888; line-height:1.6; margin-bottom:24px; }
        .bd-masked { display:inline-flex; align-items:center; gap:8px; background:#f9fafb; border:1.5px solid #ebebeb; border-radius:10px; padding:10px 18px; font-size:15px; font-weight:600; color:#111; margin-bottom:20px; }
        .bd-update-btn { background:none; border:1.5px solid #ebebeb; color:#666; font-family:'DM Sans',sans-serif; font-size:13px; font-weight:500; padding:10px 20px; border-radius:10px; cursor:pointer; transition:all 0.2s; }
        .bd-update-btn:hover { border-color:#4f46e5; color:#4f46e5; }

        /* toast */
        .bd-toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:12px 22px; border-radius:12px; font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif; z-index:99999; white-space:nowrap; max-width:90vw; text-align:center; animation:toastIn 0.3s ease; box-shadow:0 4px 20px rgba(0,0,0,0.12); }
        .bd-toast.success { background:#111; color:#fff; }
        .bd-toast.error   { background:#ef4444; color:#fff; }
      `}</style>

      {toast && <div className={`bd-toast ${toast.type}`}>{toast.msg}</div>}

      <div className="bd-wrap">
        <div className="bd-inner">

          {/* Back button */}
          <button className="bd-back" onClick={() => router.push("/setup-profile")}>
            ← Back to Profile
          </button>

          {/* Header */}
          <div className="bd-header">
            <div className="bd-header-top">
              <div className="bd-header-icon">🏦</div>
              <div>
                <div className="bd-title">Bank Details</div>
                <div className="bd-sub">Link your bank account to receive payouts from brands</div>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="bd-card">

            {step === "success" ? (
              /* ── SUCCESS STATE ── */
              <div className="bd-success">
                <div className="bd-check">✓</div>
                <div className="bd-success-title">Bank Account Linked!</div>
                <div className="bd-success-sub">
                  Your bank account is verified and ready to receive payouts from brands.
                </div>
                <div className="bd-masked">
                  🏦 {maskedAccount || "XXXXXX****"}
                </div>
                <br />
                <button className="bd-update-btn" onClick={() => setStep("form")}>
                  Update Bank Details
                </button>
              </div>
            ) : (
              /* ── FORM STATE ── */
              <>
                {/* Security badge */}
                <div className="bd-secure">
                  <span style={{ fontSize: 16 }}>🔒</span>
                  <span className="bd-secure-text">Your bank details are encrypted and securely stored via Razorpay</span>
                </div>

                <form onSubmit={handleSubmit}>
                  {/* Personal Info */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Account Holder Info</div>

                  <div className="bd-row">
                    <div className="bd-field">
                      <label className="bd-label">Full Name</label>
                      <input className="bd-input" placeholder="As per bank records" value={form.name}
                        onChange={e => handleChange("name", e.target.value)} required />
                    </div>
                    <div className="bd-field">
                      <label className="bd-label">Email</label>
                      <input className="bd-input" type="email" placeholder="your@email.com" value={form.email}
                        onChange={e => handleChange("email", e.target.value)} required />
                    </div>
                  </div>

                  <div className="bd-divider" />

                  {/* Bank Info */}
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Bank Account Details</div>

                  <div className="bd-field">
                    <label className="bd-label">Account Number</label>
                    <input className="bd-input" placeholder="Enter account number" value={form.account_number}
                      onChange={e => handleChange("account_number", e.target.value.replace(/\D/g, ""))}
                      autoComplete="off" required />
                  </div>

                  <div className="bd-field">
                    <label className="bd-label">Confirm Account Number</label>
                    <input
                      className={`bd-input ${confirmAccount && confirmAccount !== form.account_number ? "error" : ""}`}
                      placeholder="Re-enter account number"
                      value={confirmAccount}
                      onChange={e => setConfirmAccount(e.target.value.replace(/\D/g, ""))}
                      autoComplete="off" required
                    />
                    {confirmAccount && confirmAccount !== form.account_number && (
                      <span style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>Account numbers do not match</span>
                    )}
                  </div>

                  <div className="bd-field">
                    <label className="bd-label">IFSC Code</label>
                    <input className="bd-input" placeholder="e.g. SBIN0001234" value={form.ifsc}
                      onChange={e => handleChange("ifsc", e.target.value.toUpperCase())}
                      maxLength={11} required />
                    <span className="bd-hint">11-character code found on your cheque book</span>
                  </div>

                  <button className="bd-submit" type="submit" disabled={loading}>
                    {loading ? <><span className="bd-spinner" /> Processing...</> : "🔗 Link Bank Account"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Bottom note */}
          <p style={{ fontSize: 12, color: "#bbb", textAlign: "center", marginTop: 16, lineHeight: 1.6 }}>
            Payouts are processed within 2–3 business days after campaign completion
          </p>
        </div>
      </div>
    </>
  );
}