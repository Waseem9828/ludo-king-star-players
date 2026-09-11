import toast from "react-hot-toast";
import "./PremiumToast.css";

export function PremiumToastCard({ t }) {
  let type = "info";
  let title = "Information";
  let message = "";

  if (t.type === "success") {
    type = "success";
    title = "Success";
  } else if (t.type === "error") {
    type = "error";
    title = "Error";
  } else if (t.type === "loading") {
    type = "info";
    title = "Processing";
  }

  if (typeof t.message === "object" && t.message !== null && !t.message.$$typeof) {
    if (t.message.type) type = t.message.type;
    if (t.message.title) title = t.message.title;
    if (t.message.message) message = t.message.message;
  } else {
    message = String(t.message || "");
  }

  const iconMap = {
    success: "✓",
    error: "×",
    warning: "!",
    info: "i",
  };

  const durationMs = t.duration || (type === "error" ? 6000 : 4000);

  return (
    <div
      className={`toast ${type} ${t.visible ? "" : "hide"}`}
      style={{ pointerEvents: "auto" }}
    >
      <div className="toast-icon">
        <div className="icon-circle">{iconMap[type] || "✓"}</div>
      </div>

      <div className="toast-content">
        <div className="toast-title">{title}</div>
        <div className="toast-message">{message}</div>
      </div>

      <button
        type="button"
        className="toast-close"
        onClick={() => toast.dismiss(t.id)}
        aria-label="Close toast"
      >
        ×
      </button>

      <div
        className="toast-progress"
        style={{ animationDuration: `${durationMs}ms` }}
      />
    </div>
  );
}

export function showToast(type, title, message) {
  return toast.custom(
    (t) => (
      <PremiumToastCard
        t={{
          ...t,
          message: { type, title, message },
        }}
      />
    ),
    { duration: type === "error" ? 6000 : 4000 }
  );
}
