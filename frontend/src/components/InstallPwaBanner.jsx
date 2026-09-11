import { useState, useEffect } from "react";
import "./InstallPwaBanner.css";

export default function InstallPwaBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  if (isInstalled || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="pwa-install-banner">
      <div className="pwa-install-banner__content">
        <div className="pwa-install-banner__icon-wrap">
          <img src="/header.png" alt="App Logo" className="pwa-install-banner__icon" />
        </div>
        <div className="pwa-install-banner__text">
          <div className="pwa-install-banner__title">Install ludo King adda .com</div>
          <div className="pwa-install-banner__subtitle">Play faster, anywhere.</div>
        </div>
      </div>
      <div className="pwa-install-banner__actions">
        <button className="btn btn-sm" onClick={handleDismiss} style={{ background: "transparent", color: "#666", border: "1px solid #ddd" }}>
          Later
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>
          Install App
        </button>
      </div>
    </div>
  );
}
