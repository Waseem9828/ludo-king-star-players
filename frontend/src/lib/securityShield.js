/**
 * Production Security Shield & Anti-Inspection Guard
 * Protects users from Self-XSS, malicious devtools scripts, and inspect element tampering.
 */
export function initSecurityShield() {
  const isProduction = import.meta.env.PROD || process.env.NODE_ENV === "production";

  // 1. Prominent DevTools Self-XSS / Scam Warning
  try {
    console.log(
      "%cSTOP!",
      "color: #dc2626; font-family: system-ui, -apple-system, sans-serif; font-size: 56px; font-weight: 900; text-shadow: 2px 2px 0px black;"
    );
    console.log(
      "%cThis is a browser feature intended only for developers.\nIf someone told you to copy and paste code here to get free coins or hack matches, it is a SCAM and they will STEAL your account and balance!",
      "font-size: 16px; font-weight: bold; color: #f59e0b; padding: 6px 0;"
    );
    console.log(
      "%cDo NOT paste or execute any scripts in this console.\nOfficial Website: https://ludokingadda.com",
      "font-size: 13px; color: #9ca3af;"
    );
  } catch (e) {
    // Ignore console formatting errors
  }

  // 2. In production, silence noisy runtime logs to keep console clean
  if (isProduction) {
    const noop = () => {};
    try {
      window.console.log = noop;
      window.console.debug = noop;
      window.console.info = noop;
      // Keep console.error for critical crash reports if needed, or silence:
      window.console.dir = noop;
      window.console.table = noop;
    } catch (e) {}
  }

  // 3. Disable DevTools Keyboard Shortcuts
  window.addEventListener(
    "keydown",
    (e) => {
      // Allow shortcuts inside input / textarea
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea") {
        return;
      }

      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+I / Cmd+Opt+I (Inspect)
      // Ctrl+Shift+J / Cmd+Opt+J (Console)
      // Ctrl+Shift+C / Cmd+Opt+C (Inspect Element)
      if (isCtrlOrMeta && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(e.key)) {
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

      // Ctrl+S (Save page)
      if (isCtrlOrMeta && ["S", "s"].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    { capture: true }
  );

  // 4. Disable Context Menu (Right Click) on non-editable elements
  window.addEventListener(
    "contextmenu",
    (e) => {
      const targetTag = e.target?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || e.target?.isContentEditable) {
        return; // Allow paste/copy in form inputs
      }
      e.preventDefault();
    },
    { capture: true }
  );
}
