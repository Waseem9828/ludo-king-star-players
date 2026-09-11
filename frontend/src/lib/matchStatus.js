// Shared display labels for backend Match statuses (OPEN/FULL/RUNNING/COMPLETED/CANCELLED).
export const MATCH_STATUS_META = {
  WAITING: { label: "Waiting for opponent", badge: "badge-pending" },
  JOINED: { label: "Opponent joined", badge: "badge-open" },
  ACCEPTED: { label: "Accepted", badge: "badge-pending" },
  ROOM_SHARED: { label: "Playing", badge: "badge-pending" },
  PLAYING: { label: "Playing", badge: "badge-pending" },
  RESULT_SUBMITTED: { label: "Result Submitted", badge: "badge-pending" },
  COMPLETED: { label: "Completed", badge: "badge-neutral" },
  DISPUTED: { label: "Disputed", badge: "badge-full" },
  CANCELLED: { label: "Cancelled", badge: "badge-full" },
  REFUNDED: { label: "Refunded", badge: "badge-full" },
  SETTLED: { label: "Settled", badge: "badge-neutral" },
};
