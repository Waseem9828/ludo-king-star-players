import { useState } from "react";
import useSWR from "swr";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import { getNotifications, markAllNotificationsRead, markNotificationRead, deleteNotification } from "../lib/notificationApi.js";
import { friendlyError } from "../lib/errors.js";
import "./Notifications.css";

const TYPE_ICON = {
  DEPOSIT_APPROVED: "💰",
  DEPOSIT_REJECTED: "⚠️",
  WITHDRAWAL_APPROVED: "🏧",
  WITHDRAWAL_REJECTED: "⚠️",
  MATCH_WON: "🏆",
  MATCH_LOST: "🎲",
  REFERRAL_BONUS: "🎁",
  ANNOUNCEMENT: "📢",
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Notifications() {
  const { token, isAuthenticated, initializing, refreshUnreadNotifications } = useAuth();
  const navigate = useNavigate();

  const { data, error: swrError, mutate } = useSWR(isAuthenticated ? "/notifications" : null);
  const loading = !data && !swrError;
  const error = swrError ? friendlyError(swrError) : "";
  const items = data || [];

  const [markingAll, setMarkingAll] = useState(false);

  if (initializing) {
    return <Loading label="Loading..." />;
  }

  

  const unreadCount = items.filter((n) => !n.isRead).length;

  const handleClick = async (notification) => {
    if (notification.isRead) return;
    mutate((prev) => prev?.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)), false);
    try {
      await markNotificationRead(token, notification._id);
      refreshUnreadNotifications();
      mutate();
    } catch {
      // Non-critical — a failed read-mark just means it stays bold; no need
      // to surface an error banner for this.
      mutate();
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    mutate((prev) => prev?.map((n) => ({ ...n, isRead: true })), false);
    try {
      await markAllNotificationsRead(token);
      refreshUnreadNotifications();
      mutate();
    } catch (err) {
      // handled by global swr error or could set local error if we want
      mutate();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async (notification) => {
    if (!window.confirm("Delete this notification?")) return;
    
    mutate((prev) => prev?.filter((n) => n._id !== notification._id), false);
    
    try {
      await deleteNotification(token, notification._id);
      refreshUnreadNotifications();
      mutate();
    } catch {
      mutate();
    }
  };

  return (
    <div className="stack">
      <div className="row-between">
        <h1>Notifications</h1>
        {unreadCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={handleMarkAll} disabled={markingAll}>
            {markingAll ? "Marking..." : "Mark all read"}
          </button>
        )}
      </div>

      {error && (
        <p className="notice-banner row-between">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => mutate()}>
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <Loading label="Loading notifications..." />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🔔"
            title="No notifications yet"
            description="Deposit, withdrawal and battle updates will show up here."
          />
        </div>
      ) : (
        <div className="card list-card notif-list">
          {items.map((n) => (
            <div
              key={n._id}
              className={"notif-list__item" + (n.isRead ? "" : " notif-list__item--unread")}
              style={{ display: "flex", alignItems: "center", paddingRight: "8px" }}
            >
              <div 
                style={{ flex: 1, display: "flex", alignItems: "center", cursor: "pointer", minWidth: 0 }}
                onClick={() => handleClick(n)}
              >
                <span className="notif-list__icon">{TYPE_ICON[n.type] || "🔔"}</span>
                <span className="notif-list__body">
                  <span className="notif-list__title">{n.title}</span>
                  {n.message && <span className="text-muted notif-list__message">{n.message}</span>}
                  <span className="text-faint notif-list__date">{formatDate(n.createdAt)}</span>
                </span>
                {!n.isRead && <span className="notif-list__dot" />}
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ color: "#ef4444", padding: "8px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(n);
                }}
                title="Delete Notification"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
