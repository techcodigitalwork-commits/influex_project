"use client";

import { MOCK_USERS } from "@/lib/constants";

export default function AdminDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-3xl font-bold text-slate-900">
          Admin Command Center
        </h1>
        <p className="text-slate-500 mt-2">
          Oversee platform growth, verifications, and marketplace health.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[
          { label: "Total Users", value: "4,892", change: "+12%" },
          { label: "Active Campaigns", value: "156", change: "+5%" },
          { label: "Platform Revenue", value: "₹12.4L", change: "+18%" },
          { label: "Pending KYCs", value: "42", change: "-3%" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm"
          >
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {stat.label}
            </div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-extrabold text-slate-900">
                {stat.value}
              </div>
              <div
                className={`text-xs font-bold ${
                  stat.change.startsWith("+")
                    ? "text-green-500"
                    : "text-red-500"
                }`}
              >
                {stat.change}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Verification Queue */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-900">
              User Verification Queue
            </h3>
            <button className="text-sm font-bold text-indigo-600 hover:underline">
              View All
            </button>
          </div>

          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Submitted</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50">
              {MOCK_USERS.slice(0, 4).map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-slate-50 transition"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={user.avatar}
                        className="w-10 h-10 rounded-xl object-cover"
                        alt={user.name}
                      />
                      <span className="text-sm font-bold text-slate-900">
                        {user.name}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                      {user.role}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-slate-500">
                    2 hours ago
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition">
                        ✓
                      </button>
                      <button className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition">
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* System Health */}
        <div className="bg-slate-900 p-8 rounded-3xl text-white shadow-xl">
          <h3 className="text-xl font-bold mb-8">System Health</h3>

          <div className="space-y-8">
            <StatBar label="API LATENCY" value="42ms" percent={15} color="green" />
            <StatBar label="CPU USAGE" value="28%" percent={28} color="indigo" />
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              Latest Logs
            </h4>
            <div className="font-mono text-[10px] space-y-2 text-slate-400">
              <p>
                [09:24] <span className="text-green-400">SUCCESS</span> User
                verification completed
              </p>
              <p>
                [09:25] <span className="text-amber-400">WARN</span> Slow DB
                query
              </p>
              <p>
                [09:26] <span className="text-indigo-400">INFO</span> New
                campaign posted
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small reusable bar */
function StatBar({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: "green" | "indigo";
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
        <span>{label}</span>
        <span className={`text-${color}-400`}>{value}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-800 rounded-full">
        <div
          className={`h-full bg-${color}-400 rounded-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
