"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";

const API_BASE = "https://api.collabzy.in/api";

export default function CampaignView() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!id) return;                // ← ADD
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const storedUser = localStorage.getItem("cb_user");
    if (!storedUser) { router.push("/login"); return; }
    const { token } = JSON.parse(storedUser);
    fetchCampaign(token);
  }, [id]);

  const fetchCampaign = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCampaign(data?.data || data?.campaign || data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-bold">
        Loading Campaign...
      </div>
    );

  if (!campaign)
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-bold">
        Campaign not found
      </div>
    );

  const totalApps = campaign?.applicationsCount ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-slate-900">
            {campaign.title || "Untitled Campaign"}
          </h1>
          <span className="px-4 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
            {campaign.status || "pending"}
          </span>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Description</h2>
          <p className="text-slate-500">{campaign.description || "No description available."}</p>
        </div>

        <div className="space-y-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Budget</span>
            <span className="font-bold text-indigo-600">₹{campaign.budget || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">City</span>
            <span className="font-bold text-slate-800">{campaign.city || "N/A"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Applications</span>
            <span className="font-bold text-indigo-600 text-base">{totalApps}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Created At</span>
            <span className="font-bold text-slate-800">
              {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
            </span>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href={`/campaigns/${campaign._id}/applications`}
            className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition text-sm sm:text-base"
          >
            View Applications ({totalApps})
          </Link>
          <Link
            href="/campaigns"
            className="flex-1 text-center py-3 rounded-xl bg-gray-200 text-slate-800 font-semibold hover:bg-gray-300 transition text-sm sm:text-base"
          >
            Back
          </Link>
        </div>

      </div>
    </div>
  );
}

// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";

// const API_BASE = "https://api.collabzy.in/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const fetchedRef = useRef(false);

//   useEffect(() => {
//     if (!id) return;
//     if (fetchedRef.current) return;
//     fetchedRef.current = true;

//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const { token } = JSON.parse(storedUser);
//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setCampaign(data?.data || data?.campaign || data);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading)
//     return (
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
//         Loading Campaign...
//       </div>
//     );

//   if (!campaign)
//     return (
//       <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, fontFamily: "Plus Jakarta Sans, sans-serif" }}>
//         Campaign not found
//       </div>
//     );

//   const totalApps = campaign?.applicationsCount ?? 0;

//   return (
//     <>
//       <style>{`
//         @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
//         * { box-sizing: border-box; margin: 0; padding: 0; }
//         .cv-page { min-height: 100vh; background: #f8fafc; padding: 32px 16px; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .cv-card { max-width: 760px; margin: 0 auto; background: #fff; border-radius: 24px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px; }
//         .cv-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; gap: 16px; flex-wrap: wrap; }
//         .cv-title { font-size: 28px; font-weight: 800; color: #0f172a; }
//         .cv-badge { padding: 4px 16px; border-radius: 100px; background: #eef2ff; color: #4f46e5; font-weight: 600; font-size: 13px; }
//         .cv-desc-label { font-size: 16px; font-weight: 700; color: #334155; margin-bottom: 8px; }
//         .cv-desc-text { font-size: 14px; color: #64748b; line-height: 1.7; margin-bottom: 32px; }
//         .cv-meta { display: flex; flex-direction: column; gap: 16px; margin-bottom: 40px; }
//         .cv-meta-row { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #f1f5f9; }
//         .cv-meta-row:last-child { border-bottom: none; padding-bottom: 0; }
//         .cv-meta-label { font-size: 13px; font-weight: 600; color: #94a3b8; }
//         .cv-meta-val { font-size: 14px; font-weight: 700; color: #0f172a; }
//         .cv-meta-val.indigo { color: #4f46e5; }
//         .cv-actions { display: flex; gap: 12px; flex-wrap: wrap; }
//         .cv-btn-primary { flex: 1; min-width: 160px; text-align: center; padding: 13px 20px; border-radius: 14px; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; font-weight: 700; font-size: 14px; text-decoration: none; transition: opacity 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .cv-btn-primary:hover { opacity: 0.9; }
//         .cv-btn-secondary { flex: 1; min-width: 120px; text-align: center; padding: 13px 20px; border-radius: 14px; background: #f1f5f9; color: #334155; font-weight: 600; font-size: 14px; text-decoration: none; transition: background 0.2s; font-family: 'Plus Jakarta Sans', sans-serif; }
//         .cv-btn-secondary:hover { background: #e2e8f0; }
//         @media(max-width: 600px) {
//           .cv-card { padding: 24px 16px; }
//           .cv-title { font-size: 22px; }
//           .cv-actions { flex-direction: column; }
//         }
//       `}</style>

//       <div className="cv-page">
//         <div className="cv-card">

//           <div className="cv-top">
//             <h1 className="cv-title">{campaign.title || "Untitled Campaign"}</h1>
//             <span className="cv-badge">{campaign.status || "pending"}</span>
//           </div>

//           <div className="cv-desc-label">Description</div>
//           <div className="cv-desc-text">{campaign.description || "No description available."}</div>

//           <div className="cv-meta">
//             <div className="cv-meta-row">
//               <span className="cv-meta-label">Budget</span>
//               <span className="cv-meta-val indigo">₹{campaign.budget || 0}</span>
//             </div>
//             <div className="cv-meta-row">
//               <span className="cv-meta-label">City</span>
//               <span className="cv-meta-val">{campaign.city || "N/A"}</span>
//             </div>
//             <div className="cv-meta-row">
//               <span className="cv-meta-label">Applications</span>
//               <span className="cv-meta-val indigo">{totalApps}</span>
//             </div>
//             <div className="cv-meta-row">
//               <span className="cv-meta-label">Created At</span>
//               <span className="cv-meta-val">
//                 {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
//               </span>
//             </div>
//           </div>

//           <div className="cv-actions">
//             <Link href={`/campaigns/${campaign._id}/applications`} prefetch={false} className="cv-btn-primary">
//               View Applications ({totalApps})
//             </Link>
//             <Link href="/campaigns" prefetch={false} className="cv-btn-secondary">
//               Back
//             </Link>
//           </div>

//         </div>
//       </div>
//     </>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState, useRef } from "react";
// import Link from "next/link";

// const API_BASE = "https://api.collabzy.in/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const fetchedRef = useRef(false); // ← ADD

//   useEffect(() => {
//     if (fetchedRef.current) return; // ← ADD
//     fetchedRef.current = true;      // ← ADD

//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const { token } = JSON.parse(storedUser);
//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setCampaign(data?.data || data?.campaign || data);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );

//   if (!campaign)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Campaign not found
//       </div>
//     );

//   const totalApps = campaign?.applicationsCount ?? 0;

//   return (
//     <div className="min-h-screen bg-slate-50 p-8">
//       <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">

//         <div className="flex justify-between items-center mb-8">
//           <h1 className="text-3xl font-black text-slate-900">
//             {campaign.title || "Untitled Campaign"}
//           </h1>
//           <span className="px-4 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
//             {campaign.status || "pending"}
//           </span>
//         </div>

//         <div className="mb-8">
//           <h2 className="text-lg font-semibold text-slate-700 mb-2">Description</h2>
//           <p className="text-slate-500">{campaign.description || "No description available."}</p>
//         </div>

//         <div className="space-y-4 text-sm">
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Budget</span>
//             <span className="font-bold text-indigo-600">₹{campaign.budget || 0}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">City</span>
//             <span className="font-bold text-slate-800">{campaign.city || "N/A"}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Applications</span>
//             <span className="font-bold text-indigo-600 text-base">{totalApps}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Created At</span>
//             <span className="font-bold text-slate-800">
//               {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
//             </span>
//           </div>
//         </div>

//         <div className="mt-10 flex flex-col sm:flex-row gap-4">
//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition text-sm sm:text-base"
//           >
//             View Applications ({totalApps})
//           </Link>
//           <Link
//             href="/campaigns"
//             className="flex-1 text-center py-3 rounded-xl bg-gray-200 text-slate-800 font-semibold hover:bg-gray-300 transition text-sm sm:text-base"
//           >
//             Back
//           </Link>
//         </div>

//       </div>
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "https://api.collabzy.in/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const { token } = JSON.parse(storedUser);
//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setCampaign(data?.data || data?.campaign || data);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );

//   if (!campaign)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Campaign not found
//       </div>
//     );

//   // Directly use applicationsCount from campaign object (no extra API call needed)
//   const totalApps = campaign?.applicationsCount ?? 0;

//   return (
//     <div className="min-h-screen bg-slate-50 p-8">
//       <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">

//         {/* TITLE */}
//         <div className="flex justify-between items-center mb-8">
//           <h1 className="text-3xl font-black text-slate-900">
//             {campaign.title || "Untitled Campaign"}
//           </h1>
//           <span className="px-4 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
//             {campaign.status || "pending"}
//           </span>
//         </div>

//         {/* DESCRIPTION */}
//         <div className="mb-8">
//           <h2 className="text-lg font-semibold text-slate-700 mb-2">Description</h2>
//           <p className="text-slate-500">{campaign.description || "No description available."}</p>
//         </div>

//         {/* DETAILS */}
//         <div className="space-y-4 text-sm">
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Budget</span>
//             <span className="font-bold text-indigo-600">₹{campaign.budget || 0}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">City</span>
//             <span className="font-bold text-slate-800">{campaign.city || "N/A"}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Applications</span>
//             <span className="font-bold text-indigo-600 text-base">
//               {totalApps}
//             </span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Created At</span>
//             <span className="font-bold text-slate-800">
//               {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
//             </span>
//           </div>
//         </div>

//         {/* BUTTONS */}
//         <div className="mt-10 flex flex-col sm:flex-row gap-4">
//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition text-sm sm:text-base"
//           >
//             View Applications ({totalApps})
//           </Link>
//           <Link
//             href="/campaigns"
//             className="flex-1 text-center py-3 rounded-xl bg-gray-200 text-slate-800 font-semibold hover:bg-gray-300 transition text-sm sm:text-base"
//           >
//             Back
//           </Link>
//         </div>

//       </div>
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "https://api.collabzy.in/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [appCount, setAppCount] = useState<number | null>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");
//     if (!storedUser) { router.push("/login"); return; }
//     const { token } = JSON.parse(storedUser);
//     fetchCampaign(token);
//     // fetchAppCount(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       setCampaign(data?.data || data?.campaign || data);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // const fetchAppCount = async (token: string) => {
//   //   try {
//   //     const res = await fetch(`${API_BASE}/campaigns/${id}/applications`, {
//   //       headers: { Authorization: `Bearer ${token}` },
//   //     });
//   //     const data = await res.json();
//   //     const apps = data?.applications || data?.data || [];
//   //     setAppCount(Array.isArray(apps) ? apps.length : 0);
//   //   } catch {
//   //     setAppCount(0);
//   //   }
//   // };

