import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { deleteDepositOrder, cleanupDeposits, refreshDepositOrder } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";

const statusBadge = {
  pending: "badge-pending",
  success: "badge-open",
  failed: "badge-full",
};

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDepositHistory() {
  const { token } = useAuth();
  const { data, error, mutate } = useSWR("/admin/deposit-history");
  const loading = !data && !error;
  const orders = data || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);

  const filteredOrders = orders.filter((o) => {
    let statusMatch = true;
    if (filterStatus === "SUCCESS") statusMatch = o.status === "success";
    if (filterStatus === "PENDING") statusMatch = o.status === "pending";
    if (filterStatus === "FAILED") statusMatch = o.status === "failed";

    const text = `${o.orderId || ""} ${o.user?.name || ""} ${o.user?.phone || ""} ${o.amount || ""}`.toLowerCase();
    const searchMatch = text.includes(searchTerm.toLowerCase().trim());

    return statusMatch && searchMatch;
  });

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm("Delete this deposit order record to free database space?")) return;
    setActingId(orderId);
    try {
      await deleteDepositOrder(token, orderId);
      mutate(orders.filter((o) => o._id !== orderId), { revalidate: false });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const handleRefreshOrder = async (orderId) => {
    setActingId(orderId);
    setActionError("");
    try {
      const res = await refreshDepositOrder(token, orderId);
      mutate(orders.map((o) => (o._id === orderId ? res.order : o)), { revalidate: false });
      alert(res.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const handleBulkCleanup = async () => {
    if (!window.confirm("Delete all completed and failed deposit records to free database space?")) return;
    setIsCleaning(true);
    try {
      const res = await cleanupDeposits(token);
      mutate(orders.filter((o) => o.status === "pending"), { revalidate: false });
      alert(res.message);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const displayError = error ? (error.message || String(error)) : actionError;

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <div className="row-between" style={{ gap: "10px" }}>
          <h1>Deposits ({orders.length})</h1>
          {orders.some((o) => o.status !== "pending") && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "#ef4444", fontSize: "11px", minHeight: "34px", padding: "0 10px" }}
              onClick={handleBulkCleanup}
            >
              🗑 Cleanup
            </button>
          )}
        </div>
        <span className="admin-page-header__subtitle">Automatic UPI gateway deposit ledger</span>
      </div>

      {displayError && <p className="notice-banner">{displayError}</p>}

      {/* SEARCH + FILTER */}
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search order ID, name, phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="admin-filter-chips">
          {[
            { key: "ALL", label: `All (${orders.length})` },
            { key: "SUCCESS", label: "Success" },
            { key: "PENDING", label: "Pending" },
            { key: "FAILED", label: "Failed" },
          ].map((chip) => (
            <button
              key={chip.key}
              className={`admin-filter-chip ${filterStatus === chip.key ? "is-active" : ""}`}
              onClick={() => setFilterStatus(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {(loading || isCleaning) ? (
        <Loading label={isCleaning ? "Cleaning up deposit logs..." : "Loading deposit history..."} />
      ) : filteredOrders.length === 0 ? (
        <div className="card">
          <EmptyState icon="💳" title="No Deposits Found" description="No automatic UPI deposit logs match your filter criteria." />
        </div>
      ) : (
        <div className="stack" style={{ gap: "14px" }}>
          {filteredOrders.map((order) => (
            <div key={order._id} className="card stack" style={{ padding: "16px", gap: "12px", background: "var(--surface)" }}>
              <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span className={`badge ${statusBadge[order.status] || "badge-neutral"}`}>
                      {order.status?.toUpperCase()}
                    </span>
                    <strong style={{ fontSize: "18px", color: "var(--primary-strong)" }}>₹{order.amount}</strong>
                  </div>
                  <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                    User: <strong>{order.user?.name || "Unknown user"}</strong> ({order.user?.phone || "—"})
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p className="text-faint" style={{ margin: 0, fontSize: "12px" }}>{formatDate(order.createdAt)}</p>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#ef4444", marginTop: "4px", fontSize: "12px" }}
                    disabled={actingId === order._id}
                    onClick={() => handleDeleteOrder(order._id)}
                  >
                    🗑 Delete Log
                  </button>
                </div>
              </div>

              {/* GATEWAY DETAILS BOX */}
              <div
                style={{
                  background: "var(--surface-alt)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  fontSize: "13px",
                }}
              >
                <div className="row-between">
                  <span className="text-faint">Order ID:</span>
                  <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>{order.orderId}</span>
                </div>

                {order.imbResponse && (() => {
                  const res = order.imbResponse;
                  const data = res.data || res;
                  const utr = data.upi_txn_id || data.utr || data.UTR || data.bank_ref_num || "N/A";
                  const txnId = data.txn_id || data.client_txn_id || res.txnId || "N/A";
                  const msg = res.message || res.msg || data.message || data.msg || "";
                  const gatewayStatus = data.status || res.Status || res.status || "UNKNOWN";

                  return (
                    <div style={{ marginTop: "10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontWeight: "600", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Payment Gateway Status</span>
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            background: String(gatewayStatus).toUpperCase() === "SUCCESS" || String(gatewayStatus).toUpperCase() === "PAID" ? "#10b981" : "#ef4444",
                            color: "white",
                            fontWeight: "bold",
                          }}
                        >
                          {gatewayStatus}
                        </span>
                      </div>
                      <div style={{ padding: "10px 12px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                        {utr !== "N/A" && (
                          <div className="row-between">
                            <span className="text-faint">UPI UTR / Bank Ref:</span>
                            <span style={{ fontWeight: "600", color: "var(--success)", fontFamily: "monospace" }}>{utr}</span>
                          </div>
                        )}
                        {txnId !== "N/A" && (
                          <div className="row-between">
                            <span className="text-faint">Txn ID:</span>
                            <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{txnId}</span>
                          </div>
                        )}
                        {msg && (
                          <div className="row-between">
                            <span className="text-faint">Message:</span>
                            <span>{msg}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {order.status === "pending" && (
                  <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: "12px" }}
                      disabled={actingId === order._id}
                      onClick={() => handleRefreshOrder(order._id)}
                    >
                      {actingId === order._id ? "Verifying..." : "🔄 Refresh Status from Gateway API"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
