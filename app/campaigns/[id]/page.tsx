"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = "http://54.252.201.93:5000/api";

export default function CampaignView() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign] = useState<any>(null);
  const [appCount, setAppCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("cb_user");
    if (!storedUser) { router.push("/login"); return; }
    const { token } = JSON.parse(storedUser);
    fetchCampaign(token);
    fetchAppCount(token);
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

  const fetchAppCount = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const apps = data?.applications || data?.data || [];
      setAppCount(Array.isArray(apps) ? apps.length : 0);
    } catch {
      setAppCount(0);
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

  // Use fetched count, fallback to campaign field
  const totalApps = appCount !== null ? appCount : (campaign.applicationsCount || 0);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-lg p-10">

        {/* TITLE */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-slate-900">
            {campaign.title || "Untitled Campaign"}
          </h1>
          <span className="px-4 py-1 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-sm">
            {campaign.status || "pending"}
          </span>
        </div>

        {/* DESCRIPTION */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Description</h2>
          <p className="text-slate-500">{campaign.description || "No description available."}</p>
        </div>

        {/* DETAILS */}
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
            <span className="font-bold text-indigo-600 text-base">
              {appCount === null ? "..." : totalApps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Created At</span>
            <span className="font-bold text-slate-800">
              {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
            </span>
          </div>
        </div>

        {/* BUTTONS */}3
        <div className="mt-10 flex gap-4">
          <Link
            href={`/campaigns/${campaign._id}/applications`}
            className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition"
          >
            View Applications ({totalApps})
          </Link>
          <Link
            href="/campaigns"
            className="flex-1 text-center py-3 rounded-xl bg-gray-200 font-semibold hover:bg-gray-300 transition"
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
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "http://54.252.201.93:5000/api";

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
//     fetchAppCount(token);
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

//   const fetchAppCount = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       const apps = data?.applications || data?.data || [];
//       setAppCount(Array.isArray(apps) ? apps.length : 0);
//     } catch {
//       setAppCount(0);
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
//         <div className="mt-10 flex gap-4">
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
//         </div>

//       </div>
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

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
//           <h2 className="text-lg font-semibold text-slate-700 mb-2">
//             Description
//           </h2>
//           <p className="text-slate-500">
//             {campaign.description || "No description available."}
//           </p>
//         </div>

//         {/* DETAILS */}
//         <div className="space-y-4 text-sm">

//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Budget</span>
//             <span className="font-bold text-indigo-600">
//               ₹{campaign.budget || 0}
//             </span>
//           </div>

//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">City</span>
//             <span className="font-bold text-slate-800">
//               {campaign.city || "N/A"}
//             </span>
//           </div>

//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Applications</span>
//             <span className="font-bold text-slate-800">
//               {campaign.applicationsCount || 0}
//             </span>
//           </div>

//           <div className="flex justify-between">
//             <span className="text-slate-400 font-semibold">Created At</span>
//             <span className="font-bold text-slate-800">
//               {campaign.createdAt
//                 ? new Date(campaign.createdAt).toLocaleDateString()
//                 : "N/A"}
//             </span>
//           </div>

//         </div>

//         {/* BUTTONS */}
//         <div className="mt-10 flex gap-4">
//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="flex-1 text-center py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold hover:opacity-90 transition"
//           >
//             View Applications
//           </Link>

//           <Link
//             href="/campaigns"
//             className="flex-1 text-center py-3 rounded-xl bg-gray-200 font-semibold hover:bg-gray-300 transition"
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

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   /* ================= FETCH CAMPAIGN ================= */
//   useEffect(() => {
//     const storedUser = localStorage.getItem("cb_user");

//     if (!storedUser) {
//       router.push("/login");
//       return;
//     }

//     const { token } = JSON.parse(storedUser);

//     if (!token) {
//       router.push("/login");
//       return;
//     }

//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       setLoading(true);

//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       console.log("Campaign API Response 👉", data);

//       // backend kabhi {campaign:{}} bhejta hai kabhi direct object
//       setCampaign(data?.campaign || data);

//     } catch (err) {
//       console.error("Fetch campaign error 👉", err);
//       setCampaign(null);
//     } finally {
//       setLoading(false);
//     }
//   };

//   /* ================= LOADING ================= */
//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );
//   }

//   /* ================= NOT FOUND ================= */
//   if (!campaign) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Campaign not found
//       </div>
//     );
//   }

//   /* ================= UI ================= */
//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">

//         {/* Title */}
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-3xl font-bold">
//             {campaign.title || "Untitled Campaign"}
//           </h1>

//           <span className="px-4 py-1 text-sm rounded-full font-semibold bg-indigo-100 text-indigo-600">
//             {campaign.status || "pending"}
//           </span>
//         </div>

//         {/* Description */}
//         <div className="mb-6">
//           <h2 className="font-semibold text-lg mb-2">Description</h2>
//           <p className="text-gray-600">
//             {campaign.description || "No description available."}
//           </p>
//         </div>

//         {/* Details */}
//         <div className="grid md:grid-cols-2 gap-6 mb-8">

//           <div>
//             <p className="text-sm text-gray-400">Budget</p>
//             <p className="text-lg font-semibold text-indigo-600">
//               ₹{campaign.budget || 0}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">City</p>
//             <p className="text-lg font-semibold">
//               {campaign.city || "N/A"}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Applications</p>
//             <p className="text-lg font-semibold">
//               {campaign.applicationsCount || 0}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Created At</p>
//             <p className="text-lg font-semibold">
//               {campaign.createdAt
//                 ? new Date(campaign.createdAt).toLocaleDateString()
//                 : "N/A"}
//             </p>
//           </div>

//         </div>

//         {/* Buttons */}
//         <div className="flex gap-4">
//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
//           >
//             View Applications
//           </Link>

//           <Link
//             href="/campaigns"
//             className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
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

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const token = localStorage.getItem("token");

//     if (!token) {
//       router.push("/login");
//       return;
//     }

//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (data?.campaign) {
//         setCampaign(data.campaign);
//       } else {
//         setCampaign(data);
//       }

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );
//   }

//   if (!campaign) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         Campaign not found
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">

//       <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">

//         {/* Title */}
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-3xl font-bold">{campaign.title}</h1>

//           <span
//             className={`px-4 py-1 text-sm rounded-full font-semibold
//               ${campaign.status === "open" && "bg-blue-100 text-blue-600"}
//               ${campaign.status === "ongoing" && "bg-yellow-100 text-yellow-600"}
//               ${campaign.status === "completed" && "bg-green-100 text-green-600"}
//             `}
//           >
//             {campaign.status}
//           </span>
//         </div>

//         {/* Description */}
//         <div className="mb-6">
//           <h2 className="font-semibold text-lg mb-2">Description</h2>
//           <p className="text-gray-600">
//             {campaign.description || "No description available."}
//           </p>
//         </div>

//         {/* Details */}
//         <div className="grid md:grid-cols-2 gap-6 mb-8">

//           <div>
//             <p className="text-sm text-gray-400">Budget</p>
//             <p className="text-lg font-semibold text-indigo-600">
//               ₹{campaign.budget}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">City</p>
//             <p className="text-lg font-semibold">
//               {campaign.city || "N/A"}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Applications</p>
//             <p className="text-lg font-semibold">
//               {campaign.applicationsCount || 0}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Created At</p>
//             <p className="text-lg font-semibold">
//               {campaign.createdAt
//                 ? new Date(campaign.createdAt).toLocaleDateString()
//                 : "N/A"}
//             </p>
//           </div>

//         </div>

//         {/* Buttons */}
//         <div className="flex gap-4">

//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
//           >
//             View Applications
//           </Link>

//           <Link
//             href="/campaigns"
//             className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
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

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [applications, setApplications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [userRole, setUserRole] = useState("");

//   useEffect(() => {
//     const token = localStorage.getItem("token");
//     const role = localStorage.getItem("role"); // brand / creator

//     if (!token) {
//       router.push("/login");
//       return;
//     }

//     setUserRole(role || "");
//     fetchCampaign(token);

//     if (role === "brand") {
//       fetchApplications(token);
//     }
//   }, [id]);

//   // ===============================
//   // FETCH CAMPAIGN
//   // ===============================
//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       const data = await res.json();
//       setCampaign(data.campaign || data);
//     } catch (err) {
//       console.log(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ===============================
//   // APPLY CAMPAIGN
//   // ===============================
//   const applyCampaign = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       const res = await fetch(`${API_BASE}/applications/apply/${id}`, {
//         method: "POST",
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       const data = await res.json();
//       alert(data.message || "Applied Successfully");
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   // ===============================
//   // FETCH APPLICATIONS (BRAND)
//   // ===============================
//   const fetchApplications = async (token: string) => {
//     try {
//       const res = await fetch(
//         `${API_BASE}/applications/campaign/${id}`,
//         {
//           headers: { Authorization: `Bearer ${token}` },
//         }
//       );

//       const data = await res.json();
//       setApplications(data.applications || []);
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   // ===============================
//   // ACCEPT / REJECT
//   // ===============================
//   const updateStatus = async (appId: string, status: string) => {
//     try {
//       const token = localStorage.getItem("token");

//       await fetch(`${API_BASE}/applications/${appId}`, {
//         method: "PATCH",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${token}`,
//         },
//         body: JSON.stringify({ status }),
//       });

//       fetchApplications(token || "");
//     } catch (err) {
//       console.log(err);
//     }
//   };

//   if (loading) {
//     return <div className="p-10 text-center">Loading...</div>;
//   }

//   if (!campaign) {
//     return <div className="p-10 text-center">Campaign not found</div>;
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">
//       <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">

//         {/* TITLE */}
//         <h1 className="text-3xl font-bold mb-4">
//           {campaign.title}
//         </h1>

//         <p className="mb-6 text-gray-600">
//           {campaign.description}
//         </p>

//         <p className="mb-4 font-semibold">
//           Budget: ₹{campaign.budget}
//         </p>

//         {/* =========================
//            CREATOR APPLY BUTTON
//         ========================== */}
//         {userRole === "creator" && (
//           <button
//             onClick={applyCampaign}
//             className="px-6 py-2 bg-green-600 text-white rounded-lg mb-6"
//           >
//             Apply Now
//           </button>
//         )}

//         {/* =========================
//            BRAND APPLICATION LIST
//         ========================== */}
//         {userRole === "brand" && (
//           <div className="mt-6">
//             <h2 className="text-xl font-bold mb-4">
//               Applications
//             </h2>

//             {applications.length === 0 && (
//               <p>No applications yet</p>
//             )}

//             {applications.map((app) => (
//               <div
//                 key={app._id}
//                 className="border p-4 rounded-lg mb-3"
//               >
//                 <p>
//                   <b>Creator:</b>{" "}
//                   {app.creator?.name || "Unknown"}
//                 </p>

//                 <p>
//                   Status:{" "}
//                   <span className="font-semibold">
//                     {app.status}
//                   </span>
//                 </p>

//                 {app.status === "pending" && (
//                   <div className="flex gap-3 mt-2">
//                     <button
//                       onClick={() =>
//                         updateStatus(app._id, "accepted")
//                       }
//                       className="px-4 py-1 bg-green-500 text-white rounded"
//                     >
//                       Accept
//                     </button>

//                     <button
//                       onClick={() =>
//                         updateStatus(app._id, "rejected")
//                       }
//                       className="px-4 py-1 bg-red-500 text-white rounded"
//                     >
//                       Reject
//                     </button>
//                   </div>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}

//         <Link
//           href="/campaigns"
//           className="mt-6 inline-block text-blue-600"
//         >
//           Back
//         </Link>

//       </div>
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";
// import Link from "next/link";

// const API_BASE = "http://54.252.201.93:5000/api";

// export default function CampaignView() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [campaign, setCampaign] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const token = localStorage.getItem("token");

//     if (!token) {
//       router.push("/login");
//       return;
//     }

//     fetchCampaign(token);
//   }, [id]);

//   const fetchCampaign = async (token: string) => {
//     try {
//       const res = await fetch(`${API_BASE}/campaigns/${id}`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       if (data?.campaign) {
//         setCampaign(data.campaign);
//       } else {
//         setCampaign(data);
//       }

//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Campaign...
//       </div>
//     );
//   }

//   if (!campaign) {
//     return (
//       <div className="min-h-screen flex items-center justify-center">
//         Campaign not found
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 p-10">

//       <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-8">

//         {/* Title */}
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-3xl font-bold">{campaign.title}</h1>

//           <span
//             className={`px-4 py-1 text-sm rounded-full font-semibold
//               ${campaign.status === "open" && "bg-blue-100 text-blue-600"}
//               ${campaign.status === "ongoing" && "bg-yellow-100 text-yellow-600"}
//               ${campaign.status === "completed" && "bg-green-100 text-green-600"}
//             `}
//           >
//             {campaign.status}
//           </span>
//         </div>

//         {/* Description */}
//         <div className="mb-6">
//           <h2 className="font-semibold text-lg mb-2">Description</h2>
//           <p className="text-gray-600">
//             {campaign.description || "No description available."}
//           </p>
//         </div>

//         {/* Details */}
//         <div className="grid md:grid-cols-2 gap-6 mb-8">

//           <div>
//             <p className="text-sm text-gray-400">Budget</p>
//             <p className="text-lg font-semibold text-indigo-600">
//               ₹{campaign.budget}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">City</p>
//             <p className="text-lg font-semibold">
//               {campaign.city || "N/A"}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Applications</p>
//             <p className="text-lg font-semibold">
//               {campaign.applicationsCount || 0}
//             </p>
//           </div>

//           <div>
//             <p className="text-sm text-gray-400">Created At</p>
//             <p className="text-lg font-semibold">
//               {campaign.createdAt
//                 ? new Date(campaign.createdAt).toLocaleDateString()
//                 : "N/A"}
//             </p>
//           </div>

//         </div>

//         {/* Buttons */}
//         <div className="flex gap-4">

//           <Link
//             href={`/campaigns/${campaign._id}/applications`}
//             className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
//           >
//             View Applications
//           </Link>

//           <Link
//             href="/campaigns"
//             className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
//           >
//             Back
//           </Link>

//         </div>

//       </div>
//     </div>
//   );
// }