//   if (loading)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );

//   if (!campaign)
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Campaign not found
//       </div>
//     );

//   // Use fetched count, fallback to campaign field
//   const totalApps = appCount !== null ? appCount : (campaign.applicationsCount || 0);

//   return (
//     <div className="min-h-screen bg-slate-50 p-8">
//       <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">

//         {/* TITLE */}
//         <div className="flex justify-between items-center mb-8">
//           <h1 className="text-3xl font-black text-slate-900">
//             {campaign.title || "Untitled Campaign"}
//           </h1>
//           <span className="px-4 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
//             {campaign.status || "pending"}
//           </span>
//         </div>

//         {/* DESCRIPTION */}
//         <div className="mb-8">
//           <h2 className="text-lg font-semibold text-slate-700 mb-2">Description</h2>
//           <p className="text-slate-500">{campaign.description || "No description available."}</p>
//         </div>

//         {/* DETAILS */}
//         <div className="space-y-4 text-sm">
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Budget</span>
//             <span className="font-bold text-indigo-600">₹{campaign.budget || 0}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">City</span>
//             <span className="font-bold text-slate-800">{campaign.city || "N/A"}</span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Applications</span>
//             <span className="font-bold text-indigo-600 text-base">
//               {appCount === null ? "..." : totalApps}
//             </span>
//           </div>
//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Created At</span>
//             <span className="font-bold text-slate-800">
//               {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
//             </span>
//           </div>
//         </div>

//         {/* BUTTONS */}
//         {/* <div className="mt-10 flex gap-4">
//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition"
//           >
//             View Applications ({totalApps})
//           </Link>
//           <Link
//             href="/campaigns"
//             className="flex-1 text-center py-3 rounded-xl bg-gray-200 font-semibold hover:bg-gray-300 transition"
//           >
//             Back
//           </Link>


          
//         </div> */}   

//         {/* BUTTONS */}
//       <div className="mt-10 flex flex-col sm:flex-row gap-4">
//       <Link
//     href={`/campaigns/${campaign._id}/applications`}
//     className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition text-sm sm:text-base"
//   >
//     View Applications ({totalApps})
//   </Link>
//   <Link
//     href="/campaigns"
//     className="flex-1 text-center py-3 rounded-xl bg-gray-200 text-slate-800 font-semibold hover:bg-gray-300 transition text-sm sm:text-base"
//   >
//     Back
//   </Link>
// </div>

//       </div>
//     </div>
//   );
// }


