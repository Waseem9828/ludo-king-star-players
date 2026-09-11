import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { processKyc, clearKycImage } from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import { CheckCircleIcon, CrossCircleIcon, ClockIcon } from "../../components/Icons.jsx";

export default function AdminKyc() {
  const { token } = useAuth();
  const { data, error, mutate } = useSWR("/admin/kyc");
  const { data: unsubmittedData } = useSWR("/admin/kyc/unsubmitted");
  const loading = !data && !error;
  const kycList = data || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [actingId, setActingId] = useState(null);
  const [actionError, setActionError] = useState("");

  // Lightbox / Image modal
  const [lightboxImage, setLightboxImage] = useState(null);

  const filtered = kycList.filter((item) => {
    const statusMatch =
      filterStatus === "ALL" ? true : item.status?.toLowerCase() === filterStatus.toLowerCase();

    const text = `${item.user?.name || ""} ${item.user?.phone || ""} ${item.aadhaarNumber || ""}`.toLowerCase();
    const searchMatch = text.includes(searchTerm.toLowerCase().trim());

    return statusMatch && searchMatch;
  });

  const handleClearImage = async (id) => {
    if (!window.confirm("Clear Aadhaar document image to free database storage space?")) return;
    setActingId(id);
    setActionError("");
    try {
      await clearKycImage(token, id);
      mutate(
        kycList.map((k) => (k._id === id ? { ...k, aadhaarImageUrl: "" } : k)),
        { revalidate: false }
      );
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="stack" style={{ gap: "16px" }}>
      <div className="admin-page-header">
        <h1>🧪 KYC Inspector</h1>
        <span className="admin-page-header__subtitle">Inspect and manage Aadhaar KYC verifications</span>
      </div>

      {(error || actionError) && (
        <p className="notice-banner error">{error?.message || actionError}</p>
      )}

      {/* SEARCH + FILTER */}
      <div className="admin-filter-bar">
        <input
          type="text"
          className="input"
          placeholder="Search name, phone, Aadhaar..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="admin-filter-chips">
          {["ALL", "VERIFIED", "NOT SUBMITTED"].map((st) => (
            <button
              key={st}
              className={`admin-filter-chip ${filterStatus === st ? "is-active" : ""}`}
              onClick={() => setFilterStatus(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading label="Loading KYC submissions..." />
      ) : filterStatus === "NOT SUBMITTED" ? (
        <div className="stack" style={{ gap: "14px" }}>
          {(!unsubmittedData || unsubmittedData.length === 0) ? (
             <div className="card">
               <EmptyState icon="🪪" title="All active users have submitted KYC!" description="No unsubmitted records found." />
             </div>
          ) : unsubmittedData.filter(u => `${u.name} ${u.phone}`.toLowerCase().includes(searchTerm.toLowerCase().trim())).map((user) => (
            <div key={user._id} className="card stack" style={{ gap: "14px", padding: "16px", background: "var(--surface)" }}>
              <div className="row-between">
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px" }}>{user.name || "Unknown User"}</h3>
                  <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                    📱 Phone: <strong>{user.phone || "—"}</strong>
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ padding: "3px 10px", borderRadius: "14px", fontSize: "11px", fontWeight: "bold", background: "#6b7280", color: "white" }}>NOT SUBMITTED</span>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Joined: {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="🪪" title="No KYC Records Found" description="No Aadhaar verification records match your filter criteria." />
        </div>
      ) : (
        <div className="stack" style={{ gap: "14px" }}>
          {filtered.map((item) => {
            const isVerified = item.status === "verified";
            const isRejected = item.status === "rejected";
            const isPending = item.status === "pending";

            return (
              <div key={item._id} className="card stack" style={{ gap: "14px", padding: "16px", background: "var(--surface)" }}>
                <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px" }}>{item.user?.name || "Unknown User"}</h3>
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: "14px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          background: isVerified ? "#10b981" : isRejected ? "#ef4444" : "#f59e0b",
                          color: "white",
                        }}
                      >
                        {item.status?.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "13px" }}>
                      📱 Phone: <strong>{item.user?.phone || "—"}</strong>
                    </p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>Submitted</p>
                    <p style={{ margin: "2px 0 0", fontSize: "13px", fontWeight: "600" }}>
                      {new Date(item.submittedAt || item.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* DETAILS BOX */}
                <div
                  style={{
                    background: "var(--surface-alt)",
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "14px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <p className="text-faint" style={{ margin: "0 0 2px" }}>12-Digit Aadhaar Number</p>
                    <p style={{ fontWeight: "bold", fontFamily: "monospace", fontSize: "15px", color: "var(--primary-strong)", margin: 0 }}>
                      {item.aadhaarNumber}
                    </p>
                  </div>

                  <div>
                    <p className="text-faint" style={{ margin: "0 0 2px" }}>Verified Full Name</p>
                    <p style={{ fontWeight: "bold", margin: 0 }}>{item.name || item.user?.name || "—"}</p>
                  </div>

                  {item.dob && (
                    <div>
                      <p className="text-faint" style={{ margin: "0 0 2px" }}>Date of Birth</p>
                      <p style={{ margin: 0, fontWeight: "600" }}>{item.dob}</p>
                    </div>
                  )}

                  {item.gender && (
                    <div>
                      <p className="text-faint" style={{ margin: "0 0 2px" }}>Gender</p>
                      <p style={{ margin: 0, fontWeight: "600" }}>{item.gender}</p>
                    </div>
                  )}

                  {item.careOf && (
                    <div>
                      <p className="text-faint" style={{ margin: "0 0 2px" }}>Care Of (C/O)</p>
                      <p style={{ margin: 0 }}>{item.careOf}</p>
                    </div>
                  )}

                  {item.address && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p className="text-faint" style={{ margin: "0 0 2px" }}>Full Address</p>
                      <p style={{ margin: 0, fontWeight: "500" }}>{item.address} {item.pincode ? `- ${item.pincode}` : ""}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-faint" style={{ margin: "0 0 2px" }}>Verification Note</p>
                    <p style={{ fontStyle: "italic", margin: 0 }}>
                      {item.note || "Auto-verified via Aadhaar Gateway"}
                    </p>
                  </div>

                  {item.reviewedAt && (
                    <div>
                      <p className="text-faint" style={{ margin: "0 0 2px" }}>Reviewed At</p>
                      <p style={{ margin: 0 }}>{new Date(item.reviewedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* DOCUMENT IMAGE PREVIEW */}
                {item.aadhaarImageUrl && (
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                    <div className="row-between" style={{ marginBottom: "8px" }}>
                      <span className="text-muted" style={{ fontSize: "12px", fontWeight: "600" }}>
                        🖼 Aadhaar Document Image
                      </span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: "#ef4444", fontSize: "11px" }}
                        disabled={actingId === item._id}
                        onClick={() => handleClearImage(item._id)}
                      >
                        🧹 Clear Image (Free Storage)
                      </button>
                    </div>
                    <img
                      src={item.aadhaarImageUrl}
                      alt="Aadhaar Document"
                      onClick={() => setLightboxImage(item.aadhaarImageUrl)}
                      style={{
                        maxWidth: "180px",
                        maxHeight: "120px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
        >
          <img
            src={lightboxImage}
            alt="Full view"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0, 0, 0, 0.8)" }}
          />
        </div>
      )}
    </div>
  );
}
