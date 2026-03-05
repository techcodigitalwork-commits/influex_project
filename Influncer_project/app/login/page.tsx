"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";

const API = "http://54.252.201.93:5000/api";
const SOCKET_URL = "http://54.252.201.93:5000";

enum UserRole {
  INFLUENCER = "INFLUENCER",
  MODEL = "MODEL",
  PHOTOGRAPHER = "PHOTOGRAPHER",
  BRAND = "BRAND",
  ADMIN = "ADMIN",
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

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

      // Check if profile exists
      const profileRes = await fetch(`${API}/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const profileData = await profileRes.json();
      const hasProfile = profileData.success && !!profileData.profile;

      // Build user object — remove stale 'coins' field, keep only 'bits'
      const { coins: _removeCoins, ...userWithoutCoins } = data.user;
      const userData = {
        ...userWithoutCoins,
        token,
        hasProfile,
        // bits comes from data.user.bits (set by backend) — coins field removed
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("cb_user", JSON.stringify(userData));
        localStorage.setItem("token", token);
      }

      // Socket connection after login
      const socket = io(SOCKET_URL, { auth: { token } });
      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        socket.emit("joinRoom", data.user._id);
      });
      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      // Navigation
      if (!hasProfile) {
        router.push("/my-profile");
        return;
      }

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

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
            CB
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900">Welcome Back</h2>
          <p className="text-slate-500 mt-2">Log in to manage your brand or profile</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              required
              className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <img
              src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
              alt="toggle password"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg mt-4 disabled:opacity-50"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t text-center">
          <p className="text-slate-500 font-medium">
            Don't have an account?{" "}
            <Link href="/join" className="text-indigo-600 font-bold hover:underline">
              Join Platform
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { io } from "socket.io-client";

// const API = "http://54.252.201.93:5000/api";
// const SOCKET_URL = "http://54.252.201.93:5000";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(`${API}/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.message || "Login failed");
//       if (!data.token || !data.user)
//         throw new Error("Invalid server response");

//       const token = data.token;

//       // ✅ Profile check
//       const profileRes = await fetch(`${API}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const profileData = await profileRes.json();
//       const hasProfile =
//         profileData.success && !!profileData.profile;

//       const userData = {
//         ...data.user,
//         token,
//         hasProfile,
//       };

//       // ✅ Save user data
//       if (typeof window !== "undefined") {
//         localStorage.setItem("cb_user", JSON.stringify(userData));
//         localStorage.setItem("token", token);
//       }

//       // ✅ SOCKET CONNECTION AFTER LOGIN
//       const socket = io(SOCKET_URL, {
//         auth: {
//           token: token, // optional but recommended
//         },
//       });

//       socket.on("connect", () => {
//         console.log("Socket connected:", socket.id);

//         // Join user room
//         socket.emit("joinRoom", data.user._id);
//       });

//       // Optional: Save socket id if needed
//       socket.on("disconnect", () => {
//         console.log("Socket disconnected");
//       });

//       // ✅ Navigation
//       if (!hasProfile) {
//         router.push("/my-profile");
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();
//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>
//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link href="/join" className="text-indigo-600 font-bold hover:underline">
//               Join Platform
//             </Link>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const API = "http://54.252.201.93:5000/api";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(`${API}/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) throw new Error(data.message || "Login failed");
//       if (!data.token || !data.user) throw new Error("Invalid server response");

//       const token = data.token;

//       // ✅ Login ke baad profile check karo — backend hasProfile galat bhejta hai
//       const profileRes = await fetch(`${API}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const profileData = await profileRes.json();
//       const hasProfile = profileData.success && !!profileData.profile;

//       // ✅ cb_user mein sahi hasProfile save karo
//       const userData = {
//         ...data.user,
//         token,
//         hasProfile,
//       };

//       if (typeof window !== "undefined") {
//         localStorage.setItem("cb_user", JSON.stringify(userData));
//         localStorage.setItem("token", token);
//       }

//       // ✅ Navigation — hasProfile false sirf 1st time hoga
//       if (!hasProfile) {
//         router.push("/my-profile");
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">Welcome Back</h2>
//           <p className="text-slate-500 mt-2">Log in to manage your brand or profile</p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link href="/join" className="text-indigo-600 font-bold hover:underline">
//               Join Platform
//             </Link>
//           </p>
//         </div>

//       </div>
//     </div>
//   );
// }



// "use client";

// import { useState, useEffect, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { socket } from "@/lib/socket";

// const API = "http://54.252.201.93:5000/api";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

 

//   socket.connect();

// socket.once("connect", () => {
//   console.log("🟢 Socket Connected:", socket.id);
//   socket.emit("joinRoom", userData._id);
// });

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(`${API}/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) throw new Error(data.message || "Login failed");
//       if (!data.token || !data.user) throw new Error("Invalid server response");

//       const token = data.token;

//       // ✅ Login ke baad profile check karo — backend hasProfile galat bhejta hai
//       const profileRes = await fetch(`${API}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const profileData = await profileRes.json();
//       const hasProfile = profileData.success && !!profileData.profile;

//       // ✅ cb_user mein sahi hasProfile save karo
//       const userData = {
//         ...data.user,
//         token,
//         hasProfile,
//       };

//       if (typeof window !== "undefined") {
//         localStorage.setItem("cb_user", JSON.stringify(userData));
//         localStorage.setItem("token", token);
//       }

//       // ✅ Login ke baad socket connect karo user ke saath
//       socket.connect();

//       // ✅ Navigation — hasProfile false sirf 1st time hoga
//       if (!hasProfile) {
//         router.push("/my-profile");
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">Welcome Back</h2>
//           <p className="text-slate-500 mt-2">Log in to manage your brand or profile</p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link href="/join" className="text-indigo-600 font-bold hover:underline">
//               Join Platform
//             </Link>
//           </p>
//         </div>

//       </div>
//     </div>
//   );
// }




// "use client";

// import { useState, type FormEvent } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { socket } from "@/lib/socket";

// const API = "http://54.252.201.93:5000/api";

// enum UserRole {
//   INFLUENCER = "INFLUENCER",
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(`${API}/auth/login`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await res.json();

//       if (!res.ok) throw new Error(data.message || "Login failed");
//       if (!data.token || !data.user) throw new Error("Invalid server response");

//       const token = data.token;

//       // ✅ Login ke baad profile check karo — backend hasProfile galat bhejta hai
//       const profileRes = await fetch(`${API}/profile/me`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const profileData = await profileRes.json();
//       const hasProfile = profileData.success && !!profileData.profile;

//       // ✅ cb_user mein sahi hasProfile save karo
//       const userData = {
//         ...data.user,
//         token,
//         hasProfile,
//       };

//       if (typeof window !== "undefined") {
//         localStorage.setItem("cb_user", JSON.stringify(userData));
//         localStorage.setItem("token", token);
//       }

//       // ✅ Navigation — hasProfile false sirf 1st time hoga
//       if (!hasProfile) {
//         router.push("/my-profile");
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">Welcome Back</h2>
//           <p className="text-slate-500 mt-2">Log in to manage your brand or profile</p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link href="/join" className="text-indigo-600 font-bold hover:underline">
//               Join Platform
//             </Link>
//           </p>
//         </div>

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
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/login",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({ email, password }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Login failed");
//       }

//       if (!data.token || !data.user) {
//         throw new Error("Invalid server response");
//       }

//       // ✅ Proper structured user object
//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       // ✅ Safe localStorage (browser check)
//       if (typeof window !== "undefined") {
//         localStorage.setItem("cb_user", JSON.stringify(userData));
//         localStorage.setItem("token", data.token);
//       }

//       // ✅ Navigation logic (unchanged)
//       if (!userData.hasProfile) {
//         router.push("/my-profile");
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           {/* Email */}
//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           {/* Password */}
//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>

//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />

//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link
//               href="/join"
//               className="text-indigo-600 font-bold hover:underline"
//             >
//               Join Platform
//             </Link>
//           </p>
//         </div>

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
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);   // ✅ ADD
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/login",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({ email, password }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Login failed");
//       }

