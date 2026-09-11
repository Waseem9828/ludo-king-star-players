import { CloseIcon } from "./Icons.jsx";
import "./Modal.css";

export default function Modal({ isOpen, onClose, title, children, variant = "default" }) {
  if (!isOpen) return null;

  const isBottom = variant === "bottom" || variant === "bottom-sheet";

  return (
    <div className={`modal-backdrop ${isBottom ? "bottom-sheet" : ""}`} onClick={onClose}>
      <div className={`modal-panel ${isBottom ? "bottom-sheet" : ""}`} onClick={(e) => e.stopPropagation()}>
        {isBottom && <div className="bottom-sheet-handle" />}
        {title ? (
          <div className="modal-panel__header">
            <h3>{title}</h3>
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon size={18} />
            </button>
          </div>
        ) : (
          <button 
            className="icon-btn modal-close-btn-no-title" 
            onClick={onClose} 
            aria-label="Close"
          >
            <CloseIcon size={16} />
          </button>
        )}
        <div className="modal-panel__body">{children}</div>
      </div>
    </div>
  );
}
