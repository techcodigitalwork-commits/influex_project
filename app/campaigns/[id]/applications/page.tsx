"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API = "http://54.252.201.93:5000/api";

interface Influencer {
  _id: string;
  title: string;
  email: string;
}

interface Application {
  _id: string;
  influencerId: Influencer | string; // can be ID or populated object
  status: string;
}

export default function ApplicationsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Type Guard
  function isInfluencerObject(
    influencer: Application["influencerId"]
  ): influencer is Influencer {
    return typeof influencer === "object" && influencer !== null;
  }

  const fetchApps = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`${API}/campaigns/${id}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        localStorage.clear();
        router.push("/login");
        return;
      }

      const data = await res.json();
      console.log("RAW APPLICATION RESPONSE:", data);

      let appsArray: any[] = [];
      if (Array.isArray(data)) appsArray = data;
      else if (Array.isArray(data?.applications)) appsArray = data.applications;
      else if (Array.isArray(data?.data)) appsArray = data.data;

      const appsWithInfluencers = await Promise.all(
        appsArray.map(async (app: Application) => {
          if (typeof app.influencerId === "string") {
            try {
              const infRes = await fetch(
                `${API}/influencers/${app.influencerId}`,
                {
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (infRes.ok) {
                const infData = await infRes.json();
                app.influencerId = {
                  _id: infData._id,
                  title: infData.title || "Unknown",
                  email: infData.email || "No Email",
                };
              } else {
                const influencerIdString = app.influencerId as string;

app.influencerId = {
  _id: influencerIdString,
  title: "Unknown",
  email: "No Email",
};
              }
            } catch {
              const influencerIdString = app.influencerId as string;

app.influencerId = {
  _id: influencerIdString,
  title: "Unknown",
  email: "No Email",
};
            }
          }
          return app;
        })
      );

      setApplications(appsWithInfluencers);
    } catch (err) {
      console.error("Fetch error:", err);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchApps();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xl font-bold">
        Loading Applications...
      </div>
    );
  }

  return (
    <div className="p-10 bg-slate-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Applications</h1>

      {applications.length > 0 ? (
        applications.map((app) => (
          <div
            key={app._id}
            className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
          >
            <div>
              <h2 className="font-bold text-lg">
                {isInfluencerObject(app.influencerId)
                  ? app.influencerId.title
                  : "Unknown"}
              </h2>

              <p className="text-gray-500">
                {isInfluencerObject(app.influencerId)
                  ? app.influencerId.email
                  : "No Email"}
              </p>

              <span
                className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
                  ${app.status === "PENDING" && "bg-gray-100 text-gray-600"}
                  ${app.status === "ACCEPTED" && "bg-green-100 text-green-600"}
                  ${app.status === "REJECTED" && "bg-red-100 text-red-600"}
                `}
              >
                {app.status}
              </span>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-xl p-10 text-center shadow">
          No applications yet.
        </div>
      )}
    </div>
  );
}




// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const API = "http://54.252.201.93:5000/api";

// interface Application {
//   _id: string;
//   influencerId: {
//     _id: string;
//     title: string;
//     email: string;
//   } | string; // could be just ID if not populated
//   status: string;
// }

// export default function ApplicationsPage() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<Application[]>([]);
//   const [loading, setLoading] = useState(true);

//   const fetchApps = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();
//       console.log("RAW APPLICATION RESPONSE:", data);

//       // Ensure we have an array
//       let appsArray: any[] = [];
//       if (Array.isArray(data)) appsArray = data;
//       else if (Array.isArray(data?.applications)) appsArray = data.applications;
//       else if (Array.isArray(data?.data)) appsArray = data.data;

//       // Fetch influencer details if not populated
//       const appsWithInfluencers = await Promise.all(
//         appsArray.map(async (app: Application) => {
//           if (typeof app.influencerId === "string") {
//             // influencerId is just an ID, fetch details
//             try {
//               const infRes = await fetch(`${API}/influencers/${app.influencerId}`, {
//                 headers: { Authorization: `Bearer ${token}` },
//               });
//               if (infRes.ok) {
//                 const infData = await infRes.json();
//                 app.influencerId = {
//                   _id: infData._id,
//                   title: infData.title || "Unknown",
//                   email: infData.email || "No Email",
//                 };
//               } else {
//                 app.influencerId = { _id: app.influencerId, title: "Unknown", email: "No Email" };
//               }
//             } catch {
//               app.influencerId = { _id: app.influencerId, title: "Unknown", email: "No Email" };
//             }
//           }
//           return app;
//         })
//       );

