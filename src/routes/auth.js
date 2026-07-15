const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { connectToDatabase } = require("../config/db");
const { authenticateToken } = require("../middlewares/auth");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretjsonwebtokenkeyfornovariseplatform123!";

// Helper to validate email format
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper to validate password strength
function validatePassword(password) {
  if (password.length < 6) return false;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  return hasUpperCase && hasLowerCase && hasNumber;
}

// 1. User Registration
router.post("/register", async (req, res) => {
  try {
    const { name, email, photo_url, password, role } = req.body;

    if (!name || !role || !email || !password) {
      return res.status(400).json({ error: "Name, email, password, and role are required." });
    }

    if (role !== "supporter" && role !== "creator") {
      return res.status(400).json({ error: "Invalid role selected." });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long and contain uppercase, lowercase, and numeric characters.",
      });
    }

    const { db } = await connectToDatabase();

    const existingUser = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists." });
    }

    const defaultCredits = role === "supporter" ? 50 : 20;

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      name,
      email: email.toLowerCase(),
      passwordHash,
      role,
      photo_url: photo_url || "",
      credits: defaultCredits,
      createdAt: new Date(),
    };

    await db.collection("users").insertOne(newUser);

    return res.status(201).json({
      message: "Registration successful!",
      user: {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        photo_url: newUser.photo_url,
        credits: newUser.credits,
      },
    });

  } catch (error) {
    console.error("Server register error:", error);
    return res.status(500).json({ error: "Failed to complete registration." });
  }
});

// 2. User Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { db } = await connectToDatabase();

    const user = await db.collection("users").findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        photo_url: user.photo_url || "",
        credits: user.credits,
      },
    });

  } catch (error) {
    console.error("Server login error:", error);
    return res.status(500).json({ error: "Failed to log in." });
  }
});

// 3. User Session Status
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.user.userId) });

    if (!user) {
      return res.status(404).json({ authenticated: false, error: "User session not found." });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        photo_url: user.photo_url || "",
        credits: user.credits,
      },
    });

  } catch (error) {
    console.error("Server me error:", error);
    return res.status(500).json({ error: "Failed to authenticate session." });
  }
});

// 4. Google OAuth Login / Register (Firebase Social Sign-In)
router.post("/google", async (req, res) => {
  try {
    const { name, email, photo_url, google_uid } = req.body;

    if (!email || !google_uid) {
      return res.status(400).json({ error: "Google credentials are required." });
    }

    const { db } = await connectToDatabase();

    // Check if user already exists
    let user = await db.collection("users").findOne({ email: email.toLowerCase() });

    if (!user) {
      // Create new user with default supporter role (they can contact admin for creator)
      const newUser = {
        name: name || email.split("@")[0],
        email: email.toLowerCase(),
        passwordHash: null, // Google users have no password
        google_uid,
        role: "supporter",
        photo_url: photo_url || "",
        credits: 50,
        createdAt: new Date(),
      };
      const result = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      message: "Google login successful!",
      token,
      user: {
        userId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        photo_url: user.photo_url || "",
        credits: user.credits,
      },
    });

  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({ error: "Google login failed." });
  }
});

module.exports = router;
