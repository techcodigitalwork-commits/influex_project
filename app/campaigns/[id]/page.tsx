"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE = "https://api.collabzy.in/api";

export default function CampaignView() {
  const { id } = useParams();
  const router = useRouter();

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  // Directly use applicationsCount from campaign object (no extra API call needed)
  const totalApps = campaign?.applicationsCount ?? 0;

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
              {totalApps}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Created At</span>
            <span className="font-bold text-slate-800">
              {campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : "N/A"}
            </span>
          </div>
        </div>

        {/* BUTTONS */}
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


