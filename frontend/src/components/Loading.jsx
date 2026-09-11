import { DiceIcon } from "./Icons.jsx";
import "./Loading.css";

export default function Loading({ label = "Loading...", fullPage = false }) {
  return (
    <div className={fullPage ? "loading loading--full" : "loading"}>
      <div className="loading__container">
        <div className="loading__ring-outer" />
        <div className="loading__ring-inner" />
        <div className="loading__icon">
          <DiceIcon size={24} />
        </div>
      </div>
      {label && <span className="loading__label">{label}</span>}
    </div>
  );
}
