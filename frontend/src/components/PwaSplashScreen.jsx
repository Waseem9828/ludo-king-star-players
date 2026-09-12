import { useState, useEffect } from "react";
import "./PwaSplashScreen.css";

const DEFAULT_LOGO = "/logo.png";

export default function PwaSplashScreen({ onComplete, duration = 2200 }) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Loading...");

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 15) + 8;
        if (next > 40 && next < 85) {
          setStatusMsg("Connecting...");
        } else if (next >= 85) {
          setStatusMsg("Ready!");
        }
        return Math.min(next, 100);
      });
    }, 110);

    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      const unmountTimer = setTimeout(() => {
        setIsFinished(true);
        if (onComplete) onComplete();
      }, 500);
      return () => clearTimeout(unmountTimer);
    }, duration);

    return () => {
      clearInterval(interval);
      clearTimeout(exitTimer);
    };
  }, [duration, onComplete]);

  if (isFinished) return null;

  return (
    <div className={`pwa-splash-overlay ${isExiting ? "splash-exit" : ""}`}>
      {/* Light Background Glow */}
      <div className="pwa-splash-bg-glow" />

      {/* Center Group: Actual Size Logo & App Branding */}
      <div className="pwa-splash-center">
        <div className="pwa-splash-logo-container">
          <img
            src={DEFAULT_LOGO}
            alt="Ludo King Adda Logo"
            className="pwa-splash-logo-actual"
            onError={(e) => {
              e.target.style.display = "none";
            }}
          />
        </div>

        <h1 className="pwa-splash-title">ludo King adda .com</h1>

        {/* Progress Bar & Status */}
        <div className="pwa-splash-progress-group">
          <div className="pwa-splash-progress-track">
            <div
              className="pwa-splash-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="pwa-splash-status-text">{statusMsg}</span>
        </div>
      </div>

      {/* Footer: Developer Credit & Copyright */}
      <div className="pwa-splash-footer">
        <div className="pwa-splash-developer">
          <span>Developed by Waseem Akram (Sadaf Soft Tech)</span>
        </div>
        <div className="pwa-splash-copyright">
          &copy; {new Date().getFullYear()} ludo King adda .com. All Rights Reserved.
        </div>
      </div>
    </div>
  );
}

