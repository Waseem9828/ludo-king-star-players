import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { apiRequest } from "../lib/apiClient.js";
import "./PwaUpdateModal.css";

export default function PwaUpdateModal() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Continuously check for Service Worker update every 3 seconds
        const interval = setInterval(() => {
          r.update().catch(() => {});
        }, 3000);
        return () => clearInterval(interval);
      }
    },
    onRegisterError(error) {
      console.warn("PWA SW registration warning:", error);
    },
  });

  // Secondary Fallback: Polling /api/version every 3 seconds
  useEffect(() => {
    let initialVersion = null;

    const checkVersion = async () => {
      try {
        const data = await apiRequest("/version");
        if (data && data.version) {
          if (!initialVersion) {
            initialVersion = data.version;
            setCurrentVersion(data.version);
          } else if (data.version !== initialVersion) {
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        // Ignore background polling errors
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 3000); // 3-second continuous update check

    return () => clearInterval(interval);
  }, []);

  const showPrompt = needRefresh || updateAvailable;

  if (!showPrompt) return null;

  const handleUpdate = () => {
    if (needRefresh) {
      updateServiceWorker(true);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="pwa-update-overlay">
      <div className="pwa-update-card">
        <div className="pwa-update-badge">🚀 UPDATE AVAILABLE</div>
        <div className="pwa-update-body">
          <h3 className="pwa-update-title">New App Version Ready</h3>
          <p className="pwa-update-desc">
            A new version of <strong>ludo King adda .com</strong> is ready. Update now to access the latest features and improvements.
          </p>
          <button className="pwa-update-btn" onClick={handleUpdate}>
            UPDATE APP NOW
          </button>
        </div>
      </div>
    </div>
  );
}
