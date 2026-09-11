/**
 * Anti-NoSQL Injection & Object Pollution Sanitizer Middleware
 * Recursively strips or rejects keys starting with "$" or containing "."
 * from req.body, req.query, and req.params.
 */
export function mongoSanitize(req, res, next) {
  function sanitize(target) {
    if (!target || typeof target !== "object") return;

    if (Array.isArray(target)) {
      for (let i = 0; i < target.length; i++) {
        if (typeof target[i] === "object") {
          sanitize(target[i]);
        }
      }
      return;
    }

    for (const key of Object.keys(target)) {
      // Check for MongoDB operator injection ($gt, $where, $ne, etc.) or dotted path injection
      if (key.startsWith("$") || key.includes(".")) {
        delete target[key];
      } else if (typeof target[key] === "object" && target[key] !== null) {
        sanitize(target[key]);
      }
    }
  }

  try {
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);
    next();
  } catch (err) {
    return res.status(400).json({ message: "Malformed request payload" });
  }
}
