import { useState, useEffect } from "react";
import "./PwaSplashScreen.css";

const DEFAULT_LOGO = "/logo.png";

export default function PwaSplashScreen({ onComplete, duration = 2400 }) {
  const [progress, setProgress] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Initializing Engine...");

  useEffect(() => {
    // Progress fill sequence over ~2.2 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        const next = prev + Math.floor(Math.random() * 12) + 5;
        if (next > 40 && next < 70) {
          setStatusMsg("Connecting to Secure Server...");
        } else if (next >= 70 && next < 95) {
          setStatusMsg("Loading Player Profile...");
        } else if (next >= 95) {
          setStatusMsg("Welcome Player! Ready to Play...");
        }
        return Math.min(next, 100);
      });
    }, 120);

    // Trigger smooth exit transition when duration completes
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      const unmountTimer = setTimeout(() => {
        setIsFinished(true);
        if (onComplete) onComplete();
      }, 600); // 600ms match with CSS transition duration
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

      {/* Header Tag */}
      <div className="pwa-splash-header">
        <span className="pwa-splash-header-dot" />
        <span>Official PWA App</span>
      </div>

      {/* Center Group: App Logo & Welcome Message */}
      <div className="pwa-splash-center">
        {/* Animated Logo Frame */}
        <div className="pwa-splash-logo-wrapper">
          <div className="pwa-splash-logo-ring" />
          <div className="pwa-splash-logo-box">
            <img
              src={DEFAULT_LOGO}
              alt="Ludo King Adda Logo"
              className="pwa-splash-logo-img"
              onError={(e) => {
                // Fallback to SVG Ludo Icon if PNG fails
                e.target.style.display = "none";
              }}
            />
          </div>
        </div>

        {/* Welcome Message */}
        <h1 className="pwa-splash-title">Welcome to ludo King adda .com</h1>
        <p className="pwa-splash-subtitle">✨ 1v1 Real Cash Ludo Battles & Instant Withdrawals</p>

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

      {/* Footer: Developer Credit & Copyright (Exact Homepage Copy) */}
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
