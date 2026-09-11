/**
 * Advanced Application Security & Anti-Inspection Guard
 * Protects against developer console inspection, source code viewing,
 * clickjacking (iframe embedding), and console tampering.
 */

export function initSecurityGuard() {
  if (typeof window === "undefined") return;

  // 1. Anti-Clickjacking / Iframe Embedding Prevention
  try {
    if (window.top !== window.self) {
      window.top.location = window.self.location;
    }
  } catch {
    // Ignore cross-origin top access error
  }

  // 2. Disable Context Menu (Right Click Inspect)
  document.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
      return false;
    },
    { capture: true }
  );

  // 3. Block Inspection Keyboard Shortcuts
  document.addEventListener(
    "keydown",
    (e) => {
      const code = e.keyCode || e.which;
      const key = (e.key || "").toLowerCase();

      // F12 key
      if (code === 123 || key === "f12") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      if (ctrlOrCmd) {
        // Ctrl+Shift+I / Cmd+Option+I (Inspect)
        // Ctrl+Shift+J / Cmd+Option+J (Console)
        // Ctrl+Shift+C / Cmd+Option+C (Element Inspector)
        // Ctrl+Shift+K (Firefox Web Console)
        if (shift && (key === "i" || key === "j" || key === "c" || key === "k" || code === 73 || code === 74 || code === 67 || code === 75)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+U (View Source)
        if (key === "u" || code === 85) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl+S (Save Page)
        if (key === "s" || code === 83) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    },
    { capture: true }
  );

  // 4. Protect Images from Dragging
  document.addEventListener(
    "dragstart",
    (e) => {
      if (e.target && e.target.tagName === "IMG") {
        e.preventDefault();
      }
    },
    { capture: true }
  );

  // 5. Production Console Neutralization & Anti-Debugging
  const isDev = Boolean(
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.")
  );

  if (!isDev) {
    const noop = () => {};
    const methods = ["log", "debug", "info", "warn", "error", "table", "dir", "trace"];
    
    methods.forEach((method) => {
      try {
        window.console[method] = noop;
      } catch {
        // ignore
      }
    });

    // Clear console periodically
    setInterval(() => {
      try {
        console.clear();
      } catch {
        // ignore
      }
    }, 2000);
  }
}
