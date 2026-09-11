import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { updateWithdrawal, deleteWithdrawalAdmin, cleanupWithdrawals } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import { QRCodeSVG } from "qrcode.react";

const statusBadge = {
  pending: "badge-pending",
  approved: "badge-open",
  rejected: "badge-full",
};

export default function AdminWithdrawals() {
  const { token } = useAuth();
  const { data: withdrawalsData, error: swrError, mutate } = useSWR("/admin/withdrawals");
  const withdrawals = withdrawalsData || [];
  const loading = !withdrawalsData && !swrError;
  const [actionError, setActionError] = useState("");
  const error = swrError ? (swrError.message || String(swrError)) : actionError;
  const [actingId, setActingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  // Reject Modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectItem, setRejectItem] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);



  const filtered = withdrawals.filter((w) => {
    let statusMatch = true;
    if (filterStatus === "PENDING") statusMatch = w.status === "pending";
    if (filterStatus === "APPROVED") statusMatch = w.status === "approved";
    if (filterStatus === "REJECTED") statusMatch = w.status === "rejected";

    const text = `${w.user?.name || ""} ${w.user?.phone || ""} ${w._id || ""} ${w.amount || ""} ${w.payoutDetails?.upiId || ""} ${w.payoutDetails?.accountNumber || ""}`.toLowerCase();
    const searchMatch = text.includes(searchTerm.toLowerCase().trim());

    return statusMatch && searchMatch;
  });

  const handleApprove = async (id) => {
    if (!window.confirm("Approve this withdrawal payout request?")) return;
    setActingId(id);
    setActionError("");
    try {
      const updated = await updateWithdrawal(token, id, "approve");
      mutate((prev) => prev?.map((w) => (w._id === updated._id ? updated : w)), false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const openRejectModal = (w) => {
    setRejectItem(w);
    setRejectNote("");
    setRejectOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectItem) return;
    setRejectSubmitting(true);
    setActionError("");
    try {
      const updated = await updateWithdrawal(token, rejectItem._id, "reject");
      mutate((prev) => prev?.map((w) => (w._id === updated._id ? updated : w)), false);
      setRejectOpen(false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRejectSubmitting(false);
    }
  };

  const handleDeleteWithdrawal = async (id) => {
    if (!window.confirm("Delete this processed withdrawal record to free database space?")) return;
    setActingId(id);
    setActionError("");
    try {
      await deleteWithdrawalAdmin(token, id);
      mutate((prev) => prev?.filter((w) => w._id !== id), false);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  const handleBulkCleanup = async () => {
    if (!window.confirm("Delete all processed (approved/rejected) withdrawal records to free database space?")) return;
    setActionError("");
    try {
      const res = await cleanupWithdrawals(token);
      mutate((prev) => prev?.filter((w) => w.status === "pending"), false);
      alert(res.message);
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <div className="row-between" style={{ gap: "10px" }}>
          <h1>Payouts ({withdrawals.length})</h1>
          {withdrawals.some((w) => w.status !== "pending") && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "#ef4444", fontSize: "11px", minHeight: "34px", padding: "0 10px" }}
              onClick={handleBulkCleanup}
            >
              🗑 Cleanup
            </button>
          )}
        </div>
        <span className="admin-page-header__subtitle">Review and process withdrawal payout requests</span>
      </div>

      {error && <p className="notice-banner error">{error}</p>}

      {/* SEARCH + FILTER */}
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search name, phone, UPI..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="admin-filter-chips">
          {[
            { key: "ALL", label: `All (${withdrawals.length})` },
            { key: "PENDING", label: "Pending" },
            { key: "APPROVED", label: "Approved" },
            { key: "REJECTED", label: "Rejected" },
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

      {loading ? (
        <Loading label="Loading withdrawal requests..." />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="💸"
            title="No Withdrawal Requests Found"
            description="No payout requests match your filter criteria."
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: "16px" }}>
          {filtered.map((withdrawal) => {
            const isPending = withdrawal.status === "pending";
            return (
              <div key={withdrawal._id} className="card stack" style={{ padding: "16px", gap: "14px", background: "var(--surface)" }}>
                <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className={`badge ${statusBadge[withdrawal.status] || "badge-neutral"}`}>
                        {withdrawal.status?.toUpperCase()}
                      </span>
                      <strong style={{ fontSize: "20px", color: "var(--primary-strong)" }}>₹{withdrawal.amount}</strong>
                    </div>

                    <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                      User: <strong>{withdrawal.user?.name || "Unknown user"}</strong> ({withdrawal.user?.phone || "—"})
                    </p>
                    <p className="text-faint" style={{ margin: "2px 0 0", fontSize: "11px" }}>
                      Submitted: {new Date(withdrawal.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {isPending ? (
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={actingId === withdrawal._id}
                        onClick={() => handleApprove(withdrawal._id)}
                      >
                        ✓ Approve Payout
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={actingId === withdrawal._id}
                        onClick={() => openRejectModal(withdrawal)}
                      >
                        ✕ Reject & Refund
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "right" }}>
                      <p className="text-faint" style={{ margin: 0, fontSize: "12px" }}>
                        {withdrawal.status === "approved" ? "Processed & Paid" : "Rejected & Refunded"}
                      </p>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ef4444", marginTop: "4px", fontSize: "12px" }}
                        disabled={actingId === withdrawal._id}
                        onClick={() => handleDeleteWithdrawal(withdrawal._id)}
                      >
                        🗑 Delete Log
                      </button>
                    </div>
                  )}
                </div>

                {/* PAYOUT DETAILS BOX */}
                <div style={{ background: "var(--surface-alt)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border)", fontSize: "13px" }}>
                  <p style={{ fontWeight: "bold", margin: "0 0 8px", fontSize: "14px" }}>Payout Destination Details</p>

                  {withdrawal.payoutMethod === "upi" ? (
                    <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <p style={{ margin: "0 0 4px" }}><strong>Payment Method:</strong> UPI Transfer</p>
                        <p style={{ margin: "0 0 4px" }}>
                          <strong>UPI ID:</strong>{" "}
                          <span style={{ fontFamily: "monospace", fontSize: "15px", color: "var(--primary-strong)" }}>
                            {withdrawal.payoutDetails?.upiId}
                          </span>
                        </p>
                      </div>

                      {withdrawal.payoutDetails?.upiId && (
                        <div style={{ background: "#ffffff", padding: "10px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)", textAlign: "center" }}>
                          <QRCodeSVG
                            value={`upi://pay?pa=${withdrawal.payoutDetails.upiId}&pn=${withdrawal.user?.name || "Player"}&am=${withdrawal.amount}&cu=INR`}
                            size={110}
                          />
                          <span style={{ display: "block", fontSize: "10px", color: "#000", marginTop: "4px" }}>Scan to Pay via UPI</span>
                        </div>
                      )}
                    </div>
                  ) : withdrawal.payoutMethod === "bank" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                      <p style={{ margin: 0 }}><strong>Payment Method:</strong> Bank Transfer</p>
                      <p style={{ margin: 0 }}><strong>Account Holder:</strong> {withdrawal.payoutDetails?.accountHolderName}</p>
                      <p style={{ margin: 0 }}><strong>Account Number:</strong> <span style={{ fontFamily: "monospace" }}>{withdrawal.payoutDetails?.accountNumber}</span></p>
                      <p style={{ margin: 0 }}><strong>IFSC Code:</strong> <span style={{ fontFamily: "monospace" }}>{withdrawal.payoutDetails?.ifsc}</span></p>
                    </div>
                  ) : (
                    <p className="text-faint" style={{ margin: 0 }}>No payout details provided</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REJECT MODAL */}
      <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title={`Reject Withdrawal: ₹${rejectItem?.amount}`}>
        <form className="stack" onSubmit={handleRejectSubmit}>
          <p className="text-muted" style={{ fontSize: "13px" }}>
            Rejecting this withdrawal request will refund <strong>₹{rejectItem?.amount}</strong> back into {rejectItem?.user?.name}'s Winning Coins balance.
          </p>
          <div className="field">
            <label htmlFor="w-reject-note">Rejection Reason / Note</label>
            <input
              id="w-reject-note"
              className="input"
              type="text"
              placeholder="e.g. Invalid UPI ID, account name mismatch"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              disabled={rejectSubmitting}
            />
          </div>
          <button type="submit" className="btn btn-danger btn-block" disabled={rejectSubmitting}>
            {rejectSubmitting ? "Rejecting..." : "Confirm Rejection & Refund"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
