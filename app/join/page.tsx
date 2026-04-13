"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "https://api.collabzy.in/api";

enum UserRole {
  INFLUENCER = "INFLUENCER",
  BRAND = "BRAND",
}

export default function JoinPage() {
  const router = useRouter();

  const [step,     setStep]     = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);

  const [formData, setFormData] = useState({
    name:     "",
    email:    "",
    password: "",
    role:     UserRole.INFLUENCER,
  });

  const handleRoleSelect = (role: UserRole) => {
    setFormData({ ...formData, role });
    setStep(2);
  };

  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      const res  = await fetch(`${API}/auth/signup`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Signup failed");

      if (data.token) {
        localStorage.setItem("token", data.token);
        if (data.user) {
          localStorage.setItem("cb_user", JSON.stringify({
            ...data.user,
            token: data.token,
             emailVerified: false, 
            hasProfile: false,
            // ✅ email explicitly save karo
            email: data.user.email || formData.email,
            name:  data.user.name  || formData.name,
          }));
        }
      }
    localStorage.setItem("cb_signup_name", formData.name);
      router.push(`/verify-otp?email=${encodeURIComponent(formData.email)}`);

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"85vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"48px 24px",background:"#ffffff"}}>
      <div style={{maxWidth:"896px",width:"100%"}}>

        {step === 1 ? (
          <div>
            <div style={{textAlign:"center",marginBottom:"64px"}}>
              <h1 style={{fontSize:"clamp(32px, 5vw, 48px)",fontWeight:900,color:"#0f172a",marginBottom:"12px",letterSpacing:"-0.02em"}}>
                Choose Your Path
              </h1>
              <p style={{fontSize:"17px",color:"#64748b",fontWeight:500}}>
                Select your account type to get started
              </p>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))",gap:"24px",maxWidth:"720px",margin:"0 auto"}}>
              <button
                onClick={() => handleRoleSelect(UserRole.INFLUENCER)}
                style={{background:"#ffffff",padding:"40px 36px",borderRadius:"28px",border:"2px solid #e2e8f0",textAlign:"left",cursor:"pointer",transition:"all 0.2s",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor="#4f46e5"; b.style.boxShadow="0 12px 40px rgba(79,70,229,0.15)"; b.style.transform="translateY(-4px)"; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor="#e2e8f0"; b.style.boxShadow="0 4px 24px rgba(0,0,0,0.06)"; b.style.transform="translateY(0)"; }}
              >
                <h3 style={{fontSize:"22px",fontWeight:800,color:"#0f172a",marginBottom:"8px"}}>I am a Creator</h3>
                <p style={{fontSize:"14px",color:"#64748b",fontWeight:500,margin:0}}>Influencer, Model, Photographer</p>
              </button>

              <button
                onClick={() => handleRoleSelect(UserRole.BRAND)}
                style={{background:"#ffffff",padding:"40px 36px",borderRadius:"28px",border:"2px solid #e2e8f0",textAlign:"left",cursor:"pointer",transition:"all 0.2s",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor="#7c3aed"; b.style.boxShadow="0 12px 40px rgba(124,58,237,0.15)"; b.style.transform="translateY(-4px)"; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor="#e2e8f0"; b.style.boxShadow="0 4px 24px rgba(0,0,0,0.06)"; b.style.transform="translateY(0)"; }}
              >
                <h3 style={{fontSize:"22px",fontWeight:800,color:"#0f172a",marginBottom:"8px"}}>I am a Brand</h3>
                <p style={{fontSize:"14px",color:"#64748b",fontWeight:500,margin:0}}>Discover creators & run campaigns</p>
              </button>
            </div>

            <p style={{textAlign:"center",marginTop:"48px",color:"#64748b",fontWeight:500,fontSize:"15px"}}>
              Already have an account?{" "}
              <Link href="/login" style={{color:"#4f46e5",fontWeight:700,textDecoration:"none"}}>Log in</Link>
            </p>
          </div>

        ) : (
          <div style={{maxWidth:"440px",margin:"0 auto",background:"#ffffff",borderRadius:"32px",padding:"40px",boxShadow:"0 20px 60px rgba(0,0,0,0.1)",border:"1.5px solid #e2e8f0"}}>
            <button
              onClick={() => { setStep(1); setError(""); }}
              style={{marginBottom:"24px",fontSize:"13px",color:"#94a3b8",background:"none",border:"none",cursor:"pointer",fontWeight:500,padding:0,fontFamily:"inherit"}}
            >
              ← Change Role
            </button>

            <h2 style={{fontSize:"28px",fontWeight:900,textAlign:"center",color:"#0f172a",marginBottom:"28px",letterSpacing:"-0.02em"}}>
              Create Account
            </h2>

            {error && (
              <div style={{marginBottom:"16px",padding:"12px 16px",background:"#fef2f2",color:"#dc2626",borderRadius:"12px",fontSize:"13px",fontWeight:600}}>
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} style={{display:"flex",flexDirection:"column",gap:"16px"}}>
              <input
                required type="text" placeholder="Full Name"
                style={{width:"100%",padding:"14px 20px",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"16px",fontSize:"14px",color:"#0f172a",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />

              <input
                required type="email" placeholder="Email"
                style={{width:"100%",padding:"14px 20px",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"16px",fontSize:"14px",color:"#0f172a",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />

              <div style={{position:"relative"}}>
                <input
                  required type={showPass ? "text" : "password"} placeholder="Password"
                  style={{width:"100%",padding:"14px 20px",paddingRight:"48px",background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:"16px",fontSize:"14px",color:"#0f172a",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{position:"absolute",right:"14px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:4,color:"#94a3b8",display:"flex",alignItems:"center"}}>
                  {showPass
                    ? <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    : <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3" strokeWidth="2"/></svg>
                  }
                </button>
              </div>

              <button type="submit" disabled={loading}
                style={{width:"100%",padding:"15px",background:"linear-gradient(135deg,#4f46e5,#7c3aed)",color:"#fff",borderRadius:"16px",fontWeight:700,fontSize:"15px",border:"none",cursor:loading?"not-allowed":"pointer",opacity:loading?0.6:1,boxShadow:"0 4px 20px rgba(79,70,229,0.35)",fontFamily:"inherit"}}>
                {loading ? "Creating Account..." : "Create Account →"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


