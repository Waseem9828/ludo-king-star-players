import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { getAdminLogs, getAdminLogsStats } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";

export default function AdminLogs() {
  const { token, user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [page]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [logsRes, statsRes] = await Promise.all([
        getAdminLogs(token, page, 50),
        getAdminLogsStats(token)
      ]);
      setLogs(logsRes.logs);
      setTotalPages(logsRes.totalPages);
      setStats(statsRes);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (currentUser?.role !== "master" && currentUser?.role !== "owner") {
    return (
      <div className="card" style={{ padding: "24px", textAlign: "center" }}>
        <EmptyState icon="🔒" title="Access Denied" description="You do not have permission to view activity logs." />
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <div className="row-between" style={{ gap: "10px" }}>
          <h1>📋 Activity Logs</h1>
          <button className="btn btn-sm btn-outline" onClick={fetchData} disabled={loading} style={{ minHeight: "34px", fontSize: "12px", borderRadius: "10px" }}>
            Refresh
          </button>
        </div>
        <span className="admin-page-header__subtitle">
          Track admin actions across the platform
        </span>
      </div>

      {/* Admin Stats Cards */}
      {stats.length > 0 ? (
        <div className="admin-stats-grid">
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-card" style={{ padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "13px", color: "var(--text)" }}>{stat.name}</div>
                  <span className="admin-badge info" style={{ fontSize: "9px", padding: "1px 6px", marginTop: "2px" }}>
                    {stat.role}
                  </span>
                </div>
                <span style={{ fontSize: "18px" }}>👤</span>
              </div>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--text)" }}>{stat.actionsToday}</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", marginTop: "2px" }}>Actions today</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: "14px", textAlign: "center" }}>
          <p className="text-muted" style={{ fontSize: "12px" }}>No admin actions recorded today.</p>
        </div>
      )}

      {/* Logs — Mobile Cards + Desktop Table */}
      {loading && logs.length === 0 ? (
        <Loading label="Loading logs..." />
      ) : logs.length === 0 ? (
        <div className="card">
          <EmptyState icon="📋" title="No Logs Found" description="No admin activity logs recorded." />
        </div>
      ) : (
        <>
          {/* MOBILE: Card View */}
          <div className="admin-mobile-cards">
            {logs.map((log) => (
              <div key={log._id} className="admin-mobile-card">
                <div className="admin-mobile-card__header">
                  <div className="admin-mobile-card__user">
                    <div className="admin-mobile-card__avatar">
                      {(log.adminId?.name || "S").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="admin-mobile-card__name">{log.adminId?.name || "System"}</div>
                      <div className="admin-mobile-card__sub">{log.adminId?.phone || "N/A"}</div>
                    </div>
                  </div>
                  <span className="admin-badge info" style={{ fontSize: "10px", padding: "2px 8px" }}>{log.action}</span>
                </div>

                <div style={{ padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.05)", fontSize: "12px" }}>
                  <div style={{ color: "var(--text)", fontWeight: "500", wordBreak: "break-word" }}>{log.details}</div>
                  {log.targetUser && (
                    <div style={{ color: "var(--primary)", fontSize: "11px", marginTop: "4px", fontWeight: "600" }}>
                      Target: {log.targetUser.name}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "6px", borderTop: "1px solid rgba(0,0,0,0.03)" }}>
                  <span style={{ fontSize: "10px", color: "var(--text-faint)", fontFamily: "monospace" }}>{log.ipAddress || "-"}</span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* DESKTOP: Table View */}
          <div className="admin-table-desktop">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Admin User</th>
                    <th>Action</th>
                    <th>Details / Target</th>
                    <th>IP & Client</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td>
                        <div style={{ fontWeight: "700", color: "var(--text)" }}>{log.adminId?.name || "System"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "11px" }}>{log.adminId?.phone || "N/A"}</div>
                      </td>
                      <td>
                        <span className="admin-badge info">{log.action}</span>
                      </td>
                      <td style={{ maxWidth: "250px" }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={log.details}>
                          {log.details}
                        </div>
                        {log.targetUser && (
                          <div style={{ color: "var(--primary)", fontSize: "11px", marginTop: "2px" }}>
                            Target: {log.targetUser.name}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "monospace" }}>{log.ipAddress || "-"}</div>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="card" style={{ padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            className="btn btn-sm btn-outline"
            style={{ minHeight: "34px", fontSize: "12px", borderRadius: "10px" }}
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            ← Previous
          </button>
          <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
            {page} / {totalPages}
          </span>
          <button
            className="btn btn-sm btn-outline"
            style={{ minHeight: "34px", fontSize: "12px", borderRadius: "10px" }}
            disabled={page === totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
