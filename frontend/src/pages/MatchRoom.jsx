import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import BattleCard from "../components/BattleCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import Modal from "../components/Modal.jsx";
import { PlusIcon } from "../components/Icons.jsx";
import InstallBanner from "../components/InstallBanner.jsx";
import { createBattle, joinBattle, cancelBattle, acceptOpponent, listMyBattles, listOpenBattles } from "../lib/matchApi.js";
import { MATCH_STATUS_META } from "../lib/matchStatus.js";
import { friendlyError } from "../lib/errors.js";
import { apiRequest } from "../lib/apiClient.js";
import { getSocket, subscribeLobbyRoom } from "../lib/socketClient.js";
import toast from "react-hot-toast";
import useSWR, { mutate } from "swr";
import "./MatchRoom.css";

function toBattleCardProps(match, currentUserId) {
  const cId = match.creator?._id ? match.creator._id.toString() : match.creator ? match.creator.toString() : null;
  const oId = match.opponent?._id ? match.opponent._id.toString() : match.opponent ? match.opponent.toString() : null;
  const uId = currentUserId ? currentUserId.toString() : null;

  const isOwn = Boolean(uId && cId === uId);
  const isParticipant = Boolean(uId && (cId === uId || oId === uId));

  return {
    entryFee: match.entryCoins,
    prize: match.prizeCoins,
    players: match.opponent ? 2 : 1,
    maxPlayers: 2,
    status: match.status === "WAITING" ? "open" : match.status === "JOINED" ? "joined" : "live",
    isOwn,
    isParticipant,
    isMock: match._id.toString().startsWith("mock"),
    creatorName: match.creator?.name || "Guest",
    opponentName: match.opponent?.name || null,
  };
}

