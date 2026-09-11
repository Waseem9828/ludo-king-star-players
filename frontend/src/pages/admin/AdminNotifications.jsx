import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { broadcastNotification, getBroadcasts, deleteBroadcast } from "../../lib/adminApi.js";

export default function AdminNotifications() {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(true);

  const fetchBroadcasts = async () => {
    try {
      const data = await getBroadcasts(token);
      setBroadcasts(data);
    } catch (err) {
      console.error("Failed to fetch broadcasts:", err);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  useEffect(() => {
    fetchBroadcasts();
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await broadcastNotification(token, { title: trimmedTitle, message: message.trim() });
      setSuccess(`Sent to ${result.sentCount} user(s).`);
      setTitle("");
      setMessage("");
      fetchBroadcasts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (broadcastTitle) => {
    if (!window.confirm(`Are you sure you want to delete all announcements titled "${broadcastTitle}" from all user inboxes?`)) return;
    try {
      await deleteBroadcast(token, broadcastTitle);
      fetchBroadcasts();
    } catch (err) {
      alert("Failed to delete broadcast: " + err.message);
    }
  };

  return (
    <div className="stack">
      <h1>Send Announcement</h1>
      <p className="text-muted">
        Sends a notification to every active user's inbox — use it for maintenance windows, offers or general
        updates.
      </p>

      <form className="card stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="notif-title">Title</label>
          <input
            id="notif-title"
            className="input"
            type="text"
            placeholder="e.g. Scheduled maintenance tonight"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />
        </div>
        <div className="field">
          <label htmlFor="notif-message">Message (optional)</label>
          <textarea
            id="notif-message"
            className="input"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
        </div>
        {error && <p className="notice-banner error">{error}</p>}
        {success && <p className="notice-banner success">{success}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Sending..." : "Send to All Users"}
        </button>
      </form>

      <h2 style={{ marginTop: "2rem" }}>Recent Announcements</h2>
      {loadingBroadcasts ? (
        <p className="text-muted">Loading...</p>
      ) : broadcasts.length === 0 ? (
        <p className="text-muted card text-center">No recent announcements.</p>
      ) : (
        <div className="stack">
          {broadcasts.map((b, idx) => (
            <div key={idx} className="card flex flex-between align-center">
              <div>
                <h3 className="font-bold">{b.title}</h3>
                {b.message && <p className="text-muted text-sm">{b.message}</p>}
                <div className="text-xs text-muted" style={{ marginTop: "0.5rem" }}>
                  Sent to {b.count} user(s) on {new Date(b.createdAt).toLocaleString()}
                </div>
              </div>
              <button 
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(b.title)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
