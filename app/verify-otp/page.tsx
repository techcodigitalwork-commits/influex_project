"use client";

import { useState, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const RESEND_COOLDOWN = 30; // seconds

function ResendOtp({ email }: { email: string }) {
  const [sending,   setSending]   = useState(false);
  const [sent,      setSent]      = useState(false);
  const [cooldown,  setCooldown]  = useState(0);
  const [resendErr, setResendErr] = useState("");

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    const timer = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (cooldown > 0 || sending) return;
    setResendErr("");
    setSent(false);
    try {
      setSending(true);
      const res  = await fetch(`${API}/auth/resend-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to resend OTP");
      setSent(true);
      startCooldown();
    } catch (err: any) {
      setResendErr(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{textAlign:"center"}}>
      {resendErr && (
        <p style={{fontSize:12,color:"#dc2626",marginBottom:8,fontWeight:600}}>{resendErr}</p>
      )}
      {sent && (
        <p style={{fontSize:12,color:"#16a34a",marginBottom:8,fontWeight:600}}>✅ OTP resent! Check your inbox.</p>
      )}
      <p style={{fontSize:13,color:"#94a3b8",margin:0}}>
        Didn&apos;t receive OTP?{" "}
        {cooldown > 0 ? (
          <span style={{color:"#94a3b8",fontWeight:600}}>Resend in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={sending}
            style={{background:"none",border:"none",color:"#4f46e5",fontWeight:700,cursor:sending?"not-allowed":"pointer",fontSize:13,padding:0,fontFamily:"inherit",opacity:sending?0.6:1}}
          >
            {sending ? "Sending…" : "Resend OTP"}
          </button>
        )}
      </p>
    </div>
  );
}

const API = "https://api.collabzy.in/api";

function VerifyOtpForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const email        = searchParams.get("email") ?? "";

  const [otp,      setOtp]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [verified, setVerified] = useState(false);

  const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length < 4) { setError("Please enter the OTP"); return; }
    if (!email) { setError("Email not found. Please signup again."); return; }

    try {
      setLoading(true);

      const res  = await fetch(`${API}/auth/verify-otp`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, otp }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid OTP");

      // ✅ Save token if backend returns it after verification
      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user) {
          const userData = { ...data.user, token: data.token, hasProfile: false, emailVerified: true };
          localStorage.setItem("cb_user", JSON.stringify(userData));
        }
      }

      setVerified(true);
      setTimeout(() => router.push("/my-profile"), 2500);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .otp-input {
          width: 100%;
          padding: 18px 20px;
          background: #f8fafc;
          border: 1.5px solid #e2e8f0;
          border-radius: 16px;
          font-size: 24px;
          font-weight: 700;
          font-family: inherit;
          color: #0f172a;
          outline: none;
          text-align: center;
          letter-spacing: 0.35em;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .otp-input::placeholder {
          color: #cbd5e1;
          letter-spacing: 0.1em;
          font-weight: 400;
          font-size: 15px;
        }
        .otp-input:focus {
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
          background: #fff;
        }
      `}</style>

      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#f8fafc"}}>
        <div style={{maxWidth:420,width:"100%",background:"#fff",borderRadius:32,padding:"48px 36px",boxShadow:"0 20px 60px rgba(79,70,229,0.08)",border:"1.5px solid #e2e8f0",textAlign:"center"}}>

          {verified ? (
            /* ── Success State ── */
            <>
              <div style={{width:72,height:72,background:"#f0fdf4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:36}}>✅</div>
              <h2 style={{fontSize:24,fontWeight:900,color:"#0f172a",marginBottom:8,letterSpacing:"-0.02em"}}>
                Email Verified!
              </h2>
              <p style={{fontSize:14,color:"#64748b",margin:0}}>
                Redirecting you to login…
              </p>
            </>
          ) : (
            /* ── OTP Form ── */
            <>
              {/* Icon */}
              <div style={{width:72,height:72,background:"linear-gradient(135deg,#eef2ff,#ede9fe)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
                <svg width="32" height="32" fill="none" stroke="#4f46e5" viewBox="0 0 24 24">
                  <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>

              <h2 style={{fontSize:26,fontWeight:900,color:"#0f172a",marginBottom:8,letterSpacing:"-0.02em"}}>
                Verify Your Email
              </h2>

              <p style={{fontSize:14,color:"#64748b",marginBottom:4,lineHeight:1.6}}>
                We sent a 6-digit OTP to
              </p>
              <p style={{fontSize:15,fontWeight:700,color:"#4f46e5",marginBottom:28,wordBreak:"break-all"}}>
                {email || "your email"}
              </p>

              {error && (
                <div style={{padding:"12px 16px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:12,color:"#dc2626",fontSize:13,fontWeight:600,marginBottom:20,textAlign:"left"}}>
                  {error}
                </div>
              )}

              <form onSubmit={handleVerify} style={{display:"flex",flexDirection:"column",gap:14}}>
                <input
                  className="otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width:"100%", padding:"15px",
                    background: loading ? "#a5b4fc" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                    color:"#fff", border:"none", borderRadius:16,
                    fontSize:15, fontWeight:700,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow:"0 4px 20px rgba(79,70,229,0.3)",
                    fontFamily:"inherit", transition:"all 0.2s",
                  }}
                >
                  {loading ? "Verifying…" : "Verify Email →"}
                </button>
              </form>

              <div style={{marginTop:24,paddingTop:24,borderTop:"1px solid #f1f5f9"}}>
                <ResendOtp email={email} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
        <div style={{textAlign:"center"}}>
          <div style={{width:40,height:40,border:"3px solid #e2e8f0",borderTop:"3px solid #4f46e5",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.8s linear infinite"}}/>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{color:"#64748b",fontSize:14}}>Loading…</p>
        </div>
      </div>
    }>
      <VerifyOtpForm />
    </Suspense>
  );
}

// "use client";

// import { useState, type FormEvent, Suspense } from "react";
// import { useRouter, useSearchParams } from "next/navigation";

// const RESEND_COOLDOWN = 30; // seconds

// function ResendOtp({ email }: { email: string }) {
//   const [sending,   setSending]   = useState(false);
//   const [sent,      setSent]      = useState(false);
//   const [cooldown,  setCooldown]  = useState(0);
//   const [resendErr, setResendErr] = useState("");

//   const startCooldown = () => {
//     setCooldown(RESEND_COOLDOWN);
//     const timer = setInterval(() => {
//       setCooldown(prev => {
//         if (prev <= 1) { clearInterval(timer); return 0; }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   const handleResend = async () => {
//     if (cooldown > 0 || sending) return;
//     setResendErr("");
//     setSent(false);
//     try {
//       setSending(true);
//       const res  = await fetch(`${API}/auth/resend-otp`, {
//         method:  "POST",
//         headers: { "Content-Type": "application/json" },
//         body:    JSON.stringify({ email }),
//       });
//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Failed to resend OTP");
//       setSent(true);
//       startCooldown();
//     } catch (err: any) {
//       setResendErr(err.message || "Something went wrong");
//     } finally {
//       setSending(false);
//     }
//   };

//   return (
//     <div style={{textAlign:"center"}}>
//       {resendErr && (
//         <p style={{fontSize:12,color:"#dc2626",marginBottom:8,fontWeight:600}}>{resendErr}</p>
//       )}
//       {sent && (
//         <p style={{fontSize:12,color:"#16a34a",marginBottom:8,fontWeight:600}}>✅ OTP resent! Check your inbox.</p>
//       )}
//       <p style={{fontSize:13,color:"#94a3b8",margin:0}}>
//         Didn&apos;t receive OTP?{" "}
//         {cooldown > 0 ? (
//           <span style={{color:"#94a3b8",fontWeight:600}}>Resend in {cooldown}s</span>
//         ) : (
//           <button
//             type="button"
//             onClick={handleResend}
//             disabled={sending}
//             style={{background:"none",border:"none",color:"#4f46e5",fontWeight:700,cursor:sending?"not-allowed":"pointer",fontSize:13,padding:0,fontFamily:"inherit",opacity:sending?0.6:1}}
//           >
//             {sending ? "Sending…" : "Resend OTP"}
//           </button>
//         )}
//       </p>
//     </div>
//   );
// }

// const API = "https://api.collabzy.in/api";

// function VerifyOtpForm() {
//   const router       = useRouter();
//   const searchParams = useSearchParams();
//   const email        = searchParams.get("email") ?? "";

//   const [otp,      setOtp]      = useState("");
//   const [loading,  setLoading]  = useState(false);
//   const [error,    setError]    = useState("");
//   const [verified, setVerified] = useState(false);

//   const handleVerify = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!otp || otp.length < 4) { setError("Please enter the OTP"); return; }
//     if (!email) { setError("Email not found. Please signup again."); return; }

//     try {
//       setLoading(true);

//       const res  = await fetch(`${API}/auth/verify-otp`, {
//         method:  "POST",
//         headers: { "Content-Type": "application/json" },
//         body:    JSON.stringify({ email, otp }),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Invalid OTP");

//       setVerified(true);
//       setTimeout(() => router.push("/login"), 2500);
//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <>
//       <style>{`
//         .otp-input {
//           width: 100%;
//           padding: 18px 20px;
//           background: #f8fafc;
//           border: 1.5px solid #e2e8f0;
//           border-radius: 16px;
//           font-size: 24px;
//           font-weight: 700;
//           font-family: inherit;
//           color: #0f172a;
//           outline: none;
//           text-align: center;
//           letter-spacing: 0.35em;
//           transition: border-color 0.2s, box-shadow 0.2s;
//           box-sizing: border-box;
//         }
//         .otp-input::placeholder {
//           color: #cbd5e1;
//           letter-spacing: 0.1em;
//           font-weight: 400;
//           font-size: 15px;
//         }
//         .otp-input:focus {
//           border-color: #4f46e5;
//           box-shadow: 0 0 0 3px rgba(79,70,229,0.12);
//           background: #fff;
//         }
//       `}</style>

//       <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#f8fafc"}}>
//         <div style={{maxWidth:420,width:"100%",background:"#fff",borderRadius:32,padding:"48px 36px",boxShadow:"0 20px 60px rgba(79,70,229,0.08)",border:"1.5px solid #e2e8f0",textAlign:"center"}}>

//           {verified ? (
//             /* ── Success State ── */
//             <>
//               <div style={{width:72,height:72,background:"#f0fdf4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:36}}>✅</div>
//               <h2 style={{fontSize:24,fontWeight:900,color:"#0f172a",marginBottom:8,letterSpacing:"-0.02em"}}>
//                 Email Verified!
//               </h2>
//               <p style={{fontSize:14,color:"#64748b",margin:0}}>
//                 Redirecting you to login…
//               </p>
//             </>
//           ) : (
//             /* ── OTP Form ── */
//             <>
//               {/* Icon */}
//               <div style={{width:72,height:72,background:"linear-gradient(135deg,#eef2ff,#ede9fe)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 24px"}}>
//                 <svg width="32" height="32" fill="none" stroke="#4f46e5" viewBox="0 0 24 24">
//                   <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
//                 </svg>
//               </div>

//               <h2 style={{fontSize:26,fontWeight:900,color:"#0f172a",marginBottom:8,letterSpacing:"-0.02em"}}>
//                 Verify Your Email
//               </h2>

//               <p style={{fontSize:14,color:"#64748b",marginBottom:4,lineHeight:1.6}}>
//                 We sent a 6-digit OTP to
//               </p>
//               <p style={{fontSize:15,fontWeight:700,color:"#4f46e5",marginBottom:28,wordBreak:"break-all"}}>
//                 {email || "your email"}
//               </p>

//               {error && (
//                 <div style={{padding:"12px 16px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:12,color:"#dc2626",fontSize:13,fontWeight:600,marginBottom:20,textAlign:"left"}}>
//                   {error}
//                 </div>
//               )}

//               <form onSubmit={handleVerify} style={{display:"flex",flexDirection:"column",gap:14}}>
//                 <input
//                   className="otp-input"
//                   type="text"
//                   inputMode="numeric"
//                   maxLength={6}
//                   required
//                   placeholder="Enter OTP"
//                   value={otp}
//                   onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
//                   autoFocus
//                 />

//                 <button
//                   type="submit"
//                   disabled={loading}
//                   style={{
//                     width:"100%", padding:"15px",
//                     background: loading ? "#a5b4fc" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
//                     color:"#fff", border:"none", borderRadius:16,
//                     fontSize:15, fontWeight:700,
//                     cursor: loading ? "not-allowed" : "pointer",
//                     boxShadow:"0 4px 20px rgba(79,70,229,0.3)",
//                     fontFamily:"inherit", transition:"all 0.2s",
//                   }}
//                 >
//                   {loading ? "Verifying…" : "Verify Email →"}
//                 </button>
//               </form>

//               <div style={{marginTop:24,paddingTop:24,borderTop:"1px solid #f1f5f9"}}>
//                 <ResendOtp email={email} />
//               </div>
//             </>
//           )}
//         </div>
//       </div>
//     </>
//   );
// }

// export default function VerifyOtpPage() {
//   return (
//     <Suspense fallback={
//       <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f8fafc"}}>
//         <div style={{textAlign:"center"}}>
//           <div style={{width:40,height:40,border:"3px solid #e2e8f0",borderTop:"3px solid #4f46e5",borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.8s linear infinite"}}/>
//           <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//           <p style={{color:"#64748b",fontSize:14}}>Loading…</p>
//         </div>
//       </div>
//     }>
//       <VerifyOtpForm />
//     </Suspense>
//   );
// }