//       if (!data.token || !data.user) {
//         throw new Error("Invalid server response");
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
//         return;
//       }

//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           {/* Email */}
//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           {/* Password */}
//           <div className="relative">
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>

//             <input
//               type={showPassword ? "text" : "password"}
//               required
//               className="w-full px-5 py-4 pr-12 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />

//             {/* 👁️ Eye Icon */}
//             <img
//               src="https://www.pngitem.com/pimgs/m/495-4950508_show-password-show-password-icon-png-transparent-png.png"
//               alt="show password"
//               onClick={() => setShowPassword(!showPassword)}
//               className="absolute right-4 top-[58%] w-6 h-6 cursor-pointer opacity-70"
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link
//               href="/join"
//               className="text-indigo-600 font-bold hover:underline"
//             >
//               Join Platform
//             </Link>
//           </p>
//         </div>

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
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     if (!email || !password) {
//       setError("Please enter email and password");
//       return;
//     }

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/login",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({ email, password }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Login failed");
//       }

//       if (!data.token || !data.user) {
//         throw new Error("Invalid server response");
//       }

//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };



//       // ✅ Save user + token
//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // ✅ Redirect logic
//       if (!userData.hasProfile) {
//         router.push("/my-profile");
//         return;
//       }
// //       if (!data.profile) {
// //   router.push("/my-profile");
// // }


