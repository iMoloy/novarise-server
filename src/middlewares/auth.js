const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretjsonwebtokenkeyfornovariseplatform123!";

// Authenticate JWT Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    return res.status(401).json({ error: "Access denied. Token is missing." });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified; // sets userId, email, name, role
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid session token." });
  }
}

// Require specific role(s) middleware
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    
    const hasRole = roles.includes(req.user.role);
    if (!hasRole) {
      return res.status(403).json({ error: `Forbidden. Requires role: ${roles.join(", ")}` });
    }
    
    next();
  };
}

module.exports = { authenticateToken, requireRole };
