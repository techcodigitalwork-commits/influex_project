"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const API = "https://api.collabzy.in/api";

function ResetPasswordForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";
  const email = searchParams.get("email");
  const [password,    setPassword]    = useState("");
  const [confirm,     setConfirm]     = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState(false);

  const handleReset = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!token) { setError("Invalid or missing reset token."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }

    try {
      setLoading(true);
      const res  = await fetch(`${API}/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email ,token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Reset failed");
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .rp-input {
          width: 100%;
          padding: 16px 20px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          font-size: 15px;
          font-family: inherit;
          color: #0f172a !important;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          -webkit-text-fill-color: #0f172a;
          box-sizing: border-box;
        }
        .rp-input::placeholder { color: #94a3b8; -webkit-text-fill-color: #94a3b8; }
        .rp-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
        .pw-wrap { position: relative; }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #94a3b8; line-height: 1; display: flex; align-items: center; }
        .pw-toggle:hover { color: #4f46e5; }
      `}</style>

      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#f8fafc"}}>
        <div style={{maxWidth:440,width:"100%",background:"#fff",borderRadius:32,padding:"40px 36px",boxShadow:"0 20px 60px rgba(79,70,229,0.08)",border:"1px solid #e2e8f0"}}>

          {/* Logo */}
          <div style={{textAlign:"center",marginBottom:32}}>
            {/* <div style={{width:85,height:32,background:"linear-gradient(135deg,#4f46e5,#7c3aed)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:600,fontSize:12,margin:"0 auto 12px",boxShadow:"0 4px 12px rgba(79,70,229,0.25)"}}>
              Collabzy
            </div> */}
            <div
  style={{
    width:120,
    height:50,
    borderRadius:10,
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    margin:"0 auto 12px",
    boxShadow:"0 4px 12px rgba(79,70,229,0.25)",
    overflow:"hidden",
    background:"#fff" // optional
  }}
>
  <img
    src="/collabzy-logo.png" // 👈 apni image ka path
    alt="logo"
    style={{
      width:"100%",
      height:"100%",
      objectFit:"contain"
    }}
  />
</div>
            <h2 style={{fontSize:26,fontWeight:800,color:"#0f172a",margin:"0 0 6px"}}>Set New Password</h2>
            <p style={{color:"#64748b",fontSize:14,margin:0}}>Choose a strong password for your account</p>
          </div>

          {success ? (
            <div style={{textAlign:"center",padding:"16px 0"}}>
              <div style={{width:56,height:56,background:"#f0fdf4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>✅</div>
              <h3 style={{fontSize:18,fontWeight:800,color:"#0f172a",marginBottom:8}}>Password Updated!</h3>
              <p style={{fontSize:14,color:"#64748b",marginBottom:0}}>Redirecting you to login…</p>
            </div>
          ) : (
            <form onSubmit={handleReset} style={{display:"flex",flexDirection:"column",gap:18}}>
              {!token && (
                <div style={{padding:"12px 16px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:12,color:"#dc2626",fontSize:13,fontWeight:600}}>
                  Invalid reset link. Please request a new one.
                </div>
              )}
              {error && (
                <div style={{padding:"12px 16px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:12,color:"#dc2626",fontSize:13,fontWeight:600}}>
                  {error}
                </div>
              )}

              <div>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>New Password</label>
                <div className="pw-wrap">
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    className="rp-input"
                    style={{paddingRight:44}}
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    ) : (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label style={{display:"block",fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>Confirm Password</label>
                <div className="pw-wrap">
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    className="rp-input"
                    style={{paddingRight:44}}
                    placeholder="Repeat your password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    ) : (
                      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                style={{padding:"15px",background:(loading||!token)?"#a5b4fc":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",border:"none",borderRadius:16,fontSize:15,fontWeight:700,cursor:(loading||!token)?"not-allowed":"pointer",boxShadow:"0 4px 16px rgba(79,70,229,0.3)",fontFamily:"inherit"}}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>

              <p style={{textAlign:"center",fontSize:13,color:"#64748b",margin:0}}>
                Back to{" "}
                <Link href="/login" style={{color:"#4f46e5",fontWeight:700,textDecoration:"none"}}>Login</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}