//       if (
//         userData.role === UserRole.BRAND ||
//         userData.role === UserRole.ADMIN
//       ) {
//         router.push("/campaigns");
//       } else {
//         router.push("/discovery");
//       }

//       // Force refresh so homepage detects login
//       router.refresh();

//     } catch (err: any) {
//       setError(err.message || "Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">

//         {/* Header */}
//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         {/* Form */}
//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//              <img
//     src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALAAAACUCAMAAAAEVFNMAAAAaVBMVEX///8AAAD8/PzS0tKmpqYWFhY0NDTMzMzd3d2/v7+wsLCpqakbGxsYGBgiIiIrKyuampp8fHzm5ub29vaUlJSNjY0RERG2traCgoLGxsbv7+92dnYKCgpJSUk8PDxtbW1bW1tjY2NSUlJ3AQ7uAAAEeElEQVR4nO2a65KiMBCFTUDuRi4iF1GZef+HXCUdxAAZZ2tJYKu/XzNAlYfm5CRp2O0QBEEQBEEQBEEQBEEQBEEQBEGQ/xhqWsDv8C8X37SG3xAQQth2FNOQPEk244ow6gSXpnV8Snjo9J4r00I+JCCcjViY2lwuC0wr+RCbrU8vzerUS+s6mzgXgh8K7aomqVP/1B5Jz+1uW+lQN/jhvAr/1lXckjHHxLYgcKm9X48fvFO7n5Db4dyDrsw25NkK9Hr385xaThRnvX/N+8G6yPrOh718B0e4iBkfb3UcDXW1eRwU/oPCjpNrI9+Kef9a14Ha0krrwZImSz3//qa3MV1fenoNrSSdvqZqj32hE73yRqR9/Vq7nr/MvfW3VSouWx5P2IGp5O52MXuZ4nvmOeggFaPtohbxss2TyNMkb4QLdXNGwfpYTKT9UoLmMCILeB4HQwthYcwvqWKZHyft7dqWcfUMDHriiey4uzSBOzSi2IJFzkValBVfhz5zvx7KoL5n93kvMRTbMqAXZEkbs/T7za8kAb0EHgNsN/baFbsOr1v+ftgi0ziuuKJg0gFNesG/+ftO3WXTeo8DeUVjwMciz8p3vamYH6IkjpPBavPNAAW4QmO6WftJ/1KY9r5AH9iGMElawWNjr80V4IdG8sPOlWwSHGfsGvAHdNOk2ILClfImk2+Q+gYU9HeisSwKWeFoyQpP+Fc+kXZPuhWztOiXTFoVTuqYpd3jjF7YEYf8H+j3zU4RwX4UH8tgiTwbNx3K7ilDzcAPs+FFQz7ybgu7ggr/TnRKu4y48hNQQDJfwN7Hy/ZcPf4r7dS5TvB39yeIaZQWvSs8/s+oFYOlF0yDw0yeDfFhUC68AznNBxK3xOP3A/bBgILZg5yWUgqI1bgzrnF3hlVi6iXK4STqK08+CyD2OyPFXENZqPOMUxE99e0QOx5ZMe0SGjb0av8Kvbnqon8GLfmvXWXFcLyTrdQrVqFT4bgEdKbG9UuwMqvEKl+DfwWgeC/t7sVwUy9qhF4t/hVMu0JsMZV+sGYXI0uSCcXDGsef5JmnmNwXBVwx2E1A3kXKLpARP3DK97ylcfNJnjU68+wd4Yoj7/hCf4cp/RAy7fkwQORxN3yEf1V5JjaphvTueh+Tq/VBC4pWjjn/Cvo+6vnH/LWSxrzex0py+K5I0TBLc1HeJtQobwJv8Eomzqa9mVlf/TVL7+F+hpavN1vs5HvS5jRLK/t1T83d6BsOTkiGXO956D9f5dd16lXh6TJsvzrFCr7yKYhMEx1vHQ57f62YTH2PoBuoL7uNdEvMvsXTC7T1otCLv1Vyr7nxwdYBeon98GbqlnNyL9Uqqvvyr4jWzMqvLBoYtzmwW27NpJ1+Ai7tYA8PZl4R58nlSR4H1gpirAf6JXt7LQX8AdG6sX++dBXI/l074Ae2lfqCXrIV/4pWnvHvdz7Ehzzbin9hwxxtRi/lnz2EG/HvA59tyL8d/v1i+vuzX7IdNyAIgiAIgiAIgiAIgiAIgiAIgiB/wR+6ZzCx4bG74gAAAABJRU5ErkJggg=="
//     alt="show password"
//     className="absolute right-4 top-[50%] translate-y-[-10%] w-6 h-6 cursor-pointer opacity-70"
//   />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         {/* Footer */}
//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link
//               href="/join"
//               className="text-indigo-600 font-bold hover:underline"
//             >
//               Join Platform
//             </Link>
//           </p>
//         </div>

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
//   MODEL = "MODEL",
//   PHOTOGRAPHER = "PHOTOGRAPHER",
//   BRAND = "BRAND",
//   ADMIN = "ADMIN",
// }

