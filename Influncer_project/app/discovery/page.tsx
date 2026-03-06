"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const API = "http://54.252.201.93:5000/api";

export default function DiscoveryPage() {
  const router = useRouter();

  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [cities, setCities]             = useState<string[]>([]);
  const [categories, setCategories]     = useState<string[]>([]);
  const [loading, setLoading]           = useState(true);
  const [appliedIds, setAppliedIds]     = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [token, setToken]               = useState("");

  useEffect(() => {
    const user = localStorage.getItem("cb_user");
    if (!user) { router.push("/login"); return; }
    const parsed = JSON.parse(user);
    if (parsed.role?.toLowerCase() === "brand") { router.push("/campaigns"); return; }
    const t = parsed.token || localStorage.getItem("token");
    if (!t) { router.push("/login"); return; }
    setToken(t);
    const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
    setAppliedIds(savedApplied);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchAllCampaigns();
  }, [token]);

  useEffect(() => {
    const handleFocus = () => {
      const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      setAppliedIds(savedApplied);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const fetchAllCampaigns = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/campaigns/all`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return;
      const campaigns = Array.isArray(data.data) ? data.data
        : Array.isArray(data.campaigns) ? data.campaigns
        : Array.isArray(data) ? data : [];
      setAllCampaigns(campaigns);

      const applied = campaigns.filter((c: any) => c.hasApplied || c.applied).map((c: any) => c._id);
      const savedApplied = JSON.parse(localStorage.getItem("appliedCampaigns") || "[]");
      setAppliedIds([...new Set([...applied, ...savedApplied])]);

      const citySet = new Set<string>();
      const catSet  = new Set<string>();
      campaigns.forEach((camp: any) => {
        if (camp.city?.trim()) citySet.add(camp.city.toLowerCase().trim());
        if (Array.isArray(camp.categories)) {
          camp.categories.forEach((cat: string) => { if (cat?.trim()) catSet.add(cat.toLowerCase().trim()); });
        } else if (camp.category?.trim()) {
          catSet.add(camp.category.toLowerCase().trim());
        }
      });
      setCities([...citySet]);
      setCategories([...catSet]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((c) => {
      const cityMatch = selectedCity ? c.city?.toLowerCase() === selectedCity.toLowerCase() : true;
      const catMatch  = selectedCategory
        ? Array.isArray(c.categories)
          ? c.categories.some((cat: string) => cat.toLowerCase() === selectedCategory.toLowerCase())
          : c.category?.toLowerCase() === selectedCategory.toLowerCase()
        : true;
      return cityMatch && catMatch;
    });
  }, [allCampaigns, selectedCity, selectedCategory]);

  const goToDetail = (id: string) => {
    router.push(`/campaigns/campaignsdetail?id=${id}`);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .disc-page { font-family: 'Plus Jakarta Sans', sans-serif; background: #f5f5f0; min-height: 100vh; }
        .disc-header { padding: 40px 40px 0; }
        @media(max-width:600px){ .disc-header { padding: 24px 16px 0; } }
        .disc-title { font-size: 30px; font-weight: 800; color: #4f46e5; margin: 0 0 4px; }
        .disc-sub   { color: #999; font-size: 14px; margin: 0; }

        .disc-filters { display: flex; gap: 10px; padding: 20px 40px; flex-wrap: wrap; }
        @media(max-width:600px){ .disc-filters { padding: 16px; } }
        .disc-select {
          padding: 10px 36px 10px 14px; border-radius: 100px;
          border: 1.5px solid #e8e8e8; background: #fff;
          font-size: 13px; font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 500; color: #555; outline: none; cursor: pointer;
          transition: all 0.2s; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23999' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; background-color: #fff;
        }
        .disc-select:focus { border-color: #4f46e5; }
        .disc-select.active {
          border-color: #4f46e5; background-color: #4f46e5; color: #fff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
        }
        .disc-clear {
          padding: 10px 16px; border-radius: 100px;
          border: 1.5px solid #e8e8e8; background: #fafafa;
          font-size: 13px; color: #999; cursor: pointer;
          font-family: 'Plus Jakarta Sans', sans-serif; transition: all 0.2s;
        }
        .disc-clear:hover { border-color: #ef4444; color: #ef4444; }

        .disc-stats { display: flex; gap: 6px; align-items: center; padding: 0 40px 16px; }
        @media(max-width:600px){ .disc-stats { padding: 0 16px 12px; } }
        .disc-stat-text  { font-size: 13px; color: #999; }
        .disc-stat-count { font-size: 13px; font-weight: 700; color: #4f46e5; }

        .disc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 18px; padding: 0 40px 32px;
        }
        @media(max-width:600px){ .disc-grid { grid-template-columns: 1fr; padding: 0 16px 24px; gap: 14px; } }

        .disc-card {
          background: #fff; border-radius: 18px;
          border: 1.5px solid #ebebeb; padding: 22px;
          transition: all 0.2s; cursor: pointer;
        }
        .disc-card:hover { border-color: #c7d2fe; box-shadow: 0 8px 30px rgba(79,70,229,0.08); transform: translateY(-2px); }

        .disc-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px; }
        .disc-card-title { font-size: 16px; font-weight: 700; color: #111; margin: 0; line-height: 1.3; }
        .disc-badge { padding: 4px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; white-space: nowrap; flex-shrink: 0; }
        .disc-badge.applied { background: #eff6ff; color: #4f46e5; border-color: #c7d2fe; }

        .disc-desc { color: #777; font-size: 13px; line-height: 1.6; margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .disc-meta { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
        .disc-meta-item { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999; font-weight: 500; }

        .disc-cats { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
        .disc-cat { padding: 3px 10px; border-radius: 100px; background: #f0eeff; font-size: 11px; color: #4f46e5; font-weight: 600; }

        .disc-apply-btn {
          width: 100%; padding: 11px; border-radius: 11px;
          font-size: 13px; font-weight: 700;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border: none; cursor: pointer; transition: all 0.2s;
          background: #4f46e5; color: #fff;
        }
        .disc-apply-btn:hover { background: #4338ca; transform: translateY(-1px); }
        .disc-apply-btn.applied-btn { background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; }
        .disc-apply-btn.applied-btn:hover { background: #dcfce7; transform: none; }

        .disc-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 40px; text-align: center; }
        .disc-empty-icon  { font-size: 48px; margin-bottom: 16px; }
        .disc-empty-title { font-size: 20px; font-weight: 700; color: #111; margin: 0 0 8px; }
        .disc-empty-sub   { color: #aaa; font-size: 14px; margin: 0; }

        .disc-loading { display: flex; align-items: center; justify-content: center; padding: 80px; }
        .disc-spinner { width: 32px; height: 32px; border: 3px solid #f0f0f0; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="disc-page">
        <div className="disc-header">
          <h1 className="disc-title">Discover Campaigns</h1>
          <p className="disc-sub">Find brand campaigns that match your vibe</p>
        </div>

        {/* FILTERS */}
        <div className="disc-filters">
          <select
            className={`disc-select ${selectedCity ? "active" : ""}`}
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
          >
            <option value="">🏙 All Cities</option>
            {cities.map((city, i) => (
              <option key={i} value={city}>{city.charAt(0).toUpperCase() + city.slice(1)}</option>
            ))}
          </select>

          <select
            className={`disc-select ${selectedCategory ? "active" : ""}`}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">🎯 All Categories</option>
            {categories.map((cat, i) => (
              <option key={i} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>

          {(selectedCity || selectedCategory) && (
            <button className="disc-clear" onClick={() => { setSelectedCity(""); setSelectedCategory(""); }}>
              ✕ Clear
            </button>
          )}
        </div>

        {/* STATS */}
        {!loading && allCampaigns.length > 0 && (
          <div className="disc-stats">
            <span className="disc-stat-count">{filteredCampaigns.length}</span>
            <span className="disc-stat-text">campaigns {selectedCity || selectedCategory ? "found" : "available"}</span>
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="disc-loading"><div className="disc-spinner" /></div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="disc-empty">
            <div className="disc-empty-icon">🔍</div>
            <h3 className="disc-empty-title">
              {selectedCity || selectedCategory ? "No matches found" : "No campaigns yet"}
            </h3>
            <p className="disc-empty-sub">
              {selectedCity || selectedCategory ? "Try different filters or clear to see all" : "Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="disc-grid">
            {filteredCampaigns.map((c) => {
              const isApplied = appliedIds.includes(c._id);
              return (
                <div
                  key={c._id}
                  className="disc-card"
                  onClick={() => goToDetail(c._id)}
                >
                  <div className="disc-card-top">
                    <h2 className="disc-card-title">{c.title}</h2>
                    {isApplied
                      ? <span className="disc-badge applied">Applied ✓</span>
                      : <span className="disc-badge">Open</span>}
                  </div>

                  {c.description && <p className="disc-desc">{c.description}</p>}

                  <div className="disc-meta">
                    {c.budget && <span className="disc-meta-item">💰 ₹{c.budget.toLocaleString()}</span>}
                    {c.city   && <span className="disc-meta-item">📍 {c.city.charAt(0).toUpperCase() + c.city.slice(1)}</span>}
                  </div>

                  {c.categories?.length > 0 && (
                    <div className="disc-cats">
                      {c.categories.map((cat: string, i: number) => (
                        <span key={i} className="disc-cat">{cat}</span>
                      ))}
                    </div>
                  )}

                  {isApplied ? (
                    <button
                      className="disc-apply-btn applied-btn"
                      onClick={(e) => { e.stopPropagation(); goToDetail(c._id); }}
                    >
                      ✓ Applied — View Details
                    </button>
                  ) : (
                    <button
                      className="disc-apply-btn"
                      onClick={(e) => { e.stopPropagation(); goToDetail(c._id); }}
                    >
                      View & Apply →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}


