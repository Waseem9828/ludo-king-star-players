import { useState } from "react";
import useSWR from "swr";
import { useAuth } from "../../contexts/AuthContext.jsx";
import {
  createBanner,
  updateBanner,
  deleteBanner,
  createNotice,
  updateNotice,
  deleteNotice,
  runAdvancedStorageCleanup,
} from "../../lib/adminApi.js";
import Loading from "../../components/Loading.jsx";
import EmptyState from "../../components/EmptyState.jsx";
import Modal from "../../components/Modal.jsx";
import { PlusIcon, TrashIcon, CheckCircleIcon, CrossCircleIcon } from "../../components/Icons.jsx";
import toast from "react-hot-toast";

export default function AdminDigitalManagement() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("banners");

  // Banners state
  const { data: banners, error: bannerErr, mutate: mutateBanners } = useSWR("/admin/banners");
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerLinkUrl, setBannerLinkUrl] = useState("");
  const [bannerOrder, setBannerOrder] = useState("0");
  const [bannerSubmitting, setBannerSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState("");

  // Notices state
  const { data: notices, error: noticeErr, mutate: mutateNotices } = useSWR("/admin/notices");
  const [noticeModalOpen, setNoticeModalOpen] = useState(false);
  const [noticeText, setNoticeText] = useState("");
  const [noticeDateTag, setNoticeDateTag] = useState("");
  const [noticeOrder, setNoticeOrder] = useState("0");
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeError, setNoticeError] = useState("");

  // Storage state
  const { data: storageStats, error: storageErr, mutate: mutateStorage } = useSWR("/admin/storage/stats");
  const [selectedCategory, setSelectedCategory] = useState("MATCH_SCREENSHOTS");
  const [selectedTimeRange, setSelectedTimeRange] = useState("30"); // default 30 days
  const [cleanupSubmitting, setCleanupSubmitting] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState("");

  // --- BANNERS ACTIONS ---
  const handleCreateBanner = async (e) => {
    e.preventDefault();
    setBannerError("");
    if (!bannerTitle.trim() || !bannerImageUrl.trim()) {
      setBannerError("Title and Image URL are required.");
      return;
    }
    setBannerSubmitting(true);
    try {
      const created = await createBanner(token, {
        title: bannerTitle.trim(),
        imageUrl: bannerImageUrl.trim(),
        linkUrl: bannerLinkUrl.trim(),
        order: Number(bannerOrder) || 0,
      });
      mutateBanners([...(banners || []), created], { revalidate: false });
      setBannerModalOpen(false);
      setBannerTitle("");
      setBannerImageUrl("");
      setBannerLinkUrl("");
      setBannerOrder("0");
      toast.success("Banner created successfully!");
    } catch (err) {
      setBannerError(err.message);
    } finally {
      setBannerSubmitting(false);
    }
  };

  const handleToggleBannerActive = async (banner) => {
    try {
      const updated = await updateBanner(token, banner._id, { isActive: !banner.isActive });
      mutateBanners(
        (banners || []).map((b) => (b._id === updated._id ? updated : b)),
        { revalidate: false }
      );
    } catch (err) {
      toast.error("Failed to update banner: " + err.message);
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm("Are you sure you want to delete this banner?")) return;
    try {
      await deleteBanner(token, id);
      mutateBanners((banners || []).filter((b) => b._id !== id), { revalidate: false });
      toast.success("Banner deleted.");
    } catch (err) {
      toast.error("Failed to delete banner: " + err.message);
    }
  };

  // --- NOTICES ACTIONS ---
  const handleCreateNotice = async (e) => {
    e.preventDefault();
    setNoticeError("");
    if (!noticeText.trim()) {
      setNoticeError("Notice text is required.");
      return;
    }
    setNoticeSubmitting(true);
    try {
      const created = await createNotice(token, {
        text: noticeText.trim(),
        dateTag: noticeDateTag.trim(),
        order: Number(noticeOrder) || 0,
      });
      mutateNotices([...(notices || []), created], { revalidate: false });
      setNoticeModalOpen(false);
      setNoticeText("");
      setNoticeDateTag("");
      setNoticeOrder("0");
      toast.success("Notice created!");
    } catch (err) {
      setNoticeError(err.message);
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleToggleNoticeActive = async (notice) => {
    try {
      const updated = await updateNotice(token, notice._id, { isActive: !notice.isActive });
      mutateNotices(
        (notices || []).map((n) => (n._id === updated._id ? updated : n)),
        { revalidate: false }
      );
    } catch (err) {
      toast.error("Failed to update notice: " + err.message);
    }
  };

  const handleDeleteNotice = async (id) => {
    if (!window.confirm("Delete this notice bulletin?")) return;
    try {
      await deleteNotice(token, id);
      mutateNotices((notices || []).filter((n) => n._id !== id), { revalidate: false });
      toast.success("Notice deleted.");
    } catch (err) {
      toast.error("Failed to delete notice: " + err.message);
    }
  };

  // --- ADVANCED STORAGE CLEANUP ACTION ---
  const handleExecuteAdvancedCleanup = async () => {
    const timeLabel = selectedTimeRange === "0" ? "ALL HISTORICAL RECORDS (Complete Wipe)" : `older than ${selectedTimeRange} days`;
    if (!window.confirm(`⚠️ CONFIRM STORAGE PURGE:\nAre you sure you want to clean up category [${selectedCategory}] for records ${timeLabel}?`)) {
      return;
    }

    setCleanupSubmitting(true);
    setCleanupMsg("");
    try {
      const res = await runAdvancedStorageCleanup(token, {
        category: selectedCategory,
        timeRangeDays: Number(selectedTimeRange),
      });
      setCleanupMsg(res.message);
      toast.success(res.message);
      mutateStorage();
    } catch (err) {
      setCleanupMsg("Error: " + err.message);
      toast.error("Cleanup failed: " + err.message);
    } finally {
      setCleanupSubmitting(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "20px" }}>
      <div>
        <h1>Digital Asset & Storage Suite</h1>
        <p className="text-muted" style={{ margin: "2px 0 0" }}>
          Manage homepage banners, notice bulletins, and run multi-category database storage purges
        </p>
      </div>

      {/* NAVIGATION TABS */}
      <div className="admin-tabs" style={{ flexWrap: "wrap" }}>
        <button
          className={`admin-tabs__link ${activeTab === "banners" ? "is-active" : ""}`}
          onClick={() => setActiveTab("banners")}
        >
          🖼 Homepage Banners ({banners?.length || 0})
        </button>
        <button
          className={`admin-tabs__link ${activeTab === "notices" ? "is-active" : ""}`}
          onClick={() => setActiveTab("notices")}
        >
          📢 Notice Bulletins ({notices?.length || 0})
        </button>
        <button
          className={`admin-tabs__link ${activeTab === "storage" ? "is-active" : ""}`}
          onClick={() => setActiveTab("storage")}
        >
          🧹 Advanced Storage Purge
        </button>
      </div>

      {/* TAB 1: HOMEPAGE BANNERS */}
      {activeTab === "banners" && (
        <div className="stack" style={{ gap: "16px" }}>
          <div className="row-between">
            <h3>Homepage Slider Banners</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setBannerModalOpen(true)}>
              <PlusIcon size={16} /> Add New Banner
            </button>
          </div>

          {bannerErr && <p className="notice-banner">{bannerErr.message}</p>}

          {!banners ? (
            <Loading label="Loading banners..." />
          ) : banners.length === 0 ? (
            <div className="card">
              <EmptyState icon="🖼" title="No Banners Yet" description="Add promotional banners to showcase on the home screen." />
            </div>
          ) : (
            <div className="stack" style={{ gap: "14px" }}>
              {banners.map((b) => (
                <div key={b._id} className="card stack" style={{ padding: "16px" }}>
                  <div className="row-between" style={{ flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                      <img
                        src={b.imageUrl}
                        alt={b.title}
                        style={{
                          maxWidth: "160px",
                          maxHeight: "90px",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                          background: "var(--surface-alt)",
                        }}
                      />
                      <div>
                        <h4 style={{ margin: 0 }}>{b.title}</h4>
                        <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                          Link: {b.linkUrl || "None"} · Display Order: {b.order}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        className={`btn btn-sm ${b.isActive ? "btn-outline" : "btn-primary"}`}
                        onClick={() => handleToggleBannerActive(b)}
                      >
                        {b.isActive ? <CrossCircleIcon size={14} /> : <CheckCircleIcon size={14} />}
                        {b.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBanner(b._id)}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ANIMATED NOTICES */}
      {activeTab === "notices" && (
        <div className="stack" style={{ gap: "16px" }}>
          <div className="row-between">
            <h3>📢 Notice Bulletins</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setNoticeModalOpen(true)}>
              <PlusIcon size={16} /> Add Notice
            </button>
          </div>

          {noticeErr && <p className="notice-banner">{noticeErr.message}</p>}

          {!notices ? (
            <Loading label="Loading notice bulletins..." />
          ) : notices.length === 0 ? (
            <div className="card">
              <EmptyState icon="📢" title="No Notices Configured" description="Create notice bulletins to feature on the homepage ticker." />
            </div>
          ) : (
            <div className="stack" style={{ gap: "14px" }}>
              {notices.map((n) => (
                <div key={n._id} className="card stack" style={{ padding: "16px" }}>
                  <div className="row-between" style={{ flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: "700", fontSize: "15px", color: "#f8fafc" }}>{n.text}</span>
                        {n.dateTag && (
                          <span style={{ fontSize: "11px", background: "#6366f1", color: "#ffffff", padding: "2px 8px", borderRadius: "10px", fontWeight: "bold" }}>
                            📅 {n.dateTag}
                          </span>
                        )}
                      </div>
                      <p className="text-muted" style={{ margin: "4px 0 0", fontSize: "12px" }}>
                        Order: {n.order} · Status: {n.isActive ? "Active" : "Disabled"}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button
                        className={`btn btn-sm ${n.isActive ? "btn-outline" : "btn-primary"}`}
                        onClick={() => handleToggleNoticeActive(n)}
                      >
                        {n.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteNotice(n._id)}>
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADVANCED STORAGE & DATABASE CLEANUP */}
      {activeTab === "storage" && (
        <div className="stack" style={{ gap: "20px" }}>
          <div>
            <h3>Advanced Database & Storage Cleanup System</h3>
            <p className="text-muted" style={{ fontSize: "13px", margin: "2px 0 0" }}>
              Purge temporary screenshot assets, old transaction logs, and system data by specific category and time duration.
            </p>
          </div>

          {storageErr && <p className="notice-banner">{storageErr.message}</p>}

          {/* STORAGE METRICS GRID */}
          {!storageStats ? (
            <Loading label="Analyzing database storage usage..." />
          ) : (
            <div className="admin-stats-grid">
              <div className="stat-card" style={{ borderTop: "3px solid #6366f1" }}>
                <p className="stat-label">Match Screenshots</p>
                <p className="stat-value" style={{ color: "#6366f1", fontSize: "22px" }}>
                  {storageStats.matchesWithProofCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>Finished Proof Images</span>
              </div>

              <div className="stat-card" style={{ borderTop: "3px solid #38bdf8" }}>
                <p className="stat-label">KYC Documents</p>
                <p className="stat-value" style={{ color: "#38bdf8", fontSize: "22px" }}>
                  {storageStats.kycWithImageCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>Verified Aadhaar Base64</span>
              </div>

              <div className="stat-card" style={{ borderTop: "3px solid #10b981" }}>
                <p className="stat-label">Payment Gateway Logs</p>
                <p className="stat-value" style={{ color: "#10b981", fontSize: "22px" }}>
                  {storageStats.processedDepositsCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>Completed Deposit Orders</span>
              </div>

              <div className="stat-card" style={{ borderTop: "3px solid #f59e0b" }}>
                <p className="stat-label">Withdrawal Payout Logs</p>
                <p className="stat-value" style={{ color: "#f59e0b", fontSize: "22px" }}>
                  {storageStats.processedWithdrawalsCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>Processed Withdrawals</span>
              </div>

              <div className="stat-card" style={{ borderTop: "3px solid #ec4899" }}>
                <p className="stat-label">System Notifications</p>
                <p className="stat-value" style={{ color: "#ec4899", fontSize: "22px" }}>
                  {storageStats.notificationsCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>User Notification Logs</span>
              </div>

              <div className="stat-card" style={{ borderTop: "3px solid #a855f7" }}>
                <p className="stat-label">OTP Log Records</p>
                <p className="stat-value" style={{ color: "#a855f7", fontSize: "22px" }}>
                  {storageStats.otpLogsCount || 0}
                </p>
                <span className="text-faint" style={{ fontSize: "11px" }}>Expired SMS Verification Logs</span>
              </div>
            </div>
          )}

          {/* CLEANUP CONTROL CENTER */}
          <div className="card stack" style={{ padding: "20px", gap: "16px", background: "var(--surface)" }}>
            <h4 style={{ margin: 0 }}>⚙️ Configure Category & Time Filter Purge</h4>

            <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              {/* CATEGORY SELECTOR */}
              <div className="field">
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>1. Select Asset / Data Category</label>
                <select
                  className="input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ fontWeight: "600" }}
                >
                  <option value="MATCH_SCREENSHOTS">📸 Finished Match Result Screenshots</option>
                  <option value="KYC_DOCUMENTS">🪪 Verified Aadhaar KYC Document Images</option>
                  <option value="PAYMENT_LOGS">💳 Automatic Payment Gateway Orders</option>
                  <option value="WITHDRAWAL_LOGS">💸 Processed Withdrawal Request Records</option>
                  <option value="NOTIFICATION_LOGS">💬 System Notifications & Audit Logs</option>
                  <option value="OTP_LOGS">🤝 Expired Registration / Login OTP Logs</option>
                  <option value="TRANSACTION_LOGS">🪙 Wallet Transaction Logs (Bullet History)</option>
                  <option value="ALL">⚡ ALL CATEGORIES (Full Storage Cleanup)</option>
                </select>
              </div>

              {/* TIME RANGE SELECTOR */}
              <div className="field">
                <label style={{ fontSize: "12px", fontWeight: "bold" }}>2. Select Time Duration Filter</label>
                <select
                  className="input"
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  style={{ fontWeight: "600" }}
                >
                  <option value="7">📅 Older than 7 Days (Last 1 Week)</option>
                  <option value="30">📅 Older than 30 Days (Last 1 Month)</option>
                  <option value="90">📅 Older than 90 Days (Last 3 Months)</option>
                  <option value="180">📅 Older than 180 Days (Last 6 Months)</option>
                  <option value="0">💥 ALL HISTORICAL RECORDS (Complete Wipe)</option>
                </select>
              </div>
            </div>

            {cleanupMsg && (
              <div
                style={{
                  background: cleanupMsg.startsWith("Error") ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                  border: cleanupMsg.startsWith("Error") ? "1px solid #ef4444" : "1px solid #10b981",
                  color: cleanupMsg.startsWith("Error") ? "#ef4444" : "#10b981",
                  padding: "12px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: "600",
                }}
              >
                {cleanupMsg}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                className="btn btn-danger"
                style={{ padding: "10px 20px", fontWeight: "bold" }}
                disabled={cleanupSubmitting}
                onClick={handleExecuteAdvancedCleanup}
              >
                {cleanupSubmitting ? "Purging Storage Data..." : "🧹 Execute Storage Purge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE BANNER MODAL */}
      <Modal isOpen={bannerModalOpen} onClose={() => setBannerModalOpen(false)} title="Create Homepage Banner">
        <form className="stack" onSubmit={handleCreateBanner}>
          <div className="field">
            <label>Banner Title</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. Play & Win Big Daily"
              value={bannerTitle}
              onChange={(e) => setBannerTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Banner Image URL</label>
            <input
              className="input"
              type="text"
              placeholder="https://... or /image.png"
              value={bannerImageUrl}
              onChange={(e) => setBannerImageUrl(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Link Target URL (Optional)</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. /wallet or /match-room"
              value={bannerLinkUrl}
              onChange={(e) => setBannerLinkUrl(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Display Order Priority</label>
            <input
              className="input"
              type="number"
              value={bannerOrder}
              onChange={(e) => setBannerOrder(e.target.value)}
            />
          </div>

          {bannerError && <p className="notice-banner">{bannerError}</p>}

          <button className="btn btn-primary" type="submit" disabled={bannerSubmitting}>
            {bannerSubmitting ? "Creating Banner..." : "Create Banner"}
          </button>
        </form>
      </Modal>

      {/* CREATE NOTICE MODAL */}
      <Modal isOpen={noticeModalOpen} onClose={() => setNoticeModalOpen(false)} title="Create Notice Bulletin">
        <form className="stack" onSubmit={handleCreateNotice}>
          <div className="field">
            <label>Notice Announcement Text</label>
            <textarea
              className="input"
              rows={3}
              placeholder="e.g. Special weekend tournament live! Deposit bonus active."
              value={noticeText}
              onChange={(e) => setNoticeText(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Date Tag Badge (Optional)</label>
            <input
              className="input"
              type="text"
              placeholder="e.g. 30 Aug 2026 or Today"
              value={noticeDateTag}
              onChange={(e) => setNoticeDateTag(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Display Order Priority</label>
            <input
              className="input"
              type="number"
              value={noticeOrder}
              onChange={(e) => setNoticeOrder(e.target.value)}
            />
          </div>

          {noticeError && <p className="notice-banner">{noticeError}</p>}

          <button className="btn btn-primary" type="submit" disabled={noticeSubmitting}>
            {noticeSubmitting ? "Creating Notice..." : "Create Notice"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
