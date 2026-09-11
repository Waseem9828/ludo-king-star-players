import { Link } from "react-router-dom";
import useSWR from "swr";
import Loading from "../../components/Loading.jsx";
import { ChevronRightIcon } from "../../components/Icons.jsx";
import { RevenueTrendChart, MatchVolumeChart, MonthlyRevenueChart } from "../../components/AdminCharts.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";

const tools = [
  { label: "👥 Manage Users", desc: "Deep Inspector", to: "/admin/users", badgeKey: "totalUsers" },
  { label: "🎲 Matches & Disputes", desc: "Battle Center", to: "/admin/matches", badgeKey: "disputedMatches" },
  { label: "💸 Withdrawal Payouts", desc: "Process Requests", to: "/admin/withdrawals", badgeKey: "pendingWithdrawals", highlight: true },
  { label: "💳 Deposit Ledger", desc: "Gateway History", to: "/admin/deposit-history" },
  { label: "📄 KYC Management", desc: "Verify Documents", to: "/admin/kyc", badgeKey: "verifiedKyc" },
  { label: "📞 Contacts list", desc: "User Contacts", to: "/admin/contacts", ownerOnly: true },
  { label: "📢 Announcements", desc: "Broadcast", to: "/admin/notifications" },
  { label: "🖼 Media & Banners", desc: "DMS Storage", to: "/admin/dms", ownerOnly: true },
  { label: "⚙️ Referral Settings", desc: "Commissions", to: "/admin/referrals", ownerOnly: true },
  { label: "🛠 Site Settings", desc: "Limits & Config", to: "/admin/site-settings", ownerOnly: true },
  { label: "🏥 System Health", desc: "Server & IP", to: "/admin/system-health", ownerOnly: true },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { data, error } = useSWR("/admin/stats");
  const loading = !data && !error;
  const stats = data;

  const visibleTools = tools.filter((tool) => {
    const r = user?.role;
    if (r === "master" || r === "owner") return true;
    if (tool.ownerOnly) return false;
    if (["finance_admin", "admin"].includes(r)) return true;
    return false;
  });

  const kpis = [
    { label: "App Revenue", value: stats ? `₹${stats.totalAppRevenue}` : "—", trend: "💰 Net Profit", color: "#10b981" },
    { label: "Total Deposits", value: stats ? `₹${stats.totalDeposits}` : "—", trend: "💳 All Time", color: "#f59e0b" },
    { label: "Total Payouts", value: stats ? `₹${stats.totalWithdrawals}` : "—", trend: "💸 All Time", color: "#6366f1" },
    { label: "Today Deposits", value: stats ? `₹${stats.todayDeposits}` : "—", trend: `${stats?.todayDepositCount || 0} orders`, color: "#10b981" },
    { label: "Today Payouts", value: stats ? `₹${stats.todayWithdrawals}` : "—", trend: "📉 Since midnight", color: "#ef4444" },
    { label: "Active Users", value: stats?.activeUsers ?? "—", trend: "👥 Online", color: "#6366f1" },
    { label: "Total Deposit Wallet", value: stats ? `₹${stats.totalDepositWallet}` : "—", trend: "💰 Global", color: "#10b981" },
    { label: "Total Winning Wallet", value: stats ? `₹${stats.totalWinningWallet}` : "—", trend: "🏆 Global", color: "#f59e0b" },
    { label: "Verified KYC", value: stats?.verifiedKyc ?? "—", trend: "✓ Approved", color: "#10b981" },
    { label: "Unverified KYC", value: stats?.notVerifiedKyc ?? "—", trend: "⚠️ Action Needed", color: "#ef4444" },
  ];

  return (
    <div className="stack" style={{ gap: "16px" }}>
      {/* COMPACT HEADER */}
      <div className="admin-page-header">
        <h1>Dashboard</h1>
        <span className="admin-page-header__subtitle">Live analytics & platform operations</span>
      </div>

      {error && <p className="notice-banner">Unable to load stats: {error.message || String(error)}</p>}

      {loading ? (
        <Loading label="Loading analytics..." />
      ) : (
        <>
          {/* SCROLLABLE QUICK STATS (MOBILE) + GRID (DESKTOP) */}
          <div className="admin-stats-grid">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="stat-card" style={{ position: "relative", overflow: "hidden", padding: "14px" }}>
                <div style={{ position: "absolute", top: 0, left: 0, width: "3px", height: "100%", background: kpi.color }} />
                <div style={{ paddingLeft: "6px" }}>
                  <p className="stat-label" style={{ fontSize: "10px", letterSpacing: "0.06em", margin: 0 }}>{kpi.label}</p>
                  <p className="stat-value" style={{ fontSize: "24px", fontWeight: "900", margin: "2px 0 4px", letterSpacing: "-0.03em" }}>{kpi.value}</p>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: kpi.color, display: "flex", alignItems: "center", gap: "3px", background: `color-mix(in srgb, ${kpi.color} 12%, transparent)`, padding: "2px 6px", borderRadius: "6px", width: "fit-content" }}>
                    {kpi.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* INTERACTIVE CHARTS */}
          {stats?.chartData && stats.chartData.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px" }}>
              {/* CHART 1: REVENUE */}
              <div className="card stack" style={{ padding: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px" }}>Revenue Trends (7d)</h3>
                  <p className="text-muted" style={{ fontSize: "11px", margin: "2px 0 0" }}>
                    Deposits vs withdrawals
                  </p>
                </div>
                <div style={{ fontSize: "10px", display: "flex", gap: "8px", fontWeight: "bold" }}>
                  <span style={{ color: "#6366f1" }}>● Deposits</span>
                  <span style={{ color: "#ef4444" }}>-- Payouts</span>
                </div>
                <RevenueTrendChart data={stats.chartData} />
              </div>

              {/* CHART 2: MATCH VOLUME */}
              <div className="card stack" style={{ padding: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px" }}>Match Volume (7d)</h3>
                  <p className="text-muted" style={{ fontSize: "11px", margin: "2px 0 0" }}>
                    Daily matches created
                  </p>
                </div>
                <MatchVolumeChart data={stats.chartData} />
              </div>

              {/* CHART 3: MONTHLY REVENUE */}
              <div className="card stack" style={{ padding: "14px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "14px" }}>Net App Revenue (6m)</h3>
                  <p className="text-muted" style={{ fontSize: "11px", margin: "2px 0 0" }}>
                    Platform fee (green) vs Referral payouts (red)
                  </p>
                </div>
                <div style={{ fontSize: "10px", display: "flex", gap: "8px", fontWeight: "bold" }}>
                  <span style={{ color: "#10b981" }}>■ Gross Revenue</span>
                  <span style={{ color: "#ef4444" }}>■ Referral Payouts</span>
                </div>
                <MonthlyRevenueChart data={stats.monthlyData} />
              </div>
            </div>
          )}

          {/* OPERATIONS HUB */}
          <div className="card list-card" style={{ padding: "6px" }}>
            <h3 style={{ padding: "10px 12px 4px", margin: 0, fontSize: "14px" }}>Operations Hub</h3>
            {visibleTools.map((tool) => {
              const badgeValue = tool.badgeKey && stats?.[tool.badgeKey];
              return (
                <Link key={tool.to} to={tool.to} className="list-item" style={{ padding: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div>
                      <span style={{ fontWeight: tool.highlight ? "700" : "600", fontSize: "13px", display: "block" }}>{tool.label}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-faint)", fontWeight: "500" }}>{tool.desc}</span>
                    </div>
                    {badgeValue > 0 && (
                      <span
                        style={{
                          background: "#ef4444",
                          color: "white",
                          fontSize: "10px",
                          fontWeight: "bold",
                          padding: "2px 7px",
                          borderRadius: "8px",
                          flexShrink: 0,
                        }}
                      >
                        {badgeValue}
                      </span>
                    )}
                  </div>
                  <ChevronRightIcon size={14} />
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
