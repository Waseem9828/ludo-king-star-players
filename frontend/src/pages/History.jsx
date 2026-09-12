import { useEffect, useState } from "react";
import useSWR from "swr";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import EmptyState from "../components/EmptyState.jsx";
import Loading from "../components/Loading.jsx";
import { getHistory, getGameHistory } from "../lib/historyApi.js";
import { getWithdrawals } from "../lib/withdrawalApi.js";
import { friendlyError } from "../lib/errors.js";
import "../components/BattleCard.css";
import "./History.css";

const TABS = [
  { key: "game", label: "Game" },
  { key: "withdraw", label: "Withdraw" },
  { key: "deposit", label: "Deposit" },
  { key: "referral", label: "Referral" },
];

const TRANSACTION_LABELS = {
  WALLET_TOPUP: "Deposit Top-Up",
  WELCOME_BONUS: "🎁 Welcome Bonus",
  REFERRAL_BONUS: "👥 Referral Bonus",
  PROMO_BONUS: "🏆 Promo Code Bonus",
  ADMIN_BONUS: "🎁 Admin Bonus / Reward",
  ADMIN_PENALTY: "⚠️ Penalty / Deduction",
  ADMIN_ADJUSTMENT: "🔄 Admin Balance Adjustment",
  MATCH_REFERRAL_COMMISSION: "💸 Match Commission Bonus",
  WITHDRAWAL_REFUND: "↩️ Withdrawal Refund",
  SYSTEM_ERROR_COMPENSATION: "🛠️ System Error Compensation",
  BATTLE_ERROR_REFUND: "↩️ Battle Error Refund",
  MANUAL_DEPOSIT: "💳 Manual Deposit",
  TOURNAMENT_PRIZE: "🏆 Tournament Prize"
};

const GAME_RESULT_BADGE = {
  WIN: "badge-open",
  LOSS: "badge-full",
  PENDING: "badge-pending",
  CANCELLED: "badge-neutral",
  REFUNDED: "badge-neutral",
};

const WITHDRAWAL_STATUS_BADGE = {
  pending: "badge-pending",
  approved: "badge-open",
  rejected: "badge-full",
};

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EmptyTab({ tab }) {
  return (
    <div className="card" style={{ padding: "0" }}>
      <EmptyState type={tab} />
    </div>
  );
}

export default function History() {
  const { token, isAuthenticated, initializing } = useAuth();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.key === requestedTab) ? requestedTab : "game");
  const { data: gamesData, error: gamesError, mutate: mutateGames } = useSWR(isAuthenticated ? "/history/games" : null, () => getGameHistory(token));
  const { data: withdrawData, error: withdrawError, mutate: mutateWithdraw } = useSWR(isAuthenticated ? "/withdrawals" : null, () => getWithdrawals(token));
  const { data: depositData, error: depositError, mutate: mutateDeposit } = useSWR(isAuthenticated ? "/history?category=deposit" : null, () => getHistory(token, "deposit"));
  const { data: referralData, error: referralError, mutate: mutateReferral } = useSWR(isAuthenticated ? "/history?category=referral" : null, () => getHistory(token, "referral"));

  const currentData = tab === "game" ? gamesData : tab === "withdraw" ? withdrawData : tab === "deposit" ? depositData : referralData;
  const currentError = tab === "game" ? gamesError : tab === "withdraw" ? withdrawError : tab === "deposit" ? depositError : referralError;

  let items = [];
  if (Array.isArray(currentData)) {
    items = currentData;
  } else if (currentData && Array.isArray(currentData.items)) {
    items = currentData.items;
  }

  const error = currentError;
  const loading = !currentData && !currentError;

  const load = () => {
    mutateGames();
    mutateWithdraw();
    mutateDeposit();
    mutateReferral();
  };

  useEffect(() => {
    const handleRefresh = () => load();
    window.addEventListener("app:refresh", handleRefresh);
    return () => window.removeEventListener("app:refresh", handleRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (initializing) {
    return <Loading label="Loading..." />;
  }

  

  return (
    <div className="stack" style={{ paddingTop: "8px" }}>
      <div className="card row history__tabs" style={{ padding: "12px", justifyContent: "space-between" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"btn btn-sm " + (tab === t.key ? "btn-primary" : "btn-outline")}
            style={{ flex: 1, minWidth: "22%" }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="notice-banner row-between">
          <span>{friendlyError(error)}</span>
          <button className="btn btn-ghost btn-sm" onClick={load}>
            Retry
          </button>
        </p>
      )}

      {loading ? (
        <Loading label="Loading history..." />
      ) : items.length === 0 ? (
        <EmptyTab tab={tab} />
      ) : tab === "game" ? (
        <div className="stack">
          {items.map((m) => (
            <div key={m.id} className="battle-card-metal" style={{ height: "auto", cursor: "default", display: "flex", flexDirection: "row" }}>
              <div style={{ flex: 1 }}>
                <span className={"badge " + (GAME_RESULT_BADGE[m.result] || "badge-neutral")}>{m.result}</span>
                <p className="history-row__title">
                  Entry {m.entryCoins} · Prize {m.prizeCoins} coins
                </p>
                <p className="text-muted">
                  {m.opponent ? `vs ${m.opponent}` : "Waiting for opponent"} · Room {m.roomCode}
                </p>
              </div>
              <p className="text-faint">{formatDate(m.date)}</p>
            </div>
          ))}
        </div>
      ) : tab === "withdraw" ? (
        <div className="stack">
          {items.map((w) => (
            <div key={w.id} className="battle-card-metal" style={{ height: "auto", cursor: "default", display: "flex", flexDirection: "row" }}>
              <div style={{ flex: 1 }}>
                <span className={"badge " + (WITHDRAWAL_STATUS_BADGE[w.status] || "badge-neutral")}>
                  {w.status.toUpperCase()}
                </span>
                <p className="history-row__title" style={{ fontSize: "16px" }}>{(w.amount || w.coins || 0).toLocaleString()} coins</p>
                <p className="text-muted">
                  {w.payoutMethod === "upi" ? `UPI · ${w.payoutDetails?.upiId}` : "Bank transfer"}
                </p>
              </div>
              <p className="text-faint">{formatDate(w.createdAt)}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="stack">
          {items.map((tx) => {
            const rawAmt = tx.amount || tx.coins || 0;
            const isPositive = rawAmt > 0;
            let noteText = tx.description || tx.note || "";
            noteText = noteText.replace(/IMB payment /gi, "");
            return (
              <div key={tx.id} className="battle-card-metal" style={{ height: "auto", cursor: "default", display: "flex", flexDirection: "row", alignItems: "center" }}>
                <div className="wallet-history__info" style={{ flex: 1 }}>
                  <p className="wallet-history__type">{TRANSACTION_LABELS[tx.type] || tx.type}</p>
                  <p className="text-muted wallet-history__meta">
                    {formatDate(tx.date || tx.createdAt)}
                    {noteText && (
                      <span style={{ display: "block", marginTop: "3px", color: isPositive ? "var(--text-muted)" : "#f87171", fontSize: "12px", fontStyle: "italic" }}>
                        Note: {noteText}
                      </span>
                    )}
                  </p>
                </div>
                <p className="wallet-history__amount" style={{ color: isPositive ? "var(--ludo-green)" : "#ef4444", fontWeight: "bold" }}>
                  {isPositive ? `+${rawAmt.toLocaleString()}` : rawAmt.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