//       setApplications(appsWithInfluencers);
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setApplications([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchApps();
//   }, [id]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Applications...
//       </div>
//     );
//   }

//   return (
//     <div className="p-10 bg-slate-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8">Applications</h1>

//       {applications.length > 0 ? (
//         applications.map((app) => (
//           <div
//             key={app._id}
//             className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
//           >
//             <div>
//               <h2 className="font-bold text-lg">
//                 {app.influencerId?.title || "Unknown"}
//               </h2>
//               <p className="text-gray-500">
//                 {app.influencerId?.email || "No Email"}
//               </p>

//               <span
//                 className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
//                   ${app.status === "PENDING" && "bg-gray-100 text-gray-600"}
//                   ${app.status === "ACCEPTED" && "bg-green-100 text-green-600"}
//                   ${app.status === "REJECTED" && "bg-red-100 text-red-600"}
//                 `}
//               >
//                 {app.status}
//               </span>
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="bg-white rounded-xl p-10 text-center shadow">
//           No applications yet.
//         </div>
//       )}
//     </div>
//   );
// }


// "use client";

// import { useParams, useRouter } from "next/navigation";
// import { useEffect, useState } from "react";

// const API = "http://54.252.201.93:5000/api";

// export default function ApplicationsPage() {
//   const { id } = useParams();
//   const router = useRouter();

//   const [applications, setApplications] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);

//   const fetchApps = async () => {
//     try {
//       const token = localStorage.getItem("token");

//       if (!token) {
//         router.push("/login");
//         return;
//       }

//       const res = await fetch(`${API}/campaigns/${id}/applications`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });

//       if (res.status === 401) {
//         localStorage.clear();
//         router.push("/login");
//         return;
//       }

//       const data = await res.json();

//       console.log("APPLICATION RESPONSE:", data);

//       // ✅ SAFE ARRAY HANDLING
//       if (Array.isArray(data)) {
//         setApplications(data);
//       } else if (Array.isArray(data?.applications)) {
//         setApplications(data.applications);
//       } else if (Array.isArray(data?.data)) {
//         setApplications(data.data);
//       } else {
//         setApplications([]);
//       }

//     } catch (err) {
//       console.error("Fetch error:", err);
//       setApplications([]);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (id) fetchApps();
//   }, [id]);

//   if (loading) {
//     return (
//       <div className="min-h-screen flex items-center justify-center text-xl font-bold">
//         Loading Applications...
//       </div>
//     );
//   }

//   return (
//     <div className="p-10 bg-slate-50 min-h-screen">
//       <h1 className="text-3xl font-bold mb-8">Applications</h1>

//       {Array.isArray(applications) && applications.length > 0 ? (
//         applications.map((app: any) => (
//           <div
//             key={app?._id}
//             className="bg-white p-6 rounded-xl shadow mb-4 flex justify-between items-center"
//           >
//             <div>
//               <h2 className="font-bold text-lg">
//                 {app?.influencerId?.name || "Unknown"}
//               </h2>
//               <p className="text-gray-500">
//                 {app?.influencerId?.email || "No Email"}
//               </p>

//               <span
//                 className={`inline-block mt-2 px-3 py-1 text-xs rounded-full font-semibold
//                   ${app?.status === "PENDING" && "bg-gray-100 text-gray-600"}
//                   ${app?.status === "ACCEPTED" && "bg-green-100 text-green-600"}
//                   ${app?.status === "REJECTED" && "bg-red-100 text-red-600"}
//                 `}
//               >
//                 {app?.status}
//               </span>
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="bg-white rounded-xl p-10 text-center shadow">
//           No applications yet.
//         </div>
//       )}
//     </div>
//   );
// }