export default function MatchRoom() {
  const { token, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [dividers, setDividers] = useState({ my: "", open: "", running: "" });

  useEffect(() => {
    apiRequest("/settings")
      .then((data) => {
        if (data) {
          setDividers({
            my: data.myBattlesDividerImage || data.battleDividerImage || "",
            open: data.openBattlesDividerImage || data.battleDividerImage || "",
            running: data.runningBattlesDividerImage || data.battleDividerImage || ""
          });
        }
      })
      .catch(() => {});
  }, []);

  // Real-Time Socket.io lobby synchronization
  useEffect(() => {
    const socket = getSocket();
    subscribeLobbyRoom();

    const handleLobbyUpdate = () => {
      mutate('/matches/open');
      mutate('/matches/running');
      mutate('/matches/mine');
    };

    socket.on("match:created", handleLobbyUpdate);
    socket.on("match:joined", handleLobbyUpdate);
    socket.on("match:updated", handleLobbyUpdate);
    socket.on("match:cancelled", handleLobbyUpdate);

    return () => {
      socket.off("match:created", handleLobbyUpdate);
      socket.off("match:joined", handleLobbyUpdate);
      socket.off("match:updated", handleLobbyUpdate);
      socket.off("match:cancelled", handleLobbyUpdate);
    };
  }, []);

  const { data: fetchedBattles, error: battlesError } = useSWR('/matches/open', { refreshInterval: 3500, revalidateOnFocus: true });
  const loadingOpen = !fetchedBattles && !battlesError;
  const openError = battlesError ? friendlyError(battlesError) : "";

  const { data: fetchedRunning, error: runningError } = useSWR('/matches/running', { refreshInterval: 3500, revalidateOnFocus: true });
  const loadingRunning = !fetchedRunning && !runningError;
  const runError = runningError ? friendlyError(runningError) : "";

  const { data: fetchedMyBattles, error: myBattlesError } = useSWR(isAuthenticated ? '/matches/mine' : null, { refreshInterval: 3500, revalidateOnFocus: true });
  const myLoading = isAuthenticated ? (!fetchedMyBattles && !myBattlesError) : false;
  const myError = myBattlesError ? friendlyError(myBattlesError) : "";

  const [entryCoins, setEntryCoins] = useState("");
  const [creating, setCreating] = useState(false);

  const [mockBattles, setMockBattles] = useState(() => {
    const indianNames = ["Aarav", "Vihaan", "Aditya", "Sai", "Arjun", "Krishna", "Rohan", "Ananya", "Ishita", "Meera", "Saanvi", "Aarti", "Priya", "Rahul", "Karan", "Rohit", "Sneha", "Kavya", "Simran", "Raj", "Vikas", "Suresh", "Amit", "Nisha"];
    return Array.from({ length: 22 }).map((_, i) => {
      const entry = [50, 100, 200, 500, 1000, 2000][i % 6];
      const cName = indianNames[i % indianNames.length];
      const oName = indianNames[(i + 5) % indianNames.length];
      return {
        _id: `mock${i}`,
        entryCoins: entry,
        prizeCoins: entry * 1.9,
        status: "PLAYING",
        opponent: { name: oName },
        creator: { name: cName }
      };
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setMockBattles((prev) => [...prev].sort(() => Math.random() - 0.5));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const myBattles = fetchedMyBattles || [];

  const isMyBattle = (b) => {
    return Boolean(user?.id) && (
      b.creator?._id === user.id || b.creator === user.id ||
      b.opponent?._id === user.id || b.opponent === user.id
    );
  };

  const openBattles = (fetchedBattles || []).filter(b => !isMyBattle(b));
  const ongoingBattles = [...(fetchedRunning || []), ...mockBattles].filter(b => !isMyBattle(b));

  const handleCancel = async (matchId) => {
    if (!window.confirm("Are you sure you want to cancel this battle?")) return;
    try {
      await cancelBattle(token, matchId);
      toast.success("Battle cancelled.");
      mutate('/matches/open');
      mutate('/matches/mine');
    } catch (err) {
      toast.error(friendlyError(err));
    }
  };

  const handleAccept = async (matchId) => {
    try {
      await acceptOpponent(token, matchId);
      toast.success("Opponent accepted!");
      navigate(`/match-room/${matchId}`);
    } catch (err) {
      toast.error(friendlyError(err));
      mutate('/matches/mine');
    }
  };

  const ongoingMyBattle = myBattles.find((b) =>
    ["JOINED", "ACCEPTED", "ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(b.status)
  );

  const handleJoin = async (matchId) => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (ongoingMyBattle) {
      toast.error("Complete active battle first!");
      navigate(`/match-room/${ongoingMyBattle._id}`);
      return;
    }

    try {
      await joinBattle(token, matchId);
      toast.success("Joined battle!");
      navigate(`/match-room/${matchId}`);
    } catch (err) {
      toast.error(friendlyError(err));
      mutate('/matches/open');
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (ongoingMyBattle) {
      toast.error("Complete active battle first!");
      navigate(`/match-room/${ongoingMyBattle._id}`);
      return;
    }

    const amount = Number(entryCoins);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error("Enter valid coin amount.");
      return;
    }

    setCreating(true);
    try {
      const match = await createBattle(token, amount);
      setCreateOpen(false);
      setEntryCoins("");
      toast.success("Battle created! Waiting for opponent...");
      mutate('/matches/open');
      mutate('/matches/mine');
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setCreating(false);
    }
  };

  const playingMyBattle = myBattles.find((b) =>
    ["ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(b.status)
  );

  return (
    <div className="match-room-page">
      {playingMyBattle && (
        <div
          className="notice-banner error row-between"
          style={{ cursor: "pointer", alignItems: "center", borderLeft: "4px solid #ef4444", marginBottom: "8px" }}
          onClick={() => navigate(`/match-room/${playingMyBattle._id}`)}
        >
          <div>
            <strong>⚠️ Battle in Progress!</strong>
            <p style={{ margin: "2px 0 0", fontSize: "12px" }}>
              You have a running battle. Declare your result (I Won / I Lost) to create or join new battles.
            </p>
          </div>
          <button className="btn btn-sm btn-primary" style={{ whiteSpace: "nowrap", marginLeft: "8px" }}>
            Go to Battle →
          </button>
        </div>
      )}

      <form className="match-room-create-form" onSubmit={handleCreateSubmit}>
        <input
          className="match-room-create-input"
          type="number"
          min="50"
          step="10"
          placeholder="Enter Amount"
          value={entryCoins}
          onChange={(e) => setEntryCoins(e.target.value)}
        />
        <button
          type="submit"
          className="btn-create-battle"
          disabled={creating}
        >
          {creating ? "..." : "Set"}
        </button>
      </form>

      <InstallBanner />

      {/* 1. My Active Battles Section */}
      {myError && <p className="notice-banner">{myError}</p>}
      {!myLoading && !myError && (() => {
        const activeMyBattles = myBattles.filter((b) =>
          ["WAITING", "JOINED", "ACCEPTED", "ROOM_SHARED", "PLAYING", "RESULT_SUBMITTED", "DISPUTED"].includes(b.status)
        );
        if (activeMyBattles.length === 0) return null;
        return (
          <div className="match-section-list">
            {dividers.my && <img src={dividers.my} alt="My Battles" className="room-divider-img" />}
            {activeMyBattles.map((match) => (
              <BattleCard
                key={match._id}
                {...toBattleCardProps(match, user?.id)}
                onJoin={() => handleJoin(match._id)}
                onCancel={() => handleCancel(match._id)}
                onAccept={() => handleAccept(match._id)}
                onView={() => navigate(`/match-room/${match._id}`)}
              />
            ))}
          </div>
        );
      })()}

      {/* 2. Open Battles Section */}
      {openError && <p className="notice-banner">{openError}</p>}
      {!loadingOpen && !openError && openBattles.length > 0 && (
        <div className="match-section-list">
          {dividers.open && <img src={dividers.open} alt="Open Battles" className="room-divider-img" />}
          {openBattles.map((battle) => (
            <BattleCard
              key={battle._id}
              {...toBattleCardProps(battle, user?.id)}
              onJoin={() => handleJoin(battle._id)}
              onCancel={() => handleCancel(battle._id)}
              onView={() => navigate(`/match-room/${battle._id}`)}
            />
          ))}
        </div>
      )}

      {/* 3. Ongoing Battles Section */}
      {runError && <p className="notice-banner">{runError}</p>}
      {!loadingRunning && !runError && ongoingBattles.length > 0 && (
        <div className="match-section-list">
          {dividers.running && <img src={dividers.running} alt="Ongoing Battles" className="room-divider-img" />}
          {ongoingBattles.map((battle) => (
            <BattleCard
              key={battle._id}
              {...toBattleCardProps(battle, user?.id)}
              onJoin={() => handleJoin(battle._id)}
              onCancel={() => handleCancel(battle._id)}
              onView={() => navigate(`/match-room/${battle._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
