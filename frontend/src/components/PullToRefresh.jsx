import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import "./PullToRefresh.css";

// Long pull threshold in pixels (requires a deliberate long pull to trigger)
const PULL_THRESHOLD = 140;

export default function PullToRefresh({ children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { refreshWallet, refreshUnreadNotifications } = useAuth();

  const containerRef = useRef(null);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = (e) => {
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull-down if scrolled to top
    if (container.scrollTop > 0) return;

    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    isDraggingRef.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current || isRefreshing) return;
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // Only respond if vertical scroll is dominant and pulling downward
    if (deltaY > 0 && deltaY > Math.abs(deltaX) * 1.2) {
      // Long pull physics: apply resistance curve
      const dampenedPull = Math.min(170, Math.pow(deltaY, 0.85) * 1.8);
      
      // Cancel native pull-to-refresh if pulling our custom indicator
      if (e.cancelable && deltaY > 10) {
        e.preventDefault();
      }

      setPullDistance(dampenedPull);
      setIsPulling(true);
    }
  };

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(70); // Lock loader height while refreshing

      try {
        // 1. Refresh global Auth / Wallet / Notifications
        await Promise.allSettled([
          refreshWallet(),
          refreshUnreadNotifications(),
        ]);

        // 2. Broadcast custom refresh event for active page listeners
        window.dispatchEvent(new CustomEvent("app:refresh"));
        
        // Brief minimum delay so user sees full refresh animation cleanly
        await new Promise((res) => setTimeout(res, 800));
      } catch (err) {
        console.error("Refresh error:", err);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Spring back without refreshing (short pull)
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, refreshWallet, refreshUnreadNotifications]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchEnd]);

  // Calculations for UI states
  const pullProgress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const isReadyToRelease = pullDistance >= PULL_THRESHOLD;

  return (
    <div className="ptr-wrapper" ref={containerRef}>
      {/* Visual Pull Indicator Banner at top of current page */}
      <div 
        className={`ptr-banner ${isRefreshing ? "ptr-banner--refreshing" : ""} ${isPulling ? "ptr-banner--pulling" : ""}`}
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div 
          className="ptr-content"
          style={{
            transform: `scale(${0.6 + pullProgress * 0.4})`,
            opacity: Math.min(1, pullProgress * 1.5),
          }}
        >
          {isRefreshing ? (
            <div className="ptr-loader-box">
              <div className="ptr-spinner" />
              <span className="ptr-text">Refreshing...</span>
            </div>
          ) : (
            <div className="ptr-loader-box">
              <div 
                className={`ptr-icon-ring ${isReadyToRelease ? "ptr-icon-ring--ready" : ""}`}
                style={{ transform: `rotate(${pullProgress * 360}deg)` }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </div>
              <span className="ptr-text">
                {isReadyToRelease ? "Release to refresh" : "Pull down to refresh (long pull)"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Page Body */}
      <div 
        className="ptr-body"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance * 0.3}px)` : "none",
          transition: isPulling ? "none" : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.27)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