// export default function LoginPage() {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setLoading(true);

//       const res = await fetch(
//         "http://54.252.201.93:5000/api/auth/login",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             email,
//             password,
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || "Login failed");
//       }

//       // Expected response:
//       // { success, user, token }

//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       // Save to localStorage
//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // Redirect Logic
//       if (!userData.hasProfile) {
//         router.push("/setup-profile");
//       } else {
//         if (
//           userData.role === UserRole.BRAND ||
//           userData.role === UserRole.ADMIN
//         ) {
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
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">
        
//         {/* Header */}
//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         {/* Form */}
//         <form onSubmit={handleLogin} className="space-y-6">
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 disabled:opacity-50"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         {/* Footer */}
//         <div className="mt-8 pt-8 border-t border-slate-50 text-center">
//           <p className="text-slate-500 font-medium">
//             Don't have an account?{" "}
//             <Link
//               href="/join"
//               className="text-indigo-600 font-bold hover:underline"
//             >
//               Join Platform
//             </Link>
//           </p>
//         </div>
//       </div>
//     </div>
//   );
// }





// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const LoginPage: React.FC = () => {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");

//     try {
//       setLoading(true);

//       const res = await fetch("http://13.210.109.234:5000/api/auth/login", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           email,
//           password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.message || "Login failed");
//         setLoading(false);
//         return;
//       }

//       // Prepare user data
//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       // Save to localStorage
//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // 🔥 Redirect Logic
//       if (!userData.hasProfile) {
//         router.replace("/setup-profile");
//       } else {
//         if (userData.role === "Brand") {
//           router.replace("/campaigns");
//         } else {
//           router.replace("/discovery");
//         }
//       }
//     } catch (error) {
//       console.error("Login error:", error);
//       setError("Server error. Try again later.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">
//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">
//             Log in to manage your brand or profile
//           </p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
          
