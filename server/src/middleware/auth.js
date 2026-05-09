import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-in-production";

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user?.username !== "admin") {
      return res.status(403).json({ error: "Admin only." });
    }
    next();
  });
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const decoded = verifyToken(token);
  if (!decoded?.sub) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.user = { id: Number(decoded.sub), username: decoded.username };
  next();
}
