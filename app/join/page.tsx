"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

enum UserRole {
  INFLUENCER = "INFLUENCER",
  BRAND = "BRAND",
}

export default function JoinPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: UserRole.INFLUENCER,
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

      const res = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Signup failed");

      const token = data.token;

      // ✅ Signup ke baad profile check karo
      const profileRes = await fetch(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();
      const hasProfile = profileData.success && !!profileData.profile;

      const userData = {
        ...data.user,
        token,
        hasProfile,
      };

      localStorage.setItem("cb_user", JSON.stringify(userData));
      localStorage.setItem("token", token);

      // ✅ 1st time signup — profile nahi hogi → /my-profile
      // Next time login → profile hogi → /discovery ya /campaigns
      if (!hasProfile) {
        router.push("/my-profile");
        return;
      }

      if (userData.role === UserRole.BRAND) {
        router.push("/campaigns");
      } else {
        router.push("/discovery");
      }

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 bg-slate-50/50">
      <div className="max-w-4xl w-full">
        {step === 1 ? (
          <div>
            <div className="text-center mb-16">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
                Choose Your Path
              </h1>
              <p className="text-lg text-slate-500">
                Select your account type to get started
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              <button
                onClick={() => handleRoleSelect(UserRole.INFLUENCER)}
                className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
              >
                <h3 className="text-2xl font-bold mb-2">I am a Creator</h3>
                <p className="text-slate-500 text-sm">Influencer, Model, Photographer</p>
              </button>

              <button
                onClick={() => handleRoleSelect(UserRole.BRAND)}
                className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-violet-600 transition-all text-left shadow-xl"
              >
                <h3 className="text-2xl font-bold mb-2">I am a Brand</h3>
                <p className="text-slate-500 text-sm">Discover creators & run campaigns</p>
              </button>
            </div>

            <p className="text-center mt-12 text-slate-500 font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-indigo-600 font-bold hover:underline">
                Log in
              </Link>
            </p>
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl border">
            <button
              onClick={() => setStep(1)}
              className="mb-6 text-sm text-slate-400 hover:text-indigo-600"
            >
              ← Change Role
            </button>

            <h2 className="text-3xl font-extrabold text-center mb-6">Create Account</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-5">
              <input
                required
                type="text"
                placeholder="Full Name"
                className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />

              <input
                required
                type="email"
                placeholder="Email"
                className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />

              <div className="relative">
                <input
                  required
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  className="w-full px-5 py-4 pr-12 bg-slate-50 border rounded-2xl"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                <img
                  src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
                  alt="show password"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-[14px] w-6 h-6 cursor-pointer opacity-70"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}


// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   BRAND = "BRAND",
// }

// export default function JoinPage() {
//   const router = useRouter();

//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     password: "",
//     role: UserRole.INFLUENCER,
//   });

//   const [showPass, setShowPass] = useState(false); // ✨ ADDED

//   const handleRoleSelect = (role: UserRole) => {
//     setFormData({ ...formData, role });
//     setStep(2);
//   };

//   const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/signup",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(formData),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Signup failed");
//       }

//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       if (!userData.hasProfile) {
//         router.push("/my-profile");
//       } else {
//         if (userData.role === UserRole.BRAND) {
//           router.push("/campaigns");
//         } else {
//           router.push("/discovery");
//         }
//       }
//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 bg-slate-50/50">
//       <div className="max-w-4xl w-full">
//         {step === 1 ? (
//           <div>
//             <div className="text-center mb-16">
//               <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
//                 Choose Your Path
//               </h1>
//               <p className="text-lg text-slate-500">
//                 Select your account type to get started
//               </p>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
//               <button
//                 onClick={() => handleRoleSelect(UserRole.INFLUENCER)}
//                 className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <h3 className="text-2xl font-bold mb-2">I am a Creator</h3>
//                 <p className="text-slate-500 text-sm">
//                   Influencer, Model, Photographer
//                 </p>
//               </button>

//               <button
//                 onClick={() => handleRoleSelect(UserRole.BRAND)}
//                 className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-violet-600 transition-all text-left shadow-xl"
//               >
//                 <h3 className="text-2xl font-bold mb-2">I am a Brand</h3>
//                 <p className="text-slate-500 text-sm">
//                   Discover creators & run campaigns
//                 </p>
//               </button>
//             </div>

//             <p className="text-center mt-12 text-slate-500 font-medium">
//               Already have an account?{" "}
//               <Link
//                 href="/login"
//                 className="text-indigo-600 font-bold hover:underline"
//               >
//                 Log in
//               </Link>
//             </p>
//           </div>
//         ) : (
//           <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl border">
//             <button
//               onClick={() => setStep(1)}
//               className="mb-6 text-sm text-slate-400 hover:text-indigo-600"
//             >
//               ← Change Role
//             </button>

//             <h2 className="text-3xl font-extrabold text-center mb-6">
//               Create Account
//             </h2>

//             {error && (
//               <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">
//                 {error}
//               </div>
//             )}

//             <form onSubmit={handleJoin} className="space-y-5">
//               <input
//                 required
//                 type="text"
//                 placeholder="Full Name"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.name}
//                 onChange={(e) =>
//                   setFormData({ ...formData, name: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               {/* 👇 PASSWORD FIELD WITH ICON */}
//               <div className="relative">
//                 <input
//                   required
//                   type={showPass ? "text" : "password"}  // 👈 SHOW/HIDE
//                   placeholder="Password"
//                   className="w-full px-5 py-4 pr-12 bg-slate-50 border rounded-2xl"
//                   value={formData.password}
//                   onChange={(e) =>
//                     setFormData({ ...formData, password: e.target.value })
//                   }
//                 />
//                 <img
//                   src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//                   alt="show password"
//                   onClick={() => setShowPass(!showPass)} // 👈 TOGGLE
//                   className="absolute right-4 top-[14px] w-6 h-6 cursor-pointer opacity-70"
//                 />
//               </div>

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
//               >
//                 {loading ? "Creating Account..." : "Create Account"}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   BRAND = "BRAND",
// }

// export default function JoinPage() {
//   const router = useRouter();

//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     password: "",
//     role: UserRole.INFLUENCER,
//   });

//   const handleRoleSelect = (role: UserRole) => {
//     setFormData({ ...formData, role });
//     setStep(2);
//   };

//   const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/signup",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(formData),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Signup failed");
//       }

//       // Expected response:
//       // { success, user, token }

//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };



//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // Redirect logic
//       if (!userData.hasProfile) {
//         router.push("/my-profile");
//       } else {
//         if (userData.role === UserRole.BRAND) {
//           router.push("/campaigns");
//         } else {
//           router.push("/discovery");
//         }
//       }
//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 bg-slate-50/50">
//       <div className="max-w-4xl w-full">
//         {step === 1 ? (
//           <div>
//             <div className="text-center mb-16">
//               <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4">
//                 Choose Your Path
//               </h1>
//               <p className="text-lg text-slate-500">
//                 Select your account type to get started
//               </p>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
//               {/* Creator */}
//               <button
//                 onClick={() => handleRoleSelect(UserRole.INFLUENCER)}
//                 className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <h3 className="text-2xl font-bold mb-2">
//                   I am a Creator
//                 </h3>
//                 <p className="text-slate-500 text-sm">
//                   Influencer, Model, Photographer
//                 </p>
//               </button>

//               {/* Brand */}
//               <button
//                 onClick={() => handleRoleSelect(UserRole.BRAND)}
//                 className="bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-violet-600 transition-all text-left shadow-xl"
//               >
//                 <h3 className="text-2xl font-bold mb-2">
//                   I am a Brand
//                 </h3>
//                 <p className="text-slate-500 text-sm">
//                   Discover creators & run campaigns
//                 </p>
//               </button>
//             </div>

//             <p className="text-center mt-12 text-slate-500 font-medium">
//               Already have an account?{" "}
//               <Link
//                 href="/login"
//                 className="text-indigo-600 font-bold hover:underline"
//               >
//                 Log in
//               </Link>
//             </p>
//           </div>
//         ) : (
//           <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl border">
//             <button
//               onClick={() => setStep(1)}
//               className="mb-6 text-sm text-slate-400 hover:text-indigo-600"
//             >
//               ← Change Role
//             </button>

//             <h2 className="text-3xl font-extrabold text-center mb-6">
//               Create Account
//             </h2>

//             {error && (
//               <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-semibold">
//                 {error}
//               </div>
//             )}

//             <form onSubmit={handleJoin} className="space-y-5">
//               <input
//                 required
//                 type="text"
//                 placeholder="Full Name"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.name}
//                 onChange={(e) =>
//                   setFormData({ ...formData, name: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
//               >
//                 {loading ? "Creating Account..." : "Create Account"}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   BRAND = "BRAND",
// }

// const JoinPage: React.FC = () => {
//   const router = useRouter();

//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const [formData, setFormData] = useState({
//     name: "",
//     email: "",
//     password: "",
//     role: UserRole.INFLUENCER,
//   });

//   const handleRoleSelect = (role: UserRole) => {
//     setFormData({ ...formData, role });
//     setStep(2);
//   };

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://13.210.109.234:5000/api/auth/signup",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(formData),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.message || "Signup failed");
//         setLoading(false);
//         return;
//       }

//       // Backend expected response:
//       // { success, user, token }

//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // Redirect
//       if (!userData.hasProfile) {
//         router.push("/setup-profile");
//       } else {
//         if (userData.role === "BRAND") {
//           router.push("/campaigns");
//         } else {
//           router.push("/discovery");
//         }
//       }
//     } catch (err) {
//       console.error("Signup error:", err);
//       setError("Server error. Try again later.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[85vh] flex items-center justify-center px-6 py-12 bg-slate-50/50">
//       <div className="max-w-4xl w-full">
//         {step === 1 ? (
//           <div>
//             <div className="text-center mb-16">
//               <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
//                 Choose Your Path
//               </h1>
//               <p className="text-lg text-slate-500">
//                 Select your account type to get started
//               </p>
//             </div>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
//               <button
//                 onClick={() => handleRoleSelect(UserRole.INFLUENCER)}
//                 className="bg-white p-10 rounded-[40px] border-2 hover:border-indigo-600 shadow-xl text-left"
//               >
//                 <h3 className="text-2xl font-bold mb-2">
//                   I am a Creator
//                 </h3>
//                 <p className="text-slate-500 text-sm">
//                   Influencer, Model, Photographer
//                 </p>
//               </button>

//               <button
//                 onClick={() => handleRoleSelect(UserRole.BRAND)}
//                 className="bg-white p-10 rounded-[40px] border-2 hover:border-violet-600 shadow-xl text-left"
//               >
//                 <h3 className="text-2xl font-bold mb-2">
//                   I am a Brand
//                 </h3>
//                 <p className="text-slate-500 text-sm">
//                   Discover creators & run campaigns
//                 </p>
//               </button>
//             </div>

//             <p className="text-center mt-12 text-slate-500 font-medium">
//               Already have an account?{" "}
//               <Link
//                 href="/login"
//                 className="text-indigo-600 font-bold hover:underline"
//               >
//                 Log in
//               </Link>
//             </p>
//           </div>
//         ) : (
//           <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl border">
//             <button
//               onClick={() => setStep(1)}
//               className="mb-6 text-sm text-slate-400 hover:text-indigo-600"
//             >
//               ← Change Role
//             </button>

//             <h2 className="text-3xl font-extrabold text-center mb-6">
//               Create Account
//             </h2>

//             {error && (
//               <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm">
//                 {error}
//               </div>
//             )}

//             <form onSubmit={handleJoin} className="space-y-5">
//               <input
//                 required
//                 type="text"
//                 placeholder="Full Name"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.name}
//                 onChange={(e) =>
//                   setFormData({ ...formData, name: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 disabled:opacity-50"
//               >
//                 {loading ? "Creating Account..." : "Create Account"}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default JoinPage;




// 'use client';

// import React, { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// /* Backend enum compatible (lowercase) */
// export type UserRole = 'influencer' | 'photographer' | 'brand';

// export default function JoinPage() {
//   const router = useRouter();
//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const [formData, setFormData] = useState({
//     email: '',
//     password: '',
//     role: 'influencer' as UserRole,
//   });

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     try {
//   const res = await fetch('http://13.210.109.234:5000/api/auth/signup', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       email: formData.email.trim().toLowerCase(),
//       password: formData.password,
//       role: formData.role,
//     }),
//   });

//   const data = await res.json();

//   if (!res.ok) {
//     throw new Error(data?.message || 'Signup failed');
//   }

//   if (!data?.user || !data?.token) {
//     throw new Error('Invalid server response');
//   }

//   // ✅ Prepare user object
//   const userData = {
//     ...data.user,
//     hasProfile: data.user?.hasProfile ?? false,
//   };

//   // ✅ Store token & user (same structure as login)
//   localStorage.setItem('token', data.token);
//   localStorage.setItem('user', JSON.stringify(userData));

//   // ✅ Redirect properly
//   if (!userData.hasProfile) {
//     router.push('/setup-profile');
//   } else {
//     router.push('/discovery');
//   }

// } catch (err: any) {
//   if (err.name === 'TypeError') {
//     setError('Unable to connect to server');
//   } else {
//     setError(err.message || 'Something went wrong');
//   }
// } finally {
//   setLoading(false);
// }

//    };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-4xl w-full">

//         {/* STEP 1 */}
//         {step === 1 && (
//           <div className="text-center">
//             <h1 className="text-4xl font-extrabold mb-4">
//               Join CreatorBridge
//             </h1>
//             <p className="text-slate-500 mb-12">
//               Select your role
//             </p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               {[
//                 { label: 'Influencer', value: 'influencer' },
//                 { label: 'Photographer', value: 'photographer' },
//                 { label: 'Brand', value: 'brand' },
//               ].map((item) => (
//                 <button
//                   key={item.value}
//                   type="button"
//                   onClick={() => {
//                     setFormData({ ...formData, role: item.value as UserRole });
//                     setStep(2);
//                   }}
//                   className="bg-white p-8 rounded-3xl border hover:border-indigo-600 shadow-lg text-left transition"
//                 >
//                   <h3 className="text-xl font-bold">{item.label}</h3>
//                   <p className="text-slate-500 text-sm mt-1">
//                     Continue as {item.label}
//                   </p>
//                 </button>
//               ))}
//             </div>

//             <p className="mt-10 text-slate-500">
//               Already have an account?{' '}
//               <Link href="/login" className="text-indigo-600 font-bold">
//                 Login
//               </Link>
//             </p>
//           </div>
//         )}

//         {/* STEP 2 */}
//         {step === 2 && (
//           <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl">
//             <button
//               type="button"
//               onClick={() => setStep(1)}
//               className="text-slate-400 hover:text-indigo-600 mb-6"
//             >
//               ← Back
//             </button>

//             <h2 className="text-2xl font-extrabold mb-6">
//               Create Account
//             </h2>

//             <form onSubmit={handleJoin} className="space-y-4">

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               <select
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.role}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     role: e.target.value as UserRole,
//                   })
//                 }
//               >
//                 <option value="influencer">Influencer</option>
//                 <option value="photographer">Photographer</option>
//                 <option value="brand">Brand</option>
//               </select>

//               {error && (
//                 <p className="text-red-500 text-sm font-bold">
//                   {error}
//                 </p>
//               )}

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60 transition"
//               >
//                 {loading ? 'Creating...' : 'Create Account'}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }



// 'use client';

// import React, { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// /* Backend enum compatible */
// export type UserRole = 'Influencer' | 'Photographer' | 'Brand';


// export default function JoinPage() {
//   const router = useRouter();
//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const [formData, setFormData] = useState({
//     email: '',
//     password: '',
//     role: 'Influencer' as UserRole,
//   });

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     try {
//       const res = await fetch('http://13.210.109.234:5000/api/auth/signup', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           email: formData.email.trim(),
//           password: formData.password,
//           role: formData.role,
//         }),
//       });

//       let data: any = {};
//       try {
//         data = await res.json();
//       } catch {
//         throw new Error('Invalid server response');
//       }

//       if (!res.ok) {
//         throw new Error(data?.message || 'Signup failed');
//       }

//       if (!data?.user) {
//         throw new Error('User not returned from server');
//       }

//       localStorage.setItem(
//         'cb_user',
//         JSON.stringify({
//           email: data.user.email,
//           role: data.user.role,
//           token: data.token || null,
//         })
//       );

//       router.push('/discovery');

//     } catch (err: any) {
//       if (err.name === 'TypeError') {
//         setError('Unable to connect to server');
//       } else {
//         setError(err.message || 'Something went wrong');
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-4xl w-full">

//         {/* STEP 1 */}
//         {step === 1 && (
//           <div className="text-center">
//             <h1 className="text-4xl font-extrabold mb-4">
//               Join CreatorBridge
//             </h1>
//             <p className="text-slate-500 mb-12">
//               Select your role
//             </p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               {(['Influencer', 'Photographer', 'Brand'] as UserRole[]).map((role) => (
//                 <button
//                   key={role}
//                   type="button"
//                   onClick={() => {
//                     setFormData({ ...formData, role });
//                     setStep(2);
//                   }}
//                   className="bg-white p-8 rounded-3xl border hover:border-indigo-600 shadow-lg text-left transition"
//                 >
//                   <h3 className="text-xl font-bold">{role}</h3>
//                   <p className="text-slate-500 text-sm mt-1">
//                     Continue as {role}
//                   </p>
//                 </button>
//               ))}
//             </div>

//             <p className="mt-10 text-slate-500">
//               Already have an account?{' '}
//               <Link href="/login" className="text-indigo-600 font-bold">
//                 Login
//               </Link>
//             </p>
//           </div>
//         )}

//         {/* STEP 2 */}
//         {step === 2 && (
//           <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl">
//             <button
//               type="button"
//               onClick={() => setStep(1)}
//               className="text-slate-400 hover:text-indigo-600 mb-6"
//             >
//               ← Back
//             </button>

//             <h2 className="text-2xl font-extrabold mb-6">
//               Create Account
//             </h2>

//             <form onSubmit={handleJoin} className="space-y-4">

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               <select
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.role}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     role: e.target.value as UserRole,
//                   })
//                 }
//               >
//                 <option value="Influencer">Influencer</option>
//                 <option value="Photographer">Photographer</option>
//                 <option value="Brand">Brand</option>
//               </select>

//               {error && (
//                 <p className="text-red-500 text-sm font-bold">
//                   {error}
//                 </p>
//               )}

//               <button
//                 type="submit"
//                 disabled={loading}
//                 className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60 transition"
//               >
//                 {loading ? 'Creating...' : 'Create Account'}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }




// 'use client';

// import React, { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// /* ===== Backend-compatible roles ===== */
// export type UserRole =
//   | 'Influencer'
//   // | 'Model'
//   | 'Photographer'
//   | 'Brand';

// export default function JoinPage() {
//   const router = useRouter();
//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const [formData, setFormData] = useState({
//     // name: '',
//     email: '',
//     password: '',
//     role: 'Influencer' as UserRole,
//   });

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     try {
//       const res = await fetch('http://13.210.109.234:5000/api/auth/signup', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           // name: formData.name,
//           email: formData.email,
//           password: formData.password,
//           role: formData.role, // ✅ exact enum value
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data?.message || 'Signup failed');
//       }

//       localStorage.setItem(
//         'cb_user',
//         JSON.stringify({
//           email: data.user?.email,
//           role: data.user?.role,
//           token: data.token,
//         })
//       );

//       router.push('/discovery');
//     } catch (err: any) {
//       setError(err.message || 'Server error');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-4xl w-full">

//         {/* ================= STEP 1 ================= */}
//         {step === 1 && (
//           <div className="text-center">
//             <h1 className="text-4xl font-extrabold mb-4">
//               Join CreatorBridge
//             </h1>
//             <p className="text-slate-500 mb-12">
//               Select your role
//             </p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//               {['Influencer', 'Photographer', 'Brand'].map((role) => (
//                 <button
//                   key={role}
//                   onClick={() => {
//                     setFormData({ ...formData, role: role as UserRole });
//                     setStep(2);
//                   }}
//                   className="bg-white p-8 rounded-3xl border hover:border-indigo-600 shadow-lg text-left"
//                 >
//                   <h3 className="text-xl font-bold">{role}</h3>
//                   <p className="text-slate-500 text-sm mt-1">
//                     Continue as {role}
//                   </p>
//                 </button>
//               ))}
//             </div>

//             <p className="mt-10 text-slate-500">
//               Already have an account?{' '}
//               <Link href="/login" className="text-indigo-600 font-bold">
//                 Login
//               </Link>
//             </p>
//           </div>
//         )}

//         {/* ================= STEP 2 ================= */}
//         {step === 2 && (
//           <div className="max-w-md mx-auto bg-white p-10 rounded-3xl shadow-2xl">
//             <button
//               onClick={() => setStep(1)}
//               className="text-slate-400 hover:text-indigo-600 mb-6"
//             >
//               ← Back
//             </button>

//             <h2 className="text-2xl font-extrabold mb-6">
//               Create Account
//             </h2>

//             <form onSubmit={handleJoin} className="space-y-4">
//               {/* <input
//                 required
//                 placeholder="Full Name"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.name}
//                 onChange={(e) =>
//                   setFormData({ ...formData, name: e.target.value })
//                 }
//               /> */}

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               <select
//                 className="w-full px-4 py-3 border rounded-xl"
//                 value={formData.role}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     role: e.target.value as UserRole,
//                   })
//                 }
//               >
//                 <option value="Influencer">Influencer</option>
//                 <option value="Model">Model</option>
//                 <option value="Photographer">Photographer</option>
//                 <option value="Brand">Brand</option>
//               </select>

//               {error && (
//                 <p className="text-red-500 text-sm font-bold">{error}</p>
//               )}

//               <button
//                 disabled={loading}
//                 className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-60"
//               >
//                 {loading ? 'Creating...' : 'Create Account'}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }


// 'use client';

// import React, { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// /* ===== UserRole enum ===== */
// export enum UserRole {
//   INFLUENCER = 'Influencer',
//   BRAND = 'Brand',
//   // p= 'ADMIN',
// }

// export default function JoinPage() {
//   const router = useRouter();
//   const [step, setStep] = useState(1);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const [formData, setFormData] = useState({
//     name: '',
//     email: '',
//     password: '',
//     role: UserRole.INFLUENCER,
//   });

//   const handleRoleSelection = (role: UserRole) => {
//     setFormData((prev) => ({ ...prev, role }));
//     setStep(2);
//   };

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     try {
//       const res = await fetch('http://13.210.109.234:5000/auth/signup', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           role: formData.role,
//           email: formData.email,
//           password: formData.password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || 'Signup failed');
//       }

//       // save user locally (for navbar login state)
//       localStorage.setItem(
//         'cb_user',
//         JSON.stringify({
//           name: formData.name,
//           email: formData.email,
//           role: formData.role,
//           token: data.token, // if backend sends token
//         })
//       );

//       router.push('/discovery');
//     } catch (err: any) {
//       setError(err.message || 'Something went wrong');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-4xl w-full">

//         {/* ================= STEP 1 ================= */}
//         {step === 1 && (
//           <div className="text-center">
//             <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
//               Join CreatorBridge India
//             </h1>
//             <p className="text-xl text-slate-500 mb-12">
//               Choose your path to get started
//             </p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//               <button
//                 onClick={() => handleRoleSelection(UserRole.INFLUENCER)}
//                 className="group bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mb-6">
//                   🎨
//                 </div>
//                 <h3 className="text-2xl font-bold">I'm a Creator</h3>
//                 <p className="text-slate-500">
//                   Collaborate with brands and earn from content.
//                 </p>
//               </button>

//               <button
//                 onClick={() => handleRoleSelection(UserRole.BRAND)}
//                 className="group bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center text-3xl mb-6">
//                   🏢
//                 </div>
//                 <h3 className="text-2xl font-bold">I'm a Brand</h3>
//                 <p className="text-slate-500">
//                   Find creators for campaigns.
//                 </p>
//               </button>
//             </div>

//             <p className="mt-12 text-slate-500 font-medium">
//               Already have an account?{' '}
//               <Link href="/login" className="text-indigo-600 font-bold">
//                 Log in
//               </Link>
//             </p>
//           </div>
//         )}

//         {/* ================= STEP 2 ================= */}
//         {step === 2 && (
//           <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl">
//             <button
//               onClick={() => setStep(1)}
//               className="text-slate-400 hover:text-indigo-600 font-bold mb-6"
//             >
//               ← Back
//             </button>

//             <h2 className="text-3xl font-extrabold mb-6">Final Details</h2>

//             <form onSubmit={handleJoin} className="space-y-5">
//               {/* <input
//                 required
//                 placeholder="Full Name"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.name}
//                 onChange={(e) =>
//                   setFormData({ ...formData, name: e.target.value })
//                 }
//               /> */}

//               <select
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.role}
//                 onChange={(e) =>
//                   setFormData({
//                     ...formData,
//                     role: e.target.value as UserRole,
//                   })
//                 }
//               >
//                 <option value={UserRole.INFLUENCER}>INFLUENCER</option>
//                 <option value={UserRole.BRAND}>BRAND</option>
//               </select>

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.email}
//                 onChange={(e) =>
//                   setFormData({ ...formData, email: e.target.value })
//                 }
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-5 py-4 bg-slate-50 border rounded-2xl"
//                 value={formData.password}
//                 onChange={(e) =>
//                   setFormData({ ...formData, password: e.target.value })
//                 }
//               />

//               {error && (
//                 <p className="text-red-500 text-sm font-bold">{error}</p>
//               )}

//               <button
//                 disabled={loading}
//                 className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg disabled:opacity-60"
//               >
//                 {loading ? 'Creating Account...' : 'Create Account'}
//               </button>
//             </form>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }





// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// // Agar enum alag file me hai to path adjust kar lena
// enum UserRole {
//   INFLUENCER = 'Influencer',
//   BRAND = 'Brand',
// }

// export default function JoinPage() {
//   const [step, setStep] = useState(1);
//   const [role, setRole] = useState<UserRole | null>(null);
//   const router = useRouter();

//   const handleJoin = (e: React.FormEvent) => {
//     e.preventDefault();
//     router.push('/discovery');
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-4xl w-full">

//         {step === 1 ? (
//           <div className="text-center">
//             <h1 className="text-4xl font-extrabold text-slate-900 mb-4">
//               Join CreatorBridge India
//             </h1>

//             <p className="text-xl text-slate-500 mb-12">
//               Choose your path to get started
//             </p>

//             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//               <button
//                 onClick={() => {
//                   setRole(UserRole.INFLUENCER);
//                   setStep(2);
//                 }}
//                 className="group bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
//                   🎨
//                 </div>
//                 <h3 className="text-2xl font-bold mb-2">
//                   I&apos;m a Creator
//                 </h3>
//                 <p className="text-slate-500">
//                   Collaborate with brands, grow your following and earn.
//                 </p>
//               </button>

//               <button
//                 onClick={() => {
//                   setRole(UserRole.BRAND);
//                   setStep(2);
//                 }}
//                 className="group bg-white p-10 rounded-[40px] border-2 border-slate-100 hover:border-indigo-600 transition-all text-left shadow-xl"
//               >
//                 <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition">
//                   🏢
//                 </div>
//                 <h3 className="text-2xl font-bold mb-2">
//                   I&apos;m a Brand
//                 </h3>
//                 <p className="text-slate-500">
//                   Find the perfect creators for your campaigns.
//                 </p>
//               </button>
//             </div>

//             <p className="mt-12 text-slate-500 font-medium">
//               Already have an account?{' '}
//               <Link
//                 href="/login"
//                 className="text-indigo-600 font-bold hover:underline"
//               >
//                 Log in
//               </Link>
//             </p>
//           </div>
//         ) : (
//           <div className="max-w-md mx-auto bg-white rounded-[40px] p-10 shadow-2xl border">
//             <button
//               onClick={() => setStep(1)}
//               className="text-slate-400 hover:text-indigo-600 font-bold mb-6"
//             >
//               ← Back to roles
//             </button>

//             <h2 className="text-3xl font-extrabold mb-2">
//               Final Details
//             </h2>

//             <p className="text-slate-500 mb-8">
//               Setting up your profile as{' '}
//               <span className="text-indigo-600 font-semibold">
//                 {role}
//               </span>
//             </p>

//             <form onSubmit={handleJoin} className="space-y-6">
//               <input
//                 required
//                 type="text"
//                 placeholder="Full Name"
//                 className="w-full px-5 py-4 border rounded-2xl"
//               />

//               <input
//                 required
//                 type="email"
//                 placeholder="Email"
//                 className="w-full px-5 py-4 border rounded-2xl"
//               />

//               <input
//                 required
//                 type="password"
//                 placeholder="Password"
//                 className="w-full px-5 py-4 border rounded-2xl"
//               />

//               <button
//                 type="submit"
//                 className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700"
//               >
//                 Create Account
//               </button>
//             </form>
//           </div>
//         )}

//       </div>
//     </div>
//   );
// }