//           {/* Error Box */}
//           {error && (
//             <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold">
//               {error}
//             </div>
//           )}

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <p className="text-center mt-10 text-slate-500 font-medium">
//           Don't have an account?{" "}
//           <Link
//             href="/join"
//             className="text-indigo-600 font-bold hover:underline"
//           >
//             Join Platform
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


// "use client";

// import React, { useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// const LoginPage: React.FC = () => {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();

//     try {
//       setLoading(true);

//       const res = await fetch("http://13.210.109.234:5000/api/auth/login", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           email,
//           password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         alert(data.message || "Login failed");
//         setLoading(false);
//         return;
//       }

//       // 👇 backend response structure adjust if needed
//       const userData = {
//         ...data.user,
//         token: data.token,
//         hasProfile: data.user?.hasProfile ?? false,
//       };

//       localStorage.setItem("cb_user", JSON.stringify(userData));
//       localStorage.setItem("token", data.token);

//       // 🔥 Redirect logic
//       if (!userData.hasProfile) {
//         router.replace("/setup-profile");
//       } else {
//         router.replace("/discovery");
//       }
//     } catch (error) {
//       console.error("Login error:", error);
//       alert("Something went wrong");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
//       <div className="max-w-md w-full bg-white rounded-[40px] p-10 shadow-2xl shadow-indigo-100 border border-slate-100">
//         <div className="text-center mb-10">
//           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4 shadow-lg shadow-indigo-200">
//             CB
//           </div>
//           <h2 className="text-3xl font-extrabold text-slate-900">
//             Welcome Back
//           </h2>
//           <p className="text-slate-500 mt-2">Log in to your account</p>
//         </div>

//         <form onSubmit={handleLogin} className="space-y-6">
//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Email Address
//             </label>
//             <input
//               type="email"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="name@example.com"
//               value={email}
//               onChange={(e) => setEmail(e.target.value)}
//             />
//           </div>

//           <div>
//             <label className="block text-sm font-bold text-slate-700 mb-2">
//               Password
//             </label>
//             <input
//               type="password"
//               required
//               className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
//               placeholder="••••••••"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />
//           </div>

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 mt-4"
//           >
//             {loading ? "Signing In..." : "Sign In"}
//           </button>
//         </form>

//         <p className="text-center mt-10 text-slate-500 font-medium">
//           Don't have an account?{" "}
//           <Link
//             href="/join"
//             className="text-indigo-600 font-bold hover:underline"
//           >
//             Join Platform
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default LoginPage;


// "use client";

// import { useState } from "react";
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// export default function Page() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const router = useRouter();

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError("");
//     setLoading(true);

//     try {
//       const res = await fetch(
//         "http://13.210.109.234:5000/api/auth/login",
//         {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify({
//             email: email.toLowerCase(),
//             password,
//           }),
//         }
//       );

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.message || "Invalid email or password");
//         return;
//       }

//       const userData = {
//         ...data.user,
//         hasProfile: data.user.hasProfile ?? false,
//       };

//       // ✅ Save token & user
//       localStorage.setItem("token", data.token);
//       localStorage.setItem("user", JSON.stringify(userData));

//       // ✅ Proper redirect
//        router.replace("/setup-profile");
//     //   if (!userData.hasProfile) {
//     //      router.replace("/setup-profile");
//     //   } else {
//     // router.replace("/discovery");
//     //   }
//     } catch (err) {
//       setError("Server error. Try again later.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center">
//       <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
//         <h1 className="text-2xl font-bold mb-6 text-center">Login</h1>

//         {error && (
//           <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
//         )}

//         <form onSubmit={handleLogin} className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email"
//             className="w-full border p-3 rounded-lg"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="w-full border p-3 rounded-lg"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
//           >
//             {loading ? "Logging in..." : "Login"}
//           </button>
//         </form>

//         <p className="text-center text-sm mt-4">
//           New here?{" "}
//           <Link href="/join" className="text-indigo-600 font-semibold">
//             Join
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }


// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// export default function Page() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const router = useRouter();

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setError('');
//     setLoading(true);

//     try {
//       const res = await fetch("http://13.210.109.234:5000/api/auth/login", {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           email: email.toLowerCase(),
//           password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.message || 'Invalid email or password');
//         setLoading(false);
//         return;
//       }
      

//       // ✅ Prepare user object like old mock version
//       const userData = {
//         ...data.user,
//         hasProfile: data.user.hasProfile ?? false, // default false if backend not sending
//       };

//       // ✅ Save token & user
//       localStorage.setItem('token', data.token);
//       // localStorage.setItem('user', JSON.stringify(data.user));
//        localStorage.setItem('user', JSON.stringify(userData));

//       // ✅ Redirect
//       router.push('/setup-profile');
//       //    if (!userData.hasProfile) {
//       //   router.push('/setup-profile');
//       // } else {
//       //   router.push('/discovery');
//       // }

//     } catch (err) {
//       setError('Server error. Try again later.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center">
//       <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
//         <h1 className="text-2xl font-bold mb-6 text-center">
//           Login
//         </h1>

//         {error && (
//           <p className="text-red-500 text-sm mb-3 text-center">
//             {error}
//           </p>
//         )}

//         <form onSubmit={handleLogin} className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email"
//             className="w-full border p-3 rounded-lg"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="w-full border p-3 rounded-lg"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
//           >
//             {loading ? 'Logging in...' : 'Login'}
//           </button>
//         </form>

//         <p className="text-center text-sm mt-4">
//           New here?{' '}
//           <Link href="/join" className="text-indigo-600 font-semibold">
//             Join
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }

// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// export default function Page() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const router = useRouter();

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     try {
//       const res = await fetch('http://13.210.109.234:5000/auth/login', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//           email,
//           password,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         throw new Error(data.message || 'Login failed');
//       }

//       // 👉 token save (agar backend bhej raha ho)
//       if (data.token) {
//         localStorage.setItem('token', data.token);
//       }

//       // 👉 user data save (optional)
//       if (data.user) {
//         localStorage.setItem('user', JSON.stringify(data.user));
//       }

//       // ✅ success ke baad redirect
//       router.push('/discovery');
//     } catch (err: any) {
//       setError(err.message || 'Something went wrong');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center">
//       <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
//         <h1 className="text-2xl font-bold mb-6 text-center">
//           Login
//         </h1>

//         <form onSubmit={handleLogin} className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email"
//             className="w-full border p-3 rounded-lg"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="w-full border p-3 rounded-lg"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           {error && (
//             <p className="text-red-500 text-sm">{error}</p>
//           )}

//           <button
//             type="submit"
//             disabled={loading}
//             className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
//           >
//             {loading ? 'Logging in...' : 'Login'}
//           </button>
//         </form>

//         <p className="text-center text-sm mt-4">
//           New here?{' '}
//           <Link href="/join" className="text-indigo-600 font-semibold">
//             Join
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }


// 'use client';

// import { useState } from 'react';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';

// export default function Page() {
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const router = useRouter();

//   const handleLogin = (e: React.FormEvent) => {
//     e.preventDefault();
//     router.push('/discovery');
//   };

//   return (
//     <div className="min-h-screen flex items-center justify-center">
//       <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
//         <h1 className="text-2xl font-bold mb-6 text-center">
//           Login
//         </h1>

//         <form onSubmit={handleLogin} className="space-y-4">
//           <input
//             type="email"
//             placeholder="Email"
//             className="w-full border p-3 rounded-lg"
//             value={email}
//             onChange={(e) => setEmail(e.target.value)}
//             required
//           />

//           <input
//             type="password"
//             placeholder="Password"
//             className="w-full border p-3 rounded-lg"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             required
//           />

//           <button
//             type="submit"
//             className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold"
//           >
//             Login
//           </button>
//         </form>

//         <p className="text-center text-sm mt-4">
//           New here?{' '}
//           <Link href="/join" className="text-indigo-600 font-semibold">
//             Join
//           </Link>
//         </p>
//       </div>
//     </div>
//   );
// }
