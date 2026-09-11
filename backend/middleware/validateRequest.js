// Minimal validator: checks that the given fields exist on req.body.
// Swap for a schema library (e.g. zod) later if validation needs grow.
export function requireFields(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body?.[field];
      if (typeof value === "string" && value.trim() === "") return true;
      return value === undefined || value === null;
    });

    if (missing.length > 0) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    next();
  };
}
