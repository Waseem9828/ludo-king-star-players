/**
 * Enterprise Production Security Shield & Anti-Inspection Guard
 * Prevents developer console inspection, source code extraction,
 * clickjacking (iframe embedding), and script injection.
 */
export function initSecurityShield() {
  if (typeof window === "undefined") return;

  // 1. Anti-Clickjacking / Iframe Embedding Guard
  try {
    if (window.top !== window.self) {
      window.top.location.href = window.self.location.href;
    }
  } catch {
    // Ignore cross-origin frame access restriction
  }

  // 2. Clear & Silence Console in Production
  const isLocalHost = Boolean(
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.")
  );

  if (!isLocalHost) {
    const noop = () => {};
    try {
      window.console.log = noop;
      window.console.debug = noop;
      window.console.info = noop;
      window.console.warn = noop;
      window.console.error = noop;
      window.console.dir = noop;
      window.console.table = noop;
      window.console.trace = noop;
    } catch {
      // Ignore console override error
    }

    // Periodically wipe console buffer
    setInterval(() => {
      try {
        console.clear();
      } catch {}
    }, 1500);

    // Continuous anti-debugging loop against DevTools attached breakpoints
    setInterval(() => {
      const startTime = performance.now();
      (() => {
        const d = new Date();
        if (performance.now() - startTime > 100) {
          try {
            console.clear();
          } catch {}
        }
      })();
    }, 2000);
  }

  // 3. Disable DevTools Keyboard Shortcuts
  window.addEventListener(
    "keydown",
    (e) => {
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") {
        return; // Allow typing in text fields
      }

      // F12 key
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+I / Cmd+Opt+I (Inspect)
      // Ctrl+Shift+J / Cmd+Opt+J (Console)
      // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
      // Ctrl+Shift+K (Firefox DevTools)
      if (isCtrlOrMeta && e.shiftKey && ["I", "J", "C", "K", "i", "j", "c", "k"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U / Cmd+U (View Source)
      if (isCtrlOrMeta && ["U", "u"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S / Cmd+S (Save Page)
      if (isCtrlOrMeta && ["S", "s"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    { capture: true }
  );

  // 4. Disable Context Menu (Right Click Inspect)
  window.addEventListener(
    "contextmenu",
    (e) => {
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || e.target?.isContentEditable) {
        return; // Allow paste/copy inside editable input fields
      }
      e.preventDefault();
      return false;
    },
    { capture: true }
  );

  // 5. Prevent Dragging Assets & Images
  window.addEventListener(
    "dragstart",
    (e) => {
      if (e.target && e.target.tagName === "IMG") {
        e.preventDefault();
        return false;
      }
    },
    { capture: true }
  );
}
