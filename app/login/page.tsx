"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

const API = "https://api.collabzy.in/api";
const SOCKET_URL = "https://api.collabzy.in";

enum UserRole {
  INFLUENCER = "INFLUENCER",
  MODEL = "MODEL",
  PHOTOGRAPHER = "PHOTOGRAPHER",
  BRAND = "BRAND",
  ADMIN = "ADMIN",
}

type ModalStep = "forgot" | "sent";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  const [showModal, setShowModal]   = useState(false);
  const [modalStep, setModalStep]   = useState<ModalStep>("forgot");
  const [fpEmail, setFpEmail]       = useState("");
  const [fpLoading, setFpLoading]   = useState(false);
  const [fpError, setFpError]       = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

     const signupName = localStorage.getItem("cb_signup_name") || "";

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Login failed");
      if (!data.token || !data.user) throw new Error("Invalid server response");

      const token = data.token;

      const profileRes = await fetch(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();
      const hasProfile = profileData.success && !!profileData.profile;

  //     const profileName = profileData?.profile?.name 
  // || profileData?.profile?.companyName 
  // || "";

  const profileName = profileData?.profile?.name 
  || profileData?.profile?.fullName
  || profileData?.profile?.companyName 
  || "";

      // const isSubscribed    = data.user.isSubscribed ?? false;
      // ✅ NAYA - backend se aata hai true, save karo sahi se
const isSubscribed = data.user.isSubscribed === true;
      const rawPlan         = data.user.plan || data.user.activePlan || null;
      const planActivatedAt = data.user.planActivatedAt ?? null;

      let restoredPlan            = rawPlan;
      let restoredPlanActivatedAt = planActivatedAt;
      if (isSubscribed && !restoredPlan) {
        try {
          const backup = localStorage.getItem("cb_plan_backup");
          if (backup) {
            const b = JSON.parse(backup);
            if (b.activePlan)      restoredPlan            = b.activePlan;
            if (b.planActivatedAt) restoredPlanActivatedAt = b.planActivatedAt;
          }
        } catch { /* silent */ }
      }
      localStorage.removeItem("cb_plan_backup");

      const { coins: _removeCoins, ...userWithoutCoins } = data.user;
      // ✅ Pehle oldUser read karo
const oldStored = localStorage.getItem("cb_user");
const oldUser = oldStored ? JSON.parse(oldStored) : null;


      const userData = {
        ...userWithoutCoins,
        token,
        hasProfile,
        bits:       data.user.bits ?? 100,
        // isSubscribed,
        isSubscribed: data.user.isSubscribed === true, 
        plan:       restoredPlan,
        activePlan: restoredPlan,
        // ✅ email explicitly save karo — backend data.user mein ho ya na ho
        email:      data.user.email || email,
        //  name: profileName || data.user.name || data.user.username || "",
        //  companyName: profileData?.profile?.companyName || "",
//         name: profileName || data.user.name || data.user.username || data.user.fullName ||  data.user.companyName || "",
// companyName: profileData?.profile?.companyName || data.user.companyName || data.user.name || "",
     name: profileName || data.user.name || data.user.fullName || data.user.username || signupName || "",
companyName: profileData?.profile?.companyName || data.user.companyName || signupName || "",
        ...(restoredPlanActivatedAt ? { planActivatedAt: restoredPlanActivatedAt } : {}),
        
      };

      // if (typeof window !== "undefined") {
      //   localStorage.setItem("cb_user", JSON.stringify(userData));
      //   localStorage.setItem("token",   token);
      // }

      if (typeof window !== "undefined") {
  // ✅ Purana cb_user ka name preserve karo agar naya empty hai
  const oldStored = localStorage.getItem("cb_user");
  const oldUser = oldStored ? JSON.parse(oldStored) : null;
  const finalUserData = {
    ...userData,
   name: profileName || data.user.name || data.user.fullName || data.user.username || oldUser?.name || "",
  companyName: profileData?.profile?.companyName || data.user.companyName || oldUser?.companyName || "",
  };
  localStorage.setItem("cb_user", JSON.stringify(finalUserData));
  localStorage.setItem("token", token);
}

      const socket = io(SOCKET_URL, { auth: { token } });
      socket.on("connect", () => socket.emit("joinRoom", data.user._id));

      

      if (userData.role === UserRole.BRAND || userData.role === UserRole.ADMIN) {
        router.push("/campaigns");
      } else {
        router.push("/discovery");
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const openForgot = () => {
    setFpEmail("");
    setFpError("");
    setModalStep("forgot");
    setShowModal(true);
  };

  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFpError("");
    if (!fpEmail) { setFpError("Please enter your email"); return; }

    try {
      setFpLoading(true);
      const res  = await fetch(`${API}/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: fpEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send reset email");
      setModalStep("sent");
    } catch (err: any) {
      setFpError(err.message || "Something went wrong");
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-input {
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
          opacity: 1;
          box-sizing: border-box;
        }
        .login-input::placeholder { color: #94a3b8; -webkit-text-fill-color: #94a3b8; }
        .login-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.12); background: #fff; }
        .login-input:-webkit-autofill,
        .login-input:-webkit-autofill:hover,
        .login-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #0f172a !important;
          -webkit-box-shadow: 0 0 0px 1000px #f8fafc inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        .pw-wrap { position: relative; }
        .pw-toggle { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #94a3b8; line-height: 1; display: flex; align-items: center; }
        .pw-toggle:hover { color: #4f46e5; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 24px; }
        .modal-box { background: #fff; border-radius: 24px; padding: 36px 32px; width: 100%; max-width: 420px; box-shadow: 0 24px 64px rgba(79,70,229,0.15); border: 1.5px solid #e2e8f0; }
      `}</style>

      <div style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#f8fafc"}}>
        <div style={{maxWidth:440,width:"100%",background:"#fff",borderRadius:32,padding:"40px 36px",boxShadow:"0 20px 60px rgba(79,70,229,0.08)",border:"1px solid #e2e8f0"}}>

          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{width:180,height:80,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}>
              <img src="/collabzy-logo.png" alt="Collabzy" style={{height:"100%",width:"100%",objectFit:"contain"}} />
            </div>
            <h2 style={{fontSize:28,fontWeight:800,color:"#0f172a",margin:"0 0 6px"}}>Welcome Back</h2>
            <p style={{color:"#64748b",fontSize:14,margin:0}}>Log in to manage your brand or profile</p>
          </div>

          <form onSubmit={handleLogin}>
            {error && (
              <div style={{padding:"12px 16px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:12,color:"#dc2626",fontSize:13,fontWeight:600,marginBottom:20}}>
                {error}
              </div>
            )}

            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>Email Address</label>
              <input type="email" required className="login-input" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div style={{marginBottom:8}}>
              <label style={{display:"block",fontSize:13,fontWeight:700,color:"#374151",marginBottom:8}}>Password</label>
              <div className="pw-wrap">
                <input type={showPassword ? "text" : "password"} required className="login-input" style={{paddingRight:44}} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{textAlign:"right",marginBottom:24}}>
              <button type="button" onClick={openForgot} style={{background:"none",border:"none",color:"#4f46e5",fontSize:13,fontWeight:600,cursor:"pointer",padding:0}}>
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} style={{width:"100%",padding:"15px",background:loading?"#a5b4fc":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",border:"none",borderRadius:16,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",transition:"all 0.2s",boxShadow:"0 4px 16px rgba(79,70,229,0.3)",fontFamily:"inherit"}}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </form>

          <div style={{marginTop:28,paddingTop:28,borderTop:"1px solid #f1f5f9",textAlign:"center"}}>
            <p style={{color:"#64748b",fontSize:14,margin:0}}>
              Don&apos;t have an account?{" "}
              <Link href="/join" style={{color:"#4f46e5",fontWeight:700,textDecoration:"none"}}>Join Platform</Link>
            </p>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-box">
            {modalStep === "forgot" ? (
              <>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
                  <h3 style={{fontSize:20,fontWeight:800,color:"#0f172a",margin:0}}>Reset Password</h3>
                  <button onClick={() => setShowModal(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",fontSize:24,lineHeight:1,padding:0}}>×</button>
                </div>
                <p style={{fontSize:14,color:"#64748b",marginBottom:20}}>Enter your email and we&apos;ll send a reset link.</p>
                {fpError && (
                  <div style={{padding:"10px 14px",background:"#fff5f5",border:"1.5px solid #fecaca",borderRadius:10,color:"#dc2626",fontSize:13,fontWeight:600,marginBottom:16}}>
                    {fpError}
                  </div>
                )}
                <form onSubmit={handleForgotPassword} style={{display:"flex",flexDirection:"column",gap:14}}>
                  <input type="email" required className="login-input" placeholder="name@example.com" value={fpEmail} onChange={e => setFpEmail(e.target.value)} autoComplete="email" />
                  <button type="submit" disabled={fpLoading} style={{padding:"13px",background:fpLoading?"#a5b4fc":"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",border:"none",borderRadius:14,fontSize:14,fontWeight:700,cursor:fpLoading?"not-allowed":"pointer",fontFamily:"inherit"}}>
                    {fpLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>
              </>
            ) : (
              <div style={{textAlign:"center",padding:"8px 0"}}>
                <div style={{width:56,height:56,background:"#f0fdf4",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>✅</div>
                <h3 style={{fontSize:20,fontWeight:800,color:"#0f172a",marginBottom:8}}>Check Your Email</h3>
                <p style={{fontSize:14,color:"#64748b",marginBottom:24}}>
                  We sent a password reset link to <strong style={{color:"#0f172a"}}>{fpEmail}</strong>. Check your inbox.
                </p>
                <button onClick={() => setShowModal(false)} style={{padding:"12px 28px",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",border:"none",borderRadius:14,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}



