import { useState, useEffect } from "react";
import "./InstallBanner.css";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || isDismissed) {
    return null;
  }

  return (
    <div className="install-banner">
      <div className="install-banner__content">
        <div className="install-banner__icon">
          <img src="/header.png" alt="App Icon" />
        </div>
        <div className="install-banner__text">
          <p className="install-banner__title">Install Ludo Chips</p>
          <p className="install-banner__desc">Add to home screen for quick access & better experience!</p>
        </div>
      </div>
      <div className="install-banner__actions">
        <button className="btn btn-outline btn-sm" onClick={() => setIsDismissed(true)}>
          Later
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleInstallClick}>
          Install App
        </button>
      </div>
    </div>
  );
}
