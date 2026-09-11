import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import useSWR from "swr";
import toast from "react-hot-toast";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { apiRequest } from "../../lib/apiClient.js";
import Loading from "../../components/Loading.jsx";
import Modal from "../../components/Modal.jsx";
import "./PracticeLobby.css";

export default function PracticeLobby() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const { data: availableRooms, mutate } = useSWR("/practice/rooms/available");

  const [loading, setLoading] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  const handleQuickPlay = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/practice/quick-play", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.gameId) {
        toast.success("Practice match ready! Entering game...");
        navigate(`/practice/game/${res.gameId}`);
      } else if (res.room) {
        navigate(`/practice/waiting/${res.room._id}`);
      }
    } catch (err) {
      toast.error(err.message || "Failed to start quick play.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrivateRoom = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/practice/rooms/create", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      toast.success(`Private Room Created! Code: ${res.room.code}`);
      navigate(`/practice/waiting/${res.room._id}`);
    } catch (err) {
      toast.error(err.message || "Failed to create room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error("Please enter a room code.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest("/practice/rooms/join", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: JSON.stringify({ code: joinCode.trim() }),
      });

      setIsJoinModalOpen(false);
      if (res.gameId) {
        toast.success("Joined room! Entering game...");
        navigate(`/practice/game/${res.gameId}`);
      } else if (res.room) {
        navigate(`/practice/waiting/${res.room._id}`);
      }
    } catch (err) {
      toast.error(err.message || "Failed to join room.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="practice-lobby-container">
      {/* Header */}
      <div className="practice-lobby-header row-between">
        <Link to="/" className="btn btn-secondary btn-sm">
          ← Back
        </Link>
        <div className="practice-lobby-title-wrap">
          <h1 className="practice-lobby-title">🎮 Practice Mode</h1>
          <p className="practice-lobby-subtitle">
            Play free online matches and practice your Ludo skills.
          </p>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Free Badge Notice */}
      <div className="practice-free-banner">
        <span>✨ 100% Free Online Matches · No Chips / No Wallet Deduction · Unlimited Play</span>
      </div>

      {/* Primary Actions Grid */}
      <div className="practice-actions-grid">
        {/* Quick Play */}
        <div className="practice-action-card quick-play-card" onClick={handleQuickPlay}>
          <div className="action-icon">⚡</div>
          <div className="action-info">
            <h2>Quick Play</h2>
            <p>Auto-match with an available online player or Practice AI instantly.</p>
          </div>
          <button className="btn btn-primary btn-sm action-btn" disabled={loading}>
            {loading ? "Opening Game..." : "Play Now"}
          </button>
        </div>

        {/* Create & Join Private Room on Same Line — 100% Mobile Friendly */}
        <div className="practice-dual-actions-row">
          <div className="practice-dual-card create-room-card" onClick={handleCreatePrivateRoom}>
            <div className="action-icon">🔒</div>
            <div className="action-info">
              <h2>Create Room</h2>
              <p>Challenge a friend</p>
            </div>
            <button className="btn btn-accent btn-sm action-btn" disabled={loading}>
              Create Code
            </button>
          </div>

          <div className="practice-dual-card join-room-card" onClick={() => setIsJoinModalOpen(true)}>
            <div className="action-icon">🔑</div>
            <div className="action-info">
              <h2>Join Room</h2>
              <p>Enter room code</p>
            </div>
            <button className="btn btn-secondary btn-sm action-btn">
              Enter Code
            </button>
          </div>
        </div>
      </div>

      {/* Available Rooms List */}
      <div className="practice-rooms-section">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <h3 className="section-title">Available Practice Rooms</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => mutate()}>
            🔄 Refresh
          </button>
        </div>

        {!availableRooms ? (
          <Loading label="Loading waiting rooms..." />
        ) : availableRooms.length === 0 ? (
          <div className="notice-banner text-center" style={{ padding: 16 }}>
            No waiting practice rooms right now. Click Quick Play to open game instantly!
          </div>
        ) : (
          <div className="practice-rooms-list">
            {availableRooms.map((room) => (
              <div key={room._id} className="practice-room-item row-between">
                <div>
                  <span className="room-code-badge">{room.code}</span>
                  <span className="room-host-name">Host: {room.host?.name || "Player"}</span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    setJoinCode(room.code);
                    setIsJoinModalOpen(true);
                  }}
                >
                  Join Match
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Join Room Code Modal */}
      <Modal isOpen={isJoinModalOpen} onClose={() => setIsJoinModalOpen(false)} title="Join Private Practice Room">
        <form onSubmit={handleJoinRoom} className="stack">
          <div className="field">
            <label>Enter Room Code</label>
            <input
              type="text"
              inputMode="numeric"
              className="input"
              placeholder="e.g. 084912"
              maxLength={6}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={loading}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Joining..." : "Join Practice Match"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
